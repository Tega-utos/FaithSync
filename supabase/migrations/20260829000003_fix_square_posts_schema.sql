-- Migration: Fix square_posts schema, column cache, and constraints

ALTER TABLE public.square_posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
ALTER TABLE public.square_posts ADD COLUMN IF NOT EXISTS scripture_reference TEXT;
ALTER TABLE public.square_posts ADD COLUMN IF NOT EXISTS scripture_version_id TEXT;

-- Drop old check constraint on post_type to support 'prayer', 'struggle', 'testimony', 'reflection', 'record', 'prayer_request'
DO $$
BEGIN
  ALTER TABLE public.square_posts DROP CONSTRAINT IF EXISTS square_posts_post_type_check;
EXCEPTION WHEN OTHERS THEN END $$;

-- Enable RLS and verify policies
ALTER TABLE public.square_posts ENABLE ROW LEVEL SECURITY;

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

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
