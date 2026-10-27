import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Chip saringan berbentuk pil berhuruf kapital kecil, dengan titik di depan: terpilih terisi
 * tulang (tinta di mode terang), lainnya bergaris tipis. Titik sinyal menandai satu kelompok
 * laporan; `netral` (mis. "Semua") bertitik sewarna teks. Dipakai berjajar di baris geser.
 */
export function ChipFilter({
  label,
  aktif,
  onPress,
  netral = false,
}: {
  label: string;
  aktif: boolean;
  onPress: () => void;
  netral?: boolean;
}) {
  const w = useTheme();
  const warnaTeks = aktif ? w.onChipAktif : w.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: aktif }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        aktif ? { backgroundColor: w.chipAktif, borderColor: w.chipAktif } : { borderColor: w.border },
        pressed && styles.ditekan,
      ]}>
      <View style={[styles.titik, { backgroundColor: netral ? warnaTeks : w.accent }]} />
      <Text style={[styles.teks, { color: warnaTeks }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
  },
  titik: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  teks: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.7,
  },
  ditekan: {
    opacity: 0.75,
  },
});
