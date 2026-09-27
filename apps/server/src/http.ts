import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { z } from 'zod'

export function erroApi(status: ContentfulStatusCode, codigo: string, mensagem: string) {
  return new HTTPException(status, {
    res: Response.json({ erro: codigo, mensagem }, { status }),
  })
}

export async function lerCorpo<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const invalido = erroApi(
    400,
    'corpo_invalido',
    'O pedido chegou num formato que o servidor não entende.',
  )
  const bruto: unknown = await c.req.json().catch(() => {
    throw invalido
  })
  const resultado = schema.safeParse(bruto)
  if (!resultado.success) throw invalido
  return resultado.data
}
