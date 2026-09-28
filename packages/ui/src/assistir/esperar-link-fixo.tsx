import { apelidoAleatorio, ErroApi, estadoLinkSchema, mensagemDoErro } from '@telando/core'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Botao, classeCampo } from '../controles.tsx'
import { SAIDA, TRANSICAO_SELO } from '../movimento.ts'
import type { Plataforma } from '../plataforma.ts'
import { Assistir } from './assistir.tsx'
import { Aviso, Centro } from './aviso.tsx'

const statusSchema = estadoLinkSchema.omit({ url: true })

type EstadoEspera =
  | { fase: 'abrindo' }
  | { fase: 'livre' }
  | { fase: 'erro'; mensagem: string }
  | {
      fase: 'conhecido'
      nome: string
      aoVivo: boolean
      sessionId?: string | undefined
      jaTransmitiu: boolean
    }

/** Acompanha o link fixo pelo SSE do server enquanto a tela estiver aberta. */
function useLinkFixo(api: Plataforma['api'], slug: string) {
  const [estado, setEstado] = useState<EstadoEspera>({ fase: 'abrindo' })
  // O SSE não manda o endereço; ele vem da primeira consulta.
  const [dominio, setDominio] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    let fonte: EventSource | null = null

    api
      .estadoDoLink(slug)
      .then((inicial) => {
        if (!ativo) return
        setDominio(new URL(inicial.url).host)
        fonte = new EventSource(api.urlEventosDoLink(slug))
        fonte.addEventListener('status', (evento) => {
          const status = statusSchema.safeParse(JSON.parse(evento.data))
          if (!status.success) return
          setEstado((anterior) => ({
            fase: 'conhecido',
            ...status.data,
            jaTransmitiu:
              anterior.fase === 'conhecido' && (anterior.aoVivo || anterior.jaTransmitiu),
          }))
        })
      })
      .catch((erro: unknown) => {
        if (!ativo) return
        const livre = erro instanceof ErroApi && erro.status === 404
        setEstado(
          livre
            ? { fase: 'livre' }
            : { fase: 'erro', mensagem: mensagemDoErro(erro, 'Não consegui abrir o link.') },
        )
      })

    return () => {
      ativo = false
      fonte?.close()
    }
  }, [api, slug])

  return { estado, dominio }
}

/** O endereço do link fixo como o número de um canal. Ao entrar ao vivo, ele vira o selo do palco. */
function Canal({ dominio, slug }: { dominio: string | null; slug: string }) {
  return (
    <motion.p
      layoutId="selo-tela"
      className="justify-self-center font-mono text-[22px] tracking-tight"
      transition={TRANSICAO_SELO}
    >
      {dominio && <span className="text-texto-suave">{dominio}/</span>}
      <span className="text-destaque">{slug}</span>
    </motion.p>
  )
}

/** Uma faixa de luz que cruza a tela devagar, como um canal fora do ar. */
function Varredura() {
  const reduzir = useReducedMotion()
  if (reduzir) return null
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[60px]"
      style={{
        background: 'linear-gradient(180deg, transparent, rgb(255 255 255 / 0.025), transparent)',
      }}
      // "transform" inteiro (e não y) vai para o compositor: a espera pode durar horas.
      initial={{ transform: 'translateY(-60px)' }}
      animate={{ transform: 'translateY(100dvh)' }}
      exit={SAIDA}
      transition={{ duration: 5, ease: 'linear', repeat: Number.POSITIVE_INFINITY }}
    />
  )
}

export function EsperarLinkFixo({
  plataforma,
  slug,
  aoVoltar,
}: {
  plataforma: Pick<Plataforma, 'api' | 'fontes'>
  slug: string
  aoVoltar: () => void
}) {
  const { estado, dominio } = useLinkFixo(plataforma.api, slug)
  const [apelido, setApelido] = useState(apelidoAleatorio)
  const voltar = <Botao onClick={aoVoltar}>Voltar ao início</Botao>

  if (estado.fase === 'conhecido' && estado.aoVivo && estado.sessionId) {
    return (
      <Assistir
        key={estado.sessionId}
        plataforma={plataforma}
        id={estado.sessionId}
        aoVoltar={aoVoltar}
        autoEntrar={{
          apelido: apelido.trim(),
          enquanto: (
            <Centro>
              <Canal dominio={dominio} slug={slug} />
            </Centro>
          ),
        }}
      />
    )
  }
  if (estado.fase === 'abrindo') {
    return (
      <Centro>
        <p className="text-texto-suave">Abrindo o link…</p>
      </Centro>
    )
  }
  if (estado.fase === 'livre') {
    return (
      <Centro>
        <Aviso titulo="Ninguém usa esse link" texto="Confira se o endereço está certo.">
          {voltar}
        </Aviso>
      </Centro>
    )
  }
  if (estado.fase === 'erro') {
    return (
      <Centro>
        <Aviso titulo="Não deu para abrir" texto={estado.mensagem}>
          {voltar}
        </Aviso>
      </Centro>
    )
  }

  return (
    <Centro>
      <Varredura />
      <div className="grid w-full max-w-sm gap-6 p-8">
        <Canal dominio={dominio} slug={slug} />
        <Aviso
          titulo={
            estado.jaTransmitiu
              ? `${estado.nome} encerrou a transmissão`
              : `${estado.nome} não está ao vivo agora`
          }
          texto="Deixe o Telando aberto: ele entra na transmissão assim que começar."
        />
        <label className="grid gap-2 text-sm">
          <span className="text-texto-suave">Seu apelido</span>
          <input
            value={apelido}
            maxLength={32}
            onChange={(e) => setApelido(e.target.value)}
            className={classeCampo}
          />
        </label>
        <Botao variante="fantasma" onClick={aoVoltar}>
          Voltar
        </Botao>
      </div>
    </Centro>
  )
}
