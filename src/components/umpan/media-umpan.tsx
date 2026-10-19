import Ionicons from '@expo/vector-icons/Ionicons';
import { requireOptionalNativeModule } from 'expo';
import { Image } from 'expo-image';
import { lazy, Suspense, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { KendaliVideo } from '@/components/umpan/video-umpan';
import { Fonts } from '@/constants/theme';
import { LEBAR_LAYAR_PX, urlGambar, type ItemMedia } from '@/lib/umpan';

// Development build yang dibuat sebelum expo-video dipasang tidak punya modul
// native-nya, dan mengimpor expo-video di sana langsung crash. Jadi pemutar
// dimuat malas hanya bila modulnya ada; tanpa itu video tampil sebagai sampul.
const VideoUmpan = requireOptionalNativeModule('ExpoVideo')
  ? lazy(() => import('@/components/umpan/video-umpan'))
  : null;

/** Perbesaran maksimum saat dicubit. */
const ZOOM_MAKS = 4;

type Props = {
  media: ItemMedia;
  /** Media tegak: memenuhi layar. Selain itu tampil utuh di atas latar buram, seperti video mendatar di TikTok. */
  penuh: boolean;
  /** Video ini yang sedang ditonton (kartu aktif, layar fokus). */
  putar: boolean;
  /** Muat pemutar walau belum diputar — untuk kartu aktif dan tetangganya, supaya geser berikutnya langsung jalan. */
  siapkan: boolean;
  bisu: boolean;
  /** Ketuk ganda di titik (x, y) — untuk menyukai. */
  onKetukGanda: (x: number, y: number) => void;
  /** Mulai/selesai dicubit — umpan berhenti bisa digeser selama zoom. */
  onZoom: (aktif: boolean) => void;
  /** Tekan lama — menyalakan/mematikan mode bersih. */
  onTekanLama: () => void;
};

/**
 * Satu foto atau video di kartu umpan, selebar dan setinggi kartu.
 *
 * Gestur seperti TikTok: cubit = perbesar di titik cubitan (kembali saat
 * dilepas), ketuk ganda = suka, ketuk sekali = jeda/putar video, tekan lama =
 * mode bersih.
 */
export function MediaUmpan({ media, penuh, putar, siapkan, bisu, onKetukGanda, onZoom, onTekanLama }: Props) {
  const sampul = media.jenis === 'video' ? media.poster : media.url;
  const [kendali, setKendali] = useState<KendaliVideo | null>(null);
  // Foto yang gagal dimuat (CDN galat, sinyal putus): tanda + ketuk untuk coba lagi, bukan kartu hitam polos.
  const [gagal, setGagal] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const gambarGagal = media.jenis === 'gambar' && gagal === sampul;

  const skala = useSharedValue(1);
  const geserX = useSharedValue(0);
  const geserY = useSharedValue(0);
  const lebar = useSharedValue(0);
  const tinggi = useSharedValue(0);

  const cubit = Gesture.Pinch()
    .onStart(() => {
      scheduleOnRN(onZoom, true);
    })
    .onUpdate((e) => {
      skala.value = Math.min(ZOOM_MAKS, Math.max(1, e.scale));
      // Titik cubitan tetap di bawah jari: geser sejauh jaraknya dari tengah.
      geserX.value = (e.focalX - lebar.value / 2) * (1 - skala.value);
      geserY.value = (e.focalY - tinggi.value / 2) * (1 - skala.value);
    })
    .onFinalize(() => {
      skala.value = withTiming(1, { duration: 200 });
      geserX.value = withTiming(0, { duration: 200 });
      geserY.value = withTiming(0, { duration: 200 });
      scheduleOnRN(onZoom, false);
    });

  const ketukGanda = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .runOnJS(true)
    .onEnd((e, berhasil) => {
      if (berhasil) onKetukGanda(e.x, e.y);
    });

  const ketukSekali = Gesture.Tap()
    .runOnJS(true)
    .onEnd((_e, berhasil) => {
      if (!berhasil) return;
      if (gambarGagal) {
        // Key baru memasang ulang Image, jadi gambar diminta lagi.
        setGagal(null);
        setPercobaan((n) => n + 1);
      } else kendali?.ketuk();
    });

  const tekanLama = Gesture.LongPress()
    .minDuration(450)
    .onStart(() => {
      // Dua jari yang diam saat mencubit bisa terbaca tekan lama.
      if (skala.value > 1.02) return;
      scheduleOnRN(onTekanLama);
    });

  // Ketukan menunggu tekan lama gagal (jari diangkat lebih cepat), jadi keduanya tidak terpicu sekaligus.
  const gestur = Gesture.Simultaneous(cubit, Gesture.Exclusive(tekanLama, ketukGanda, ketukSekali));

  const gayaZoom = useAnimatedStyle(() => ({
    transform: [{ translateX: geserX.value }, { translateY: geserY.value }, { scale: skala.value }],
  }));

  const gambarSampul = sampul ? (
    <Image
      key={percobaan}
      source={{ uri: urlGambar(sampul, LEBAR_LAYAR_PX) }}
      style={StyleSheet.absoluteFill}
      contentFit={penuh ? 'cover' : 'contain'}
      transition={150}
      onError={() => setGagal(sampul)}
    />
  ) : (
    <View style={styles.tengah}>
      <Ionicons name="flame-outline" size={48} color="rgba(255,255,255,0.4)" />
    </View>
  );

  return (
    <GestureDetector gesture={gestur}>
      <View
        style={styles.wadah}
        onLayout={(e) => {
          lebar.value = e.nativeEvent.layout.width;
          tinggi.value = e.nativeEvent.layout.height;
        }}>
        {!penuh && sampul && (
          <>
            {/* Latar buram dari gambar 64 px: memburamkan foto selayar penuh terlalu berat saat digeser. */}
            <Image source={{ uri: urlGambar(sampul, 64) }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={4} />
            <View style={[StyleSheet.absoluteFill, styles.redup]} />
          </>
        )}

        <Animated.View style={[StyleSheet.absoluteFill, gayaZoom]}>
          {media.jenis === 'video' && siapkan && VideoUmpan ? (
            <Suspense fallback={gambarSampul}>
              <VideoUmpan onKendali={setKendali} uri={media.url} sampul={sampul} penuh={penuh} putar={putar} bisu={bisu} />
            </Suspense>
          ) : (
            gambarSampul
          )}
        </Animated.View>

        {gambarGagal && (
          <View style={styles.tengah} pointerEvents="none">
            <View style={styles.pilBuild}>
              <Ionicons name="image-outline" size={16} color="#fff" />
              <Text style={styles.teksBuild}>Gambar gagal dimuat · ketuk untuk coba lagi</Text>
            </View>
          </View>
        )}

        {media.jenis === 'video' && !VideoUmpan && (
          <View style={styles.tengah} pointerEvents="none">
            <View style={styles.pilBuild}>
              <Ionicons name="videocam-off-outline" size={16} color="#fff" />
              <Text style={styles.teksBuild}>Video butuh versi aplikasi terbaru</Text>
            </View>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wadah: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  redup: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  tengah: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pilBuild: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  teksBuild: {
    color: '#fff',
    fontSize: 13,
    fontFamily: Fonts.semibold,
  },
});
