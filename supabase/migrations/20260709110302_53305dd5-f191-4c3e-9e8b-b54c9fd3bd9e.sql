
CREATE TABLE public.segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  filter_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments TO authenticated;
GRANT ALL ON public.segments TO service_role;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors select own segments" ON public.segments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Advisors insert own segments" ON public.segments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors update own segments" ON public.segments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors delete own segments" ON public.segments FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX segments_user_id_idx ON public.segments(user_id);
CREATE TRIGGER segments_set_updated_at BEFORE UPDATE ON public.segments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
