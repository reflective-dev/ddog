import ddTrace from 'dd-trace'
import type { TracerLike } from './metrics.ts'

/**
 * APM tracing. dd-trace v5 reads the on/off switch from the environment rather
 * than from `init()`, and defaults to on — so default it to off here and let
 * Agent mode turn it on. `DD_TRACE_DEBUG=true` dumps traces to the console,
 * which is the server-side equivalent of Mock mode.
 */
process.env.DD_TRACE_ENABLED ??= 'false'

export const tracer: TracerLike = ddTrace.init({
  service: process.env.DD_SERVICE ?? 'ddog',
  env: process.env.DD_ENV ?? 'development',
  hostname: process.env.DD_AGENT_HOST ?? '127.0.0.1',
  logInjection: true,
}) as unknown as TracerLike
