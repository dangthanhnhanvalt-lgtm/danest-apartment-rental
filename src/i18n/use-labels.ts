import { useCatalog } from "~/state/catalog";
import { useMemo } from "react";
import {
  FURNISHING_LABEL,
  FURNISHING_LABEL_VI,
  LISTING_TYPE_LABEL,
  LISTING_TYPE_LABEL_VI,
  NEIGHBORHOOD_COPY_VI,
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
  const {areas,amenities}=useCatalog();
  return useMemo(() => {
    const isVi = lang === "vi";
    const allNeighborhoods=areas.map(n=>({id:n.id,name:isVi?n.name_vi??n.name:n.name,tagline:n.tagline??"",description:n.description??"",image:n.image_path??"",center:{lat:n.lat,lng:n.lng},lifestyle:n.lifestyle??[],...(isVi?NEIGHBORHOOD_COPY_VI[n.id]??{}:{}),active:n.active}));
    return {
      amenity: Object.fromEntries(amenities.map(a=>[a.id,isVi?a.label_vi??a.label:a.label])),
      amenities: amenities.filter(a=>a.active),
      allAmenities: amenities,
      furnishing: isVi ? FURNISHING_LABEL_VI : FURNISHING_LABEL,
      listingType: isVi ? LISTING_TYPE_LABEL_VI : LISTING_TYPE_LABEL,
      neighborhood: Object.fromEntries(allNeighborhoods.map(n=>[n.id,n.name])),
      allNeighborhoods,
      sampleNotice: isVi ? SAMPLE_NOTICE_VI : SAMPLE_NOTICE,
      moderation: Object.fromEntries(
        Object.entries(MODERATION_LABEL_KEY).map(([result, key]) => [result, t(key)]),
      ) as Record<ModerationResult, string>,
      neighborhoods: allNeighborhoods.filter(n=>n.active),
    };
  }, [lang, t, areas, amenities]);
}
