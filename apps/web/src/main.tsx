import { destinoDoLink } from '@telando/core'
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './estilo.css'

const DOWNLOAD = 'https://github.com/dukefissura/telando/releases/latest/download/Telando-Setup.exe'

function linkDoApp(): string | null {
  const destino = destinoDoLink(window.location.href)
  if (!destino) return null
  return destino.tipo === 'sessao' ? `telando://s/${destino.id}` : `telando://${destino.slug}`
}

const principal = 'rounded-lg bg-destaque px-4 py-3 text-center font-medium text-sobre-destaque'
const secundario = 'rounded-lg border border-borda px-4 py-3 text-center'

/** Quem assiste também usa o app: a página só tenta abrir o Telando ou leva ao download. */
function PaginaAbrir() {
  const link = linkDoApp()

  // Tenta abrir o app uma vez; se ele não estiver instalado, o navegador só ignora.
  useEffect(() => {
    if (link) window.location.href = link
  }, [link])

  return (
    <main className="grid min-h-dvh place-items-center px-8">
      <div className="grid w-full max-w-md gap-8">
        <div className="grid gap-3">
          <h1 className="font-semibold text-[40px] leading-[1.1] tracking-tight">Telando</h1>
          <p className="text-lg text-texto-suave">
            {link
              ? 'Essa transmissão abre no app do Telando, para Windows.'
              : 'Compartilhe a tela com os amigos pelo app do Telando, para Windows.'}
          </p>
        </div>
        <div className="grid gap-3">
          {link && (
            <a href={link} className={principal}>
              Abrir no Telando
            </a>
          )}
          <a href={DOWNLOAD} className={link ? secundario : principal}>
            Baixar para Windows
          </a>
        </div>
        {link && (
          <p className="text-sm text-texto-suave">
            Ainda não tem o app? Baixe, instale e clique no link de novo.
          </p>
        )}
      </div>
    </main>
  )
}

const raiz = document.getElementById('root')
if (!raiz) throw new Error('index.html sem #root')

createRoot(raiz).render(
  <StrictMode>
    <PaginaAbrir />
  </StrictMode>,
)
