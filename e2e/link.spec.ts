import { expect, test } from '@playwright/test'
import {
  abrirApp,
  abrirLink,
  assistir,
  entregarLink,
  fecharTodos,
  recebeVideoEAudio,
  transmitir,
} from './apoio.ts'

test.skip(process.platform !== 'win32', 'O app só existe para Windows')
test.afterEach(fecharTodos)

test('host compartilha, dois amigos assistem no app com áudio e veem a sessão encerrar', async () => {
  const { host, link } = await transmitir()
  expect(link).toMatch(/\/s\/[A-Za-z0-9]{12}$/)

  const espectadores = [
    (await assistir(link, 'Capivara Azul')).janela,
    (await assistir(link, 'Boto Rosa')).janela,
  ]
  for (const espectador of espectadores) await recebeVideoEAudio(espectador)
  await expect(host.getByTestId('espectadores')).toContainText('2 pessoas assistindo')

  await host.getByRole('button', { name: 'Parar' }).click()
  for (const espectador of espectadores) {
    await expect(espectador.getByRole('heading', { name: 'Sessão encerrada' })).toBeVisible()
    await espectador.getByRole('button', { name: 'Voltar ao início' }).click()
    await expect(espectador.getByRole('button', { name: 'Compartilhar tela' })).toBeVisible()
  }
})

test('link de sessão que não existe mostra link inválido', async () => {
  const { janela } = await abrirLink('https://telando.app/s/k7Qm2xPa9Lzz')
  await expect(janela.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible()
})

test('colar algo que não é link do Telando avisa sem sair do início', async () => {
  const { janela } = await abrirLink('https://exemplo.com/qualquer/coisa')
  await expect(janela.getByText('Esse link não é de uma transmissão do Telando.')).toBeVisible()
})

test('fechar o app do host encerra a sessão para quem assiste', async () => {
  const { hostApp, link } = await transmitir()
  const { janela: espectador } = await assistir(link, 'Tatu Azul')
  await recebeVideoEAudio(espectador)

  await hostApp.app.close()
  await expect(espectador.getByRole('heading', { name: 'Sessão encerrada' })).toBeVisible()
})

test('link telando:// entregue com o app aberto vai para a tela de assistir', async () => {
  const { sessao } = await transmitir()
  const amigo = await abrirApp()
  await expect(amigo.janela.getByRole('button', { name: 'Compartilhar tela' })).toBeVisible()

  await entregarLink(amigo.perfil, `telando://s/${sessao.id}`)
  await expect(amigo.janela.getByRole('heading', { name: 'Entrar para assistir' })).toBeVisible()
})

test('o app aberto por um link telando:// já começa na tela de assistir', async () => {
  const { sessao } = await transmitir()
  const { janela } = await abrirApp({ args: [`telando://s/${sessao.id}`] })
  await expect(janela.getByRole('heading', { name: 'Entrar para assistir' })).toBeVisible()
})

test('com uma sessão aberta, outro link pergunta antes de trocar', async () => {
  const primeira = await transmitir()
  const segunda = await transmitir()
  const amigo = await assistir(primeira.link, 'Boto Rosa')
  await recebeVideoEAudio(amigo.janela)

  await entregarLink(amigo.perfil, `telando://s/${segunda.sessao.id}`)
  await amigo.janela.getByRole('button', { name: 'Ficar aqui' }).click()
  await expect(amigo.janela.getByRole('alertdialog')).toBeHidden()
  await recebeVideoEAudio(amigo.janela)

  await entregarLink(amigo.perfil, `telando://s/${segunda.sessao.id}`)
  await amigo.janela.getByRole('button', { name: 'Abrir', exact: true }).click()
  await expect(amigo.janela.getByRole('heading', { name: 'Entrar para assistir' })).toBeVisible()
})

test('um link que chega durante a transmissão não derruba o host', async () => {
  const outra = await transmitir()
  const { hostApp, host } = await transmitir()

  await entregarLink(hostApp.perfil, `telando://s/${outra.sessao.id}`)
  await expect(host.getByText('Pare a sua transmissão para assistir.')).toBeVisible()
  await expect(host.getByText('AO VIVO')).toBeVisible()
})

test('ajustes ao vivo não derrubam quem está assistindo nem reabrem a captura', async () => {
  const { host, link } = await transmitir({
    antesDeIniciar: async (host) => {
      // Conta as capturas: ajustar fps e áudio muda a trilha, não pede a tela de novo.
      await host.evaluate(() => {
        const janela = window as Window & { capturas?: number }
        const original = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices)
        janela.capturas = 0
        navigator.mediaDevices.getDisplayMedia = (opcoes) => {
          janela.capturas = (janela.capturas ?? 0) + 1
          return original(opcoes)
        }
      })
      await host.getByText('Jogo', { exact: true }).click()
      await expect(host.getByTestId('resumo')).toContainText('60 fps · até 8 Mbps · áudio Música')
    },
  })

  const { janela: espectador } = await assistir(link, 'Quati Verde')
  await recebeVideoEAudio(espectador)

  await host.getByRole('button', { name: 'Ajustes' }).click()
  const ajustes = host.getByRole('complementary', { name: 'Ajustes da transmissão' })
  await ajustes.getByText('5', { exact: true }).click()
  await ajustes.getByText('Voz', { exact: true }).click()
  await expect(host.getByText('5 fps · até 8 Mbps · áudio Voz')).toBeVisible()

  await recebeVideoEAudio(espectador)
  await expect(host.getByTestId('espectadores')).toContainText('1 pessoa assistindo')
  expect(await host.evaluate(() => (window as Window & { capturas?: number }).capturas)).toBe(1)
})
