import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatRent } from "~/lib/format";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { Link } from "~/lib/router";
import "~/components/map/map.css";
import type { NearbyPlace } from "~/lib/nearby-places";
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
  const initialized = useRef(false);
  const previousFocus = useRef<string | null>(null);
  // Coordinate signature is stable even if the parent reconstructs the listing array.
  const coordinates = listings.map(l => `${l.id}:${l.location.lat}:${l.location.lng}`).join("|");
  const focusId = focus?.id ?? null;
  useEffect(() => {
    if (focusId && focus) {
      if (previousFocus.current !== focusId) map.flyTo([focus.location.lat, focus.location.lng], 15, { duration: 0.6 });
      previousFocus.current = focusId;
      initialized.current = true;
      return;
    }
    previousFocus.current = null;
    if (initialized.current || !coordinates) return;
    const bounds = L.latLngBounds(coordinates.split("|").map(part => {
      const [lat, lng] = part.split(":").slice(-2).map(Number);
      return [lat, lng] as [number, number];
    }));
    if (bounds.isValid()) { map.fitBounds(bounds.pad(0.25), { maxZoom: 15 }); initialized.current = true; }
  }, [map, coordinates, focusId, focus]);
  return null;
}
function FitNearby({places,focus}:{places:NearbyPlace[];focus:Listing|null}){
  const map=useMap(); const initialized=useRef(false);
  const signature=places.map(p=>`${p.id}:${p.lat}:${p.lng}`).join("|");
  useEffect(()=>{if(initialized.current||!places.length)return;const points=places.map(p=>[p.lat,p.lng] as [number,number]);if(focus)points.push([focus.location.lat,focus.location.lng]);map.fitBounds(L.latLngBounds(points).pad(0.12),{maxZoom:15});initialized.current=true;},[map,signature]);
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
  nearby,
}: {
  listings: Listing[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  focus?: Listing | null;
  className?: string;
  compact?: boolean;
  nearby?: NearbyPlace[];
}) {
  const { t, pick } = useI18n();
  const labels = useLabels();
  const valid = (l:Listing) => !!l.location && Number.isFinite(l.location.lat) && Number.isFinite(l.location.lng) && Math.abs(l.location.lat)<=90 && Math.abs(l.location.lng)<=180;
  const mapListings=useMemo(()=>listings.filter(valid),[listings]);
  const mapFocus=focus && valid(focus)?focus:null;
  const center: [number, number] = [16.052, 108.243];
  return (
    <div className={className ?? "h-full w-full"}>
      <MapContainer
        center={center}
        zoom={14}
        zoomControl={true}
        scrollWheelZoom={true}
        className="h-full w-full"
        attributionControl
        style={{ minHeight: compact ? 260 : 400 }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <FitBounds listings={mapListings} focus={mapFocus} />
        {nearby && <FitNearby places={nearby} focus={mapFocus}/>}
        {nearby?.map(p=><CircleMarker key={p.id} center={[p.lat,p.lng]} radius={8} pathOptions={{color:"#fff",weight:2,fillColor:{beach:"#257a9b",supermarket:"#427945",hospital:"#ba4242",center:"#8763b1"}[p.kind],fillOpacity:1}}><Popup><strong>{p.name||pick("Unnamed place","Địa điểm chưa có tên")}</strong><p>{{beach:pick("Beach","Bãi biển"),supermarket:pick("Supermarket","Siêu thị"),hospital:pick("Hospital","Bệnh viện"),center:pick("City / town reference point","Điểm trung tâm thành phố/thị trấn")}[p.kind]} · {(p.distance/1000).toFixed(2)} km</p></Popup></CircleMarker>)}
        {mapListings.map((l) => (
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
                <p className="livora-popup-meta">{t("map.approximate")}</p>
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
