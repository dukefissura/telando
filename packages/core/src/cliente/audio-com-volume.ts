/**
 * Passa o áudio capturado por um GainNode (volume de 0 a 150%) e um AnalyserNode (medidor),
 * e entrega uma trilha nova para publicar. Trocar a entrada não troca a trilha publicada.
 */
export function criarAudioComVolume(entrada: MediaStreamTrack, estereo: boolean) {
  const contexto = new AudioContext()
  const ganho = contexto.createGain()
  const analisador = contexto.createAnalyser()
  analisador.fftSize = 1024
  const destino = contexto.createMediaStreamDestination()
  destino.channelCount = estereo ? 2 : 1
  ganho.connect(analisador)
  ganho.connect(destino)

  let fonte = contexto.createMediaStreamSource(new MediaStream([entrada]))
  fonte.connect(ganho)
  const amostras = new Float32Array(analisador.fftSize)

  const [trilha] = destino.stream.getAudioTracks()
  if (!trilha) throw new Error('MediaStreamDestination sem trilha de áudio')

  return {
    trilha,
    definirGanho(valor: number) {
      ganho.gain.value = Math.min(1.5, Math.max(0, valor))
    },
    /** Nível RMS de 0 a 1 do áudio que está saindo (já com o volume aplicado). */
    nivel() {
      analisador.getFloatTimeDomainData(amostras)
      let soma = 0
      for (const amostra of amostras) soma += amostra * amostra
      return Math.min(1, Math.sqrt(soma / amostras.length) * 2)
    },
    trocarEntrada(nova: MediaStreamTrack) {
      fonte.disconnect()
      fonte = contexto.createMediaStreamSource(new MediaStream([nova]))
      fonte.connect(ganho)
    },
    async fechar() {
      trilha.stop()
      await contexto.close()
    },
  }
}

export type AudioComVolume = ReturnType<typeof criarAudioComVolume>
