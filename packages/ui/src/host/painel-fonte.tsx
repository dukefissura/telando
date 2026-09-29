import { Search } from 'lucide-react'
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
        className="vidro-video absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px]"
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

const classeMidia = 'size-full object-contain'

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
      className={`group grid gap-2 rounded-[14px] text-left ${animacaoBotao}`}
    >
      <span
        className={`relative block aspect-video overflow-hidden rounded-[14px] bg-superficie-2 after:pointer-events-none after:absolute after:inset-0 after:rounded-[14px] after:shadow-[inset_0_0_0_1px_var(--grupo-borda)] after:content-[''] ${
          escolhida
            ? 'shadow-[0_0_0_2px_var(--destaque),0_12px_28px_-12px_rgb(59_158_255/0.55)]'
            : ''
        }`}
      >
        {escolhida && previa ? (
          previa
        ) : (
          <img src={fonte.miniatura} alt="" className={classeMidia} />
        )}
      </span>
      <span
        className={`flex min-w-0 items-center gap-1.5 px-1 text-[13px] ${
          escolhida ? 'font-medium text-texto' : 'text-texto-suave group-hover:text-texto'
        }`}
      >
        {fonte.icone && <img src={fonte.icone} alt="" className="size-3.5 shrink-0" />}
        <span className="truncate">{fonte.nome}</span>
        {fonte.largura && fonte.altura && (
          <span className="ml-auto shrink-0 font-mono font-normal text-[11px] text-texto-suave">
            {fonte.largura}×{fonte.altura}
          </span>
        )}
      </span>
    </button>
  )
}

export function PainelFonte({
  titulo,
  lista,
  escolhida,
  aoEscolher,
  comPrevia = false,
}: {
  titulo: string
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
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-[15px]">{titulo}</h2>
        <label className="relative w-[220px] max-w-[50%]">
          <Search
            size={14}
            aria-hidden
            className="absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave"
          />
          <input
            type="search"
            placeholder="Buscar janela"
            aria-label="Buscar janela"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 w-full rounded-full bg-preenchimento pr-3 pl-8 text-[13px] placeholder:text-texto-suave"
          />
        </label>
      </div>
      {lista.length === 0 ? (
        <p className="text-sm text-texto-suave">Procurando telas e janelas…</p>
      ) : (
        <>
          <div className="grid gap-2.5">
            <h3 className="font-medium text-texto-suave text-xs">Telas</h3>
            <div className="grid grid-cols-3 gap-3.5">{telas.map(cartao)}</div>
          </div>
          <div className="grid gap-2.5">
            <h3 className="font-medium text-texto-suave text-xs">Janelas</h3>
            <div className="grid grid-cols-3 gap-3.5">{janelas.map(cartao)}</div>
            {janelas.length === 0 && (
              <p className="text-texto-suave text-xs">Nenhuma janela com esse nome.</p>
            )}
          </div>
        </>
      )}
    </>
  )
}
