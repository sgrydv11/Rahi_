# Mobile push setup for FlexirRides

The application code now uses Expo Notifications for real remote notifications.
This is different from the existing open-app polling banner. A new native APK and
provider credentials are required; the installed 0.2.3 APK does not contain this module.

## Android: Firebase and EAS

1. Create a Firebase project at https://console.firebase.google.com/ . Add an Android
   app with the exact package **com.hoopr.app**. Do not use the Expo project name as
   the Android package.
2. Download its `google-services.json` client configuration. Supply it as an EAS
   **file environment variable** named `GOOGLE_SERVICES_JSON` in the environment
   used by the Android preview build. `mobile/app.config.js` reads this file path.
   A local `mobile/google-services.json` is also supported, but ignored by Git;
   prefer the EAS file variable for cloud builds.
3. Firebase project settings → Service accounts: generate a private service-account
   key with permission to send FCM v1 messages. Ensure the Firebase Cloud Messaging
   API is enabled for that project.
4. From `mobile`, run `npx.cmd eas-cli@latest credentials --platform android`.
   Select the project/preview profile, then the FCM v1 push credential option and
   upload that private service-account JSON. Alternatively use Expo dashboard →
   project → Credentials → Android application → FCM v1 service-account key.
5. Keep the private JSON outside the repository. It belongs in EAS credentials,
   not in Render and not in chat. Firebase client config and the private server
   key must belong to the same Firebase project/sender ID.
6. In Render, enable `PUSH_NOTIFICATIONS_ENABLED=true` after credentials are ready.
   The service polls durable notification work every 15 seconds. If enhanced Expo
   push security is enabled on the Expo project, set `EXPO_PUSH_ACCESS_TOKEN` in
   Render as a secret as well.
7. Request a new APK. A JavaScript-only update cannot add the native notification
   module or Firebase Android configuration to 0.2.3.

Official references:
- https://docs.expo.dev/push-notifications/fcm-credentials/
- https://docs.expo.dev/push-notifications/push-notifications-setup/
- https://docs.expo.dev/push-notifications/sending-notifications/

## User permission and behavior

- Sign in, then choose Enable phone notifications in the app/Account. Android's
  notification channel is created before asking for permission/token registration.
- If permission is refused, the app keeps working; the user can open the app's
  notification settings and enable it later. Permission is rechecked on resume.
- Missing provider/server configuration is shown as unavailable, not as successful
  push activation. An unavailable build does not pretend to deliver notifications.
- Tapping a notification opens its group, ride or booking through validated internal
  links. External URLs and arbitrary routes from notification payloads are ignored.
- Open-app banners remain in charge in the foreground; remote OS banners/sound are
  for background delivery, avoiding duplicate foreground alerts.
- Device registration is tied to the authenticated refresh session. Muted/read chat
  work and disabled/expired/revoked sessions are excluded. Changing accounts replaces
  device ownership and removes old queued work. Already accepted provider messages
  cannot be recalled after logout.
- Provider acceptance/receipts do not prove the phone displayed an alert. Retries
  use durable event deduplication and bounded attempts; a network-ambiguous provider
  response can still cause a duplicate delivery. Invalid device tokens are disabled.

## Acceptance test after setup

Use two explicitly authorized test accounts on physical phones. Enable permission
on both; background/lock the receiving app. Send an agreed QA message and verify OS
banner/sound plus correct group navigation. Repeat for booking confirmation,
cancellation/start/completion and matching-route alerts. Test mute, denied permission,
logout/account switch, offline/reconnect and invalid tokens. Do not test with real
payments or post to unrelated live groups without authorization.

## iOS

The code includes the iOS permission/token path. An Apple Developer team, APNs
credentials and a newly signed native build with the notification entitlement are
required separately. Android Firebase setup alone does not configure APNs.

## FCM provisioning — 14 November 2026

Created a dedicated `flexirrides-expo-push` service account in `flexiridetest`,
with the approved Firebase Cloud Messaging API Admin role. The existing broader
Firebase Admin SDK account was not used. Google accepted a locally generated
public X.509 certificate; its private key remains in ignored `.local` storage.
A messaging-scope OAuth exchange succeeded without displaying the access token.
The private credential was uploaded to Expo/EAS and assigned to `com.hoopr.app`.

The Android client configuration was assembled from console-verified project
number, project/app IDs, Android API key and OAuth clients; it is ignored locally
and stored as secret EAS preview file variable `GOOGLE_SERVICES_JSON`. The preview
profile explicitly selects that environment. APK 0.2.4 / build 6 is being prepared.

The uploaded certificate expires 14 November 2027; replace the credential before
expiry. The first Google-generated key had an inaccessible browser download and
was not used by Expo. The user explicitly requested retaining that unused key.
No private key or access token belongs in Git or a public app-download link.

Provisioning is not phone-delivery acceptance. Backend push enablement/deployment,
finished APK installation and a consented two-account background-message test
remain necessary before claiming that notifications appear on a phone.
