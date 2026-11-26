import { CheckCircle2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";

export const SAMPLE_PHOTOS = Array.from({ length: 10 }, (_, i) => `/images/l${i + 1}.jpg`);

export function PhotoPicker({
  selected,
  onChange,
  error,
}: {
  selected: string[];
  onChange: (images: string[]) => void;
  error?: string;
}) {
  const { t } = useI18n();
  const toggle = (photo: string) => {
    if (selected.includes(photo)) {
      onChange(selected.filter((p) => p !== photo));
    } else {
      onChange([...selected, photo]);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("landlord.photo.hint")}
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {SAMPLE_PHOTOS.map((photo, index) => {
          const isSelected = selected.includes(photo);
          return (
            <li key={photo}>
              <button
                type="button"
                onClick={() => toggle(photo)}
                aria-pressed={isSelected}
                aria-label={t(isSelected ? "landlord.photo.remove" : "landlord.photo.add", { number: index + 1 })}
                className={cn(
                  "group relative block w-full overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected ? "border-primary-strong" : "border-input hover:border-primary-hover",
                )}
              >
                <img
                  src={photo}
                  alt={t("landlord.photo.alt", { number: index + 1 })}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
                {isSelected ? (
                  <span className="absolute right-2 top-2 rounded-full bg-card text-link">
                    <CheckCircle2 className="size-5" aria-hidden="true" />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {selected.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("landlord.photo.selectedCount", { count: selected.length })}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selected.map((photo, index) => (
              <div key={photo} className="relative">
                <img
                  src={photo}
                  alt={t("landlord.photo.selectedAlt", { number: index + 1 })}
                  className="h-16 w-24 rounded-md border border-border object-cover"
                  loading="lazy"
                />
                {index === 0 ? (
                  <span className="absolute left-1 top-1 rounded bg-card px-1.5 py-0.5 text-[10px] font-semibold text-link">
                    {t("landlord.photo.cover")}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
