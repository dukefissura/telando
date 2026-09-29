import {
  type LocalTrack,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  type TrackPublishOptions,
} from 'livekit-client'
import type { criarClienteApi, SessaoCriada } from '../api.ts'
import { type AmostraEnvio, type EstatisticasEnvio, resumirEnvio } from '../estatisticas.ts'
import { lerSessaoMetadata } from '../sessao.ts'
import {
  type ConfigTransmissao,
  constraintsDoAudioSistema,
  type Dimensoes,
  resolverTransmissao,
  type TransmissaoResolvida,
} from '../transmissao.ts'
import { type AudioComVolume, criarAudioComVolume } from './audio-com-volume.ts'
import { ajustarEncodings } from './encodings.ts'
import { opcoesDePublicacao } from './opcoes-livekit.ts'

type ClienteApi = ReturnType<typeof criarClienteApi>

export type EventosTransmissao = {
  aoMudarEspectadores: (espectadores: Espectador[]) => void
  /** A reconexão automática do LiveKit desistiu. */
  aoCair: () => void
  /** O "Parar compartilhamento" do navegador (ou a janela capturada fechou). */
  aoPerderCaptura: () => void
  /** Outra pessoa passou a apresentar (ou a vez voltou para o host, com `null`). */
  aoMudarApresentador: (identity: string | null) => void
}

/** O nome é o que o dono escolheu para aparecer ("Luan está compartilhando"). */
export type LinkFixo = { slug: string; segredo: string; nome: string }

type Captura = { video: MediaStreamTrack; audio: MediaStreamTrack | null; fonte: Dimensoes }

export class CapturaCancelada extends Error {}

export type Espectador = { identity: string; nome: string }

export function codecsDoHost(): string[] {
  const codecs = RTCRtpSender.getCapabilities('video')?.codecs ?? []
  return codecs.map((codec) => codec.mimeType.split('/')[1]?.toLowerCase() ?? '')
}

async function capturarTela(config: ConfigTransmissao): Promise<Captura> {
  let fluxo: MediaStream
  try {
    const audio = constraintsDoAudioSistema(config)
    fluxo = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { max: config.fps } },
      audio: audio ?? false,
    })
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'NotAllowedError')
      throw new CapturaCancelada()
    throw erro
  }
  const [video] = fluxo.getVideoTracks()
  if (!video) throw new Error('A captura veio sem vídeo.')
  const { width = 1920, height = 1080 } = video.getSettings()
  return {
    video,
    audio: fluxo.getAudioTracks()[0] ?? null,
    fonte: { largura: width, altura: height },
  }
}

async function prepararVideo(video: MediaStreamTrack, resolvida: TransmissaoResolvida) {
  video.contentHint = resolvida.contentHint
  await video.applyConstraints(resolvida.constraintsVideo)
}

const precisaRepublicarVideo = (antes: TransmissaoResolvida, depois: TransmissaoResolvida) =>
  antes.codec !== depois.codec ||
  antes.backupCodec !== depois.backupCodec ||
  antes.camadas.length !== depois.camadas.length

const mesmoAudio = (antes: TransmissaoResolvida, depois: TransmissaoResolvida) =>
  JSON.stringify(antes.audio) === JSON.stringify(depois.audio)

export class TransmissaoAoVivo {
  private amostra: AmostraEnvio | null = null
  private audioSistema: { volume: AudioComVolume; trilha: LocalTrack } | null = null
  private microfone: LocalTrack | null = null
  private ajustePendente: ConfigTransmissao | null = null
  private ajusteAgendado: Promise<void> | null = null
  private fila: Promise<void> = Promise.resolve()
  // Trilhas republicadas nascem ligadas; isto guarda o que o host desligou para reaplicar.
  private readonly desligado = { video: false, audio: false, microfone: false }
  /** Quem está apresentando no lugar do host; enquanto isso, a tela do host fica pausada. */
  private apresentador: string | null = null
  private linkFixo: LinkFixo | null = null

  private get videoParado() {
    return this.desligado.video || this.apresentador !== null
  }

  private get audioParado() {
    return this.desligado.audio || this.apresentador !== null
  }

  private readonly api: ClienteApi
  readonly sessao: SessaoCriada
  private readonly room: Room
  private readonly eventos: EventosTransmissao
  private captura: Captura
  private video: LocalVideoTrack
  private _config: ConfigTransmissao
  private _resolvida: TransmissaoResolvida

  private constructor(partes: {
    api: ClienteApi
    sessao: SessaoCriada
    room: Room
    eventos: EventosTransmissao
    captura: Captura
    video: LocalVideoTrack
    config: ConfigTransmissao
    resolvida: TransmissaoResolvida
  }) {
    this.api = partes.api
    this.sessao = partes.sessao
    this.room = partes.room
    this.eventos = partes.eventos
    this.captura = partes.captura
    this.video = partes.video
    this._config = partes.config
    this._resolvida = partes.resolvida
  }

