import { BadgeCheck, MessagesSquare, ReceiptText } from "lucide-react";
import { useI18n } from "~/i18n/language-context";

export function TrustSection() {
  const { t } = useI18n();
  const items = [
    { icon: BadgeCheck, title: t("trust.1.title"), body: t("trust.1.body") },
    { icon: ReceiptText, title: t("trust.2.title"), body: t("trust.2.body") },
    { icon: MessagesSquare, title: t("trust.3.title"), body: t("trust.3.body") },
  ];
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:px-8">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {items.map((item) => (
            <div key={item.title} className="flex gap-4 rounded-xl border border-[#E2EBEF] bg-white p-4 dark:bg-muted">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#EAF8FB] text-[#087EBD]">
                <item.icon className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-muted-foreground">{t("trust.note")}</p>
      </div>
    </section>
  );
}
