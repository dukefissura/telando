import { RoomAudioRenderer, useTracks, VideoTrack } from '@livekit/components-react'
import { Track } from 'livekit-client'

export function Palco() {
  const [tela] = useTracks([Track.Source.ScreenShare], { onlySubscribed: true })

  return (
    <main className="grid h-dvh place-items-center bg-black">
      {tela ? (
        <VideoTrack trackRef={tela} className="h-full w-full object-contain" />
      ) : (
        <p className="text-texto-suave">Aguardando o host começar.</p>
      )}
      <RoomAudioRenderer />
    </main>
  )
}
