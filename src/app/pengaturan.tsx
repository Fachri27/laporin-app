import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Children, Fragment, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BilahAtas } from '@/components/bilah-atas';
import { KONTAK_EMAIL } from '@/constants/hukum';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapusAkun, keluar, useAkun } from '@/lib/akun';
import { bukaSemuaBlokir, useBlokir } from '@/lib/blokir';
import { kosongkanKabar } from '@/lib/notifikasi';
import { SITUS_URL } from '@/lib/umpan';
import { VERSI_TEKS } from '@/lib/versi';

/**
 * Pengaturan: kartu pengguna dan kelompok baris di panel `surface` berlabel mono, lingkaran
 * ikon lembut; keluar (pil bergaris), hapus akun, dan versi kapital kecil di bawah.
 */
export default function LayarPengaturan() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { status, pengguna } = useAkun();
  const masuk = status === 'masuk';
  const diblokir = useBlokir();
  const [menghapus, setMenghapus] = useState(false);
  // Ref, bukan state: dua Alert konfirmasi bertumpuk bisa ditekan sebelum layar dirender ulang.
  const sedangHapus = useRef(false);

  async function hapus() {
    if (sedangHapus.current) return;
    sedangHapus.current = true;
    setMenghapus(true);
    const h = await hapusAkun();
    if (!h.ok) {
      sedangHapus.current = false;
      setMenghapus(false);
      return Alert.alert('Akun belum terhapus', h.galat);
    }
    // Kabar status laporan milik akun yang dihapus tidak boleh tampil lagi.
    kosongkanKabar();
    Alert.alert('Akun dihapus', 'Terima kasih sudah ikut melaporkan karhutla.');
    router.back();
  }

  function tanyaHapusAkun() {
    if (sedangHapus.current) return;
    Alert.alert(
      'Hapus akun?',
      'Akun, sesi, dan suka Anda dihapus; nama dan email dihapus dari komentar Anda. Laporan yang sudah dikirim tetap tersimpan sebagai catatan kejadian, tanpa nama Anda. Tindakan ini tidak bisa dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus akun', style: 'destructive', onPress: () => void hapus() },
      ],
    );
  }

  function tanyaKeluar() {
    Alert.alert('Keluar dari akun?', 'Laporan Anda tetap tersimpan. Anda bisa masuk lagi kapan saja.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: () => {
          void keluar();
          kosongkanKabar();
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      {/* Bilah atas desain (.page-header); header bawaan Stack dimatikan di _layout. */}
      <BilahAtas judul="Pengaturan" onKembali={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.isi, { paddingBottom: insets.bottom + 24 }]}>
        {masuk && pengguna && (
          <View style={[styles.pengguna, { backgroundColor: w.surface }]}>
            <Avatar nama={pengguna.nama} foto={pengguna.foto} ukuran={50} utama />
            <View style={styles.fleks}>
              <Text style={[styles.namaPengguna, { color: w.text }]} numberOfLines={1}>
                {pengguna.nama}
              </Text>
              {pengguna.email && (
                <Text style={[styles.surel, { color: w.textSecondary }]} numberOfLines={1}>
                  {pengguna.email}
                </Text>
              )}
            </View>
          </View>
        )}

        <Kelompok judul={masuk ? 'AKUN & PRIVASI' : 'PRIVASI'}>
          {masuk && (
            <Baris
              ikon="user"
              label="Edit profil"
              keterangan="Nama yang tampil di laporan dan komentar"
              onPress={() => router.push('/profil-ubah')}
            />
          )}
          <Baris
            ikon="shield"
            label="Melapor secara anonim"
            keterangan="Bisa dipilih di setiap laporan; laporan anonim tidak terhubung ke akun."
          />
          <Baris
            ikon="smartphone"
            label="Izin kamera, lokasi, mikrofon"
            keterangan="Atur di pengaturan HP"
            onPress={() => void Linking.openSettings()}
          />
          {diblokir.size > 0 && (
            <Baris
              ikon="user-x"
              label={`Penulis yang diblokir (${diblokir.size})`}
              keterangan="Ketuk untuk menampilkan lagi komentar mereka."
              onPress={() =>
                Alert.alert('Buka semua blokir?', 'Komentar dari penulis yang Anda blokir akan tampil lagi.', [
                  { text: 'Batal', style: 'cancel' },
                  { text: 'Buka blokir', onPress: () => void bukaSemuaBlokir() },
                ])
              }
            />
          )}
        </Kelompok>

        <Kelompok judul="BANTUAN & HUKUM">
          {KONTAK_EMAIL !== '' && (
            <Baris
              ikon="mail"
              label="Hubungi kami"
              keterangan={KONTAK_EMAIL}
              onPress={() => void Linking.openURL(`mailto:${KONTAK_EMAIL}?subject=${encodeURIComponent('Laporin')}`)}
            />
          )}
          <Baris ikon="file-text" label="Ketentuan Penggunaan" onPress={() => router.push('/ketentuan')} />
          <Baris ikon="lock" label="Kebijakan Privasi" onPress={() => router.push('/privasi')} />
          <Baris
            ikon="globe"
            label="fire.nusantara.earth"
            keterangan="Buka situs di peramban"
            onPress={() => void Linking.openURL(`${SITUS_URL}/id`)}
          />
        </Kelompok>

        {masuk && (
          <Pressable
            accessibilityRole="button"
            disabled={menghapus}
            onPress={tanyaKeluar}
            style={({ pressed }) => [
              styles.keluar,
              { borderColor: w.borderStrong },
              pressed && { backgroundColor: w.surface },
              menghapus && styles.mati,
            ]}>
            <Feather name="log-out" size={17} color={w.accentText} />
            <Text style={[styles.teksKeluar, { color: w.accentText }]}>Keluar dari akun</Text>
          </Pressable>
        )}

        {masuk && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: menghapus, busy: menghapus }}
            disabled={menghapus}
            onPress={tanyaHapusAkun}
            style={styles.hapusAkun}>
            {menghapus ? (
              <>
                <ActivityIndicator size="small" color={w.textSecondary} />
                <Text style={[styles.teksMenghapus, { color: w.textSecondary }]}>Menghapus akun…</Text>
              </>
            ) : (
              <Text style={[styles.teksHapusAkun, { color: w.textSecondary }]}>Hapus akun</Text>
            )}
          </Pressable>
        )}

        {/* "Laporin versi 1.0.0 · pembaruan … · kanal …" — supaya penguji tahu update sudah sampai. */}
        <Text style={[styles.versi, { color: w.textSecondary }]}>Laporin {VERSI_TEKS.replace(/^Versi/, 'versi')}</Text>
      </ScrollView>
    </View>
  );
}

