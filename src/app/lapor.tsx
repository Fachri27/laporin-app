import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaptchaLaporan } from '@/components/captcha-laporan';
import { GridLampiran } from '@/components/grid-lampiran';
import { Isian } from '@/components/isian';
import { KartuLokasi } from '@/components/kartu-lokasi';
import { Tombol } from '@/components/tombol';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { segarkanAkun, tokenSesi, useAkun } from '@/lib/akun';
import { kirimLaporan, MODE_DEMO, type Pengiriman, type Progres } from '@/lib/api';
import {
  BATAS_BERKAS,
  BATAS_DESKRIPSI,
  BATAS_JUDUL,
  BATAS_NAMA,
  BATAS_TOTAL_BYTE,
  BATAS_TOTAL_TEKS,
  DURASI_VIDEO_DETIK,
  ukuranTeks,
} from '@/lib/batas-laporan';
import { ambilDraf, hapusLampiran, resetDraf, totalUkuran, ubahIsian, useDraf } from '@/lib/draf-laporan';
import { pilihDariGaleri } from '@/lib/galeri';
import { posisiSegar, useLokasiLive } from '@/lib/lokasi-live';
import { VERSI_TEKS } from '@/lib/versi';

type Galat = { teks: string; bidang?: string };

export default function LayarLapor() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const draf = useDraf();
  const akun = useAkun();
  // Menyalakan GPS live sejak layar dibuka, seperti situs yang membaca lokasi otomatis.
  useLokasiLive();
  const [galat, setGalat] = useState<Galat | null>(null);
  const [progres, setProgres] = useState<Progres | null>(null);
  const pengiriman = useRef<Pengiriman | null>(null);
  const terpasang = useRef(true);

  const [captchaTerbuka, setCaptchaTerbuka] = useState(false);
  const selesaiCaptcha = useRef<((tiket: string | null) => void) | null>(null);
  const mengirim = progres !== null;
  // Berkas sudah terunggah penuh, server sedang menyimpan: batal sekarang tidak menjamin laporan batal.
  const diproses = progres !== null && progres.total > 0 && progres.terkirim >= progres.total;
  const jumlah = draf.lampiran.length;
  const total = totalUkuran(draf.lampiran);
  const penuh = jumlah >= BATAS_BERKAS;

  // Selama mengirim layar tidak boleh ditinggalkan (tombol kembali, usap iOS, back Android):
  // unggahan tanpa pemilik bisa mengganti layar lain, menghapus draf baru, atau terkirim ganda
  // dari formulir kedua.
  usePreventRemove(mengirim, ({ data }) => {
    // Kiriman sudah selesai (mis. pindah ke /terkirim), hanya status layar belum diperbarui.
    if (!pengiriman.current) return navigation.dispatch(data.action);
    if (diproses) {
      Alert.alert('Laporan sedang diproses', 'Berkas sudah terkirim. Tunggu sebentar sampai server selesai menyimpannya.');
      return;
    }
    Alert.alert('Batalkan kiriman?', 'Laporan belum selesai terkirim. Isian dan berkas tetap tersimpan di draf.', [
      { text: 'Lanjut mengirim', style: 'cancel' },
      {
        text: 'Batalkan',
        style: 'destructive',
        onPress: () => {
          pengiriman.current?.batalkan();
          navigation.dispatch(data.action);
        },
      },
    ]);
  });

  // Jaring pengaman bila layar tetap dilepas: kiriman yatim dibatalkan.
  useEffect(() => {
    terpasang.current = true;
    return () => {
      terpasang.current = false;
      pengiriman.current?.batalkan();
    };
  }, []);

  function bukaKamera() {
    setGalat(null);
    router.push('/kamera');
  }

  async function pilihGaleri() {
    setGalat(null);
    const hasil = await pilihDariGaleri();
    if (hasil.galat) setGalat({ teks: hasil.galat, bidang: 'berkas' });
  }

  function validasi(): Galat | null {
    if (!draf.judul.trim()) return { teks: 'Isi judul singkat dulu.', bidang: 'judul' };
    if (!draf.deskripsi.trim()) return { teks: 'Ceritakan kejadiannya sedikit.', bidang: 'deskripsi' };
    if (jumlah === 0) return { teks: 'Sertakan minimal satu foto atau video sebagai bukti.', bidang: 'berkas' };
    if (total > BATAS_TOTAL_BYTE) {
      return { teks: `Total berkas melebihi ${BATAS_TOTAL_TEKS}. Kurangi dulu.`, bidang: 'berkas' };
    }
    return null;
  }

  function tekanKirim() {
    const g = validasi();
    setGalat(g);
    if (g) return;
    if (!draf.titik && !posisiSegar()) {
      Alert.alert(
        'Belum ada titik lokasi',
        'Laporan tetap bisa dikirim, tapi verifikasinya lebih lama karena petugas harus mencari lokasinya.',
        [
          { text: 'Tunggu GPS', style: 'cancel' },
          { text: 'Kirim saja', onPress: () => void kirim() },
        ],
      );
      return;
    }
    void kirim();
  }

  /** Buka lembar captcha; selesai dengan tiket, atau null bila ditutup. */
  function mintaTiket(): Promise<string | null> {
    return new Promise((selesai) => {
      selesaiCaptcha.current = selesai;
      setCaptchaTerbuka(true);
    });
  }

  async function kirim() {
    const d = ambilDraf();
    // Titik yang dikirim: yang dikunci (kamera/foto/manual), atau posisi GPS live yang masih segar.
    const titik = d.titik ?? posisiSegar();
    // Anonim = tidak terikat ke akun sama sekali, demi keamanan pelapor.
    const token = d.anonim ? null : tokenSesi();
    setGalat(null);
    // Tanpa akun (tamu atau anonim) server meminta tiket captcha, diselesaikan di dalam aplikasi.
    const tiket = token || MODE_DEMO ? null : await mintaTiket();
    if (!terpasang.current || (!token && !MODE_DEMO && !tiket)) return;
    setProgres({ terkirim: 0, total: totalUkuran(d.lampiran) });

    const p = kirimLaporan(
      {
        judul: d.judul,
        deskripsi: d.deskripsi,
        nama: d.nama.trim() || (d.anonim ? '' : (akun.pengguna?.nama ?? '')),
        anonim: d.anonim,
        titik: titik ? { lat: titik.lat, lng: titik.lng } : null,
        lampiran: d.lampiran,
        token,
        tiket,
      },
      setProgres,
    );
    pengiriman.current = p;
    const hasil = await p.hasil;
    pengiriman.current = null;
    // Layar sudah dilepas: jangan menyentuh draf atau navigasi milik layar lain.
    if (!terpasang.current) return;
    setProgres(null);

    if (hasil.ok) {
      resetDraf();
      router.replace({ pathname: '/terkirim', params: MODE_DEMO ? { demo: '1' } : {} });
    } else if (hasil.bidang === 'captcha' && token) {
      // Token dikirim tapi server tetap meminta captcha = sesi sudah dicabut (mis. akun dihapus
      // dari HP lain). segarkanAkun mengeluarkan sesi itu di HP ini; kiriman berikutnya lewat jalur tamu.
      await segarkanAkun();
      setGalat({ teks: 'Sesi akun Anda sudah berakhir. Tekan Kirim lagi untuk mengirim tanpa akun, atau masuk ulang.' });
    } else if (hasil.bidang !== 'batal') {
      setGalat({ teks: hasil.galat, bidang: hasil.bidang });
    }
  }

  const persen = progres && progres.total > 0 ? Math.round((progres.terkirim / progres.total) * 100) : 0;

  return (
    // Android: KeyboardAvoidingView tanpa `behavior` cukup menjaga isian tetap terlihat.
    // iOS: ditangani automaticallyAdjustKeyboardInsets milik ScrollView.
    <KeyboardAvoidingView style={styles.fleks}>
      {/* .simple-header di desain: "Kirim" di kanan atas, selain tombol besar di bawah. */}
      <Stack.Screen
        options={{
          headerRight: () =>
            mengirim ? null : (
              <Pressable accessibilityRole="button" onPress={tekanKirim} hitSlop={10}>
                <Text style={[styles.kirimKepala, { color: w.accentText }]}>Kirim</Text>
              </Pressable>
            ),
        }}
      />
      <ScrollView
        style={{ backgroundColor: w.background }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.isi, { paddingBottom: insets.bottom + Spacing.five }]}>
        {MODE_DEMO && (
          <View style={[styles.demo, { backgroundColor: w.accentSoft }]}>
            <Ionicons name="flask-outline" size={18} color={w.onAccentSoft} />
            <Text style={[styles.demoTeks, { color: w.onAccentSoft }]}>
              Mode demo — laporan tidak dikirim ke server. Isi EXPO_PUBLIC_API_URL di .env untuk mengirim sungguhan.
            </Text>
          </View>
        )}

        {/* Bukti foto / video */}
        <View style={styles.bagian}>
          <View style={styles.barisLabel}>
            <Text style={[styles.label, { color: w.textSecondary }]}>Foto atau video</Text>
            <Text style={[styles.hitung, { color: w.textSecondary }]}>
              {jumlah}/{BATAS_BERKAS}
              {jumlah > 0 && ` · ${ukuranTeks(total)}`}
            </Text>
          </View>

          {jumlah === 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={bukaKamera}
              disabled={mengirim}
              style={({ pressed }) => [
                styles.ajakan,
                {
                  borderColor: galat?.bidang === 'berkas' ? w.danger : w.border,
                  backgroundColor: pressed ? w.surfaceMuted : w.surface,
                },
              ]}>
              <View style={[styles.ajakanIkon, { backgroundColor: w.accent }]}>
                <Ionicons name="camera" size={28} color={w.onAccent} />
              </View>
              <Text style={[styles.ajakanJudul, { color: w.text }]}>Foto / rekam langsung</Text>
              <Text style={[styles.ajakanTeks, { color: w.textSecondary }]}>
                Kamera dengan GPS live — koordinat & waktu tercatat otomatis di setiap foto.
              </Text>
            </Pressable>
          ) : (
            <GridLampiran lampiran={draf.lampiran} onHapus={hapusLampiran} nonaktif={mengirim} />
          )}

          <View style={styles.barisTombol}>
            {jumlah > 0 && (
              <Tombol
                judul="Kamera"
                ikon="camera-outline"
                ragam="sekunder"
                onPress={bukaKamera}
                nonaktif={penuh || mengirim}
                style={styles.fleks}
              />
            )}
            <Tombol
              judul="Galeri"
              ikon="images-outline"
              ragam="sekunder"
              onPress={() => void pilihGaleri()}
              nonaktif={penuh || mengirim}
              style={styles.fleks}
            />
          </View>
          <Text style={[styles.petunjuk, { color: w.textSecondary }]}>
            Wajib minimal satu; maks. {BATAS_BERKAS} berkas, total {BATAS_TOTAL_TEKS}. Video sebaiknya ≤{' '}
            {DURASI_VIDEO_DETIK} detik — sinyal lemah gampang putus.
          </Text>
        </View>

        <Isian
          label="Judul laporan"
          value={draf.judul}
          onChangeText={(judul) => ubahIsian({ judul })}
          placeholder="Mis. “Asap tebal di tepi jalan Trans-Kalimantan”"
          maxLength={BATAS_JUDUL}
          editable={!mengirim}
          galat={galat?.bidang === 'judul'}
          returnKeyType="next"
        />

        <Isian
          label="Apa yang terjadi?"
          value={draf.deskripsi}
          onChangeText={(deskripsi) => ubahIsian({ deskripsi })}
          placeholder="Ceritakan yang kamu lihat…"
          petunjuk="Kapan Anda melihatnya, seberapa luas, apa yang terbakar."
          maxLength={BATAS_DESKRIPSI}
          multiline
          editable={!mengirim}
          galat={galat?.bidang === 'deskripsi'}
        />

        <KartuLokasi titik={draf.titik} />

        {/* .detail-row di desain: ikon, judul + keterangan, aksi di kanan. */}
        <View style={[styles.daftarDetail, { borderColor: w.border }]}>
          <BarisDetail
            ikon="radio-outline"
            judul="Siaran langsung ke petugas"
            keterangan="Tunjukkan kejadian secara real-time, lengkap dengan lokasi GPS."
            onPress={mengirim ? undefined : () => router.push('/live')}>
            <Ionicons name="chevron-forward" size={20} color={w.textSecondary} />
          </BarisDetail>
          <BarisDetail
            ikon="eye-off-outline"
            judul="Kirim sebagai anonim"
            keterangan={
              akun.status === 'masuk'
                ? draf.anonim
                  ? 'Tidak terhubung ke akun Anda dan tidak muncul di Laporanku.'
                  : `Sebagai ${akun.pengguna?.nama ?? 'akun Anda'} — muncul di Laporanku.`
                : 'Nama Anda tidak ditampilkan.'
            }
            garisBawah={!draf.anonim}>
            <Switch
              value={draf.anonim}
              onValueChange={(anonim) => ubahIsian({ anonim })}
              disabled={mengirim}
              trackColor={{ true: w.accent }}
              thumbColor={draf.anonim ? w.onAccent : undefined}
            />
          </BarisDetail>
          {!draf.anonim && (
            <View style={styles.isianNama}>
              <Isian
                label="Nama Anda (opsional)"
                value={draf.nama}
                onChangeText={(nama) => ubahIsian({ nama })}
                // Akun yang masuk: namanya jadi bawaan, warga tetap boleh mengganti.
                placeholder={akun.pengguna?.nama ?? 'Nama pelapor'}
                maxLength={BATAS_NAMA}
                autoComplete="name"
                editable={!mengirim}
              />
            </View>
          )}
        </View>

        {/* .verification-info di desain. */}
        <View style={[styles.infoVerifikasi, { backgroundColor: w.accentSoft }]}>
          <Ionicons name="shield-checkmark-outline" size={22} color={w.onAccentSoft} />
          <Text style={[styles.teksVerifikasi, { color: w.onAccentSoft }]}>
            <Text style={styles.tebal}>Laporan diperiksa petugas sebelum tampil.{'\n'}</Text>
            Petugas memeriksa lokasi, foto/video, dan cerita Anda. Laporan tanpa titik lokasi butuh waktu lebih lama.
          </Text>
        </View>

        {galat && (
          <View style={[styles.galat, { borderColor: w.danger }]}>
            <Ionicons name="alert-circle" size={18} color={w.danger} />
            <Text style={[styles.galatTeks, { color: w.danger }]}>{galat.teks}</Text>
          </View>
        )}

        {progres ? (
          <View style={[styles.progres, { backgroundColor: w.surface, borderColor: w.border }]}>
            <View style={styles.barisLabel}>
              <Text style={[styles.labelProgres, { color: w.text }]}>
                {diproses ? 'Memproses di server…' : `Mengirim… ${persen}%`}
              </Text>
              <Text style={[styles.hitung, { color: w.textSecondary }]}>
                {ukuranTeks(progres.terkirim)} / {ukuranTeks(progres.total)}
              </Text>
            </View>
            <View style={[styles.rel, { backgroundColor: w.surfaceMuted }]}>
              <View style={[styles.isiRel, { width: `${persen}%`, backgroundColor: w.accent }]} />
            </View>
            <Text style={[styles.petunjuk, { color: w.textSecondary }]}>
              {diproses
                ? 'Berkas sudah terkirim; server sedang menyimpan laporan. Biarkan aplikasi tetap terbuka.'
                : 'Biarkan aplikasi tetap terbuka sampai selesai.'}
            </Text>
            {!diproses && <Tombol judul="Batalkan" ragam="teks" onPress={() => pengiriman.current?.batalkan()} />}
          </View>
        ) : (
          <>
            <Tombol judul="Kirim laporan" ikon="send" besar onPress={tekanKirim} />
            <Text style={[styles.persetujuan, { color: w.textSecondary }]}>
              Dengan mengirim, Anda menyetujui{' '}
              <Text style={[styles.tautan, { color: w.accentText }]} onPress={() => router.push('/ketentuan')}>
                Ketentuan Penggunaan
              </Text>
              .
            </Text>
          </>
        )}

        <Text style={[styles.versi, { color: w.textSecondary }]}>{VERSI_TEKS}</Text>
      </ScrollView>
      <CaptchaLaporan
        terbuka={captchaTerbuka}
        onSelesai={(tiket) => {
          setCaptchaTerbuka(false);
          selesaiCaptcha.current?.(tiket);
          selesaiCaptcha.current = null;
        }}
      />
    </KeyboardAvoidingView>
  );
}

