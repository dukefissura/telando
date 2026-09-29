import { criarClienteApi } from '@telando/core'
import { App, aplicarTemaSalvo, type Plataforma } from '@telando/ui'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './estilo.css'

const { telando } = window

const plataformaDesktop: Plataforma = {
  api: criarClienteApi(import.meta.env.VITE_TELANDO_SERVER ?? 'http://localhost:8787'),
  fontes: { listar: telando.listarFontes, escolher: telando.escolherFonte },
  usoDeCpu: telando.usoDeCpu,
  preferencias: { ler: telando.lerPreferencias, gravar: telando.gravarPreferencias },
  linkFixo: {
    segredo: telando.segredoDoLink,
    ler: telando.lerLinkFixo,
    gravar: telando.gravarLinkFixo,
  },
  aoMudarTransmissao: telando.avisarTransmitindo,
  aoAtalhoParar: telando.aoAtalhoParar,
  linkPendente: telando.linkPendente,
  aoChegarLink: telando.aoChegarLink,
  linkNaAreaDeTransferencia: telando.linkNaAreaDeTransferencia,
  atualizacao: {
    versaoNova: telando.versaoNova,
    aoChegar: telando.aoChegarVersaoNova,
    instalar: telando.instalarVersaoNova,
  },
}

aplicarTemaSalvo()

const raiz = document.getElementById('root')
if (!raiz) throw new Error('index.html sem #root')

createRoot(raiz).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App plataforma={plataformaDesktop} />
    </MotionConfig>
  </StrictMode>,
)
