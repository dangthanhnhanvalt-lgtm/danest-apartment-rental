import { useState, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, Clock3, Globe2, Languages, Lock, LogIn, Mail, MessageSquare, Phone, Send, X } from "lucide-react";
import { mockInquiriesRepository } from "~/api";
import { privateContactFor } from "~/data/private-contacts";
import { formatDate, formatRent, initials, todayISO } from "~/lib/format";
import { useNavigate } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { Button } from "~/components/ui/button";
import { Field, Input, Select, Textarea } from "~/components/ui/form";
import { useToast } from "~/components/ui/toast";
import { useI18n } from "~/i18n/language-context";
import type { Listing } from "~/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const TIME_SLOT_KEYS = ["contact.slot.morning", "contact.slot.midday", "contact.slot.afternoon", "contact.slot.evening"];

type FormType = "viewing" | "message";

interface FormErrors {
  name?: string;
  email?: string;
  date?: string;
  time?: string;
  message?: string;
}

export function ContactCard({ listing }: { listing: Listing }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const { session, isAuthenticated } = useAppState();
  const navigate = useNavigate();
  const [formType, setFormType] = useState<FormType>("viewing");
  const [name, setName] = useState(session?.user.name ?? "");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | { type: FormType; date: string; time: string }>(null);
  // G4: a renter who already inquired on this listing sees the private contact.
  const [contactRevealed, setContactRevealed] = useState<boolean>(() =>
    isAuthenticated && session ? mockInquiriesRepository.hasInquiryFor(session.user.email, listing.id) : false,
  );
  const privateContact = contactRevealed ? privateContactFor(listing) : null;

  const reset = () => {
    setName(session?.user.name ?? "");
    setEmail(session?.user.email ?? "");
    setDate("");
    setTime("");
    setMessage("");
    setErrors({});
    setSent(null);
  };

  const switchType = (next: FormType) => {
    setFormType(next);
    setErrors({});
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = t("contact.errName");
    if (!email.trim()) next.email = t("contact.errEmail");
    else if (!EMAIL_RE.test(email.trim())) next.email = t("contact.errEmailInvalid");
    if (formType === "viewing") {
      if (!date) next.date = t("contact.errDate");
      else if (date < todayISO()) next.date = t("contact.errDatePast");
      if (!time) next.time = t("contact.errTime");
    }
    if (formType === "message" || message.trim().length > 0) {
      if (!message.trim()) next.message = t("contact.errMessage");
      else if (message.trim().length < 10) next.message = t("contact.errMessageShort");
    }
    return next;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    if (!session) {
      navigate("/login?intent=inquire");
      return;
    }
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await mockInquiriesRepository.create({
        listingId: listing.id,
        tenantId: session.user.id,
        tenantName: name.trim(),
        tenantEmail: email.trim(),
        type: formType === "viewing" ? "viewing-request" : "question",
        message: formType === "viewing" ? message.trim() || t("contact.viewingRequestedMsg", { date, time }) : message.trim(),
        moveInDate: formType === "viewing" ? date : null,
        durationMonths: listing.rentalDurationMonths[0],
        tenantPreferences: [],
        scheduledAt: formType === "viewing" ? date : null,
        preferredTime: formType === "viewing" ? time : null,
      });
      setSent({ type: formType, date, time });
      // G4: now that this renter has an inquiry for this listing, reveal contact.
      setContactRevealed(true);
      toast({
        title: formType === "viewing" ? t("contact.viewingSent") : t("contact.messageSent"),
        description: formType === "viewing" ? t("contact.sentHint") : t("contact.sentMessage"),
        tone: "success",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-surface)" }}>
      <div className="border-b border-border p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("contact.title")}</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-foreground">{formatRent(listing.monthlyRent)}</p>
            <p className="text-sm text-muted-foreground">{t("listing.perMonthEstimate")}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
            {initials(listing.landlord.displayName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{listing.landlord.displayName}</p>
            <p className="text-xs text-muted-foreground">{listing.landlord.role}</p>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <Languages className="size-3.5 shrink-0" aria-hidden="true" />
            {listing.landlord.languages.join(", ")}
          </li>
          <li className="flex items-center gap-2">
            <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
            {listing.landlord.responseTime}
          </li>
          <li className="flex items-center gap-2">
            <Globe2 className="size-3.5 shrink-0" aria-hidden="true" />
            {t("common.memberSince", { date: listing.landlord.memberSince })}
          </li>
        </ul>

        {privateContact ? (
          <div className="mt-4 rounded-xl border border-success/30 bg-success/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> {t("contact.unlocked")}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              <li className="flex items-center gap-2">
                <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <a href={`tel:${privateContact.phone.replace(/\s+/g, "")}`} className="hover:underline">{privateContact.phone}</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <a href={`mailto:${privateContact.email}`} className="hover:underline">{privateContact.email}</a>
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("contact.revealReason")}
            </p>
          </div>
        ) : (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("contact.privateHint")}
          </p>
        )}
      </div>

      <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-4 lg:max-h-[calc(100vh-24rem)]">
        {sent ? (
          <div className="rounded-xl bg-accent p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
              <h3 className="text-base font-semibold text-foreground">
                {sent.type === "viewing" ? t("contact.viewingSent") : t("contact.messageSent")}
              </h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {sent.type === "viewing"
                ? t("contact.sentAwaiting", { date: formatDate(sent.date), time: sent.time })
                : t("contact.sentMessage")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("contact.sentPrototype")}
            </p>
            <Button variant="outline" className="mt-4 w-full" onClick={reset}>
              {t("contact.sendAnother")}
            </Button>
          </div>
        ) : !isAuthenticated ? (
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
            <LogIn className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-2 text-base font-semibold text-foreground">{t("contact.loginTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("contact.loginHint")}
            </p>
            <Button className="mt-4 w-full" onClick={() => navigate("/login?intent=inquire")}>
              <LogIn className="size-4" aria-hidden="true" /> {t("contact.loginButton")}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label={t("contact.title")}>
              <button
                type="button"
                role="tab"
                aria-selected={formType === "viewing"}
                onClick={() => switchType("viewing")}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  formType === "viewing" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="size-4" aria-hidden="true" />
                {t("contact.viewing")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={formType === "message"}
                onClick={() => switchType("message")}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  formType === "message" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="size-4" aria-hidden="true" />
                {t("contact.message")}
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
              <Field label={t("contact.fullName")} htmlFor="contact-name" error={errors.name}>
                <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={t("contact.placeholderName")} />
              </Field>
              <Field label={t("contact.email")} htmlFor="contact-email" error={errors.email}>
                <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder={t("contact.placeholderEmail")} />
              </Field>

              {formType === "viewing" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("contact.preferredDate")} htmlFor="contact-date" error={errors.date}>
                    <Input id="contact-date" type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
                  </Field>
                  <Field label={t("contact.preferredTime")} htmlFor="contact-time" error={errors.time}>
                    <Select id="contact-time" value={time} onChange={(e) => setTime(e.target.value)}>
                      <option value="">{t("contact.chooseTime")}</option>
                      {TIME_SLOT_KEYS.map((k) => (
                        <option key={k} value={t(k)}>
                          {t(k)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              ) : null}

              <Field
                label={formType === "viewing" ? t("contact.messageOptional") : t("contact.messageField")}
                htmlFor="contact-message"
                error={errors.message}
              >
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    formType === "viewing"
                      ? t("contact.placeholderViewing")
                      : t("contact.placeholderMessage")
                  }
                />
              </Field>

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                <Send className="size-4" aria-hidden="true" />
                {busy ? t("contact.sending") : formType === "viewing" ? t("contact.requestViewing") : t("contact.sendMessage")}
              </Button>
              {formType === "viewing" ? (
                <p className="text-xs text-muted-foreground">
                  {t("contact.viewingNote")}
                </p>
              ) : null}
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export function ContactBar({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{formatRent(listing.monthlyRent)}</p>
            <p className="truncate text-xs text-muted-foreground">{listing.landlord.responseTime}</p>
          </div>
          <Button size="lg" onClick={() => setOpen(true)}>
            {t("contact.title")}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[85] lg:hidden">
          <div className="absolute inset-0" style={{ backgroundColor: "var(--overlay-bg)" }} onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label={t("contact.title")} className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-card pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">{t("contact.title")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("contact.closeForm")}
                className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4">
              <ContactCard listing={listing} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
