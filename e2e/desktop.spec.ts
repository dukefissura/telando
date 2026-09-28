import { fileURLToPath } from 'node:url'
import { _electron as electron, expect, test } from '@playwright/test'
import { lerLink, recebeVideoEAudio } from './apoio.ts'

// Roda o build de verdade (apps/desktop/out), capturando a tela real do Windows.
const pastaDesktop = fileURLToPath(new URL('../apps/desktop', import.meta.url))
const executavel = fileURLToPath(
  new URL('../apps/desktop/node_modules/electron/dist/electron.exe', import.meta.url),
)

test.skip(process.platform !== 'win32', 'O app desktop só existe para Windows')

// Processos filhos do VS Code herdam ELECTRON_RUN_AS_NODE=1, que faz o Electron rodar como Node puro.
const { ELECTRON_RUN_AS_NODE: _, ...ambiente } = process.env

test('desktop compartilha a tela com áudio do sistema e troca resolução ao vivo', async ({
  browser,
}) => {
  const app = await electron.launch({
    executablePath: executavel,
    args: [pastaDesktop],
    env: ambiente as Record<string, string>,
  })
  try {
    const janela = await app.firstWindow()
    await janela.getByRole('button', { name: 'Compartilhar tela' }).click()
    await janela.getByRole('button', { name: /^Tela 1/ }).click()
    await janela.getByText('Filme/vídeo', { exact: true }).click()
    // Com uma camada só, a resolução nas estatísticas é a escolhida; com simulcast, o dynacast
    // pode mandar só a camada menor para um espectador de janela pequena.
    await janela.locator('summary', { hasText: 'Vídeo' }).click()
    await janela.getByRole('switch', { name: 'Várias qualidades para quem assiste' }).uncheck()
    await janela.screenshot({ path: 'test-results/desktop-configuracoes.png' })
    await janela.getByRole('button', { name: 'Iniciar' }).click()
    const link = await lerLink(janela)

    const espectador = await (await browser.newContext()).newPage()
    await espectador.goto(link)
    await espectador.getByRole('button', { name: 'Assistir' }).click()
    await recebeVideoEAudio(espectador)
    await expect(janela.getByTestId('espectadores')).toContainText('1 pessoa assistindo')

    await janela.getByRole('button', { name: 'Estatísticas' }).click()
    await janela.getByRole('button', { name: 'Ajustes' }).click()
    await janela.getByText('720p', { exact: true }).click()
    await expect
      .poll(
        async () =>
          (await janela.getByTestId('estatisticas').innerText()).match(/(\d+)×(\d+)/)?.[2],
      )
      .toBe('720')
    await recebeVideoEAudio(espectador)
    await janela.screenshot({ path: 'test-results/desktop-compartilhando.png' })
    await espectador.screenshot({ path: 'test-results/desktop-espectador.png' })

    await janela.getByRole('button', { name: 'Parar' }).click()
    await expect(espectador.getByRole('heading', { name: 'Sessão encerrada' })).toBeVisible()
  } finally {
    await app.close()
  }
})
