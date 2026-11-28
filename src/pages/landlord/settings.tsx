import {AccountEmailSettings} from "~/components/account-email-settings";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Bell, ShieldCheck, UserRound } from "lucide-react";
import { readLandlordProfile, saveLandlordProfile, type LandlordProfile } from "~/api/backend/profile";
import { formatDate } from "~/lib/format";
import { Link, useNavigate } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useLandlordIdentity } from "~/pages/landlord/use-landlord-identity";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/form";
import { useI18n } from "~/i18n/language-context";
import type { Listing } from "~/types";

function Card({ title, icon: Icon, children }: { title: string; icon: typeof UserRound; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-accent text-link">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const { t, pick } = useI18n();
  const { listings, updateListing, logout, session } = useAppState();
  const landlord = useLandlordIdentity();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({displayName:"",email:"",phone:"",languages:""});
  const [serverProfile,setServerProfile]=useState<LandlordProfile|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [failure,setFailure]=useState("");
  const [reload,setReload]=useState(0);
  const userId=session?.user.id??"";
  useEffect(()=>{
    let cancelled=false;
    setLoading(true);setServerProfile(null);setFailure("");
    if(!userId){setLoading(false);return;}
    void readLandlordProfile(userId).then(p=>{if(!cancelled){setServerProfile(p);setProfile({displayName:p.displayName,email:p.email,phone:p.phone,languages:p.languages.join(", ")});}}).catch(e=>{if(!cancelled)setFailure(e instanceof Error?e.message:String(e));}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[userId,reload]);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});


  const [confirmPause, setConfirmPause] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const owned = listings.filter((l) => l.landlordId === landlord.id);
  const published: Listing[] = owned.filter((l) => l.status === "published");

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (profile.displayName.trim().length < 2 || profile.displayName.trim().length > 100) errs.displayName = t("landlord.settings.errDisplayName");
    if (!profile.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) errs.email = t("landlord.settings.errEmail");
    if (profile.phone.trim() && !/^[+0-9(). -]{3,40}$/.test(profile.phone.trim())) errs.phone = pick("Enter a valid contact number.","Nhập số liên hệ hợp lệ.");
    setProfileErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (busy || loading || !serverProfile || !userId) return;
    setBusy(true);setFailure("");
    try {const p=await saveLandlordProfile(userId,profile);setServerProfile(p);setProfile({displayName:p.displayName,email:p.email,phone:p.phone,languages:p.languages.join(", ")});toast({title:pick("Profile saved to database", "Đã lưu hồ sơ vào database"),description:pick("Reload the page to refresh your account name.","Tải lại trang để cập nhật tên tài khoản."),tone:"success"});}
    catch(err){setFailure(err instanceof Error?err.message:String(err));}finally{setBusy(false);}
  };

  const pauseAll = async () => {
    if (busy) return;
    setBusy(true);setFailure("");
    const results=await Promise.allSettled(published.map(l=>updateListing(l.id,{status:"paused"})));
    const succeeded=results.filter(r=>r.status==="fulfilled").length;
    setConfirmPause(false);setBusy(false);
    toast({title:pick(`Paused ${succeeded}/${published.length} listings`,`Đã tạm ẩn ${succeeded}/${published.length} tin`),tone:succeeded===published.length?"success":"warning"});
    if(succeeded!==published.length)setFailure(pick("Some listings could not be paused. Refresh and check their status.","Một số tin chưa được tạm ẩn. Hãy làm mới và kiểm tra trạng thái."));
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("landlord.settings.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("landlord.settings.subtitle")}</p>
        </div>
      </div>

      {failure && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">{failure}</div>}
      <Card title={t("landlord.settings.profile")} icon={UserRound}>
        {loading ? <p>{pick("Loading profile…","Đang tải hồ sơ…")}</p> : !serverProfile ? <Button variant="outline" onClick={()=>setReload(x=>x+1)}>{pick("Retry", "Thử lại")}</Button> : <>
        <p className="text-sm text-muted-foreground">{pick("Contact details are separate from sign-in credentials and are shared only through permitted inquiries.","Thông tin liên hệ khác với thông tin đăng nhập và chỉ được chia sẻ qua yêu cầu thuê hợp lệ.")}</p>
        <form onSubmit={saveProfile} className="space-y-4" noValidate><fieldset disabled={busy} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("landlord.settings.displayName")} htmlFor="displayName" error={profileErrors.displayName}>
              <Input id="displayName" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} />
            </Field>
            <Field label={pick("Contact email", "Email liên hệ")} htmlFor="email" error={profileErrors.email}>
              <Input id="email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </Field>
            <Field label={t("landlord.settings.phone")} htmlFor="phone" error={profileErrors.phone}>
              <Input id="phone" type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </Field>
            <Field label={t("landlord.settings.languages")} htmlFor="languages" hint={t("landlord.settings.languagesHint")}>
              <Input id="languages" value={profile.languages} onChange={(e) => setProfile({ ...profile, languages: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>{t("landlord.settings.saveProfile")}</Button>
          </div>
        </fieldset></form></>}
      </Card>

      <Card title={t("landlord.settings.verificationStatus")} icon={ShieldCheck}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{pick("Account approved", "Tài khoản đã được duyệt")}</span>
          <span className="text-sm text-foreground">{serverProfile?.displayName??landlord.displayName}</span>
        </div>
        <p className="text-sm text-muted-foreground">{t("landlord.settings.identityHint")}</p>
        {serverProfile?.memberSince && <p className="text-xs text-muted-foreground">{t("landlord.settings.memberSince", { date: formatDate(serverProfile.memberSince) })}</p>}
      </Card>

      {userId&&<AccountEmailSettings key={userId} userId={userId}/>}
      <Card title={pick("Notifications", "Thông báo")} icon={Bell}>
        <p className="text-sm text-muted-foreground">{pick("In-app notifications are enabled. Configure activity emails above.","Thông báo trong hệ thống đang hoạt động. Cấu hình email nghiệp vụ ở phía trên.")}</p>
        <Button variant="outline" asChild><Link to="/notifications">{pick("View notifications","Xem thông báo")}</Link></Button>
      </Card>

      <section
        className="rounded-xl border border-destructive/30 bg-destructive/10 p-5"
        style={{ boxShadow: "var(--shadow-surface)" }}
        aria-labelledby="danger-heading"
      >
        <h2 id="danger-heading" className="text-base font-semibold text-destructive">{t("landlord.settings.dangerZone")}</h2>

        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("landlord.settings.pauseAll")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t(published.length === 1 ? "landlord.settings.pauseAllCountOne" : "landlord.settings.pauseAllCountMany", {
                  count: published.length,
                })}
              </p>
            </div>
            {!confirmPause ? (
              <Button variant="outline" onClick={() => setConfirmPause(true)} disabled={busy || published.length === 0}>
                {t("landlord.settings.pauseAll")}
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="destructive" disabled={busy} onClick={pauseAll}>{t("landlord.settings.confirmPause")}</Button>
                <Button variant="ghost" onClick={() => setConfirmPause(false)}>{t("common.cancel")}</Button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("landlord.settings.signOutDemo")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{t("landlord.settings.signOutHint")}</p>
            </div>
            {!confirmSignOut ? (
              <Button variant="outline" onClick={() => setConfirmSignOut(true)}>{t("landlord.settings.signOut")}</Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    void logout().then(() => navigate("/login")).catch((err) => alert(String(err)));
                  }}
                >
                  {t("landlord.settings.confirmSignOut")}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmSignOut(false)}>{t("common.cancel")}</Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        {t("landlord.settings.prototypeNote")}
      </p>
    </div>
  );
}
