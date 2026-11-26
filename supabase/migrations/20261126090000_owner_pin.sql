-- Owner PIN: protects destructive actions (deleting contacts, merging duplicates, exporting CSVs) from anyone who
-- signs in with the advisor's shared password. The PIN is stored only as a bcrypt hash, is never readable through the
-- API, and can only be changed with the current PIN or removed from a session opened with an emailed reset link.
-- Enforcement is in the database: while a PIN is set, contacts can only be deleted during a short unlock window.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.owner_locks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  unlocked_until timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No policies: nothing is readable or writable directly. Everything goes through the functions below.
ALTER TABLE public.owner_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_locks FROM anon, authenticated;
GRANT ALL ON public.owner_locks TO service_role;

-- True when no PIN is set, or the PIN was entered in the last few minutes.
CREATE OR REPLACE FUNCTION public.owner_actions_allowed()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.owner_locks
    WHERE user_id = auth.uid() AND (unlocked_until IS NULL OR unlocked_until <= now())
  );
$$;

CREATE OR REPLACE FUNCTION public.owner_lock_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'enabled', l.user_id IS NOT NULL,
    'unlocked_until', CASE WHEN l.unlocked_until > now() THEN l.unlocked_until END,
    'blocked_until', CASE WHEN l.blocked_until > now() THEN l.blocked_until END,
    'recovery_session', COALESCE((
      SELECT bool_or(m->>'method' IN ('recovery', 'otp', 'magiclink'))
      FROM jsonb_array_elements(COALESCE(auth.jwt()->'amr', '[]'::jsonb)) AS m
    ), false)
  )
  FROM (SELECT auth.uid() AS uid) u
  LEFT JOIN public.owner_locks l ON l.user_id = u.uid;
$$;

-- Checks a PIN with a brute-force limit: 5 wrong tries block attempts for 15 minutes. A wrong PIN returns false
-- (never raises), so the failed-attempt count is committed; callers report the error without rolling it back.
CREATE OR REPLACE FUNCTION public._owner_pin_ok(p_pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE l public.owner_locks;
BEGIN
  SELECT * INTO l FROM public.owner_locks WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN true; END IF;
  IF l.blocked_until > now() THEN
    RAISE EXCEPTION 'Too many wrong PINs. Try again after %', to_char(l.blocked_until AT TIME ZONE 'UTC', 'HH24:MI "UTC"');
  END IF;
  IF p_pin IS NOT NULL AND extensions.crypt(p_pin, l.pin_hash) = l.pin_hash THEN
    UPDATE public.owner_locks SET failed_attempts = 0, blocked_until = NULL WHERE user_id = l.user_id;
    RETURN true;
  END IF;
  UPDATE public.owner_locks
     SET failed_attempts = CASE WHEN failed_attempts + 1 >= 5 THEN 0 ELSE failed_attempts + 1 END,
         blocked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
   WHERE user_id = l.user_id;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_owner_pin(p_new_pin text, p_current_pin text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p_new_pin IS NULL OR p_new_pin !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'The PIN must be 4 to 8 digits';
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_locks WHERE user_id = auth.uid()) AND NOT public._owner_pin_ok(p_current_pin) THEN
    RETURN 'The current PIN is wrong';
  END IF;
  INSERT INTO public.owner_locks (user_id, pin_hash)
  VALUES (auth.uid(), extensions.crypt(p_new_pin, extensions.gen_salt('bf')))
  ON CONFLICT (user_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash, unlocked_until = NULL, failed_attempts = 0, blocked_until = NULL, updated_at = now();
  RETURN NULL;
END;
$$;

-- Unlocks protected actions for 5 minutes. Returns NULL for a wrong PIN.
CREATE OR REPLACE FUNCTION public.unlock_owner_actions(p_pin text)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_until timestamptz := now() + interval '5 minutes';
BEGIN
  IF NOT public._owner_pin_ok(p_pin) THEN RETURN NULL; END IF;
  UPDATE public.owner_locks SET unlocked_until = v_until, updated_at = now() WHERE user_id = auth.uid();
  RETURN v_until;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_owner_actions()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.owner_locks SET unlocked_until = NULL, updated_at = now() WHERE user_id = auth.uid();
$$;

-- Remove the PIN: needs the current PIN, or a session opened from an emailed reset/magic link (proves inbox access).
CREATE OR REPLACE FUNCTION public.remove_owner_pin(p_current_pin text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE recovery boolean;
BEGIN
  SELECT COALESCE(bool_or(m->>'method' IN ('recovery', 'otp', 'magiclink')), false) INTO recovery
  FROM jsonb_array_elements(COALESCE(auth.jwt()->'amr', '[]'::jsonb)) AS m;
  IF NOT recovery AND NOT public._owner_pin_ok(p_current_pin) THEN
    RETURN false;
  END IF;
  DELETE FROM public.owner_locks WHERE user_id = auth.uid();
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public._owner_pin_ok(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_actions_allowed(), public.owner_lock_status(), public.set_owner_pin(text, text),
  public.unlock_owner_actions(text), public.lock_owner_actions(), public.remove_owner_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_actions_allowed(), public.owner_lock_status(), public.set_owner_pin(text, text),
  public.unlock_owner_actions(text), public.lock_owner_actions(), public.remove_owner_pin(text) TO authenticated;

-- Deleting a contact (which also removes its policies, tasks and activity) needs the unlock while a PIN is set.
DROP POLICY IF EXISTS "Advisors delete own contacts" ON public.contacts;
CREATE POLICY "Advisors delete own contacts" ON public.contacts
  FOR DELETE USING (auth.uid() = user_id AND public.owner_actions_allowed());
