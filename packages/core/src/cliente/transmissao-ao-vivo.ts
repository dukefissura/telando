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
import {
  type ConfigTransmissao,
  constraintsDoAudioSistema,
  type Dimensoes,
  resolverTransmissao,
  type TransmissaoResolvida,
} from '../transmissao.ts'
import { type AudioComVolume, criarAudioComVolume } from './audio-com-volume.ts'
import { opcoesDePublicacao } from './opcoes-livekit.ts'

type ClienteApi = ReturnType<typeof criarClienteApi>

export type EventosTransmissao = {
  aoMudarEspectadores: (quantidade: number) => void
  /** A reconexão automática do LiveKit desistiu. */
  aoCair: () => void
  /** O "Parar compartilhamento" do navegador (ou a janela capturada fechou). */
  aoPerderCaptura: () => void
}

type Captura = { video: MediaStreamTrack; audio: MediaStreamTrack | null; fonte: Dimensoes }

export class CapturaCancelada extends Error {}

function codecsDoHost(): string[] {
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

// O LiveKit calcula as camadas uma vez, na publicação. Para bitrate e fps mudarem sem republicar,
// ajustamos direto os encodings do sender: o de escala 1 é a camada cheia, os outros seguem `camadas`.
async function ajustarEncodings(sender: RTCRtpSender | undefined, resolvida: TransmissaoResolvida) {
  if (!sender) return
  const parametros = sender.getParameters()
  const daMenorParaMaior = [...parametros.encodings].sort(
    (a, b) => (b.scaleResolutionDownBy ?? 1) - (a.scaleResolutionDownBy ?? 1),
  )
  daMenorParaMaior.forEach((encoding, indice) => {
    const camada = indice < daMenorParaMaior.length - 1 ? resolvida.camadas[indice] : undefined
    encoding.maxBitrate = (camada?.bitrateKbps ?? resolvida.bitrateKbps) * 1000
    encoding.maxFramerate = camada?.fps ?? resolvida.fps
  })
  await sender.setParameters(parametros)
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

  private constructor(
    private readonly api: ClienteApi,
    readonly sessao: SessaoCriada,
    private readonly room: Room,
    private readonly eventos: EventosTransmissao,
    private captura: Captura,
    private video: LocalVideoTrack,
    private _config: ConfigTransmissao,
    private _resolvida: TransmissaoResolvida,
  ) {}

  get config() {
    return this._config
  }

  get resolvida() {
    return this._resolvida
  }

  get comAudio() {
    return this.audioSistema !== null
  }

  get espectadores() {
    return this.room.remoteParticipants.size
  }

  static async iniciar(
    api: ClienteApi,
    config: ConfigTransmissao,
    eventos: EventosTransmissao,
  ): Promise<TransmissaoAoVivo> {
    // O seletor de tela e a criação da sala correm juntos para o link sair mais rápido.
    const [captura, sessao] = await Promise.allSettled([capturarTela(config), api.criarSessao()])
    if (captura.status === 'rejected') {
      if (sessao.status === 'fulfilled') await encerrarNoServer(api, sessao.value)
      throw captura.reason
    }
    if (sessao.status === 'rejected') {
      pararCaptura(captura.value)
      throw sessao.reason
    }

    const room = new Room()
    try {
      const resolvida = resolverTransmissao(config, captura.value.fonte, codecsDoHost())
      await prepararVideo(captura.value.video, resolvida)
      await room.connect(sessao.value.livekitUrl, sessao.value.livekitToken)
      const opcoes = opcoesDePublicacao(resolvida)
      const video = comoVideo(await publicar(room, captura.value.video, opcoes.video))

      const transmissao = new TransmissaoAoVivo(
        api,
        sessao.value,
        room,
        eventos,
        captura.value,
        video,
        config,
        resolvida,
      )
      await transmissao.sincronizarAudioSistema(opcoes.audio)
      await transmissao.sincronizarMicrofone(null)
      transmissao.escutar()
      return transmissao
    } catch (erro) {
      pararCaptura(captura.value)
      await Promise.all([room.disconnect(), encerrarNoServer(api, sessao.value)])
      throw erro
    }
  }

  private escutar() {
    const contar = () => this.eventos.aoMudarEspectadores(this.espectadores)
    this.room.on(RoomEvent.ParticipantConnected, contar)
    this.room.on(RoomEvent.ParticipantDisconnected, contar)
    this.room.on(RoomEvent.Disconnected, () => this.eventos.aoCair())
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
  }

  /** Aplica mudanças de configuração sem derrubar quem está assistindo. */
  async ajustar(config: ConfigTransmissao) {
    const anterior = this._resolvida
    const resolvida = resolverTransmissao(config, this.captura.fonte, codecsDoHost())
    const pediuAudioSemTer = config.audioSistema && !this.captura.audio
    this._config = config
    this._resolvida = resolvida

    if (pediuAudioSemTer) {
      // O áudio vem junto da captura de tela; para ligar depois, é preciso capturar de novo.
      await this.trocarFonte()
    } else {
      await prepararVideo(this.captura.video, resolvida)
      await this.video.setDegradationPreference(resolvida.degradacao)
    }

    const opcoes = opcoesDePublicacao(resolvida)
    if (precisaRepublicarVideo(anterior, resolvida)) {
      await this.room.localParticipant.unpublishTrack(this.video, false)
      this.video = comoVideo(await publicar(this.room, this.captura.video, opcoes.video))
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

  /** Captura outra tela ou janela e troca a trilha publicada; o link continua o mesmo. */
  async trocarFonte() {
    const nova = await capturarTela(this._config)
    const antiga = this.captura
    this._resolvida = resolverTransmissao(this._config, nova.fonte, codecsDoHost())
    await prepararVideo(nova.video, this._resolvida)
    this.captura = nova
    await this.video.replaceTrack(nova.video, true)
    await ajustarEncodings(this.video.sender, this._resolvida)
    await this.sincronizarAudioSistema(opcoesDePublicacao(this._resolvida).audio)
    pararCaptura(antiga)
    this.vigiarCaptura()
  }

  async pausarVideo(pausar: boolean) {
    await (pausar ? this.video.mute() : this.video.unmute())
  }

  async mutarAudioSistema(mutar: boolean) {
    if (!this.audioSistema) return
    await (mutar ? this.audioSistema.trilha.mute() : this.audioSistema.trilha.unmute())
  }

  async mutarMicrofone(mutar: boolean) {
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
    this.room.removeAllListeners()
    pararCaptura(this.captura)
    await Promise.all([this.room.disconnect(), this.audioSistema?.volume.fechar(), noServer])
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
