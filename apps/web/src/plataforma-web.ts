import type { Plataforma } from '@telando/ui'
import { api } from './api.ts'

const CHAVE_PREFERENCIAS = 'telando:transmissao'

export const plataformaWeb: Plataforma = {
  api,
  preferencias: {
    async ler() {
      try {
        const salvo = localStorage.getItem(CHAVE_PREFERENCIAS)
        return salvo ? JSON.parse(salvo) : null
      } catch {
        // Aba anônima ou armazenamento bloqueado: começa do padrão.
        return null
      }
    },
    async gravar(config) {
      try {
        localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(config))
      } catch {
        // Idem: sem armazenamento, as escolhas valem só para esta visita.
      }
    },
  },
}
