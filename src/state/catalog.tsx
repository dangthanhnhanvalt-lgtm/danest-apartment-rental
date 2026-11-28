import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "~/lib/supabase";
import { AMENITIES, AMENITY_LABEL_VI, NEIGHBORHOODS, NEIGHBORHOOD_LABEL_VI } from "~/data/constants";
export type RequiredField = "floorLevel" | "amenities" | "rentalNotes";
export type AreaRow = {id:string;name:string;name_vi:string|null;active:boolean;lat:number;lng:number;tagline:string|null;description:string|null;image_path:string|null;lifestyle:string[]};
export type AmenityRow = {id:string;label:string;label_vi:string|null;active:boolean};
const defaults = {areas:NEIGHBORHOODS.map(n=>({id:n.id,name:n.name,name_vi:NEIGHBORHOOD_LABEL_VI[n.id],active:true,lat:n.center.lat,lng:n.center.lng,tagline:n.tagline,description:n.description,image_path:n.image,lifestyle:n.lifestyle})), amenities:AMENITIES.map(a=>({id:a.id,label:a.label,label_vi:AMENITY_LABEL_VI[a.id],active:true})), required:[] as RequiredField[]};
type Catalog = {areas:AreaRow[];amenities:AmenityRow[];required:RequiredField[]};
const CatalogContext=createContext<Catalog&{ready:boolean;error:string;refresh:()=>Promise<void>}>({...defaults,ready:false,error:"",refresh:async()=>{}});
export function CatalogProvider({children}:{children:ReactNode}) {
 const [catalog,setCatalog]=useState<Catalog>(defaults);
 const [ready,setReady]=useState(false);const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  try {
   const [a,m,r]=await Promise.all([supabase.from("neighborhoods").select("id,name,name_vi,active,lat,lng,tagline,description,image_path,lifestyle").order("id").limit(200),supabase.from("amenities").select("id,label,label_vi,active").order("id").limit(200),supabase.rpc("danest_extra_required_10a11")]);
   if(a.error||m.error||r.error)throw new Error(a.error?.message??m.error?.message??r.error?.message);
   if(!a.data||!m.data||!Array.isArray(r.data))throw new Error("Invalid catalog response");
   setCatalog({areas:a.data as AreaRow[],amenities:m.data as AmenityRow[],required:r.data as RequiredField[]});setReady(true);setError("");
  }catch(e){setReady(false);setError(e instanceof Error?e.message:String(e));}
 },[]);
 useEffect(()=>{void refresh();const focus=()=>void refresh();window.addEventListener("focus",focus);return()=>window.removeEventListener("focus",focus);},[refresh]);
 return <CatalogContext.Provider value={{...catalog,ready,error,refresh}}>{children}</CatalogContext.Provider>;
}
export const useCatalog=()=>useContext(CatalogContext);
