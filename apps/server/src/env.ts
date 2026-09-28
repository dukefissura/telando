import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  PUBLIC_BASE_URL: z.url(),
  LIVEKIT_URL: z.url(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  TRUST_PROXY: z.enum(['0', '1']).default('0'),
  /** Onde fica o links.json com as reservas de link fixo. */
  DATA_DIR: z.string().default('data'),
  /** Proteção contra abuso; os testes E2E sobem o server com um valor alto. */
  SESSOES_POR_MINUTO: z.coerce.number().int().positive().default(10),
})

export type Env = z.infer<typeof envSchema>

export function lerEnv(fonte: NodeJS.ProcessEnv) {
  const resultado = envSchema.safeParse(fonte)
  if (!resultado.success) {
    const campos = resultado.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Variáveis de ambiente faltando ou inválidas: ${campos}. Veja o .env.example.`)
  }
  return resultado.data
}
