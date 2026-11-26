import { useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { PhotoViewer } from "~/components/photos/photo-viewer";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const shots = images.length > 0 ? images : ["/images/l1.jpg"];
  const multiple = shots.length > 1;
  const altFor = (i: number) => `${title} — photo ${i + 1}`;

  const openAt = (i: number) => {
    setActive(i);
    setOpen(true);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted" style={{ boxShadow: "var(--shadow-surface)" }}>
        <div className="flex min-h-[280px] w-full items-center justify-center p-3 sm:min-h-[360px] sm:p-4">
          <img
            key={shots[active]}
            src={shots[active]}
            alt={altFor(active)}
            className="h-auto w-auto max-w-full rounded-lg object-contain animate-in fade-in duration-300"
            style={{ maxHeight: "min(72vh, 720px)" }}
          />
        </div>

        {multiple ? (
          <>
            <button
              type="button"
              onClick={() => setActive((a) => (a - 1 + shots.length) % shots.length)}
              aria-label={t("aria.prevPhoto")}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setActive((a) => (a + 1) % shots.length)}
              aria-label={t("aria.nextPhoto")}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        ) : null}

        <span className="absolute bottom-3 left-3 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-card-foreground shadow-sm">
          {active + 1} / {shots.length}
        </span>

        <button
          type="button"
          onClick={() => openAt(active)}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5 text-xs font-semibold text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Expand className="size-3.5" aria-hidden="true" />
          View full screen
        </button>
      </div>

      {multiple ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {shots.map((src, i) => (
            <button
              key={`${src}-thumb-${i}`}
              type="button"
              onClick={() => openAt(i)}
              aria-label={t("aria.openPhoto", { n: i + 1 })}
              aria-current={i === active}
              className={cn(
                "aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg bg-muted ring-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-24",
                i === active ? "ring-primary-strong" : "ring-transparent hover:ring-border", "border border-input"
              )}
            >
              <img src={src} alt="" className="size-full object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <PhotoViewer images={shots} title={title} index={active} onIndex={setActive} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}
