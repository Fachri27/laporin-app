import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tombol } from '@/components/tombol';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Garis waktu status. Hanya "diterima" yang sudah pasti; sisanya menunggu petugas, tanpa perkiraan waktu. */
const STATUS: { judul: string; ket: string; selesai: boolean }[] = [
  { judul: 'Laporan diterima', ket: 'Baru saja', selesai: true },
  { judul: 'Verifikasi petugas', ket: 'Menunggu', selesai: false },
  { judul: 'Tayang di beranda', ket: 'Bila disetujui', selesai: false },
];

/**
 * Halaman sukses seperti keadaan "selesai" artboard Report: label mono sinyal, judul kapital
 * besar, garis waktu status, dan tombol pil. Menggantikan formulir Lapor setelah terkirim.
 * Server tidak mengembalikan nomor laporan, jadi tidak ada nomor. Laporan yang dikirim dengan
 * akun bisa dipantau di Profil (statusnya juga muncul di Notifikasi); laporan tamu/anonim tidak.
 */
export default function LayarTerkirim() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { demo, akun } = useLocalSearchParams<{
    demo?: string;
    akun?: string;
  }>();
  const denganAkun = akun === '1';
  const keBeranda = () => router.dismissTo('/');

  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.isi,
          {
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 24,
          },
        ]}>
        <Animated.View entering={FadeInDown.duration(320)} style={styles.blok}>
          <Text style={[styles.eyebrow, { color: w.accentText }]}>
            {demo === '1' ? 'MODE DEMO · TIDAK DIKIRIM' : 'LAPORAN TERKIRIM'}
          </Text>
          <Text accessibilityRole="header" style={[styles.h1, { color: w.text }]}>
            Terima{'\n'}kasih sudah{'\n'}melapor.
          </Text>
          {demo === '1' ? (
            <Text style={[styles.teks, { color: w.textSecondary }]}>Mode demo: tidak ada yang benar-benar dikirim.</Text>
          ) : (
            <Text style={[styles.teks, { color: w.textSecondary }]}>
              {denganAkun
                ? 'Kabar statusnya akan muncul di Notifikasi dan di Profil.'
                : 'Laporan ini tidak terhubung ke akun, jadi statusnya tidak bisa dipantau dari aplikasi.'}
            </Text>
          )}

          {/* Garis waktu. Mode demo tidak mengirim apa pun, jadi tidak ada status yang benar. */}
          {demo !== '1' && (
            <View style={[styles.status, { borderTopColor: w.border }]}>
              {STATUS.map((s) => (
                <View
                  key={s.judul}
                  accessible
                  accessibilityLabel={`${s.judul}, ${s.selesai ? 'selesai' : s.ket.toLowerCase()}`}
                  style={[styles.baris, { borderBottomColor: w.border }]}>
                  <View
                    style={[
                      styles.titik,
                      s.selesai
                        ? { borderWidth: 6, borderColor: w.accent, backgroundColor: w.text }
                        : { borderColor: w.borderStrong },
                    ]}
                  />
                  <Text style={[styles.judulStatus, { color: s.selesai ? w.text : w.textSecondary }]}>{s.judul}</Text>
                  <Text style={[styles.ketStatus, { color: s.selesai ? w.accentText : w.textSecondary }]}>
                    {s.ket.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.aksi}>
            {denganAkun && (
              <Tombol judul="Pantau status" ragam="sekunder" onPress={() => router.dismissTo('/profil')} style={styles.fleks} />
            )}
            <Tombol judul="Ke beranda" ragam="terang" onPress={keBeranda} style={styles.fleks} />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  isi: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  blok: {
    gap: 16,
  },
  eyebrow: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  h1: {
    fontFamily: Fonts.judulTebal,
    fontSize: 38,
    letterSpacing: -0.4,
    lineHeight: 46,
  },
  teks: {
    maxWidth: 340,
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  status: {
    marginTop: 8,
    borderTopWidth: 1,
  },
  baris: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
  },
  titik: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 10,
  },
  judulStatus: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 15,
  },
  ketStatus: {
    fontFamily: Fonts.monoTebal,
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  // Dua pil berdampingan seperti "Undo" · "Back to feed" di artboard Report.
  aksi: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  fleks: {
    flex: 1,
  },
});
