/**
 * Owner PIN (see supabase/migrations/20261126090000_owner_pin.sql). Someone signed in with a shared password can work
 * with contacts but can't export CSVs, delete contacts or merge duplicates without the PIN. The checks are made by the
 * database; these helpers only call its functions with the signed-in session.
 */
import { supabase } from "@/integrations/supabase/client";

export type OwnerLockStatus = {
  enabled: boolean;
  unlocked_until: string | null;
  blocked_until: string | null;
  recovery_session: boolean;
};

// The generated Supabase types don't know these functions yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export async function getOwnerLockStatus(): Promise<OwnerLockStatus> {
  const { data, error } = await rpc("owner_lock_status");
  if (error) throw new Error(error.message);
  return data as OwnerLockStatus;
}

export const isUnlocked = (s: OwnerLockStatus) =>
  !s.enabled || (!!s.unlocked_until && new Date(s.unlocked_until).getTime() > Date.now());

/** Returns false for a wrong PIN (after 5 wrong tries the database blocks attempts for 15 minutes and throws). */
export async function unlockOwnerActions(pin: string): Promise<boolean> {
  const { data, error } = await rpc("unlock_owner_actions", { p_pin: pin });
  if (error) throw new Error(error.message);
  return data != null;
}

export async function lockOwnerActions() {
  const { error } = await rpc("lock_owner_actions");
  if (error) throw new Error(error.message);
}

export async function setOwnerPin(newPin: string, currentPin?: string) {
  const { data, error } = await rpc("set_owner_pin", {
    p_new_pin: newPin,
    p_current_pin: currentPin || null,
  });
  if (error) throw new Error(error.message);
  if (data) throw new Error(String(data));
}

export async function removeOwnerPin(currentPin?: string) {
  const { data, error } = await rpc("remove_owner_pin", { p_current_pin: currentPin || null });
  if (error) throw new Error(error.message);
  if (data === false) throw new Error("The current PIN is wrong");
}
