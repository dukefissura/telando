import { AppHost } from '@telando/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { PaginaAssistir } from './assistir/pagina-assistir.tsx'
import './estilo.css'
import { plataformaWeb } from './plataforma-web.ts'

const router = createBrowserRouter([
  { path: '/', element: <AppHost plataforma={plataformaWeb} /> },
  { path: '/s/:id', element: <PaginaAssistir /> },
])

const raiz = document.getElementById('root')
if (!raiz) throw new Error('index.html sem #root')

createRoot(raiz).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
