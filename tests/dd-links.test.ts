import { describe, expect, it } from 'vitest'
import { appHost, datadogLinks } from '../src/telemetry/dd-links.ts'

const env = {
  VITE_DD_SITE: 'datadoghq.com',
  VITE_DD_SERVICE: 'ddog-web',
  VITE_DD_ENV: 'development',
  VITE_DD_APPLICATION_ID: 'app-123',
}

const byLabel = (label: string) => datadogLinks(env).find((l) => l.label === label)

describe('appHost', () => {
  it('prefixes the app subdomain for the primary sites', () => {
    expect(appHost('datadoghq.com')).toBe('https://app.datadoghq.com')
    expect(appHost('datadoghq.eu')).toBe('https://app.datadoghq.eu')
    expect(appHost('ddog-gov.com')).toBe('https://app.ddog-gov.com')
  })

  it('uses regional hosts as-is, since they are already app hosts', () => {
    expect(appHost('us3.datadoghq.com')).toBe('https://us3.datadoghq.com')
    expect(appHost('us5.datadoghq.com')).toBe('https://us5.datadoghq.com')
    expect(appHost('ap1.datadoghq.com')).toBe('https://ap1.datadoghq.com')
  })

  it('defaults to US1 when the site is missing', () => {
    expect(appHost(undefined)).toBe('https://app.datadoghq.com')
  })
})

describe('datadogLinks', () => {
  it('builds a link for each place telemetry lands', () => {
    expect(datadogLinks(env).map((l) => l.label)).toEqual([
      'RUM Explorer',
      'Error Tracking',
      'Session Replay',
      'Metrics',
      'APM Service',
      'APM Traces',
    ])
  })

  it('points RUM Explorer at this application, filtered to custom actions', () => {
    const url = new URL(byLabel('RUM Explorer')!.href)
    expect(url.origin + url.pathname).toBe('https://app.datadoghq.com/rum/explorer')
    expect(url.searchParams.get('query')).toBe('@type:action @application.id:app-123')
  })

  it('points Error Tracking at the cart limit error', () => {
    const url = new URL(byLabel('Error Tracking')!.href)
    expect(url.pathname).toBe('/rum/error-tracking')
    expect(url.searchParams.get('query')).toContain('@error.type:CartLimitExceededError')
  })

  it('filters the metric summary to the ddog namespace', () => {
    const url = new URL(byLabel('Metrics')!.href)
    expect(url.pathname).toBe('/metric/summary')
    expect(url.searchParams.get('filter')).toBe('ddog.')
  })

  it('links the APM service page with the environment', () => {
    const url = new URL(byLabel('APM Service')!.href)
    expect(url.pathname).toBe('/apm/services/ddog')
    expect(url.searchParams.get('env')).toBe('development')
  })

  it('encodes query values rather than emitting raw spaces', () => {
    expect(byLabel('RUM Explorer')!.href).not.toMatch(/ /)
    expect(byLabel('RUM Explorer')!.href).toContain('%40type%3Aaction')
  })

  it('encodes spaces as %20, not +, since + is ambiguous in a query string', () => {
    const href = byLabel('RUM Explorer')!.href
    expect(href).not.toContain('+')
    expect(href).toContain('%20%40application.id')
  })

  it('honours a non-default site across every link', () => {
    const links = datadogLinks({ ...env, VITE_DD_SITE: 'datadoghq.eu' })
    for (const link of links) expect(link.href).toContain('https://app.datadoghq.eu/')
  })

  it('omits the application filter when no application id is configured', () => {
    const links = datadogLinks({ ...env, VITE_DD_APPLICATION_ID: undefined })
    const url = new URL(links.find((l) => l.label === 'RUM Explorer')!.href)
    expect(url.searchParams.get('query')).toBe('@type:action')
  })

  it('gives every link a description and a stable key', () => {
    for (const link of datadogLinks(env)) {
      expect(link.description.length).toBeGreaterThan(0)
      expect(link.href.startsWith('https://')).toBe(true)
    }
  })
})
