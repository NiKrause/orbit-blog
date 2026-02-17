import { logger } from '@libp2p/logger'

type LogCategory =
  | 'app'
  | 'p2p'
  | 'db'
  | 'ui'
  | 'settings'
  | 'media'
  | 'comments'
  | 'posts'
  | 'translation'
  | 'security'

const ROOT_NAMESPACE = 'le-space:blog'

const categoryIcons: Record<LogCategory, string> = {
  app: '🌈',
  p2p: '🛰️',
  db: '🗄️',
  ui: '🎨',
  settings: '⚙️',
  media: '🖼️',
  comments: '💬',
  posts: '📝',
  translation: '🌍',
  security: '🔐'
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'trace'

const withPrefix = (category: LogCategory, level: LogLevel, message: string) => {
  const timestamp = new Date().toISOString()
  const icon = categoryIcons[category]
  const levelTag = level.toUpperCase()
  return `[${timestamp}] ${icon} [${category}] [${levelTag}] ${message}`
}

const asMessage = (message: unknown): string => {
  if (typeof message === 'string') return message
  if (message instanceof Error) return message.message
  return String(message)
}

export interface CategoryLogger {
  debug: (message: unknown, ...args: unknown[]) => void
  info: (message: unknown, ...args: unknown[]) => void
  warn: (message: unknown, ...args: unknown[]) => void
  error: (message: unknown, ...args: unknown[]) => void
  trace: (message: unknown, ...args: unknown[]) => void
}

export const createLogger = (category: LogCategory): CategoryLogger => {
  const base = logger(`${ROOT_NAMESPACE}:${category}`)

  return {
    debug: (message: unknown, ...args: unknown[]) => {
      base(withPrefix(category, 'debug', asMessage(message)), ...args)
    },
    info: (message: unknown, ...args: unknown[]) => {
      base(withPrefix(category, 'info', asMessage(message)), ...args)
    },
    warn: (message: unknown, ...args: unknown[]) => {
      base.error(withPrefix(category, 'warn', asMessage(message)), ...args)
    },
    error: (message: unknown, ...args: unknown[]) => {
      base.error(withPrefix(category, 'error', asMessage(message)), ...args)
    },
    trace: (message: unknown, ...args: unknown[]) => {
      base.trace(withPrefix(category, 'trace', asMessage(message)), ...args)
    }
  }
}

const appLog = createLogger('app')

// Backward-compatible exports used across the project
export const debug = (message: unknown, ...args: unknown[]) => appLog.debug(message, ...args)
export const info = (message: unknown, ...args: unknown[]) => appLog.info(message, ...args)
export const warn = (message: unknown, ...args: unknown[]) => appLog.warn(message, ...args)
export const error = (message: unknown, ...args: unknown[]) => appLog.error(message, ...args)

export const p2pLog = createLogger('p2p')
export const dbLog = createLogger('db')
export const uiLog = createLogger('ui')
export const settingsLog = createLogger('settings')
export const mediaLog = createLogger('media')
export const commentsLog = createLogger('comments')
export const postsLog = createLogger('posts')
export const translationLog = createLogger('translation')
export const securityLog = createLogger('security')

export default {
  createLogger,
  debug,
  info,
  warn,
  error,
  p2pLog,
  dbLog,
  uiLog,
  settingsLog,
  mediaLog,
  commentsLog,
  postsLog,
  translationLog,
  securityLog
}
