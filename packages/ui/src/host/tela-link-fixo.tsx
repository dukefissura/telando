import { mensagemDoErro } from '@telando/core'
import { type FormEvent, useState } from 'react'
import { Botao, classeCampo } from '../controles.tsx'
import type { MeuLinkFixo, Plataforma } from '../plataforma.ts'

export function TelaLinkFixo({
  plataforma,
  atual,
  aoSalvar,
  aoVoltar,
}: {
  plataforma: Plataforma
  atual: MeuLinkFixo | null
  aoSalvar: (link: MeuLinkFixo) => void
  aoVoltar: () => void
}) {
  const [nome, setNome] = useState(atual?.nome ?? '')
  const [slug, setSlug] = useState(atual?.slug ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const segredo = await plataforma.linkFixo.segredo()
      const { url } = await plataforma.api.reservarLink(slug, segredo, nome.trim())
      const link = { slug, nome: nome.trim(), url }
      await plataforma.linkFixo.gravar(link)
      aoSalvar(link)
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não consegui salvar o link. Tente de novo.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="mx-auto grid max-w-xl gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-semibold text-lg">Meu link fixo</h1>
        <Botao variante="fantasma" onClick={aoVoltar}>
          Voltar
        </Botao>
      </header>

      <p className="text-sm text-texto-suave">
        Um endereço que seus amigos salvam nos favoritos. Quando você não estiver ao vivo, eles veem
        um aviso e entram sozinhos assim que você começar.
      </p>

      {atual && (
        <p className="grid gap-1 text-sm">
          <span className="text-texto-suave">Seu link agora</span>
          <span className="font-mono">{atual.url}</span>
        </p>
      )}

      <form onSubmit={salvar} className="grid gap-4">
        <label className="grid gap-1.5 text-sm">
          <span className="text-texto-suave">Seu nome (aparece para quem abrir o link)</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={32}
            required
            className={classeCampo}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-texto-suave">
            Endereço (3 a 20 letras minúsculas, números ou hífen)
          </span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            minLength={3}
            maxLength={20}
            required
            className={`${classeCampo} font-mono`}
          />
        </label>
        <Botao type="submit" variante="primario" disabled={salvando} className="justify-self-start">
          {salvando ? 'Salvando…' : 'Salvar link'}
        </Botao>
        {erro && (
          <p role="alert" className="text-parar text-sm">
            {erro}
          </p>
        )}
      </form>
    </main>
  )
}
