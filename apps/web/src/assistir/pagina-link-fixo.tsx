import { apelidoAleatorio, ErroApi, estadoLinkSchema, mensagemDoErro } from '@telando/core'
import { classeCampo } from '@telando/ui'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { api } from '../api.ts'
import { Aviso, Centro } from './aviso.tsx'
import { Assistir } from './pagina-assistir.tsx'

const statusSchema = estadoLinkSchema.omit({ url: true })

type EstadoPagina =
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

/** Acompanha o link fixo pelo SSE do server enquanto a página estiver aberta. */
function useLinkFixo(slug: string) {
  const [estado, setEstado] = useState<EstadoPagina>({ fase: 'abrindo' })

  useEffect(() => {
    let ativo = true
    let fonte: EventSource | null = null

    api
      .estadoDoLink(slug)
      .then(() => {
        if (!ativo) return
        fonte = new EventSource(`/api/links/${encodeURIComponent(slug)}/events`)
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
  }, [slug])

  return estado
}

export function PaginaLinkFixo() {
  const { slug = '' } = useParams()
  const estado = useLinkFixo(slug)
  const [apelido, setApelido] = useState(apelidoAleatorio)

  if (estado.fase === 'conhecido' && estado.aoVivo && estado.sessionId) {
    return (
      <Assistir key={estado.sessionId} id={estado.sessionId} entrarComApelido={apelido.trim()} />
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
        <Aviso titulo="Ninguém usa esse link" texto="Confira se o endereço está certo." />
      </Centro>
    )
  }
  if (estado.fase === 'erro') {
    return (
      <Centro>
        <Aviso titulo="Não deu para abrir" texto={estado.mensagem} />
      </Centro>
    )
  }

  return (
    <Centro>
      <div className="grid w-full max-w-sm gap-6 p-8">
        <Aviso
          titulo={
            estado.jaTransmitiu
              ? `${estado.nome} encerrou a transmissão`
              : `${estado.nome} não está ao vivo agora`
          }
          texto="Deixe esta página aberta: ela entra na transmissão assim que começar."
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
      </div>
    </Centro>
  )
}
