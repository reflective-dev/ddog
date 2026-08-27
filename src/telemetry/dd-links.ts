/**
 * Deep links into the Datadog UI for the places this app's telemetry lands.
 *
 * The two halves of Agent mode surface in different products: browser RUM under
 * Digital Experience, and the BFF's DogStatsD metrics and APM spans under
 * Metrics and APM.
 */

export interface LinksEnv {
  VITE_DD_SITE?: string | undefined
  VITE_DD_SERVICE?: string | undefined
  VITE_DD_ENV?: string | undefined
  VITE_DD_APPLICATION_ID?: string | undefined
  /** The BFF's service name, matching DD_SERVICE on the server. */
  VITE_DD_BFF_SERVICE?: string | undefined
}

export interface DatadogLink {
  label: string
  description: string
  href: string
}

/**
 * Intake sites and UI hosts differ. `datadoghq.com` and `datadoghq.eu` take an
 * `app.` prefix, while the regional sites (`us3.`, `us5.`, `ap1.`, …) are
 * already the UI host.
 */
export function appHost(site: string | undefined): string {
  const resolved = site ?? 'datadoghq.com'
  const prefixed = ['datadoghq.com', 'datadoghq.eu', 'ddog-gov.com']
  return prefixed.includes(resolved) ? `https://app.${resolved}` : `https://${resolved}`
}

function url(host: string, path: string, params: Record<string, string>): string {
  // Built by hand rather than with URLSearchParams, which encodes spaces as
  // "+". That is only unambiguous in form submissions; "%20" reads the same
  // either way, and these queries are full of spaces.
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return `${new URL(path, host).toString()}?${query}`
}

export function datadogLinks(env: LinksEnv): DatadogLink[] {
  const host = appHost(env.VITE_DD_SITE)
  const rumService = env.VITE_DD_SERVICE ?? 'ddog-web'
  const bffService = env.VITE_DD_BFF_SERVICE ?? 'ddog'
  const ddEnv = env.VITE_DD_ENV ?? 'development'
  const appId = env.VITE_DD_APPLICATION_ID

  // Scope RUM views to this application when its id is known.
  const application = appId ? ` @application.id:${appId}` : ''

  return [
    {
      label: 'RUM Explorer',
      description: 'Tab changes, checks and un-checks as custom actions',
      href: url(host, '/rum/explorer', { query: `@type:action${application}` }),
    },
    {
      label: 'Error Tracking',
      description: 'The $25 cart limit error, grouped by stack',
      href: url(host, '/rum/error-tracking', {
        query: `@error.type:CartLimitExceededError${application}`,
      }),
    },
    {
      label: 'Session Replay',
      description: 'Recorded sessions (20% sampled)',
      href: url(host, '/rum/replay/sessions', { query: `service:${rumService}` }),
    },
    {
      label: 'Metrics',
      description: 'The ddog.* counters forwarded by the BFF',
      href: url(host, '/metric/summary', { filter: 'ddog.' }),
    },
    {
      label: 'APM Service',
      description: `Latency and errors for the ${bffService} BFF`,
      href: url(host, `/apm/services/${bffService}`, { env: ddEnv }),
    },
    {
      label: 'APM Traces',
      description: 'Individual POST /api/telemetry spans',
      href: url(host, '/apm/traces', { query: `service:${bffService}` }),
    },
  ]
}
