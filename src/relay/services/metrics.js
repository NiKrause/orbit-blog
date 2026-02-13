import http from 'http'
import client from 'prom-client'
import { logger, enable } from '@libp2p/logger'
const log = logger('le-space:relay')
// Singleton instance
let metricsInstance = null;

// Initialize counters
const syncCounter = new client.Counter({
  name: 'orbitdb_sync_total',
  help: 'Total number of OrbitDB synchronization operations',
  labelNames: ['type', 'status']
})

const syncDurationHistogram = new client.Histogram({
  name: 'orbitdb_sync_duration_seconds',
  help: 'Duration of OrbitDB synchronization operations',
  labelNames: ['type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10] // buckets in seconds
})

export class MetricsServer {
  constructor() {
    if (!metricsInstance) {
      // Only collect default metrics once when first instance is created
      if (!client.register.getSingleMetric('process_cpu_user_seconds_total')) {
        client.collectDefaultMetrics()
      }
      metricsInstance = this;
    }
    return metricsInstance;
  }

  async getMetrics() {
    return await client.register.metrics()
  }

  start(port = process.env.METRICS_PORT || 9090) {
    if (process.env.METRICS_DISABLED === 'true' || process.env.METRICS_DISABLED === '1') {
      log('Metrics server disabled (METRICS_DISABLED)')
      return null
    }

    const desiredPort = typeof port === 'string' ? Number(port) : port

    const createServer = () =>
      http.createServer(async (req, res) => {
        if (req.url === '/metrics') {
          res.setHeader('Content-Type', client.register.contentType)
          res.end(await this.getMetrics())
        } else {
          res.statusCode = 404
          res.end('Not found')
        }
      })

    const listen = (p) =>
      new Promise((resolve) => {
        const server = createServer()
        server.on('error', (err) => {
          // Metrics must never crash the relay; it's optional observability.
          if (err?.code === 'EADDRINUSE' && p !== 0) {
            log(`Metrics port ${p} in use; retrying on an ephemeral port`)
            // Retry on an ephemeral port.
            listen(0).then(resolve)
            return
          }
          log('Metrics server failed to start:', err?.message || err)
          resolve(null)
        })

        server.listen(p, () => {
          const addr = server.address()
          const actualPort = (addr && typeof addr === 'object') ? addr.port : p
          log(`Metrics server listening on port ${actualPort}`)
          resolve(server)
        })
      })

    return listen(Number.isFinite(desiredPort) ? desiredPort : 9090)
  }

  // Helper methods for tracking sync operations
  trackSync(type, status = 'success') {
    syncCounter.labels(type, status).inc()
  }

  startSyncTimer(type) {
    return syncDurationHistogram.startTimer({ type })
  }
}
