import Feather from '@expo/vector-icons/Feather';
import { lazy, Suspense } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TurboModuleRegistry, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tombol } from '@/components/tombol';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SITUS_URL } from '@/lib/umpan';

// Peta tab ini adalah peta situs di WebView. Development build lama dibuat sebelum
// react-native-webview dipasang (mengimpornya di sana langsung crash), dan web tidak memakai
// WebView ini — jadi dimuat malas hanya bila modul native-nya ada.
const PetaSitus =
  Platform.OS !== 'web' && TurboModuleRegistry.get('RNCWebViewModule') ? lazy(() => import('@/components/peta-situs')) : null;

/** Halaman peta situs untuk ponsel, dibuka di peramban bila peta tidak bisa tampil di sini. */
const URL_PETA_PERAMBAN = `${SITUS_URL}/id/karhutla/panel`;

export default function LayarPeta() {
  const w = useTheme();
  const insets = useSafeAreaInsets();

  if (!PetaSitus) {
    // .empty-view di desain: ikon, judul, satu paragraf — di bagian atas layar, bukan di tengah.
    return (
      <View style={[styles.kosong, { backgroundColor: w.background, paddingTop: insets.top + 72 }]}>
        <View style={[styles.ikon, { borderColor: w.border }]}>
          <Feather name="map" size={26} color={w.text} />
        </View>
        <Text style={[styles.judul, { color: w.text }]}>Peta belum tersedia</Text>
        <Text style={[styles.teks, { color: w.textSecondary }]}>
          {Platform.OS === 'web'
            ? 'Peta kejadian ada di situs Lapor Karhutla.'
            : __DEV__
              ? 'Development build ini dibuat sebelum react-native-webview dipasang. Buat development build baru.'
              : 'Versi aplikasi ini belum memuat peta. Perbarui aplikasi, atau buka petanya di situs.'}
        </Text>
        <Tombol judul="Buka peta di situs" ragam="sekunder" ikon="open-outline" onPress={() => void Linking.openURL(URL_PETA_PERAMBAN)} style={styles.tombol} />
      </View>
    );
  }

  return (
    <Suspense
      fallback={
        <View style={[styles.memuat, { backgroundColor: w.background }]}>
          <ActivityIndicator color={w.accentText} />
        </View>
      }>
      <PetaSitus />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  kosong: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 35,
  },
  memuat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ikon: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  judul: {
    marginTop: 18,
    fontFamily: Fonts.judulTebal,
    fontSize: 22,
    lineHeight: 27,
    textAlign: 'center',
  },
  teks: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  tombol: {
    marginTop: 20,
  },
});
