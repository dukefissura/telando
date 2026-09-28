import { expect, type Page, test } from '@playwright/test'
import { novaAba, recebeVideoEAudio, transmitir } from './apoio.ts'

test('host compartilha, dois amigos assistem com áudio e veem a sessão encerrar', async ({
  browser,
}) => {
  const host = await novaAba(browser)
  const { link } = await transmitir(browser, host)
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
  const { link } = await transmitir(browser, host)

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

test('ajustar com uma captura sem áudio não reabre o seletor de tela', async ({ browser }) => {
  const contexto = await browser.newContext()
  await contexto.addInitScript(() => {
    const janela = window as Window & { capturas?: number }
    janela.capturas = 0
    navigator.mediaDevices.getDisplayMedia = () => {
      janela.capturas = (janela.capturas ?? 0) + 1
      return navigator.mediaDevices.getUserMedia({ video: true })
    }
  })
  const host = await contexto.newPage()
  await transmitir(browser, host)
  await expect(
    host.getByText('Sem áudio: a captura não trouxe som.', { exact: false }),
  ).toBeVisible()

  await host.getByRole('button', { name: 'Ajustes' }).click()
  await host.getByText('30', { exact: true }).click()
  await host.getByText('60', { exact: true }).click()
  await expect(host.getByText('60 fps')).toBeVisible()

  expect(await host.evaluate(() => (window as Window & { capturas?: number }).capturas)).toBe(1)
})
