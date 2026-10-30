import type { PlatformAdapter } from './types';
import { instagramAdapter } from './instagram/adapter';

const adapters: PlatformAdapter[] = [instagramAdapter];

/**
 * Registers an adapter with the global registry.
 */
export function registerAdapter(adapter: PlatformAdapter): void {
  const existingIndex = adapters.findIndex((a) => a.id === adapter.id);
  if (existingIndex >= 0) {
    adapters[existingIndex] = adapter;
  } else {
    adapters.push(adapter);
  }
}

/**
 * Finds the appropriate adapter for a given URL string or URL object.
 */
export function getAdapterForUrl(url: URL | string): PlatformAdapter | null {
  let parsedUrl: URL;
  try {
    parsedUrl = typeof url === 'string' ? new URL(url) : url;
  } catch {
    return null;
  }

  for (const adapter of adapters) {
    if (adapter.matches(parsedUrl)) {
      return adapter;
    }
  }

  return null;
}

/**
 * Returns all currently registered adapters.
 */
export function getAllAdapters(): readonly PlatformAdapter[] {
  return adapters;
}
