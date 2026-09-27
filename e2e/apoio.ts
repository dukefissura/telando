import { expect, type Page } from '@playwright/test'

/** O espectador está vendo o vídeo e recebendo uma trilha de áudio ativa. */
export async function recebeVideoEAudio(espectador: Page) {
  await expect
    .poll(() => espectador.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0)
  await expect
    .poll(() =>
      espectador.locator('audio').evaluateAll((audios) =>
        audios.some((a) => {
          const fluxo = (a as HTMLAudioElement).srcObject
          return fluxo instanceof MediaStream && fluxo.getAudioTracks()[0]?.readyState === 'live'
        }),
      ),
    )
    .toBe(true)
}
