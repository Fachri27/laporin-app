import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { lazy, Suspense, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Tombol } from '@/components/tombol';
import { Fonts, Spacing } from '@/constants/theme';
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
            cornerRadius={26}
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

/**
 * Pilihan masuk: Apple (iOS), Google, plus "masuk uji" saat memakai dev server. Rata kiri seperti
 * lembar lain: label kapital kecil, judul huruf judul, tombol pil. Tanpa latar sendiri:
 * dipasang di lembar masuk dan di panel Profil, keduanya berlatar `surface`.
 */
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
      <Text style={[styles.label, { color: w.textSecondary }]}>AKUN WARGA</Text>
      <Text accessibilityRole="header" style={[styles.judul, { color: w.text }]}>
        Masuk ke{'\n'}
        <Text style={{ color: w.accentText }}>Laporin.</Text>
      </Text>
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

      {/* Pil terang: tulang di mode gelap, tinta di mode terang — sepasang dengan tombol Apple. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: proses !== null || halanganGoogle !== null, busy: proses === 'google' }}
        disabled={proses !== null || halanganGoogle !== null}
        onPress={() => void jalankan('google')}
        style={({ pressed }) => [
          styles.tombolGoogle,
          { backgroundColor: w.tombolTerang },
          pressed && styles.ditekan,
          halanganGoogle !== null && styles.mati,
        ]}>
        {proses === 'google' ? (
          <ActivityIndicator color={w.onTombolTerang} />
        ) : (
          <Ionicons name="logo-google" size={19} color={w.onTombolTerang} />
        )}
        <Text style={[styles.teksGoogle, { color: w.onTombolTerang }]}>Lanjutkan dengan Google</Text>
      </Pressable>
      {halanganGoogle && <Text style={[styles.catatan, { color: w.textSecondary }]}>{halanganGoogle}</Text>}

      {bisaMasukUji && (
        <View style={[styles.uji, { backgroundColor: w.surfaceMuted }]}>
          <Text style={[styles.label, { color: w.textSecondary }]}>LOGIN UJI (PENGEMBANGAN) · TANPA GOOGLE</Text>
          <View style={styles.barisUji}>
            <TextInput
              value={namaUji}
              onChangeText={setNamaUji}
              placeholder="Nama penguji"
              placeholderTextColor={w.textSecondary}
              maxLength={100}
              style={[styles.inputUji, { color: w.text, borderColor: w.border, backgroundColor: w.surface }]}
              accessibilityLabel="Nama penguji"
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
    gap: 14,
    paddingHorizontal: Spacing.four - 2,
  },
  label: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  judul: {
    marginTop: -6,
    fontFamily: Fonts.judulTebal,
    fontSize: 30,
    letterSpacing: -0.4,
    lineHeight: 37,
    paddingTop: 4,
  },
  teks: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  tombolGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: 26,
    marginTop: Spacing.two,
  },
  ditekan: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  tombolApple: {
    height: 52,
    marginTop: Spacing.two,
  },
  tautan: {
    fontFamily: Fonts.semibold,
  },
  teksGoogle: {
    fontFamily: Fonts.tebal,
    fontSize: 15,
  },
  mati: {
    opacity: 0.5,
  },
  catatan: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  uji: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
  },
  barisUji: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  inputUji: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  galat: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },
});
