import { logger } from '@libp2p/logger'

// Enable debug logging in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  // Check if debug is already set, if not set it for this app
  if (!localStorage.debug || !localStorage.debug.includes('le-space:blog')) {
    const currentDebug = localStorage.debug || '';
    const newDebug = currentDebug ? `${currentDebug},le-space:blog*` : 'le-space:blog*';
    localStorage.debug = newDebug;
  }
}

const log = logger('le-space:blog')

const addTimestamp = (message: string) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${message}`;
};

export const debug = (message: string, ...args: any[]) => {
  log(addTimestamp(message), ...args)
}

export const info = (message: string, ...args: any[]) => {
  log(addTimestamp(message), ...args)
}

export const warn = (message: string, ...args: any[]) => {
  log.error(addTimestamp(message), ...args)
}

export const error = (message: string, ...args: any[]) => {
  log.error(addTimestamp(message), ...args)
}

export default {
  debug,
  info,
  warn,
  error
} 