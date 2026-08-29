-- ==============================================================================
-- FaithSync: Clock-In & Devotion Sync Integration
-- Version: 20260829000005_clockin_backend_integration.sql
-- Idempotent & Safe to Re-run
-- ==============================================================================

-- 1. Ensure `messages.meta` jsonb column exists for structured invite payloads
ALTER TABLE IF EXISTS public.messages
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_messages_meta ON public.messages USING gin (meta);

-- 2. Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_user_endpoint UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "users manage their own subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Live Room / Group Devotion Participants (low frequency: join/leave/mute)
CREATE TABLE IF NOT EXISTS public.group_timer_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  room_id TEXT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_room_participant UNIQUE (room_id, user_id)
);

ALTER TABLE public.group_timer_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants can view room participants" ON public.group_timer_participants;
CREATE POLICY "participants can view room participants"
  ON public.group_timer_participants FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "users can manage own room participation" ON public.group_timer_participants;
CREATE POLICY "users can manage own room participation"
  ON public.group_timer_participants FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Persisted Nudges Feed (distinct from floating broadcast reactions)
CREATE TABLE IF NOT EXISTS public.group_timer_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id TEXT,
  message TEXT DEFAULT 'Keep showing up in prayer!',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.group_timer_nudges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nudges visible to sender or recipient" ON public.group_timer_nudges;
CREATE POLICY "nudges visible to sender or recipient"
  ON public.group_timer_nudges FOR ALL TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = sender_id);
