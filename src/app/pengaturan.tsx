import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { KONTAK_EMAIL } from '@/constants/hukum';
import { hapusAkun, keluar, useAkun } from '@/lib/akun';
import { bukaSemuaBlokir, useBlokir } from '@/lib/blokir';
import { SITUS_URL } from '@/lib/umpan';
import { VERSI_TEKS } from '@/lib/versi';

/** "Pengaturan dan privasi" ala TikTok: daftar baris berkelompok, keluar di bawah. */
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
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: w.background }}
      contentContainerStyle={[styles.isi, { paddingBottom: insets.bottom + Spacing.five }]}>
      {masuk && (
        <Kelompok judul="Akun">
          <Baris ikon="person-outline" label="Edit profil" onPress={() => router.push('/profil-ubah')} />
          <Baris ikon="mail-outline" label="Email" nilai={pengguna?.email ?? '–'} />
        </Kelompok>
      )}

      <Kelompok judul="Privasi">
        <Baris
          ikon="shield-checkmark-outline"
          label="Melapor secara anonim"
          nilai="Bisa di setiap laporan"
          keterangan="Laporan anonim tidak terhubung ke akun dan tidak muncul di Laporanku."
        />
        <Baris
          ikon="phone-portrait-outline"
          label="Izin kamera, lokasi, mikrofon"
          onPress={() => void Linking.openSettings()}
        />
      </Kelompok>

      <Kelompok judul="Bantuan dan hukum">
        <Baris ikon="document-text-outline" label="Ketentuan Penggunaan" onPress={() => router.push('/ketentuan')} />
        <Baris ikon="lock-closed-outline" label="Kebijakan Privasi" onPress={() => router.push('/privasi')} />
        {KONTAK_EMAIL !== '' && (
          <Baris
            ikon="mail-open-outline"
            label="Hubungi kami"
            nilai={KONTAK_EMAIL}
            onPress={() => void Linking.openURL(`mailto:${KONTAK_EMAIL}?subject=${encodeURIComponent('Lapor Karhutla')}`)}
          />
        )}
        {diblokir.size > 0 && (
          <Baris
            ikon="eye-off-outline"
            label="Penulis yang diblokir"
            nilai={String(diblokir.size)}
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

      <Kelompok judul="Tentang">
        <Baris ikon="globe-outline" label="fire.nusantara.earth" onPress={() => void Linking.openURL(`${SITUS_URL}/id`)} />
        <Baris ikon="information-circle-outline" label="Versi aplikasi" keterangan={VERSI_TEKS} />
      </Kelompok>

      {masuk && (
        <Pressable
          accessibilityRole="button"
          disabled={menghapus}
          onPress={tanyaKeluar}
          style={({ pressed }) => [
            styles.keluar,
            { backgroundColor: pressed ? w.border : w.surface },
            menghapus && styles.mati,
          ]}>
          <Ionicons name="log-out-outline" size={20} color={w.danger} />
          <Text style={[styles.teksKeluar, { color: w.danger }]}>Keluar</Text>
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
    </ScrollView>
  );
}

function Kelompok({ judul, children }: { judul: string; children: ReactNode }) {
  const w = useTheme();
  return (
    <View style={styles.kelompok}>
      <Text style={[styles.judulKelompok, { color: w.textSecondary }]}>{judul}</Text>
      <View style={[styles.kartu, { backgroundColor: w.surface }]}>{children}</View>
    </View>
  );
}

function Baris({
  ikon,
  label,
  nilai,
  keterangan,
  onPress,
}: {
  ikon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  nilai?: string;
  keterangan?: string;
  onPress?: () => void;
}) {
  const w = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.baris, pressed && { backgroundColor: w.border }]}>
      <Ionicons name={ikon} size={21} color={w.text} />
      <View style={styles.fleks}>
        <Text style={[styles.label, { color: w.text }]}>{label}</Text>
        {keterangan && <Text style={[styles.keterangan, { color: w.textSecondary }]}>{keterangan}</Text>}
      </View>
      {nilai && (
        <Text style={[styles.nilai, { color: w.textSecondary }]} numberOfLines={1}>
          {nilai}
        </Text>
      )}
      {onPress && <Ionicons name="chevron-forward" size={18} color={w.textSecondary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  isi: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  fleks: {
    flex: 1,
  },
  kelompok: {
    gap: Spacing.two,
  },
  judulKelompok: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    paddingHorizontal: Spacing.one,
  },
  kartu: {
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  baris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  label: {
    fontSize: 15.5,
  },
  keterangan: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
  nilai: {
    fontSize: 14,
    maxWidth: '45%',
  },
  keluar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 14,
    borderRadius: Radius.medium,
  },
  teksKeluar: {
    fontSize: 15.5,
    fontFamily: Fonts.bold,
  },
  mati: {
    opacity: 0.5,
  },
  hapusAkun: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  teksHapusAkun: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    textDecorationLine: 'underline',
  },
  teksMenghapus: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
});