  get config() {
    return this._config
  }

  get resolvida() {
    return this._resolvida
  }

  get comAudio() {
    return this.audioSistema !== null
  }

  get espectadores(): Espectador[] {
    return [...this.room.remoteParticipants.values()].map((participante) => ({
      identity: participante.identity,
      nome: participante.name || 'Sem apelido',
    }))
  }

  /** A sala do LiveKit, para os avisos do revezamento. */
  get sala() {
    return this.room
  }

  /** O vídeo capturado que está indo ao ar; muda quando a fonte é trocada. */
  get trilhaDeVideo(): MediaStreamTrack {
    return this.captura.video
  }

  trancar(trancada: boolean) {
    return this.api.trancarSessao(this.sessao.id, this.sessao.hostToken, trancada)
  }

  remover(identity: string) {
    return this.api.removerParticipante(this.sessao.id, this.sessao.hostToken, identity)
  }

  static async iniciar(
    api: ClienteApi,
    config: ConfigTransmissao,
    eventos: EventosTransmissao,
    linkFixo?: LinkFixo,
  ): Promise<TransmissaoAoVivo> {
    // O seletor de tela e a criação da sala correm juntos para o link sair mais rápido.
    const [captura, sessao] = await Promise.allSettled([
      capturarTela(config),
      api.criarSessao(linkFixo?.nome),
    ])
    if (captura.status === 'rejected') {
      if (sessao.status === 'fulfilled') await encerrarNoServer(api, sessao.value)
      throw captura.reason
    }
    if (sessao.status === 'rejected') {
      pararCaptura(captura.value)
      throw sessao.reason
    }

    const room = new Room()
    let transmissao: TransmissaoAoVivo | null = null
    try {
      const resolvida = resolverTransmissao(config, captura.value.fonte, codecsDoHost())
      await prepararVideo(captura.value.video, resolvida)
      await room.connect(sessao.value.livekitUrl, sessao.value.livekitToken)
      const opcoes = opcoesDePublicacao(resolvida)
      const video = comoVideo(await publicar(room, captura.value.video, opcoes.video))

      transmissao = new TransmissaoAoVivo({
        api,
        sessao: sessao.value,
        room,
        eventos,
        captura: captura.value,
        video,
        config,
        resolvida,
      })
      await transmissao.sincronizarAudioSistema(opcoes.audio)
      await transmissao.sincronizarMicrofone(null)
      transmissao.escutar()
      if (linkFixo) {
        await api.apontarLink(linkFixo.slug, linkFixo.segredo, sessao.value)
        transmissao.linkFixo = linkFixo
      }
      return transmissao
    } catch (erro) {
      if (transmissao) {
        await transmissao.encerrar()
      } else {
        pararCaptura(captura.value)
        await Promise.all([room.disconnect(), encerrarNoServer(api, sessao.value)])
      }
      throw erro
    }
  }

  private escutar() {
    const contar = () => this.eventos.aoMudarEspectadores(this.espectadores)
    this.room.on(RoomEvent.ParticipantConnected, contar)
    this.room.on(RoomEvent.ParticipantDisconnected, contar)
    this.room.on(RoomEvent.Disconnected, () => this.eventos.aoCair())
    this.room.on(RoomEvent.RoomMetadataChanged, (metadata) => {
      const apresentador = lerSessaoMetadata(metadata)?.presenterIdentity ?? null
      if (apresentador === this.apresentador) return
      this.apresentador = apresentador
      void this.aplicarPausas()
      this.eventos.aoMudarApresentador(apresentador)
    })
    this.vigiarCaptura()
  }

  private vigiarCaptura() {
    this.captura.video.addEventListener('ended', () => this.eventos.aoPerderCaptura(), {
      once: true,
    })
  }

  private async sincronizarAudioSistema(opcoes: TrackPublishOptions) {
    const { audio } = this.captura
    const querAudio = this._config.audioSistema && audio !== null

    if (this.audioSistema && !querAudio) {
      await this.room.localParticipant.unpublishTrack(this.audioSistema.trilha)
      await this.audioSistema.volume.fechar()
      this.audioSistema = null
      return
    }
    if (!querAudio || !audio) return

    if (this.audioSistema) {
      this.audioSistema.volume.trocarEntrada(audio)
    } else {
      const volume = criarAudioComVolume(audio, this._resolvida.audio.estereo)
      const trilha = await publicar(this.room, volume.trilha, opcoes)
      this.audioSistema = { volume, trilha }
      if (this.audioParado) await trilha.mute()
    }
    this.audioSistema.volume.definirGanho(this._config.volumeAudio)
  }

