import { useLocalSearchParams } from 'expo-router';
import { lazy, Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Petunjuk } from '@/components/live/petunjuk-live';
import { siaranTersedia } from '@/lib/live-tersedia';

// Dimuat malas: modul LiveKit langsung crash bila dievaluasi di Expo Go.
const TontonLive = lazy(() => import('@/components/live/tonton-live'));

/** Menonton siaran publik warga lain, dibuka dari kartu LIVE di beranda. */
export default function LayarTonton() {
  const { ruang, judul, nama, mulai } = useLocalSearchParams<{
    ruang: string;
    judul?: string;
    nama?: string;
    mulai?: string;
  }>();

  if (!siaranTersedia) {
    return (
      <Petunjuk
        ikon="construct-outline"
        judul="Menonton siaran butuh development build"
        teks="Expo Go tidak memuat modul video real-time (WebRTC) yang dipakai LiveKit. Laporan di beranda tetap bisa ditonton di Expo Go."
        kode={'npx expo run:android\n# atau tanpa Android Studio:\nnpx eas-cli@latest build --profile development'}
      />
    );
  }
  return (
    <Suspense
      fallback={
        <View style={[styles.layar, styles.tengah]}>
          <ActivityIndicator color="#fff" />
        </View>
      }>
      <TontonLive
        ruang={ruang}
        judul={judul ?? 'Siaran langsung'}
        nama={nama || 'Warga'}
        mulai={mulai && Number.isFinite(Number(mulai)) ? Number(mulai) : null}
      />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
    backgroundColor: '#000',
  },
  tengah: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
