import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initRum, resetRumForTests, rumConfigFromEnv } from '../src/telemetry/rum.ts'

const fullEnv = {
  VITE_DD_APPLICATION_ID: 'app-123',
  VITE_DD_CLIENT_TOKEN: 'pubtoken',
  VITE_DD_SITE: 'datadoghq.eu',
  VITE_DD_SERVICE: 'ddog-web',
  VITE_DD_ENV: 'staging',
  VITE_DD_VERSION: '2.1.0',
}

describe('rumConfigFromEnv', () => {
  it('reads the full config from env', () => {
    expect(rumConfigFromEnv(fullEnv)).toEqual({
      applicationId: 'app-123',
      clientToken: 'pubtoken',
      site: 'datadoghq.eu',
      service: 'ddog-web',
      env: 'staging',
      version: '2.1.0',
    })
  })

  it('falls back to the US site and sensible service defaults', () => {
    const config = rumConfigFromEnv({
      VITE_DD_APPLICATION_ID: 'app-123',
      VITE_DD_CLIENT_TOKEN: 'pubtoken',
    })
    expect(config).toMatchObject({
      site: 'datadoghq.com',
      service: 'ddog',
      env: 'development',
      version: '0.0.0',
    })
  })

  it('returns null when the credentials are missing', () => {
    expect(rumConfigFromEnv({})).toBeNull()
    expect(rumConfigFromEnv({ VITE_DD_APPLICATION_ID: 'app-123' })).toBeNull()
    expect(rumConfigFromEnv({ VITE_DD_CLIENT_TOKEN: 'pubtoken' })).toBeNull()
  })
})

describe('initRum', () => {
  beforeEach(() => {
    resetRumForTests()
  })

  it('initialises and starts session recording when configured', () => {
    const sdk = { init: vi.fn(), addError: vi.fn(), addAction: vi.fn() }
    const rum = initRum(fullEnv, sdk)

    expect(sdk.init).toHaveBeenCalledOnce()
    expect(sdk.init.mock.calls[0]?.[0]).toMatchObject({
      applicationId: 'app-123',
      clientToken: 'pubtoken',
      site: 'datadoghq.eu',
      service: 'ddog-web',
      version: '2.1.0',
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackResources: true,
      trackUserInteractions: true,
      trackLongTasks: true,
    })
    expect(rum).toBe(sdk)
  })

  it('registers the React plugin so component errors are attributed', () => {
    const sdk = { init: vi.fn(), addError: vi.fn(), addAction: vi.fn() }
    const plugin = { name: 'react' }
    initRum(fullEnv, sdk, [plugin])

    expect(sdk.init.mock.calls[0]?.[0]).toMatchObject({ plugins: [plugin] })
  })

  it('omits the plugins key entirely when none are supplied', () => {
    const sdk = { init: vi.fn(), addError: vi.fn(), addAction: vi.fn() }
    initRum(fullEnv, sdk)

    expect(sdk.init.mock.calls[0]?.[0]).not.toHaveProperty('plugins')
  })

  it('returns undefined and warns when credentials are absent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sdk = { init: vi.fn(), addError: vi.fn(), addAction: vi.fn() }

    expect(initRum({}, sdk)).toBeUndefined()
    expect(sdk.init).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('initialises only once even if called repeatedly', () => {
    const sdk = { init: vi.fn(), addError: vi.fn(), addAction: vi.fn() }
    initRum(fullEnv, sdk)
    initRum(fullEnv, sdk)
    expect(sdk.init).toHaveBeenCalledOnce()
  })
})
