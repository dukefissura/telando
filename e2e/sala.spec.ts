import { expect, test } from '@playwright/test'
import { abrirLink, assistir, fecharTodos, recebeVideoEAudio, transmitir } from './apoio.ts'

test.skip(process.platform !== 'win32', 'O app só existe para Windows')
test.afterEach(fecharTodos)

test('host remove um espectador', async () => {
  const { host, link } = await transmitir()
  const { janela: espectador } = await assistir(link, 'Tatu Verde')
  await recebeVideoEAudio(espectador)

  await host.getByRole('button', { name: 'Remover Tatu Verde' }).click()
  await expect(
    espectador.getByRole('heading', { name: 'Você foi removido da sessão' }),
  ).toBeVisible()
  await expect(host.getByTestId('espectadores')).toContainText('0 pessoas assistindo')
})

test('com a sessão trancada, ninguém novo entra', async () => {
  const { host, link } = await transmitir()
  const { janela: primeiro } = await assistir(link, 'Mico Roxo')
  await recebeVideoEAudio(primeiro)

  await host.getByRole('switch', { name: 'Trancar sessão' }).click()
  await expect(host.getByRole('switch', { name: 'Trancar sessão' })).toBeChecked()
  // Trancada, o app já avisa antes de pedir o apelido.
  const { janela: atrasado } = await abrirLink(link)
  await expect(atrasado.getByRole('heading', { name: 'Sessão trancada' })).toBeVisible()
  await recebeVideoEAudio(primeiro)

  await host.getByRole('switch', { name: 'Trancar sessão' }).click()
  await expect(host.getByRole('switch', { name: 'Trancar sessão' })).not.toBeChecked()
  await atrasado.getByRole('button', { name: 'Tentar de novo' }).click()
  await atrasado.getByRole('button', { name: 'Assistir' }).click()
  await recebeVideoEAudio(atrasado)
})

test('quem assiste vê quando o host pausa e retoma', async () => {
  const { host, link } = await transmitir()
  const { janela: espectador } = await assistir(link, 'Onça Cinza')
  await recebeVideoEAudio(espectador)

  await host.getByRole('button', { name: 'Pausar vídeo' }).click()
  await expect(espectador.getByText('O host pausou o compartilhamento')).toBeVisible()

  await host.getByRole('button', { name: 'Retomar vídeo' }).click()
  await expect(espectador.getByText('O host pausou o compartilhamento')).toBeHidden()
})
