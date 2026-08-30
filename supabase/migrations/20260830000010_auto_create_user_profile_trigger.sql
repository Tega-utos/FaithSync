-- ==============================================================================
-- Migration: Auto Create Profile Trigger & Backfill
-- File: supabase/migrations/20260830000010_auto_create_user_profile_trigger.sql
-- ==============================================================================

-- 1. Helper Function: Generate unique unambiguous 6-character code
CREATE OR REPLACE FUNCTION public.generate_unique_buddy_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    result := (
      SELECT string_agg(substr(chars, floor(random() * length(chars) + 1)::int, 1), '')
      FROM generate_series(1, 6)
    );
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE buddy_code = result) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger Function: Automatically create profile upon user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
  v_name TEXT;
  v_avatar TEXT;
BEGIN
  -- Generate unique 6-char buddy code
  v_code := public.generate_unique_buddy_code();
  
  -- Extract name from metadata or fallback to email prefix
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'Believer'
  );

  -- Extract avatar if OAuth provider supplied one
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );

  INSERT INTO public.profiles (
    id,
    display_name,
    avatar_url,
    buddy_code,
    church,
    preferences
  ) VALUES (
    NEW.id,
    v_name,
    v_avatar,
    v_code,
    'Local Assembly',
    '{"targets": {"prayer": 15, "study": 15}, "notifDailyReminders": true, "notifBuddyNudges": true, "publicStreak": true}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    buddy_code = COALESCE(public.profiles.buddy_code, EXCLUDED.buddy_code),
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach Trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill all existing users in auth.users into public.profiles
DO $$
DECLARE
  u RECORD;
  v_code TEXT;
  v_name TEXT;
  v_avatar TEXT;
BEGIN
  FOR u IN SELECT * FROM auth.users LOOP
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = u.id) THEN
      v_code := public.generate_unique_buddy_code();
      v_name := COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1),
        'Believer'
      );
      v_avatar := COALESCE(
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'picture',
        NULL
      );

      INSERT INTO public.profiles (
        id,
        display_name,
        avatar_url,
        buddy_code,
        church,
        preferences
      ) VALUES (
        u.id,
        v_name,
        v_avatar,
        v_code,
        'Local Assembly',
        '{"targets": {"prayer": 15, "study": 15}, "notifDailyReminders": true, "notifBuddyNudges": true, "publicStreak": true}'::jsonb
      );
    ELSE
      -- Ensure buddy_code is not null
      UPDATE public.profiles
      SET buddy_code = public.generate_unique_buddy_code()
      WHERE id = u.id AND (buddy_code IS NULL OR trim(buddy_code) = '');
    END IF;
  END LOOP;
END $$;

-- 5. Open SELECT RLS Policy on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by all authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "profiles_select_all" 
  ON public.profiles 
  FOR SELECT 
  TO authenticated, anon 
  USING (true);

-- 6. Reload Schema
NOTIFY pgrst, 'reload schema';
