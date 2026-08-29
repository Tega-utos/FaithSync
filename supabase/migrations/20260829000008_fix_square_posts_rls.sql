-- ==============================================================================
-- FaithSync Migration: Ensure Full Square Posts Permissions & RLS Policies
-- Version: 20260829000008_fix_square_posts_rls.sql
-- ==============================================================================

-- 1. Ensure columns exist
ALTER TABLE public.square_posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

-- 2. Update RLS Policies for square_posts
ALTER TABLE public.square_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Square posts viewable by all" ON public.square_posts;
DROP POLICY IF EXISTS "Square posts are viewable by authenticated users" ON public.square_posts;
CREATE POLICY "Square posts viewable by all"
  ON public.square_posts FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Users can create square posts" ON public.square_posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.square_posts;
CREATE POLICY "Users can create square posts"
  ON public.square_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own square posts" ON public.square_posts;
CREATE POLICY "Users can update own square posts"
  ON public.square_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own square posts" ON public.square_posts;
CREATE POLICY "Users can delete own square posts"
  ON public.square_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