  private async sincronizarMicrofone(anterior: TransmissaoResolvida | null) {
    const constraints = this._resolvida.constraintsMicrofone
    if (anterior && JSON.stringify(anterior.constraintsMicrofone) === JSON.stringify(constraints)) {
      return
    }
    if (this.microfone) {
      await this.room.localParticipant.unpublishTrack(this.microfone)
      this.microfone = null
    }
    if (!constraints) return
    const fluxo = await navigator.mediaDevices.getUserMedia({ audio: constraints })
    const [trilha] = fluxo.getAudioTracks()
    if (!trilha) return
    this.microfone = await publicar(this.room, trilha, { source: Track.Source.Microphone })
    if (this.desligado.microfone) await this.microfone.mute()
  }

  /**
   * Aplica mudanças de configuração sem derrubar quem está assistindo. Um deslizante chama isto
   * dezenas de vezes por segundo; os ajustes rodam um por vez e só o mais recente pendente vale.
   */
  ajustar(config: ConfigTransmissao): Promise<void> {
    this.ajustePendente = config
    this.ajusteAgendado ??= this.enfileirar(async () => {
      const proximo = this.ajustePendente
      this.ajustePendente = null
      this.ajusteAgendado = null
      if (proximo) await this.aplicarAjuste(proximo)
    })
    return this.ajusteAgendado
  }

  /** Captura outra tela ou janela e troca a trilha publicada; o link continua o mesmo. */
  trocarFonte(): Promise<void> {
    return this.enfileirar(() => this.capturarOutraFonte())
  }

  // Ajustes e troca de fonte mexem nas mesmas trilhas; rodando em fila, um não pega a trilha
  // que o outro acabou de despublicar.
  private enfileirar(tarefa: () => Promise<void>): Promise<void> {
    const resultado = this.fila.then(tarefa)
    this.fila = resultado.catch(() => {
      // O erro já foi entregue a quem pediu a tarefa; a fila segue para a próxima.
    })
    return resultado
  }

  private async aplicarAjuste(config: ConfigTransmissao) {
    const anterior = this._resolvida
    const ligouAudioSemTer =
      config.audioSistema && !this._config.audioSistema && !this.captura.audio
    this._config = config

    if (ligouAudioSemTer) {
      // O áudio vem junto da captura de tela; para ligar depois, é preciso capturar de novo.
      await this.capturarOutraFonte()
    } else {
      this._resolvida = resolverTransmissao(config, this.captura.fonte, codecsDoHost())
      await prepararVideo(this.captura.video, this._resolvida)
      await this.video.setDegradationPreference(this._resolvida.degradacao)
    }
    const resolvida = this._resolvida

    const opcoes = opcoesDePublicacao(resolvida)
    if (precisaRepublicarVideo(anterior, resolvida)) {
      await this.room.localParticipant.unpublishTrack(this.video, false)
      this.video = comoVideo(await publicar(this.room, this.captura.video, opcoes.video))
      if (this.videoParado) await this.video.mute()
    } else {
      await ajustarEncodings(this.video.sender, resolvida)
    }

    if (this.audioSistema && !mesmoAudio(anterior, resolvida)) {
      await this.room.localParticipant.unpublishTrack(this.audioSistema.trilha)
      await this.audioSistema.volume.fechar()
      this.audioSistema = null
    }
    await this.sincronizarAudioSistema(opcoes.audio)
    await this.sincronizarMicrofone(anterior)
  }

  private async capturarOutraFonte() {
    const nova = await capturarTela(this._config)
    try {
      const resolvida = resolverTransmissao(this._config, nova.fonte, codecsDoHost())
      await prepararVideo(nova.video, resolvida)
      await this.video.replaceTrack(nova.video, true)
      this._resolvida = resolvida
    } catch (erro) {
      pararCaptura(nova)
      throw erro
    }
    const antiga = this.captura
    this.captura = nova
    await ajustarEncodings(this.video.sender, this._resolvida)
    await this.sincronizarAudioSistema(opcoesDePublicacao(this._resolvida).audio)
    pararCaptura(antiga)
    this.vigiarCaptura()
  }

  private async aplicarPausas() {
    await (this.videoParado ? this.video.mute() : this.video.unmute())
    const audio = this.audioSistema?.trilha
    if (audio) await (this.audioParado ? audio.mute() : audio.unmute())
  }

  async pausarVideo(pausar: boolean) {
    this.desligado.video = pausar
    await this.aplicarPausas()
  }

  async mutarAudioSistema(mutar: boolean) {
    this.desligado.audio = mutar
    await this.aplicarPausas()
  }

  /** Passa a vez para um espectador, ou de volta para o host com `null`. */
  passarVez(identity: string | null) {
    return this.api.passarVez(this.sessao.id, this.sessao.hostToken, identity)
  }

