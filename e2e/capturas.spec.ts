import { type Page, test } from '@playwright/test'
import { type AppAberto, assistir, fecharTodos, recebeVideoEAudio, transmitir } from './apoio.ts'

// Não é teste: gera as capturas para conferir o visual. Rode com CAPTURAS=1 pnpm e2e -- capturas.
test.skip(!process.env.CAPTURAS, 'Só com CAPTURAS=1')
test.afterEach(fecharTodos)

const PASTA = 'test-results/capturas'

async function tamanho(aberto: AppAberto, largura: number | 'cheia') {
  await aberto.app.evaluate(({ BrowserWindow }, alvo) => {
    const janela = BrowserWindow.getAllWindows().find((j) => j.getTitle() === 'Telando')
    if (!janela) return
    if (alvo === 'cheia') janela.maximize()
    else {
      janela.unmaximize()
      janela.setSize(alvo, 800)
    }
  }, largura)
  // Espera o layout assentar depois de redimensionar.
  await aberto.janela.waitForTimeout(400)
}

async function capturar(aberto: AppAberto, nome: string) {
  for (const largura of ['cheia', 1100, 960] as const) {
    await tamanho(aberto, largura)
    await aberto.janela.screenshot({ path: `${PASTA}/${nome}-${largura}.png` })
  }
}

async function alternarTema(pagina: Page) {
  await pagina.getByRole('button', { name: /Usar tema/ }).click()
}

test('capturas das telas', async () => {
  const { host, hostApp, link } = await transmitir()
  await capturar(hostApp, 'compartilhando-escuro')

  const amigo = await assistir(link, 'Capivara Azul')
  await recebeVideoEAudio(amigo.janela)
  await amigo.janela.mouse.move(400, 400)
  await capturar(amigo, 'assistindo')

  await host.getByRole('button', { name: 'Parar' }).click()
  await capturar(hostApp, 'inicio-escuro')
  await alternarTema(host)
  await capturar(hostApp, 'inicio-claro')
  await host.getByRole('button', { name: 'Compartilhar tela' }).click()
  await capturar(hostApp, 'configuracoes-claro')
  await capturar(amigo, 'encerrada-escuro')
})
