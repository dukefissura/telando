import { randomBytes } from 'node:crypto'
import { cpus } from 'node:os'
import { join } from 'node:path'
import { destinoDoLink } from '@telando/core'
import type { MeuLinkFixo } from '@telando/ui'
import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  ipcMain,
  Menu,
  nativeImage,
  safeStorage,
  session,
  shell,
  Tray,
} from 'electron'
import Store from 'electron-store'
import { CANAIS } from '../compartilhado/ipc.ts'
import { criarSeletorDeFontes } from './fontes.ts'

// Ctrl+Shift+S é o 'Salvar como' de muita coisa; com Alt junto ninguém usa.
const ATALHO_PARAR = 'CommandOrControl+Alt+Shift+S'
const PERMISSOES = new Set(['media', 'display-capture', 'clipboard-sanitized-write'])
const LIMITE_PREFERENCIAS = 16 * 1024
const LIMITE_LINK = 300

// Os testes E2E abrem dois apps na mesma máquina; cada um precisa do próprio perfil (e do próprio
// lock de instância única). Tem que vir antes do Store, que lê a pasta ao ser criado.
if (process.env.TELANDO_PERFIL) app.setPath('userData', process.env.TELANDO_PERFIL)

let janela: BrowserWindow | null = null
let bandeja: Tray | null = null
let transmitindo = false

const linkNosArgumentos = (argv: string[]) =>
  argv.find((arg) => arg.startsWith('telando://') && arg.length <= LIMITE_LINK) ?? null

// O link fica aqui até o renderer pedir. Ele só é avisado de que chegou um: se ainda não estiver
// ouvindo (carregando, recarregando), pede o pendente ao montar, e nada se perde.
let linkPendente = linkNosArgumentos(process.argv)

const preferencias = new Store<{
  transmissao: unknown
  linkFixo: MeuLinkFixo | null
  /** Segredo do link fixo, cifrado com safeStorage (DPAPI da conta do Windows). */
  segredoLinkCifrado: string | null
  janela: { maximizada: boolean; largura: number; altura: number } | null
  /** O aviso de que o app continua na bandeja aparece só na primeira vez. */
  avisouBandeja: boolean
}>({
  name: 'preferencias',
  defaults: {
    transmissao: null,
    linkFixo: null,
    segredoLinkCifrado: null,
    janela: null,
    avisouBandeja: false,
  },
})

// Fechar a janela só a esconde; o app sai de verdade pelo "Sair" da bandeja (ou pelo sistema).
let saindo = false

/** O segredo é gerado aqui na primeira vez e é o que prova que o link fixo é deste computador. */
function segredoDoLink(): string {
  const cifrado = preferencias.get('segredoLinkCifrado')
  if (cifrado) return safeStorage.decryptString(Buffer.from(cifrado, 'base64'))
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('O Windows não liberou a criptografia para guardar o segredo do link.')
  }
  const novo = randomBytes(32).toString('base64url')
  preferencias.set('segredoLinkCifrado', safeStorage.encryptString(novo).toString('base64'))
  return novo
}

function ehLinkFixo(valor: unknown): valor is MeuLinkFixo {
  if (typeof valor !== 'object' || valor === null) return false
  const { slug, nome, url } = valor as Record<string, unknown>
  return (
    typeof slug === 'string' &&
    /^[a-z0-9-]{3,20}$/.test(slug) &&
    typeof nome === 'string' &&
    nome.length <= 32 &&
    typeof url === 'string' &&
    /^https?:\/\//.test(url) &&
    url.length <= 200
  )
}
const seletor = criarSeletorDeFontes(() => (janela ? [janela.getMediaSourceId()] : []))
const recurso = (nome: string) => join(app.getAppPath(), 'resources', nome)

function mostrarJanela() {
  if (!janela) return
  if (janela.isMinimized()) janela.restore()
  janela.show()
  janela.focus()
}

// O app mora na bandeja e quase nunca fecha: procurar só ao abrir deixaria versões para trás.
const INTERVALO_ATUALIZACAO_MS = 4 * 60 * 60 * 1000
let versaoNova: string | null = null
let instalarVersaoNova: (() => void) | null = null

/**
 * Baixa a versão nova em segundo plano. Pronta, a tela inicial oferece reiniciar; se ninguém
 * clicar, ela instala sozinha quando o app sair (autoInstallOnAppQuit, padrão do electron-updater).
 */
