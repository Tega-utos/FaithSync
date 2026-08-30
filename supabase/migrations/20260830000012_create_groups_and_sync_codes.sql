-- ==============================================================================
-- Migration: Groups Architecture & Automatic Group Sync Codes
-- File: supabase/migrations/20260830000012_create_groups_and_sync_codes.sql
-- ==============================================================================

-- 1. Helper function for generating unique group sync codes (e.g. GRP-7X2K9M or SYNC-7X2K9M)
CREATE OR REPLACE FUNCTION public.generate_unique_group_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    result := 'SYNC-' || (
      SELECT string_agg(substr(chars, floor(random() * length(chars) + 1)::int, 1), '')
      FROM generate_series(1, 6)
    );
    SELECT EXISTS(SELECT 1 FROM public.groups WHERE invite_code = result OR code = result) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Groups Table
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

-- 3. Automatic Trigger: Generate Group Sync Code before insert
CREATE OR REPLACE FUNCTION public.handle_new_group_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL OR trim(NEW.invite_code) = '' THEN
    NEW.invite_code := public.generate_unique_group_code();
  END IF;
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := NEW.invite_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_group_code ON public.groups;
CREATE TRIGGER trigger_auto_group_code
  BEFORE INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_group_code();

-- 4. Group Memberships
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_group_member UNIQUE (group_id, user_id)
);

-- 5. Group Messages
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'clockin_invite', 'nudge', 'system')),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for high-speed lookup
CREATE INDEX IF NOT EXISTS idx_groups_code ON public.groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_groups_alias_code ON public.groups(code);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON public.group_messages(group_id, created_at ASC);

-- 6. Row Level Security Policies
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_select_all" ON public.groups;
CREATE POLICY "groups_select_all" ON public.groups
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "groups_insert_auth" ON public.groups;
CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "groups_update_auth" ON public.groups;
CREATE POLICY "groups_update_auth" ON public.groups
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "group_members_select_all" ON public.group_members;
CREATE POLICY "group_members_select_all" ON public.group_members
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "group_members_insert_auth" ON public.group_members;
CREATE POLICY "group_members_insert_auth" ON public.group_members
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "group_members_delete_auth" ON public.group_members;
CREATE POLICY "group_members_delete_auth" ON public.group_members
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.groups WHERE groups.id = group_members.group_id AND groups.created_by = auth.uid()
  ));

DROP POLICY IF EXISTS "group_messages_select_all" ON public.group_messages;
CREATE POLICY "group_messages_select_all" ON public.group_messages
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "group_messages_insert_auth" ON public.group_messages;
CREATE POLICY "group_messages_insert_auth" ON public.group_messages
  FOR INSERT TO authenticated WITH CHECK (true);

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
