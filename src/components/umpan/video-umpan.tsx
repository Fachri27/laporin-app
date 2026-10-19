import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent, useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { LEBAR_LAYAR_PX, urlGambar, urlMedia } from '@/lib/umpan';

/** Ketukan ditangkap gestur di MediaUmpan (bersama cubit & ketuk ganda), lalu diteruskan ke sini. */
export type KendaliVideo = { ketuk: () => void };

/**
 * Pemutar video kartu umpan. Dimuat malas oleh media-umpan.tsx, hanya bila
 * modul native ExpoVideo ada di build ini.
 *
 * Pemutar hanya dibuat untuk kartu aktif dan tetangganya (lihat `siapkan` di
 * MediaUmpan), jadi paling banyak tiga pemutar hidup sekaligus — hemat memori dan kuota.
 */
export default function VideoUmpan({
  onKendali,
  uri,
  sampul,
  penuh,
  putar,
  bisu,
}: {
  /** Dipanggil saat pemutar siap (dan null saat dilepas) — MediaUmpan meneruskan ketukan lewat sini. */
  onKendali?: (kendali: KendaliVideo | null) => void;
  uri: string;
  sampul: string | undefined;
  penuh: boolean;
  putar: boolean;
  bisu: boolean;
}) {
  const player = useVideoPlayer({ uri: urlMedia(uri), useCaching: true }, (p) => {
    p.loop = true;
    p.muted = bisu;
    p.timeUpdateEventInterval = 0.25;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  // Sampul menutupi layar hitam sampai bingkai pertama benar-benar diputar.
  const [pernahJalan, setPernahJalan] = useState(false);
  const [kemajuan, setKemajuan] = useState(0);
  // Ikon ▶ hanya untuk jeda oleh ketukan warga — bukan jeda sesaat ketika
  // kartu baru aktif dan pemutar belum sempat mulai (dulu ikonnya berkedip).
  const [dijeda, setDijeda] = useState(false);
  const [putarSebelumnya, setPutarSebelumnya] = useState(putar);
  if (putar !== putarSebelumnya) {
    // Kartu ditinggalkan atau didatangi lagi: jeda manual dilupakan.
    setPutarSebelumnya(putar);
    setDijeda(false);
  }

  useEventListener(player, 'playingChange', ({ isPlaying: jalan }) => {
    if (jalan) setPernahJalan(true);
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (player.duration > 0) setKemajuan(Math.min(1, currentTime / player.duration));
  });

  useEffect(() => {
    setelBisu(player, bisu);
  }, [player, bisu]);

  // Kartu ditinggalkan → jeda; kembali → putar lagi, walau tadi dijeda dengan ketukan.
  useEffect(() => {
    if (putar) player.play();
    else player.pause();
  }, [player, putar]);

  useEffect(() => {
    onKendali?.({
      ketuk() {
        // Galat (sinyal putus, server sibuk): ketukan memuat ulang sumbernya — play() saja tidak.
        if (player.status === 'error') {
          player
            .replaceAsync({ uri: urlMedia(uri), useCaching: true })
            .then(() => player.play())
            // Pemutar sudah dilepas (kartu digeser) atau sumber tetap galat — status 'error' yang menandainya.
            .catch(() => {});
          setDijeda(false);
        } else if (player.playing) {
          player.pause();
          setDijeda(true);
        } else {
          player.play();
          setDijeda(false);
        }
      },
    });
    return () => onKendali?.(null);
  }, [player, onKendali, uri]);

  return (
    <View
      accessible
      accessibilityLabel={isPlaying ? 'Video diputar — ketuk untuk jeda' : 'Video dijeda — ketuk untuk putar'}
      style={StyleSheet.absoluteFill}>
      {/* Di Android, VideoView menelan sentuhan lalu mengirim tiruannya ke JS
          (lihat VideoView.kt di expo-video), sehingga ketukan batal dan geseran
          tersendat. pointerEvents="none": sentuhan langsung ke gestur MediaUmpan. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit={penuh ? 'cover' : 'contain'}
          nativeControls={false}
          // TextureView: aman di dalam daftar yang digeser dan bisa ditumpuk tampilan lain (Android).
          surfaceType="textureView"
        />
      </View>
      {!pernahJalan && sampul && (
        <Image
          source={{ uri: urlGambar(sampul, LEBAR_LAYAR_PX) }}
          style={StyleSheet.absoluteFill}
          contentFit={penuh ? 'cover' : 'contain'}
        />
      )}

      {putar && !dijeda && status === 'loading' && (
        <View style={styles.tengah} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}
      {putar && dijeda && !isPlaying && (
        <View style={styles.tengah} pointerEvents="none">
          <Ionicons name="play" size={64} color="rgba(255,255,255,0.85)" />
        </View>
      )}
      {status === 'error' && (
        <View style={styles.tengah} pointerEvents="none">
          <Ionicons name="alert-circle-outline" size={40} color="#fff" />
          <Text style={styles.galat}>Video gagal dimuat · ketuk untuk coba lagi</Text>
        </View>
      )}

      {putar && (
        <View style={styles.rel} pointerEvents="none">
          <View style={[styles.isiRel, { width: `${kemajuan * 100}%` }]} />
        </View>
      )}
    </View>
  );
}

/** Pemutar adalah objek native yang memang diubah lewat propertinya, bukan state React. */
function setelBisu(player: VideoPlayer, bisu: boolean) {
  player.muted = bisu;
}

const styles = StyleSheet.create({
  tengah: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  galat: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.semibold,
  },
  rel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  isiRel: {
    height: '100%',
    backgroundColor: '#fff',
  },
});
