import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TombolIkon } from '@/components/bilah-atas';
import { Tombol } from '@/components/tombol';
import { Fonts, Radius, Spacing, TULANG } from '@/constants/theme';
import { useRuangKeyboard } from '@/hooks/use-keyboard-terbuka';
import { useTheme } from '@/hooks/use-theme';
import { ALASAN_LAPORAN, laporkanKonten, type JenisKonten, type KodeAlasan } from '@/lib/laporkan';

const NAMA_JENIS: Record<JenisKonten, string> = { komentar: 'komentar', laporan: 'laporan', siaran: 'siaran langsung' };

/** Alasan di lib/laporkan.ts dipecah untuk tampilan: judul pendek + petunjuk. Yang terkirim hanya kodenya. */
const TAMPILAN_ALASAN: Record<KodeAlasan, { judul: string; petunjuk: string }> = {
  palsu: { judul: 'Informasi palsu', petunjuk: 'Atau bukan kejadian karhutla' },
  'tidak-pantas': { judul: 'Konten tidak pantas', petunjuk: 'Kekerasan atau seksual' },
  kebencian: { judul: 'Ujaran kebencian', petunjuk: 'Pelecehan atau ancaman' },
  spam: { judul: 'Spam', petunjuk: 'Iklan atau penipuan' },
  bahaya: { judul: 'Membahayakan orang', petunjuk: 'Atau membuka data pribadi' },
  lainnya: { judul: 'Lainnya', petunjuk: 'Jelaskan di kolom rincian' },
};

/**
 * Laporkan konten buatan pengguna, sebagai lembar dari bawah (artboard "Report"): label kapital kecil,
 * pertanyaan besar, alasan sebagai baris radio bernomor, kolom rincian, tombol sinyal. Dibuka dari
 * menu tekan lama di umpan, komentar & komentar siaran, dan tombol bendera di siaran.
 * `catatan` (opsional) = konteks dari pembuka, mis. isi & pengirim komentar siaran
 * yang dilaporkan — ikut terkirim di depan keterangan warga, tidak ditampilkan.
 */
