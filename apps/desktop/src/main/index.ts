import { cpus } from 'node:os'
import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  globalShortcut,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  ipcMain,
  Menu,
  nativeImage,
  session,
  shell,
  Tray,
} from 'electron'
import Store from 'electron-store'
import { CANAIS } from '../compartilhado/ipc.ts'
import { criarSeletorDeFontes } from './fontes.ts'

const ATALHO_PARAR = 'CommandOrControl+Shift+S'
const PERMISSOES = new Set(['media', 'display-capture', 'clipboard-sanitized-write'])
const LIMITE_PREFERENCIAS = 16 * 1024

let janela: BrowserWindow | null = null
let bandeja: Tray | null = null
let transmitindo = false

const preferencias = new Store<{ transmissao: unknown }>({
  name: 'preferencias',
  defaults: { transmissao: null },
})
const seletor = criarSeletorDeFontes(() => (janela ? [janela.getMediaSourceId()] : []))
const recurso = (nome: string) => join(app.getAppPath(), 'resources', nome)

function mostrarJanela() {
  if (!janela) return
  if (janela.isMinimized()) janela.restore()
  janela.show()
  janela.focus()
}

function pedirParada() {
  janela?.webContents.send(CANAIS.atalhoParar)
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
        accelerator: ATALHO_PARAR,
        click: pedirParada,
      },
      { type: 'separator' },
      { label: 'Sair', role: 'quit' },
    ]),
  )
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 460,
    height: 760,
    minWidth: 360,
    minHeight: 480,
    title: 'Telando',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  janela.once('ready-to-show', () => janela?.show())
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
  ipcMain.on(CANAIS.transmitindo, (evento, estado: unknown) => {
    exigirOrigem(evento)
    transmitindo = estado === true
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

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', mostrarJanela)
  endurecer()

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
    globalShortcut.register(ATALHO_PARAR, pedirParada)
  })

  app.on('will-quit', () => globalShortcut.unregisterAll())
  app.on('window-all-closed', () => app.quit())
}
