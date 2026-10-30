import type {
  ActiveReelChangeCallback,
  CandidateReel,
  PlatformAdapter,
} from '../types';
import { INSTAGRAM_SELECTORS } from './selectors';
import { logger } from '../../lib/logger';

/**
 * Regular expression to extract Instagram Reel shortcodes from URLs.
 * Matches:
 *   /reel/C-abc123/
 *   /reels/C-abc123/
 *   /p/C-abc123/
 */
const REEL_URL_PATTERN = /\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i;

/**
 * Paths that are explicitly NOT reels (e.g. stories, direct messages, settings).
 */
const EXCLUDED_PATHS = ['/stories/', '/direct/', '/accounts/'];

export class InstagramAdapter implements PlatformAdapter {
  readonly id = 'instagram' as const;
  readonly name = 'Instagram';

  /**
   * Determines whether this adapter supports the given URL.
   */
  matches(url: URL): boolean {
    const hostname = url.hostname.toLowerCase();
    const isInstagram =
      hostname === 'instagram.com' || hostname.endsWith('.instagram.com');
    if (!isInstagram) return false;

    const pathname = url.pathname.toLowerCase();
    for (const excluded of EXCLUDED_PATHS) {
      if (pathname.startsWith(excluded)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extracts a Reel ID (shortcode) from a URL if present.
   */
  extractIdFromUrl(url: URL): string | null {
    const match = url.pathname.match(REEL_URL_PATTERN);
    return match && match[1] ? match[1] : null;
  }

  /**
   * Finds the currently active candidate video element.
   * Priority:
   * 1. Currently playing video (!paused && !ended && readyState > 0)
   * 2. Video element closest to the vertical center of the viewport
   */
  getActiveVideo(root?: Document | HTMLElement | null): HTMLVideoElement | null {
    const doc = this.resolveRoot(root);
    if (!doc) return null;

    const videos = Array.from(
      doc.querySelectorAll<HTMLVideoElement>(INSTAGRAM_SELECTORS.VIDEO),
    );

    // Filter out videos inside stories or explicitly hidden elements
    const candidates = videos.filter((video) => {
      if (video.closest(INSTAGRAM_SELECTORS.STORY_CONTAINER)) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      return null;
    }

    // 1. Check for an actively playing video
    const playing = candidates.find(
      (v) => !v.paused && !v.ended && v.readyState > 0,
    );
    if (playing) {
      return playing;
    }

    // 2. Fall back to the video closest to the vertical center of the viewport
    if (typeof window !== 'undefined' && window.innerHeight > 0) {
      const viewportCenter = window.innerHeight / 2;
      let bestVideo: HTMLVideoElement | null = null;
      let minDistance = Number.POSITIVE_INFINITY;

      for (const video of candidates) {
        const rect = video.getBoundingClientRect();
        // Check if video has layout dimensions
        if (rect.height > 0) {
          const videoCenter = rect.top + rect.height / 2;
          const distance = Math.abs(viewportCenter - videoCenter);
          if (distance < minDistance) {
            minDistance = distance;
            bestVideo = video;
          }
        }
      }

      if (bestVideo) {
        return bestVideo;
      }
    }

    // Fallback: return the first eligible candidate
    return candidates[0] ?? null;
  }

  /**
   * Inspects the current page state to identify the active candidate Reel.
   */
  getCandidateReel(root?: Document | HTMLElement | null): CandidateReel | null {
    const currentUrlString =
      typeof window !== 'undefined' ? window.location.href : 'https://www.instagram.com/';
    let currentUrl: URL;
    try {
      currentUrl = new URL(currentUrlString);
    } catch {
      return null;
    }

    if (!this.matches(currentUrl)) {
      return null;
    }

    const doc = this.resolveRoot(root);
    const activeVideo = this.getActiveVideo(doc);

    // Check if the current URL provides a direct reel shortcode
    const urlId = this.extractIdFromUrl(currentUrl);
    const isReelsPath =
      currentUrl.pathname.startsWith('/reel/') ||
      currentUrl.pathname.startsWith('/reels/');

    // Find the container element (article or dialog)
    let containerElement: HTMLElement | null = null;
    if (activeVideo) {
      containerElement = activeVideo.closest<HTMLElement>(
        INSTAGRAM_SELECTORS.REEL_CONTAINER,
      );
    }

    // Extract ID from container links or canonical link if URL didn't have one
    let extractedId = urlId;
    let isConfident = Boolean(urlId);

    if (!extractedId && containerElement) {
      const link = containerElement.querySelector<HTMLAnchorElement>(
        INSTAGRAM_SELECTORS.REEL_LINK,
      );
      if (link?.href) {
        try {
          const linkUrl = new URL(link.href, currentUrl.origin);
          const linkId = this.extractIdFromUrl(linkUrl);
          if (linkId) {
            extractedId = linkId;
            isConfident = true;
          }
        } catch {
          // Ignore invalid link URL
        }
      }
    }

    // If still no ID, check canonical tag on direct reel pages
    if (!extractedId && doc && isReelsPath) {
      const canonical = doc.querySelector<HTMLLinkElement>(
        INSTAGRAM_SELECTORS.CANONICAL_LINK,
      );
      if (canonical?.href) {
        try {
          const canonicalUrl = new URL(canonical.href, currentUrl.origin);
          const canonicalId = this.extractIdFromUrl(canonicalUrl);
          if (canonicalId) {
            extractedId = canonicalId;
            isConfident = true;
          }
        } catch {
          // Ignore invalid canonical URL
        }
      }
    }

    // If we have an active video on a Reels page or inside a Reel container,
    // but couldn't resolve an ID, represent uncertainty explicitly.
    if (!extractedId && (isReelsPath || containerElement)) {
      isConfident = false;
    }

    // If there is neither an active video nor a verified reel URL, no candidate reel exists
    if (!activeVideo && !urlId) {
      return null;
    }

    // If video is present but we are not on a reel page and it has no reel container/id,
    // treat it as an unverified/non-reel video
    if (!isReelsPath && !containerElement && !urlId) {
      return null;
    }

    return {
      platform: this.id,
      id: extractedId,
      isConfident,
      videoElement: activeVideo,
      containerElement,
      url: currentUrlString,
    };
  }

  /**
   * Observes the feed for candidate Reel changes and SPA navigation.
   * Returns a teardown function.
   */
  observeFeed(
    callback: ActiveReelChangeCallback,
    root?: Document | HTMLElement | null,
  ): () => void {
    const doc = this.resolveRoot(root);
    let isCleanedUp = false;
    let scheduledFrameId: number | null = null;
    let scheduledTimeoutId: ReturnType<typeof setTimeout> | null = null;

    let lastCandidateId: string | null = null;
    let lastVideoElement: HTMLVideoElement | null = null;
    let lastIsConfident: boolean | null = null;

    const triggerCheck = () => {
      if (isCleanedUp) return;

      const run = () => {
        if (isCleanedUp) return;
        try {
          const candidate = this.getCandidateReel(doc);

          const currentId = candidate?.id ?? null;
          const currentVideo = candidate?.videoElement ?? null;
          const currentConfident = candidate?.isConfident ?? null;

          // Deduplicate: notify only when active candidate changes
          const hasChanged =
            currentId !== lastCandidateId ||
            currentVideo !== lastVideoElement ||
            currentConfident !== lastIsConfident;

          if (hasChanged) {
            lastCandidateId = currentId;
            lastVideoElement = currentVideo;
            lastIsConfident = currentConfident;

            logger.debug('Active candidate reel changed:', {
              id: currentId,
              isConfident: currentConfident,
              hasVideo: Boolean(currentVideo),
            });

            callback(candidate);
          }
        } catch (error) {
          logger.error('Error during Instagram feed detection check:', error);
        }
      };

      // Throttle rapid calls via requestAnimationFrame or setTimeout
      if (typeof requestAnimationFrame !== 'undefined') {
        if (scheduledFrameId !== null) {
          cancelAnimationFrame(scheduledFrameId);
        }
        scheduledFrameId = requestAnimationFrame(() => {
          scheduledFrameId = null;
          run();
        });
      } else {
        if (scheduledTimeoutId !== null) {
          clearTimeout(scheduledTimeoutId);
        }
        scheduledTimeoutId = setTimeout(() => {
          scheduledTimeoutId = null;
          run();
        }, 16);
      }
    };

    // 1. Initial check
    triggerCheck();

    // 2. SPA History navigation hooks
    let originalPushState: typeof history.pushState | null = null;
    let originalReplaceState: typeof history.replaceState | null = null;

    if (typeof window !== 'undefined' && window.history) {
      originalPushState = window.history.pushState;
      originalReplaceState = window.history.replaceState;

      window.history.pushState = function (...args) {
        originalPushState?.apply(this, args);
        triggerCheck();
      };

      window.history.replaceState = function (...args) {
        originalReplaceState?.apply(this, args);
        triggerCheck();
      };
    }

    // 3. Navigation and interaction event listeners
    const onPopState = () => triggerCheck();
    const onHashChange = () => triggerCheck();
    const onPlayEvent = () => triggerCheck();

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', onPopState);
      window.addEventListener('hashchange', onHashChange);
    }

    if (doc) {
      // 'play' and 'playing' do not bubble, so listen with useCapture = true
      doc.addEventListener('play', onPlayEvent, true);
      doc.addEventListener('playing', onPlayEvent, true);
    }

    // 4. MutationObserver on feed root or document body
    let mutationObserver: MutationObserver | null = null;
    const observerTarget =
      doc?.querySelector(INSTAGRAM_SELECTORS.FEED_ROOT) ??
      (doc instanceof Document ? doc.body : doc) ??
      null;

    if (typeof MutationObserver !== 'undefined' && observerTarget) {
      mutationObserver = new MutationObserver(() => {
        triggerCheck();
      });

      mutationObserver.observe(observerTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'class', 'style'],
      });
    }

    // Cleanup function
    return () => {
      isCleanedUp = true;

      if (scheduledFrameId !== null) {
        cancelAnimationFrame(scheduledFrameId);
        scheduledFrameId = null;
      }
      if (scheduledTimeoutId !== null) {
        clearTimeout(scheduledTimeoutId);
        scheduledTimeoutId = null;
      }

      if (typeof window !== 'undefined' && window.history) {
        if (originalPushState) {
          window.history.pushState = originalPushState;
        }
        if (originalReplaceState) {
          window.history.replaceState = originalReplaceState;
        }
        window.removeEventListener('popstate', onPopState);
        window.removeEventListener('hashchange', onHashChange);
      }

      if (doc) {
        doc.removeEventListener('play', onPlayEvent, true);
        doc.removeEventListener('playing', onPlayEvent, true);
      }

      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }

      logger.debug('Instagram feed observer cleaned up');
    };
  }

  private resolveRoot(root?: Document | HTMLElement | null): Document | HTMLElement | null {
    if (root) return root;
    if (typeof document !== 'undefined') return document;
    return null;
  }
}

export const instagramAdapter = new InstagramAdapter();
