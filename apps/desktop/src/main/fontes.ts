import type { FonteDeCaptura } from '@telando/ui'
import { type DesktopCapturerSource, desktopCapturer, type Session, screen } from 'electron'

/**
 * O seletor é nosso (grade de miniaturas no renderer). O renderer escolhe a fonte por IPC e depois
 * chama getDisplayMedia; aqui o pedido é respondido com a fonte escolhida, sem diálogo do sistema.
 */
export function criarSeletorDeFontes(idsParaEsconder: () => string[]) {
  let ultimas = new Map<string, DesktopCapturerSource>()
  let escolhida: string | null = null

  async function listar(): Promise<FonteDeCaptura[]> {
    const esconder = new Set(idsParaEsconder())
    const fontes = (
      await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      })
    ).filter((fonte) => !esconder.has(fonte.id))
    ultimas = new Map(fontes.map((fonte) => [fonte.id, fonte]))

    const monitores = screen.getAllDisplays()
    const principal = screen.getPrimaryDisplay().id
    let numeroDaTela = 0

    return fontes.map((fonte): FonteDeCaptura => {
      const monitor = monitores.find((m) => String(m.id) === fonte.display_id)
      const ehTela = fonte.id.startsWith('screen:')
      if (ehTela) numeroDaTela += 1
      return {
        id: fonte.id,
        nome: ehTela
          ? `Tela ${numeroDaTela}${monitor?.id === principal ? ' (principal)' : ''}`
          : fonte.name,
        tipo: ehTela ? 'tela' : 'janela',
        miniatura: fonte.thumbnail.toDataURL(),
        icone: fonte.appIcon?.isEmpty() === false ? fonte.appIcon.toDataURL() : null,
        largura: monitor ? Math.round(monitor.size.width * monitor.scaleFactor) : null,
        altura: monitor ? Math.round(monitor.size.height * monitor.scaleFactor) : null,
      }
    })
  }

  function escolher(id: string) {
    if (!ultimas.has(id)) throw new Error('Essa tela ou janela não está mais disponível.')
    escolhida = id
  }

  function instalar(sessao: Session) {
    sessao.setDisplayMediaRequestHandler((pedido, responder) => {
      const fonte = escolhida ? ultimas.get(escolhida) : undefined
      // Sem fonte escolhida, responder vazio faz o getDisplayMedia falhar em vez de capturar algo aleatório.
      if (!fonte) return responder({})
      // 'loopback' captura o áudio do sistema inteiro no Windows.
      responder(pedido.audioRequested ? { video: fonte, audio: 'loopback' } : { video: fonte })
    })
  }

  return { listar, escolher, instalar }
}
