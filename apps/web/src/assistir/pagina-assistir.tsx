import { RoomContext } from '@livekit/components-react'
import { apelidoAleatorio, ErroApi } from '@telando/core'
import { Botao, BotaoTema, classeCampo } from '@telando/ui'
import { type FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { api } from '../api.ts'
import { Aviso, Centro } from './aviso.tsx'
import { Palco } from './palco.tsx'
import { useSalaEspectador } from './use-sala-espectador.ts'

export function PaginaAssistir() {
  const { id = '' } = useParams()
  return <Assistir id={id} />
}

type Previa =
  | { fase: 'carregando' }
  | { fase: 'pronta'; hostNome: string; trancada: boolean }
  | { fase: 'invalida' }

/** Quem está compartilhando, antes de entrar: e um link morto aparece na hora, sem clique. */
function usePrevia(id: string, pular: boolean) {
  const [previa, setPrevia] = useState<Previa>({ fase: 'carregando' })
  useEffect(() => {
    if (pular) return
    let ativo = true
    api
      .infoDaSessao(id)
      .then((info) => ativo && setPrevia({ fase: 'pronta', ...info }))
      .catch((erro: unknown) => {
        // Outros erros (rede) não bloqueiam: a pessoa ainda pode tentar entrar.
        if (ativo && erro instanceof ErroApi && erro.status === 404) setPrevia({ fase: 'invalida' })
      })
    return () => {
      ativo = false
    }
  }, [id, pular])
  return previa
}

/**
 * Entra numa sessão. Com `entrarComApelido`, pula o formulário: é o caso do link fixo, em que a
 * pessoa já escolheu o apelido enquanto esperava o dono começar.
 */
export function Assistir({ id, entrarComApelido }: { id: string; entrarComApelido?: string }) {
  const { sala, entrar } = useSalaEspectador(id)
  const [apelido, setApelido] = useState(() => entrarComApelido ?? apelidoAleatorio())
  const previa = usePrevia(id, entrarComApelido !== undefined)

  // biome-ignore lint/correctness/useExhaustiveDependencies: entra uma vez, ao montar
  useEffect(() => {
    if (entrarComApelido !== undefined) void entrar(entrarComApelido)
  }, [])

  const entrarDeNovo = (
    <Botao variante="primario" onClick={() => void entrar(apelido)}>
      Entrar de novo
    </Botao>
  )

  if (sala.fase === 'conectado') {
    return (
      <RoomContext.Provider value={sala.room}>
        <Palco />
      </RoomContext.Provider>
    )
  }

  const aviso = (() => {
    if (sala.fase === 'encerrada')
      return (
        <Aviso titulo="Sessão encerrada" texto="Quem estava compartilhando parou a transmissão." />
      )
    if (sala.fase === 'removido')
      return (
        <Aviso titulo="Você foi removido da sessão" texto="O host tirou você desta transmissão." />
      )
    if (sala.fase === 'invalida' || previa.fase === 'invalida')
      return (
        <Aviso
          titulo="Link inválido ou expirado"
          texto="Essa sessão já acabou ou o link veio incompleto. Peça um link novo."
        />
      )
    if (
      sala.fase === 'trancada' ||
      (previa.fase === 'pronta' && previa.trancada && sala.fase === 'formulario')
    )
      return (
        <Aviso
          titulo="Sessão trancada"
          texto="O host trancou a sessão e ninguém novo pode entrar. Peça para ele destrancar."
        >
          {entrarDeNovo}
        </Aviso>
      )
    if (sala.fase === 'caiu')
      return (
        <Aviso titulo="A conexão caiu" texto="Tentamos reconectar e não deu. Confira sua internet.">
          {entrarDeNovo}
        </Aviso>
      )
    return null
  })()
  if (aviso) return <Centro>{aviso}</Centro>

  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    void entrar(apelido)
  }

  return (
    <Centro>
      <div className="absolute top-4 right-4">
        <BotaoTema />
      </div>
      <form onSubmit={enviar} className="grid w-full max-w-sm gap-6 p-8">
        <div className="grid gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">Entrar para assistir</h1>
          <p className="text-texto-suave" aria-live="polite">
            {previa.fase !== 'pronta'
              ? ' '
              : previa.hostNome
                ? `${previa.hostNome} está compartilhando a tela agora.`
                : 'Tem uma tela sendo compartilhada neste link.'}
          </p>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="apelido" className="text-sm text-texto-suave">
            Seu apelido
          </label>
          <input
            id="apelido"
            value={apelido}
            maxLength={32}
            onChange={(e) => setApelido(e.target.value)}
            className={classeCampo}
          />
        </div>
        <Botao
          type="submit"
          variante="primario"
          className="h-10"
          disabled={sala.fase === 'entrando'}
        >
          {sala.fase === 'entrando' ? 'Entrando…' : 'Assistir'}
        </Botao>
        {sala.fase === 'erro' && (
          <p role="alert" className="text-parar text-sm">
            {sala.mensagem}
          </p>
        )}
      </form>
    </Centro>
  )
}
