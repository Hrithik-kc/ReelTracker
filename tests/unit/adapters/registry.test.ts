import { describe, it, expect } from 'vitest';
import {
  getAdapterForUrl,
  getAllAdapters,
  registerAdapter,
} from '../../../src/adapters/registry';
import { instagramAdapter } from '../../../src/adapters/instagram/adapter';
import type { PlatformAdapter } from '../../../src/adapters/types';

describe('Adapter Registry', () => {
  it('pre-registers InstagramAdapter and resolves it for Instagram URLs', () => {
    const adapters = getAllAdapters();
    expect(adapters).toContain(instagramAdapter);

    const adapter = getAdapterForUrl('https://www.instagram.com/reels/');
    expect(adapter).toBe(instagramAdapter);
  });

  it('returns null for unregistered platform URLs', () => {
    const adapter = getAdapterForUrl('https://www.tiktok.com/@user/video/123');
    expect(adapter).toBeNull();
  });

  it('allows registering custom or new adapters', () => {
    const mockYouTubeAdapter: PlatformAdapter = {
      id: 'youtube',
      name: 'YouTube',
      matches: (url: URL) => url.hostname.includes('youtube.com'),
      extractIdFromUrl: () => 'yt-test',
      getCandidateReel: () => null,
      getActiveVideo: () => null,
      observeFeed: () => () => {},
    };

    registerAdapter(mockYouTubeAdapter);
    const resolved = getAdapterForUrl('https://www.youtube.com/shorts/test');
    expect(resolved).toBe(mockYouTubeAdapter);
  });
});

