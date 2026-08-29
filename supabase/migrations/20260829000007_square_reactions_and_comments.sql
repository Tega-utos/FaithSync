-- ==============================================================================
-- FaithSync Migration: Discord-Style Reactions & Square Comments
-- Version: 20260829000007_square_reactions_and_comments.sql
-- ==============================================================================

-- 1. Relax or update reaction_type constraint on square_reactions
DO $$
BEGIN
  ALTER TABLE public.square_reactions DROP CONSTRAINT IF EXISTS square_reactions_reaction_type_check;
EXCEPTION WHEN OTHERS THEN END $$;

-- 2. Create Square Comments Table
CREATE TABLE IF NOT EXISTS public.square_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.square_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_square_comments_post_id ON public.square_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_square_comments_user_id ON public.square_comments(user_id);

-- 3. Row Level Security for square_comments
ALTER TABLE public.square_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Square comments are viewable by authenticated users" ON public.square_comments;
CREATE POLICY "Square comments are viewable by authenticated users"
  ON public.square_comments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create square comments" ON public.square_comments;
CREATE POLICY "Users can create square comments"
  ON public.square_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own square comments" ON public.square_comments;
CREATE POLICY "Users can delete their own square comments"
  ON public.square_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
