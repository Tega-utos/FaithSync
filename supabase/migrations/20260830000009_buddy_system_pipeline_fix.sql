-- ==============================================================================
-- FaithSync Migration: Buddy Sync Code & Linking Pipeline Fix
-- Version: 20260830000009_buddy_system_pipeline_fix.sql
-- ==============================================================================

-- 1. Ensure Unambiguous Code Generator (Excludes 0, O, 1, I, L)
CREATE OR REPLACE FUNCTION public.generate_unique_code(
  target_table TEXT,
  target_column TEXT,
  code_length INT DEFAULT 6,
  code_prefix TEXT DEFAULT ''
) RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    result := code_prefix || (
      SELECT string_agg(substr(chars, floor(random() * length(chars) + 1)::int, 1), '')
      FROM generate_series(1, code_length)
    );
    EXECUTE format(
      'SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I = $1)',
      target_table, target_column
    ) INTO exists_check USING result;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill any missing buddy_code on existing profiles
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE buddy_code IS NULL OR trim(buddy_code) = '' LOOP
    new_code := public.generate_unique_code('profiles', 'buddy_code', 6);
    UPDATE public.profiles SET buddy_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

-- 3. Ensure buddy_code cannot be null and is always uppercase
ALTER TABLE public.profiles ALTER COLUMN buddy_code SET NOT NULL;

CREATE OR REPLACE FUNCTION public.normalize_profile_buddy_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.buddy_code IS NULL OR trim(NEW.buddy_code) = '' THEN
    NEW.buddy_code := public.generate_unique_code('profiles', 'buddy_code', 6);
  ELSE
    NEW.buddy_code := upper(trim(NEW.buddy_code));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_normalize_profile_buddy_code ON public.profiles;
CREATE TRIGGER trigger_normalize_profile_buddy_code
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_profile_buddy_code();

-- 4. Robust RLS Policies for public.buddies table
ALTER TABLE public.buddies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buddies viewable by participants" ON public.buddies;
DROP POLICY IF EXISTS "Users can view their own buddies" ON public.buddies;
CREATE POLICY "Users can view their own buddies"
  ON public.buddies FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = buddy_id);

DROP POLICY IF EXISTS "Users can send buddy requests" ON public.buddies;
CREATE POLICY "Users can send buddy requests"
  ON public.buddies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update buddy status" ON public.buddies;
CREATE POLICY "Users can update buddy status"
  ON public.buddies FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = buddy_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = buddy_id);

DROP POLICY IF EXISTS "Users can delete buddy connections" ON public.buddies;
CREATE POLICY "Users can delete buddy connections"
  ON public.buddies FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = buddy_id);

-- 5. Enable Realtime Replication on buddies & notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'buddies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.buddies;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if replication is managed by Supabase dashboard
  NULL;
END $$;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
