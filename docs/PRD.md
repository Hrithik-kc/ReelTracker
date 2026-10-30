# ReelMeter Product Requirements Document (PRD)

## Milestone 1: Platform Detection & Adapter Layer

### FR-1: Platform Matching & Support
- The extension detects when a tab is on a supported platform (Instagram).
- Adapters match candidate URLs and reject unsupported domains and paths (e.g. stories).

### FR-3: Candidate Reel Identification & ID Extraction
- Extract a stable Reel ID (shortcode) from:
  1. Direct URL paths (`/reel/<id>/`, `/reels/<id>/`).
  2. Anchor tags linking to the reel inside the active container.
  3. Canonical link tags when on a permalink page.
- Explicitly represent uncertainty: if a candidate video element is present in a reel container but no shortcode can be determined, return `id: null` with `isConfident: false`.

### FR-7: Dynamic Navigation & Feed Observation
- Detect transitions between reels in single-page application (SPA) mode without full page reloads.
- Monitor URL changes (`pushState`, `replaceState`, `popstate`), DOM mutations, and video play events.
- Find the currently active candidate video (playing or centered in the viewport).
- Deduplicate notifications so identical active reels do not trigger duplicate callbacks.
- Ensure proper teardown: unobserving cleans up all event listeners and DOM observers.