  async mutarMicrofone(mutar: boolean) {
    this.desligado.microfone = mutar
    if (!this.microfone) return
    await (mutar ? this.microfone.mute() : this.microfone.unmute())
  }

  nivelAudio() {
    return this.audioSistema?.volume.nivel() ?? 0
  }

  async estatisticas(): Promise<EstatisticasEnvio> {
    const relatorios = await Promise.all([
      this.video.sender?.getStats(),
      this.audioSistema?.trilha.sender?.getStats(),
    ])
    const registros = relatorios.flatMap((relatorio) => (relatorio ? [...relatorio.values()] : []))
    const { estatisticas, amostra } = resumirEnvio(registros, this.amostra, performance.now())
    this.amostra = amostra
    return estatisticas
  }

  async encerrar() {
    // O DELETE sai antes de qualquer await: no pagehide a página pode morrer no primeiro await.
    const noServer = encerrarNoServer(this.api, this.sessao)
    const semLinkFixo = this.linkFixo
      ? this.api.desapontarLink(this.linkFixo.slug, this.linkFixo.segredo).catch(() => {
          // O server também tira o link do ar quando a sessão acaba.
        })
      : undefined
    this.room.removeAllListeners()
    pararCaptura(this.captura)
    await Promise.all([
      this.room.disconnect(),
      this.audioSistema?.volume.fechar(),
      noServer,
      semLinkFixo,
    ])
  }
}

async function publicar(room: Room, trilha: MediaStreamTrack, opcoes: TrackPublishOptions) {
  const { track } = await room.localParticipant.publishTrack(trilha, opcoes)
  if (!track) throw new Error('O LiveKit confirmou a publicação sem devolver a trilha.')
  return track
}

function comoVideo(trilha: LocalTrack): LocalVideoTrack {
  if (!(trilha instanceof LocalVideoTrack)) throw new Error('Esperava uma trilha de vídeo.')
  return trilha
}

function pararCaptura({ video, audio }: Captura) {
  video.stop()
  audio?.stop()
}

function encerrarNoServer(api: ClienteApi, sessao: SessaoCriada) {
  return api.encerrarSessao(sessao.id, sessao.hostToken).catch(() => {
    // Se o pedido não chegar, a sala some sozinha pelo emptyTimeout do LiveKit.
  })
}

const ESPERA_PELA_PERMISSAO_MS = 5000

/** A aprovação chega pelos metadados um pouco antes da permissão; publicar antes falha. */
function esperarPermissaoDeTela(room: Room): Promise<void> {
  if (room.localParticipant.permissions?.canPublish) return Promise.resolve()
  return new Promise((resolver, rejeitar) => {
    const aoMudar = () => {
      if (!room.localParticipant.permissions?.canPublish) return
      clearTimeout(timer)
      room.off(RoomEvent.ParticipantPermissionsChanged, aoMudar)
      resolver()
    }
    const timer = setTimeout(() => {
      room.off(RoomEvent.ParticipantPermissionsChanged, aoMudar)
      rejeitar(new Error('O host aprovou, mas a permissão para compartilhar não chegou.'))
    }, ESPERA_PELA_PERMISSAO_MS)
    room.on(RoomEvent.ParticipantPermissionsChanged, aoMudar)
  })
}

/**
 * Quem assiste e foi aprovado pelo host compartilha a própria tela na mesma sala. Versão enxuta da
 * transmissão do host: sem ajustes ao vivo, volume ou microfone.
 */
export async function compartilharComoConvidado(
  room: Room,
  config: ConfigTransmissao,
  aoPerderCaptura: () => void,
) {
  const captura = await capturarTela(config)
  try {
    await esperarPermissaoDeTela(room)
    const resolvida = resolverTransmissao(config, captura.fonte, codecsDoHost())
    await prepararVideo(captura.video, resolvida)
    const opcoes = opcoesDePublicacao(resolvida)
    await publicar(room, captura.video, opcoes.video)
    if (captura.audio) await publicar(room, captura.audio, opcoes.audio)
  } catch (erro) {
    pararCaptura(captura)
    throw erro
  }
  captura.video.addEventListener('ended', aoPerderCaptura, { once: true })

  return {
    async parar() {
      captura.video.removeEventListener('ended', aoPerderCaptura)
      // Se o host já retomou a vez, o LiveKit despublicou sozinho; aí só sobra parar a captura.
      const publicadas = [...room.localParticipant.trackPublications.values()]
      for (const trilha of [captura.video, captura.audio]) {
        const aindaPublicada = publicadas.some((p) => p.track?.mediaStreamTrack === trilha)
        if (trilha && aindaPublicada) await room.localParticipant.unpublishTrack(trilha)
      }
      pararCaptura(captura)
    },
  }
}
