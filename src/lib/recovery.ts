import { supabase } from "~/lib/supabase";

// Subscribe at module load, before React mounts. Never save the recovery token ourselves.
let recoveryUser: string | null = null;
const listeners = new Set<() => void>();
function setRecovery(value: string | null) {
  recoveryUser = value;
  listeners.forEach(fn => fn());
}
export const recoverySnapshot = () => recoveryUser;
export const subscribeRecovery = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" && window.location.pathname === "/reset-password") {
    setRecovery(session?.user.id ?? null);
  } else if (event === "SIGNED_OUT" || event === "SIGNED_IN" || (session && recoveryUser && session.user.id !== recoveryUser)) {
    setRecovery(null);
  }
});
export function clearRecovery() { setRecovery(null); }
