import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { datadogRum } from '@datadog/browser-rum'
import { reactPlugin } from '@datadog/browser-rum-react'
import { App } from './App.tsx'
import { createTelemetry } from './telemetry/client.ts'
import { MockTransport } from './telemetry/transports/mock.ts'
import { AgentTransport } from './telemetry/transports/agent.ts'
import { OffTransport } from './telemetry/transports/off.ts'
import { initRum } from './telemetry/rum.ts'
import { loadMode, saveMode } from './telemetry/mode-storage.ts'
import './styles.css'

const initialMode = loadMode()

const mockTransport = new MockTransport()

const agentTransport = new AgentTransport({
  endpoint: '/api/telemetry',
  onError: (error) => console.warn('[ddog] failed to reach the BFF', error),
})

const telemetry = createTelemetry({
  // Off by default, but the last choice sticks across reloads so that
  // `app.started` — which fires on mount — is actually observable.
  mode: initialMode,
  transports: {
    off: new OffTransport(),
    mock: mockTransport,
    agent: agentTransport,
  },
  onTransportError: (error, event) =>
    console.warn(`[ddog] transport failed for ${event.name}`, error),
})

// RUM only starts in Agent mode, so Off and Mock stay silent.
const startRumIfAgent = (mode: typeof initialMode) => {
  if (mode !== 'agent') return
  // `router: false` — this app has no router, so route tracking is skipped.
  agentTransport.setRum(initRum(import.meta.env, datadogRum, [reactPlugin({ router: false })]))
}

telemetry.onModeChange((mode) => {
  saveMode(mode)
  startRumIfAgent(mode)
})

startRumIfAgent(initialMode)

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root container')

createRoot(container).render(
  <StrictMode>
    <App telemetry={telemetry} mockTransport={mockTransport} env={import.meta.env} />
  </StrictMode>,
)
