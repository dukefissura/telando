import { type ElectronApplication, expect, test } from '@playwright/test'
import { abrirApp, assistir, fecharTodos, transmitir } from './apoio.ts'

// Não é teste: mede o app para comparar antes e depois de otimizar. Rode com MEDIR=1.
test.skip(!process.env.MEDIR, 'Só com MEDIR=1')
test.afterEach(fecharTodos)

/**
 * CPU (% de um núcleo, somando os processos do app) e memória privada em MB, na média de uns
 * segundos. A privada, e não o working set: este conta de novo, em cada processo, as DLLs do Chromium.
 */
async function consumo(app: ElectronApplication, segundos: number) {
  // A primeira leitura de percentCPUUsage de cada processo sempre vem zerada.
  await app.evaluate(({ app }) => app.getAppMetrics())
  const amostras: Array<{ cpu: number; memoria: number }> = []
  for (let i = 0; i < segundos; i++) {
    await new Promise((pronto) => setTimeout(pronto, 1000))
    amostras.push(
      await app.evaluate(({ app }) => {
        const metricas = app.getAppMetrics()
        return {
          cpu: metricas.reduce((total, p) => total + p.cpu.percentCPUUsage, 0),
          memoria: metricas.reduce((total, p) => total + (p.memory.privateBytes ?? 0), 0) / 1024,
        }
      }),
    )
  }
  const media = (valores: number[]) => valores.reduce((a, b) => a + b, 0) / valores.length
  return {
    cpu: Number(media(amostras.map((a) => a.cpu)).toFixed(1)),
    memoriaMb: Math.round(media(amostras.map((a) => a.memoria))),
  }
}

test('desempenho do app', async () => {
  const resultado: Record<string, unknown> = {}

  const aberturas: number[] = []
  for (let i = 0; i < 3; i++) {
    const inicio = performance.now()
    const { app, janela } = await abrirApp()
    await expect(janela.getByRole('button', { name: 'Compartilhar tela' })).toBeVisible()
    aberturas.push(Math.round(performance.now() - inicio))
    if (i < 2) await app.close()
  }
  resultado.aberturaMs = aberturas

  const { app: primeiro, janela } = await abrirApp()
  resultado.parado = await consumo(primeiro, 5)
  await janela.getByRole('button', { name: 'Compartilhar tela' }).click()
  resultado.configuracoes = await consumo(primeiro, 8)
  await primeiro.close()

  const { hostApp, link } = await transmitir()
  resultado.transmitindoSemNinguem = await consumo(hostApp.app, 8)

  const inicio = performance.now()
  const amigo = await assistir(link, 'Capivara Azul')
  await expect
    .poll(() => amigo.janela.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0)
  resultado.primeiraImagemMs = Math.round(performance.now() - inicio)
  resultado.transmitindoComUm = await consumo(hostApp.app, 8)
  resultado.assistindo = await consumo(amigo.app, 8)

  console.log(`DESEMPENHO ${JSON.stringify(resultado)}`)
})
