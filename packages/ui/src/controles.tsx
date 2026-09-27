import type { ButtonHTMLAttributes, ReactNode } from 'react'

const VARIANTES = {
  primario: 'bg-texto text-fundo hover:bg-white',
  secundario: 'border border-borda hover:bg-superficie-2',
  perigo: 'bg-parar text-white hover:brightness-110',
  fantasma: 'text-texto-suave hover:text-texto hover:bg-superficie-2',
}

export function Botao({
  variante = 'secundario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: keyof typeof VARIANTES }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium text-sm transition-colors disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
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
    <label className="flex items-start justify-between gap-4 py-1">
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
        className="mt-0.5 size-4 accent-texto"
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
      <div className="flex flex-wrap gap-1 rounded-lg bg-superficie p-1">
        {opcoes.map((opcao) => (
          <label
            key={String(opcao.valor)}
            title={opcao.dica}
            className={`flex-1 cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1.5 text-center text-sm has-[:focus-visible]:outline-2 ${
              opcao.valor === valor
                ? 'bg-superficie-2 text-texto'
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
      <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-sm">
        {titulo}
        <span className="text-texto-suave transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="mt-3 grid gap-4">{children}</div>
    </details>
  )
}
