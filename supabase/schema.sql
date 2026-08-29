-- ==============================================================================
-- FaithSync Database Schema & Row Level Security (RLS)
-- Phase 1 Migration (Fully Idempotent / Safe to Re-run)
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Helper Functions: Updated Timestamp & Buddy Code Generator
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_unique_buddy_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'FS-';
  i INTEGER := 0;
  candidate TEXT;
  exists_code BOOLEAN;
BEGIN
  LOOP
    candidate := 'FS-';
    FOR i IN 1..6 LOOP
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
-- 3. Profiles Table (1:1 with auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  buddy_code TEXT UNIQUE NOT NULL DEFAULT public.generate_unique_buddy_code(),
  preferences JSONB NOT NULL DEFAULT '{
    "targets": {
      "prayer_minutes": 30,
      "word_minutes": 20,
      "meditation_minutes": 10,
      "fasting_hours": 0,
      "study_minutes": 15
    },
    "theme": "system",
    "notifications_enabled": true,
    "daily_reminder_time": "07:00"
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_buddy_code ON public.profiles(buddy_code);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Auto-insert profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, buddy_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    public.generate_unique_buddy_code()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 4. Sessions Table (Core Habit / Spiritual Discipline Tracking)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('prayer', 'word', 'meditation', 'fasting', 'study')),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  target_duration_seconds INTEGER,
  is_complete BOOLEAN NOT NULL DEFAULT TRUE,
  reflection TEXT,
  verse_reference TEXT,
  shared_to_square BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON public.sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON public.sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_is_complete ON public.sessions(is_complete);

-- ==============================================================================
-- 5. Buddies Table (Accountability Partnerships)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.buddies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buddy_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
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
-- 6. Square Posts & Post Likes (Community Encouragement)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.square_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  verse_reference TEXT,
  scripture_reference TEXT,
  scripture_version_id TEXT,
  post_type TEXT NOT NULL DEFAULT 'prayer_request',
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_square_posts_created_at ON public.square_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_square_posts_user_id ON public.square_posts(user_id);

CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.square_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_post_like_user UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);

-- ==============================================================================
-- 7. Buddy Chats & Realtime Messages
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.buddy_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buddy_connection_id UUID NOT NULL UNIQUE REFERENCES public.buddies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_buddy_chats_connection ON public.buddy_chats(buddy_connection_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.buddy_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'nudge', 'verse_share')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON public.messages(chat_id, created_at ASC);

-- Trigger to update last_message_at on buddy_chats
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.buddy_chats
  SET last_message_at = NEW.created_at
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_new_message_chat ON public.messages;
CREATE TRIGGER trigger_new_message_chat
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_message();

-- Auto-create buddy_chat when a buddy request is accepted
CREATE OR REPLACE FUNCTION public.handle_buddy_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    INSERT INTO public.buddy_chats (buddy_connection_id)
    VALUES (NEW.id)
    ON CONFLICT (buddy_connection_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_buddy_accepted_create_chat ON public.buddies;
CREATE TRIGGER trigger_buddy_accepted_create_chat
  AFTER UPDATE OF status ON public.buddies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_buddy_accepted();

-- ==============================================================================
-- 8. Milestone & Streak Calculation Functions
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_user_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_streak INTEGER := 0;
  v_check_date DATE := CURRENT_DATE;
  v_has_session BOOLEAN;
BEGIN
  -- Check if user had a session today; if not, start checking from yesterday
  SELECT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE user_id = p_user_id
      AND is_complete = TRUE
      AND started_at::date = v_check_date
  ) INTO v_has_session;

  IF NOT v_has_session THEN
    v_check_date := v_check_date - 1;
    SELECT EXISTS (
      SELECT 1 FROM public.sessions
      WHERE user_id = p_user_id
        AND is_complete = TRUE
        AND started_at::date = v_check_date
    ) INTO v_has_session;
    
    IF NOT v_has_session THEN
      RETURN 0;
    END IF;
  END IF;

  -- Count consecutive past days
  WHILE v_has_session LOOP
    v_streak := v_streak + 1;
    v_check_date := v_check_date - 1;
    
    SELECT EXISTS (
      SELECT 1 FROM public.sessions
      WHERE user_id = p_user_id
        AND is_complete = TRUE
        AND started_at::date = v_check_date
    ) INTO v_has_session;
  END LOOP;

  RETURN v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_milestones(p_user_id UUID)
