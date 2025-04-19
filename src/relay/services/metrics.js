import http from 'http'
import client from 'prom-client'

export class MetricsServer {
  constructor() {
    this.orbitdbCounter = new client.Counter({
      name: 'orbitdb_databases_total',
      help: 'Total number of OrbitDB databases opened',
      labelNames: ['type']
    })
    this.identityGauge = new client.Gauge({
      name: 'orbitdb_identity_databases_total',
      help: 'Total number of OrbitDB databases opened per identity',
      labelNames: ['identity']
    })
    this.postsGauge = new client.Gauge({
      name: 'orbitdb_posts_total',
      help: 'Total number of posts currently in the database',
      labelNames: ['database_address']
    })
    
    this.postSizeHistogram = new client.Histogram({
      name: 'orbitdb_post_size_bytes',
      help: 'Distribution of post sizes in bytes',
      buckets: [100, 500, 1000, 5000, 10000],
      labelNames: ['database_address']
    })
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
      console.log(`Metrics server listening on port ${port}`)
    })
  }
}
