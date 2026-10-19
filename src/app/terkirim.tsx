import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tombol } from '@/components/tombol';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function LayarTerkirim() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { demo } = useLocalSearchParams<{ demo?: string }>();

  return (
    <View style={[styles.layar, { backgroundColor: w.background, paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four }]}>
      <View style={styles.tengah}>
        <View style={[styles.lingkaran, { backgroundColor: w.accentSoft }]}>
          <Ionicons name="checkmark-circle" size={72} color={w.accentText} />
        </View>
        <Text style={[styles.judul, { color: w.text }]}>Laporan terkirim</Text>
        <Text style={[styles.teks, { color: w.textSecondary }]}>
          Terima kasih. Laporan Anda masuk antrean pemeriksaan petugas dan belum tampil di situs.
        </Text>
        {demo === '1' && (
          <Text style={[styles.demo, { color: w.accentText }]}>Mode demo: tidak ada yang benar-benar dikirim.</Text>
        )}
      </View>
      <Tombol judul="Kembali ke beranda" ikon="home" besar onPress={() => router.dismissTo('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  tengah: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  lingkaran: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  judul: {
    fontSize: 26,
    fontFamily: Fonts.judulTebal,
  },
  teks: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  demo: {
    fontSize: 13,
    fontFamily: Fonts.semibold,
    textAlign: 'center',
  },
});
