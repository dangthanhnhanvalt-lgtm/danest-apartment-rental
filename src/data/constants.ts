import type { Amenity, AmenityId, FurnishingStatus, ListingType, Neighborhood, NeighborhoodId } from "~/types";

export const NEIGHBORHOODS: Neighborhood[] = [
  {
    id: "an-thuong",
    name: "An Thuong",
    tagline: "Expat-friendly lifestyle",
    description:
      "Cafés, co-working spaces and international restaurants within walking distance of My Khe Beach. The most popular base for digital nomads and long-stay visitors.",
    image: "/images/n-an-thuong.jpg",
    center: { lat: 16.0497, lng: 108.2471 },
    lifestyle: ["Cafés & co-working", "Walk to the beach", "International food"],
  },
  {
    id: "my-an",
    name: "My An",
    tagline: "Beachside living",
    description:
      "Quiet residential streets a few minutes from the sand. A calmer alternative to An Thuong that is still close to everything the coast offers.",
    image: "/images/n-my-an.jpg",
    center: { lat: 16.0462, lng: 108.2432 },
    lifestyle: ["Calm residential streets", "5 minutes to My Khe", "Family-friendly"],
  },
  {
    id: "son-tra",
    name: "Son Tra",
    tagline: "Modern apartments, coastal air",
    description:
      "Newer buildings along the Son Tra peninsula, with sea breezes, green views and a quieter pace while staying connected to the city.",
    image: "/images/n-son-tra.jpg",
    center: { lat: 16.0712, lng: 108.2501 },
    lifestyle: ["Newer buildings", "Peninsula walks", "Sea breeze"],
  },
  {
    id: "han-river",
    name: "Han River",
    tagline: "City living, riverside views",
    description:
      "The riverfront district with the Dragon Bridge, night markets and easy access to offices, hospitals and the airport.",
    image: "/images/n-han-river.jpg",
    center: { lat: 16.0601, lng: 108.2273 },
    lifestyle: ["Riverfront promenade", "Night markets", "Central transport links"],
  },
];

export const NEIGHBORHOOD_LABEL: Record<NeighborhoodId, string> = {
  "an-thuong": "An Thuong",
  "my-an": "My An",
  "son-tra": "Son Tra",
  "han-river": "Han River",
};

export const NEIGHBORHOOD_LABEL_VI: Record<NeighborhoodId, string> = {
  "an-thuong": "An Thượng",
  "my-an": "Mỹ An",
  "son-tra": "Sơn Trà",
  "han-river": "Sông Hàn",
};

/** Vietnamese localised copy for neighbourhood taglines/descriptions/lifestyle. */
export const NEIGHBORHOOD_COPY_VI: Record<NeighborhoodId, { tagline: string; description: string; lifestyle: string[] }> = {
  "an-thuong": {
    tagline: "Phong cách sống cho người nước ngoài",
    description:
      "Quán cà phê, không gian làm việc chung và nhà hàng quốc tế trong khoảng đi bộ đến biển Mỹ Khê. Khu vực được yêu thích nhất của dân du mục số và khách lưu trú dài ngày.",
    lifestyle: ["Cà phê & co-working", "Đi bộ ra biển", "Ẩm thực quốc tế"],
  },
  "my-an": {
    tagline: "Sống bên biển",
    description:
      "Những con phố dân cư yên tĩnh, chỉ vài phút ra bãi biển. Một lựa chọn tĩnh lặng hơn An Thượng nhưng vẫn gần mọi tiện ích ven biển.",
    lifestyle: ["Phố dân cư yên tĩnh", "5 phút đến Mỹ Khê", "Phù hợp gia đình"],
  },
  "son-tra": {
    tagline: "Căn hộ hiện đại, gió biển trong lành",
    description:
      "Những tòa nhà mới dọc bán đảo Sơn Trà, đón gió biển, tầm nhìn xanh và nhịp sống yên bình mà vẫn kết nối với thành phố.",
    lifestyle: ["Tòa nhà mới", "Đi dạo bán đảo", "Gió biển"],
  },
  "han-river": {
    tagline: "Sống phố, ngắm sông",
    description:
      "Khu ven sông với Cầu Rồng, chợ đêm và dễ dàng đến văn phòng, bệnh viện và sân bay.",
    lifestyle: ["Phố đi bộ ven sông", "Chợ đêm", "Giao thông trung tâm"],
  },
};

export const AMENITIES: Amenity[] = [
  { id: "wifi", label: "High-speed Wi-Fi" },
  { id: "air-conditioning", label: "Air conditioning" },
  { id: "washing-machine", label: "Washing machine" },
  { id: "kitchen", label: "Equipped kitchen" },
  { id: "pool", label: "Swimming pool" },
  { id: "gym", label: "Gym" },
  { id: "balcony", label: "Balcony" },
  { id: "parking", label: "Motorbike parking" },
  { id: "elevator", label: "Elevator" },
  { id: "workspace", label: "Dedicated workspace" },
  { id: "pet-friendly", label: "Pet-friendly" },
  { id: "sea-view", label: "Sea view" },
];

export const AMENITY_LABEL: Record<AmenityId, string> = AMENITIES.reduce(
  (acc, a) => ({ ...acc, [a.id]: a.label }),
  {} as Record<AmenityId, string>,
);

export const AMENITY_LABEL_VI: Record<AmenityId, string> = {
  wifi: "Wi-Fi tốc độ cao",
  "air-conditioning": "Điều hòa",
  "washing-machine": "Máy giặt",
  kitchen: "Bếp đầy đủ",
  pool: "Hồ bơi",
  gym: "Phòng gym",
  balcony: "Ban công",
  parking: "Chỗ để xe máy",
  elevator: "Thang máy",
  workspace: "Góc làm việc riêng",
  "pet-friendly": "Cho phép thú nuôi",
  "sea-view": "Hướng biển",
};

export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  apartment: "Apartment",
  studio: "Studio",
  "serviced-apartment": "Serviced apartment",
  penthouse: "Penthouse",
};

export const LISTING_TYPE_LABEL_VI: Record<ListingType, string> = {
  apartment: "Căn hộ",
  studio: "Studio",
  "serviced-apartment": "Căn hộ dịch vụ",
  penthouse: "Penthouse",
};

export const FURNISHING_LABEL: Record<FurnishingStatus, string> = {
  furnished: "Fully furnished",
  "semi-furnished": "Semi-furnished",
  unfurnished: "Unfurnished",
};

export const FURNISHING_LABEL_VI: Record<FurnishingStatus, string> = {
  furnished: "Đầy đủ nội thất",
  "semi-furnished": "Nội thất cơ bản",
  unfurnished: "Chưa có nội thất",
};

export const SAMPLE_NOTICE =
  "Prototype preview — every apartment, landlord and message you see is illustrative sample data stored in this browser. No accounts, payments, identity checks or map data are connected to a real service yet.";

export const SAMPLE_NOTICE_VI =
  "Bản thử nghiệm — mọi căn hộ, chủ nhà và tin nhắn bạn thấy chỉ là dữ liệu mẫu lưu trong trình duyệt. Chưa có tài khoản, thanh toán, xác minh danh tính hay dữ liệu bản đồ nào kết nối dịch vụ thật.";
