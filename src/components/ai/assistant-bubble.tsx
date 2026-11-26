import { Minus, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "~/lib/router";
import { MatchAssistant } from "~/components/match/assistant";
import { useI18n } from "~/i18n/language-context";
import { cn } from "~/lib/utils";

export function AssistantBubble() {
  const { path } = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>("button, input");
      first?.focus();
    }, 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    window.setTimeout(() => buttonRef.current?.focus(), 0);
  };

  // On the dedicated matching page the same assistant already fills the screen.
  if (path === "/match") return null;

  return (
    <div className="fixed right-4 z-[80] flex flex-col items-end gap-3 sm:right-6 max-lg:bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6">
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={t("ai.open")}
          className="flex h-[min(78vh,640px)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card animate-in fade-in slide-in-from-bottom-3 sm:w-[420px]"
          style={{ boxShadow: "var(--shadow-overlay)" }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold text-card-foreground">{t("ai.askDanest")}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={close}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("ai.minimiseShort")}
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={close}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("ai.close")}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <MatchAssistant key={session} variant="compact" />
          </div>
        </div>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) setSession((s) => s + 1);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={open ? t("ai.minimise") : t("ai.open")}
        className={cn(
          "inline-flex h-12 items-center gap-2 rounded-full border border-border bg-primary pl-3.5 pr-4 text-sm font-semibold text-primary-foreground transition-[box-shadow,background-color] hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          open && "hidden",
        )}
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground text-primary">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        {t("ai.askDanest")}
      </button>
    </div>
  );
}
