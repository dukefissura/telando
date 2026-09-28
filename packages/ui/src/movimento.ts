// Curvas e tempos do handoff de movimento (docs/design.md): quem anima usa daqui, para as telas
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
