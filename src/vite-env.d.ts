/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DD_APPLICATION_ID?: string
  readonly VITE_DD_CLIENT_TOKEN?: string
  readonly VITE_DD_SITE?: string
  readonly VITE_DD_SERVICE?: string
  readonly VITE_DD_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
