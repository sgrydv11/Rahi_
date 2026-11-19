export const permissionWelcomeKey='flexir.permissions.welcome.v1';
export type PermissionKind='contacts'|'notifications'|'location';
export interface PermissionChoice {contacts:boolean;notifications:boolean;location:boolean}
export async function requestWelcomePermissions(choice:PermissionChoice,request:(kind:PermissionKind)=>Promise<boolean>){
 const result:Partial<Record<PermissionKind,boolean>>={};
 // OS permission dialogs must run sequentially; denial never prevents the next choice.
 for(const kind of ['contacts','notifications','location'] as const){if(!choice[kind])continue;try{result[kind]=await request(kind);}catch{result[kind]=false;}}
 return result;
}
