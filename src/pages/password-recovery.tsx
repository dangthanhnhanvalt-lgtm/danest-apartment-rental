import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { supabase } from "~/lib/supabase";
import { clearRecovery, recoverySnapshot, subscribeRecovery } from "~/lib/recovery";
import { useI18n } from "~/i18n/language-context";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/form";
import { Link, useNavigate } from "~/lib/router";

export function PasswordRecoveryPage({ reset }: { reset: boolean }) {
  const { pick, setLang } = useI18n();
  const navigate = useNavigate();
  const recoveryUser = useSyncExternalStore(subscribeRecovery, recoverySnapshot);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(reset);
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    if (!reset || recoveryUser) return;
    const id = window.setTimeout(() => setWaiting(false), 3000);
    return () => window.clearTimeout(id);
  }, [reset, recoveryUser]);
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError(""); setMessage("");
    if (reset && (password.length < 8 || password !== confirm)) {
      setError(pick("Use at least 8 characters and matching passwords.", "Mật khẩu phải có ít nhất 8 ký tự và hai lần nhập phải giống nhau.")); return;
    }
    setBusy(true);
    try {
      if (!reset) {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (e) throw e;
        setMessage(pick("If the address is eligible, a reset link will be sent. Check your inbox and spam folder.", "Nếu địa chỉ đủ điều kiện, liên kết đặt lại sẽ được gửi. Hãy kiểm tra hộp thư và thư rác."));
      } else {
        const { data, error: e } = await supabase.auth.getUser();
        if (e || !recoveryUser || recoverySnapshot() !== recoveryUser || data.user?.id !== recoveryUser) throw new Error("Invalid recovery session");
        const { error: changeError } = await supabase.auth.updateUser({ password });
        if (changeError) throw changeError;
        setUpdated(true); setPassword(""); setConfirm(""); clearRecovery();
        const { error: logoutError } = await supabase.auth.signOut({ scope: "global" });
        if (logoutError) { setError(pick("Password changed, but sign-out failed. Retry sign-out before signing in again.", "Đã đổi mật khẩu nhưng chưa đăng xuất được. Hãy thử đăng xuất lại trước khi đăng nhập.")); return; }
        navigate("/login", { replace: true });
      }
    } catch {
      setError(reset ? pick("Unable to reset the password. Check the link and password requirements or request a new link.", "Không thể đặt lại mật khẩu. Kiểm tra liên kết, yêu cầu mật khẩu hoặc yêu cầu liên kết mới.") : pick("Unable to send the request. Try again later or contact support.", "Không thể gửi yêu cầu. Hãy thử lại sau hoặc liên hệ hỗ trợ."));
    } finally { setBusy(false); }
  }
  async function leave() {
    setBusy(true); setError("");
    try {
      const { error: e } = await supabase.auth.signOut({ scope: updated ? "global" : "local" });
      if (e) throw e;
      clearRecovery(); navigate("/login", { replace: true });
    } catch { setError(pick("Sign-out failed. Please retry.", "Đăng xuất thất bại. Vui lòng thử lại.")); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-[70vh] items-center justify-center bg-section-alt px-4 py-12">
    <section className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-7 shadow-sm">
      <div className="flex justify-between items-center"><span className="font-heading text-xl font-semibold">DaNest</span><div className="flex gap-2 text-sm"><button type="button" onClick={() => setLang("en")}>EN</button><button type="button" onClick={() => setLang("vi")}>VI</button></div></div>
      <h1 className="font-heading text-3xl font-semibold">{reset ? pick("Set a new password", "Đặt mật khẩu mới") : pick("Forgot password", "Quên mật khẩu")}</h1>
      {updated ? <p role="status">{pick("Your password has been updated.", "Mật khẩu đã được cập nhật.")}</p> : reset && !recoveryUser ? <p role="status">{waiting ? pick("Checking recovery link…", "Đang kiểm tra liên kết…") : pick("No valid recovery session. Open the link from your email or request a new one.", "Không có phiên khôi phục hợp lệ. Mở liên kết trong email hoặc yêu cầu liên kết mới.")}</p> : <form onSubmit={submit} className="space-y-4">
        {reset ? <>
          <Field label={pick("New password", "Mật khẩu mới")} htmlFor="new-password"><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></Field>
          <Field label={pick("Confirm password", "Nhập lại mật khẩu")} htmlFor="confirm-password"><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} /></Field>
        </> : <Field label="Email" htmlFor="recovery-email"><Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>}
        <Button type="submit" disabled={busy || Boolean(message)} className="w-full">{busy ? pick("Please wait…", "Đang xử lý…") : reset ? pick("Update password", "Cập nhật mật khẩu") : pick("Send reset link", "Gửi liên kết đặt lại")}</Button>
      </form>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {reset ? <div className="space-y-3"><Button variant="outline" className="w-full" disabled={busy} onClick={() => void leave()}>{pick("Sign out and return to login", "Đăng xuất và quay lại đăng nhập")}</Button>{!recoveryUser && !updated && <Link to="/forgot-password" className="text-link underline">{pick("Request a new link", "Yêu cầu liên kết mới")}</Link>}</div> : <Link to="/login" className="text-link underline">{pick("Back to login", "Quay lại đăng nhập")}</Link>}
    </section>
  </main>;
}
