import type { RumLike } from './transports/agent.ts'

export interface RumEnv {
  VITE_DD_APPLICATION_ID?: string | undefined
  VITE_DD_CLIENT_TOKEN?: string | undefined
  VITE_DD_SITE?: string | undefined
  VITE_DD_SERVICE?: string | undefined
  VITE_DD_ENV?: string | undefined
  VITE_DD_VERSION?: string | undefined
}

export interface RumConfig {
  applicationId: string
  clientToken: string
  site: string
  service: string
  env: string
  version: string
}

/** A RUM plugin, e.g. `reactPlugin()` from `@datadog/browser-rum-react`. */
export type RumPlugin = object

/** The slice of `@datadog/browser-rum` we depend on, so tests can pass a double. */
export interface RumSdk extends RumLike {
  init(config: RumConfig & Record<string, unknown>): void
}

export function rumConfigFromEnv(env: RumEnv): RumConfig | null {
  const applicationId = env.VITE_DD_APPLICATION_ID
  const clientToken = env.VITE_DD_CLIENT_TOKEN
  if (!applicationId || !clientToken) return null

  return {
    applicationId,
    clientToken,
    site: env.VITE_DD_SITE ?? 'datadoghq.com',
    service: env.VITE_DD_SERVICE ?? 'ddog',
    env: env.VITE_DD_ENV ?? 'development',
    // Vite injects the package version at build time; see vite.config.ts `define`.
    version: env.VITE_DD_VERSION ?? '0.0.0',
  }
}

let initialized = false

/** Test seam — resets the once-only guard. */
export function resetRumForTests(): void {
  initialized = false
}

export function initRum(env: RumEnv, sdk: RumSdk, plugins?: RumPlugin[]): RumSdk | undefined {
  const config = rumConfigFromEnv(env)
  if (!config) {
    console.warn(
      '[ddog] Agent mode: RUM is disabled. Set VITE_DD_APPLICATION_ID and VITE_DD_CLIENT_TOKEN in .env to enable it.',
    )
    return undefined
  }

  if (!initialized) {
    initialized = true
    sdk.init({
      ...config,
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackResources: true,
      trackUserInteractions: true,
      trackLongTasks: true,
      defaultPrivacyLevel: 'mask-user-input',
      ...(plugins?.length ? { plugins } : {}),
    })
  }

  return sdk
}
