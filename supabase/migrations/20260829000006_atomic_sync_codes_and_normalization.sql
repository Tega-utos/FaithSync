-- ==============================================================================
-- FaithSync Migration: Atomic Sync Codes Generation & Normalization
-- Version: 20260829000006_atomic_sync_codes_and_normalization.sql
-- ==============================================================================

-- 1. Unambiguous Universal Code Generator Function (No 0/O, 1/I/L)
CREATE OR REPLACE FUNCTION public.generate_unique_code(
  target_table TEXT,
  target_column TEXT,
  code_length INT DEFAULT 6,
  code_prefix TEXT DEFAULT ''
) RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- Excludes 0, O, 1, I, L
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

-- 2. Handle New User Trigger: Assign Buddy Code Atomically on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    display_name,
    buddy_code,
    preferences,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'FaithSync Member'),
    public.generate_unique_code('profiles', 'buddy_code', 6),
    '{
      "targets": {
        "prayer": 15,
        "study": 15
      },
      "reminderTimes": {
        "daily": "07:00",
        "prayer": "07:00",
        "study": "21:00"
      },
      "notifDailyReminders": true,
      "notifBuddyNudges": true,
      "notifGroupActivity": true,
      "publicStreak": true,
      "publicMilestones": true
    }'::jsonb,
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    buddy_code = COALESCE(public.profiles.buddy_code, EXCLUDED.buddy_code),
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Groups Code Generation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_group_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.generate_unique_code('groups', 'code', 6, 'SYNC-');
  ELSE
    NEW.code := upper(trim(NEW.code));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'groups') THEN
    DROP TRIGGER IF EXISTS before_group_insert ON public.groups;
    CREATE TRIGGER before_group_insert
      BEFORE INSERT ON public.groups
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_group_code();
  END IF;
END $$;

-- 4. One-Time Backfill Migration for Any Pre-Existing Rows Without Codes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE buddy_code IS NULL OR trim(buddy_code) = '' LOOP
    UPDATE public.profiles
    SET buddy_code = public.generate_unique_code('profiles', 'buddy_code', 6)
    WHERE id = r.id;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'groups') THEN
    FOR r IN SELECT id FROM public.groups WHERE code IS NULL OR trim(code) = '' LOOP
      UPDATE public.groups
      SET code = public.generate_unique_code('groups', 'code', 6, 'SYNC-')
      WHERE id = r.id;
    END LOOP;
  END IF;
END $$;
