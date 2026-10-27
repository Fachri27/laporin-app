import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { requireOptionalNativeModule } from 'expo';
import { Image } from 'expo-image';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Fonts, gradasi, Media, TINTA } from '@/constants/theme';
import { bukaKomentar } from '@/lib/aksi-laporan';
import {
  awalStory,
  kejadianHariIni,
  kelompokStory,
  tandaiDilihat,
  urutkanStory,
  useStoryDilihat,
  type Story,
} from '@/lib/story';
import { LEBAR_LAYAR_PX, tanggalSingkat, tempatPendek, urlGambar, useUmpan } from '@/lib/umpan';

// Sama dengan VideoUmpan: build tanpa modul native expo-video menampilkan poster saja.
const VideoStory = requireOptionalNativeModule('ExpoVideo') ? lazy(() => import('@/components/story/video-story')) : null;

/** Lama satu foto tampil, seperti Instagram. */
const DURASI_FOTO = 5000;

/** `n` naik setiap kali berpindah, juga saat item yang sama diulang: media dipasang ulang. */
type Posisi = { grup: number; item: number; n: number };

function berikut(p: Posisi, daftar: Story[]): Omit<Posisi, 'n'> | null {
  if (p.item + 1 < daftar[p.grup].item.length) return { grup: p.grup, item: p.item + 1 };
  if (p.grup + 1 < daftar.length) return { grup: p.grup + 1, item: 0 };
  return null;
}

function sebelumnya(p: Posisi): Omit<Posisi, 'n'> {
  if (p.item > 0) return { grup: p.grup, item: p.item - 1 };
  if (p.grup > 0) return { grup: p.grup - 1, item: 0 };
  return { grup: 0, item: 0 };
}

function sampulItem(s: Story['item'][number]): string | undefined {
  return s.media.jenis === 'video' ? s.media.poster : s.media.url;
}

/**
 * Penampil story dari desain (StoryViewer, lib/story.ts): foto/video layar penuh dengan bilah
 * kemajuan, keterangan di bawah, dan bilah komentar. Ketuk kanan = berikutnya, ketuk kiri =
 * sebelumnya, tahan = jeda, geser turun = tutup, ketuk keterangan = detail laporan.
 * Habis satu provinsi lanjut ke provinsi berikutnya; habis semua kembali ke beranda.
 */
