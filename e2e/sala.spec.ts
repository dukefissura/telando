import { expect, test } from '@playwright/test'
import { assistir, novaAba, recebeVideoEAudio, transmitir } from './apoio.ts'

test('chat e reações vão e voltam entre host e espectador', async ({ browser }) => {
  const { host, link } = await transmitir(browser)
  const espectador = await assistir(browser, link, 'Capivara Azul')
  await recebeVideoEAudio(espectador)

  await host.locator('summary', { hasText: 'Chat' }).click()
  await host.getByLabel('Mensagem para a sala').fill('dá pra ver?')
  await host.getByLabel('Mensagem para a sala').press('Enter')

  await espectador.getByRole('button', { name: 'Abrir o chat' }).click()
  await expect(espectador.getByText('dá pra ver?')).toBeVisible()

  await espectador.getByLabel('Mensagem para a sala').fill('tudo certo')
  await espectador.getByLabel('Mensagem para a sala').press('Enter')
  await expect(host.getByText('Capivara Azul tudo certo')).toBeVisible()

  await espectador.getByRole('button', { name: 'Reagir com 👏' }).click()
  await expect(host.getByText('👏', { exact: true }).last()).toBeVisible()
})

test('host remove um espectador', async ({ browser }) => {
  const { host, link } = await transmitir(browser)
  const espectador = await assistir(browser, link, 'Tatu Verde')
  await recebeVideoEAudio(espectador)

  await host.getByRole('button', { name: 'Remover Tatu Verde' }).click()
  await expect(
    espectador.getByRole('heading', { name: 'Você foi removido da sessão' }),
  ).toBeVisible()
  await expect(host.getByTestId('espectadores')).toContainText('0 pessoas assistindo')
})

test('com a sessão trancada, ninguém novo entra', async ({ browser }) => {
  const { host, link } = await transmitir(browser)
  const primeiro = await assistir(browser, link, 'Mico Roxo')
  await recebeVideoEAudio(primeiro)

  await host.getByRole('switch', { name: 'Trancar sessão' }).click()
  await expect(host.getByRole('switch', { name: 'Trancar sessão' })).toBeChecked()
  // Trancada, a página já avisa antes de pedir o apelido.
  const atrasado = await novaAba(browser)
  await atrasado.goto(link)
  await expect(atrasado.getByRole('heading', { name: 'Sessão trancada' })).toBeVisible()
  await recebeVideoEAudio(primeiro)

  await host.getByRole('switch', { name: 'Trancar sessão' }).click()
  await expect(host.getByRole('switch', { name: 'Trancar sessão' })).not.toBeChecked()
  await atrasado.getByRole('button', { name: 'Tentar de novo' }).click()
  await atrasado.getByRole('button', { name: 'Assistir' }).click()
  await recebeVideoEAudio(atrasado)
})

test('quem assiste vê quando o host pausa e retoma', async ({ browser }) => {
  const { host, link } = await transmitir(browser)
  const espectador = await assistir(browser, link, 'Onça Cinza')
  await recebeVideoEAudio(espectador)

  await host.getByRole('button', { name: 'Pausar vídeo' }).click()
  await expect(espectador.getByText('O host pausou o compartilhamento')).toBeVisible()

  await host.getByRole('button', { name: 'Retomar vídeo' }).click()
  await expect(espectador.getByText('O host pausou o compartilhamento')).toBeHidden()
})
