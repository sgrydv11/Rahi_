# Compact ride search — 17 November 2026

Implemented in web and native source:

- Office selects HOME_TO_OFFICE; Home selects OFFICE_TO_HOME. Search sends this
  preference to the backend, which filters stored ride preferences. Existing
  clients without this field keep their original behavior. Legacy rides without
  preferences remain Other. No database migration is needed.
- Use current city asks for foreground device/browser location only on tap.
  Nearby-city matching runs on device for Indore, Ujjain, Dewas and Pithampur,
  within 25 km of the nearest configured city center. This is approximate, not a
  city-boundary service. Outside that area, permission denial and failures leave
  manual city entry available. Coordinates are not sent to an external geocoder
  or saved by this implementation. No background tracking was added.
- Results have no visible Find a ride title. Route/date/seats appear together,
  with an edit icon beside the seat count. Editing preserves route, date, seats
  and commute preference. Passenger names/details elsewhere are unchanged.
- Sort opens a panel like Filters. Time, price and rating retain both sort
  directions. The duplicate flexible-dropoff shortcut was removed from the
  toolbar; its filter remains available inside Filters.
- Tighter gaps, card padding, compact typography and removal of repeated fare/date
  rows reduce result-card height. Card content can still grow for accessibility
  and reviews. Non-search ride cards retain departure dates.

Validation: 69 web tests, 33 native tests, native TypeScript, production web build,
Android/iOS JS exports, and 25 targeted backend ride tests passed. A local Chrome
test exercised real Office/Home filtering, simulated location allow/deny, manual
fallback, sorting, edit/seat preservation and widths 320/390/768/1440. Preview
accounts/rides were local QA fixtures; no live customer data was changed.

Phone previews from the actual web implementation:

- `.local/ride-search-phone-results.png`
- `.local/ride-search-phone-form.png`

This is a source/local-preview update. Native expo-location was added at the SDK
54-compatible version and needs a new native build when requested. Physical GPS
permission behavior has not been tested on a connected phone. No APK was built
as part of this UI-only request, and these changes are not claimed deployed.
