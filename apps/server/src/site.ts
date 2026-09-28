import { relative } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import type { criarApp } from './app.ts'
import { erroApi } from './http.ts'

type Opcoes = {
  /** Pasta com o build do apps/web. */
  dist: string
}

/**
 * Em produção um processo só atende a API e o site. O site é a página que abre o app: qualquer
 * rota que não seja arquivo nem API (/luan, /s/abc) recebe o index.html, que lê o link.
 */
export function criarSite(api: ReturnType<typeof criarApp>, { dist }: Opcoes) {
  // O serveStatic do Node só aceita caminho relativo à pasta de trabalho.
  const raiz = relative(process.cwd(), dist)

  return new Hono()
    .use(
      '*',
      secureHeaders({
        contentSecurityPolicy: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      }),
    )
    .route('/', api)
    .all('/api/*', () => {
      throw erroApi(404, 'rota_inexistente', 'Essa rota da API não existe.')
    })
    .use('*', async (c, next) => {
      await next()
      // Arquivos em /assets têm hash no nome e nunca mudam; o resto (index.html) precisa ser novo.
      c.header(
        'cache-control',
        c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      )
    })
    .use('*', serveStatic({ root: raiz }))
    .get('*', serveStatic({ root: raiz, path: 'index.html' }))
}
