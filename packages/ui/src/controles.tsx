import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ButtonHTMLAttributes, type ReactNode, useId, useState } from 'react'
import { ENTRADA, MOLA_SUAVE } from './movimento.ts'

/**
 * Resposta ao toque de todo botão: sobe 1px sob o mouse e afunda ao apertar, mais rápido na
 * descida. Só translate e scale; o reduced-motion do tema.css zera a transição.
 */
export const animacaoBotao =
  'transition-[color,background-color,border-color,box-shadow,opacity,translate,scale,filter] duration-150 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.97] active:duration-75'

const VARIANTES = {
  primario:
    'bg-[linear-gradient(180deg,var(--destaque-claro),var(--destaque))] font-semibold text-sobre-destaque shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_10px_24px_-10px_rgb(59_158_255/0.6)] hover:brightness-105',
  secundario: 'border border-vidro-borda bg-preenchimento hover:bg-preenchimento-forte',
  // Fundo mais escuro que o texto de erro: branco sobre #dc2626 dá 4,8:1 (AA).
  perigo:
    'bg-parar-fundo font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-parar-fundo-forte',
  fantasma: 'text-texto-suave hover:bg-preenchimento hover:text-texto',
  /** Como o fantasma, mas no texto cheio: os itens da barra de ações. */
  discreto: 'text-texto hover:bg-preenchimento',
  /** O contrário do fundo: uma ação só, dentro de uma cápsula de vidro. */
  invertido: 'bg-texto text-fundo hover:bg-texto/90',
}

const TAMANHOS = {
  /** Dentro de linhas de lista. */
  compacto: 'h-8 px-3.5 text-[13px]',
  normal: 'h-9 px-4 text-sm',
  /** Barra de ações e card de links. */
  barra: 'h-10 px-3.5 text-[13px]',
  grande: 'h-[52px] px-7 text-base',
}

export function Botao({
  variante = 'secundario',
  tamanho = 'normal',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof VARIANTES
  tamanho?: keyof typeof TAMANHOS
}) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium ${animacaoBotao} disabled:pointer-events-none disabled:opacity-50 ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${className}`}
      {...props}
    />
  )
}

const TAMANHOS_ICONE = {
  pequeno:
    'size-8 border border-vidro-borda bg-preenchimento shadow-[inset_0_1px_0_var(--vidro-brilho)]',
  normal:
    'size-9 border border-vidro-borda bg-preenchimento shadow-[inset_0_1px_0_var(--vidro-brilho)]',
  /** Dentro de uma barra de vidro: o vidro já é a borda. */
  barra: 'size-10 hover:bg-preenchimento',
}

/** Botão redondo só com ícone; o rótulo vai no nome acessível e na dica. */
export function BotaoIcone({
  rotulo,
  tamanho = 'normal',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  rotulo: string
  tamanho?: keyof typeof TAMANHOS_ICONE
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      className={`grid shrink-0 place-items-center rounded-full text-texto-suave hover:text-texto ${animacaoBotao} disabled:pointer-events-none disabled:opacity-50 ${TAMANHOS_ICONE[tamanho]} ${className}`}
      {...props}
    />
  )
}

/** Lista agrupada: rótulo pequeno acima e as linhas num bloco só, como nos Ajustes do sistema. */
export function Grupo({
  rotulo,
  acessorio,
  className = '',
  children,
}: {
  rotulo?: string
  /** Ao lado do rótulo (um contador, por exemplo). */
  acessorio?: ReactNode
  className?: string
  children: ReactNode
}) {
  const bloco = <div className={`grupo ${className}`}>{children}</div>
  if (!rotulo) return bloco
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 flex items-center gap-1.5 pl-4 text-texto-suave text-xs">
        {rotulo}
        {acessorio}
      </legend>
      {bloco}
    </fieldset>
  )
}

export function LinhaDeGrupo({
  icone: Icone,
  children,
  valor,
  acessorio,
  destaque = false,
}: {
  icone: LucideIcon
  children: ReactNode
  /** Resumo à direita, em mono. */
  valor?: ReactNode
  acessorio?: ReactNode
  /** A linha que pede atenção (a sugestão de link). */
  destaque?: boolean
}) {
  return (
    <div
      className={`flex min-h-12 items-center gap-3 py-2 pr-3.5 pl-4 text-sm ${destaque ? 'bg-destaque/6' : ''}`}
    >
      <Icone
        size={17}
        strokeWidth={1.75}
        aria-hidden
        className={`shrink-0 ${destaque ? 'text-destaque' : 'text-texto-suave'}`}
      />
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      {valor !== undefined && (
        <span className="shrink-0 font-mono text-texto-suave text-xs">{valor}</span>
      )}
      {acessorio}
    </div>
  )
}

/** Começa depois do ícone da linha, como nas listas do sistema. */
export function Separador({ larguraTotal = false }: { larguraTotal?: boolean }) {
  return <div aria-hidden className={`h-px bg-grupo-linha ${larguraTotal ? '' : 'ml-[45px]'}`} />
}

/** Abre espaço e depois aparece, sem empurrar o resto de uma vez. */
export function AbreEspaco({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <motion.div
      className="grid"
      initial={{ gridTemplateRows: '0fr', opacity: 0 }}
      animate={{ gridTemplateRows: '1fr', opacity: 1 }}
      exit={{ gridTemplateRows: '0fr', opacity: 0 }}
      transition={ENTRADA}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={className}>{children}</div>
      </div>
    </motion.div>
  )
}

const classeInterruptor =
  "relative h-6 w-[42px] shrink-0 cursor-pointer appearance-none rounded-full bg-preenchimento-forte ring-1 ring-vidro-borda ring-inset transition-colors duration-150 before:absolute before:top-0.5 before:left-0.5 before:size-5 before:rounded-full before:bg-white before:shadow-[0_2px_4px_rgb(0_0_0/0.3)] before:transition-transform before:duration-150 before:content-[''] checked:bg-destaque checked:ring-destaque checked:before:translate-x-[18px] disabled:opacity-50"

export function Alternador({
  rotulo,
  ligado,
  aoMudar,
  descricao,
  desabilitado = false,
  icone: Icone,
}: {
  rotulo: string
  ligado: boolean
  aoMudar: (ligado: boolean) => void
  descricao?: ReactNode
  desabilitado?: boolean
  /** Com ícone, vira uma linha de grupo. */
  icone?: LucideIcon
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-3 ${Icone ? 'min-h-12 py-2 pr-3.5 pl-4' : 'py-1'}`}
    >
      {Icone && (
        <Icone size={17} strokeWidth={1.75} aria-hidden className="shrink-0 text-texto-suave" />
      )}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-sm">{rotulo}</span>
        {descricao && <span className="text-texto-suave text-xs">{descricao}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={ligado}
        checked={ligado}
        disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.checked)}
        className={classeInterruptor}
      />
    </label>
  )
}

