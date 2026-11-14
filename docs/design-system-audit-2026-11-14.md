# Shared design system and UI audit

Implemented locally on app_v1, 14 November 2026. This is source implementation and local verification, not a production deployment or APK release.

## Design decisions

- Typeface: Inter only for app-owned text, bundled with its SIL Open Font License. Regular, semibold and bold weights. No external font service needed at runtime.
- Primary colors: navy #142D4E and blue #245EEA. White/gray surfaces and semantic error red are supporting colors, not additional brand colors.
- Spacing: 4, 8, 12, 16, 24, 32 and 48 pixel scale. Shared native primitives use 24-pixel cards/content spacing and 8-pixel field gaps.
- Controls: 48-pixel minimum action height, 52-pixel fields, 12-pixel control radius. Primary, selection and utility states use the same type, shape and palette. Cards use a 20-pixel radius (16 on small screens).
- Layout: 1168-pixel web content grid, 32-pixel desktop gutters and 20-pixel mobile gutters. Native content remains centered with a readable maximum width.
- Headlines: larger Inter bold with a consistent hierarchy; short body copy and readable line lengths.
- Icons: official Ionicons outline assets on web; the existing Ionicons family on native. Web icon license is bundled.
- Navigation: five signed-in main destinations: Find a ride, Offer a ride, My bookings, Chat and Account. Logout remains a utility action. My rides, Notifications, Vehicles and Help remain accessible from Account. Native/footer navigation retains five destinations.
- Homepage: removed decorative route artwork. No invented personal photography, stock photography, testimonials or customer identities added. Existing product reviews remain data-driven rather than marketing testimonials.
- Accessibility: visible focus indicators, 44-pixel or larger utility touch targets, labeled icon buttons, reduced-motion support and retained system text scaling on native.

## Contrast

Calculated sRGB contrast ratios:

| Text / surface | Ratio |
|---|---:|
| Navy / white | 13.86:1 |
| Blue / white | 5.43:1 |
| Muted text / canvas | 6.29:1 |

These primary text combinations exceed the WCAG AA normal-text 4.5:1 threshold. Disabled controls are intentionally subdued.

## Verification

- 60 web tests and 25 native API tests passed.
- Web production build and native TypeScript checks passed.
- Android and iOS JavaScript bundle exports passed, including the bundled fonts.
- Website audit: 18 route/state cases at 320, 375, 768 and 1280 pixels = 72 checks; 23 internal links verified; zero horizontal-overflow failures and zero uncaught browser errors. Assertions verify Inter and no more than five main navigation links on every case.
- Route cases include home/help/login/register, empty search/results, offer/edit/my rides/ride details/manifest, bookings/detail, profile, vehicles, notifications, chat and custom 404.
- Menu opening/Escape focus/closing, profile save/error messages, email/phone links, favicon, logo home link, footer and logout feedback passed.
- Separate two-account chat test passed: replies/reload, member details, booking via attached ride, demo QR choice and updated seat count.
- Community test passed: unread banners, read acknowledgement, swipe reply, group draft preservation, mute persistence/silence, sort arrows, clear filters, city dropdowns, preference save/reload and matching-ride banner.
- Visual review: desktop/mobile homepage plus mobile chat/help/search/registration screenshots. Browser layout checks cover the full route inventory.

## Limitations and release status

No personal photos were available, so none were inserted. Native OS date pickers and externally controlled authentication UI retain their platform/provider styling.

Physical Android/iOS device checks for font rendering, gestures, keyboard and screen-reader behavior remain pending because no connected device/emulator is available. Native bundle export is not an installed-device test.

No APK was requested or created for this design pass; no live deployment or Git push was performed. Previous route-community backend and migration work remains in the working tree and should ship before its updated clients.

Implementation references: frontend/src/styles/design-system.css, frontend/src/app/Icon.tsx, mobile/src/Typography.tsx and mobile/src/ui.tsx. Local web preview is http://127.0.0.1:5174.