async function procurarAtualizacoes() {
  // Carregado só aqui: é metade do main e não tem nada a ver com abrir a janela.
  const { autoUpdater } = await import('electron-updater')
  autoUpdater.on('update-downloaded', ({ version }) => {
    versaoNova = version
    janela?.webContents.send(CANAIS.chegouVersaoNova)
  })
  instalarVersaoNova = () => {
    saindo = true
    // Silencioso e reabrindo o app: o instalador não aparece.
    autoUpdater.quitAndInstall(true, true)
  }
  const procurar = () =>
    autoUpdater.checkForUpdates().catch((erro: unknown) => {
      // Sem internet ou sem release novo: o app segue na versão atual e tenta na próxima volta.
      console.warn('Não consegui procurar atualização.', erro)
    })
  void procurar()
  setInterval(() => void procurar(), INTERVALO_ATUALIZACAO_MS)
}

/** Um link telando:// chegou com o app já aberto (o Windows abriu uma segunda instância). */
function abrirLink(argv: string[]) {
  const link = linkNosArgumentos(argv)
  mostrarJanela()
  if (!link) return
  linkPendente = link
  janela?.webContents.send(CANAIS.chegouLink)
}

function pedirParada() {
  janela?.webContents.send(CANAIS.atalhoParar)
}

let atalhoRegistrado = false

// O atalho só existe enquanto há o que parar, para não ocupar a combinação no sistema à toa.
function atualizarAtalho() {
  if (transmitindo && !atalhoRegistrado) {
    atalhoRegistrado = globalShortcut.register(ATALHO_PARAR, pedirParada)
    if (!atalhoRegistrado) {
      console.warn(`Outro programa já usa ${ATALHO_PARAR}; o atalho de parar ficou sem efeito.`)
    }
  } else if (!transmitindo && atalhoRegistrado) {
    globalShortcut.unregister(ATALHO_PARAR)
    atalhoRegistrado = false
  }
}

function atualizarBandeja() {
  if (!bandeja) return
  bandeja.setImage(recurso(transmitindo ? 'bandeja-ao-vivo.png' : 'bandeja.png'))
  bandeja.setToolTip(transmitindo ? 'Telando: ao vivo' : 'Telando')
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Telando', click: mostrarJanela },
      {
        label: 'Parar compartilhamento',
        enabled: transmitindo,
        ...(atalhoRegistrado && { accelerator: ATALHO_PARAR }),
        click: pedirParada,
      },
      { type: 'separator' },
      { label: 'Sair', role: 'quit' },
    ]),
  )
}

function avisarQueFicouNaBandeja() {
  if (!bandeja || preferencias.get('avisouBandeja')) return
  preferencias.set('avisouBandeja', true)
  bandeja.displayBalloon({
    iconType: 'info',
    title: 'O Telando continua aberto',
    content: 'Ele fica aqui na bandeja. Para sair de vez, use "Sair" no menu do ícone.',
  })
}

