import { RoomContext } from '@livekit/components-react'
import { apelidoAleatorio } from '@telando/core'
import { type FormEvent, useState } from 'react'
import { useParams } from 'react-router'
import { Aviso } from './aviso.tsx'
import { Palco } from './palco.tsx'
import { useSalaEspectador } from './use-sala-espectador.ts'

function Centro({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-dvh place-items-center">{children}</main>
}

export function PaginaAssistir() {
  const { id = '' } = useParams()
  const { sala, entrar } = useSalaEspectador(id)
  const [apelido, setApelido] = useState(apelidoAleatorio)

  const entrarDeNovo = (
    <button
      type="button"
      onClick={() => void entrar(apelido)}
      className="rounded-lg bg-texto px-4 py-2 font-medium text-fundo text-sm"
    >
      Entrar de novo
    </button>
  )

  switch (sala.fase) {
    case 'conectado':
      return (
        <RoomContext.Provider value={sala.room}>
          <Palco />
        </RoomContext.Provider>
      )
    case 'encerrada':
      return (
        <Centro>
          <Aviso
            titulo="Sessão encerrada"
            texto="Quem estava compartilhando parou a transmissão."
          />
        </Centro>
      )
    case 'removido':
      return (
        <Centro>
          <Aviso
            titulo="Você foi removido da sessão"
            texto="O host tirou você desta transmissão."
          />
        </Centro>
      )
    case 'trancada':
      return (
        <Centro>
          <Aviso
            titulo="Sessão trancada"
            texto="O host trancou a sessão e ninguém novo pode entrar. Peça para ele destrancar."
          >
            {entrarDeNovo}
          </Aviso>
        </Centro>
      )
    case 'invalida':
      return (
        <Centro>
          <Aviso
            titulo="Link inválido ou expirado"
            texto="Essa sessão já acabou ou o link veio incompleto. Peça um link novo."
          />
        </Centro>
      )
    case 'caiu':
      return (
        <Centro>
          <Aviso
            titulo="A conexão caiu"
            texto="Tentamos reconectar e não deu. Confira sua internet."
          >
            {entrarDeNovo}
          </Aviso>
        </Centro>
      )
  }

  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    void entrar(apelido)
  }

  return (
    <Centro>
      <form onSubmit={enviar} className="grid w-full max-w-sm gap-4 p-8">
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
          <p role="alert" className="text-parar text-sm">
            {sala.mensagem}
          </p>
        )}
      </form>
    </Centro>
  )
}
