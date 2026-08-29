-- ==============================================================================
-- FaithSync Complete Master Backend Migration
-- Version: 20260829000004_complete_backend_architecture.sql
-- Fully Idempotent & Safe to Re-run
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Timestamp Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Buddy Code Generator Function
CREATE OR REPLACE FUNCTION public.generate_unique_buddy_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'SYNC-';
  i INTEGER := 0;
  candidate TEXT;
  exists_code BOOLEAN;
BEGIN
  LOOP
    candidate := 'SYNC-';
    FOR i IN 1..4 LOOP
      candidate := candidate || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE buddy_code = candidate) INTO exists_code;
    IF NOT exists_code THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 4. Profiles Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  church TEXT,
  buddy_code TEXT UNIQUE NOT NULL DEFAULT public.generate_unique_buddy_code(),
  streak_count INTEGER NOT NULL DEFAULT 0,
  last_streak_date DATE,
  preferences JSONB NOT NULL DEFAULT '{
    "targets": {
      "prayer": 15,
      "study": 15
    },
    "prayerReminderTime": "07:00",
    "studyReminderTime": "21:00",
    "notifDailyReminders": true,
    "notifBuddyNudges": true,
    "notifGroupActivity": true,
    "reviewDayOfWeek": "Sunday",
    "reviewReminderTime": "18:00",
    "publicStreak": true,
    "publicMilestones": true
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_buddy_code ON public.profiles(buddy_code);
CREATE INDEX IF NOT EXISTS idx_profiles_church ON public.profiles(LOWER(TRIM(church)));

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Auto-sync profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, church, buddy_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'church', 'Local Assembly'),
    public.generate_unique_buddy_code()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    church = COALESCE(EXCLUDED.church, public.profiles.church);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 5. Sessions Table (Devotion Tracking & Timelines)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('prayer', 'study', 'word', 'meditation', 'fasting')),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  target_duration_seconds INTEGER NOT NULL DEFAULT 900,
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  reflection TEXT,
  verse_reference TEXT,
  focus_text TEXT,
  timeline_events JSONB DEFAULT '[]'::jsonb,
  shared_to_square BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON public.sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON public.sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_is_complete ON public.sessions(is_complete);

-- ==============================================================================
-- 6. Buddies Table (1-on-1 Accountability & Square Connections)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.buddies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buddy_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  connection_type TEXT NOT NULL DEFAULT 'sync_code' CHECK (connection_type IN ('sync_code', 'square')),
  permissions JSONB NOT NULL DEFAULT '{"shareHistory": true, "allowNudge": true, "shareLiveSession": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_different_users CHECK (user_id <> buddy_id),
  CONSTRAINT uq_buddy_pair UNIQUE (user_id, buddy_id)
);

CREATE INDEX IF NOT EXISTS idx_buddies_user_id ON public.buddies(user_id);
CREATE INDEX IF NOT EXISTS idx_buddies_buddy_id ON public.buddies(buddy_id);
CREATE INDEX IF NOT EXISTS idx_buddies_status ON public.buddies(status);

DROP TRIGGER IF EXISTS trigger_buddies_updated_at ON public.buddies;
CREATE TRIGGER trigger_buddies_updated_at
  BEFORE UPDATE ON public.buddies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 7. Groups & Group Memberships
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Community Group',
  church TEXT NOT NULL DEFAULT 'Local Assembly',
  guidelines TEXT NOT NULL DEFAULT 'Keep all conversations uplifting and focused on Scripture. Encourage daily consistency.',
  invite_code TEXT UNIQUE NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_group_member UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- Auto-add creator as Admin when a group is created
CREATE OR REPLACE FUNCTION public.handle_new_group_creator()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_group_created_admin ON public.groups;
CREATE TRIGGER on_group_created_admin
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_group_creator();

