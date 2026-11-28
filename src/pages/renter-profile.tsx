import {AccountEmailSettings} from "~/components/account-email-settings";
import {useEffect,useState,type FormEvent} from "react";
import {useAppState} from "~/state/app-state";
import {listingRpc} from "~/api/supabase-listings";
import {useI18n} from "~/i18n/language-context";
import {Button} from "~/components/ui/button";
import {Field,Input} from "~/components/ui/form";
import {Link} from "~/lib/router";
type Profile={name:string;phone:string;loginEmail:string};
export function RenterProfilePage(){
 const {session,backendReady}=useAppState(); const {pick}=useI18n();
 if(!backendReady)return <p className="p-8">{pick("Loading…","Đang tải…")}</p>;
 if(session?.user.role!=="tenant"||session.user.accountStatus!=="active")return <div className="mx-auto max-w-xl p-8"><p>{pick("Active renter account required.","Cần tài khoản người thuê đang hoạt động.")}</p><Link to="/login" className="text-link underline">{pick("Sign in","Đăng nhập")}</Link></div>;
 return <ProfileForm key={session.user.id} id={session.user.id}/>;
}
function ProfileForm({id}:{id:string}){
 const {pick}=useI18n(); const [profile,setProfile]=useState<Profile|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false);const [reload,setReload]=useState(0);
 useEffect(()=>{let cancelled=false;setError("");setProfile(null);void listingRpc("danest_my_renter_profile_09e1",{p_expected_user:id}).then(v=>{if(!cancelled)setProfile(v as Profile);}).catch(e=>{if(!cancelled)setError(String(e?.message??e));});return()=>{cancelled=true;};},[id,reload]);
 async function submit(e:FormEvent){e.preventDefault();if(!profile||busy)return;setBusy(true);setError("");setSaved(false);try{const next=await listingRpc("danest_save_renter_profile_09e1",{p_expected_user:id,p_name:profile.name.trim(),p_phone:profile.phone.trim()});setProfile(next as Profile);setSaved(true);window.dispatchEvent(new Event("danest-profile-updated"));}catch(err){setError(String((err as Error)?.message??err));}finally{setBusy(false);}}
 return <section className="mx-auto max-w-xl space-y-5 px-4 py-12"><h1 className="font-heading text-3xl font-semibold">{pick("My profile","Hồ sơ của tôi")}</h1><p className="text-sm text-muted-foreground">{pick("Your contact details are shared only according to the inquiry access rules.","Thông tin liên hệ chỉ được chia sẻ theo quy tắc truy cập yêu cầu thuê.")}</p>{error&&<p role="alert" className="text-destructive">{error}</p>}{!profile?<Button variant="outline" onClick={()=>setReload(n=>n+1)}>{pick("Reload profile","Tải lại hồ sơ")}</Button>:<form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5"><Field label={pick("Name","Họ tên")} htmlFor="renter-name"><Input id="renter-name" required minLength={2} maxLength={100} value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></Field><Field label={pick("Contact phone","Số điện thoại liên hệ")} htmlFor="renter-phone"><Input id="renter-phone" type="tel" maxLength={40} value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})}/></Field><Button disabled={busy} type="submit">{pick("Save profile","Lưu hồ sơ")}</Button>{saved&&<p role="status">{pick("Profile saved.","Đã lưu hồ sơ.")}</p>}</form>}<AccountEmailSettings key={id} userId={id}/></section>;
}
