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
  await host.goto('/')
  await host.getByRole('button', { name: 'Compartilhar tela' }).click()
  const link = await host.locator('#link').inputValue()
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
