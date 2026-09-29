import { useAnimationFrame, useReducedMotion } from 'motion/react'
import { type RefObject, useId, useRef } from 'react'

/**
 * Fundo do Início: luz central pulsando, 8 focos pulsando fora de ordem e o destaque passando pelas
 * 6 cores, com cross-fade. Tudo é escrito direto no DOM (CSS vars e style), sem re-render do React.
 * Com "reduzir movimento": cor do tema, luz parada e sem focos.
 */

type Paleta = { cor: string; topo: string; fundo: string }

const PALETAS = {
  azul: { cor: '#3b9eff', topo: '#7cc0ff', fundo: '#0b6bdb' },
  violeta: { cor: '#8b7cff', topo: '#b8adff', fundo: '#4b3fd1' },
  ambar: { cor: '#ffb547', topo: '#ffd08a', fundo: '#c77700' },
  magenta: { cor: '#ff5fa2', topo: '#ff9cc6', fundo: '#c21a60' },
  lima: { cor: '#c6f432', topo: '#e0ff8a', fundo: '#8fb800' },
  turquesa: { cor: '#2dd4bf', topo: '#86efe0', fundo: '#0d9488' },
} satisfies Record<string, Paleta>

// 7 fatias de 2,5s: a 1ª é azul parado, cada seguinte dissolve na próxima cor, e a 7ª volta ao azul
// para o ciclo fechar sem pulo.
const FATIA = 2.5
const SEQUENCIA: Paleta[] = [
  PALETAS.azul,
  PALETAS.violeta,
  PALETAS.ambar,
  PALETAS.magenta,
  PALETAS.lima,
  PALETAS.turquesa,
  PALETAS.azul,
]
const TOTAL = FATIA * SEQUENCIA.length
const TROCA = 1.1

/** Focos em coordenadas de uma tela 1920×1080 (viram % da janela); k = ciclos inteiros por TOTAL. */
const FOCOS = [
  { x: 260, y: 180, r: 420, k: 3, fase: 0.05 },
  { x: 1680, y: 900, r: 480, k: 4, fase: 0.62 },
  { x: 1500, y: 330, r: 360, k: 5, fase: 0.31 },
  { x: 420, y: 760, r: 380, k: 3, fase: 0.71 },
  { x: 960, y: 290, r: 340, k: 7, fase: 0.44 },
  { x: 1780, y: 160, r: 400, k: 4, fase: 0.18 },
  { x: 140, y: 620, r: 440, k: 5, fase: 0.87 },
  { x: 1180, y: 860, r: 360, k: 6, fase: 0.53 },
]

// O movimento é lento (um ciclo leva 17,5s): 30 quadros por segundo bastam, e escrever estilo a cada
// quadro de um monitor de 180 Hz faria o desfoque do painel ser recalculado 180 vezes por segundo.
const INTERVALO_MS = 1000 / 30

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)

/** 7 pulsos por ciclo (um por fatia), com smoothstep no topo. */
function pulsoCentral(t: number) {
  const x = 0.5 - 0.5 * Math.cos((t / TOTAL) * SEQUENCIA.length * Math.PI * 2)
  return x * x * (3 - 2 * x)
}

/** Pico curto (cos³) e descanso longo; os k inteiros fazem o ciclo fechar. */
function pulsoDoFoco(t: number, k: number, fase: number) {
  return Math.max(0, Math.cos(((t / TOTAL) * k - fase) * Math.PI * 2)) ** 3
}

function hexParaRgb(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}

/** Mistura linear em sRGB: o mesmo resultado do cross-fade de duas camadas opacas. */
function misturar(a: string, b: string, p: number) {
  const [ra, ga, ba] = hexParaRgb(a)
  const [rb, gb, bb] = hexParaRgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * p)
  return `rgb(${c(ra, rb)} ${c(ga, gb)} ${c(ba, bb)})`
}

function paletaEm(t: number): Paleta {
  const ciclo = ((t % TOTAL) + TOTAL) % TOTAL
  const i = Math.min(SEQUENCIA.length - 1, Math.floor(ciclo / FATIA))
  const destino = SEQUENCIA[i] ?? PALETAS.azul
  const origem = SEQUENCIA[(i - 1 + SEQUENCIA.length) % SEQUENCIA.length] ?? PALETAS.azul
  const p = i === 0 ? 1 : easeInOutCubic(Math.min(1, (ciclo - i * FATIA) / TROCA))
  return {
    cor: misturar(origem.cor, destino.cor, p),
    topo: misturar(origem.topo, destino.topo, p),
    fundo: misturar(origem.fundo, destino.fundo, p),
  }
}

function aplicarLuz(no: HTMLDivElement | null, pulso: number, cresce: number, minimo: number) {
  if (!no) return
  no.style.opacity = String(minimo + (1 - minimo) * pulso)
  no.style.transform = `scale(${1 + cresce * pulso})`
}

/**
 * Anima a raiz do Início: escreve --destaque, --destaque-topo e --destaque-fundo nela, e a opacidade
 * e a escala das luzes. Os filhos só leem var(--destaque…). O requestAnimationFrame para sozinho com
 * a janela escondida.
 */