function BarisDetail({
  ikon,
  judul,
  keterangan,
  onPress,
  garisBawah = true,
  children,
}: {
  ikon: ComponentProps<typeof Ionicons>['name'];
  judul: string;
  keterangan: string;
  onPress?: () => void;
  garisBawah?: boolean;
  children?: ReactNode;
}) {
  const w = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.barisDetail,
        garisBawah && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w.border },
        pressed && { backgroundColor: w.surfaceMuted },
      ]}>
      <Ionicons name={ikon} size={22} color={w.text} />
      <View style={styles.fleks}>
        <Text style={[styles.judulDetail, { color: w.text }]}>{judul}</Text>
        <Text style={[styles.keteranganDetail, { color: w.textSecondary }]}>{keterangan}</Text>
      </View>
      {children}
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
  kirimKepala: {
    fontFamily: Fonts.bold,
    fontSize: 15,
  },
  demo: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  demoTeks: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  bagian: {
    gap: Spacing.two + 2,
  },
  barisLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 12.5,
  },
  hitung: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  ajakan: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  ajakanIkon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  ajakanJudul: {
    fontFamily: Fonts.judulTebal,
    fontSize: 17,
  },
  ajakanTeks: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  barisTombol: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  petunjuk: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },
  daftarDetail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barisDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 3,
  },
  judulDetail: {
    fontFamily: Fonts.bold,
    fontSize: 14.5,
  },
  keteranganDetail: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },
  isianNama: {
    paddingVertical: 13,
  },
  infoVerifikasi: {
    flexDirection: 'row',
    gap: 10,
    padding: 13,
    borderRadius: Radius.medium,
  },
  teksVerifikasi: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  tebal: {
    fontFamily: Fonts.bold,
  },
  galat: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  galatTeks: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  progres: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.large,
  },
  labelProgres: {
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  rel: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  isiRel: {
    height: '100%',
    borderRadius: 4,
  },
  persetujuan: {
    marginTop: Spacing.two,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  tautan: {
    fontFamily: Fonts.semibold,
  },
  versi: {
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    textAlign: 'center',
    opacity: 0.8,
  },
});
