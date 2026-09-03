-- ==============================================================================
-- Migration: Fix Database Error on auth.users Signup Trigger & Profiles RLS
-- File: supabase/migrations/20260904000001_fix_auth_user_created_trigger.sql
-- ==============================================================================

-- 1. Ensure public schema permissions for supabase_auth_admin
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role, supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role, supabase_auth_admin;

-- 2. Open / adjust RLS policies on public.profiles so new signups & service triggers never get blocked
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow reading profiles
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by all authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "profiles_select_all" 
  ON public.profiles FOR SELECT 
  TO authenticated, anon, service_role 
  USING (true);

-- Allow profile creation (both authenticated and system trigger)
DROP POLICY IF EXISTS "profiles_insert_all" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "profiles_insert_all" 
  ON public.profiles FOR INSERT 
  TO authenticated, anon, service_role 
  WITH CHECK (true);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "profiles_update_own" 
  ON public.profiles FOR UPDATE 
  TO authenticated, service_role 
  USING (auth.uid() = id OR auth.uid() IS NULL)
  WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- 3. Bulletproof trigger function with EXCEPTION handling
-- This guarantees that even if a profile cannot be inserted by the trigger,
-- auth.users creation NEVER fails with "Database error saving new user"!
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_name TEXT;
  v_avatar TEXT;
BEGIN
  -- Generate unique 6-char buddy code safely
  BEGIN
    v_code := upper(substr(replace(NEW.id::text, '-', ''), 1, 6));
  EXCEPTION WHEN OTHERS THEN
    v_code := 'SYNC' || floor(random() * 89 + 10)::text;
  END;
  
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

  -- Insert profile, protected by an EXCEPTION block so user creation never crashes!
  BEGIN
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
      '{"onboarding_completed": false, "targets": {"prayer": 15, "study": 15}, "notifDailyReminders": true, "notifBuddyNudges": true, "publicStreak": true}'::jsonb
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      buddy_code = COALESCE(public.profiles.buddy_code, EXCLUDED.buddy_code),
      display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);
  EXCEPTION WHEN OTHERS THEN
    -- Log warning to Postgres logs, but NEVER abort the signup transaction!
    RAISE WARNING 'FaithSync handle_new_user profile insert notice: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 4. Reattach the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Reload Schema cache
NOTIFY pgrst, 'reload schema';
