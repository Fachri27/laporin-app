import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { lazy, Suspense, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Tombol } from '@/components/tombol';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { adaApple, bisaMasukUji, halanganGoogle, masukApple, masukGoogle, masukUji } from '@/lib/akun';

// Tombol resmi Apple (wajib dipakai menurut pedoman desain Apple), dimuat hanya di iOS yang punya modulnya.
const TombolApple = adaApple
  ? lazy(() =>
      import('expo-apple-authentication').then((m) => ({
        default: (p: { gelap: boolean; onPress: () => void }) => (
          <m.AppleAuthenticationButton
            buttonType={m.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={p.gelap ? m.AppleAuthenticationButtonStyle.WHITE : m.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={Radius.medium}
            style={styles.tombolApple}
            onPress={p.onPress}
          />
        ),
      })),
    )
  : null;

type Props = {
  /** Mis. "untuk menyukai laporan". */
  alasan?: string;
  onBerhasil?: () => void;
};

/** Pilihan masuk: Apple (iOS), Google, plus "masuk uji" saat memakai dev server. */
export function PanelMasuk({ alasan, onBerhasil }: Props) {
  const w = useTheme();
  const gelap = useColorScheme() === 'dark';
  const [proses, setProses] = useState<'apple' | 'google' | 'uji' | null>(null);
  const [galat, setGalat] = useState('');
  const [namaUji, setNamaUji] = useState('');

  async function jalankan(jenis: 'apple' | 'google' | 'uji') {
    setGalat('');
    setProses(jenis);
    const hasil =
      jenis === 'apple' ? await masukApple() : jenis === 'google' ? await masukGoogle() : await masukUji(namaUji);
    setProses(null);
    if (hasil.ok) onBerhasil?.();
    else if (hasil.galat) setGalat(hasil.galat);
  }

  return (
    <View style={styles.wadah}>
      <View style={[styles.ikon, { backgroundColor: w.accentSoft }]}>
        <Ionicons name="shield-checkmark-outline" size={38} color={w.accentText} />
      </View>
      <Text style={[styles.judul, { color: w.text }]}>Masuk ke Lapor Karhutla</Text>
      <Text style={[styles.teks, { color: w.textSecondary }]}>
        {alasan ? `Masuk ${alasan}. ` : ''}Simpan riwayat laporan, sukai, dan komentari laporan warga. Melapor tetap
        bisa tanpa akun.
      </Text>

      {TombolApple && (
        <Suspense fallback={null}>
          {proses === 'apple' ? (
            <ActivityIndicator color={w.text} style={styles.tombolApple} />
          ) : (
            <TombolApple gelap={gelap} onPress={() => void jalankan('apple')} />
          )}
        </Suspense>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={proses !== null || halanganGoogle !== null}
        onPress={() => void jalankan('google')}
        style={({ pressed }) => [
          styles.tombolGoogle,
          { borderColor: w.border, backgroundColor: pressed ? w.surfaceMuted : w.surface },
          halanganGoogle !== null && styles.mati,
        ]}>
        {proses === 'google' ? (
          <ActivityIndicator color={w.text} />
        ) : (
          <Ionicons name="logo-google" size={20} color={w.text} />
        )}
        <Text style={[styles.teksGoogle, { color: w.text }]}>Lanjutkan dengan Google</Text>
      </Pressable>
      {halanganGoogle && <Text style={[styles.catatan, { color: w.textSecondary }]}>{halanganGoogle}</Text>}

      {bisaMasukUji && (
        <View style={[styles.uji, { borderColor: w.border }]}>
          <Text style={[styles.labelUji, { color: w.textSecondary }]}>UJI DENGAN MOCK SERVER · TANPA GOOGLE</Text>
          <View style={styles.barisUji}>
            <TextInput
              value={namaUji}
              onChangeText={setNamaUji}
              placeholder="Nama penguji"
              placeholderTextColor={w.textSecondary}
              maxLength={100}
              style={[styles.inputUji, { color: w.text, borderColor: w.border, backgroundColor: w.background }]}
            />
            <Tombol
              judul="Masuk uji"
              ragam="sekunder"
              memuat={proses === 'uji'}
              nonaktif={proses !== null}
              onPress={() => void jalankan('uji')}
            />
          </View>
        </View>
      )}

      {galat !== '' && <Text style={[styles.galat, { color: w.danger }]}>{galat}</Text>}

      <Text style={[styles.catatan, { color: w.textSecondary }]}>
        Dengan masuk, Anda menyetujui{' '}
        <Text style={[styles.tautan, { color: w.accentText }]} onPress={() => router.push('/ketentuan')}>
          Ketentuan Penggunaan
        </Text>{' '}
        dan{' '}
        <Text style={[styles.tautan, { color: w.accentText }]} onPress={() => router.push('/privasi')}>
          Kebijakan Privasi
        </Text>
        , termasuk larangan konten yang melanggar.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wadah: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  ikon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  judul: {
    fontFamily: Fonts.judulTebal,
    fontSize: 22,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  teks: {
    fontFamily: Fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  tombolGoogle: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two + 2,
    minHeight: 52,
    borderRadius: Radius.medium,
    borderWidth: 1,
    marginTop: Spacing.two,
  },
  tombolApple: {
    alignSelf: 'stretch',
    height: 52,
    marginTop: Spacing.two,
  },
  tautan: {
    fontFamily: Fonts.semibold,
  },
  teksGoogle: {
    fontFamily: Fonts.bold,
    fontSize: 15.5,
  },
  mati: {
    opacity: 0.5,
  },
  catatan: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  uji: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.medium,
  },
  labelUji: {
    fontFamily: Fonts.judulTebal,
    fontSize: 10.5,
    letterSpacing: 1,
  },
  barisUji: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  inputUji: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: 12,
    fontFamily: Fonts.regular,
    fontSize: 15,
  },
  galat: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
});