export function Segmentado<T extends string | number>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string
  opcoes: ReadonlyArray<{ valor: T; texto: string; dica?: string }>
  valor: T | null
  aoMudar: (valor: T) => void
}) {
  // O destaque desliza entre os segmentos; cada segmentado precisa do próprio layoutId.
  const id = useId()
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 pl-4 text-texto-suave text-xs">{rotulo}</legend>
      <div className="grid auto-cols-[minmax(0,1fr)] grid-flow-col gap-0.5 rounded-xl bg-preenchimento p-[3px]">
        {opcoes.map((opcao) => {
          const escolhido = opcao.valor === valor
          return (
            <label
              key={String(opcao.valor)}
              title={opcao.dica}
              className={`relative min-w-0 cursor-pointer truncate rounded-[9px] px-1 py-[7px] text-center text-[13px] ${animacaoBotao} has-focus-visible:outline-2 has-focus-visible:outline-destaque ${
                escolhido ? 'font-medium text-texto' : 'text-texto-suave hover:text-texto'
              }`}
            >
              {escolhido && (
                <motion.span
                  layoutId={`segmento-${id}`}
                  aria-hidden
                  transition={{ duration: 0.25, ease: MOLA_SUAVE }}
                  className="absolute inset-0 rounded-[9px] bg-preenchimento-forte shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_2px_6px_rgb(0_0_0/0.3)]"
                />
              )}
              <input
                type="radio"
                className="sr-only"
                name={rotulo}
                checked={escolhido}
                onChange={() => aoMudar(opcao.valor)}
              />
              <span className="relative">{opcao.texto}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * Linha de grupo que abre: ícone, título, o resumo à direita e a seta. O conteúdo entra no mesmo
 * grupo, abaixo de um separador.
 */
export function Secao({
  titulo,
  icone,
  valor,
  aberta: abertaNoInicio = false,
  children,
}: {
  titulo: string
  icone: LucideIcon
  valor?: ReactNode
  aberta?: boolean
  children: ReactNode
}) {
  const [aberta, setAberta] = useState(abertaNoInicio)
  const id = useId()
  return (
    <div>
      <button
        type="button"
        aria-expanded={aberta}
        aria-controls={id}
        onClick={() => setAberta(!aberta)}
        className="block w-full text-left transition-colors duration-150 hover:bg-preenchimento"
      >
        <LinhaDeGrupo
          icone={icone}
          valor={valor}
          acessorio={
            <ChevronRight
              size={16}
              aria-hidden
              className={`shrink-0 text-texto-suave transition-transform duration-150 ${aberta ? 'rotate-90' : ''}`}
            />
          }
        >
          <span className="font-medium">{titulo}</span>
        </LinhaDeGrupo>
      </button>
      <AnimatePresence initial={false}>
        {aberta && (
          <AbreEspaco key="conteudo">
            <div id={id}>
              <Separador />
              <div className="grid gap-4 px-4 pt-3 pb-4">{children}</div>
            </div>
          </AbreEspaco>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Campo com o visual padrão, fora de grupo; o rótulo fica sempre visível acima. */
export const classeCampo =
  'h-10 w-full rounded-xl border border-grupo-borda bg-grupo px-3.5 text-sm placeholder:text-texto-suave/70'

/** Campo dentro de uma linha de grupo: sem borda nem fundo; o foco vai para o grupo. */
export const classeCampoEmGrupo =
  'h-8 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-texto-suave/70'

const CORES_AVATAR = [
  'bg-destaque text-sobre-destaque',
  'bg-texto text-fundo',
  'bg-texto-suave text-fundo',
]

/** A inicial de quem está na sala; as cores giram pela ordem de chegada. */
export function Avatar({
  nome,
  indice = 0,
  className,
}: {
  nome: string
  indice?: number
  /** Tamanho e fonte. */
  className: string
}) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${CORES_AVATAR[indice % CORES_AVATAR.length]} ${className}`}
    >
      {/* Por ponto de código: um apelido que começa com emoji não pode virar meio caractere. */}
      {Array.from(nome.trim())[0]?.toUpperCase()}
    </span>
  )
}
