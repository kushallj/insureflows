
CREATE TYPE public.task_status AS ENUM ('open', 'done');
CREATE TYPE public.task_priority AS ENUM ('low', 'normal', 'high');
CREATE TYPE public.activity_type AS ENUM ('note', 'stage_change', 'task_completed', 'message_sent', 'other');

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  due_date date,
  related_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status public.task_status NOT NULL DEFAULT 'open',
  priority public.task_priority NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors select own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Advisors insert own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX tasks_user_id_idx ON public.tasks(user_id);
CREATE INDEX tasks_related_contact_idx ON public.tasks(related_contact_id);
CREATE INDEX tasks_due_date_idx ON public.tasks(due_date);
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  activity_type public.activity_type NOT NULL DEFAULT 'note',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors select own activities" ON public.activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Advisors insert own activities" ON public.activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors update own activities" ON public.activities FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors delete own activities" ON public.activities FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX activities_user_id_idx ON public.activities(user_id);
CREATE INDEX activities_contact_id_idx ON public.activities(contact_id);
CREATE INDEX activities_created_at_idx ON public.activities(created_at DESC);
