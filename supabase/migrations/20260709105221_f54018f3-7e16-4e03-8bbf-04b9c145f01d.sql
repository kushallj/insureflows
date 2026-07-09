
-- Enums
CREATE TYPE public.organization_kind AS ENUM ('family', 'business', 'other');
CREATE TYPE public.policy_type AS ENUM ('life', 'health', 'motor', 'other');
CREATE TYPE public.policy_status AS ENUM ('active', 'lapsed', 'cancelled');

-- Organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind public.organization_kind NOT NULL DEFAULT 'family',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors select own orgs" ON public.organizations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Advisors insert own orgs" ON public.organizations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors update own orgs" ON public.organizations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors delete own orgs" ON public.organizations FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX organizations_user_id_idx ON public.organizations(user_id);
CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link contact -> organization
ALTER TABLE public.contacts ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX contacts_organization_id_idx ON public.contacts(organization_id);

-- Policies
CREATE TABLE public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  policy_number text NOT NULL,
  policy_type public.policy_type NOT NULL DEFAULT 'other',
  insurer_name text,
  premium_amount numeric,
  start_date date,
  renewal_date date,
  status public.policy_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policies TO authenticated;
GRANT ALL ON public.policies TO service_role;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors select own policies" ON public.policies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Advisors insert own policies" ON public.policies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors update own policies" ON public.policies FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors delete own policies" ON public.policies FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX policies_user_id_idx ON public.policies(user_id);
CREATE INDEX policies_contact_id_idx ON public.policies(contact_id);
CREATE INDEX policies_renewal_date_idx ON public.policies(renewal_date);
CREATE TRIGGER policies_set_updated_at BEFORE UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
