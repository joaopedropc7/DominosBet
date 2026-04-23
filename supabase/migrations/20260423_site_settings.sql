-- ============================================================
-- Tabela site_settings — configurações globais da plataforma
-- Uma única linha (id = 1) atualizada via upsert
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_settings (
  id                        integer     PRIMARY KEY DEFAULT 1,

  -- SEO
  seo_title                 text        NOT NULL DEFAULT '',
  seo_description           text        NOT NULL DEFAULT '',
  seo_keywords              text        NOT NULL DEFAULT '',

  -- Afiliados › Registro
  aff_cpa                   numeric     NOT NULL DEFAULT 5.00,
  aff_baseline              numeric     NOT NULL DEFAULT 0.00,
  aff_chance_cpa            integer     NOT NULL DEFAULT 100,   -- % de chance de pagar CPA
  aff_revshare              integer     NOT NULL DEFAULT 40,    -- % de RevShare real
  aff_revshare_fake         integer     NOT NULL DEFAULT 0,     -- % de RevShare exibido (fake)

  -- Afiliados › Configuração financeira
  aff_min_withdrawal        numeric     NOT NULL DEFAULT 50.00,
  aff_max_withdrawal        numeric     NOT NULL DEFAULT 10000.00,
  aff_daily_withdrawals     integer     NOT NULL DEFAULT 1,

  -- Financeiro › Jogadores
  player_min_deposit        numeric     NOT NULL DEFAULT 1.00,
  player_min_withdrawal     numeric     NOT NULL DEFAULT 20.00,
  player_rollover           integer     NOT NULL DEFAULT 1,     -- multiplicador de rollover
  player_max_withdrawal     numeric     NOT NULL DEFAULT 5000.00,
  player_withdrawal_fee     numeric     NOT NULL DEFAULT 0,     -- taxa em %
  player_first_deposit_bonus integer    NOT NULL DEFAULT 0,     -- bônus em %
  player_daily_withdrawals  integer     NOT NULL DEFAULT 3,

  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Garante que existe sempre exatamente uma linha
INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Apenas admins podem ler/alterar
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings_admin" ON public.site_settings;
CREATE POLICY "site_settings_admin" ON public.site_settings
  FOR ALL USING (public.is_admin());

-- ── RPC: admin_get_site_settings ─────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_site_settings()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.site_settings%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  SELECT * INTO v_row FROM public.site_settings WHERE id = 1 LIMIT 1;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_site_settings() TO authenticated;

-- ── RPC: admin_update_site_settings ──────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_site_settings(
  -- SEO
  p_seo_title               text    DEFAULT NULL,
  p_seo_description         text    DEFAULT NULL,
  p_seo_keywords            text    DEFAULT NULL,
  -- Afiliados registro
  p_aff_cpa                 numeric DEFAULT NULL,
  p_aff_baseline            numeric DEFAULT NULL,
  p_aff_chance_cpa          integer DEFAULT NULL,
  p_aff_revshare            integer DEFAULT NULL,
  p_aff_revshare_fake       integer DEFAULT NULL,
  -- Afiliados financeiro
  p_aff_min_withdrawal      numeric DEFAULT NULL,
  p_aff_max_withdrawal      numeric DEFAULT NULL,
  p_aff_daily_withdrawals   integer DEFAULT NULL,
  -- Financeiro jogadores
  p_player_min_deposit      numeric DEFAULT NULL,
  p_player_min_withdrawal   numeric DEFAULT NULL,
  p_player_rollover         integer DEFAULT NULL,
  p_player_max_withdrawal   numeric DEFAULT NULL,
  p_player_withdrawal_fee   numeric DEFAULT NULL,
  p_player_first_deposit_bonus integer DEFAULT NULL,
  p_player_daily_withdrawals   integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE public.site_settings SET
    seo_title                 = COALESCE(p_seo_title,               seo_title),
    seo_description           = COALESCE(p_seo_description,         seo_description),
    seo_keywords              = COALESCE(p_seo_keywords,            seo_keywords),
    aff_cpa                   = COALESCE(p_aff_cpa,                 aff_cpa),
    aff_baseline              = COALESCE(p_aff_baseline,            aff_baseline),
    aff_chance_cpa            = COALESCE(p_aff_chance_cpa,          aff_chance_cpa),
    aff_revshare              = COALESCE(p_aff_revshare,            aff_revshare),
    aff_revshare_fake         = COALESCE(p_aff_revshare_fake,       aff_revshare_fake),
    aff_min_withdrawal        = COALESCE(p_aff_min_withdrawal,      aff_min_withdrawal),
    aff_max_withdrawal        = COALESCE(p_aff_max_withdrawal,      aff_max_withdrawal),
    aff_daily_withdrawals     = COALESCE(p_aff_daily_withdrawals,   aff_daily_withdrawals),
    player_min_deposit        = COALESCE(p_player_min_deposit,      player_min_deposit),
    player_min_withdrawal     = COALESCE(p_player_min_withdrawal,   player_min_withdrawal),
    player_rollover           = COALESCE(p_player_rollover,         player_rollover),
    player_max_withdrawal     = COALESCE(p_player_max_withdrawal,   player_max_withdrawal),
    player_withdrawal_fee     = COALESCE(p_player_withdrawal_fee,   player_withdrawal_fee),
    player_first_deposit_bonus = COALESCE(p_player_first_deposit_bonus, player_first_deposit_bonus),
    player_daily_withdrawals  = COALESCE(p_player_daily_withdrawals, player_daily_withdrawals),
    updated_at                = now()
  WHERE id = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_site_settings(text,text,text,numeric,numeric,integer,integer,integer,numeric,numeric,integer,numeric,numeric,integer,numeric,numeric,integer,integer) TO authenticated;
