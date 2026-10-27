import { StyleSheet, Text } from 'react-native';

import { Fonts, TULANG } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Wordmark "LAPORIN." seperti sampul desain ("SAKSI."): Poppins tebal, titik sinyal.
 * `diAtasFoto` = selalu tulang, apa pun mode HP.
 */
export function Merek({ diAtasFoto = false }: { diAtasFoto?: boolean }) {
  const w = useTheme();
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="Laporin"
      style={[styles.merek, { color: diAtasFoto ? TULANG : w.text }]}
      maxFontSizeMultiplier={1.2}>
      LAPORIN<Text style={{ color: w.accent }}>.</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  merek: {
    fontFamily: Fonts.judulTebal,
    fontSize: 21,
    lineHeight: 26,
  },
});
