import { supabase } from "~/lib/supabase";
import { isIdleExpired } from "~/lib/auth-scope";
import type { Session } from "@supabase/supabase-js";
// Single shared activity key per Supabase project, across all routes in this browser profile.
const key = `danest-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname}-activity-v1`;
type Activity = { id: string; at: number };
let fallback: Activity | null = null;
function identity(session: Session): string {
  try {
    const part = session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(part));
    return `${session.user.id}:${decoded.session_id ?? session.user.id}`;
  } catch { return session.user.id; }
}
function read(): Activity | null {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function write(value: Activity) {
  fallback = value;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* in-memory fallback */ }
}
export function sessionExpired(session: Session, now = Date.now()): boolean {
  const id = identity(session), old = read();
  if (!old || old.id !== id) { write({id,at:now}); return false; }
  return isIdleExpired(old.at,now);
}
export function noteActivity(session: Session) {
  const now = Date.now();
  if (sessionExpired(session, now)) return;
  const old = read();
  if (!old || now-old.at >= 1000) write({id:identity(session),at:now});
}
// No activity is recorded on auto-refresh, polling, page load or window focus.
export function monitorActivity(onExpired: () => void) {
  let busy = false, stopped = false, last = 0;
  async function check(activity = false) {
    if (busy || stopped) return;
    busy = true;
    try {
      const {data} = await supabase.auth.getSession();
      if (stopped || !data.session) return;
      if (sessionExpired(data.session)) { onExpired(); }
      else if (activity && document.visibilityState === "visible") noteActivity(data.session);
    } finally { busy = false; }
  }
  const active = () => { const now = Date.now(); if (now-last >= 1000) { last=now; void check(true).catch(()=>{}); } };
  const verify = () => { void check().catch(()=>{}); };
  const events = ["pointerdown", "keydown", "touchstart", "scroll"];
  events.forEach(e => window.addEventListener(e,active,{passive:true}));
  window.addEventListener("focus",verify);
  document.addEventListener("visibilitychange",verify);
  const timer=window.setInterval(verify,15000);
  return () => { stopped=true; clearInterval(timer); events.forEach(e=>window.removeEventListener(e,active)); window.removeEventListener("focus",verify); document.removeEventListener("visibilitychange",verify); };
}
