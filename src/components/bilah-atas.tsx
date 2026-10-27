import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Merek } from '@/components/merek';
import { Fonts, Media } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  judul?: string;
  subjudul?: string;
  /** Ada = tombol kembali menggantikan logo di kiri. */
  onKembali?: () => void;
  /** Tombol di kanan (pil lokasi, ikon pengaturan, "Batal", …). */
  children?: ReactNode;
};

/**
 * Bilah atas halaman: sewarna latar, tanpa garis. Tanpa judul: wordmark di kiri, aksi di kanan.
 * Dengan judul: tombol kembali bulat (atau wordmark) di kiri, judul huruf judul tepat
 * di tengah, aksi di kanan. Ruang status bar ikut di sini.
 */
export function BilahAtas({ judul, subjudul, onKembali, children }: Props) {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const kiri = onKembali ? <TombolIkon ikon="chevron-left" label="Kembali" onPress={onKembali} /> : <Merek />;
  return (
    <View style={[styles.bilah, { paddingTop: insets.top, backgroundColor: w.bilahAtas }]}>
      {judul ? (
        <View style={styles.isi}>
          {/* Kedua sisi sama lebar, jadi judul benar-benar di tengah layar. */}
          <View style={styles.sisi}>{kiri}</View>
          <View style={styles.judul}>
            <Text style={[styles.teksJudul, { color: w.text }]} numberOfLines={1}>
              {judul}
            </Text>
            {subjudul && <Text style={[styles.subjudul, { color: w.textSecondary }]}>{subjudul}</Text>}
          </View>
          <View style={[styles.sisi, styles.sisiKanan]}>{children}</View>
        </View>
      ) : (
        <View style={[styles.isi, styles.isiMerek]}>
          {kiri}
          <View style={styles.aksi}>{children}</View>
        </View>
      )}
    </View>
  );
}

/**
 * Tombol ikon bulat 44 px bergaris tipis (lonceng di desain). `kaca` = lingkaran tinta pekat
 * berikon tulang, untuk di atas foto. `ringkas` = 34 px tanpa garis, untuk di dalam kartu.
 * `kecil` = 34 px bergaris, sebesar avatar di sebelahnya.
 */
export function TombolIkon({
  ikon,
  label,
  onPress,
  ringkas = false,
  kecil = false,
  kaca = false,
  titik = false,
  style,
}: {
  ikon: ComponentProps<typeof Feather>['name'];
  label: string;
  onPress?: () => void;
  ringkas?: boolean;
  kecil?: boolean;
  kaca?: boolean;
  /** Titik sinyal kecil di pojok — ada yang baru. */
  titik?: boolean;
  style?: ViewStyle;
}) {
  const w = useTheme();
  const garis = kaca || ringkas ? null : { borderWidth: 1, borderColor: w.border };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={ringkas ? 6 : 2}
      style={({ pressed }) => [
        ringkas || kecil ? styles.ikonRingkas : styles.ikon,
        kaca && { backgroundColor: Media.kaca },
        garis,
        pressed && styles.ditekan,
        style,
      ]}>
      <Feather name={ikon} size={kecil ? 17 : 19} color={kaca ? Media.teks : w.text} />
      {titik && <View style={[styles.titik, kecil && styles.titikKecil, { backgroundColor: w.accent }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bilah: {
    zIndex: 2,
  },
  isi: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  isiMerek: {
    paddingLeft: 20,
  },
  sisi: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sisiKanan: {
    justifyContent: 'flex-end',
  },
  judul: {
    flexShrink: 1,
    maxWidth: '60%',
    alignItems: 'center',
  },
  teksJudul: {
    fontFamily: Fonts.judulTebal,
    fontSize: 18,
    lineHeight: 22,
  },
  subjudul: {
    marginTop: 1,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  aksi: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  ikon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ikonRingkas: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ditekan: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  titik: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  titikKecil: {
    top: 6,
    right: 7,
  },
});
