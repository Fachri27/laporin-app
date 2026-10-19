import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & {
  label: string;
  petunjuk?: string;
  galat?: boolean;
};

/** Kotak isian berlabel. Penghitung karakter muncul bila `maxLength` diisi. */
export function Isian({ label, petunjuk, galat = false, multiline, maxLength, value, style, ...lain }: Props) {
  const w = useTheme();
  const panjang = value?.length ?? 0;
  const dekatBatas = maxLength !== undefined && panjang > maxLength * 0.8;

  return (
    <View style={styles.wadah}>
      <View style={styles.baris}>
        <Text style={[styles.label, { color: w.textSecondary }]}>{label}</Text>
        {dekatBatas && (
          <Text style={[styles.hitung, { color: w.textSecondary }]}>
            {panjang}/{maxLength}
          </Text>
        )}
      </View>
      <TextInput
        value={value}
        maxLength={maxLength}
        multiline={multiline}
        placeholderTextColor={w.textSecondary}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.multiline,
          { color: w.text, backgroundColor: w.surface, borderColor: galat ? w.danger : w.border },
          style,
        ]}
        {...lain}
      />
      {petunjuk && <Text style={[styles.petunjuk, { color: w.textSecondary }]}>{petunjuk}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wadah: {
    gap: Spacing.one + 2,
  },
  baris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  // Label kecil tebal abu-abu di atas kotak, seperti "What's happening?" di desain.
  label: {
    fontFamily: Fonts.bold,
    fontSize: 12.5,
  },
  hitung: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.regular,
    fontSize: 15,
  },
  multiline: {
    minHeight: 104,
    lineHeight: 22,
  },
  petunjuk: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },
});
