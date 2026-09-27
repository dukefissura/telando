import type { TelandoDesktop } from '../compartilhado/ipc.ts'

declare global {
  interface Window {
    telando: TelandoDesktop
  }
  interface ImportMetaEnv {
    readonly VITE_TELANDO_SERVER?: string
  }
}
