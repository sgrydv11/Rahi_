# Google sign-in setup for FlexirRides Android

The production `/api/v1/auth/google/config` returned an empty clientId on
14 November 2026. Native sign-in code and a native session endpoint have been
added locally. Configuration, deployment, a new signed APK and device acceptance
are still required. No client secret is needed in the app or this repository.

1. Open https://console.cloud.google.com/ and select or create a project for
   FlexirRides. Use the same project for both OAuth clients below.
2. Open Google Auth Platform and configure Branding (app name, support email,
   developer contact). In Audience choose External for normal consumer accounts.
   While the app is in Testing, add the Gmail accounts that will test it as test
   users. Keep requested access limited to basic sign-in/profile/email.
3. Open Clients and create a **Web application** OAuth client. Name it
   `FlexirRides backend and web`. Add this Authorized JavaScript origin:
   `https://rahi-1-c3vn.onrender.com`. For local browser testing also add
   `http://localhost:5173` and/or `http://127.0.0.1:5174`.
   The existing browser integration uses Google Identity Services and the native
   integration uses an ID token; neither uses an OAuth redirect URL.
4. Copy the public Web client ID ending in `.apps.googleusercontent.com`.
   In Render, open the backend service → Environment and set
   `GOOGLE_CLIENT_ID` to that value. Save and redeploy. Do not paste the Web
   client secret into the app. The Android app fetches the public ID from
   `/api/v1/auth/google/config`; a separate build environment value is unnecessary.
5. In the same Google project create an **Android** OAuth client:
   - Package name: `com.hoopr.app`
   - SHA-1: the certificate signing the APK installed on the test phone.
   The existing local `.local/FlexirRides-328c24d.apk` contains this signing
   certificate SHA-1 (extracted from its APK v2 signing block):
   `2E:E9:73:F7:5E:B9:68:C0:8E:F7:BD:0E:4E:81:81:00:E3:0E:82:F7`.
   Confirm that EAS still uses this certificate before relying on it: from
   `mobile`, run `npx.cmd eas-cli@latest credentials -p android` and view the
   keystore SHA-1. Do not regenerate the keystore. Register additional Android
   clients for different debug or future Google Play signing certificates.
   The Android client ID is registered with Google; do not use it as
   `GOOGLE_CLIENT_ID` (that setting needs the **Web** client ID).
6. Deploy the new backend code, including `/api/v1/mobile/auth/google`, before
   testing the new Android code. The endpoint verifies Google's signature,
   issuer, expiry, verified email and Web-client audience using the existing
   GoogleTokenVerifier. It issues the normal app access/refresh session.
7. When an APK is explicitly requested, build it with the existing preview
   profile and install it. The Google native dependency requires a rebuilt
   binary; Expo Go and the old APK cannot provide this integration. Android
   uses native autolinking without Firebase; no google-services.json is needed.
8. On an Android device with Google Play services, tap Continue with Google,
   select a registered test account, and verify sign-in, account identity,
   app restart/session restoration, cancel and sign-out. Do not call the setup
   production-verified until this test succeeds.

Troubleshooting: error 10 / DEVELOPER_ERROR means to check package, signing
SHA-1, Web client ID and that both OAuth clients belong to the same project.
Missing Play services gets an actionable app message. Cancelling does not
create an app session. Backend invalid tokens return 401; absent client
configuration is reported without starting Google account selection.

iOS Google login is outside this Android fix. It additionally needs an iOS
OAuth client for `com.hoopr.app` and the reversed-client URL scheme in Expo's
Google plugin. No placeholder iOS client or scheme has been added.

References:
- https://docs.expo.dev/guides/google-authentication/
- https://react-native-google-signin.github.io/docs/original
- https://react-native-google-signin.github.io/docs/setting-up/get-config-file