export default function LayarStory() {
  const { kunci } = useLocalSearchParams<{ kunci: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Lembar komentar terbuka di atas story: story berhenti dulu.
  const fokus = useIsFocused();
  const { berita } = useUmpan();
  const dilihat = useStoryDilihat();
  // Dikunci saat dibuka, urutannya sama dengan cincin di beranda: umpan yang diperbarui
  // di belakang dan tanda "dilihat" yang bertambah tidak menggeser story yang sedang ditonton.
  const [daftar] = useState(() => urutkanStory(kelompokStory(berita, new Date()), dilihat));
  const [posisi, setPosisi] = useState<Posisi | null>(() => {
    const grup = daftar.findIndex((s) => s.kunci === kunci);
    return grup < 0 ? null : { grup, item: awalStory(daftar[grup], dilihat), n: 0 };
  });
  const [gambarSiap, setGambarSiap] = useState(false);
  const [videoSiap, setVideoSiap] = useState(false);
  const [videoGagal, setVideoGagal] = useState(false);
  const [ditahan, setDitahan] = useState(false);
  const [digeser, setDigeser] = useState(false);
  /** Tinggi kepala & keterangan di atas media: foto mendatar ditaruh di antara keduanya, tidak tertutup. */
  const [tinggiAtas, setTinggiAtas] = useState(0);
  const [tinggiBawah, setTinggiBawah] = useState(0);
  const [posisiTadi, setPosisiTadi] = useState(posisi);
  if (posisi !== posisiTadi) {
    setPosisiTadi(posisi);
    setGambarSiap(false);
    setVideoSiap(false);
    setVideoGagal(false);
  }

  const story = posisi ? daftar[posisi.grup] : undefined;
  const item = posisi && story ? story.item[posisi.item] : undefined;
  const sampul = item && sampulItem(item);
  // Video yang gagal dimuat diperlakukan seperti foto: posternya tampil 5 detik.
  const video = item?.media.jenis === 'video' && VideoStory !== null && !videoGagal;
  const penuh = item?.berita.vertikal ?? false;
  const jeda = ditahan || digeser || !fokus;

  const kemajuan = useSharedValue(0);
  const turun = useSharedValue(0);

  const tutup = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const maju = useCallback(
    () =>
      setPosisi((p) => {
        if (!p) return p;
        const b = berikut(p, daftar);
        return b ? { ...b, n: p.n + 1 } : null;
      }),
    [daftar],
  );
  const mundur = useCallback(() => setPosisi((p) => (p ? { ...sebelumnya(p), n: p.n + 1 } : p)), []);

  // Semua story habis, atau provinsi yang diketuk sudah tidak punya story → kembali.
  useEffect(() => {
    if (!posisi) tutup();
  }, [posisi, tutup]);

  // Item baru: bilah dari nol, tandai sudah dilihat, siapkan gambar berikutnya.
  useEffect(() => {
    cancelAnimation(kemajuan);
    kemajuan.set(0);
    if (!posisi || !item) return;
    tandaiDilihat(item.kunci);
    const b = berikut(posisi, daftar);
    const lanjut = b && daftar[b.grup].item[b.item];
    const s = lanjut && sampulItem(lanjut);
    if (s) void Image.prefetch(urlGambar(s, LEBAR_LAYAR_PX));
  }, [posisi, item, daftar, kemajuan]);

  // Foto: berjalan sejak gambarnya tampil, berhenti selama ditahan, lalu lanjut dari sisa waktunya.
  useEffect(() => {
    if (!item || video || jeda || (!gambarSiap && sampul)) return;
    const sisa = (1 - kemajuan.get()) * DURASI_FOTO;
    kemajuan.set(
      withTiming(1, { duration: sisa, easing: Easing.linear }, (selesai) => {
        if (selesai) scheduleOnRN(maju);
      }),
    );
    return () => cancelAnimation(kemajuan);
  }, [item, video, jeda, gambarSiap, sampul, kemajuan, maju]);

  const saatKemajuanVideo = useCallback(
    (k: number) => kemajuan.set(withTiming(k, { duration: 250, easing: Easing.linear })),
    [kemajuan],
  );

  const ketuk = Gesture.Tap()
    .maxDuration(300)
    .runOnJS(true)
    .onEnd((e, berhasil) => {
      if (!berhasil) return;
      if (e.x < width * 0.3) mundur();
      else maju();
    });
  const tahan = Gesture.LongPress()
    .minDuration(220)
    .maxDistance(30)
    .runOnJS(true)
    .onStart(() => setDitahan(true))
    .onFinalize(() => setDitahan(false));
  const geserTurun = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-24, 24])
    .onStart(() => {
      scheduleOnRN(setDigeser, true);
    })
    .onUpdate((e) => {
      turun.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 900) {
        scheduleOnRN(tutup);
        return;
      }
      turun.value = withSpring(0, { damping: 20, stiffness: 220 });
      scheduleOnRN(setDigeser, false);
    });
  // Ketukan menunggu tahan gagal (jari cepat diangkat); geser turun menang begitu jari bergerak.
  const gestur = Gesture.Race(geserTurun, Gesture.Exclusive(tahan, ketuk));

  const gayaGeser = useAnimatedStyle(() => ({
    transform: [{ translateY: turun.value }, { scale: 1 - Math.min(0.12, turun.value / 1600) }],
    borderRadius: turun.value > 0 ? 18 : 0,
  }));
  const gayaKemajuan = useAnimatedStyle(() => ({ width: `${kemajuan.value * 100}%` }));

  if (!story || !item || !posisi) return <View style={styles.layar} />;

  return (
    <View style={styles.layar}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.kartu, gayaGeser]}>
        <GestureDetector gesture={gestur}>
          <View
            style={StyleSheet.absoluteFill}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Story ${story.kunci}, ${posisi.item + 1} dari ${story.item.length}: ${item.berita.judul}`}
            accessibilityActions={[
              { name: 'increment', label: 'Berikutnya' },
              { name: 'decrement', label: 'Sebelumnya' },
            ]}
            onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? maju() : mundur())}>
            {/* Media mendatar tampil utuh di atas latar buram dari gambarnya sendiri — bukti tidak dipotong. */}
            {sampul && !penuh && (
              <>
                <Image source={{ uri: urlGambar(sampul, 64) }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={4} />
                <View style={[StyleSheet.absoluteFill, styles.redup]} />
              </>
            )}
            {/* Media tegak memenuhi layar seperti Instagram; mendatar tampil utuh di antara kepala
                dan keterangan supaya tidak tertutup teks. */}
            <View
              pointerEvents="none"
              style={penuh ? StyleSheet.absoluteFill : [styles.ruangMedia, { top: tinggiAtas, bottom: tinggiBawah }]}>
              {video && VideoStory && (
                <Suspense fallback={null}>
                  <VideoStory
                    key={`video-${posisi.n}`}
                    uri={item.media.url}
                    penuh={penuh}
                    putar={!jeda}
                    onSiap={() => setVideoSiap(true)}
                    onKemajuan={saatKemajuanVideo}
                    onSelesai={maju}
                    onGalat={() => setVideoGagal(true)}
                  />
                </Suspense>
              )}
              {/* Untuk video: poster menutupi layar hitam sampai bingkai pertama diputar. */}
              {sampul && !(video && videoSiap) && (
                <Image
                  key={`gambar-${posisi.n}`}
                  source={{ uri: urlGambar(sampul, LEBAR_LAYAR_PX) }}
                  style={StyleSheet.absoluteFill}
                  contentFit={penuh ? 'cover' : 'contain'}
                  onLoad={() => setGambarSiap(true)}
                  onError={() => setGambarSiap(true)}
                />
              )}
            </View>
            {!sampul && !video && (
              <View style={[StyleSheet.absoluteFill, styles.tengah]}>
                <Ionicons name="flame-outline" size={56} color={Media.garis} />
              </View>
            )}
            {((video && !videoSiap) || (!video && sampul && !gambarSiap)) && !jeda && (
              <View style={[StyleSheet.absoluteFill, styles.tengah]}>
                <ActivityIndicator color={Media.teks} size="large" />
              </View>
            )}
          </View>
        </GestureDetector>

        {/* Ditahan = tampilan bersih, seperti Instagram. */}
        <View
          pointerEvents="box-none"
          onLayout={(e) => setTinggiAtas(e.nativeEvent.layout.height)}
          style={[styles.atas, { paddingTop: insets.top + 8 }, jeda && styles.sembunyi]}>
          <View pointerEvents="none" style={styles.barisRel}>
            {story.item.map((x, i) => (
              <View key={x.kunci} style={styles.rel}>
                {i < posisi.item && <View style={[styles.isiRel, styles.relPenuh]} />}
                {i === posisi.item && <Animated.View style={[styles.isiRel, gayaKemajuan]} />}
              </View>
            ))}
          </View>
          <View pointerEvents="box-none" style={styles.kepala}>
            <View pointerEvents="none" style={styles.identitas}>
              {/* Cincin sinyal kecil berisi sampul provinsi. */}
              <View style={styles.cincinMini}>
                {story.sampul ? (
                  <Image source={{ uri: urlGambar(story.sampul, 128) }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.tengah]}>
                    <Ionicons name="flame" size={16} color={TINTA} />
                  </View>
                )}
              </View>
              <View style={styles.fleks}>
                <Text style={styles.nama} numberOfLines={1}>
                  {story.kunci}
                </Text>
                <Text style={styles.waktu}>{tanggalSingkat(item.berita.tanggal).toUpperCase()}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={tutup} hitSlop={12} style={styles.tutup}>
              <Feather name="x" size={20} color={Media.teks} />
            </Pressable>
          </View>
        </View>

        <View
          pointerEvents="box-none"
          onLayout={(e) => setTinggiBawah(e.nativeEvent.layout.height)}
          style={[styles.bawah, { paddingBottom: insets.bottom + 16 }, jeda && styles.sembunyi]}>
          <Pressable
            accessibilityRole="link"
            accessibilityHint="Membuka detail laporan"
            onPress={() => router.replace({ pathname: '/laporan/[id]', params: { id: String(item.berita.id) } })}
            style={({ pressed }) => [styles.keterangan, pressed && styles.ditekan]}>
            {kejadianHariIni(item.berita.tanggal) && (
              <View style={styles.lencana}>
                <View style={styles.titikLencana} />
                <Text style={styles.teksLencana}>TERKINI</Text>
              </View>
            )}
            <Text style={styles.judul} numberOfLines={3}>
              {item.berita.judul}
            </Text>
            <View style={styles.barisTempat}>
              {tempatPendek(item.berita) !== '' && (
                <>
                  <Feather name="map-pin" size={13} color={Media.teks} />
                  <Text style={styles.tempat} numberOfLines={1}>
                    {tempatPendek(item.berita).toUpperCase()}
                  </Text>
                </>
              )}
              <Text style={styles.detail}>DETAIL</Text>
              <Feather name="chevron-right" size={14} color={Media.teks} />
            </View>
          </Pressable>
          {/* Membuka lembar komentar laporan ini, langsung siap menulis. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => bukaKomentar(item.berita, true)}
            style={({ pressed }) => [styles.balas, pressed && styles.ditekan]}>
            <View style={styles.kolomBalas}>
              <Text style={styles.teksBalas}>Tulis komentar…</Text>
            </View>
            <View style={styles.kirim}>
              <Feather name="send" size={19} color={TINTA} />
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
    backgroundColor: Media.latar,
  },
  kartu: {
    overflow: 'hidden',
    backgroundColor: Media.latar,
  },
  tengah: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  redup: {
    backgroundColor: 'rgba(12,14,13,0.45)',
  },
  ruangMedia: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  sembunyi: {
    opacity: 0,
  },
  atas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 28,
    ...gradasi('linear-gradient(180deg, rgba(12,14,13,0.6), rgba(12,14,13,0))'),
  },
  barisRel: {
    flexDirection: 'row',
    gap: 4,
  },
  rel: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(237,232,223,0.3)',
  },
  isiRel: {
    height: '100%',
    backgroundColor: Media.teks,
  },
  relPenuh: {
    width: '100%',
  },
  kepala: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 2,
  },
  identitas: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  fleks: {
    flex: 1,
    minWidth: 0,
  },
  cincinMini: {
    width: 38,
    height: 38,
    borderRadius: 19,
    padding: 2,
    backgroundColor: Media.aksen,
  },
  avatar: {
    flex: 1,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: Media.latar,
    backgroundColor: Media.aksen,
  },
  nama: {
    color: Media.teks,
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  waktu: {
    marginTop: 2,
    color: Media.redup,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  // Tombol tutup bulat tinta, seperti tombol lain di atas foto.
  tutup: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Media.kaca,
  },
  bawah: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 20,
    paddingTop: 60,
    paddingHorizontal: 16,
    ...gradasi('linear-gradient(0deg, rgba(12,14,13,0.85), rgba(12,14,13,0))'),
  },
  keterangan: {
    gap: 10,
  },
  lencana: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Media.aksen,
  },
  titikLencana: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Media.onAksen,
  },
  teksLencana: {
    color: Media.onAksen,
    fontFamily: Fonts.monoTebal,
    fontSize: 10.5,
    letterSpacing: 0.8,
  },
  judul: {
    color: Media.teks,
    fontFamily: Fonts.judulTebal,
    fontSize: 22,
    lineHeight: 27,
  },
  barisTempat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tempat: {
    flexShrink: 1,
    color: Media.teks,
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  detail: {
    marginLeft: 'auto',
    color: Media.teks,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  balas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Kolom tulis pil seperti komentar live di desain; kirim = lingkaran tulang.
  kolomBalas: {
    flex: 1,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Media.garis,
    borderRadius: 26,
    backgroundColor: Media.kaca,
  },
  teksBalas: {
    color: Media.redup,
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  kirim: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Media.teks,
  },
  ditekan: {
    opacity: 0.85,
  },
});
