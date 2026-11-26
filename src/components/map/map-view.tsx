import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatRent } from "~/lib/format";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { Link } from "~/lib/router";
import "~/components/map/map.css";
import type { Listing } from "~/types";

const pinIcon = (label: string, active: boolean) =>
  L.divIcon({
    className: "livora-pin",
    html: `<div style="display:inline-flex;align-items:center;gap:4px;transform:translate(-50%,-100%);padding:4px 10px;border-radius:999px;font-family:Manrope,system-ui,sans-serif;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px color-mix(in srgb, var(--primary) 35%, transparent);border:2px solid ${active ? "var(--primary)" : "var(--card)"};background:${active ? "var(--primary)" : "var(--card)"};color:${active ? "var(--primary-foreground)" : "var(--primary)"}">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

function FitBounds({ listings, focus }: { listings: Listing[]; focus: Listing | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) {
      map.flyTo([focus.location.lat, focus.location.lng], 15, { duration: 0.6 });
      return;
    }
    if (listings.length === 0) return;
    const bounds = L.latLngBounds(listings.map((l) => [l.location.lat, l.location.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.25), { maxZoom: 15 });
  }, [map, listings, focus]);
  return null;
}

/** The map is driven entirely by the repository's listing coordinates. A real backend provider
 *  can supply the same fields without any change to this component. */
export function MapView({
  listings,
  activeId,
  onSelect,
  focus,
  className,
  compact,
}: {
  listings: Listing[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  focus?: Listing | null;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const labels = useLabels();
  const center: [number, number] = [16.052, 108.243];
  return (
    <div className={className ?? "h-full w-full"}>
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl
        style={{ minHeight: compact ? 260 : 400 }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <FitBounds listings={listings} focus={focus ?? null} />
        {listings.map((l) => (
          <Marker
            key={l.id}
            position={[l.location.lat, l.location.lng]}
            icon={pinIcon(formatRent(l.monthlyRent).replace("/month", ""), activeId === l.id)}
            eventHandlers={{ click: () => onSelect?.(l.id) }}
            keyboard
            title={`${l.title} — ${formatRent(l.monthlyRent)}`}
          >
            <Popup>
              <div className="w-52">
                <img src={l.images[0]} alt="" className="mb-2 h-24 w-full rounded-md object-cover" />
                <p className="livora-popup-title">{l.title}</p>
                <p className="livora-popup-meta">
                  {labels.neighborhood[l.neighborhood]} · {t("listing.beds", { count: l.bedrooms })} · {l.floorArea} m²
                </p>
                <p className="livora-popup-price">{formatRent(l.monthlyRent)}</p>
                <Link to={`/apartment/${l.id}`} className="livora-popup-link">
                  {t("listing.viewDetails")}
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
