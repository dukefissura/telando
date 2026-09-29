import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Resposta ao toque de todo botão: sobe 1px sob o mouse e afunda ao apertar, mais rápido na
 * descida. Só translate e scale; o reduced-motion do tema.css zera a transição.
 */
export const animacaoBotao =
  'transition-[color,background-color,border-color,box-shadow,opacity,translate,scale] duration-150 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.97] active:duration-75'

const VARIANTES = {
  primario: 'bg-destaque text-sobre-destaque hover:bg-destaque/90',
  secundario: 'border border-borda bg-superficie hover:bg-superficie-2',
  // Fundo mais escuro que o texto de erro: branco sobre #dc2626 dá 4,8:1 (AA).
  perigo: 'bg-parar-fundo text-white hover:bg-parar-fundo-forte',
  fantasma: 'text-texto-suave hover:bg-superficie-2 hover:text-texto',
}

const TAMANHOS = {
  normal: 'h-9 px-3 text-sm',
  grande: 'h-14 px-7 text-base',
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
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium ${animacaoBotao} disabled:pointer-events-none disabled:opacity-50 ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${className}`}
      {...props}
    />
  )
}

export function Alternador({
  rotulo,
  ligado,
  aoMudar,
  descricao,
  desabilitado = false,
}: {
  rotulo: string
  ligado: boolean
  aoMudar: (ligado: boolean) => void
  descricao?: string
  desabilitado?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span className="grid gap-0.5">
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
        className="relative mt-0.5 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-superficie-2 ring-1 ring-borda transition-colors duration-150 ring-inset before:absolute before:top-0.5 before:left-0.5 before:size-4 before:rounded-full before:bg-texto-suave before:transition-transform before:duration-150 before:content-[''] checked:bg-destaque checked:ring-destaque checked:before:translate-x-4 checked:before:bg-sobre-destaque disabled:opacity-50"
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
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm text-texto-suave">{rotulo}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg border border-borda bg-superficie p-1">
        {opcoes.map((opcao) => (
          <label
            key={String(opcao.valor)}
            title={opcao.dica}
            className={`flex-1 cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1.5 text-center text-sm ${animacaoBotao} has-focus-visible:outline-2 has-focus-visible:outline-destaque ${
              opcao.valor === valor
                ? 'bg-superficie-2 font-medium text-texto ring-1 ring-borda'
                : 'text-texto-suave hover:text-texto'
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name={rotulo}
              checked={opcao.valor === valor}
              onChange={() => aoMudar(opcao.valor)}
            />
            {opcao.texto}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Secao({
  titulo,
  aberta = false,
  children,
}: {
  titulo: string
  aberta?: boolean
  children: ReactNode
}) {
  return (
    <details open={aberta} className="group border-borda border-t py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md font-medium text-sm">
        {titulo}
        <span
          className="text-texto-suave transition-transform duration-150 group-open:rotate-90"
          aria-hidden
        >
          ›
        </span>
      </summary>
      <div className="mt-3 grid gap-4">{children}</div>
    </details>
  )
}

/** Campo de texto com o visual padrão; o rótulo fica sempre visível acima. */
export const classeCampo =
  'h-9 w-full rounded-lg border border-borda bg-superficie px-3 text-sm placeholder:text-texto-suave/70'
