import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Isian } from '@/components/isian';
import { Tombol } from '@/components/tombol';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ubahProfil, useAkun } from '@/lib/akun';
import { BATAS_NAMA } from '@/lib/batas-laporan';

/** Edit profil: nama tampil. Foto mengikuti akun Google. */
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
    <KeyboardAvoidingView style={styles.fleks}>
      <ScrollView
        style={{ backgroundColor: w.background }}
        contentContainerStyle={styles.isi}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <View style={styles.tengah}>
          {pengguna?.foto ? (
            <Image source={{ uri: pengguna.foto }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.tengahIsi, { backgroundColor: w.accentSoft }]}>
              <Text style={[styles.inisial, { color: w.accentText }]}>{(nama.trim()[0] ?? '?').toUpperCase()}</Text>
            </View>
          )}
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

        <Tombol judul="Simpan" besar memuat={menyimpan} onPress={() => void simpan()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fleks: {
    flex: 1,
  },
  isi: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  tengah: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  tengahIsi: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  inisial: {
    fontSize: 40,
    fontFamily: Fonts.judulTebal,
  },
  catatan: {
    fontSize: 12.5,
  },
  galat: {
    fontSize: 13.5,
    marginTop: -Spacing.three,
  },
});
