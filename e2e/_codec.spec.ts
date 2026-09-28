import { type ElectronApplication, expect, test } from '@playwright/test'
import { assistir, fecharTodos, recebeVideoEAudio, transmitir } from './apoio.ts'

test.afterEach(fecharTodos)
async function cpu(app: ElectronApplication) {
  await app.evaluate(({ app }) => app.getAppMetrics())
  let soma = 0
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    soma += await app.evaluate(({ app }) =>
      app.getAppMetrics().reduce((t, p) => t + p.cpu.percentCPUUsage, 0),
    )
  }
  return (soma / 8).toFixed(1)
}
for (const codec of ['AV1', 'H.264', 'VP9']) {
  test(`codec ${codec}`, async () => {
    const { host, hostApp, link } = await transmitir({
      antesDeIniciar: async (janela) => {
        await janela.getByText('Filme/vídeo', { exact: true }).click()
        await janela.locator('summary', { hasText: 'Vídeo' }).click()
        await janela.getByRole('combobox').first().selectOption({ label: codec })
      },
    })
    const { janela } = await assistir(link, 'Capivara Azul')
    await recebeVideoEAudio(janela)
    await host.getByRole('button', { name: 'Estatísticas' }).click()
    await expect(host.getByTestId('estatisticas')).toContainText(
      codec === 'H.264' ? 'H264' : codec,
      { ignoreCase: true },
    )
    const uso = await cpu(hostApp.app)
    const impl = await host.evaluate(async () => {
      const w = window as unknown as { __impl?: string }
      return w.__impl ?? ''
    })
    console.log(
      `CODEC ${codec} cpu=${uso}% ${impl} ${(await host.getByTestId('estatisticas').innerText()).replace(/\n/g, ' ')}`,
    )
  })
}
