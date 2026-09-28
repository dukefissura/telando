import { expect, test } from '@playwright/test'
import {
  abrirApp,
  assistir,
  fecharTodos,
  lerLink,
  manterTelaMexendo,
  recebeVideoEAudio,
} from './apoio.ts'

test.skip(process.platform !== 'win32', 'O app só existe para Windows')
test.afterEach(fecharTodos)

test('o app compartilha a tela com áudio do sistema e troca resolução ao vivo', async () => {
  const hostApp = await abrirApp()
  await manterTelaMexendo(hostApp)
  const { janela } = hostApp
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

  const { janela: espectador } = await assistir(link, 'Capivara Azul')
  await recebeVideoEAudio(espectador)
  await expect(janela.getByTestId('espectadores')).toContainText('1 pessoa assistindo')

  await janela.getByRole('button', { name: 'Estatísticas' }).click()
  await janela.getByRole('button', { name: 'Ajustes' }).click()
  await janela.getByText('720p', { exact: true }).click()
  await expect
    .poll(
      async () => (await janela.getByTestId('estatisticas').innerText()).match(/(\d+)×(\d+)/)?.[2],
      // A captura é da tela real: com ela parada o Chromium quase não gera quadros, e a
      // resolução nova só aparece no próximo.
      { timeout: 20_000 },
    )
    .toBe('720')
  await recebeVideoEAudio(espectador)
  await janela.screenshot({ path: 'test-results/desktop-compartilhando.png' })
  await espectador.screenshot({ path: 'test-results/desktop-espectador.png' })

  await janela.getByRole('button', { name: 'Parar' }).click()
  await expect(espectador.getByRole('heading', { name: 'Sessão encerrada' })).toBeVisible()
})
