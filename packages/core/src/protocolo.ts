import { z } from 'zod'

/** Tópico dos avisos do Telando no data channel do LiveKit. */
export const TOPICO = 'telando'

// Revezamento: só avisos. Quem muda permissão é o server, a pedido do host. Quem mandou vem
// sempre do participant.identity do LiveKit, nunca do corpo (o Zod descarta campos a mais).
const avisoSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('pedido-tela') }),
  z.object({ t: z.literal('pedido-cancelado') }),
  z.object({ t: z.literal('pedido-recusado') }),
  z.object({ t: z.literal('devolver-tela') }),
])

export type AvisoRevezamento = z.infer<typeof avisoSchema>

export function codificarAviso(aviso: AvisoRevezamento): string {
  return JSON.stringify(aviso)
}

export function lerAviso(texto: string): AvisoRevezamento | null {
  try {
    const resultado = avisoSchema.safeParse(JSON.parse(texto))
    return resultado.success ? resultado.data : null
  } catch {
    // Qualquer participante pode mandar bytes quaisquer; o que não é JSON é ignorado.
    return null
  }
}
