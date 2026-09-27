import { useEffect, useRef } from 'react'

/**
 * Atalhos de uma tecla, só na janela do app. Ignora combinações com Ctrl/Alt/Cmd (Ctrl+C continua
 * copiando) e teclas digitadas em campos de texto.
 */
export function useAtalhosDaJanela(atalhos: Record<string, () => void>) {
  const atuais = useRef(atalhos)
  atuais.current = atalhos

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.ctrlKey || evento.metaKey || evento.altKey) return
      const alvo = evento.target as HTMLElement
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(alvo.tagName)) return
      atuais.current[evento.key.toLowerCase()]?.()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])
}
