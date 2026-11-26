import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";

/** Full-screen photo viewer: always shows the entire image (object-contain), never crops or
 *  stretches it, and keeps every control inside the viewport on any screen size. */
export function PhotoViewer({
  images,
  title,
  index,
  onIndex,
  onClose,
}: {
  images: string[];
  title: string;
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const shots = images.length > 0 ? images : ["/images/l1.jpg"];
  const multiple = shots.length > 1;
  const altFor = (i: number) => `${title} — photo ${i + 1}`;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!multiple) return;
      if (e.key === "ArrowRight") onIndex((index + 1) % shots.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + shots.length) % shots.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, multiple, shots.length, onIndex, onClose]);

  return (
    <div
      className="fixed inset-0 z-[95] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={t("aria.photosFor", { title })}
      style={{ backgroundColor: "var(--overlay-bg)" }}
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-between px-3 py-2 sm:px-5 sm:py-3" onClick={(e) => e.stopPropagation()}>
        <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-card-foreground">
          {index + 1} / {shots.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("aria.closeViewer")}
          className="flex size-10 items-center justify-center rounded-full bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2">
        {multiple ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index - 1 + shots.length) % shots.length);
            }}
            aria-label={t("aria.prevPhoto")}
            className="absolute left-2 z-10 flex size-11 items-center justify-center rounded-full bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:left-5"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
        ) : null}

        <img
          key={shots[index]}
          src={shots[index]}
          alt={altFor(index)}
          onClick={(e) => e.stopPropagation()}
          className="h-auto max-h-full w-auto max-w-full object-contain animate-in fade-in duration-300"
          style={{ maxWidth: "calc(100vw - 80px)", maxHeight: "calc(100dvh - 160px)" }}
        />

        {multiple ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index + 1) % shots.length);
            }}
            aria-label={t("aria.nextPhoto")}
            className="absolute right-2 z-10 flex size-11 items-center justify-center rounded-full bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-5"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {multiple ? (
        <div className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-3 sm:px-5" onClick={(e) => e.stopPropagation()}>
          {shots.map((src, i) => (
            <button
              key={`${src}-thumb-${i}`}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={t("aria.showPhoto", { n: i + 1 })}
              aria-current={i === index}
              className={cn(
                "h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted ring-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === index ? "ring-primary-strong" : "ring-transparent hover:ring-primary-foreground", "border border-input"
              )}
            >
              <img src={src} alt="" className="size-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
