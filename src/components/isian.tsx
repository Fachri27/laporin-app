import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & {
  label: string;
  petunjuk?: string;
  galat?: boolean;
};

/**
 * Kotak isian berlabel: panel bergaris tipis bersudut 16 dengan label kapital kecil di dalam,
 * teks di bawahnya, petunjuk kecil di dasar panel. Mengetuk di mana saja pada panel memfokuskan
 * isian. Penghitung karakter muncul hanya saat mendekati batas: di kanan label untuk satu baris,
 * di kanan bawah untuk isian banyak baris (yang bisa memanjang melewati layar).
 */
export function Isian({ label, petunjuk, galat = false, multiline, maxLength, value, style, ...lain }: Props) {
  const w = useTheme();
  const isian = useRef<TextInput>(null);
  const panjang = value?.length ?? 0;
  const tampilHitung = maxLength !== undefined && panjang > maxLength * 0.8;
  const hitung = tampilHitung && (
    <Text style={[styles.hitung, { color: w.textSecondary }]}>
      {panjang}/{maxLength}
    </Text>
  );

  return (
    <Pressable
      accessible={false}
      onPress={() => isian.current?.focus()}
      style={[styles.panel, { backgroundColor: w.surface, borderColor: galat ? w.danger : w.border }]}>
      <View style={styles.barisLabel}>
        <Text style={[styles.label, { color: w.textSecondary }]}>{label}</Text>
        {!multiline && hitung}
      </View>
      <TextInput
        ref={isian}
        value={value}
        maxLength={maxLength}
        multiline={multiline}
        accessibilityLabel={label}
        placeholderTextColor={w.textSecondary}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multiline, { color: w.text }, style]}
        {...lain}
      />
      {(petunjuk || (multiline && hitung)) && (
        <View style={styles.barisBawah}>
          <Text style={[styles.petunjuk, { color: w.textSecondary }]}>{petunjuk}</Text>
          {multiline && hitung}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  barisLabel: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 7,
  },
  label: {
    flexShrink: 1,
    fontFamily: Fonts.monoTebal,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 24,
    paddingVertical: 2,
    paddingHorizontal: 0,
    fontFamily: Fonts.medium,
    fontSize: 15,
    includeFontPadding: false,
  },
  multiline: {
    minHeight: 96,
    fontFamily: Fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
  },
  barisBawah: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  hitung: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
  },
  petunjuk: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    opacity: 0.8,
  },
});