export function useFundoPulsante(
  raiz: RefObject<HTMLElement | null>,
  luzes: {
    centro: RefObject<HTMLDivElement | null>
    painel: RefObject<HTMLDivElement | null>
    focos: RefObject<(HTMLDivElement | null)[]>
  },
) {
  const reduzir = useReducedMotion()
  const ultimo = useRef(Number.NEGATIVE_INFINITY)
  const parado = useRef(false)

  // O tempo já vem contado desde o primeiro quadro.
  useAnimationFrame((agora) => {
    const el = raiz.current
    // A folga de 2ms é o jitter do quadro: sem ela, a 60 Hz metade dos quadros pares cai fora e a
    // animação anda a 20.
    if (!el || agora - ultimo.current < INTERVALO_MS - 2) return
    ultimo.current = agora
    if (reduzir) {
      // Parado não muda: escreve uma vez só.
      if (parado.current) return
      parado.current = true
      el.style.removeProperty('--destaque')
      el.style.removeProperty('--destaque-topo')
      el.style.removeProperty('--destaque-fundo')
      aplicarLuz(luzes.centro.current, 0.6, 0.25, 0.2)
      aplicarLuz(luzes.painel.current, 0.6, 0.2, 0.2)
      for (const foco of luzes.focos.current) if (foco) foco.style.opacity = '0'
      return
    }
    parado.current = false
    const t = agora / 1000
    const paleta = paletaEm(t)
    el.style.setProperty('--destaque', paleta.cor)
    el.style.setProperty('--destaque-topo', paleta.topo)
    el.style.setProperty('--destaque-fundo', paleta.fundo)
    const pulso = pulsoCentral(t)
    aplicarLuz(luzes.centro.current, pulso, 0.25, 0.2)
    aplicarLuz(luzes.painel.current, pulso, 0.2, 0.2)
    for (const [i, foco] of FOCOS.entries()) {
      const no = luzes.focos.current[i]
      if (!no) continue
      const v = pulsoDoFoco(t, foco.k, foco.fase)
      no.style.opacity = String(v)
      no.style.transform = `translate(-50%, -50%) scale(${0.8 + 0.35 * v})`
    }
  })
}

/** O fundo da janela inteira, atrás do painel de vidro. */
export function FundoPulsante({
  centro,
  focos,
}: {
  centro: RefObject<HTMLDivElement | null>
  focos: RefObject<(HTMLDivElement | null)[]>
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={centro}
        className="absolute inset-0 origin-[50%_26%]"
        style={{
          background:
            'radial-gradient(45% 55% at 50% 26%, color-mix(in srgb, var(--destaque) 40%, transparent), transparent 70%)',
        }}
      />
      {FOCOS.map((foco, i) => (
        <div
          key={`${foco.x}-${foco.y}`}
          ref={(no) => {
            focos.current[i] = no
          }}
          className="absolute rounded-full opacity-0"
          style={{
            left: `${(foco.x / 1920) * 100}%`,
            top: `${(foco.y / 1080) * 100}%`,
            width: `${((foco.r * 2) / 1920) * 100}vw`,
            height: `${((foco.r * 2) / 1920) * 100}vw`,
            transform: 'translate(-50%, -50%) scale(0.8)',
            background:
              'radial-gradient(closest-side, color-mix(in srgb, var(--destaque) 45%, transparent), transparent)',
          }}
        />
      ))}
    </div>
  )
}

/** O ícone 2a com as cores do destaque atual: as paradas do gradiente leem as CSS vars. */
export function IconeColorido() {
  // O id vira parte de url(#…); os dois-pontos do useId quebrariam a referência.
  const u = useId().replace(/:/g, '')
  return (
    <svg
      width={96}
      height={96}
      viewBox="0 0 256 256"
      aria-hidden
      style={{
        filter:
          'drop-shadow(0 18px 30px color-mix(in srgb, var(--destaque-fundo) 33%, transparent))',
      }}
    >
      <defs>
        <linearGradient id={`d${u}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A2A2A" />
          <stop offset="1" stopColor="#0A0A0A" />
        </linearGradient>
        <linearGradient id={`g${u}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--destaque-topo)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--destaque)' }} />
          <stop offset="1" style={{ stopColor: 'var(--destaque-fundo)' }} />
        </linearGradient>
        <linearGradient id={`v${u}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`r${u}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`s${u}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c${u}`}>
          <rect x="84" y="100" width="128" height="96" rx="24" />
        </clipPath>
        <filter id={`b${u}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <path
        d="M62 8H194C230 8 248 26 248 62V194C248 230 230 248 194 248H62C26 248 8 230 8 194V62C8 26 26 8 62 8Z"
        fill={`url(#d${u})`}
      />
      <rect x="46" y="58" width="126" height="94" rx="22" fill={`url(#g${u})`} />
      <rect x="46" y="58" width="126" height="94" rx="22" fill={`url(#s${u})`} />
      <g clipPath={`url(#c${u})`}>
        <rect
          x="46"
          y="58"
          width="126"
          height="94"
          rx="22"
          style={{ fill: 'var(--destaque)' }}
          filter={`url(#b${u})`}
        />
      </g>
      <rect
        x="84"
        y="100"
        width="128"
        height="96"
        rx="24"
        fill={`url(#v${u})`}
        stroke={`url(#r${u})`}
        strokeWidth="2"
      />
    </svg>
  )
}
