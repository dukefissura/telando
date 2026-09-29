import { RoomContext } from '@livekit/components-react'
import { apelidoAleatorio, ErroApi } from '@telando/core'
import { UserRound } from 'lucide-react'
import { motion } from 'motion/react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { IconeTelando } from '../barra-do-app.tsx'
import { Botao, classeCampoEmGrupo, Grupo, LinhaDeGrupo } from '../controles.tsx'
import { ENTRADA } from '../movimento.ts'
import type { Plataforma } from '../plataforma.ts'
import { BotaoTema } from '../tema.tsx'
import { Aviso, Centro } from './aviso.tsx'
import { Palco } from './palco.tsx'
import { useSalaEspectador } from './use-sala-espectador.ts'

type Previa =
  | { fase: 'carregando' }
  | { fase: 'pronta'; hostNome: string; trancada: boolean }
  | { fase: 'invalida' }

/** Quem está compartilhando, antes de entrar: e um link morto aparece na hora, sem clique. */
function usePrevia(api: Plataforma['api'], id: string, pular: boolean) {
  const [previa, setPrevia] = useState<Previa>({ fase: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: tentativa existe para buscar de novo
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
  }, [api, id, pular, tentativa])
  return { previa, recarregar: () => setTentativa((n) => n + 1) }
}

/**
 * Entra numa sessão. Com `autoEntrar`, pula o formulário e mostra `enquanto` até conectar: é o
 * caso do link fixo, em que a pessoa já escolheu o apelido enquanto esperava o dono começar.
 */
export function Assistir({
  plataforma,
  id,
  aoVoltar,
  autoEntrar,
}: {
  plataforma: Pick<Plataforma, 'api' | 'fontes'>
  id: string
  aoVoltar: () => void
  autoEntrar?: { apelido: string; enquanto: ReactNode }
}) {
  const { sala, entrar } = useSalaEspectador(plataforma.api, id)
  const [apelido, setApelido] = useState(() => autoEntrar?.apelido ?? apelidoAleatorio())
  const { previa, recarregar } = usePrevia(plataforma.api, id, autoEntrar !== undefined)

  // biome-ignore lint/correctness/useExhaustiveDependencies: entra uma vez, ao montar
  useEffect(() => {
    if (autoEntrar) void entrar(autoEntrar.apelido)
  }, [])

  const voltar = <Botao onClick={aoVoltar}>Voltar ao início</Botao>
  const entrarDeNovo = (
    <Botao variante="primario" onClick={() => void entrar(apelido)}>
      Entrar de novo
    </Botao>
  )
  // Trancada antes de tentar entrar: perguntar de novo ao server se o host já destrancou.
  const tentarDeNovo = (
    <Botao
      variante="primario"
      onClick={() => (sala.fase === 'trancada' ? void entrar(apelido) : recarregar())}
    >
      Tentar de novo
    </Botao>
  )

  if (sala.fase === 'conectado' || sala.fase === 'encerrando') {
    return (
      <RoomContext.Provider value={sala.room}>
        <Palco
          fontes={plataforma.fontes}
          aoSair={aoVoltar}
          desligando={sala.fase === 'encerrando'}
        />
      </RoomContext.Provider>
    )
  }

  const aviso = (() => {
    if (sala.fase === 'encerrada')
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={ENTRADA}
        >
          <Aviso titulo="Sessão encerrada" texto="Quem estava compartilhando parou a transmissão.">
            {voltar}
          </Aviso>
        </motion.div>
      )
    if (sala.fase === 'removido')
      return (
        <Aviso titulo="Você foi removido da sessão" texto="O host tirou você desta transmissão.">
          {voltar}
        </Aviso>
      )
    if (sala.fase === 'invalida' || previa.fase === 'invalida')
      return (
        <Aviso
          titulo="Link inválido ou expirado"
          texto="Essa sessão já acabou ou o link veio incompleto. Peça um link novo."
        >
          {voltar}
        </Aviso>
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
          {tentarDeNovo}
          {voltar}
        </Aviso>
      )
    if (sala.fase === 'caiu')
      return (
        <Aviso titulo="A conexão caiu" texto="Tentamos reconectar e não deu. Confira sua internet.">
          {entrarDeNovo}
          {voltar}
        </Aviso>
      )
    return null
  })()
  if (aviso) return <Centro>{aviso}</Centro>
  if (autoEntrar && (sala.fase === 'formulario' || sala.fase === 'entrando')) {
    return autoEntrar.enquanto
  }

  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    void entrar(apelido)
  }

  return (
    <Centro>
      <div className="absolute top-4 right-4">
        <BotaoTema />
      </div>
      <form
        onSubmit={enviar}
        className="grid w-[400px] max-w-[calc(100vw-2rem)] justify-items-center gap-7 text-center"
      >
        <IconeTelando className="size-[72px] opacity-90" />
        <div className="grid gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">Entrar para assistir</h1>
          <p className="text-pretty text-[15px] text-texto-suave leading-[22px]" aria-live="polite">
            {previa.fase !== 'pronta'
              ? ' '
              : previa.hostNome
                ? `${previa.hostNome} está compartilhando a tela agora.`
                : 'Tem uma tela sendo compartilhada neste link.'}
          </p>
        </div>
        <div className="w-full text-left">
          <Grupo rotulo="Seu apelido">
            <LinhaDeGrupo icone={UserRound}>
              <input
                id="apelido"
                aria-label="Seu apelido"
                value={apelido}
                maxLength={32}
                onChange={(e) => setApelido(e.target.value)}
                className={classeCampoEmGrupo}
              />
            </LinhaDeGrupo>
          </Grupo>
        </div>
        <div className="grid w-full gap-2">
          <Botao
            type="submit"
            variante="primario"
            tamanho="grande"
            className="w-full"
            disabled={sala.fase === 'entrando'}
          >
            {sala.fase === 'entrando' ? 'Entrando…' : 'Assistir'}
          </Botao>
          <Botao variante="fantasma" onClick={aoVoltar}>
            Voltar
          </Botao>
        </div>
        {sala.fase === 'erro' && (
          <p role="alert" className="text-parar text-sm">
            {sala.mensagem}
          </p>
        )}
      </form>
    </Centro>
  )
}
