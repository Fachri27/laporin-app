import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { lazy, memo, Suspense, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Media, Radius, Spacing } from '@/constants/theme';
import { siaranTersedia } from '@/lib/live-tersedia';
import { jarakKm, jarakTeks } from '@/lib/umpan';
import type { SiaranPublik } from '@/lib/live';

// LiveKit langsung crash bila dievaluasi di Expo Go; di sana kartu tampil tanpa pratinjau.
const PratinjauLive = siaranTersedia ? lazy(() => import('@/components/live/pratinjau-live')) : null;

type Props = {
  siaran: SiaranPublik;
  lebar: number;
  tinggi: number;
  /** Kartu yang sedang ditonton dan beranda fokus: pratinjau video tersambung. */
  putar: boolean;
  /** Sudah tidak ada di daftar siaran terbaru. */
  berakhir: boolean;
  acuan: { lat: number; lng: number } | null;
  /** Tinggi area tab Terbaru/Terdekat di atas kartu. */
  atas: number;
};

/**
 * Siaran langsung warga di umpan beranda, seperti LIVE yang lewat di umpan
 * TikTok: pratinjau video bisu, cincin merah di avatar, ketuk untuk masuk.
 */
export const KartuLive = memo(function KartuLive({ siaran: s, lebar, tinggi, putar, berakhir, acuan, atas }: Props) {
  const tempat =
    s.lat != null && s.lng != null
      ? acuan
        ? jarakTeks(jarakKm(acuan, { lat: s.lat, lng: s.lng }))
        : `sekitar ${s.lat.toFixed(2)}, ${s.lng.toFixed(2)}`
      : null;

  function tonton() {
    // Singular: ketuk ganda selama animasi buka tidak menumpuk dua layar (dua koneksi, suara dobel).
    router.push(
      {
        pathname: '/tonton/[ruang]',
        params: { ruang: s.ruang, judul: s.judul, nama: s.nama, mulai: String(s.mulai) },
      },
      { dangerouslySingular: true },
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={berakhir ? `Siaran ${s.nama} sudah berakhir` : `Tonton siaran langsung ${s.nama}: ${s.judul}`}
      disabled={berakhir}
      onPress={tonton}
      style={[styles.kartu, { width: lebar, height: tinggi }]}>
      {/* Latar saat video belum ada (memuat, Expo Go, atau siaran usai). */}
      <View style={[StyleSheet.absoluteFill, styles.latar]}>
        <Denyut aktif={!berakhir} />
      </View>

      {PratinjauLive && putar && !berakhir && (
        <Suspense fallback={null}>
          <PratinjauLive ruang={s.ruang} />
        </Suspense>
      )}

      <View pointerEvents="none" style={[styles.gradasiAtas, { height: atas + Spacing.five }]} />
      <View pointerEvents="none" style={styles.gradasiBawah} />

      <View pointerEvents="none" style={styles.info}>
        <View style={styles.barisTuan}>
          <View style={styles.wadahAvatar}>
            <View style={[styles.cincin, berakhir && styles.cincinMati]}>
              <View style={styles.avatar}>
                <Text style={styles.inisial}>{(s.nama.trim()[0] ?? 'W').toUpperCase()}</Text>
              </View>
            </View>
            {!berakhir && (
              <View style={styles.labelLive}>
                <Text style={styles.labelLiveTeks}>LIVE</Text>
              </View>
            )}
          </View>
          <View style={styles.fleks}>
            <Text style={styles.nama} numberOfLines={1}>
              {s.nama}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {berakhir ? 'Siaran sudah berakhir' : `${s.penonton} menonton`}
              {tempat && `  ·  ${tempat}`}
            </Text>
          </View>
        </View>
        <Text style={styles.judul} numberOfLines={2}>
          {s.judul}
        </Text>
      </View>

      {!berakhir && (
        <View pointerEvents="none" style={styles.ajakan}>
          <Ionicons name="radio" size={16} color="#fff" />
          <Text style={styles.ajakanTeks}>Ketuk untuk menonton LIVE</Text>
        </View>
      )}
    </Pressable>
  );
});

/** Cincin berdenyut di tengah, terlihat selama video belum masuk. */
function Denyut({ aktif }: { aktif: boolean }) {
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!aktif) return;
    const ulang = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    ulang.start();
    return () => ulang.stop();
  }, [t, aktif]);

  return (
    <View style={styles.denyut}>
      {aktif && (
        <Animated.View
          style={[
            styles.gelombang,
            {
              opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
              transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
            },
          ]}
        />
      )}
      <View style={[styles.inti, !aktif && styles.intiMati]}>
        <Ionicons name={aktif ? 'radio' : 'radio-outline'} size={34} color="#fff" />
      </View>
    </View>
  );
}

const bayangan = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

const styles = StyleSheet.create({
  kartu: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  latar: {
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'linear-gradient(to bottom, #241a14, #0d0b0a 70%)',
  },
  denyut: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gelombang: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Media.merah,
  },
  inti: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Media.merah,
  },
  intiMati: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  gradasiAtas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))',
  },
  gradasiBawah: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.75))',
  },
  info: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    gap: Spacing.two,
  },
  fleks: {
    flex: 1,
  },
  barisTuan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wadahAvatar: {
    alignItems: 'center',
  },
  // Cincin merah = sedang LIVE, seperti avatar di TikTok.
  cincin: {
    padding: 2,
    borderRadius: 26,
    borderWidth: 2.5,
    borderColor: Media.merah,
  },
  cincinMati: {
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#304036',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inisial: {
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 17,
  },
  labelLive: {
    marginTop: -9,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: Media.merah,
  },
  labelLiveTeks: {
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  nama: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    ...bayangan,
  },
  meta: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12.5,
    ...bayangan,
  },
  judul: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    ...bayangan,
  },
  ajakan: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  ajakanTeks: {
    color: '#fff',
    fontFamily: Fonts.semibold,
    fontSize: 14,
  },
});
