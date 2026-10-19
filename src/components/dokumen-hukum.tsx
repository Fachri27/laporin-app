import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Spacing } from '@/constants/theme';
import type { Bagian } from '@/constants/hukum';
import { useTheme } from '@/hooks/use-theme';

/** Teks Ketentuan / Kebijakan Privasi, dibaca di dalam aplikasi (tanpa membuka situs). */
export function DokumenHukum({ bagian }: { bagian: Bagian[] }) {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: w.background }}
      contentContainerStyle={[styles.isi, { paddingBottom: insets.bottom + Spacing.five }]}>
      {bagian.map((b) => (
        <View key={b.judul} style={styles.bagian}>
          <Text style={[styles.judul, { color: w.text }]}>{b.judul}</Text>
          {b.isi.map((p) => (
            <Text key={p.slice(0, 40)} style={[styles.paragraf, { color: w.text }]}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  isi: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  bagian: {
    gap: Spacing.two,
  },
  judul: {
    fontFamily: Fonts.judul,
    fontSize: 16,
  },
  paragraf: {
    fontFamily: Fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
  },
});
