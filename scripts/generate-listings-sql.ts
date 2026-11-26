
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

const listings = JSON.parse(
  readFileSync(resolve(root, "exports/listings.json"), "utf8")
);

if (!Array.isArray(listings) || listings.length === 0) {
  throw new Error("Không tìm thấy dữ liệu căn hộ.");
}

const quote = (value: unknown): string =>
  value === null || value === undefined
    ? "NULL"
    : "'" + String(value).replace(/'/g, "''") + "'";

const json = (value: unknown): string =>
  `${quote(JSON.stringify(value ?? null))}::jsonb`;

const number = (value: unknown): string =>
  typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "NULL";

const rows = listings.map((l: any) => {
  const values = [
    quote(l.id),
    quote(l.title),
    quote(l.description),
    number(l.monthlyRent),
    number(l.floorArea),
    quote(l.neighborhood),
    quote(l.address),
    number(l.location?.lat),
    number(l.location?.lng),
    quote(l.type),
    number(l.bedrooms),
    number(l.bathrooms),
    quote(l.furnishing),
    json(l.images),
    json(l.amenities),
    quote(l.availability),
    quote(l.availableFrom),
    number(l.rentalDurationMonths?.[0]),
    number(l.rentalDurationMonths?.[1]),
    number(l.costs?.depositMonths),
    json(l.costs),
    json(l.landlord),
    json(l.verification),
    json(l),
    quote(l.status ?? "draft"),
    "TRUE",
    "NOW()",
  ];

  return `(${values.join(", ")})`;
});

const sql = `
BEGIN;

INSERT INTO public.properties (
  source_id, title, description, price, area,
  neighborhood, address, latitude, longitude,
  property_type, bedrooms, bathrooms, furnishing,
  images, amenities, availability, available_from,
  minimum_months, maximum_months, deposit_months,
  costs, landlord_info, verification, listing_data,
  status, is_demo, updated_at
)
VALUES
${rows.join(",\n")}
ON CONFLICT (source_id)
DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  area = EXCLUDED.area,
  neighborhood = EXCLUDED.neighborhood,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  property_type = EXCLUDED.property_type,
  bedrooms = EXCLUDED.bedrooms,
  bathrooms = EXCLUDED.bathrooms,
  furnishing = EXCLUDED.furnishing,
  images = EXCLUDED.images,
  amenities = EXCLUDED.amenities,
  availability = EXCLUDED.availability,
  available_from = EXCLUDED.available_from,
  minimum_months = EXCLUDED.minimum_months,
  maximum_months = EXCLUDED.maximum_months,
  deposit_months = EXCLUDED.deposit_months,
  costs = EXCLUDED.costs,
  landlord_info = EXCLUDED.landlord_info,
  verification = EXCLUDED.verification,
  listing_data = EXCLUDED.listing_data,
  status = EXCLUDED.status,
  is_demo = EXCLUDED.is_demo,
  updated_at = NOW();

COMMIT;
`;

const dir = resolve(root, "exports");
mkdirSync(dir, { recursive: true });

const output = resolve(dir, "import-listings.sql");
writeFileSync(output, sql, "utf8");

console.log(`Đã tạo SQL cho ${rows.length} căn hộ.`);
console.log(`File: ${output}`);