-- ==============================================================================
-- 8. Messages (1-on-1 & Group Chat)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'nudge', 'clockin_invite', 'verse_share', 'system')),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_pair ON public.messages(sender_id, recipient_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_group ON public.messages(group_id, created_at ASC);

-- ==============================================================================
-- 9. Community Square (Posts & Reactions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.square_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  verse_reference TEXT,
  scripture_reference TEXT,
  scripture_version_id TEXT DEFAULT 'web',
  post_type TEXT NOT NULL DEFAULT 'reflection' CHECK (post_type IN ('prayer', 'prayer_request', 'struggle', 'testimony', 'reflection', 'record', 'milestone')),
  is_anonymous BOOLEAN DEFAULT FALSE,
  allow_connections BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_square_posts_created ON public.square_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_square_posts_type ON public.square_posts(post_type);

CREATE TABLE IF NOT EXISTS public.square_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.square_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('amen', 'applaud', 'pray', 'react')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_post_user_reaction UNIQUE (post_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_square_reactions_post ON public.square_reactions(post_id);

-- ==============================================================================
-- 10. Notifications & Push Subscriptions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('nudge', 'buddy_request', 'buddy_accepted', 'group_invite', 'streak_milestone', 'digest_ready', 'system')),
  title TEXT,
  text TEXT NOT NULL,
  route_url TEXT,
  icon_type TEXT DEFAULT 'bell',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 11. Stored Procedures: Streak Calculation & Session Completion
-- ==============================================================================

-- Stored Procedure: Calculate strict consecutive streak (Dual Prayer & Study target)
CREATE OR REPLACE FUNCTION public.calculate_user_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_streak INTEGER := 0;
  v_prayer_target INTEGER := 15;
  v_study_target INTEGER := 15;
  v_check_date DATE := CURRENT_DATE;
  v_p_mins INTEGER;
  v_s_mins INTEGER;
  v_prefs JSONB;
BEGIN
  -- Read user targets
  SELECT preferences INTO v_prefs FROM public.profiles WHERE id = p_user_id;
  IF v_prefs IS NOT NULL THEN
    v_prayer_target := COALESCE((v_prefs->'targets'->>'prayer')::integer, 15);
    v_study_target := COALESCE((v_prefs->'targets'->>'study')::integer, 15);
  END IF;

  -- Check today's targets
  SELECT
    COALESCE(SUM(CASE WHEN type = 'prayer' THEN duration_seconds ELSE 0 END) / 60, 0),
    COALESCE(SUM(CASE WHEN type IN ('study', 'word') THEN duration_seconds ELSE 0 END) / 60, 0)
  INTO v_p_mins, v_s_mins
  FROM public.sessions
  WHERE user_id = p_user_id
    AND is_complete = TRUE
    AND started_at::date = v_check_date;

  -- If today is hit, increment and start walking back
  IF v_p_mins >= v_prayer_target AND v_s_mins >= v_study_target THEN
    v_streak := v_streak + 1;
    v_check_date := v_check_date - 1;
  ELSE
    -- Check if yesterday was hit; if not, streak is broken
    v_check_date := v_check_date - 1;
    SELECT
      COALESCE(SUM(CASE WHEN type = 'prayer' THEN duration_seconds ELSE 0 END) / 60, 0),
      COALESCE(SUM(CASE WHEN type IN ('study', 'word') THEN duration_seconds ELSE 0 END) / 60, 0)
    INTO v_p_mins, v_s_mins
    FROM public.sessions
    WHERE user_id = p_user_id
      AND is_complete = TRUE
      AND started_at::date = v_check_date;

    IF v_p_mins < v_prayer_target OR v_s_mins < v_study_target THEN
      RETURN 0;
    END IF;
  END IF;

  -- Walk backward day by day
  LOOP
    SELECT
      COALESCE(SUM(CASE WHEN type = 'prayer' THEN duration_seconds ELSE 0 END) / 60, 0),
      COALESCE(SUM(CASE WHEN type IN ('study', 'word') THEN duration_seconds ELSE 0 END) / 60, 0)
    INTO v_p_mins, v_s_mins
    FROM public.sessions
    WHERE user_id = p_user_id
      AND is_complete = TRUE
      AND started_at::date = v_check_date;

    IF v_p_mins >= v_prayer_target AND v_s_mins >= v_study_target THEN
      v_streak := v_streak + 1;
      v_check_date := v_check_date - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Update profiles table
  UPDATE public.profiles
  SET streak_count = v_streak,
      last_streak_date = CURRENT_DATE
  WHERE id = p_user_id;

  RETURN v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 12. Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read, owner write
DROP POLICY IF EXISTS "Profiles viewable by all authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by all authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Sessions: Owner full access, permitted buddies can view
DROP POLICY IF EXISTS "Users can manage own sessions" ON public.sessions;
CREATE POLICY "Users can manage own sessions" ON public.sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Buddies: Participants access
DROP POLICY IF EXISTS "Buddies viewable by participants" ON public.buddies;
CREATE POLICY "Buddies viewable by participants" ON public.buddies FOR ALL TO authenticated USING (auth.uid() = user_id OR auth.uid() = buddy_id);

-- Groups: Viewable by authenticated, created by authenticated
DROP POLICY IF EXISTS "Groups viewable by authenticated" ON public.groups;
CREATE POLICY "Groups viewable by authenticated" ON public.groups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group admins can update groups" ON public.groups;
CREATE POLICY "Group admins can update groups" ON public.groups FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = groups.id AND user_id = auth.uid() AND role = 'admin'));

-- Group Members
DROP POLICY IF EXISTS "Group members viewable" ON public.group_members;
CREATE POLICY "Group members viewable" ON public.group_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins or self can remove members" ON public.group_members;
CREATE POLICY "Admins or self can remove members" ON public.group_members FOR DELETE TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'));

-- Messages
DROP POLICY IF EXISTS "Messages accessible by participants or group members" ON public.messages;
CREATE POLICY "Messages accessible by participants or group members" ON public.messages FOR ALL TO authenticated
USING (
  auth.uid() = sender_id
  OR auth.uid() = recipient_id
  OR (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.group_members WHERE group_id = messages.group_id AND user_id = auth.uid()))
);

-- Square Posts & Reactions
DROP POLICY IF EXISTS "Square posts viewable by all" ON public.square_posts;
CREATE POLICY "Square posts viewable by all" ON public.square_posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create square posts" ON public.square_posts;
CREATE POLICY "Users can create square posts" ON public.square_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own square posts" ON public.square_posts;
CREATE POLICY "Users can update own square posts" ON public.square_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Reactions viewable by all" ON public.square_reactions;
CREATE POLICY "Reactions viewable by all" ON public.square_reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can toggle reactions" ON public.square_reactions;
CREATE POLICY "Users can toggle reactions" ON public.square_reactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notifications & Push Subscriptions
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
