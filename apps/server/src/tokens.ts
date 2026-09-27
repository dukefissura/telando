import { AccessToken } from 'livekit-server-sdk'
import type { Env } from './env.ts'

type Papel = 'host' | 'espectador'

export function emitirLivekitToken(
  env: Env,
  { sala, identity, nome, papel }: { sala: string; identity: string; nome: string; papel: Papel },
): Promise<string> {
  // Só precisa valer na conexão; o LiveKit renova o token de quem já está na sala.
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity,
    name: nome,
    ttl: '10m',
  })
  token.addGrant({
    room: sala,
    roomJoin: true,
    canSubscribe: true,
    canPublish: papel === 'host',
    canPublishData: true,
  })
  return token.toJwt()
}
