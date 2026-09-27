import { useEffect, useState } from 'react'

async function listarMicrofones() {
  const dispositivos = await navigator.mediaDevices.enumerateDevices()
  return dispositivos.filter((d) => d.kind === 'audioinput' && d.deviceId)
}

/**
 * Sem permissão de microfone o navegador esconde nomes e ids dos dispositivos. Quando o microfone
 * é ligado, pedimos a permissão uma vez e listamos de novo; plugar um fone atualiza a lista.
 */
export function useMicrofones(microfoneLigado: boolean) {
  const [microfones, setMicrofones] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    let ativo = true
    const atualizar = async () => {
      let lista = await listarMicrofones()
      if (microfoneLigado && lista.every((mic) => !mic.label)) {
        const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
        for (const trilha of fluxo?.getTracks() ?? []) trilha.stop()
        if (fluxo) lista = await listarMicrofones()
      }
      if (ativo) setMicrofones(lista)
    }
    void atualizar()
    navigator.mediaDevices.addEventListener('devicechange', atualizar)
    return () => {
      ativo = false
      navigator.mediaDevices.removeEventListener('devicechange', atualizar)
    }
  }, [microfoneLigado])

  return microfones
}
