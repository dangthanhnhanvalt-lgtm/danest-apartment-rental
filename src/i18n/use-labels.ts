import { useMemo } from "react";
import {
  AMENITY_LABEL,
  AMENITY_LABEL_VI,
  FURNISHING_LABEL,
  FURNISHING_LABEL_VI,
  LISTING_TYPE_LABEL,
  LISTING_TYPE_LABEL_VI,
  NEIGHBORHOOD_LABEL,
  NEIGHBORHOOD_LABEL_VI,
  NEIGHBORHOOD_COPY_VI,
  NEIGHBORHOODS,
  SAMPLE_NOTICE,
  SAMPLE_NOTICE_VI,
} from "~/data/constants";
import { useI18n } from "./language-context";

import type { ModerationResult } from "~/types";

const MODERATION_LABEL_KEY: Record<ModerationResult, string> = {
  passed: "admin.moderation.passed",
  "needs-attention": "admin.moderation.needsAttention",
  rejected: "admin.moderation.rejected",
  incomplete: "admin.moderation.incomplete",
};

/**
 * Language-aware lookups for the data-driven labels that live in src/data/constants.
 * Components render `AMENITY_LABEL[id]` etc. today; switch them to `useLabels()` so
 * the same label resolves in English or Vietnamese without hardcoded conditionals.
 */
export function useLabels() {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const isVi = lang === "vi";
    return {
      amenity: isVi ? AMENITY_LABEL_VI : AMENITY_LABEL,
      furnishing: isVi ? FURNISHING_LABEL_VI : FURNISHING_LABEL,
      listingType: isVi ? LISTING_TYPE_LABEL_VI : LISTING_TYPE_LABEL,
      neighborhood: isVi ? NEIGHBORHOOD_LABEL_VI : NEIGHBORHOOD_LABEL,
      sampleNotice: isVi ? SAMPLE_NOTICE_VI : SAMPLE_NOTICE,
      moderation: Object.fromEntries(
        Object.entries(MODERATION_LABEL_KEY).map(([result, key]) => [result, t(key)]),
      ) as Record<ModerationResult, string>,
      neighborhoods: isVi
        ? NEIGHBORHOODS.map((n) => ({ ...n, ...(NEIGHBORHOOD_COPY_VI[n.id] ?? {}) }))
        : NEIGHBORHOODS,
    };
  }, [lang, t]);
}
