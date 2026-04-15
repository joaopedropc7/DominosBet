-- ── Friendships ────────────────────────────────────────────────────────────
-- Stores friend requests and accepted friendships.
-- requester_id → who sent the request
-- addressee_id → who received the request
-- status: 'pending' | 'accepted'
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.friendships (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at     timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT no_self_friend CHECK (requester_id <> addressee_id),
  CONSTRAINT unique_pair     UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON public.friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON public.friendships(requester_id, status);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Users can see any friendship row they are part of
CREATE POLICY "Users can view their friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can send friend requests (insert as requester)
CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Users can accept/delete friendships they are part of
CREATE POLICY "Users can update their friendships"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can delete their friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ── Helper: search profile by exact nickname (case-insensitive) ─────────────

CREATE OR REPLACE FUNCTION public.find_profile_by_nickname(nickname text)
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT * FROM public.profiles
  WHERE lower(display_name) = lower(trim(nickname))
    AND id <> auth.uid()
  LIMIT 1;
$$;
