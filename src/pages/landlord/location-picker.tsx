import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useI18n } from "~/i18n/language-context";
import type { GeoPoint } from "~/types";
function ClickPin({onChange}: {onChange:(p:GeoPoint)=>void}) {
 useMapEvents({click:e=>onChange({lat:Number(e.latlng.lat.toFixed(6)),lng:Number(e.latlng.lng.toFixed(6)),precision:"owner-selected"})}); return null;
}
export function LocationPicker({center,value,onChange}: {center:GeoPoint;value?:GeoPoint;onChange:(p:GeoPoint)=>void}) {
 const {pick}=useI18n();
 const point=value??center;
 return <div className="space-y-2"><p className="text-sm font-medium">{pick("Apartment location — choose a pin","Vị trí căn hộ — chọn điểm trên bản đồ")}</p><p className="text-xs text-muted-foreground">{pick("Click the map to select the building location. The pin will be public; do not include private contact details.","Bấm bản đồ để chọn vị trí tòa nhà. Vị trí sẽ công khai; không nhập thông tin liên hệ riêng.")}</p><div className="h-64 overflow-hidden rounded-lg border border-border isolate"><MapContainer key={`${center.lat}:${center.lng}`} center={[point.lat,point.lng]} zoom={14} scrollWheelZoom={false} className="h-full w-full"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}/><ClickPin onChange={onChange}/>{value && <CircleMarker center={[value.lat,value.lng]} radius={8} pathOptions={{color:"#172C3D",fillColor:"#829987",fillOpacity:1}}/>}</MapContainer></div><p className="text-xs text-muted-foreground">{value?.precision==="owner-selected"?pick("Selected: ","Đã chọn: ")+`${value.lat}, ${value.lng}`:pick("Not selected — existing or area location is approximate.","Chưa chọn — vị trí cũ hoặc tâm khu vực chỉ mang tính ước lượng.")}</p></div>;
}
