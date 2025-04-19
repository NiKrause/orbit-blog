import { logger, enable } from '@libp2p/logger'

export const log = logger('le-space:relay')
enable("le-space:relay:*")

export const debug = (message, ...args) => {
  console.log(message, ...args)
}

export const info = (message, ...args) => {
  console.log(message, ...args)
}
