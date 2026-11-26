import { useState, type FormEvent, type ReactNode } from "react";
import { BadgeCheck, Bell, ShieldCheck, UserRound } from "lucide-react";
import { LANDLORD_PROFILE } from "~/data/listings";
import { formatDate } from "~/lib/format";
import { useNavigate } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useLandlordIdentity } from "~/pages/landlord/use-landlord-identity";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Checkbox, Field, Input } from "~/components/ui/form";
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
  const { t } = useI18n();
  const { listings, updateListing, logout, session } = useAppState();
  const landlord = useLandlordIdentity();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    displayName: session?.user.name || landlord.displayName,
    email: session?.user.email || "an.nguyen@example.com",
    phone: "+84 90 000 0000",
    languages: "English, Vietnamese",
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  const [notifications, setNotifications] = useState({
    inquiries: true,
    viewings: true,
    availability: false,
  });

  const [confirmPause, setConfirmPause] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const owned = listings.filter((l) => l.landlordId === landlord.id);
  const published: Listing[] = owned.filter((l) => l.status === "published");

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!profile.displayName.trim()) errs.displayName = t("landlord.settings.errDisplayName");
    if (!profile.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) errs.email = t("landlord.settings.errEmail");
    if (!profile.phone.trim()) errs.phone = t("landlord.settings.errPhone");
    setProfileErrors(errs);
    if (Object.keys(errs).length > 0) return;
    toast({ title: t("landlord.settings.profileSaved"), tone: "success" });
  };

  const pauseAll = async () => {
    await Promise.all(published.map((l) => updateListing(l.id, { status: "paused" })));
    setConfirmPause(false);
    toast({ title: t("landlord.settings.allPaused"), description: t("landlord.settings.allPausedDesc"), tone: "info" });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("landlord.settings.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("landlord.settings.subtitle")}</p>
        </div>
      </div>

      <Card title={t("landlord.settings.profile")} icon={UserRound}>
        <form onSubmit={saveProfile} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("landlord.settings.displayName")} htmlFor="displayName" error={profileErrors.displayName}>
              <Input id="displayName" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} />
            </Field>
            <Field label={t("landlord.settings.email")} htmlFor="email" error={profileErrors.email}>
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
            <Button type="submit">{t("landlord.settings.saveProfile")}</Button>
          </div>
        </form>
      </Card>

      <Card title={t("landlord.settings.verificationStatus")} icon={ShieldCheck}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-accent px-2.5 py-1 text-xs font-semibold text-success">
            <BadgeCheck className="size-3.5" aria-hidden="true" /> {t("landlord.settings.identityVerified")}
          </span>
          <span className="text-sm text-foreground">{landlord.displayName}</span>
        </div>
        <p className="text-sm text-muted-foreground">{t("landlord.settings.identityHint")}</p>
        <p className="text-xs text-muted-foreground">{t("landlord.settings.memberSince", { date: formatDate(LANDLORD_PROFILE.memberSince) })}</p>
      </Card>

      <Card title={t("landlord.settings.notifications")} icon={Bell}>
        <div className="space-y-3">
          <Checkbox
            label={t("landlord.settings.newInquiries")}
            checked={notifications.inquiries}
            onChange={(e) => setNotifications({ ...notifications, inquiries: e.target.checked })}
          />
          <Checkbox
            label={t("landlord.settings.viewingRequests")}
            checked={notifications.viewings}
            onChange={(e) => setNotifications({ ...notifications, viewings: e.target.checked })}
          />
          <Checkbox
            label={t("landlord.settings.availabilityReminders")}
            checked={notifications.availability}
            onChange={(e) => setNotifications({ ...notifications, availability: e.target.checked })}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => toast({ title: t("landlord.settings.preferencesSaved"), tone: "success" })}>
            {t("landlord.settings.savePreferences")}
          </Button>
        </div>
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
              <Button variant="outline" onClick={() => setConfirmPause(true)} disabled={published.length === 0}>
                {t("landlord.settings.pauseAll")}
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="destructive" onClick={pauseAll}>{t("landlord.settings.confirmPause")}</Button>
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
                    logout();
                    navigate("/login");
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
