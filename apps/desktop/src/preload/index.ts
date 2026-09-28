import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron'
import { CANAIS, type TelandoDesktop } from '../compartilhado/ipc.ts'

const telando: TelandoDesktop = {
  listarFontes: () => ipcRenderer.invoke(CANAIS.listarFontes),
  escolherFonte: (id) => ipcRenderer.invoke(CANAIS.escolherFonte, id),
  usoDeCpu: () => ipcRenderer.invoke(CANAIS.usoDeCpu),
  lerPreferencias: () => ipcRenderer.invoke(CANAIS.lerPreferencias),
  gravarPreferencias: (config) => ipcRenderer.invoke(CANAIS.gravarPreferencias, config),
  avisarTransmitindo: (transmitindo) => ipcRenderer.send(CANAIS.transmitindo, transmitindo),
  segredoDoLink: () => ipcRenderer.invoke(CANAIS.segredoDoLink),
  lerLinkFixo: () => ipcRenderer.invoke(CANAIS.lerLinkFixo),
  gravarLinkFixo: (link) => ipcRenderer.invoke(CANAIS.gravarLinkFixo, link),
  aoAtalhoParar: (callback) => {
    const ouvinte = () => callback()
    ipcRenderer.on(CANAIS.atalhoParar, ouvinte)
    return () => ipcRenderer.off(CANAIS.atalhoParar, ouvinte)
  },
  linkPendente: () => ipcRenderer.invoke(CANAIS.linkPendente),
  aoAbrirLink: (callback) => {
    const ouvinte = (_evento: IpcRendererEvent, texto: unknown) => {
      if (typeof texto === 'string') callback(texto)
    }
    ipcRenderer.on(CANAIS.abrirLink, ouvinte)
    return () => ipcRenderer.off(CANAIS.abrirLink, ouvinte)
  },
}

contextBridge.exposeInMainWorld('telando', telando)
