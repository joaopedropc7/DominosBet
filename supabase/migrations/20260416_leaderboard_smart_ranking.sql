-- ============================================================
-- Smart leaderboard ranking using Bayesian average
--
-- Problem: raw win_rate puts 1-game players at the top (100% win rate).
-- Solution: Bayesian-adjusted score with a prior of 10 matches at 50%.
--
--   adjusted_score = (win_rate * matches_count + 500) / (matches_count + 10)
--
-- This "dilutes" win rates for players with few matches toward 50%.
-- The more matches played, the closer the score gets to the real win_rate.
--
-- Examples:
--   1 match,  100% win_rate  → adjusted  54.5%
--   10 matches, 80% win_rate → adjusted  65.0%
--   50 matches, 90% win_rate → adjusted  83.3%
--  100 matches, 75% win_rate → adjusted  72.7%
--
-- Minimum 5 matches to appear in the ranking.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (
  rank_pos      bigint,
  id            uuid,
  display_name  text,
  avatar_id     text,
  rank_label    text,
  matches_count int,
  win_rate      numeric,
  balance       int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        -- Bayesian-adjusted win rate: prior = 10 matches at 50%
        (win_rate * matches_count + 500.0) / (matches_count + 10) DESC,
        matches_count DESC
    ) AS rank_pos,
    id,
    display_name,
    avatar_id,
    rank_label,
    matches_count,
    win_rate,
    balance
  FROM public.profiles
  WHERE matches_count >= 5     -- minimum 5 matches to appear
    AND is_banned = false
  ORDER BY
    (win_rate * matches_count + 500.0) / (matches_count + 10) DESC,
    matches_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO authenticated;
