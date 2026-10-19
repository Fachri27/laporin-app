import { lazy, Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Petunjuk } from '@/components/live/petunjuk-live';
import { MODE_DEMO } from '@/lib/api';
import { siaranTersedia } from '@/lib/live-tersedia';

// Dimuat malas: modul LiveKit langsung crash bila dievaluasi di Expo Go.
const SiaranLive = lazy(() => import('@/components/live/siaran-live'));

export default function LayarLive() {
  if (!siaranTersedia) {
    return (
      <Petunjuk
        ikon="construct-outline"
        judul="Siaran langsung butuh development build"
        teks="Expo Go tidak memuat modul video real-time (WebRTC) yang dipakai LiveKit. Fitur lapor lain tetap bisa dicoba di Expo Go."
        kode={'npx expo run:android\n# atau tanpa Android Studio:\nnpx eas-cli@latest build --profile development'}
      />
    );
  }
  if (MODE_DEMO) {
    return (
      <Petunjuk
        ikon="server-outline"
        judul="Siaran langsung butuh server"
        teks="Isi EXPO_PUBLIC_API_URL di .env dengan alamat server yang membagikan token LiveKit (mock server atau situs), lalu jalankan ulang."
        kode={'npm run livekit   # server LiveKit lokal\nnpm run mock      # token + halaman penonton'}
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
      <SiaranLive />
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
