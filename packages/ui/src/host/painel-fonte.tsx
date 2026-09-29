import { motion } from 'motion/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { animacaoBotao } from '../controles.tsx'
import { ENTRADA } from '../movimento.ts'
import type { FonteDeCaptura, Plataforma } from '../plataforma.ts'

type Fontes = Plataforma['fontes']

// A captura de tela do Chromium entrega no máximo uns 60 quadros por segundo, qualquer que seja o
// monitor; o selo da prévia não promete mais que isso.
const TETO_FPS_CAPTURA = 60

/** Lista telas e janelas, com miniaturas que se atualizam a cada segundo enquanto estiver aberto. */
export function useFontes(fontes: Fontes | undefined) {
  const [lista, setLista] = useState<FonteDeCaptura[]>([])
  useEffect(() => {
    if (!fontes) return
    let ativo = true
    const atualizar = async () => {
      const novas = await fontes.listar()
      if (ativo) setLista(novas)
    }
    void atualizar()
    const intervalo = setInterval(atualizar, 1000)
    return () => {
      ativo = false
      clearInterval(intervalo)
    }
  }, [fontes])
  return lista
}

/**
 * A fonte escolhida ao vivo, no lugar da miniatura: o que quem assiste vai ver, sem o atraso de um
 * quadro por segundo. É uma captura só de vídeo, que para quando a fonte muda ou o card sai.
 */
function PreviaAoVivo({ fonte, className }: { fonte: FonteDeCaptura; className: string }) {
  const refVideo = useRef<HTMLVideoElement>(null)
  const [falhou, setFalhou] = useState(false)
  const { id, frequencia } = fonte

  // biome-ignore lint/correctness/useExhaustiveDependencies: trocar de fonte (id) reinicia a captura; o main responde com a fonte escolhida
  useEffect(() => {
    let ativo = true
    let fluxo: MediaStream | null = null
    setFalhou(false)
    navigator.mediaDevices
      .getDisplayMedia({ video: { frameRate: { ideal: frequencia } }, audio: false })
      .then((capturado) => {
        fluxo = capturado
        if (!ativo) {
          for (const trilha of capturado.getTracks()) trilha.stop()
          return
        }
        // A janela capturada fechou (ou saiu da tela): mostra a miniatura em vez de um quadro congelado.
        capturado.getVideoTracks()[0]?.addEventListener('ended', () => ativo && setFalhou(true))
        if (refVideo.current) refVideo.current.srcObject = capturado
      })
      .catch(() => {
        // A janela pode ter fechado entre escolher e capturar; a miniatura da grade continua valendo.
        if (ativo) setFalhou(true)
      })
    return () => {
      ativo = false
      for (const trilha of fluxo?.getTracks() ?? []) trilha.stop()
    }
  }, [id, frequencia])

  if (falhou) return <img src={fonte.miniatura} alt="" className={className} />
  return (
    <>
      <video
        ref={refVideo}
        autoPlay
        muted
        playsInline
        aria-label={`Prévia ao vivo de ${fonte.nome}`}
        className={className}
      />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={ENTRADA}
        className="absolute top-1.5 left-1.5 inline-flex items-center gap-1.5 rounded bg-fundo/80 px-1.5 py-0.5 font-mono text-[10px]"
      >
        <span
          className="size-[5px] animate-pulse rounded-full bg-texto motion-reduce:animate-none"
          aria-hidden
        />
        prévia · {Math.min(frequencia, TETO_FPS_CAPTURA)} fps
      </motion.span>
    </>
  )
}

const classeMidia = 'aspect-video w-full rounded object-contain bg-black'

function CartaoFonte({
  fonte,
  escolhida,
  aoEscolher,
  previa,
}: {
  fonte: FonteDeCaptura
  escolhida: boolean
  aoEscolher: () => void
  previa: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={escolhida}
      className={`grid gap-1.5 rounded-lg border p-1.5 text-left ${animacaoBotao} ${
        escolhida
          ? 'border-texto bg-superficie-2 ring-1 ring-texto'
          : 'border-borda hover:bg-superficie'
      }`}
    >
      <span className="relative block">
        {escolhida && previa ? (
          previa
        ) : (
          <img src={fonte.miniatura} alt="" className={classeMidia} />
        )}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-xs">
        {fonte.icone && <img src={fonte.icone} alt="" className="size-3.5 shrink-0" />}
        <span className="truncate">{fonte.nome}</span>
        {fonte.largura && fonte.altura && (
          <span className="ml-auto shrink-0 font-mono text-texto-suave">
            {fonte.largura}×{fonte.altura}
          </span>
        )}
      </span>
    </button>
  )
}

export function PainelFonte({
  lista,
  escolhida,
  aoEscolher,
  comPrevia = false,
}: {
  lista: FonteDeCaptura[]
  escolhida: string | null
  aoEscolher: (fonte: FonteDeCaptura) => void
  /** A fonte escolhida roda ao vivo dentro do próprio card (uma captura por vez). */
  comPrevia?: boolean
}) {
  const [busca, setBusca] = useState('')
  const telas = lista.filter((fonte) => fonte.tipo === 'tela')
  const janelas = lista.filter(
    (fonte) =>
      fonte.tipo === 'janela' && fonte.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  )

  if (lista.length === 0) {
    return <p className="text-sm text-texto-suave">Procurando telas e janelas…</p>
  }

  const cartao = (fonte: FonteDeCaptura) => (
    <CartaoFonte
      key={fonte.id}
      fonte={fonte}
      escolhida={fonte.id === escolhida}
      aoEscolher={() => aoEscolher(fonte)}
      previa={comPrevia && <PreviaAoVivo fonte={fonte} className={classeMidia} />}
    />
  )

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <h3 className="text-sm text-texto-suave">Telas</h3>
        <div className="grid grid-cols-3 gap-2">{telas.map(cartao)}</div>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm text-texto-suave">Janelas</h3>
          <input
            type="search"
            placeholder="Buscar janela"
            aria-label="Buscar janela"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-40 rounded-md border border-borda bg-superficie px-2 py-1 text-xs"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">{janelas.map(cartao)}</div>
        {janelas.length === 0 && (
          <p className="text-xs text-texto-suave">Nenhuma janela com esse nome.</p>
        )}
      </div>
    </div>
  )
}
