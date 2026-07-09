-- Enums
CREATE TYPE public.template_channel AS ENUM ('whatsapp', 'sms', 'email');
CREATE TYPE public.template_status AS ENUM ('draft', 'approved');
CREATE TYPE public.campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'paused', 'completed', 'cancelled');

-- Templates table
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel public.template_channel NOT NULL,
  subject TEXT,
  body TEXT NOT NULL DEFAULT '',
  status public.template_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own templates select" ON public.templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own templates insert" ON public.templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own templates update" ON public.templates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own templates delete" ON public.templates FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER templates_set_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX templates_user_idx ON public.templates(user_id);

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel public.template_channel NOT NULL,
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  audience_count_snapshot INTEGER,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  clicked_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own campaigns select" ON public.campaigns FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own campaigns insert" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own campaigns update" ON public.campaigns FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own campaigns delete" ON public.campaigns FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX campaigns_user_idx ON public.campaigns(user_id);
CREATE INDEX campaigns_status_idx ON public.campaigns(status);
CREATE INDEX campaigns_scheduled_idx ON public.campaigns(scheduled_at);