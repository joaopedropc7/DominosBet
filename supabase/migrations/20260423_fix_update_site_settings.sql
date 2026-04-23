-- Corrige admin_update_site_settings:
-- Usa CASE WHEN IS NOT NULL em vez de COALESCE
-- para que passar 0 explicitamente funcione E
-- campos omitidos (null) não sobrescrevam o valor salvo.

CREATE OR REPLACE FUNCTION public.admin_update_site_settings(
  p_seo_title               text    DEFAULT NULL,
  p_seo_description         text    DEFAULT NULL,
  p_seo_keywords            text    DEFAULT NULL,
  p_aff_cpa                 numeric DEFAULT NULL,
  p_aff_baseline            numeric DEFAULT NULL,
  p_aff_chance_cpa          integer DEFAULT NULL,
  p_aff_revshare            integer DEFAULT NULL,
  p_aff_revshare_fake       integer DEFAULT NULL,
  p_aff_min_withdrawal      numeric DEFAULT NULL,
  p_aff_max_withdrawal      numeric DEFAULT NULL,
  p_aff_daily_withdrawals   integer DEFAULT NULL,
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
    seo_title                  = CASE WHEN p_seo_title               IS NOT NULL THEN p_seo_title               ELSE seo_title                  END,
    seo_description            = CASE WHEN p_seo_description         IS NOT NULL THEN p_seo_description         ELSE seo_description            END,
    seo_keywords               = CASE WHEN p_seo_keywords            IS NOT NULL THEN p_seo_keywords            ELSE seo_keywords               END,
    aff_cpa                    = CASE WHEN p_aff_cpa                 IS NOT NULL THEN p_aff_cpa                 ELSE aff_cpa                    END,
    aff_baseline               = CASE WHEN p_aff_baseline            IS NOT NULL THEN p_aff_baseline            ELSE aff_baseline               END,
    aff_chance_cpa             = CASE WHEN p_aff_chance_cpa          IS NOT NULL THEN p_aff_chance_cpa          ELSE aff_chance_cpa             END,
    aff_revshare               = CASE WHEN p_aff_revshare            IS NOT NULL THEN p_aff_revshare            ELSE aff_revshare               END,
    aff_revshare_fake          = CASE WHEN p_aff_revshare_fake       IS NOT NULL THEN p_aff_revshare_fake       ELSE aff_revshare_fake          END,
    aff_min_withdrawal         = CASE WHEN p_aff_min_withdrawal      IS NOT NULL THEN p_aff_min_withdrawal      ELSE aff_min_withdrawal         END,
    aff_max_withdrawal         = CASE WHEN p_aff_max_withdrawal      IS NOT NULL THEN p_aff_max_withdrawal      ELSE aff_max_withdrawal         END,
    aff_daily_withdrawals      = CASE WHEN p_aff_daily_withdrawals   IS NOT NULL THEN p_aff_daily_withdrawals   ELSE aff_daily_withdrawals      END,
    player_min_deposit         = CASE WHEN p_player_min_deposit      IS NOT NULL THEN p_player_min_deposit      ELSE player_min_deposit         END,
    player_min_withdrawal      = CASE WHEN p_player_min_withdrawal   IS NOT NULL THEN p_player_min_withdrawal   ELSE player_min_withdrawal      END,
    player_rollover            = CASE WHEN p_player_rollover         IS NOT NULL THEN p_player_rollover         ELSE player_rollover            END,
    player_max_withdrawal      = CASE WHEN p_player_max_withdrawal   IS NOT NULL THEN p_player_max_withdrawal   ELSE player_max_withdrawal      END,
    player_withdrawal_fee      = CASE WHEN p_player_withdrawal_fee   IS NOT NULL THEN p_player_withdrawal_fee   ELSE player_withdrawal_fee      END,
    player_first_deposit_bonus = CASE WHEN p_player_first_deposit_bonus IS NOT NULL THEN p_player_first_deposit_bonus ELSE player_first_deposit_bonus END,
    player_daily_withdrawals   = CASE WHEN p_player_daily_withdrawals IS NOT NULL THEN p_player_daily_withdrawals ELSE player_daily_withdrawals   END,
    updated_at                 = now()
  WHERE id = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_site_settings(text,text,text,numeric,numeric,integer,integer,integer,numeric,numeric,integer,numeric,numeric,integer,numeric,numeric,integer,integer) TO authenticated;
