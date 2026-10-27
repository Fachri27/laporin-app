import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { urlMedia } from '@/lib/umpan';
import { PENYANGGA_VIDEO } from '@/lib/video';

type Props = {
  uri: string;
  penuh: boolean;
  /** false = ditahan warga (atau sedang digeser turun untuk menutup). */
  putar: boolean;
  /** Bingkai pertama diputar — bilah kemajuan mulai berjalan. */
  onSiap: () => void;
  /** 0–1, kira-kira empat kali sedetik. */
  onKemajuan: (kemajuan: number) => void;
  onSelesai: () => void;
  onGalat: () => void;
};

/**
 * Video satu item story, sekali putar dengan suara. Dimuat malas oleh layar story, hanya bila
 * modul native ExpoVideo ada di build ini. Item berganti = komponen dipasang ulang (key),
 * jadi hanya ada satu pemutar.
 */
export default function VideoStory({ uri, penuh, putar, onSiap, onKemajuan, onSelesai, onGalat }: Props) {
  const player = useVideoPlayer({ uri: urlMedia(uri), useCaching: true }, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
    p.bufferOptions = PENYANGGA_VIDEO;
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) onSiap();
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (player.duration > 0) onKemajuan(Math.min(1, currentTime / player.duration));
  });
  useEventListener(player, 'playToEnd', onSelesai);
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') onGalat();
  });

  useEffect(() => {
    if (putar) player.play();
    else player.pause();
  }, [player, putar]);

  return (
    // Sentuhan langsung ke gestur layar story (lihat catatan TextureView di video-umpan.tsx).
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={penuh ? 'cover' : 'contain'}
        nativeControls={false}
        surfaceType="textureView"
      />
    </View>
  );
}
