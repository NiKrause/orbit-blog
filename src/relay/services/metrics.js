import http from 'http'
import client from 'prom-client'

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
    const server = http.createServer(async (req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', client.register.contentType)
        res.end(await this.getMetrics())
      } else {
        res.statusCode = 404
        res.end('Not found')
      }
    })

    server.listen(port, () => {
      log(`Metrics server listening on port ${port}`)
    })
  }

  // Helper methods for tracking sync operations
  trackSync(type, status = 'success') {
    syncCounter.labels(type, status).inc()
  }

  startSyncTimer(type) {
    return syncDurationHistogram.startTimer({ type })
  }
}