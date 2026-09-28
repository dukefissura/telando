import { Moon, Sun } from 'lucide-react'
import { type MouseEvent, useState } from 'react'
import { flushSync } from 'react-dom'

type Tema = 'escuro' | 'claro'
const CHAVE = 'telando:tema'

function lerTemaSalvo(): Tema {
  try {
    return localStorage.getItem(CHAVE) === 'claro' ? 'claro' : 'escuro'
  } catch {
    // Armazenamento bloqueado: fica no padrão, o escuro.
    return 'escuro'
  }
}

function aplicar(tema: Tema) {
  if (tema === 'claro') document.documentElement.dataset.tema = 'claro'
  else delete document.documentElement.dataset.tema
}

/** Chamado antes do primeiro render, para a página não piscar no tema errado. */
export function aplicarTemaSalvo() {
  aplicar(lerTemaSalvo())
}

export function BotaoTema() {
  // O tema aplicado na página é a fonte da verdade; o armazenamento pode estar bloqueado.
  const [tema, setTema] = useState<Tema>(() =>
    document.documentElement.dataset.tema === 'claro' ? 'claro' : 'escuro',
  )
  const proximo: Tema = tema === 'escuro' ? 'claro' : 'escuro'
  const rotulo = proximo === 'claro' ? 'Usar tema claro' : 'Usar tema escuro'
  const Icone = proximo === 'claro' ? Sun : Moon

  const trocar = () => {
    aplicar(proximo)
    setTema(proximo)
    try {
      localStorage.setItem(CHAVE, proximo)
    } catch {
      // Sem armazenamento, a escolha vale só até fechar a página.
    }
  }

  // O tema novo abre num círculo a partir do botão, como uma luz que acende.
  const alternar = (evento: MouseEvent<HTMLButtonElement>) => {
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      trocar()
      return
    }
    const caixa = evento.currentTarget.getBoundingClientRect()
    const x = caixa.left + caixa.width / 2
    const y = caixa.top + caixa.height / 2
    const raio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    void document
      .startViewTransition(() => flushSync(trocar))
      .ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`] },
          {
            duration: 450,
            easing: 'cubic-bezier(.4,0,.2,1)',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={rotulo}
      title={rotulo}
      className="rounded-lg p-2 text-texto-suave transition-colors hover:bg-superficie-2 hover:text-texto"
    >
      <Icone size={18} strokeWidth={1.5} aria-hidden />
    </button>
  )
}
