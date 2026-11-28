import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useState } from "react";
import { useNavigate, useRouter, Link } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Field, Input, Select } from "~/components/ui/form";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";
import type { User } from "~/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function LoginPage() {
  const { path } = useRouter();
  const navigate = useNavigate();
  const { login, register, session } = useAppState();  const { toast } = useToast();
  const { t, pick } = useI18n();
  const [mode, setMode] = useState<"login" | "register">(path === "/register" ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<User["role"]>("tenant");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setErrors({});
    navigate(next === "login" ? "/login" : "/register", { replace: true });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (mode === "register" && name.trim().length < 2) e.name = t("login.errName");
    if (!EMAIL_RE.test(email)) e.email = t("login.errEmail");
    if (password.length < 8) e.password = t("login.errPassword");
    if (mode === "register" && !acceptedTerms) e.terms = pick("Accept the terms and privacy notice to register.", "Bạn cần đồng ý điều khoản và thông báo quyền riêng tư để đăng ký.");
    if (mode === "register" && confirm !== password) e.confirm = t("login.errConfirm");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const s = await login(email, password);
        toast({ title: t("login.welcomeBack"), description: t("login.welcomeBackDesc"), tone: "success" });
        navigate(s.user.role === "admin" ? "/admin" : s.user.role === "landlord" ? "/landlord" : "/search");
      } else {
        const s = await register(name, email, password, role, acceptedTerms);
        if (!s) {
          toast({ title: t("auth.accountCreated"), description: pick("Check your inbox to confirm your email, then sign in.", "Kiểm tra hộp thư để xác thực email, sau đó đăng nhập."), tone: "success" });
          switchMode("login");
          setPassword("");
          setConfirm("");
          return;
        }
        toast({ title: t("auth.accountCreated"), description: t("login.signedIn"), tone: "success" });
        navigate(s.user.role === "landlord" ? "/landlord" : "/search");
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : mode === "login"
            ? t("auth.loginFailedBody")
            : t("auth.registerFailedBody");
      toast({ title: mode === "login" ? t("auth.loginFailed") : t("auth.registerFailed"), description: message, tone: "warning" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="danest-public-surface danest-login-page min-h-[72vh] bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 md:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
        <div className="hidden lg:block">
          <div className="danest-login-photo relative overflow-hidden rounded-[24px]">
            <img
              src="/images/l7.jpg"
              alt={t("login.heroTitle")}
              className="aspect-[4/5] w-full object-cover"
            />
            <div className="absolute inset-0" style={{ backgroundColor: "var(--overlay-bg)" }} aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 p-8">
              <p className="font-heading text-3xl font-medium text-white">{t("login.heroTitle")}</p>
              <p className="mt-1 font-heading text-3xl font-semibold not-italic text-[#8DE3E8]">{t("login.heroAccent")}</p>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white">
                {t("login.heroDesc")}
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="danest-login-card rounded-2xl border border-border bg-card p-6 md:p-8" style={{ boxShadow: "var(--shadow-elevated)" }}>
            {session ? (
              <div className="text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-secondary-foreground">
                  {session.user.avatarInitials}
                </span>
                <h1 className="mt-4 font-heading text-2xl font-semibold text-card-foreground">{t("login.signedIn")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {session.user.name} · {session.user.email}
                </p>
                <Button className="mt-6 w-full" asChild>
                  <Link to="/search">{t("login.continue")}</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="flex rounded-xl border border-border bg-muted p-1" role="tablist" aria-label={t("login.accountMode")}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "login"}
                    onClick={() => switchMode("login")}
                    className={cn(
                      "flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <LogIn className="size-4" aria-hidden="true" /> {t("login.loginTab")}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "register"}
                    onClick={() => switchMode("register")}
                    className={cn(
                      "flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      mode === "register" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <UserPlus className="size-4" aria-hidden="true" /> {t("login.registerTab")}
                  </button>
                </div>

                <h1 className="mt-6 font-heading text-2xl font-semibold text-card-foreground">
                  {mode === "login" ? t("login.welcomeBack") : t("login.createTitle")}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "login" ? t("login.loginHint") : t("login.registerHint")}
                </p>

                <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
                  {mode === "register" ? (
                    <Field label={t("auth.name")} htmlFor="auth-name" error={errors.name}>
                      <Input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={t("login.namePlaceholder")} />
                    </Field>
                  ) : null}
                  <Field label={t("auth.email")} htmlFor="auth-email" error={errors.email}>
                    <Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
                  </Field>
                  <Field label={t("auth.password")} htmlFor="auth-password" error={errors.password} hint={mode === "login" ? undefined : t("login.passwordHint")}>
                    <div className="relative">
                      <Input
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        className="pr-11"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                      >
                        {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                      </button>
                    </div>
                  </Field>
                  {mode === "register" ? (
                    <>
                      <Field label={t("auth.confirmPassword")} htmlFor="auth-confirm" error={errors.confirm}>
                        <Input id="auth-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
                      </Field>
                      <Field label={t("auth.iAm")} htmlFor="auth-role">
                        <Select id="auth-role" value={role} onChange={(e) => setRole(e.target.value as User["role"])}>
                          <option value="tenant">{t("auth.renter")}</option>
                          <option value="landlord">{t("auth.landlord")}</option>
                        </Select>
                      </Field>
                      <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
                        <p>{pick("Read before registering:", "Đọc trước khi đăng ký:")} <a href="/about#terms" target="_blank" rel="noopener noreferrer" className="underline text-link">{pick("Terms", "Điều khoản")}</a>{" · "}<a href="/about#privacy" target="_blank" rel="noopener noreferrer" className="underline text-link">{pick("Privacy notice", "Thông báo quyền riêng tư")}</a></p>
                        <label className="flex gap-2 items-start"><input type="checkbox" className="mt-1" checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)} required />{pick("I agree to the terms and privacy notice.", "Tôi đồng ý điều khoản và thông báo quyền riêng tư.")}</label>
                        {errors.terms && <p className="text-destructive">{errors.terms}</p>}
                      </div>
                    </>
                  ) : null}

                  {mode === "login" && <Link to="/forgot-password" className="block text-right text-sm text-link underline">{pick("Forgot password?", "Quên mật khẩu?")}</Link>}
                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {busy ? t("auth.pleaseWait") : mode === "login" ? t("login.loginTab") : t("auth.createAccount")}
                  </Button>
                </form>

                <p className="mt-5 rounded-xl border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">{t("auth.aboutAccounts")}.</span> {t("auth.aboutAccountsBody")}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
