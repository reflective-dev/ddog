import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadMode, saveMode } from '../src/telemetry/mode-storage.ts'

describe('mode persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('defaults to off when nothing is stored', () => {
    expect(loadMode()).toBe('off')
  })

  it('round-trips a saved mode so app.started is captured after a reload', () => {
    saveMode('mock')
    expect(loadMode()).toBe('mock')
  })

  it('ignores a stored value that is not a valid mode', () => {
    localStorage.setItem('ddog:mode', 'bananas')
    expect(loadMode()).toBe('off')
  })

  it('falls back to off when storage cannot be read', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadMode()).toBe('off')
  })

  it('does not throw when storage cannot be written', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => saveMode('agent')).not.toThrow()
  })
})
