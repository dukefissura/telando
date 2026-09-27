import { type Browser, expect, type Page, test } from '@playwright/test'

// O Chromium de teste não tem seletor de tela; a "tela" vira a câmera e o microfone falsos
// (padrão colorido + bipe) que o --use-fake-device-for-media-stream fornece.
async function novaAba(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext()
  await contexto.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = () =>
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  })
  return contexto.newPage()
}

async function comecarATransmitir(host: Page): Promise<string> {
  await host.goto('/')
  await host.getByRole('button', { name: 'Compartilhar tela' }).click()
  await host.getByRole('button', { name: 'Iniciar' }).click()
  return host.locator('#link').inputValue()
}

async function recebeVideoEAudio(espectador: Page) {
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

test('host compartilha, dois amigos assistem com áudio e veem a sessão encerrar', async ({
  browser,
}) => {
  const host = await novaAba(browser)
  const link = await comecarATransmitir(host)
  expect(link).toMatch(/\/s\/[A-Za-z0-9]{12}$/)

  const espectadores = [await novaAba(browser), await novaAba(browser)]
  for (const espectador of espectadores) {
    await espectador.goto(link)
    await espectador.getByRole('button', { name: 'Assistir' }).click()
  }
  for (const espectador of espectadores) await recebeVideoEAudio(espectador)
  await expect(host.getByTestId('espectadores')).toContainText('2 pessoas assistindo')

  await host.getByRole('button', { name: 'Parar' }).click()
  for (const espectador of espectadores) {
    await expect(espectador.getByRole('heading', { name: 'Sessão encerrada' })).toBeVisible()
  }
})

test('link de sessão que não existe mostra link inválido', async ({ page }) => {
  await page.goto('/s/naoexiste1234')
  await page.getByRole('button', { name: 'Assistir' }).click()
  await expect(page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible()
})

test('fechar a aba do host encerra a sessão para quem assiste', async ({ browser }) => {
  const host = await novaAba(browser)
  const link = await comecarATransmitir(host)

  const espectador = await novaAba(browser)
  await espectador.goto(link)
  await espectador.getByRole('button', { name: 'Assistir' }).click()
  await recebeVideoEAudio(espectador)

  await host.close()
  await expect(espectador.getByRole('heading', { name: 'Sessão encerrada' })).toBeVisible()
})

test('ajustes ao vivo não derrubam quem está assistindo', async ({ browser }) => {
  const host = await novaAba(browser)
  await host.goto('/')
  await host.getByRole('button', { name: 'Compartilhar tela' }).click()
  await host.getByText('Jogo', { exact: true }).click()
  await expect(host.getByTestId('resumo')).toContainText('60 fps · até 8 Mbps · áudio Música')
  await host.getByRole('button', { name: 'Iniciar' }).click()
  const link = await host.locator('#link').inputValue()

  const espectador = await novaAba(browser)
  await espectador.goto(link)
  await espectador.getByRole('button', { name: 'Assistir' }).click()
  await recebeVideoEAudio(espectador)

  await host.getByRole('button', { name: 'Estatísticas' }).click()
  await expect(host.getByTestId('estatisticas')).toContainText('fps')

  await host.getByRole('button', { name: 'Ajustes' }).click()
  await host.getByText('5', { exact: true }).click()
  await host.getByText('Voz', { exact: true }).click()
  await expect(host.getByText('5 fps · até 8 Mbps · áudio Voz')).toBeVisible()

  const quadrosAntes = await quadrosDecodificados(espectador)
  await expect.poll(() => quadrosDecodificados(espectador)).toBeGreaterThan(quadrosAntes + 3)
  await recebeVideoEAudio(espectador)
  await expect(host.getByTestId('espectadores')).toContainText('1 pessoa assistindo')
})

function quadrosDecodificados(espectador: Page) {
  return espectador
    .locator('video')
    .evaluate((v: HTMLVideoElement) => v.getVideoPlaybackQuality().totalVideoFrames)
}
