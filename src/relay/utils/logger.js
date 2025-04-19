import { logger, enable } from '@libp2p/logger'

export const log = logger('le-space:relay')
enable("le-space:relay:*")
export const info = logger('le-space:relay')
enable("le-space:relay:*")