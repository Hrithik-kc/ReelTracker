# Adapter Guide: Adding a Platform Adapter

ReelMeter uses a modular adapter architecture to detect short-form videos across different platforms.

## Core Concepts

Every platform adapter implements the `PlatformAdapter` interface defined in `src/adapters/types.ts`:

- **Platform Matching (`matches`)**: Checks whether a given URL belongs to the platform and is a supported page (e.g. `instagram.com`).
- **Candidate Reel Detection (`getCandidateReel`)**: Identifies the currently active candidate video and reel container, extracting a stable ID if available.
- **Active Video Selection (`getActiveVideo`)**: Identifies which video element in the DOM is currently visible and active/playing.
- **Dynamic Feed Observation (`observeFeed`)**: Monitors DOM mutations, SPA navigation (History API, popstate), and playback events, invoking a callback whenever the active candidate Reel changes. Returns a cleanup function.

## Rules for Platform Adapters

1. **Centralize All Selectors**: Keep all platform-specific DOM selectors in `src/adapters/<platform>/selectors.ts`. Never leak platform selectors into core logic or UI.
2. **Handle Uncertainty**: Do not invent reel IDs. If an ID cannot be extracted with high confidence, set `id: null` and `isConfident: false`.
3. **Avoid False Positives**: Do not treat every video element as a Reel (e.g. Instagram Stories, live streams, or profile previews).
4. **Idempotence & Deduplication**: Do not trigger repeated callbacks when the active reel has not changed.
5. **Safe DOM Access**: Guard against missing elements, detached nodes, or unexpected DOM mutations.
6. **Complete Cleanup**: The cleanup function returned by `observeFeed` must restore patched methods, disconnect observers, and remove all event listeners.
