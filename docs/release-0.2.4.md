# FlexirRides 0.2.4 — Android push release

Source: `7d66a5e9df039b5456b04e702a56038aeedaaa0c`, branch `app_v1`.

- Expo build: `75cf6c19-3f17-4f31-996a-fbb973f41fac`, FINISHED.
- Android: `com.hoopr.app`, version 0.2.4, version code 6.
- Build fingerprint: `5016a5daea66cc455e11050ca62023d86403a89d`.
- [Install/build page](https://expo.dev/accounts/ydvsgr11s-team/projects/sagar-yadav/builds/75cf6c19-3f17-4f31-996a-fbb973f41fac).
- [APK](https://expo.dev/artifacts/eas/2gPRhGHx6lFrmM36TxNlBcMg0Dg8MhxP2RKjgdhWF_4.apk).
- [Hosted regression checks passed](https://github.com/sgrydv11/Rahi_/actions/runs/43616031217).
- Render push-enabled configuration deployment `dep-dbs8qn74bgms73fmcrgg` is Live.
- Production V25 migration validated; `/actuator/health` UP and locations HTTP 200.
- Authenticated `/push/config` HTTP 200, enabled true. Temporary demo test session revoked.
- Google public client remains configured; Android OAuth package and signing identity verified.
- Dedicated FCM credential validated with Google and privately assigned to Expo. EAS
  preview file configuration is installed; no private credential is in Git.
- User requested retaining the unused first Google-generated key; it was not deleted.

## Phone acceptance

Install this APK over the previous version to retain the app session. Open Account
→ Phone notifications → Enable phone notifications and allow Android's prompt.
Background/lock the receiving app, then have an authorized second account send a
message to an unmuted group. Check OS notification, unread badge, notification tap,
muting, permission refusal/recovery and booking/ride updates.

No phone was connected during this release. Successful OS delivery/display and
Google account login have not been claimed as physically tested. The app requires
Google Play services for Android push. Render's free service can sleep, which can
delay message requests or scheduled notification work; this is not an always-on
hosting guarantee. iOS still requires APNs credentials and a separately signed build.

The notification pipeline uses session-bound installations, read/mute checks,
durable deduplication/outbox, bounded retries and provider receipt handling.
A provider receipt is not proof that the phone displayed a notification.

## Downloaded artifact verification

APK download verified: 91,506,719 bytes, SHA-256
`afac77ec7b4b66efabc2dd9afc4c14e226abd28d8044f31e34b93df6b7f08eb1`.
Android package/version/code and POST_NOTIFICATIONS permission are correct.
APK v2 signature verifies and the signing certificate matches previous releases.
Archive CRCs pass. Google Sign-In and Expo Firebase Messaging native classes are
present, with the expected Firebase Android app ID and sender number in resources.
These artifact checks do not replace on-phone notification acceptance.
