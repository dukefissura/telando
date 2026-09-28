import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
} from '@playwright/test'

// Roda o build de verdade (apps/desktop/out), capturando a tela real do Windows.
export const pastaDesktop = fileURLToPath(new URL('../apps/desktop', import.meta.url))
export const executavel = fileURLToPath(
  new URL('../apps/desktop/node_modules/electron/dist/electron.exe', import.meta.url),
)

// Processos filhos do VS Code herdam ELECTRON_RUN_AS_NODE=1, que faz o Electron rodar como Node puro.
const { ELECTRON_RUN_AS_NODE: _, ...ambienteHerdado } = process.env
export const ambiente = ambienteHerdado as Record<string, string>

export type AppAberto = { app: ElectronApplication; janela: Page; perfil: string }
const abertos: AppAberto[] = []

/** Cada app tem o próprio perfil: é assim que dois rodam juntos na mesma máquina. */
export async function abrirApp(opcoes: { args?: string[] } = {}): Promise<AppAberto> {
  const perfil = await mkdtemp(join(tmpdir(), 'telando-e2e-'))
  const app = await electron.launch({
    executablePath: executavel,
    args: [pastaDesktop, ...(opcoes.args ?? [])],
    env: { ...ambiente, TELANDO_PERFIL: perfil },
  })
  const janela = await app.firstWindow()
  // Os testes leem estados finais; animação só atrasaria.
  await janela.emulateMedia({ reducedMotion: 'reduce' })
  const aberto = { app, janela, perfil }
  abertos.push(aberto)
  return aberto
}

export async function fecharTodos() {
  // Um app que o próprio teste já fechou rejeita o close de novo; aqui só importa que feche.
  await Promise.all(abertos.splice(0).map(({ app }) => app.close().catch(() => undefined)))
}

/** O espectador está vendo o vídeo e recebendo uma trilha de áudio ativa. */
export async function recebeVideoEAudio(espectador: Page) {
  await expect
    .poll(() => espectador.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), {
      // Dois ou três apps abrindo juntos deixam a primeira conexão mais lenta.
      timeout: 15_000,
    })
    .toBeGreaterThan(0)
  await expect
    .poll(() =>
      espectador.locator('audio').evaluateAll((audios) =>
        audios.some((a) => {
          const fluxo = (a as HTMLAudioElement).srcObject
          return fluxo instanceof MediaStream && fluxo.getAudioTracks()[0]?.readyState === 'live'
        }),
      ),
    )
    .toBe(true)
}

// Com a tela parada o Chromium não gera quadros, e quem entra depois espera um quadro-chave que
// não vem. Um quadrado mudando de cor num canto garante que a Tela 1 sempre tenha movimento.
const PAGINA_ANIMADA = `data:text/html,${encodeURIComponent(
  '<body style="margin:0"><canvas id="c" width="120" height="120"></canvas><script>' +
    'const c = document.getElementById("c").getContext("2d"); let i = 0;' +
    'setInterval(() => { c.fillStyle = "hsl(" + ((i += 7) % 360) + ",80%,50%)"; c.fillRect(0, 0, 120, 120) }, 50)' +
    '</script></body>',
)}`

export async function manterTelaMexendo(aberto: AppAberto) {
  await aberto.app.evaluate(({ BrowserWindow }, pagina) => {
    const janela = new BrowserWindow({
      width: 120,
      height: 120,
      x: 0,
      y: 0,
      frame: false,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: true,
    })
    void janela.loadURL(pagina)
  }, PAGINA_ANIMADA)
}

/** Começa a transmitir a Tela 1 num app e devolve o link e a sessão criada (com o hostToken). */
export async function transmitir(hostApp?: AppAberto) {
  const aberto = hostApp ?? (await abrirApp())
  await manterTelaMexendo(aberto)
  const host = aberto.janela
  await host.getByRole('button', { name: 'Compartilhar tela' }).click()
  await host.getByRole('button', { name: /^Tela 1/ }).click()
  const resposta = host.waitForResponse(
    (r) => r.url().endsWith('/api/sessions') && r.request().method() === 'POST',
  )
  await host.getByRole('button', { name: 'Iniciar' }).click()
  const sessao = (await (await resposta).json()) as { id: string; hostToken: string }
  return { host, hostApp: aberto, link: await lerLink(host), sessao }
}

/** Abre outro app e cola o link no "Entrar com um link". */
export async function abrirLink(link: string): Promise<AppAberto> {
  const aberto = await abrirApp()
  await aberto.janela.getByLabel('Entrar com um link').fill(link)
  await aberto.janela.getByRole('button', { name: 'Entrar', exact: true }).click()
  return aberto
}

/** Abre outro app, entra pelo link e começa a assistir com o apelido. */
export async function assistir(link: string, apelido: string): Promise<AppAberto> {
  const aberto = await abrirLink(link)
  await aberto.janela.getByLabel('Seu apelido').fill(apelido)
  await aberto.janela.getByRole('button', { name: 'Assistir' }).click()
  return aberto
}

/** O link que o host mostra (e copia) na tela "Compartilhando". */
export async function lerLink(host: Page): Promise<string> {
  const url = await host.locator('#link').getAttribute('data-url')
  if (!url) throw new Error('A tela do host não mostrou o link da transmissão.')
  return url
}
