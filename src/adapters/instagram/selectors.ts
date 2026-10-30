/**
 * Centralized DOM selectors for Instagram.
 * ALL Instagram-specific DOM selectors must live here and nowhere else.
 */
export const INSTAGRAM_SELECTORS = {
  /** Video element selector */
  VIDEO: 'video',

  /** Top-level containers that can hold a reel post or modal */
  REEL_CONTAINER: 'article, [role="dialog"], [data-blade-container="true"]',

  /** Links to reels or posts inside the active container */
  REEL_LINK: 'a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]',

  /** Canonical link tag for permalink pages */
  CANONICAL_LINK: 'link[rel="canonical"]',

  /** Story containers that should be explicitly excluded from reel candidate detection */
  STORY_CONTAINER: '[aria-label*="Story"], [data-story-id], [class*="Story"]',

  /** Main feed container to observe for mutations */
  FEED_ROOT: 'main, [role="main"]',
} as const;
