import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InstagramAdapter, instagramAdapter } from '../../../src/adapters/instagram/adapter';
import { INSTAGRAM_SELECTORS } from '../../../src/adapters/instagram/selectors';

describe('InstagramAdapter', () => {
  let adapter: InstagramAdapter;
  let container: HTMLDivElement;

  beforeEach(() => {
    adapter = new InstagramAdapter();
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('1. Supported vs Unsupported URLs (FR-1)', () => {
    it('matches supported Instagram URLs', () => {
      expect(adapter.matches(new URL('https://www.instagram.com/reels/'))).toBe(true);
      expect(adapter.matches(new URL('https://instagram.com/reel/C-abc123/'))).toBe(true);
      expect(adapter.matches(new URL('https://www.instagram.com/p/C-xyz789/'))).toBe(true);
      expect(adapter.matches(new URL('https://www.instagram.com/explore/'))).toBe(true);
      expect(adapter.matches(new URL('https://www.instagram.com/someuser/reels/'))).toBe(true);
    });

    it('rejects unsupported domains', () => {
      expect(adapter.matches(new URL('https://www.youtube.com/shorts/123'))).toBe(false);
      expect(adapter.matches(new URL('https://facebook.com/watch/'))).toBe(false);
      expect(adapter.matches(new URL('https://example.com/'))).toBe(false);
    });

    it('rejects excluded Instagram paths such as stories and direct messages', () => {
      expect(adapter.matches(new URL('https://www.instagram.com/stories/username/12345/'))).toBe(false);
      expect(adapter.matches(new URL('https://www.instagram.com/direct/t/12345/'))).toBe(false);
      expect(adapter.matches(new URL('https://www.instagram.com/accounts/edit/'))).toBe(false);
    });
  });

  describe('2. Reel ID extraction from URL (FR-3)', () => {
    it('extracts shortcodes from /reel/, /reels/, and /p/ paths', () => {
      expect(adapter.extractIdFromUrl(new URL('https://www.instagram.com/reel/DA12345bc/'))).toBe('DA12345bc');
      expect(adapter.extractIdFromUrl(new URL('https://www.instagram.com/reels/XYZ_987/'))).toBe('XYZ_987');
      expect(adapter.extractIdFromUrl(new URL('https://www.instagram.com/p/PostReel_01/'))).toBe('PostReel_01');
    });

    it('returns null when URL has no shortcode', () => {
      expect(adapter.extractIdFromUrl(new URL('https://www.instagram.com/reels/'))).toBeNull();
      expect(adapter.extractIdFromUrl(new URL('https://www.instagram.com/explore/'))).toBeNull();
      expect(adapter.extractIdFromUrl(new URL('https://www.instagram.com/'))).toBeNull();
    });
  });

  describe('3. Candidate Reel identification with recognizable identifier (FR-3)', () => {
    it('detects a candidate Reel from an in-page container link', () => {
      // Mock window location on the reels feed
      window.history.replaceState(null, '', 'https://www.instagram.com/reels/');

      const article = document.createElement('article');
      const video = document.createElement('video');
      const link = document.createElement('a');
      link.href = '/reel/IN_PAGE_SHORTCODE/';

      article.appendChild(video);
      article.appendChild(link);
      container.appendChild(article);

      const candidate = adapter.getCandidateReel(container);
      expect(candidate).not.toBeNull();
      expect(candidate?.platform).toBe('instagram');
      expect(candidate?.id).toBe('IN_PAGE_SHORTCODE');
      expect(candidate?.isConfident).toBe(true);
      expect(candidate?.videoElement).toBe(video);
      expect(candidate?.containerElement).toBe(article);
    });

    it('identifies canonical link as fallback ID source', () => {
      window.history.replaceState(null, '', 'https://www.instagram.com/reels/');

      const canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = 'https://www.instagram.com/reel/CANONICAL_ID_789/';
      document.head.appendChild(canonical);

      const article = document.createElement('article');
      const video = document.createElement('video');
      article.appendChild(video);
      container.appendChild(article);

      const candidate = adapter.getCandidateReel(document);
      expect(candidate).not.toBeNull();
      expect(candidate?.id).toBe('CANONICAL_ID_789');
      expect(candidate?.isConfident).toBe(true);

      document.head.removeChild(canonical);
    });
  });

  describe('4. Video element that cannot be confidently identified as a Reel', () => {
    it('represents uncertainty explicitly when on Reels path but no ID can be found', () => {
      window.history.replaceState(null, '', 'https://www.instagram.com/reels/');

      const article = document.createElement('article');
      const video = document.createElement('video');
      article.appendChild(video);
      container.appendChild(article);

      const candidate = adapter.getCandidateReel(container);
      expect(candidate).not.toBeNull();
      expect(candidate?.id).toBeNull();
      expect(candidate?.isConfident).toBe(false);
      expect(candidate?.videoElement).toBe(video);
    });

    it('ignores video elements inside story containers', () => {
      window.history.replaceState(null, '', 'https://www.instagram.com/reels/');

      const storyContainer = document.createElement('div');
      storyContainer.setAttribute('aria-label', 'Story by testuser');
      const storyVideo = document.createElement('video');
      storyContainer.appendChild(storyVideo);
      container.appendChild(storyContainer);

      expect(adapter.getActiveVideo(container)).toBeNull();
      expect(adapter.getCandidateReel(container)).toBeNull();
    });

    it('returns null for videos in unrelated non-reel pages without reel containers or URL shortcode', () => {
      window.history.replaceState(null, '', 'https://www.instagram.com/settings/');
      const video = document.createElement('video');
      container.appendChild(video);

      expect(adapter.getCandidateReel(container)).toBeNull();
    });
  });

  describe('5. Navigation between two Reels without full page reload (FR-7)', () => {
    it('detects URL change via pushState and notifies callback with new Reel', () => {
      window.history.replaceState(null, '', 'https://www.instagram.com/reel/REEL_FIRST/');
      const video = document.createElement('video');
      container.appendChild(video);

      const callback = vi.fn();
      const cleanup = adapter.observeFeed(callback, container);

      // Advance initial check
      vi.advanceTimersByTime(20);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'REEL_FIRST', isConfident: true }),
      );

      // Simulate SPA navigation to second Reel
      window.history.pushState(null, '', 'https://www.instagram.com/reel/REEL_SECOND/');
      vi.advanceTimersByTime(20);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'REEL_SECOND', isConfident: true }),
      );

      cleanup();
    });
  });

  describe('6. Repeated DOM mutations without duplicate notifications (FR-7)', () => {
    it('does not invoke callback when mutations do not change active Reel', () => {
      window.history.replaceState(null, '', 'https://www.instagram.com/reel/STABLE_REEL/');
      const article = document.createElement('article');
      const video = document.createElement('video');
      article.appendChild(video);
      container.appendChild(article);

      const callback = vi.fn();
      const cleanup = adapter.observeFeed(callback, container);

      vi.advanceTimersByTime(20);
      expect(callback).toHaveBeenCalledTimes(1);

      // Mutate unrelated DOM element inside container
      const extraDiv = document.createElement('div');
      extraDiv.textContent = 'like count updated';
      article.appendChild(extraDiv);

      vi.advanceTimersByTime(50);
      // Callback should still have been called only once!
      expect(callback).toHaveBeenCalledTimes(1);

      cleanup();
    });
  });

  describe('7. Missing video elements or missing Reel IDs', () => {
    it('detects candidate Reel when URL is direct /reel/ but video element is not yet attached', () => {
      window.history.replaceState(null, '', 'https://www.instagram.com/reel/BUFFERING_REEL/');

      const candidate = adapter.getCandidateReel(container);
      expect(candidate).not.toBeNull();
      expect(candidate?.id).toBe('BUFFERING_REEL');
      expect(candidate?.isConfident).toBe(true);
      expect(candidate?.videoElement).toBeNull();
    });

    it('returns null when document is empty and URL has no reel ID', () => {
      window.history.replaceState(null, '', 'https://www.instagram.com/explore/');
      expect(adapter.getCandidateReel(container)).toBeNull();
    });
  });

  describe('8. Observer cleanup (FR-7)', () => {
    it('restores original history functions and ceases notifications after cleanup', () => {
      const origPush = window.history.pushState;
      const callback = vi.fn();
      const cleanup = adapter.observeFeed(callback, container);

      expect(window.history.pushState).not.toBe(origPush);

      cleanup();
      expect(window.history.pushState).toBe(origPush);

      // Further navigation should not trigger callback
      window.history.pushState(null, '', 'https://www.instagram.com/reel/AFTER_CLEANUP/');
      vi.advanceTimersByTime(50);

      // Should not have been called with the after-cleanup reel
      expect(callback).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'AFTER_CLEANUP' }),
      );
    });
  });

  describe('9. Rapid navigation between candidate Reels', () => {
    it('handles rapid sequential pushState calls cleanly and settles on the latest Reel', () => {
      window.history.replaceState(null, '', 'https://www.instagram.com/reels/');
      const video = document.createElement('video');
      container.appendChild(video);

      const callback = vi.fn();
      const cleanup = adapter.observeFeed(callback, container);

      // Rapidly change history multiple times before timer ticks
      window.history.pushState(null, '', 'https://www.instagram.com/reel/RAPID_1/');
      window.history.pushState(null, '', 'https://www.instagram.com/reel/RAPID_2/');
      window.history.pushState(null, '', 'https://www.instagram.com/reel/RAPID_FINAL/');

      vi.advanceTimersByTime(50);

      const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
      expect(lastCall).toBeDefined();
      expect(lastCall![0]).toEqual(
        expect.objectContaining({ id: 'RAPID_FINAL', isConfident: true }),
      );

      cleanup();
    });
  });

  describe('Active video selection priorities', () => {
    it('prioritizes playing video over paused video', () => {
      const video1 = document.createElement('video');
      const video2 = document.createElement('video');

      // video1 paused
      Object.defineProperty(video1, 'paused', { value: true, configurable: true });
      Object.defineProperty(video1, 'ended', { value: false, configurable: true });
      Object.defineProperty(video1, 'readyState', { value: 4, configurable: true });

      // video2 playing
      Object.defineProperty(video2, 'paused', { value: false, configurable: true });
      Object.defineProperty(video2, 'ended', { value: false, configurable: true });
      Object.defineProperty(video2, 'readyState', { value: 4, configurable: true });

      container.appendChild(video1);
      container.appendChild(video2);

      const active = adapter.getActiveVideo(container);
      expect(active).toBe(video2);
    });
  });
});
