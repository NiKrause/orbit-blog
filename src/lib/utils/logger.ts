import { logger } from '@libp2p/logger'

const log = logger('le-space:blog')

export const debug = (message: string, ...args: any[]) => {
  log(message, ...args)
}

export const info = (message: string, ...args: any[]) => {
  log(message, ...args)
}

export const warn = (message: string, ...args: any[]) => {
  log.error(message, ...args)
}

export const error = (message: string, ...args: any[]) => {
  log.error(message, ...args)
}

export default {
  debug,
  info,
  warn,
  error
} 