function Kelompok({ judul, children }: { judul: string; children: ReactNode }) {
  const w = useTheme();
  return (
    <View>
      <Text accessibilityRole="header" style={[styles.judulKelompok, { color: w.textSecondary }]}>
        {judul}
      </Text>
      <View style={[styles.daftar, { backgroundColor: w.surface }]}>
        {/* Garis pemisah hanya di antara baris yang benar-benar tampil (baris bersyarat bisa kosong). */}
        {Children.toArray(children).map((anak, i) => (
          <Fragment key={i}>
            {/* Menjorok sejajar teks, seperti daftar bawaan HP. */}
            {i > 0 && <View style={[styles.pemisah, { backgroundColor: w.border }]} />}
            {anak}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/** Satu baris: lingkaran ikon lembut, judul + keterangan, chevron bila bisa diketuk. */
function Baris({
  ikon,
  label,
  keterangan,
  onPress,
}: {
  ikon: ComponentProps<typeof Feather>['name'];
  label: string;
  keterangan?: string;
  onPress?: () => void;
}) {
  const w = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.baris, pressed && { backgroundColor: w.surfaceMuted }]}>
      <View style={[styles.kotakIkon, { backgroundColor: w.surfaceMuted }]}>
        <Feather name={ikon} size={18} color={w.text} />
      </View>
      <View style={styles.fleks}>
        <Text style={[styles.label, { color: w.text }]}>{label}</Text>
        {keterangan && <Text style={[styles.keterangan, { color: w.textSecondary }]}>{keterangan}</Text>}
      </View>
      {onPress && <Feather name="chevron-right" size={18} color={w.textSecondary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  isi: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  fleks: {
    flex: 1,
    minWidth: 0,
  },
  pengguna: {
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 20,
  },
  namaPengguna: {
    fontFamily: Fonts.judulTebal,
    fontSize: 18,
    lineHeight: 22,
  },
  surel: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 13,
  },
  judulKelompok: {
    paddingTop: 18,
    paddingBottom: 9,
    paddingHorizontal: 4,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  daftar: {
    marginBottom: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  baris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  // 14 (tepi) + 36 (lingkaran ikon) + 12 (jarak).
  pemisah: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  kotakIkon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.semibold,
    fontSize: 14.5,
  },
  keterangan: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },
  keluar: {
    height: 52,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 26,
  },
  teksKeluar: {
    fontFamily: Fonts.tebal,
    fontSize: 15,
  },
  mati: {
    opacity: 0.5,
  },
  hapusAkun: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  teksHapusAkun: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    textDecorationLine: 'underline',
  },
  teksMenghapus: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
  },
  versi: {
    marginTop: 14,
    paddingHorizontal: 12,
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: 'center',
  },
});
