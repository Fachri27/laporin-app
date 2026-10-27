import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  judul: string;
  onPress: () => void;
  /**
   * primer = sinyal berhuruf judul (kirim, mulai siaran), terang = tulang di mode gelap /
   * tinta di mode terang ("Back to feed" di desain), sekunder = bergaris tanpa isi ("Undo"),
   * teks = tautan sinyal.
   */
  ragam?: 'primer' | 'terang' | 'sekunder' | 'teks';
  ikon?: ComponentProps<typeof Ionicons>['name'];
  /** Ikon di kanan teks (panah "Lanjutkan ›"), bukan di kiri. */
  ikonKanan?: boolean;
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
  ikonKanan = false,
  memuat = false,
  nonaktif = false,
  besar = false,
  style,
}: Props) {
  const w = useTheme();
  const mati = nonaktif || memuat;
  const warnaTeks =
    ragam === 'primer' ? w.onAccent : ragam === 'terang' ? w.onTombolTerang : ragam === 'sekunder' ? w.text : w.accentText;

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
        ragam === 'terang' && { backgroundColor: w.tombolTerang },
        ragam === 'sekunder' && [styles.sekunder, { borderColor: w.borderStrong }, pressed && { backgroundColor: w.surface }],
        pressed && ragam !== 'primer' && ragam !== 'teks' && styles.ditekan,
        ragam === 'teks' && { backgroundColor: pressed ? w.accentSoft : 'transparent' },
        mati && styles.mati,
        style,
      ]}>
      <View style={[styles.isi, ikonKanan && styles.isiTerbalik]}>
        {memuat ? (
          <ActivityIndicator color={warnaTeks} />
        ) : (
          ikon && <Ionicons name={ikon} size={besar ? 19 : 18} color={warnaTeks} />
        )}
        <Text
          style={[
            ragam === 'primer' ? styles.teksPrimer : styles.teks,
            ragam === 'primer' && besar && styles.teksPrimerBesar,
            { color: warnaTeks },
          ]}>
          {judul}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Semua tombol berbentuk pil: 52 seperti "Undo"/"Back to feed", 56 seperti "Send report".
  dasar: {
    minHeight: 48,
    paddingHorizontal: Spacing.three + 6,
    borderRadius: 26,
    justifyContent: 'center',
  },
  besar: {
    minHeight: 56,
    borderRadius: 28,
  },
  ditekan: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  sekunder: {
    borderWidth: 1,
  },
  isi: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  isiTerbalik: {
    flexDirection: 'row-reverse',
    gap: 6,
  },
  teks: {
    fontFamily: Fonts.tebal,
    fontSize: 15,
  },
  teksPrimer: {
    fontFamily: Fonts.judulTebal,
    fontSize: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  teksPrimerBesar: {
    fontSize: 16,
    letterSpacing: 0.5,
  },
  mati: {
    opacity: 0.45,
  },
});
