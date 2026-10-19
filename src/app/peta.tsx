import Ionicons from '@expo/vector-icons/Ionicons';
import { lazy, Suspense } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { halanganPeta, type HalanganPeta } from '@/lib/peta-tersedia';

// Dimuat malas: modul native peta tidak boleh dievaluasi di build yang belum siap (lihat peta-tersedia.ts).
const PetaLaporan = lazy(() => import('@/components/peta-laporan'));

// Instruksi pengembang hanya di __DEV__. Build rilis tanpa kunci Maps memang boleh (docs/RILIS.md),
// jadi warga hanya diberi tahu bahwa peta belum tersedia.
const PETUNJUK: Record<Exclude<HalanganPeta, null>, { judul: string; teks: string; kode?: string }> = {
  web: {
    judul: 'Peta hanya di aplikasi HP',
    teks: 'Buka aplikasi di Android atau iPhone untuk melihat peta laporan.',
  },
  'perlu-build': __DEV__
    ? {
        judul: 'Peta butuh development build baru',
        teks: 'Development build ini dibuat sebelum react-native-maps dipasang. Buat development build baru.',
        kode: 'npx eas-cli@latest build --profile development',
      }
    : {
        judul: 'Peta belum tersedia',
        teks: 'Versi aplikasi ini belum memuat peta. Perbarui aplikasi; laporan tetap bisa dilihat di Beranda dan Jelajah.',
      },
  'perlu-kunci': __DEV__
    ? {
        judul: 'Peta butuh Google Maps API key',
        teks:
          'iPhone memakai Apple Maps tanpa kunci. Untuk Android, isi env GOOGLE_MAPS_ANDROID_API_KEY: di EAS env saat build/update, ' +
          'dan ekspor juga saat expo start supaya manifest dev memuat plugin peta. Build yang dibuat tanpa kunci perlu dibuild ulang.',
        kode: 'GOOGLE_MAPS_ANDROID_API_KEY=AIza… npx expo start',
      }
    : {
        judul: 'Peta belum tersedia',
        teks: 'Peta belum tersedia di versi aplikasi ini. Laporan tetap bisa dilihat di Beranda dan Jelajah.',
      },
};

export default function LayarPeta() {
  const w = useTheme();
  const insets = useSafeAreaInsets();

  if (halanganPeta) {
    const p = PETUNJUK[halanganPeta];
    return (
      <View style={[styles.tengah, { backgroundColor: w.background, paddingBottom: insets.bottom }]}>
        <Ionicons name="map-outline" size={56} color={w.accentText} />
        <Text style={[styles.judul, { color: w.text }]}>{p.judul}</Text>
        <Text style={[styles.teks, { color: w.textSecondary }]}>{p.teks}</Text>
        {p.kode && (
          <Text selectable style={[styles.kode, { color: w.text, backgroundColor: w.surface, borderColor: w.border }]}>
            {p.kode}
          </Text>
        )}
      </View>
    );
  }

  return (
    <Suspense
      fallback={
        <View style={[styles.tengah, { backgroundColor: w.background }]}>
          <ActivityIndicator color={w.accentText} />
        </View>
      }>
      <PetaLaporan />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  tengah: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  judul: {
    fontSize: 20,
    fontFamily: Fonts.judulTebal,
    textAlign: 'center',
  },
  teks: {
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  kode: {
    alignSelf: 'stretch',
    fontFamily: Fonts.mono,
    fontSize: 12.5,
    lineHeight: 19,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
});