function criarJanela() {
  const salva = preferencias.get('janela')
  janela = new BrowserWindow({
    width: salva?.largura ?? 1280,
    height: salva?.altura ?? 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Telando',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Quem assiste não clica em nada para ouvir: o som da transmissão toca ao entrar.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  janela.once('ready-to-show', () => {
    if (salva?.maximizada ?? true) janela?.maximize()
    janela?.show()
  })
  janela.on('close', (evento) => {
    if (!janela) return
    const { width, height } = janela.getNormalBounds()
    preferencias.set('janela', { maximizada: janela.isMaximized(), largura: width, altura: height })
    if (saindo) return
    evento.preventDefault()
    janela.hide()
    avisarQueFicouNaBandeja()
  })
  // Desligando ou saindo da conta do Windows: a janela não pode segurar o encerramento.
  janela.on('query-session-end', () => {
    saindo = true
  })
  janela.on('closed', () => {
    janela = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void janela.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void janela.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

/** Só a nossa janela, com a nossa página, pode falar com o main. */
function exigirOrigem(evento: IpcMainInvokeEvent | IpcMainEvent) {
  const url = evento.senderFrame?.url ?? ''
  const nossaPagina = process.env.ELECTRON_RENDERER_URL
    ? url.startsWith(process.env.ELECTRON_RENDERER_URL)
    : url.startsWith('file://')
  if (evento.sender !== janela?.webContents || !nossaPagina) {
    throw new Error('Pedido de IPC de origem desconhecida')
  }
}

function registrarIpc() {
  ipcMain.handle(CANAIS.listarFontes, (evento) => {
    exigirOrigem(evento)
    return seletor.listar()
  })
  ipcMain.handle(CANAIS.escolherFonte, (evento, id: unknown) => {
    exigirOrigem(evento)
    if (typeof id !== 'string' || id.length > 200) throw new Error('Fonte inválida')
    seletor.escolher(id)
  })
  ipcMain.handle(CANAIS.usoDeCpu, (evento) => {
    exigirOrigem(evento)
    const soma = app
      .getAppMetrics()
      .reduce((total, processo) => total + processo.cpu.percentCPUUsage, 0)
    return soma / cpus().length
  })
  ipcMain.handle(CANAIS.lerPreferencias, (evento) => {
    exigirOrigem(evento)
    return preferencias.get('transmissao')
  })
  ipcMain.handle(CANAIS.gravarPreferencias, (evento, config: unknown) => {
    exigirOrigem(evento)
    if (JSON.stringify(config).length > LIMITE_PREFERENCIAS)
      throw new Error('Preferências grandes demais')
    preferencias.set('transmissao', config)
  })
  ipcMain.handle(CANAIS.segredoDoLink, (evento) => {
    exigirOrigem(evento)
    return segredoDoLink()
  })
  ipcMain.handle(CANAIS.lerLinkFixo, (evento) => {
    exigirOrigem(evento)
    return preferencias.get('linkFixo')
  })
  ipcMain.handle(CANAIS.gravarLinkFixo, (evento, link: unknown) => {
    exigirOrigem(evento)
    if (!ehLinkFixo(link)) throw new Error('Link fixo inválido')
    preferencias.set('linkFixo', link)
  })
  ipcMain.handle(CANAIS.linkPendente, (evento) => {
    exigirOrigem(evento)
    const link = linkPendente
    linkPendente = null
    return link
  })
  // Só um link do Telando sai da área de transferência; qualquer outro conteúdo fica no main.
  ipcMain.handle(CANAIS.linkNaAreaDeTransferencia, async (evento) => {
    exigirOrigem(evento)
    const texto = (await clipboard.readText()).slice(0, 2048).trim()
    return destinoDoLink(texto) ? texto : null
  })
  ipcMain.handle(CANAIS.versaoNova, (evento) => {
    exigirOrigem(evento)
    return versaoNova
  })
  ipcMain.on(CANAIS.instalarVersaoNova, (evento) => {
    exigirOrigem(evento)
    // Nunca durante uma transmissão: a tela só oferece no início, mas o main confere de novo.
    if (!transmitindo) instalarVersaoNova?.()
  })
  ipcMain.on(CANAIS.transmitindo, (evento, estado: unknown) => {
    exigirOrigem(evento)
    transmitindo = estado === true
    // Quem transmite deixa o Telando escondido por horas; estrangulada, a página atrasava os timers
    // do LiveKit (ping da sala) e das estatísticas. Fora da transmissão, o estrangulamento volta e
    // as animações param quando a janela some.
    evento.sender.setBackgroundThrottling(!transmitindo)
    atualizarAtalho()
    atualizarBandeja()
  })
}

function endurecer() {
  app.enableSandbox()
  app.on('web-contents-created', (_evento, conteudo) => {
    conteudo.on('will-navigate', (evento) => evento.preventDefault())
    conteudo.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url)
      return { action: 'deny' }
    })
  })
}

// O vídeo é codificado no processo da página; escondida, ela perde prioridade para o jogo que
// disputa a CPU, e o encoder começa a perder quadros.
app.commandLine.appendSwitch('disable-renderer-backgrounding')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_evento, argv) => abrirLink(argv))
  endurecer()
  // Mesmo id do atalho que o instalador cria: sem ele, o aviso da bandeja sai com um nome técnico
  // no lugar de "Telando".
  if (app.isPackaged) app.setAppUserModelId('app.telando.desktop')

  void app.whenReady().then(() => {
    const sessao = session.defaultSession
    sessao.setPermissionRequestHandler((_conteudo, permissao, responder) =>
      responder(PERMISSOES.has(permissao)),
    )
    sessao.setPermissionCheckHandler((_conteudo, permissao) => PERMISSOES.has(permissao))
    seletor.instalar(sessao)
    registrarIpc()
    criarJanela()
    bandeja = new Tray(nativeImage.createFromPath(recurso('bandeja.png')))
    bandeja.on('click', mostrarJanela)
    atualizarBandeja()
    // Só o app instalado se atualiza; o electron-updater lê os releases públicos do GitHub.
    if (app.isPackaged) void procurarAtualizacoes()
  })

  app.on('before-quit', () => {
    saindo = true
  })
  app.on('will-quit', () => globalShortcut.unregisterAll())
  app.on('window-all-closed', () => app.quit())
}
