import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  judul: string;
  onPress: () => void;
  /** primer = isian limau (aksi utama), sekunder = putih berbingkai, teks = tautan hijau. */
  ragam?: 'primer' | 'sekunder' | 'teks';
  ikon?: ComponentProps<typeof Ionicons>['name'];
  memuat?: boolean;
  nonaktif?: boolean;
  besar?: boolean;
  style?: ViewStyle;
};

export function Tombol({
  judul,
  onPress,
  ragam = 'primer',
  ikon,
  memuat = false,
  nonaktif = false,
  besar = false,
  style,
}: Props) {
  const w = useTheme();
  const mati = nonaktif || memuat;
  const warnaTeks = ragam === 'primer' ? w.onAccent : ragam === 'sekunder' ? w.text : w.accentText;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: mati, busy: memuat }}
      disabled={mati}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dasar,
        besar && styles.besar,
        ragam === 'primer' && { backgroundColor: pressed ? w.accentPressed : w.accent },
        ragam === 'sekunder' && {
          backgroundColor: pressed ? w.surfaceMuted : w.surface,
          borderColor: w.border,
          borderWidth: 1,
        },
        ragam === 'teks' && { backgroundColor: pressed ? w.accentSoft : 'transparent' },
        mati && styles.mati,
        style,
      ]}>
      <View style={styles.isi}>
        {memuat ? (
          <ActivityIndicator color={warnaTeks} />
        ) : (
          ikon && <Ionicons name={ikon} size={besar ? 20 : 18} color={warnaTeks} />
        )}
        <Text style={[styles.teks, besar && styles.teksBesar, { color: warnaTeks }]}>{judul}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dasar: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    justifyContent: 'center',
  },
  besar: {
    minHeight: 52,
  },
  isi: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  teks: {
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  teksBesar: {
    fontFamily: Fonts.judulTebal,
    fontSize: 15,
  },
  mati: {
    opacity: 0.45,
  },
});
