import type { ItemChat } from '@telando/core/cliente'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'

export function PainelChat({
  mensagens,
  aoEnviar,
  className = '',
}: {
  mensagens: ItemChat[]
  aoEnviar: (texto: string) => Promise<void>
  className?: string
}) {
  const [rascunho, setRascunho] = useState('')
  const fim = useRef<HTMLLIElement>(null)
  const idCampo = useId()
  const [falhou, setFalhou] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: rola quando chega mensagem nova
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [mensagens.length])

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault()
    if (!rascunho.trim()) return
    try {
      await aoEnviar(rascunho)
      setRascunho('')
      setFalhou(false)
    } catch {
      setFalhou(true)
    }
  }

  return (
    <section aria-label="Chat" className={`flex min-h-0 flex-col ${className}`}>
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm" aria-live="polite">
        {mensagens.length === 0 && (
          <li className="text-texto-suave">
            Ninguém escreveu nada ainda. As mensagens somem quando a sessão acaba.
          </li>
        )}
        {mensagens.map((mensagem) => (
          <li key={mensagem.id} className="wrap-break-word">
            <span className={`font-medium ${mensagem.meu ? 'text-texto-suave' : ''}`}>
              {mensagem.meu ? 'Você' : mensagem.nome}
            </span>{' '}
            {mensagem.texto}
          </li>
        ))}
        <li ref={fim} aria-hidden />
      </ol>
      <form onSubmit={enviar} className="grid gap-1 border-borda border-t p-2">
        <label htmlFor={idCampo} className="text-texto-suave text-xs">
          Mensagem para a sala
        </label>
        <input
          id={idCampo}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          maxLength={500}
          placeholder="Enter envia"
          className="w-full rounded-lg border border-borda bg-superficie px-3 py-2 text-sm"
        />
        {falhou && (
          <p role="alert" className="text-parar text-xs">
            Não deu para enviar agora. A mensagem continua aí; tente de novo.
          </p>
        )}
      </form>
    </section>
  )
}
