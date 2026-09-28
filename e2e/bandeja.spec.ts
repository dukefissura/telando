import { type ElectronApplication, expect, test } from '@playwright/test'
import {
  abrirApp,
  assistir,
  entregarLink,
  fecharTodos,
  recebeVideoEAudio,
  transmitir,
} from './apoio.ts'

test.skip(process.platform !== 'win32', 'O app só existe para Windows')
test.afterEach(fecharTodos)

const fecharJanela = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())

const janelaVisivel = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false)

test('fechar a janela deixa o Telando na bandeja, e abrir de novo traz a janela', async () => {
  const aberto = await abrirApp()
  await expect(aberto.janela.getByRole('button', { name: 'Compartilhar tela' })).toBeVisible()

  await fecharJanela(aberto.app)
  await expect.poll(() => janelaVisivel(aberto.app)).toBe(false)

  // Abrir o Telando com ele já rodando (atalho, menu Iniciar) só traz a janela de volta.
  await entregarLink(aberto.perfil, 'abrir')
  await expect.poll(() => janelaVisivel(aberto.app)).toBe(true)
})

test('com a janela fechada a transmissão continua', async () => {
  const { hostApp, link } = await transmitir()
  const { janela: amigo } = await assistir(link, 'Boto Rosa')
  await recebeVideoEAudio(amigo)

  await fecharJanela(hostApp.app)
  await expect.poll(() => janelaVisivel(hostApp.app)).toBe(false)
  await amigo.waitForTimeout(3000)
  await expect(amigo.getByRole('heading', { name: 'Sessão encerrada' })).toBeHidden()
  await recebeVideoEAudio(amigo)
})
