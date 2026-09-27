import { RoomContext } from '@livekit/components-react'
import { apelidoAleatorio } from '@telando/core'
import { type FormEvent, useState } from 'react'
import { useParams } from 'react-router'
import { Palco } from './palco.tsx'
import { useSalaEspectador } from './use-sala-espectador.ts'

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-2 p-8" aria-live="polite">
      <h1 className="font-semibold text-xl">{titulo}</h1>
      <p className="text-texto-suave">{texto}</p>
    </main>
  )
}

export function PaginaAssistir() {
  const { id = '' } = useParams()
  const { sala, entrar } = useSalaEspectador(id)
  const [apelido, setApelido] = useState(apelidoAleatorio)

  if (sala.fase === 'conectado') {
    return (
      <RoomContext.Provider value={sala.room}>
        <Palco />
      </RoomContext.Provider>
    )
  }
  if (sala.fase === 'encerrada') {
    return (
      <Aviso titulo="Sessão encerrada" texto="Quem estava compartilhando parou a transmissão." />
    )
  }
  if (sala.fase === 'invalida') {
    return (
      <Aviso
        titulo="Link inválido ou expirado"
        texto="Essa sessão já acabou ou o link veio incompleto. Peça um link novo."
      />
    )
  }

  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    void entrar(apelido)
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center p-8">
      <form onSubmit={enviar} className="grid gap-4">
        <h1 className="font-semibold text-xl">Entrar para assistir</h1>
        <div className="grid gap-2">
          <label htmlFor="apelido" className="text-sm text-texto-suave">
            Seu apelido
          </label>
          <input
            id="apelido"
            value={apelido}
            maxLength={32}
            onChange={(e) => setApelido(e.target.value)}
            className="rounded-lg border border-borda bg-superficie px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={sala.fase === 'entrando'}
          className="rounded-lg bg-texto px-4 py-2 font-medium text-fundo disabled:opacity-60"
        >
          {sala.fase === 'entrando' ? 'Entrando…' : 'Assistir'}
        </button>
        {sala.fase === 'erro' && (
          <p role="alert" className="text-sm text-parar">
            {sala.mensagem}
          </p>
        )}
      </form>
    </main>
  )
}
