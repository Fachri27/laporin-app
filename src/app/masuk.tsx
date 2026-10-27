import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PanelMasuk } from '@/components/akun/panel-masuk';
import { TombolIkon } from '@/components/bilah-atas';
import { Radius, Spacing } from '@/constants/theme';
import { useGulirKeIsian } from '@/hooks/use-gulir-ke-isian';
import { useRuangKeyboard } from '@/hooks/use-keyboard-terbuka';
import { useTheme } from '@/hooks/use-theme';

/**
 * Lembar "masuk dulu" — muncul saat tamu mencoba menyukai atau berkomentar, seperti TikTok.
 * Panel, pegangan, tombol tutup bulat bergaris; judul & pilihan masuk dari PanelMasuk.
 */
export default function LayarMasuk() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { alasan } = useLocalSearchParams<{ alasan?: string }>();
  const gulir = useRef<ScrollView>(null);
  const gulirKeIsian = useGulirKeIsian(gulir);
  // Lembar fitToContents di Android tidak naik sendiri di atas keyboard: isinya diberi ruang
  // setinggi keyboard, jadi lembarnya memanjang ke atas. iOS menggeser lembarnya sendiri.
  const tertutup = useRuangKeyboard();
  const keyboard = Platform.OS === 'android' ? tertutup : 0;

  return (
    <View
      style={[
        styles.layar,
        { backgroundColor: w.surface, paddingBottom: keyboard > 0 ? keyboard + Spacing.three : insets.bottom + Spacing.four },
      ]}>
      {/* Pegangan — iOS sudah punya pegangan bawaan lembar (sheetGrabberVisible). */}
      {Platform.OS !== 'ios' && <View style={[styles.pegangan, { backgroundColor: w.borderStrong }]} />}
      {/* Setinggi isinya (lembar fitToContents), tetapi bisa digulir bila lebih tinggi dari layar (HP kecil, huruf besar). */}
      <ScrollView
        ref={gulir}
        style={[styles.gulir, { maxHeight: Math.max(160, Math.min(height * 0.75, height - keyboard - insets.top - 96)) }]}
        keyboardShouldPersistTaps="handled"
        {...gulirKeIsian}>
        <PanelMasuk alasan={alasan} onBerhasil={() => router.back()} />
      </ScrollView>
      {/* Tutup di pojok kanan atas seperti lembar lain; judulnya sudah ada di panel. Digambar terakhir supaya di atas isi. */}
      <TombolIkon ikon="x" label="Tutup" onPress={() => router.back()} style={styles.tutup} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Jarak atas sama di semua platform: 32 = pegangan (9 + 4 + 19) di luar iOS.
  layar: {
    paddingTop: Platform.OS === 'ios' ? Spacing.five : 0,
  },
  pegangan: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginTop: 9,
    marginBottom: 19,
    borderRadius: Radius.pill,
  },
  gulir: {
    flexGrow: 0,
  },
  tutup: {
    position: 'absolute',
    top: 10,
    right: 12,
  },
});
