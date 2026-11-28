export function validEmailChange(candidate:string,current:string):boolean{
 const value=candidate.trim();return value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.toLowerCase()!==current.trim().toLowerCase();
}
