-- Migration: Add focus_timeline, focus_type, scripture integration, and reload schema cache

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

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
