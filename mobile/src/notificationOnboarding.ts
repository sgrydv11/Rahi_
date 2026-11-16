export const notificationPromptKey='flexir.notifications.welcome.v1';
export interface PermissionState {granted:boolean;canAskAgain:boolean;status:string}
export function shouldOfferNotifications(permission:PermissionState,decision:string|null){
 return !decision&&(permission.granted||(permission.canAskAgain&&permission.status==='undetermined'));
}
/** Permission is requested only after the user chooses Enable, never during inspection. */
export async function decideNotifications(enable:boolean,dependencies:{save:(value:string)=>Promise<void>;channel:()=>Promise<void>;request:()=>Promise<PermissionState>}){
 // Remember the choice before the OS dialog, including cancellation/interruption.
 await dependencies.save(enable?'requested':'later');
 if(!enable)return null;
 await dependencies.channel();
 return dependencies.request();
}

export function canRegisterNotifications(ask:boolean,decision:string|null){return ask||decision==='requested';}
