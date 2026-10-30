export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'undefined'
  ? process.env.NODE_ENV !== 'production'
  : (import.meta as unknown as { env?: { DEV?: boolean } })?.env?.DEV ?? true;

function formatPrefix(level: LogLevel): string {
  return `[ReelMeter][${level.toUpperCase()}]`;
}

export const logger = {
  debug(...args: unknown[]): void {
    if (isDev) {
      console.debug(formatPrefix('debug'), ...args);
    }
  },
  info(...args: unknown[]): void {
    if (isDev) {
      console.info(formatPrefix('info'), ...args);
    }
  },
  warn(...args: unknown[]): void {
    console.warn(formatPrefix('warn'), ...args);
  },
  error(...args: unknown[]): void {
    console.error(formatPrefix('error'), ...args);
  },
};
