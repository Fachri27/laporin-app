import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PanelMasuk } from '@/components/akun/panel-masuk';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Lembar "masuk dulu" — muncul saat tamu mencoba menyukai atau berkomentar, seperti TikTok. */
export default function LayarMasuk() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { alasan } = useLocalSearchParams<{ alasan?: string }>();

  return (
    <View style={[styles.layar, { backgroundColor: w.surface, paddingBottom: insets.bottom + Spacing.four }]}>
      {/* Setinggi isinya (lembar fitToContents), tetapi bisa digulir bila lebih tinggi dari layar (HP kecil, huruf besar). */}
      <ScrollView style={[styles.gulir, { maxHeight: height * 0.75 }]} keyboardShouldPersistTaps="handled">
        <PanelMasuk alasan={alasan} onBerhasil={() => router.back()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    paddingTop: Spacing.five,
  },
  gulir: {
    flexGrow: 0,
  },
});
