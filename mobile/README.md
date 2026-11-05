# Hoopr for Android and iOS

This Expo app renders Hoopr screens with React Native components. The app talks directly to the Hoopr API over HTTPS and stores its rotating refresh token in device secure storage. Deploy the backend from this branch so that the mobile authentication endpoints are available.

1. Run `npm ci` in this directory.
2. Copy `.env.example` to `.env`. Set `EXPO_PUBLIC_API_BASE_URL` to the backend HTTPS URL, including `/api/v1`. For a phone or emulator, use a reachable HTTPS backend.
3. Run `npm run android` with Android Studio, its SDK and an emulator or connected device. On macOS with Xcode, run `npm run ios`. Use `npm start` to restart Metro for the installed development client. The native Razorpay SDK requires a development or standalone build.
4. For a signed build, configure your Expo account and platform signing credentials with EAS. Use `eas build --profile preview --platform android` for an installable APK or `eas build --profile preview --platform ios` for registered iOS devices. Set the public API URL in the EAS environment used for the build.

Ride search, offers, bookings and cancellations, trip start and completion, passenger manifests, ratings, notifications, profile, vehicles and route pins are available from the native screens. Driving directions open the maps provider. Razorpay uses its native checkout module. Stripe opens hosted Checkout in the system browser. Return to Hoopr afterward and tap **Check payment status** on the booking. Provider checkout requires the backend test keys described in the payment setup guide.

Run `npm test` with Node 24 for the API contract cases, then `npm run typecheck` and `npm run bundle:check` to check both target bundles. For device acceptance, exercise sign-in and restart, ride offer and booking with two accounts, trip completion and rating, notifications, profile and vehicles, directions, checkout and cancellation refunds. Check both platforms with their native builds.

Dependency installation applies a namespace compatibility fix to the pinned Razorpay Android library before Gradle runs.

Set `EXPO_PUBLIC_DEMO_MODE=true` to browse sample rides on a device without a backend. Demo mode disables sign-in, bookings and payments.

[Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) · [EAS internal distribution](https://docs.expo.dev/build/internal-distribution/) · [Razorpay React Native integration](https://razorpay.com/docs/payments/payment-gateway/react-native-integration/standard/)
