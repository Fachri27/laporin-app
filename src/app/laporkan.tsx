import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tombol } from '@/components/tombol';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ALASAN_LAPORAN, laporkanKonten, type JenisKonten, type KodeAlasan } from '@/lib/laporkan';

const NAMA_JENIS: Record<JenisKonten, string> = { komentar: 'komentar', laporan: 'laporan', siaran: 'siaran langsung' };

/**
 * Laporkan konten buatan pengguna, sebagai lembar dari bawah. Dibuka dari
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
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState('');
  const [terkirim, setTerkirim] = useState(false);
  const namaJenis = NAMA_JENIS[jenis] ?? 'konten';

  async function kirim() {
    if (!alasan || mengirim) return;
    setMengirim(true);
    setGalat('');
    const h = await laporkanKonten({ jenis, id, alasan, catatan: [konteks?.trim(), catatan.trim()].filter(Boolean).join('\n') });
    setMengirim(false);
    if (h.ok) setTerkirim(true);
    else setGalat(h.galat);
  }

  if (terkirim) {
    return (
      <View style={[styles.layar, styles.selesai, { backgroundColor: w.background, paddingBottom: insets.bottom + Spacing.four }]}>
        <Ionicons name="checkmark-circle" size={52} color={w.accentText} />
        <Text style={[styles.judul, { color: w.text, textAlign: 'center' }]}>Terima kasih, laporan terkirim</Text>
        <Text style={[styles.ket, { color: w.textSecondary, textAlign: 'center' }]}>
          Pengelola akan meninjaunya paling lambat dalam 24 jam.{' '}
          {jenis === 'siaran' ? 'Siaran yang melanggar akan dihentikan.' : 'Konten yang melanggar akan disembunyikan atau dihapus.'}
        </Text>
        <Tombol judul="Selesai" besar onPress={() => router.back()} style={styles.lebar} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.layar, { backgroundColor: w.background }]}>
      <View style={styles.kepala}>
        <View style={styles.fleks}>
          <Text style={[styles.judul, { color: w.text }]}>Laporkan {namaJenis}</Text>
          {ringkas ? (
            <Text style={[styles.ket, { color: w.textSecondary }]} numberOfLines={2}>
              “{ringkas}”
            </Text>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={24} color={w.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.fleks} contentContainerStyle={styles.isi} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: w.textSecondary }]}>KENAPA DILAPORKAN?</Text>
        {ALASAN_LAPORAN.map((a) => {
          const dipilih = alasan === a.kode;
          return (
            <Pressable
              key={a.kode}
              accessibilityRole="radio"
              accessibilityState={{ checked: dipilih }}
              onPress={() => setAlasan(a.kode)}
              style={[styles.pilihan, { borderColor: dipilih ? w.accentText : w.border, backgroundColor: w.surface }]}>
              <Ionicons name={dipilih ? 'radio-button-on' : 'radio-button-off'} size={20} color={dipilih ? w.accentText : w.textSecondary} />
              <Text style={[styles.teksPilihan, { color: w.text }]}>{a.label}</Text>
            </Pressable>
          );
        })}
        <TextInput
          value={catatan}
          onChangeText={setCatatan}
          placeholder="Keterangan tambahan (opsional)"
          placeholderTextColor={w.textSecondary}
          maxLength={500}
          multiline
          style={[styles.catatan, { color: w.text, borderColor: w.border, backgroundColor: w.surface }]}
        />
        {galat !== '' && <Text style={[styles.ket, { color: w.danger }]}>{galat}</Text>}
      </ScrollView>

      <View style={[styles.kaki, { paddingBottom: insets.bottom + Spacing.two }]}>
        <Tombol judul="Kirim laporan" besar memuat={mengirim} nonaktif={!alasan || mengirim} onPress={() => void kirim()} />
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
  selesai: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  lebar: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  kepala: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingTop: Spacing.four,
    paddingHorizontal: 18,
  },
  judul: {
    fontFamily: Fonts.judul,
    fontSize: 17,
  },
  ket: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
  },
  isi: {
    padding: 18,
    gap: Spacing.two,
  },
  label: {
    fontFamily: Fonts.judulTebal,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 2,
  },
  pilihan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    padding: 13,
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  teksPilihan: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14.5,
  },
  catatan: {
    minHeight: 84,
    marginTop: Spacing.two,
    padding: 12,
    borderWidth: 1,
    borderRadius: Radius.medium,
    fontFamily: Fonts.regular,
    fontSize: 14.5,
    textAlignVertical: 'top',
  },
  kaki: {
    paddingHorizontal: 18,
    paddingTop: Spacing.two,
  },
});
