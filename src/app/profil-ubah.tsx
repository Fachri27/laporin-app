import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Isian } from '@/components/isian';
import { Tombol } from '@/components/tombol';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ubahProfil, useAkun } from '@/lib/akun';
import { BATAS_NAMA } from '@/lib/batas-laporan';

/** Edit profil: nama tampil. Foto mengikuti akun Google. Avatarnya sama dengan kepala Profil (96). */
export default function LayarUbahProfil() {
  const w = useTheme();
  const { pengguna } = useAkun();
  const [nama, setNama] = useState(pengguna?.nama ?? '');
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState('');

  async function simpan() {
    if (!nama.trim()) return setGalat('Nama tidak boleh kosong.');
    setGalat('');
    setMenyimpan(true);
    const hasil = await ubahProfil({ nama: nama.trim() });
    setMenyimpan(false);
    if (hasil.ok) router.back();
    else setGalat(hasil.galat);
  }

  return (
    <KeyboardAvoidingView style={[styles.fleks, { backgroundColor: w.background }]}>
      <ScrollView
        style={{ backgroundColor: w.background }}
        contentContainerStyle={styles.isi}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <View style={styles.tengah}>
          {/* Inisial ikut berubah selagi nama diketik. */}
          <Avatar nama={nama.trim() || '?'} foto={pengguna?.foto} ukuran={96} utama />
          <Text style={[styles.catatan, { color: w.textSecondary }]}>Foto mengikuti akun Google Anda.</Text>
        </View>

        <Isian
          label="Nama"
          value={nama}
          onChangeText={setNama}
          maxLength={BATAS_NAMA}
          autoComplete="name"
          petunjuk="Tampil di profil, komentar, dan sebagai nama pelapor (kecuali laporan anonim)."
          galat={galat !== ''}
        />
        {galat !== '' && <Text style={[styles.galat, { color: w.danger }]}>{galat}</Text>}

        <Tombol judul="Simpan" ragam="terang" besar memuat={menyimpan} onPress={() => void simpan()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fleks: {
    flex: 1,
  },
  isi: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
    gap: 22,
  },
  tengah: {
    alignItems: 'center',
    gap: 12,
  },
  catatan: {
    fontFamily: Fonts.regular,
    fontSize: 13,
  },
  galat: {
    marginTop: -14,
    fontFamily: Fonts.medium,
    fontSize: 13,
  },
});
