import { listingRpc } from "~/api/supabase-listings";
export interface LandlordProfile {displayName:string;loginEmail:string;email:string;phone:string;languages:string[];memberSince:string|null;approvedAt:string|null}
function checked(value:unknown):LandlordProfile {
 if (!value || typeof value!=="object" || typeof (value as LandlordProfile).displayName!=="string") throw new Error("Invalid profile response");
 return value as LandlordProfile;
}
export async function readLandlordProfile(userId:string){return checked(await listingRpc("danest_my_landlord_profile_08b",{p_expected_user:userId}));}
export async function saveLandlordProfile(userId:string,profile:{displayName:string;email:string;phone:string;languages:string}){
 return checked(await listingRpc("danest_save_landlord_profile_08b",{p_expected_user:userId,p_name:profile.displayName.trim(),p_email:profile.email.trim(),p_phone:profile.phone.trim(),p_languages:profile.languages.split(",").map(x=>x.trim()).filter(Boolean)}));
}
