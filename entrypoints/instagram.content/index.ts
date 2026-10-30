export default defineContentScript({
  matches: ['*://*.instagram.com/*'],
  main() {
    console.log('ReelMeter Instagram content script loaded');
  },
});
