import { Platform } from 'react-native';
import { googleConfig, loginWithGoogle, type Preference, type User } from './api';
import { Button } from './ui';

export function GoogleSignIn({preference,busy,run,onUser}:{preference:Preference;busy:boolean;run:(action:()=>Promise<void>)=>Promise<void>;onUser:(user:User)=>void}) {
  if(Platform.OS!=='android')return null;
  async function signIn() {
    const {clientId}=await googleConfig();
    if(!clientId)throw new Error('Google sign-in needs setup. Please use password or email code for now.');
    // Load only on demand so an older binary/Expo Go still opens password login.
    let sdk:typeof import('@react-native-google-signin/google-signin');
    try {sdk=await import('@react-native-google-signin/google-signin');}
    catch {throw new Error('Install the latest Android build to use Google sign-in.');}
    try {
      sdk.GoogleSignin.configure({webClientId:clientId,offlineAccess:false});
      await sdk.GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog:true});
      const response=await sdk.GoogleSignin.signIn();
      if(!sdk.isSuccessResponse(response))return;
      if(!response.data.idToken)throw new Error('Google did not return an identity token. Check the Web client ID setup.');
      onUser(await loginWithGoogle(response.data.idToken,preference));
    } catch(error) {
      if(sdk.isErrorWithCode(error)) {
        if(error.code===sdk.statusCodes.SIGN_IN_CANCELLED)return;
        if(error.code===sdk.statusCodes.IN_PROGRESS)throw new Error('Google sign-in is already open.');
        if(error.code===sdk.statusCodes.PLAY_SERVICES_NOT_AVAILABLE)throw new Error('Update Google Play services on this phone and try again.');
        if(error.code==='10' || error.code==='DEVELOPER_ERROR')throw new Error('Google Android setup is incomplete. Register this APK signing SHA-1 and com.hoopr.app in Google Cloud.');
      }
      throw error;
    }
  }
  return <Button label="Continue with Google" disabled={busy} onPress={()=>void run(signIn)}/>;
}
