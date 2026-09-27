import { useTransmissao } from './use-transmissao.ts'

export function PaginaCompartilhar() {
  const { transmissao, iniciar, parar, copiarLink } = useTransmissao()

  if (transmissao.fase === 'ao-vivo') {
    const { link, copiado, comAudio, espectadores } = transmissao
    return (
      <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-8 p-8">
        <div className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full bg-ao-vivo" aria-hidden />
          <span className="font-medium text-ao-vivo tracking-wide">AO VIVO</span>
          <span className="text-texto-suave" data-testid="espectadores">
            · {espectadores === 1 ? '1 pessoa assistindo' : `${espectadores} pessoas assistindo`}
          </span>
        </div>

        <div className="grid gap-2">
          <label htmlFor="link" className="text-sm text-texto-suave">
            {copiado
              ? 'Link copiado. É só mandar para quem vai assistir.'
              : 'Mande este link para quem vai assistir.'}
          </label>
          <div className="flex gap-2">
            <input
              id="link"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-borda bg-superficie px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              onClick={copiarLink}
              className="rounded-lg border border-borda px-4 py-2 text-sm hover:bg-superficie"
            >
              Copiar
            </button>
          </div>
        </div>

        {!comAudio && (
          <p className="text-sm text-texto-suave">
            Sem áudio: o navegador não mandou som. Para incluir, marque “Compartilhar áudio” no
            seletor; no Windows isso funciona com a tela inteira ou com uma aba.
          </p>
        )}

        <button
          type="button"
          onClick={parar}
          className="justify-self-start rounded-lg bg-parar px-4 py-2 font-medium text-sm text-white"
        >
          Parar
        </button>
      </main>
    )
  }

  const iniciando = transmissao.fase === 'iniciando'
  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-6 p-8">
      <div className="grid gap-2">
        <h1 className="font-semibold text-3xl tracking-tight">Telando</h1>
        <p className="text-texto-suave">Mostre sua tela para quem tiver o link.</p>
      </div>
      <button
        type="button"
        onClick={iniciar}
        disabled={iniciando}
        className="justify-self-start rounded-lg bg-texto px-5 py-3 font-medium text-fundo disabled:opacity-60"
      >
        {iniciando ? 'Escolha o que compartilhar…' : 'Compartilhar tela'}
      </button>
      {transmissao.fase === 'erro' && (
        <p role="alert" className="text-sm text-parar">
          {transmissao.mensagem}
        </p>
      )}
    </main>
  )
}
