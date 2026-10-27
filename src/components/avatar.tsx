import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** "Dewi Lestari" → "DL", "Juliana" → "JU". */
export function inisial(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean);
  if (kata.length === 0) return '?';
  if (kata.length === 1) return kata[0].slice(0, 2).toUpperCase();
  return (kata[0][0] + kata[kata.length - 1][0]).toUpperCase();
}

type Props = {
  nama: string;
  foto?: string | null;
  ukuran?: number;
  /** Avatar utama (profil, pengaturan, pembawa siaran): terisi tulang berinisial tinta (tinta/tulang di mode terang). */
  utama?: boolean;
  style?: ViewStyle;
};

/** Lingkaran tulang tembus pandang berisi inisial, atau foto akun bila ada. */
export function Avatar({ nama, foto, ukuran = 39, utama = false, style }: Props) {
  const w = useTheme();
  const bulat = { width: ukuran, height: ukuran, borderRadius: ukuran / 2 };
  return (
    <View
      style={[
        styles.avatar,
        bulat,
        { backgroundColor: utama ? w.tombolTerang : w.inverse },
        style,
      ]}>
      {foto ? (
        <Image source={{ uri: foto }} style={bulat} contentFit="cover" transition={150} />
      ) : (
        <Text
          style={[styles.teks, { color: utama ? w.onTombolTerang : w.onInverse, fontSize: Math.round(ukuran * (utama ? 0.33 : 0.36)) }]}
          maxFontSizeMultiplier={1.2}>
          {inisial(nama)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  teks: {
    fontFamily: Fonts.tebal,
  },
});
