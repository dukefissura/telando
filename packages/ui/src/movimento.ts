import type { MotionProps } from 'motion/react'

// Curvas e tempos do movimento do app: quem anima usa daqui, para as telas
// não divergirem.

/** Para movimentos de posição. */
export const MOLA_SUAVE = [0.2, 0.8, 0.2, 1] as const

/** Só para ícones e contadores que dão um pulo. */
export const ESTALO = [0.3, 1.6, 0.5, 1] as const

/** Entrada padrão de controles e cards. */
export const ENTRADA = { duration: 0.2, ease: 'easeOut' } as const

/** Saída padrão: mais rápida que a entrada. */
export const SAIDA = { opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } } as const

/** O endereço do canal e o selo do palco dividem o layoutId "selo-tela"; o voo usa esta transição. */
export const TRANSICAO_SELO = { duration: 0.35, delay: 0.1, ease: MOLA_SUAVE } as const

type Animacao = Pick<MotionProps, 'initial' | 'animate' | 'transition'>

/**
 * A TV de tubo que liga: uma linha de luz que abre até a imagem. Usada no vídeo de quem assiste e
 * no monitor de quem compartilha. O filter sai no fim: parado no ancestral do vídeo, ele tiraria o
 * vídeo do overlay de hardware.
 */
export const LIGAR_TV = {
  initial: { scaleX: 0, scaleY: 0.004, opacity: 0, filter: 'brightness(3)' },
  animate: {
    scaleX: [0, 1, 1],
    scaleY: [0.004, 0.004, 1],
    opacity: [0, 1, 1],
    filter: ['brightness(3)', 'brightness(3)', 'brightness(1)'],
    transitionEnd: { filter: 'none' },
  },
  transition: { duration: 0.42, times: [0, 0.43, 1], ease: MOLA_SUAVE },
} satisfies Animacao

/** O inverso: a imagem fecha numa linha, vira um ponto e some. */
export const DESLIGAR_TV = {
  initial: { scaleX: 1, scaleY: 1, filter: 'brightness(1)', opacity: 1 },
  animate: {
    scaleY: [1, 0.004, 0.004],
    scaleX: [1, 1, 0.004],
    filter: ['brightness(1)', 'brightness(3)', 'brightness(3)'],
    opacity: [1, 1, 0],
  },
  transition: { duration: 0.38, times: [0, 0.4, 1], ease: 'easeIn' },
} satisfies Animacao

/** Quanto a TV desligando dura até o aviso de fim entrar. */
export const DURACAO_DESLIGAR_TV_MS = 650
