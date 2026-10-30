export type PlatformId = 'instagram' | 'youtube' | 'facebook';

/**
 * Represents a candidate short-form video (Reel) detected in the DOM.
 */
export interface CandidateReel {
  /** The platform on which the candidate was detected */
  platform: PlatformId;
  
  /**
   * The extracted stable Reel identifier (e.g. Instagram shortcode).
   * Null if the element is a candidate Reel but an identifier cannot be reliably determined.
   */
  id: string | null;
  
  /**
   * True if the ID was reliably confirmed from URL or verified DOM anchor/canonical links.
   * False if detection is uncertain or ID is missing.
   */
  isConfident: boolean;
  
  /**
   * The candidate HTMLVideoElement currently active.
   */
  videoElement: HTMLVideoElement | null;
  
  /**
   * The containing DOM element for this Reel (e.g. article / container), if any.
   */
  containerElement: HTMLElement | null;
  
  /**
   * The URL at the time of detection.
   */
  url: string;
}

/**
 * Callback invoked when the active candidate Reel changes or is cleared.
 */
export type ActiveReelChangeCallback = (candidate: CandidateReel | null) => void;

/**
 * Interface that all platform-specific adapters must implement.
 */
export interface PlatformAdapter {
  readonly id: PlatformId;
  readonly name: string;

  /**
   * Determines whether this adapter supports the given URL.
   */
  matches(url: URL): boolean;

  /**
   * Extracts a Reel ID directly from a URL if present, or null.
   */
  extractIdFromUrl(url: URL): string | null;

  /**
   * Finds the currently active candidate Reel on the page.
   */
  getCandidateReel(root?: Document | HTMLElement | null): CandidateReel | null;

  /**
   * Finds the currently active video element.
   */
  getActiveVideo(root?: Document | HTMLElement | null): HTMLVideoElement | null;

  /**
   * Observes the feed for candidate Reel changes and SPA navigation.
   * Returns a teardown function to clean up observers and listeners.
   */
  observeFeed(callback: ActiveReelChangeCallback, root?: Document | HTMLElement | null): () => void;
}
