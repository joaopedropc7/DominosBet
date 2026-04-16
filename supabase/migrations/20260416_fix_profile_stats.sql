-- ============================================================
-- Fix profile stats
-- Problems found:
--   1. New user defaults were fake mock data (142 matches, 65% win_rate, level 42)
--   2. increment_profile_after_victory never updated win_rate for the winner
--   3. All existing users have wrong stats from the fake defaults
-- ============================================================

-- 1. Fix column defaults so future users start from zero
ALTER TABLE public.profiles
  ALTER COLUMN rank_label     SET DEFAULT 'Iniciante',
  ALTER COLUMN level          SET DEFAULT 1,
  ALTER COLUMN xp             SET DEFAULT 0,
  ALTER COLUMN xp_target      SET DEFAULT 1000,
  ALTER COLUMN win_rate       SET DEFAULT 0,
  ALTER COLUMN matches_count  SET DEFAULT 0,
  ALTER COLUMN streak_label   SET DEFAULT '—';

-- 2. Recompute stats for every user from real match_history data.
--    Users with no real matches get reset to zero.
UPDATE public.profiles p
SET
  matches_count = COALESCE(stats.total, 0),
  win_rate      = COALESCE(
    CASE
      WHEN stats.total > 0
        THEN ROUND((stats.wins::numeric / stats.total) * 100, 2)
      ELSE 0
    END,
    0
  ),
  rank_label    = CASE
    WHEN COALESCE(stats.total, 0) = 0 THEN 'Iniciante'
    WHEN ROUND((COALESCE(stats.wins,0)::numeric / COALESCE(stats.total,1)) * 100) >= 70 THEN 'Lendário'
    WHEN ROUND((COALESCE(stats.wins,0)::numeric / COALESCE(stats.total,1)) * 100) >= 55 THEN 'Experiente'
    ELSE 'Iniciante'
  END,
  level         = GREATEST(1, COALESCE(stats.total, 0) / 5 + 1),
  xp            = COALESCE(stats.total, 0) * 120 + COALESCE(stats.wins, 0) * 80,
  streak_label  = CASE
    WHEN COALESCE(stats.total, 0) = 0 THEN '—'
    ELSE COALESCE(stats.total, 0) || ' partidas'
  END
FROM (
  SELECT
    user_id,
    COUNT(*)                              AS total,
    COUNT(*) FILTER (WHERE result = 'win') AS wins
  FROM public.match_history
  GROUP BY user_id
) stats
WHERE p.id = stats.user_id;

-- Also reset users who have NO match history (they have the fake mock defaults)
UPDATE public.profiles
SET
  matches_count = 0,
  win_rate      = 0,
  rank_label    = 'Iniciante',
  level         = 1,
  xp            = 0,
  streak_label  = '—'
WHERE id NOT IN (SELECT DISTINCT user_id FROM public.match_history);

-- 3. Fix increment_profile_after_victory to also update win_rate
CREATE OR REPLACE FUNCTION public.increment_profile_after_victory(
  target_user_id uuid,
  reward_amount  integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_matches integer;
  v_old_winrate numeric;
BEGIN
  SELECT matches_count, win_rate
    INTO v_old_matches, v_old_winrate
    FROM public.profiles
   WHERE id = target_user_id;

  UPDATE public.profiles
  SET
    matches_count = matches_count + 1,
    win_rate      = CASE
                      WHEN (v_old_matches + 1) = 0 THEN 100
                      ELSE ROUND(
                        ((v_old_winrate * v_old_matches) + 100)
                        / (v_old_matches + 1)
                      , 2)
                    END,
    xp            = xp + 120,
    streak_label  = 'Vitória recente',
    rank_label    = CASE
                      WHEN ROUND(
                             ((v_old_winrate * v_old_matches) + 100)
                             / (v_old_matches + 1)
                           ) >= 70 THEN 'Lendário'
                      WHEN ROUND(
                             ((v_old_winrate * v_old_matches) + 100)
                             / (v_old_matches + 1)
                           ) >= 55 THEN 'Experiente'
                      ELSE 'Iniciante'
                    END
  WHERE id = target_user_id;
END;
$$;
