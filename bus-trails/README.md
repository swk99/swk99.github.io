# London Bus Trails

Static London bus-only route comparison for Sunnu’s Little World, served at `/bus-trails/`.

## Run and test

Serve the repository with `python3 -m http.server 8000`, then open `/bus-trails/`.
Run the provider-normalization and routing-invariant tests with `node --test bus-trails/core.test.mjs` from the repository root.

## Providers and configuration

TfL Journey Planner is requested directly from the browser, with `mode=bus`, `maxWalkingMinutes` and `maxTransferMinutes`, London-local departure time, and three variants: LeastTime with walking optimization, LeastTime without it, and LeastInterchange. A search makes up to three TfL requests. A disambiguation response stops the search until the visitor explicitly selects locations. Both providers then receive the selected place coordinates: TfL station/ICS IDs can expand into a larger interchange and omit the walk from the selected point. An optional TfL `app_key` can be entered in the app settings if required by TfL or its usage limits.

Google is optional until a visitor supplies their own browser API key through **지도 연결**. Enable Maps JavaScript API and Routes API with billing. Restrict the key to `https://swk99.github.io/*` and those two APIs; add localhost explicitly only for local development. Never commit a key. Keys are stored in the current tab's sessionStorage; clearing/changing an already-loaded Google key reloads the page to reset its SDK. Location/search history is not stored by this app. Each search makes up to two Google computeRoutes requests (BUS preference, then BUS with FEWER_TRANSFERS), plus the normal map load. Use Cloud quotas and billing alerts to manage costs.

Google uses the Maps JavaScript `routes` library, not legacy DirectionsService. Google BUS is a preference rather than a guarantee, so **every returned step is checked**. Google geometry is only drawn on a Google map; TfL-only mode has a clearly labelled geometry overview and external walking-segment links. Google API integration requires a real key for end-to-end verification; no key is included in the repository.

## Ranking contract

- Every candidate must contain a bus and only bus/walking segments, with known nonnegative durations.
- The walking limit is the sum of all initial, transfer, and final walking, preserving fractional minutes. Default: 30 minutes.
- Sort by estimated arrival relative to the requested departure, including initial and transfer waits. Deduplicate each provider's identical bus/arrival alternatives.
- TfL times are interpreted in Europe/London, independently of the browser's timezone, including BST/GMT. TfL's unzoned repeated DST hour is resolved using the request context; extreme journeys crossing the repeated hour can remain ambiguous in the upstream feed.
- This compares candidates returned by the providers. It is not an exhaustive search of every possible walking/bus-stop combination, nor a guarantee of the global shortest path. Traffic, live service changes, walking speed, and provider coverage affect results.
- Unknown modes/durations are rejected, errors are shown, partial provider results are labelled, and stale search responses cannot replace results for newly entered conditions.

## API references

- https://api.tfl.gov.uk/swagger/docs/v1 (Journey/JourneyResults)
- https://developers.google.com/maps/documentation/javascript/routes/route-transit
- https://developers.google.com/maps/documentation/javascript/reference/route
- https://developers.google.com/maps/documentation/javascript/routes/start
