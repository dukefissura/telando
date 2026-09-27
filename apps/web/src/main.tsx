import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Inicio } from './inicio.tsx'
import './estilo.css'

const raiz = document.getElementById('root')
if (!raiz) throw new Error('index.html sem #root')

createRoot(raiz).render(
  <StrictMode>
    <Inicio />
  </StrictMode>,
)
