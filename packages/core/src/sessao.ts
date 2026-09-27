import { z } from 'zod'

export const sessaoMetadataSchema = z.object({
  v: z.literal(1),
  hostIdentity: z.string().min(1),
  hostNome: z.string(),
  presenterIdentity: z.string().min(1).nullable(),
  trancada: z.boolean(),
})

export type SessaoMetadata = z.infer<typeof sessaoMetadataSchema>

export function lerSessaoMetadata(raw: string | undefined): SessaoMetadata | null {
  if (!raw) return null
  try {
    const parsed = sessaoMetadataSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    // Metadados escritos por outra versão do server ou editados à mão no painel do LiveKit.
    return null
  }
}
