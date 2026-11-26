-- Network features: who referred whom, and referral asks made to existing clients.
-- Private to each advisor (RLS on user_id). Nothing here sends a message: an ask is recorded only when the advisor
-- clicks "I sent it" after sending it themselves from WhatsApp, SMS or email.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS referred_by_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS contacts_referred_by_idx ON public.contacts(referred_by_contact_id);

CREATE TYPE public.referral_ask_status AS ENUM ('asked', 'replied', 'referred', 'declined');

CREATE TABLE public.referral_asks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel public.template_channel,
  status public.referral_ask_status NOT NULL DEFAULT 'asked',
  asked_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  reminder_dismissed_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_asks TO authenticated;
GRANT ALL ON public.referral_asks TO service_role;
ALTER TABLE public.referral_asks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own referral asks select" ON public.referral_asks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own referral asks insert" ON public.referral_asks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own referral asks update" ON public.referral_asks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own referral asks delete" ON public.referral_asks FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX referral_asks_user_idx ON public.referral_asks(user_id, asked_at DESC);
CREATE INDEX referral_asks_contact_idx ON public.referral_asks(contact_id);
CREATE TRIGGER referral_asks_set_updated_at BEFORE UPDATE ON public.referral_asks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
