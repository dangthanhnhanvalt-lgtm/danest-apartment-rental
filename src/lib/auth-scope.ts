// Route matching only; this does not select an authentication session.
export function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}
export const IDLE_MS = 30 * 60 * 1000;
export function isIdleExpired(last: number, now: number): boolean {
  return !Number.isFinite(last) || last > now || now - last >= IDLE_MS;
}