RETURNS TABLE (
  total_sessions BIGINT,
  total_minutes BIGINT,
  current_streak_days INTEGER,
  prayer_minutes BIGINT,
  word_minutes BIGINT,
  meditation_minutes BIGINT,
  fasting_hours BIGINT,
  study_minutes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(COUNT(*), 0) AS total_sessions,
    COALESCE(SUM(duration_seconds) / 60, 0) AS total_minutes,
    public.get_user_streak(p_user_id) AS current_streak_days,
    COALESCE(SUM(CASE WHEN type = 'prayer' THEN duration_seconds ELSE 0 END) / 60, 0) AS prayer_minutes,
    COALESCE(SUM(CASE WHEN type = 'word' THEN duration_seconds ELSE 0 END) / 60, 0) AS word_minutes,
    COALESCE(SUM(CASE WHEN type = 'meditation' THEN duration_seconds ELSE 0 END) / 60, 0) AS meditation_minutes,
    COALESCE(SUM(CASE WHEN type = 'fasting' THEN duration_seconds ELSE 0 END) / 3600, 0) AS fasting_hours,
    COALESCE(SUM(CASE WHEN type = 'study' THEN duration_seconds ELSE 0 END) / 60, 0) AS study_minutes
  FROM public.sessions
  WHERE user_id = p_user_id AND is_complete = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 9. Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddy_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Profiles Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Sessions Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users and permitted buddies can view sessions" ON public.sessions;
CREATE POLICY "Users and permitted buddies can view sessions"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.buddies b
      WHERE (
        (b.user_id = sessions.user_id AND b.buddy_id = auth.uid())
        OR (b.buddy_id = sessions.user_id AND b.user_id = auth.uid())
      )
      AND b.status = 'accepted'
      AND (b.permissions->>'shareHistory')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.sessions;
CREATE POLICY "Users can insert their own sessions"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.sessions;
CREATE POLICY "Users can update their own sessions"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.sessions;
CREATE POLICY "Users can delete their own sessions"
  ON public.sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Buddies Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view buddy records they are part of" ON public.buddies;
CREATE POLICY "Users can view buddy records they are part of"
  ON public.buddies FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = buddy_id);

DROP POLICY IF EXISTS "Users can create buddy requests" ON public.buddies;
CREATE POLICY "Users can create buddy requests"
  ON public.buddies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Participants can update buddy status or permissions" ON public.buddies;
CREATE POLICY "Participants can update buddy status or permissions"
  ON public.buddies FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = buddy_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = buddy_id);

DROP POLICY IF EXISTS "Participants can delete buddy connections" ON public.buddies;
CREATE POLICY "Participants can delete buddy connections"
  ON public.buddies FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = buddy_id);

-- ------------------------------------------------------------------------------
-- Square Posts Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Square posts are viewable by authenticated users" ON public.square_posts;
CREATE POLICY "Square posts are viewable by authenticated users"
  ON public.square_posts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own posts" ON public.square_posts;
CREATE POLICY "Users can insert their own posts"
  ON public.square_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.square_posts;
CREATE POLICY "Users can update their own posts"
  ON public.square_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON public.square_posts;
CREATE POLICY "Users can delete their own posts"
  ON public.square_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Post Likes Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Post likes are viewable by authenticated users" ON public.post_likes;
CREATE POLICY "Post likes are viewable by authenticated users"
  ON public.post_likes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
CREATE POLICY "Users can like posts"
  ON public.post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;
CREATE POLICY "Users can unlike posts"
  ON public.post_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Buddy Chats Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Chat participants can view their chats" ON public.buddy_chats;
CREATE POLICY "Chat participants can view their chats"
  ON public.buddy_chats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.buddies b
      WHERE b.id = buddy_chats.buddy_connection_id
        AND (b.user_id = auth.uid() OR b.buddy_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Chat participants can insert chats" ON public.buddy_chats;
CREATE POLICY "Chat participants can insert chats"
  ON public.buddy_chats FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.buddies b
      WHERE b.id = buddy_chats.buddy_connection_id
        AND (b.user_id = auth.uid() OR b.buddy_id = auth.uid())
    )
  );

