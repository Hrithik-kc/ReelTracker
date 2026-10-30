import { instagramAdapter } from '../../src/adapters/instagram/adapter';
import { logger } from '../../src/lib/logger';
import type { CandidateReel } from '../../src/adapters/types';

export default defineContentScript({
  matches: ['*://*.instagram.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    const currentUrl = new URL(window.location.href);
    if (!instagramAdapter.matches(currentUrl)) {
      logger.debug('Instagram content script loaded on unsupported path:', currentUrl.pathname);
      return;
    }

    logger.info('Initializing Instagram Reel detection...');

    const handleCandidateChange = (candidate: CandidateReel | null) => {
      if (!candidate) {
        logger.info('No active candidate Reel detected.');
        return;
      }

      if (candidate.isConfident && candidate.id) {
        logger.info('Active candidate Reel detected:', {
          id: candidate.id,
          isConfident: candidate.isConfident,
          url: candidate.url,
        });
      } else {
        logger.warn('Candidate Reel detected with uncertain or missing ID:', {
          isConfident: candidate.isConfident,
          hasVideo: Boolean(candidate.videoElement),
          url: candidate.url,
        });
      }
    };

    const cleanup = instagramAdapter.observeFeed(handleCandidateChange);

    // Teardown when content script is invalidated (e.g. extension update or reload)
    ctx.onInvalidated?.(() => {
      logger.debug('Context invalidated, cleaning up Instagram feed observer');
      cleanup();
    });

    window.addEventListener(
      'beforeunload',
      () => {
        cleanup();
      },
      { once: true },
    );
  },
});
