import type { TransmissaoResolvida } from '../transmissao.ts'

// O LiveKit calcula as camadas uma vez, na publicação. Para bitrate e fps mudarem sem republicar,
// ajustamos direto os encodings do sender: o de escala 1 é a camada cheia, os outros seguem `camadas`.
export async function ajustarEncodings(
  sender: RTCRtpSender | undefined,
  resolvida: TransmissaoResolvida,
) {
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
