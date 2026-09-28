import { type ConfigTransmissao, formatarMbps, uploadNecessarioKbps } from '@telando/core'
import {
  codecsDoHost,
  type Estatisticas,
  type Remetente,
  useChatSala,
  type useTransmissao,
} from '@telando/core/cliente'
import { useState } from 'react'
import { useAtalhosDaJanela } from '../atalhos.ts'
import { Alternador, Botao, Secao } from '../controles.tsx'
import type { FonteDeCaptura, Plataforma } from '../plataforma.ts'
import { PainelChat } from '../sala/painel-chat.tsx'
import { BotoesDeReacao, ColunaDeReacoes } from '../sala/reacoes.tsx'
import { PainelAudio, PainelVideo } from './paineis.tsx'
import { PainelFonte, useFontes } from './painel-fonte.tsx'
import { useMicrofones } from './use-microfones.ts'

type Controle = ReturnType<typeof useTransmissao>

const TEXTO_LIMITACAO = {
  banda: 'A qualidade baixou porque falta banda de upload.',
  cpu: 'A qualidade baixou porque o computador não está dando conta de codificar.',
}

function PainelEstatisticas({ estatisticas }: { estatisticas: Estatisticas | null }) {
  if (!estatisticas) return <p className="text-sm text-texto-suave">Medindo…</p>
  const linhas: Array<[string, string]> = [
    ['Resolução', `${estatisticas.largura}×${estatisticas.altura}`],
    ['Quadros', `${estatisticas.fps} fps`],
    ['Vídeo', formatarMbps(estatisticas.videoKbps)],
    ['Áudio', `${estatisticas.audioKbps} kbps`],
    ['Codec', estatisticas.codec ?? '—'],
    ['Perda de pacotes', `${estatisticas.perdaPct.toLocaleString('pt-BR')}%`],
  ]
  if (estatisticas.cpuPct !== null)
    linhas.push(['CPU do app', `${Math.round(estatisticas.cpuPct)}%`])

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" data-testid="estatisticas">
      {linhas.map(([nome, valor]) => (
        <div key={nome} className="contents">
          <dt className="text-texto-suave">{nome}</dt>
          <dd className="text-right font-mono tabular-nums">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

function CampoLink({
  id,
  rotulo,
  url,
  destaque,
  aoCopiar,
}: {
  id: string
  rotulo: string
  url: string
  destaque: boolean
  aoCopiar: (url: string) => void
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-texto-suave text-xs">
        {rotulo}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className={`min-w-0 flex-1 rounded-lg border border-borda bg-superficie px-3 font-mono ${destaque ? 'py-2.5 text-base' : 'py-1.5 text-sm'}`}
        />
        <Botao onClick={() => aoCopiar(url)}>Copiar</Botao>
      </div>
    </div>
  )
}

/** Dois bipes curtos e baixos: dá para notar sem assustar ninguém em call. */
function tocarAvisoDePedido() {
  const contexto = new AudioContext()
  const volume = contexto.createGain()
  volume.gain.value = 0.05
  volume.connect(contexto.destination)
  for (const [indice, frequencia] of [660, 880].entries()) {
    const oscilador = contexto.createOscillator()
    oscilador.frequency.value = frequencia
    oscilador.connect(volume)
    const inicio = contexto.currentTime + indice * 0.15
    oscilador.start(inicio)
    oscilador.stop(inicio + 0.1)
  }
  setTimeout(() => void contexto.close(), 500)
}

export function TelaCompartilhando({
  plataforma,
  controle,
  aoMudarConfig,
}: {
  plataforma: Plataforma
  controle: Controle
  aoMudarConfig: (config: ConfigTransmissao) => void
}) {
  const { estado, estatisticas } = controle
  const [painel, setPainel] = useState<'nenhum' | 'ajustes' | 'fonte'>('nenhum')
  const [verEstatisticas, setVerEstatisticas] = useState(false)
  // Os controles mostram o que o host escolheu na hora; a transmissão alcança logo depois.
  const [rascunho, setRascunho] = useState<ConfigTransmissao | null>(null)
  const [avisoFonte, setAvisoFonte] = useState<string | null>(null)
  const fontes = useFontes(painel === 'fonte' ? plataforma.fontes : undefined)
  const configAtual = rascunho ?? (estado.fase === 'ao-vivo' ? estado.config : null)
  const microfones = useMicrofones(configAtual?.microfone.ativo ?? false)
  const [pedidos, setPedidos] = useState<Remetente[]>([])
  const apresentador = estado.fase === 'ao-vivo' ? estado.apresentador : null
  const chat = useChatSala(controle.sala, (aviso, de) => {
    if (aviso.t === 'pedido-tela') {
      setPedidos((atuais) =>
        atuais.some((p) => p.identity === de.identity) ? atuais : [...atuais, de],
      )
      tocarAvisoDePedido()
    } else if (aviso.t === 'pedido-cancelado') {
      setPedidos((atuais) => atuais.filter((p) => p.identity !== de.identity))
    } else if (aviso.t === 'devolver-tela' && de.identity === apresentador) {
      void controle.passarVez(null)
    }
  })

  useAtalhosDaJanela({
    p: controle.alternarPausa,
    m: controle.alternarAudio,
    n: controle.alternarMicrofone,
  })

  if (estado.fase !== 'ao-vivo' || !configAtual) return null
  const { resolvida } = estado
  const config = configAtual
  const aviso = estado.aviso ?? avisoFonte
  const nomeDe = (identity: string) =>
    estado.espectadores.find((e) => e.identity === identity)?.nome ?? 'Alguém'
  // Quem pediu e saiu da sala some da lista.
  const pedidosAtivos = pedidos.filter((p) =>
    estado.espectadores.some((e) => e.identity === p.identity),
  )

  const aprovar = async (pedido: Remetente) => {
    setPedidos((atuais) => atuais.filter((p) => p.identity !== pedido.identity))
    await controle.passarVez(pedido.identity)
  }

  const recusar = async (pedido: Remetente) => {
    setPedidos((atuais) => atuais.filter((p) => p.identity !== pedido.identity))
    await chat.avisar({ t: 'pedido-recusado' }, pedido.identity).catch(() => {
      // Se o aviso não chegar, a pessoa só continua esperando; pode pedir de novo.
    })
  }

  const ajustar = async (nova: ConfigTransmissao) => {
    setRascunho(nova)
    if (await controle.ajustar(nova)) aoMudarConfig(nova)
    else setRascunho(null)
  }

  const trocarFonte = async (fonte?: FonteDeCaptura) => {
    setPainel('nenhum')
    setAvisoFonte(null)
    if (fonte) {
      try {
        await plataforma.fontes?.escolher(fonte.id)
      } catch {
        setAvisoFonte('Essa janela acabou de fechar. Escolha outra.')
        return
      }
    }
    await controle.trocarFonte()
  }

  return (
    <main className="relative mx-auto grid max-w-xl gap-5 p-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="size-2 rounded-full bg-ao-vivo" aria-hidden />
        <span className="font-medium text-ao-vivo tracking-wide">AO VIVO</span>
        <span className="text-texto-suave" data-testid="espectadores">
          ·{' '}
          {estado.espectadores.length === 1
            ? '1 pessoa assistindo'
            : `${estado.espectadores.length} pessoas assistindo`}
        </span>
        {estado.pausado && <span className="ml-auto text-aviso">Vídeo pausado</span>}
      </div>

      {pedidosAtivos.map((pedido) => (
        <section
          key={pedido.identity}
          aria-label={`Pedido de ${pedido.nome}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-borda bg-superficie px-3 py-2 text-sm"
        >
          <span>{pedido.nome} quer mostrar a tela</span>
          <span className="flex gap-2">
            <Botao variante="primario" onClick={() => void aprovar(pedido)}>
              Aprovar
            </Botao>
            <Botao variante="fantasma" onClick={() => void recusar(pedido)}>
              Recusar
            </Botao>
          </span>
        </section>
      ))}

      {apresentador && (
        <section
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-lg border border-borda px-3 py-2 text-sm"
        >
          <span>Agora: tela de {nomeDe(apresentador)}. A sua está pausada para quem assiste.</span>
          <Botao onClick={() => void controle.passarVez(null)}>Retomar minha tela</Botao>
        </section>
      )}

      <div className="grid gap-3">
        <p className="text-sm text-texto-suave">
          {estado.copiado
            ? 'Link copiado. É só mandar para quem vai assistir.'
            : 'Mande o link para quem vai assistir.'}
        </p>
        {estado.linkFixo && (
          <CampoLink
            id="link-fixo"
            rotulo="Seu link fixo"
            url={estado.linkFixo}
            destaque
            aoCopiar={controle.copiarLink}
          />
        )}
        <CampoLink
          id="link"
          rotulo={estado.linkFixo ? 'Link só desta transmissão' : 'Link da transmissão'}
          url={estado.link}
          destaque={!estado.linkFixo}
          aoCopiar={controle.copiarLink}
        />
        <p className="font-mono text-texto-suave text-xs">{resolvida.resumo}</p>
      </div>

      {config.audioSistema && !estado.comAudio && (
        <p className="text-sm text-texto-suave">
          Sem áudio: a captura não trouxe som. No navegador, marque “Compartilhar áudio” no seletor;
          no Windows isso funciona com a tela inteira ou com uma aba.
        </p>
      )}
      {aviso && (
        <p role="alert" className="rounded-lg border border-parar/40 px-3 py-2 text-parar text-sm">
          {aviso}
        </p>
      )}
      {estatisticas?.limitacao && (
        <p role="status" className="rounded-lg border border-aviso/40 px-3 py-2 text-aviso text-sm">
          {TEXTO_LIMITACAO[estatisticas.limitacao]}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Botao onClick={controle.alternarPausa} aria-keyshortcuts="P">
          {estado.pausado ? 'Retomar vídeo' : 'Pausar vídeo'}
        </Botao>
        {estado.comAudio && (
          <Botao onClick={controle.alternarAudio} aria-keyshortcuts="M">
            {estado.audioMudo ? 'Ligar áudio' : 'Mutar áudio'}
          </Botao>
        )}
        {config.microfone.ativo && (
          <Botao onClick={controle.alternarMicrofone} aria-keyshortcuts="N">
            {estado.microfoneMudo ? 'Ligar microfone' : 'Mutar microfone'}
          </Botao>
        )}
        <Botao onClick={() => (plataforma.fontes ? setPainel('fonte') : void trocarFonte())}>
          Trocar tela/janela
        </Botao>
        <Botao
          onClick={() => setPainel(painel === 'ajustes' ? 'nenhum' : 'ajustes')}
          aria-expanded={painel === 'ajustes'}
        >
          Ajustes
        </Botao>
        <Botao
          variante="fantasma"
          onClick={() => setVerEstatisticas(!verEstatisticas)}
          aria-expanded={verEstatisticas}
        >
          Estatísticas
        </Botao>
      </div>

      {verEstatisticas && <PainelEstatisticas estatisticas={estatisticas} />}

      {painel === 'fonte' && (
        <section aria-label="Trocar o que está sendo compartilhado" className="grid gap-3">
          <PainelFonte
            lista={fontes}
            escolhida={null}
            aoEscolher={(fonte) => void trocarFonte(fonte)}
          />
          <Botao variante="fantasma" onClick={() => setPainel('nenhum')}>
            Cancelar
          </Botao>
        </section>
      )}

      {painel === 'ajustes' && (
        <aside aria-label="Ajustes da transmissão">
          <Secao titulo="Vídeo" aberta>
            <PainelVideo
              config={config}
              aoMudar={(nova) => void ajustar(nova)}
              codecsDoHost={codecsDoHost()}
              limitadoPelaFonte={resolvida.limitadoPelaFonte}
              uploadNecessarioKbps={uploadNecessarioKbps(resolvida)}
            />
          </Secao>
          <Secao titulo="Áudio" aberta>
            <PainelAudio
              config={config}
              aoMudar={(nova) => void ajustar(nova)}
              nivelAudio={controle.nivelAudio}
              microfones={microfones}
            />
          </Secao>
        </aside>
      )}

      <div>
        <Secao titulo={`Quem está assistindo (${estado.espectadores.length})`} aberta>
          <Alternador
            rotulo="Trancar sessão"
            descricao="Ninguém novo entra, nem quem você removeu; quem já está continua assistindo."
            ligado={estado.trancada}
            aoMudar={(trancada) => void controle.trancar(trancada)}
          />
          {estado.espectadores.length === 0 ? (
            <p className="text-sm text-texto-suave">Ninguém entrou ainda. É só mandar o link.</p>
          ) : (
            <ul className="grid gap-1" data-testid="lista-espectadores">
              {estado.espectadores.map((espectador) => (
                <li key={espectador.identity} className="flex items-center justify-between text-sm">
                  {espectador.nome}
                  <Botao
                    variante="fantasma"
                    className="px-2 py-1 text-xs"
                    onClick={() => void controle.remover(espectador.identity)}
                    aria-label={`Remover ${espectador.nome}`}
                  >
                    Remover
                  </Botao>
                </li>
              ))}
            </ul>
          )}
        </Secao>
        <Secao titulo="Chat">
          <PainelChat
            mensagens={chat.mensagens}
            aoEnviar={chat.enviarChat}
            className="h-64 rounded-lg border border-borda"
          />
          <BotoesDeReacao aoReagir={(emoji) => void chat.reagir(emoji)} />
        </Secao>
      </div>

      <Botao variante="perigo" className="justify-self-start" onClick={controle.parar}>
        Parar
      </Botao>
      <ColunaDeReacoes reacoes={chat.reacoes} />
    </main>
  )
}
