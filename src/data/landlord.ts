import type { Inquiry } from "~/types";

/** Incoming enquiries for the demo landlord's listings. Illustrative sample data only. */
export const SAMPLE_INQUIRIES: Inquiry[] = [
  {
    id: "inq-001",
    listingId: "lst-001",
    tenantName: "Sofia Almeida",
    tenantEmail: "sofia.almeida@example.com",
    type: "viewing-request",
    message:
      "Hello! I'm moving from Lisbon to work remotely in Da Nang for about four months. The desk by the window is exactly what I need. Could I view the apartment this week?",
    moveInDate: "2026-12-03",
    durationMonths: 4,
    tenantPreferences: ["Remote work", "Walk to beach", "Non-smoker"],
    status: "new",
    createdAt: "2026-11-10",
    scheduledAt: "2026-11-16",
  },
  {
    id: "inq-002",
    listingId: "lst-005",
    tenantName: "James Whitfield",
    tenantEmail: "j.whitfield@example.com",
    type: "question",
    message:
      "I noticed this one is marked as reserved. Could you let me know when it frees up, and whether the price is likely to stay the same?",
    moveInDate: null,
    durationMonths: 6,
    tenantPreferences: ["Couple", "Sea view"],
    status: "replied",
    createdAt: "2026-11-09",
    scheduledAt: null,
  },
  {
    id: "inq-003",
    listingId: "lst-007",
    tenantName: "Aiko Tanaka",
    tenantEmail: "aiko.tanaka@example.com",
    type: "viewing-request",
    message:
      "We are a family of three moving for a teaching contract. Is the building close to schools, and could we view on a weekend?",
    moveInDate: "2026-12-20",
    durationMonths: 10,
    tenantPreferences: ["Family", "Quiet street"],
    status: "viewing_scheduled",
    createdAt: "2026-11-08",
    scheduledAt: "2026-11-15",
  },
  {
    id: "inq-004",
    listingId: "lst-009",
    tenantName: "Marco Rossi",
    tenantEmail: "marco.rossi@example.com",
    type: "question",
    message: "Hi — is the Wi-Fi fast enough for video calls? I work from home most days.",
    moveInDate: "2026-11-21",
    durationMonths: 2,
    tenantPreferences: ["Remote work", "Solo"],
    status: "new",
    createdAt: "2026-11-11",
    scheduledAt: null,
  },
  {
    id: "inq-005",
    listingId: "lst-001",
    tenantName: "Emma de Vries",
    tenantEmail: "emma.devries@example.com",
    type: "viewing-request",
    message:
      "I would love to see this place — we are two colleagues relocating together and need a place from December.",
    moveInDate: "2026-12-01",
    durationMonths: 6,
    tenantPreferences: ["Friends sharing", "Balcony"],
    status: "not_proceeding",
    createdAt: "2026-11-05",
    scheduledAt: null,
  },
  {
    id: "inq-006",
    listingId: "lst-001",
    tenantName: "Daniel Okafor",
    tenantEmail: "daniel.okafor@example.com",
    type: "viewing-request",
    message:
      "Good afternoon. I am relocating from Lagos and would like to arrange a viewing for the middle of next week. I can share my employment details.",
    moveInDate: "2026-12-08",
    durationMonths: 8,
    tenantPreferences: ["Remote work", "Quiet building"],
    status: "new",
    createdAt: "2026-11-11",
    scheduledAt: "2026-11-18",
  },
];

export const LANDLORD_STATS = {
  propertyViews: 9140,
  upcomingViewings: 3,
};
