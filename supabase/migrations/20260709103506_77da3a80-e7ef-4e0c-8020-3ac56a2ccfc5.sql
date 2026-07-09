
CREATE TYPE public.preferred_channel AS ENUM ('whatsapp','sms','email');
CREATE TYPE public.pipeline_stage AS ENUM ('new','contacted','qualified','proposal','won','lost');

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  gender text,
  age integer,
  date_of_birth date,
  occupation text,
  city text,
  income numeric,
  preferred_language text,
  lead_source text,
  tags text[] NOT NULL DEFAULT '{}',
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  sms_opt_in boolean NOT NULL DEFAULT false,
  email_opt_in boolean NOT NULL DEFAULT false,
  preferred_channel public.preferred_channel NOT NULL DEFAULT 'whatsapp',
  lead_score integer NOT NULL DEFAULT 0,
  pipeline_stage public.pipeline_stage NOT NULL DEFAULT 'new',
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contacts_user_id_idx ON public.contacts(user_id);
CREATE INDEX contacts_user_stage_idx ON public.contacts(user_id, pipeline_stage);
CREATE INDEX contacts_user_next_followup_idx ON public.contacts(user_id, next_followup_at);
CREATE INDEX contacts_user_lead_score_idx ON public.contacts(user_id, lead_score DESC);
CREATE INDEX contacts_user_tags_idx ON public.contacts USING GIN (tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors select own contacts" ON public.contacts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Advisors insert own contacts" ON public.contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors update own contacts" ON public.contacts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors delete own contacts" ON public.contacts
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER contacts_set_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
