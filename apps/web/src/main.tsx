import { AppHost, aplicarTemaSalvo } from '@telando/ui'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { PaginaAssistir } from './assistir/pagina-assistir.tsx'
import { PaginaLinkFixo } from './assistir/pagina-link-fixo.tsx'
import './estilo.css'
import { plataformaWeb } from './plataforma-web.ts'

const router = createBrowserRouter([
  { path: '/', element: <AppHost plataforma={plataformaWeb} /> },
  { path: '/s/:id', element: <PaginaAssistir /> },
  { path: '/:slug', element: <PaginaLinkFixo /> },
])

aplicarTemaSalvo()

const raiz = document.getElementById('root')
if (!raiz) throw new Error('index.html sem #root')

createRoot(raiz).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
)