export default function LayarLaporkan() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { jenis, id, ringkas, catatan: konteks } = useLocalSearchParams<{
    jenis: JenisKonten;
    id: string;
    ringkas?: string;
    catatan?: string;
  }>();
  const [alasan, setAlasan] = useState<KodeAlasan | null>(null);
  const [catatan, setCatatan] = useState('');
  const [fokus, setFokus] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState('');
  const [terkirim, setTerkirim] = useState(false);
  const namaJenis = NAMA_JENIS[jenis] ?? 'konten';
  // Lembar dua tinggi di Android hanya dibesarkan penuh saat keyboard muncul — isinya tidak ikut
  // naik. Ruang setinggi bagian yang tertutup keyboard menjaga kolom keterangan tetap di atasnya. iOS: padding KAV.
  const tertutup = useRuangKeyboard();
  const ruangKeyboard = Platform.OS === 'android' ? tertutup : 0;

  async function kirim() {
    if (!alasan || mengirim) return;
    setMengirim(true);
    setGalat('');
    const h = await laporkanKonten({ jenis, id, alasan, catatan: [konteks?.trim(), catatan.trim()].filter(Boolean).join('\n') });
    setMengirim(false);
    if (h.ok) setTerkirim(true);
    else setGalat(h.galat);
  }

  // Pegangan — iOS sudah punya pegangan bawaan lembar (sheetGrabberVisible).
  const pegangan = Platform.OS !== 'ios' && <View style={[styles.pegangan, { backgroundColor: w.borderStrong }]} />;

  if (terkirim) {
    // Selesai: label sinyal, judul besar, alasan yang dipilih, satu tombol.
    return (
      <View style={[styles.layar, { backgroundColor: w.surface, paddingBottom: insets.bottom + Spacing.four }]}>
        {pegangan}
        <View style={styles.selesai}>
          <Text style={[styles.label, { color: w.accentText }]}>LAPORAN TERKIRIM</Text>
          <Text accessibilityRole="header" style={[styles.judulSelesai, { color: w.text }]}>
            Terima{'\n'}kasih.
          </Text>
          <Text style={[styles.teksSelesai, { color: w.textSecondary }]}>
            {alasan ? `Ditandai sebagai “${TAMPILAN_ALASAN[alasan].judul.toLowerCase()}”. ` : ''}Pengelola akan meninjaunya
            paling lambat dalam 24 jam.{' '}
            {jenis === 'siaran' ? 'Siaran yang melanggar akan dihentikan.' : 'Konten yang melanggar akan disembunyikan atau dihapus.'}
          </Text>
          <Tombol judul="Selesai" ragam="terang" besar onPress={() => router.back()} style={styles.lebar} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.layar, { backgroundColor: w.surface, paddingBottom: ruangKeyboard }]}>
      {pegangan}
      {/* Kepala: label kapital kecil jenis konten, tombol tutup bulat. */}
      <View style={styles.kepala}>
        <Text style={[styles.label, styles.fleks, { color: w.textSecondary }]}>LAPORKAN · {namaJenis.toUpperCase()}</Text>
        <TombolIkon ikon="x" label="Tutup" onPress={() => router.back()} />
      </View>

      <ScrollView style={styles.fleks} contentContainerStyle={styles.isi} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[styles.judul, { color: w.text }]}>
          Apa yang{'\n'}
          <Text style={{ color: w.accentText }}>salah di sini?</Text>
        </Text>
        <Text style={[styles.penjelas, { color: w.textSecondary }]}>
          Pengelola meninjau setiap laporan paling lambat dalam 24 jam. Melaporkan tidak butuh akun.
        </Text>
        {ringkas ? (
          <Text style={[styles.kutipan, { color: w.textSecondary }]} numberOfLines={2}>
            “{ringkas}”
          </Text>
        ) : null}
        <View accessibilityRole="radiogroup" style={[styles.daftar, { borderTopColor: w.border }]}>
          {ALASAN_LAPORAN.map((a, i) => {
            const dipilih = alasan === a.kode;
            const t = TAMPILAN_ALASAN[a.kode];
            return (
              <Pressable
                key={a.kode}
                accessibilityRole="radio"
                accessibilityState={{ checked: dipilih }}
                accessibilityLabel={`${t.judul}. ${t.petunjuk}`}
                onPress={() => setAlasan(a.kode)}
                style={({ pressed }) => [styles.pilihan, { borderBottomColor: w.border }, pressed && styles.ditekan]}>
                <Text style={[styles.nomor, { color: dipilih ? w.accentText : w.textSecondary }]}>{String(i + 1).padStart(2, '0')}</Text>
                <View style={styles.fleks}>
                  <Text style={[styles.teksPilihan, { color: w.text }]}>{t.judul}</Text>
                  <Text style={[styles.petunjuk, { color: w.textSecondary }]}>{t.petunjuk}</Text>
                </View>
                <View style={[styles.radio, dipilih ? { borderColor: w.accent, borderWidth: 6, backgroundColor: TULANG } : { borderColor: w.borderStrong }]} />
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={catatan}
          onChangeText={setCatatan}
          onFocus={() => setFokus(true)}
          onBlur={() => setFokus(false)}
          placeholder="Rincian (opsional), mis. foto ini dari tahun lalu"
          accessibilityLabel="Rincian (opsional)"
          placeholderTextColor={w.textSecondary}
          maxLength={500}
          multiline
          style={[styles.catatan, { color: w.text, backgroundColor: w.surfaceMuted, borderColor: fokus ? w.accent : w.border }]}
        />
        {galat !== '' && <Text style={[styles.galat, { color: w.danger }]}>{galat}</Text>}
      </ScrollView>

      <View style={[styles.kaki, { paddingBottom: (ruangKeyboard > 0 ? 0 : insets.bottom) + Spacing.two }]}>
        <Tombol
          judul="Kirim laporan"
          besar
          memuat={mengirim}
          nonaktif={!alasan || mengirim}
          onPress={() => void kirim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  fleks: {
    flex: 1,
  },
  ditekan: {
    opacity: 0.7,
  },
  pegangan: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: Radius.pill,
  },
  selesai: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: 20,
  },
  judulSelesai: {
    fontFamily: Fonts.judulTebal,
    fontSize: 40,
    letterSpacing: -0.4,
    lineHeight: 49,
    paddingTop: 4,
  },
  teksSelesai: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  lebar: {
    marginTop: Spacing.three,
  },
  kepala: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Platform.OS === 'ios' ? Spacing.four : 0,
    paddingLeft: 20,
    paddingRight: 16,
  },
  label: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  judul: {
    fontFamily: Fonts.judulTebal,
    fontSize: 32,
    letterSpacing: -0.4,
    lineHeight: 39,
    paddingTop: 4,
  },
  isi: {
    paddingHorizontal: 20,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: 14,
  },
  penjelas: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  // Kutipan konten yang dilaporkan, tanpa kotak.
  kutipan: {
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
  },
  daftar: {
    borderTopWidth: 1,
  },
  // Baris radio bernomor: nomor sinyal saat terpilih, bulatan berbingkai sinyal tebal.
  pilihan: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  nomor: {
    width: 22,
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  teksPilihan: {
    fontFamily: Fonts.bold,
    fontSize: 15,
  },
  petunjuk: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 10,
  },
  catatan: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 16,
    fontFamily: Fonts.regular,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  galat: {
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
  },
  kaki: {
    paddingHorizontal: 20,
    paddingTop: Spacing.two,
  },
});
