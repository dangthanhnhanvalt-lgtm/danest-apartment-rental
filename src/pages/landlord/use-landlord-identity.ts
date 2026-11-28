// Identity comes only from the signed-in Supabase account.
import { useAppState } from "~/state/app-state";
export interface LandlordIdentity {id:string;displayName:string}
export function useLandlordIdentity():LandlordIdentity {
 const {session}=useAppState();
 if(session?.user.role==="landlord" && session.user.accountStatus==="active") return {id:session.user.id,displayName:session.user.name};
 return {id:"",displayName:""};
}
