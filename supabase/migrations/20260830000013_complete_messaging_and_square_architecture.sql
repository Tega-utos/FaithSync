-- ==============================================================================
-- Migration: Complete Messaging, Buddy Chat, Groups, and Community Square
-- File: supabase/migrations/20260830000013_complete_messaging_and_square_architecture.sql
-- ==============================================================================

-- 1. Messages Table (1-on-1 Buddy Messages & Nudges)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_id UUID,
  group_id UUID,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  read_at TIMESTAMPTZ
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS chat_id UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

CREATE INDEX IF NOT EXISTS idx_messages_pair ON public.messages(sender_id, recipient_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- 2. Buddy Chats (For session pairing compatibility)
CREATE TABLE IF NOT EXISTS public.buddy_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buddy_connection_id UUID REFERENCES public.buddies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Groups & Group Messages
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Bible Study',
  church TEXT DEFAULT 'Local Assembly',
  guidelines TEXT DEFAULT 'Keep conversations uplifting and encourage daily consistency.',
  invite_code TEXT UNIQUE,
  code TEXT UNIQUE,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  avatar_url TEXT,
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
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group ON public.group_messages(group_id, created_at ASC);

-- 4. Square Posts, Comments & Reactions
CREATE TABLE IF NOT EXISTS public.square_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  title TEXT,
  post_type TEXT NOT NULL DEFAULT 'prayer' CHECK (post_type IN ('prayer', 'testimony', 'reflection', 'scripture', 'general')),
  verse_reference TEXT,
  scripture_reference TEXT,
  scripture_version_id TEXT DEFAULT 'web',
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.square_posts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.square_posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
ALTER TABLE public.square_posts ADD COLUMN IF NOT EXISTS verse_reference TEXT;
ALTER TABLE public.square_posts ADD COLUMN IF NOT EXISTS scripture_reference TEXT;

CREATE TABLE IF NOT EXISTS public.square_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.square_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.square_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.square_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'amen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_post_user_reaction UNIQUE (post_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_square_posts_created ON public.square_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_square_comments_post ON public.square_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_square_reactions_post ON public.square_reactions(post_id);

-- 5. Full RLS Policies for All Tables
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddy_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_reactions ENABLE ROW LEVEL SECURITY;

-- Messages Policies
DROP POLICY IF EXISTS "messages_select_all" ON public.messages;
CREATE POLICY "messages_select_all" ON public.messages FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "messages_insert_auth" ON public.messages;
CREATE POLICY "messages_insert_auth" ON public.messages FOR INSERT TO authenticated WITH CHECK (true);

-- Buddy Chats Policies
DROP POLICY IF EXISTS "buddy_chats_select_all" ON public.buddy_chats;
CREATE POLICY "buddy_chats_select_all" ON public.buddy_chats FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "buddy_chats_insert_auth" ON public.buddy_chats;
CREATE POLICY "buddy_chats_insert_auth" ON public.buddy_chats FOR INSERT TO authenticated WITH CHECK (true);

-- Groups Policies
DROP POLICY IF EXISTS "groups_select_all" ON public.groups;
CREATE POLICY "groups_select_all" ON public.groups FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "groups_insert_auth" ON public.groups;
CREATE POLICY "groups_insert_auth" ON public.groups FOR INSERT TO authenticated WITH CHECK (true);

-- Group Members Policies
DROP POLICY IF EXISTS "group_members_select_all" ON public.group_members;
CREATE POLICY "group_members_select_all" ON public.group_members FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "group_members_insert_auth" ON public.group_members;
CREATE POLICY "group_members_insert_auth" ON public.group_members FOR INSERT TO authenticated WITH CHECK (true);

-- Group Messages Policies
DROP POLICY IF EXISTS "group_messages_select_all" ON public.group_messages;
CREATE POLICY "group_messages_select_all" ON public.group_messages FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "group_messages_insert_auth" ON public.group_messages;
CREATE POLICY "group_messages_insert_auth" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (true);

-- Square Posts Policies
DROP POLICY IF EXISTS "square_posts_select_all" ON public.square_posts;
CREATE POLICY "square_posts_select_all" ON public.square_posts FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "square_posts_insert_auth" ON public.square_posts;
CREATE POLICY "square_posts_insert_auth" ON public.square_posts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "square_posts_update_auth" ON public.square_posts;
CREATE POLICY "square_posts_update_auth" ON public.square_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "square_posts_delete_auth" ON public.square_posts;
CREATE POLICY "square_posts_delete_auth" ON public.square_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Square Comments Policies
DROP POLICY IF EXISTS "square_comments_select_all" ON public.square_comments;
CREATE POLICY "square_comments_select_all" ON public.square_comments FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "square_comments_insert_auth" ON public.square_comments;
CREATE POLICY "square_comments_insert_auth" ON public.square_comments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "square_comments_delete_auth" ON public.square_comments;
CREATE POLICY "square_comments_delete_auth" ON public.square_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Square Reactions Policies
DROP POLICY IF EXISTS "square_reactions_select_all" ON public.square_reactions;
CREATE POLICY "square_reactions_select_all" ON public.square_reactions FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "square_reactions_insert_auth" ON public.square_reactions;
CREATE POLICY "square_reactions_insert_auth" ON public.square_reactions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "square_reactions_delete_auth" ON public.square_reactions;
CREATE POLICY "square_reactions_delete_auth" ON public.square_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reload PostgREST Cache
NOTIFY pgrst, 'reload schema';
