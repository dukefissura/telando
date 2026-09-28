import { type Browser, expect, type Page } from '@playwright/test'

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

// O Chromium de teste não tem seletor de tela; a "tela" vira a câmera e o microfone falsos
// (padrão colorido + bipe) que o --use-fake-device-for-media-stream fornece.
export async function novaAba(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext()
  await contexto.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = () =>
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  })
  return contexto.newPage()
}

/** Abre o site, começa a transmitir e devolve o link e a sessão criada (com o hostToken). */
export async function transmitir(browser: Browser, host?: Page) {
  const pagina = host ?? (await novaAba(browser))
  await pagina.goto('/')
  await pagina.getByRole('button', { name: 'Compartilhar tela' }).click()
  const resposta = pagina.waitForResponse(
    (r) => r.url().endsWith('/api/sessions') && r.request().method() === 'POST',
  )
  await pagina.getByRole('button', { name: 'Iniciar' }).click()
  const sessao = (await (await resposta).json()) as { id: string; hostToken: string }
  return { host: pagina, link: await pagina.locator('#link').inputValue(), sessao }
}

export async function assistir(browser: Browser, link: string, apelido: string) {
  const espectador = await novaAba(browser)
  await espectador.goto(link)
  await espectador.getByLabel('Seu apelido').fill(apelido)
  await espectador.getByRole('button', { name: 'Assistir' }).click()
  return espectador
}
