-- ═══════════════════════════════════════════════════════════════
-- 1. Taxa de saque de afiliados (aff_withdrawal_fee)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS aff_withdrawal_fee numeric DEFAULT 0;

-- Adiciona fee_amount e net_amount em affiliate_withdrawals
ALTER TABLE public.affiliate_withdrawals
  ADD COLUMN IF NOT EXISTS fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric;

-- Backfill net_amount para registros antigos (sem taxa)
UPDATE public.affiliate_withdrawals
   SET net_amount  = amount,
       fee_amount  = 0
 WHERE net_amount IS NULL;

ALTER TABLE public.affiliate_withdrawals
  ALTER COLUMN net_amount SET NOT NULL,
  ALTER COLUMN net_amount SET DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════
-- 2. get_affiliate_settings — inclui aff_withdrawal_fee
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_affiliate_settings()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.site_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.site_settings WHERE id = 1 LIMIT 1;
  RETURN jsonb_build_object(
    'aff_min_withdrawal',   COALESCE(v_row.aff_min_withdrawal,   50),
    'aff_max_withdrawal',   COALESCE(v_row.aff_max_withdrawal,   10000),
    'aff_daily_withdrawals',COALESCE(v_row.aff_daily_withdrawals,1),
    'aff_withdrawal_fee',   COALESCE(v_row.aff_withdrawal_fee,   0)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_affiliate_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_affiliate_settings() TO anon;

-- ═══════════════════════════════════════════════════════════════
-- 3. request_affiliate_withdrawal — aplica taxa + grava net_amount
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.request_affiliate_withdrawal(p_amount numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_affiliate public.affiliates%ROWTYPE;
  v_settings  public.site_settings%ROWTYPE;
  v_fee_pct   numeric;
  v_fee_amt   numeric;
  v_net_amt   numeric;
BEGIN
  SELECT * INTO v_affiliate FROM public.affiliates WHERE user_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Afiliado não encontrado.'; END IF;

  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1 LIMIT 1;

  -- Validações
  IF p_amount < COALESCE(v_settings.aff_min_withdrawal, 50) THEN
    RAISE EXCEPTION 'Valor mínimo para saque é R$ %.2f', COALESCE(v_settings.aff_min_withdrawal, 50);
  END IF;
  IF p_amount > COALESCE(v_settings.aff_max_withdrawal, 10000) THEN
    RAISE EXCEPTION 'Valor máximo para saque é R$ %.2f', COALESCE(v_settings.aff_max_withdrawal, 10000);
  END IF;
  IF p_amount > v_affiliate.balance THEN
    RAISE EXCEPTION 'Saldo insuficiente.';
  END IF;
  IF v_affiliate.pix_key IS NULL THEN
    RAISE EXCEPTION 'Cadastre uma chave PIX antes de sacar.';
  END IF;

  -- Calcular taxa
  v_fee_pct := COALESCE(v_settings.aff_withdrawal_fee, 0);
  v_fee_amt := FLOOR(p_amount * v_fee_pct / 100.0);
  v_net_amt := p_amount - v_fee_amt;

  -- Debitar saldo
  UPDATE public.affiliates
     SET balance = balance - p_amount
   WHERE id = v_affiliate.id;

  -- Registrar saque
  INSERT INTO public.affiliate_withdrawals
    (affiliate_id, amount, fee_amount, net_amount, pix_key_type, pix_key, external_ref, status)
  VALUES (
    v_affiliate.id,
    p_amount,
    v_fee_amt,
    v_net_amt,
    COALESCE(v_affiliate.pix_key_type, ''),
    COALESCE(v_affiliate.pix_key, ''),
    'awd-' || gen_random_uuid(),
    'pending'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_affiliate_withdrawal(numeric) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 4. admin_list_affiliate_withdrawals — inclui fee_amount / net_amount
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_list_affiliate_withdrawals(
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id               uuid,
  affiliate_id     uuid,
  affiliate_name   text,
  affiliate_email  text,
  destination_name text,
  destination_doc  text,
  amount           numeric,
  fee_amount       numeric,
  net_amount       numeric,
  pix_key_type     text,
  pix_key          text,
  status           text,
  external_ref     text,
  orama_id         text,
  admin_notes      text,
  created_at       timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
    SELECT
      aw.id, aw.affiliate_id,
      a.name                                AS affiliate_name,
      a.email                               AS affiliate_email,
      COALESCE(a.name, p.display_name, '')  AS destination_name,
      COALESCE(NULLIF(a.cpf,''), NULLIF(p.cpf,''),
        CASE WHEN UPPER(aw.pix_key_type)='CPF' THEN aw.pix_key ELSE '' END
      )                                     AS destination_doc,
      aw.amount, aw.fee_amount, aw.net_amount,
      aw.pix_key_type, aw.pix_key, aw.status,
      aw.external_ref, aw.orama_id, aw.admin_notes, aw.created_at
    FROM public.affiliate_withdrawals aw
    JOIN public.affiliates a ON a.id       = aw.affiliate_id
    JOIN public.profiles   p ON p.id       = a.profile_id
    WHERE (p_status IS NULL OR aw.status = p_status)
    ORDER BY aw.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_affiliate_withdrawals(text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. admin_update_site_settings — inclui p_aff_withdrawal_fee
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_update_site_settings(
  p_seo_title                  text    DEFAULT NULL,
  p_seo_description            text    DEFAULT NULL,
  p_seo_keywords               text    DEFAULT NULL,
  p_aff_cpa                    numeric DEFAULT NULL,
  p_aff_baseline               numeric DEFAULT NULL,
  p_aff_chance_cpa             integer DEFAULT NULL,
  p_aff_revshare               integer DEFAULT NULL,
  p_aff_revshare_fake          integer DEFAULT NULL,
  p_aff_min_withdrawal         numeric DEFAULT NULL,
  p_aff_max_withdrawal         numeric DEFAULT NULL,
  p_aff_daily_withdrawals      integer DEFAULT NULL,
  p_aff_withdrawal_fee         numeric DEFAULT NULL,
  p_player_min_deposit         numeric DEFAULT NULL,
  p_player_min_withdrawal      numeric DEFAULT NULL,
  p_player_rollover            integer DEFAULT NULL,
  p_player_max_withdrawal      numeric DEFAULT NULL,
  p_player_withdrawal_fee      numeric DEFAULT NULL,
  p_player_first_deposit_bonus integer DEFAULT NULL,
  p_player_daily_withdrawals   integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  UPDATE public.site_settings SET
    seo_title                  = CASE WHEN p_seo_title                  IS NOT NULL THEN p_seo_title                  ELSE seo_title                  END,
    seo_description            = CASE WHEN p_seo_description            IS NOT NULL THEN p_seo_description            ELSE seo_description            END,
    seo_keywords               = CASE WHEN p_seo_keywords               IS NOT NULL THEN p_seo_keywords               ELSE seo_keywords               END,
    aff_cpa                    = CASE WHEN p_aff_cpa                    IS NOT NULL THEN p_aff_cpa                    ELSE aff_cpa                    END,
    aff_baseline               = CASE WHEN p_aff_baseline               IS NOT NULL THEN p_aff_baseline               ELSE aff_baseline               END,
    aff_chance_cpa             = CASE WHEN p_aff_chance_cpa             IS NOT NULL THEN p_aff_chance_cpa             ELSE aff_chance_cpa             END,
    aff_revshare               = CASE WHEN p_aff_revshare               IS NOT NULL THEN p_aff_revshare               ELSE aff_revshare               END,
    aff_revshare_fake          = CASE WHEN p_aff_revshare_fake          IS NOT NULL THEN p_aff_revshare_fake          ELSE aff_revshare_fake          END,
    aff_min_withdrawal         = CASE WHEN p_aff_min_withdrawal         IS NOT NULL THEN p_aff_min_withdrawal         ELSE aff_min_withdrawal         END,
    aff_max_withdrawal         = CASE WHEN p_aff_max_withdrawal         IS NOT NULL THEN p_aff_max_withdrawal         ELSE aff_max_withdrawal         END,
    aff_daily_withdrawals      = CASE WHEN p_aff_daily_withdrawals      IS NOT NULL THEN p_aff_daily_withdrawals      ELSE aff_daily_withdrawals      END,
    aff_withdrawal_fee         = CASE WHEN p_aff_withdrawal_fee         IS NOT NULL THEN p_aff_withdrawal_fee         ELSE aff_withdrawal_fee         END,
    player_min_deposit         = CASE WHEN p_player_min_deposit         IS NOT NULL THEN p_player_min_deposit         ELSE player_min_deposit         END,
    player_min_withdrawal      = CASE WHEN p_player_min_withdrawal      IS NOT NULL THEN p_player_min_withdrawal      ELSE player_min_withdrawal      END,
    player_rollover            = CASE WHEN p_player_rollover            IS NOT NULL THEN p_player_rollover            ELSE player_rollover            END,
    player_max_withdrawal      = CASE WHEN p_player_max_withdrawal      IS NOT NULL THEN p_player_max_withdrawal      ELSE player_max_withdrawal      END,
    player_withdrawal_fee      = CASE WHEN p_player_withdrawal_fee      IS NOT NULL THEN p_player_withdrawal_fee      ELSE player_withdrawal_fee      END,
    player_first_deposit_bonus = CASE WHEN p_player_first_deposit_bonus IS NOT NULL THEN p_player_first_deposit_bonus ELSE player_first_deposit_bonus END,
    player_daily_withdrawals   = CASE WHEN p_player_daily_withdrawals   IS NOT NULL THEN p_player_daily_withdrawals   ELSE player_daily_withdrawals   END,
    updated_at                 = now()
  WHERE id = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_site_settings(text,text,text,numeric,numeric,integer,integer,integer,numeric,numeric,integer,numeric,numeric,numeric,integer,numeric,numeric,integer,integer) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. admin_get_site_settings — inclui aff_withdrawal_fee
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_get_site_settings()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.site_settings%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO v_row FROM public.site_settings WHERE id = 1 LIMIT 1;
  RETURN jsonb_build_object(
    'seo_title',                 v_row.seo_title,
    'seo_description',           v_row.seo_description,
    'seo_keywords',              v_row.seo_keywords,
    'aff_cpa',                   v_row.aff_cpa,
    'aff_baseline',              v_row.aff_baseline,
    'aff_chance_cpa',            v_row.aff_chance_cpa,
    'aff_revshare',              v_row.aff_revshare,
    'aff_revshare_fake',         v_row.aff_revshare_fake,
    'aff_min_withdrawal',        v_row.aff_min_withdrawal,
    'aff_max_withdrawal',        v_row.aff_max_withdrawal,
    'aff_daily_withdrawals',     v_row.aff_daily_withdrawals,
    'aff_withdrawal_fee',        COALESCE(v_row.aff_withdrawal_fee, 0),
    'player_min_deposit',        v_row.player_min_deposit,
    'player_min_withdrawal',     v_row.player_min_withdrawal,
    'player_rollover',           v_row.player_rollover,
    'player_max_withdrawal',     v_row.player_max_withdrawal,
    'player_withdrawal_fee',     v_row.player_withdrawal_fee,
    'player_first_deposit_bonus',v_row.player_first_deposit_bonus,
    'player_daily_withdrawals',  v_row.player_daily_withdrawals
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_site_settings() TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 7. admin_chart_data — dados diários para gráficos do admin
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_chart_data(p_days int DEFAULT 30)
RETURNS TABLE (
  day                        date,
  deposits_total             numeric,
  deposits_count             bigint,
  player_wd_total            numeric,
  affiliate_wd_total         numeric,
  net_revenue                numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      (current_date - (p_days - 1) * INTERVAL '1 day')::date,
      current_date,
      '1 day'::interval
    )::date AS day
  ),
  dep AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
           SUM(amount_reais) AS total, COUNT(*) AS cnt
      FROM public.deposits WHERE status = 'paid'
      GROUP BY 1
  ),
  pwd AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
           SUM(net_amount) AS total
      FROM public.withdrawals WHERE status = 'paid'
      GROUP BY 1
  ),
  awd AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
           SUM(net_amount) AS total
      FROM public.affiliate_withdrawals WHERE status IN ('paid','approved')
      GROUP BY 1
  )
  SELECT
    d.day,
    COALESCE(dep.total, 0)  AS deposits_total,
    COALESCE(dep.cnt,   0)  AS deposits_count,
    COALESCE(pwd.total, 0)  AS player_wd_total,
    COALESCE(awd.total, 0)  AS affiliate_wd_total,
    COALESCE(dep.total, 0) - COALESCE(pwd.total, 0) - COALESCE(awd.total, 0) AS net_revenue
  FROM days d
  LEFT JOIN dep ON dep.day = d.day
  LEFT JOIN pwd ON pwd.day = d.day
  LEFT JOIN awd ON awd.day = d.day
  ORDER BY d.day;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_chart_data(int) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 8. affiliate_chart_data — dados diários para gráficos do afiliado
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.affiliate_chart_data(p_days int DEFAULT 30)
RETURNS TABLE (
  day          date,
  commissions  numeric,
  withdrawals  numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
DECLARE v_aff_id uuid;
BEGIN
  SELECT id INTO v_aff_id FROM public.affiliates WHERE user_id = v_uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Afiliado não encontrado.'; END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      (current_date - (p_days - 1) * INTERVAL '1 day')::date,
      current_date,
      '1 day'::interval
    )::date AS day
  ),
  comm AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
           SUM(amount) AS total
      FROM public.affiliate_commissions
     WHERE affiliate_id = v_aff_id
     GROUP BY 1
  ),
  wd AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
           SUM(amount) AS total
      FROM public.affiliate_withdrawals
     WHERE affiliate_id = v_aff_id AND status IN ('paid','approved','processing','pending')
     GROUP BY 1
  )
  SELECT
    d.day,
    COALESCE(comm.total, 0) AS commissions,
    COALESCE(wd.total,   0) AS withdrawals
  FROM days d
  LEFT JOIN comm ON comm.day = d.day
  LEFT JOIN wd   ON wd.day   = d.day
  ORDER BY d.day;
END;
$$;
GRANT EXECUTE ON FUNCTION public.affiliate_chart_data(int) TO authenticated;
