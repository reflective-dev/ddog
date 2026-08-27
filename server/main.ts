import StatsD from 'hot-shots'
import { buildServer } from './app.ts'
import { StatsdSink } from './metrics.ts'
import { tracer } from './tracer.ts'

const PORT = Number(process.env.BFF_PORT ?? 8787)
const DD_AGENT_HOST = process.env.DD_AGENT_HOST ?? '127.0.0.1'
const DD_DOGSTATSD_PORT = Number(process.env.DD_DOGSTATSD_PORT ?? 8125)

const statsd = new StatsD({
  host: DD_AGENT_HOST,
  port: DD_DOGSTATSD_PORT,
  globalTags: {
    service: process.env.DD_SERVICE ?? 'ddog',
    env: process.env.DD_ENV ?? 'development',
  },
  // UDP is fire-and-forget; never let a missing agent take the BFF down.
  errorHandler: (error) => console.warn('[ddog:statsd]', error.message),
})

const app = await buildServer({ sink: new StatsdSink(statsd, tracer), logger: true })

await app.listen({ port: PORT, host: '0.0.0.0' })
console.log(
  `[ddog:bff] listening on :${PORT} → DogStatsD ${DD_AGENT_HOST}:${DD_DOGSTATSD_PORT}`,
)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0))
  })
}
