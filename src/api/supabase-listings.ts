
import { supabase } from "~/lib/supabase";
import type { Listing } from "~/types";

export async function getSupabaseListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("source_id, listing_data")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase listings error:", error);
    throw new Error(error.message);
  }

  const listings = (data ?? [])
    .filter((row) => row.listing_data && row.source_id)
    .map((row) => ({
      ...(row.listing_data as Listing),
      id: row.source_id as string,
    }));

  console.log(`DaNest: Loaded ${listings.length} listings from Supabase`);

  return listings;
}
export async function createSupabaseListing(listing: Listing): Promise<Listing> {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Bạn cần đăng nhập để đăng tin.");
  }

  const userId = authData.user.id;

  const { error } = await supabase
    .from("properties")
    .insert({
      source_id: listing.id,
      owner_id: userId,
      title: listing.title,
      description: listing.description,
      price: listing.monthlyRent,
      area: listing.floorArea,
      neighborhood: listing.neighborhood,
      address: listing.address,
      latitude: listing.location.lat,
      longitude: listing.location.lng,
      property_type: listing.type,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      furnishing: listing.furnishing,
      images: listing.images,
      amenities: listing.amenities,
      availability: listing.availability,
      status: "pending",
      is_demo: false,
      listing_data: {
        ...listing,
        landlordId: userId,
        status: "pending",
        isSample: false,
      },
    });

  if (error) {
    console.error("Supabase create listing error:", error);
    throw new Error(error.message);
  }

  return {
    ...listing,
    landlordId: userId,
    status: "pending",
    isSample: false,
  };
}
export async function getMySupabaseListings(): Promise<Listing[]> {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    return [];
  }

  const userId = authData.user.id;

  const { data, error } = await supabase
    .from("properties")
    .select("source_id, listing_data, status")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase my listings error:", error);
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((row) => row.source_id && row.listing_data)
    .map((row) => ({
      ...(row.listing_data as Listing),
      id: row.source_id as string,
      landlordId: userId,
      status: row.status as Listing["status"],
    }));
}