# Ride and chat local QA — 18 November 2026

Passed: compact ride search with real isolated backend, Office/Home route filtering, sorting, seat/edit preservation, simulated location grant/deny and horizontal overflow checks at 320/390/768/1440px.

Passed: two separate browser users, email/mobile password login, incoming phone label, own sender header absent, no own Message sent notice, single own bubble, member detail privacy, shared ride booking, live seat count, quoted reply/cancel/reload persistence, phone navigation and chat overflow.

Frontend production build and mobile TypeScript checks passed. Fixed duplicate useRef import/declaration which had blocked native compilation.

Preview: .local/ride-search-phone-results.png and .local/chat-phone-preview.png. Test script: scripts/browser-chat-preview.cjs. All fixtures are local QA data; no live messages or database changes.

Not verified here: native Android touch gestures, device contact permission/name lookup, background push, real Google login, real payment gateways. This browser run is not APK testing. No deployment or new APK was created.
