import { isTrackReference, LiveKitRoom, useRoomContext, useTracks, VideoTrack } from '@livekit/react-native';
import { RoomEvent, Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { mintaTiketTonton } from '@/lib/live';

/**
 * Pratinjau bisu siaran di kartu beranda, seperti LIVE yang lewat di umpan
 * TikTok. Hanya dipasang selama kartunya sedang ditonton; dimuat malas oleh
 * kartu-live.tsx hanya di development build. Selalu dengan tiket tamu (hanya
 * menonton): warga yang sekadar menggeser umpan tidak tampil dengan nama akunnya.
 */
export default function PratinjauLive({ ruang }: { ruang: string }) {
  const [tiket, setTiket] = useState<{ url: string; token: string } | null>(null);

  useEffect(() => {
    let batal = false;
    void mintaTiketTonton(ruang, null).then((h) => {
      if (!batal && h.ok) setTiket(h.tiket);
    });
    return () => {
      batal = true;
    };
  }, [ruang]);

  if (!tiket) return null;
  return (
    <LiveKitRoom
      serverUrl={tiket.url}
      token={tiket.token}
      connect
      audio={false}
      video={false}
      options={{ adaptiveStream: true }}
      // Tidak berlangganan otomatis: suara pelapor tidak boleh berbunyi di umpan.
      connectOptions={{ autoSubscribe: false }}>
      <VideoPelapor />
    </LiveKitRoom>
  );
}

function VideoPelapor() {
  const room = useRoomContext();
  const kamera = useTracks([Track.Source.Camera]).find((t) => !t.participant.isLocal && isTrackReference(t));

  // Langganan video saja, termasuk yang diterbitkan setelah kita masuk.
  useEffect(() => {
    const langganVideo = () => {
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.videoTrackPublications.values()) {
          if (!pub.isSubscribed) pub.setSubscribed(true);
        }
      }
    };
    langganVideo();
    room.on(RoomEvent.Connected, langganVideo).on(RoomEvent.TrackPublished, langganVideo);
    return () => {
      room.off(RoomEvent.Connected, langganVideo).off(RoomEvent.TrackPublished, langganVideo);
    };
  }, [room]);

  if (!kamera) return null;
  return <VideoTrack trackRef={kamera} style={StyleSheet.absoluteFill} objectFit="cover" />;
}