-- ------------------------------------------------------------------------------
-- Messages Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Chat participants can view messages" ON public.messages;
CREATE POLICY "Chat participants can view messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.buddy_chats c
      JOIN public.buddies b ON b.id = c.buddy_connection_id
      WHERE c.id = messages.chat_id
        AND (b.user_id = auth.uid() OR b.buddy_id = auth.uid())
        AND b.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "Chat participants can send messages" ON public.messages;
CREATE POLICY "Chat participants can send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.buddy_chats c
      JOIN public.buddies b ON b.id = c.buddy_connection_id
      WHERE c.id = messages.chat_id
        AND (b.user_id = auth.uid() OR b.buddy_id = auth.uid())
        AND b.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "Chat participants can update read receipts" ON public.messages;
CREATE POLICY "Chat participants can update read receipts"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.buddy_chats c
      JOIN public.buddies b ON b.id = c.buddy_connection_id
      WHERE c.id = messages.chat_id
        AND (b.user_id = auth.uid() OR b.buddy_id = auth.uid())
    )
  );

-- ==============================================================================
-- 10. Notifications Table & Realtime Policies
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  icon_type TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  route_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users or system can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users or system can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ==============================================================================
-- 11. Groups & Group Cohorts
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  church TEXT,
  guidelines TEXT,
  avatar_url TEXT,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_group_member UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'nudge', 'clockin_invite', 'system')),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.live_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL UNIQUE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  discipline TEXT NOT NULL CHECK (discipline IN ('prayer', 'study')),
  target_mins INTEGER NOT NULL DEFAULT 30,
  focus_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.square_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.square_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('amen', 'applaud')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_square_reaction UNIQUE (post_id, user_id, reaction_type)
);

-- Enable RLS on new tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_reactions ENABLE ROW LEVEL SECURITY;

-- Group policies
CREATE POLICY "Groups viewable by authenticated users" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Group admins can update groups" ON public.groups FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- Group members policies
CREATE POLICY "Members viewable by authenticated users" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON public.group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Group messages policies
CREATE POLICY "Group messages viewable by members" ON public.group_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "Group members can send messages" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid())
);

-- Live rooms policies
CREATE POLICY "Live rooms viewable by authenticated users" ON public.live_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create live rooms" ON public.live_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts can update live rooms" ON public.live_rooms FOR UPDATE TO authenticated USING (auth.uid() = host_id);

-- Square reactions policies
CREATE POLICY "Square reactions viewable by authenticated users" ON public.square_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add square reactions" ON public.square_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.square_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==============================================================================
-- 12. Storage Bucket: Avatars
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars');

-- ==============================================================================
-- 13. Supabase Realtime Publication
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rooms;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.buddies;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.square_posts;
  EXCEPTION WHEN duplicate_object THEN END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.square_reactions;
  EXCEPTION WHEN duplicate_object THEN END;
END $$;

-- ==============================================================================
-- 14. Scripture System & Prayer Focus Templates
-- ==============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_bible_version TEXT DEFAULT 'web';
ALTER TABLE public.square_posts ADD COLUMN IF NOT EXISTS scripture_reference TEXT;
ALTER TABLE public.square_posts ADD COLUMN IF NOT EXISTS scripture_version_id TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS focus_type TEXT DEFAULT 'quick';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS focus_timeline JSONB;

CREATE TABLE IF NOT EXISTS public.prayer_focus_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  segments JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.prayer_focus_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage their own templates" ON public.prayer_focus_templates;
CREATE POLICY "users manage their own templates"
  ON public.prayer_focus_templates FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.scripture_cache (
  reference TEXT NOT NULL,
  version_id TEXT NOT NULL,
  text TEXT NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (reference, version_id)
);

ALTER TABLE public.scripture_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read scripture cache" ON public.scripture_cache;
CREATE POLICY "anyone can read scripture cache"
  ON public.scripture_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "authenticated users can insert scripture cache" ON public.scripture_cache;
CREATE POLICY "authenticated users can insert scripture cache"
  ON public.scripture_cache FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
