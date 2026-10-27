import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BilahAtas } from '@/components/bilah-atas';
import { CaptchaLaporan } from '@/components/captcha-laporan';
import { GridLampiran } from '@/components/grid-lampiran';
import { Isian } from '@/components/isian';
import { KartuLokasi } from '@/components/kartu-lokasi';
import { Tombol } from '@/components/tombol';
import { Fonts, Spacing, TULANG } from '@/constants/theme';
import { useGulirKeIsian } from '@/hooks/use-gulir-ke-isian';
import { useKeyboardTerbuka } from '@/hooks/use-keyboard-terbuka';
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
  ukuranTeks,
} from '@/lib/batas-laporan';
import {
  ambilDraf,
  aturJenis,
  hapusLampiran,
  resetDraf,
  totalUkuran,
  ubahIsian,
  useDraf,
} from '@/lib/draf-laporan';
import { pilihDariGaleri } from '@/lib/galeri';
import { JENIS_KEJADIAN, type IdJenis } from '@/lib/jenis-kejadian';
import { posisiSegar, useLokasiLive } from '@/lib/lokasi-live';

type Galat = { teks: string; bidang?: string };
type Langkah = 1 | 2;

/** Ikon jenis kejadian; api memakai ikon api Ionicons (Feather tidak punya). */
const IKON_JENIS: Record<Exclude<IdJenis, 'api'>, ComponentProps<typeof Feather>['name']> = {
  asap: 'wind',
  lahan: 'layers',
  dampak: 'alert-triangle',
};

/** Aksi navigasi "mundur" (tombol kembali, usap iOS, back Android) — di langkah 2 berarti ke langkah 1. */
const AKSI_MUNDUR = new Set(['GO_BACK', 'POP', 'POP_TO_TOP']);

/**
 * Formulir lapor dua langkah, berbahasa visual artboard Report: label langkah kapital kecil, judul
 * kapital besar, pilihan bergaris berpenanda sinyal. Langkah 1: jenis kejadian. Langkah 2: judul,
 * lokasi, cerita, foto/video, lalu kirim. Isian tersimpan sebagai draf di setiap ketikan, jadi
 * layar bisa ditutup dan dilanjutkan dari tombol Lapor. Nama (tamu), anonim, dan persetujuan
 * tetap ada karena diwajibkan situs. Tanpa "tingkat kedaruratan": situs tidak menerimanya.
 */
export default function LayarLapor() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const draf = useDraf();
  const akun = useAkun();
  // Menyalakan GPS live sejak formulir dibuka, seperti situs yang membaca lokasi otomatis.
  useLokasiLive();
  const gulir = useRef<ScrollView>(null);
  const gulirKeIsian = useGulirKeIsian(gulir);
  const keyboardTerbuka = useKeyboardTerbuka();
  // Draf yang sudah punya jenis dilanjutkan langsung dari detailnya.
  const [langkah, setLangkah] = useState<Langkah>(() => (ambilDraf().jenis ? 2 : 1));
  const [galat, setGalat] = useState<Galat | null>(null);
  const [progres, setProgres] = useState<Progres | null>(null);
  const pengiriman = useRef<Pengiriman | null>(null);
  const terpasang = useRef(true);
  /** Layar sengaja ditinggalkan (terkirim): jangan dihalangi usePreventRemove. */
  const keluar = useRef(false);
  /** Posisi y tiap bidang di isi gulir, untuk menggulir ke bidang yang bermasalah. */
  const posisiBidang = useRef<Record<string, number>>({});

  const [captchaTerbuka, setCaptchaTerbuka] = useState(false);
  const selesaiCaptcha = useRef<((tiket: string | null) => void) | null>(null);
  const mengirim = progres !== null;
  // Berkas sudah terunggah penuh, server sedang menyimpan: batal sekarang tidak menjamin laporan batal.
  const diproses = progres !== null && progres.total > 0 && progres.terkirim >= progres.total;
  const jumlah = draf.lampiran.length;
  const total = totalUkuran(draf.lampiran);
  const penuh = jumlah >= BATAS_BERKAS;

  // Selama mengirim layar tidak boleh ditinggalkan: unggahan tanpa pemilik bisa mengganti layar
  // lain, menghapus draf baru, atau terkirim ganda dari formulir kedua. Di langkah 2, "kembali"
  // (tombol, usap iOS, back Android) mundur ke langkah 1 dulu, seperti tombol Kembali di kaki.
  usePreventRemove(mengirim || langkah === 2, ({ data }) => {
    if (keluar.current) return navigation.dispatch(data.action);
    if (mengirim) {
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
      return;
    }
    // Navigasi lain (tautan masuk, reset) tidak ditahan; hanya "mundur" yang berarti ganti langkah.
    if (!AKSI_MUNDUR.has(data.action.type)) return navigation.dispatch(data.action);
    pindahLangkah(1);
  });

  // Jaring pengaman bila layar tetap dilepas: kiriman yatim dibatalkan.
  useEffect(() => {
    terpasang.current = true;
    return () => {
      terpasang.current = false;
      pengiriman.current?.batalkan();
    };
  }, []);

  // Ganti langkah = mulai dari atas.
  useEffect(() => {
    gulir.current?.scrollTo({ y: 0, animated: false });
  }, [langkah]);

  function pindahLangkah(ke: Langkah) {
    setGalat(null);
    setLangkah(ke);
  }

  /** Tampilkan galat; galat milik satu bidang membawa warga ke langkah dan bidang itu. */
  function tampilGalat(g: Galat) {
    setGalat(g);
    if (g.bidang === 'jenis') return setLangkah(1);
    if (!g.bidang) return;
    setLangkah(2);
    const y = posisiBidang.current[g.bidang];
    if (y !== undefined) setTimeout(() => gulir.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }), 60);
  }

  function catatPosisi(bidang: string) {
    return (e: { nativeEvent: { layout: { y: number } } }) => {
      posisiBidang.current[bidang] = e.nativeEvent.layout.y;
    };
  }

  function tutup() {
    const d = ambilDraf();
    const kosong = !d.jenis && !d.deskripsi && d.lampiran.length === 0;
    if (kosong || mengirim) return router.back();
    Alert.alert('Tutup formulir lapor?', 'Isian dan berkas tersimpan sebagai draf — tekan Lapor untuk melanjutkannya.', [
      { text: 'Lanjut mengisi', style: 'cancel' },
      {
        text: 'Buang draf',
        style: 'destructive',
        onPress: () => {
          resetDraf();
          router.back();
        },
      },
      { text: 'Simpan draf', onPress: () => router.back() },
    ]);
  }

  /** Tombol kiri bilah atas: tutup di langkah 1, mundur di langkah 2 (saat mengirim = tanya batal). */
  function kembali() {
    if (mengirim) return router.back();
    if (langkah === 2) return pindahLangkah(1);
    tutup();
  }

  function lanjutkan() {
    if (!draf.jenis) return tampilGalat({ teks: 'Pilih jenis kejadian dulu.', bidang: 'jenis' });
    pindahLangkah(2);
  }

  function validasi(): Galat | null {
    if (!draf.jenis) return { teks: 'Pilih jenis kejadian dulu.', bidang: 'jenis' };
    if (!draf.judul.trim()) return { teks: 'Isi judul singkat dulu.', bidang: 'judul' };
    if (!draf.deskripsi.trim()) return { teks: 'Ceritakan kondisinya sedikit.', bidang: 'deskripsi' };
    if (jumlah === 0) return { teks: 'Sertakan minimal satu foto atau video sebagai bukti.', bidang: 'berkas' };
    if (total > BATAS_TOTAL_BYTE) return { teks: `Total berkas melebihi ${BATAS_TOTAL_TEKS}. Kurangi dulu.`, bidang: 'berkas' };
    return null;
  }

  function tekanKirim() {
    const g = validasi();
    if (g) return tampilGalat(g);
    setGalat(null);
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
      keluar.current = true;
      router.replace({ pathname: '/terkirim', params: { ...(MODE_DEMO && { demo: '1' }), ...(token && { akun: '1' }) } });
    } else if (hasil.bidang === 'captcha' && token) {
      // Token dikirim tapi server tetap meminta captcha = sesi sudah dicabut (mis. akun dihapus
      // dari HP lain). segarkanAkun mengeluarkan sesi itu di HP ini; kiriman berikutnya lewat jalur tamu.
      await segarkanAkun();
      setGalat({ teks: 'Sesi akun Anda sudah berakhir. Tekan Kirim lagi untuk mengirim tanpa akun, atau masuk ulang.' });
    } else if (hasil.bidang !== 'batal') {
      tampilGalat({ teks: hasil.galat, bidang: hasil.bidang });
    }
  }

  function bukaKamera() {
    setGalat(null);
    router.push('/kamera');
  }

  async function pilihGaleri() {
    setGalat(null);
    const hasil = await pilihDariGaleri();
    if (hasil.galat) tampilGalat({ teks: hasil.galat, bidang: 'berkas' });
  }

  const persen = progres && progres.total > 0 ? Math.round((progres.terkirim / progres.total) * 100) : 0;
  const galatBerkas = galat?.bidang === 'berkas';

  return (
    // padding di kedua platform: Android edge-to-edge tidak lagi mengecilkan jendela saat keyboard
    // muncul. Kaki ikut naik di atas keyboard, isian yang fokus digulir ke area yang tersisa.
    <KeyboardAvoidingView behavior="padding" style={[styles.layar, { backgroundColor: w.background }]}>
      <BilahAtas judul="Lapor" onKembali={kembali} />

      <ScrollView
        ref={gulir}
        style={styles.gulir}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        {...gulirKeIsian}
        contentContainerStyle={styles.isi}>
        <View style={styles.pembuka}>
          <Text
            accessibilityLabel={`Langkah ${langkah} dari 2, ${langkah === 1 ? 'jenis kejadian' : 'detail laporan'}`}
            style={[styles.eyebrow, { color: w.textSecondary }]}>
            LANGKAH {langkah}/2 · {langkah === 1 ? 'JENIS KEJADIAN' : 'DETAIL LAPORAN'}
          </Text>
          <Text accessibilityRole="header" style={[styles.h1, { color: w.text }]}>
            {langkah === 1 ? 'Apa yang' : 'Ceritakan'}
            {'\n'}
            <Text style={{ color: w.accentText }}>{langkah === 1 ? 'sedang terjadi?' : 'situasinya.'}</Text>
          </Text>
          <Text style={[styles.teksPembuka, { color: w.textSecondary }]}>
            {langkah === 1 ? 'Pilih yang paling mendekati apa yang kamu lihat.' : 'Informasi yang akurat mempercepat verifikasi.'}
          </Text>
        </View>

        {langkah === 1 ? (
          // Empat jenis kejadian karhutla sebagai baris pilihan bergaris, seperti alasan di artboard Report.
          <View style={[styles.daftarJenis, { borderTopColor: w.border }]} accessibilityRole="radiogroup">
            {JENIS_KEJADIAN.map((j) => {
              const pilih = draf.jenis === j.id;
              const warnaIkon = pilih ? w.accentText : w.textSecondary;
              return (
                <Pressable
                  key={j.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: pilih }}
                  accessibilityLabel={`${j.nama}: ${j.bantuan}`}
                  onPress={() => {
                    setGalat(null);
                    aturJenis(j.id);
                  }}
                  style={({ pressed }) => [
                    styles.jenis,
                    { borderBottomColor: w.border },
                    pressed && { backgroundColor: w.surface },
                  ]}>
                  <View style={styles.ikonJenis}>
                    {j.id === 'api' ? (
                      <Ionicons name="flame-outline" size={21} color={warnaIkon} />
                    ) : (
                      <Feather name={IKON_JENIS[j.id]} size={19} color={warnaIkon} />
                    )}
                  </View>
                  <View style={styles.fleks}>
                    <Text style={[styles.namaJenis, { color: w.text }]}>{j.nama}</Text>
                    <Text style={[styles.bantuanJenis, { color: w.textSecondary }]}>{j.bantuan}</Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      pilih
                        ? { borderWidth: 6, borderColor: w.accent, backgroundColor: w.text }
                        : { borderColor: galat?.bidang === 'jenis' ? w.danger : w.borderStrong },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <>
            {MODE_DEMO && (
              <View style={[styles.demo, { backgroundColor: w.accentSoft }]}>
                <Feather name="info" size={17} color={w.onAccentSoft} />
                <Text style={[styles.teksDemo, { color: w.onAccentSoft }]}>
                  Mode demo — laporan tidak dikirim ke server. Isi EXPO_PUBLIC_API_URL di .env untuk mengirim sungguhan.
                </Text>
              </View>
            )}

            <View onLayout={catatPosisi('judul')}>
              <Isian
                label="Judul singkat"
                value={draf.judul}
                onChangeText={(judul) => ubahIsian({ judul })}
                placeholder="Mis. “Asap tebal di tepi jalan Trans-Kalimantan”"
                maxLength={BATAS_JUDUL}
                editable={!mengirim}
                galat={galat?.bidang === 'judul'}
                returnKeyType="next"
              />
            </View>

            <View onLayout={catatPosisi('lokasi')}>
              <KartuLokasi titik={draf.titik} />
            </View>

            <View onLayout={catatPosisi('deskripsi')}>
              <Isian
                label="Deskripsikan kondisi"
                petunjuk="Semakin detail, semakin membantu."
                value={draf.deskripsi}
                onChangeText={(deskripsi) => ubahIsian({ deskripsi })}
                placeholder="Contoh: Asap tebal dari arah timur sejak pukul 08.00, api terlihat di tepi kebun…"
                maxLength={BATAS_DESKRIPSI}
                multiline
                editable={!mengirim}
                galat={galat?.bidang === 'deskripsi'}
              />
            </View>

            {/* Kamera (aksi utama di lapangan) + galeri, kisi bukti di atasnya. */}
            <View style={styles.bidang} onLayout={catatPosisi('berkas')}>
              {jumlah > 0 && <GridLampiran lampiran={draf.lampiran} onHapus={hapusLampiran} nonaktif={mengirim} />}
              <View
                style={[
                  styles.unggah,
                  { borderColor: galatBerkas ? w.danger : w.borderStrong },
                  (penuh || mengirim) && styles.mati,
                ]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ambil foto atau video"
                  accessibilityState={{ disabled: penuh || mengirim }}
                  disabled={penuh || mengirim}
                  onPress={bukaKamera}
                  style={({ pressed }) => [styles.unggahKamera, pressed && { backgroundColor: w.surfaceMuted }]}>
                  <Feather name="camera" size={21} color={w.textSecondary} />
                  <View style={styles.fleks}>
                    <Text style={[styles.judulUnggah, { color: w.text }]}>
                      {jumlah > 0 ? 'Tambah foto atau video' : 'Ambil foto atau video'}
                    </Text>
                    <Text style={[styles.teksUnggah, { color: w.textSecondary }]}>
                      {(jumlah > 0
                        ? `${jumlah}/${BATAS_BERKAS} berkas · ${ukuranTeks(total)}`
                        : `Maksimal ${BATAS_BERKAS} berkas · ${BATAS_TOTAL_TEKS}`
                      ).toUpperCase()}
                    </Text>
                  </View>
                </Pressable>
                <View style={[styles.pemisah, { backgroundColor: w.border }]} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Pilih dari galeri"
                  accessibilityState={{ disabled: penuh || mengirim }}
                  disabled={penuh || mengirim}
                  onPress={() => void pilihGaleri()}
                  style={({ pressed }) => [styles.unggahGaleri, pressed && { backgroundColor: w.surfaceMuted }]}>
                  <Feather name="image" size={20} color={w.textSecondary} />
                  <Text style={[styles.teksGaleri, { color: w.textSecondary }]}>GALERI</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.keselamatan, { backgroundColor: w.warningSoft, borderColor: `${w.warning}2e` }]}>
              <Feather name="alert-triangle" size={18} color={w.warning} />
              <Text style={[styles.teksKeselamatan, { color: w.onSage }]}>
                <Text style={styles.tebal}>Utamakan keselamatanmu.</Text> Jangan mendekati api atau asap tebal untuk
                memotret.
              </Text>
            </View>

            <View style={[styles.barisAnonim, { backgroundColor: w.surface, borderColor: w.border }]}>
              <Feather name="eye-off" size={18} color={w.textSecondary} />
              <View style={styles.fleks}>
                <Text style={[styles.judulAnonim, { color: w.text }]}>Kirim sebagai anonim</Text>
                <Text style={[styles.teksAnonim, { color: w.textSecondary }]}>
                  {akun.status === 'masuk'
                    ? draf.anonim
                      ? 'Tidak tersimpan di Laporan saya'
                      : `Sebagai ${akun.pengguna?.nama ?? 'akunmu'}`
                    : 'Nama tidak ditampilkan'}
                </Text>
              </View>
              <Switch
                value={draf.anonim}
                onValueChange={(anonim) => ubahIsian({ anonim })}
                disabled={mengirim}
                trackColor={{ false: w.borderStrong, true: w.accent }}
                thumbColor={Platform.OS === 'android' ? TULANG : undefined}
              />
            </View>
            {!draf.anonim && akun.status !== 'masuk' && (
              <View onLayout={catatPosisi('nama')}>
                <Isian
                  label="Nama (opsional)"
                  value={draf.nama}
                  onChangeText={(nama) => ubahIsian({ nama })}
                  placeholder="Nama pelapor"
                  maxLength={BATAS_NAMA}
                  autoComplete="name"
                  editable={!mengirim}
                  galat={galat?.bidang === 'nama'}
                />
              </View>
            )}

            <Text style={[styles.persetujuan, { color: w.textSecondary }]}>
              Dengan mengirim, kamu menyetujui{' '}
              <Text style={[styles.tebal, { color: w.accentText }]} onPress={() => router.push('/ketentuan')}>
                Ketentuan Penggunaan
              </Text>
              .
            </Text>
          </>
        )}
      </ScrollView>

      {/* Kaki: tepat di bawah isi yang pendek, menempel di bawah layar saat isinya panjang. */}
      <View
        style={[
          styles.kaki,
          // Keyboard terbuka menutupi bilah navigasi: ruang aman bawah tidak perlu lagi.
          { paddingBottom: (keyboardTerbuka ? 0 : insets.bottom) + 14 },
        ]}>
        {galat && (
          <View style={[styles.galat, { borderColor: w.danger }]}>
            <Feather name="alert-circle" size={17} color={w.danger} />
            <Text style={[styles.teksGalat, { color: w.danger }]}>{galat.teks}</Text>
          </View>
        )}
        {progres ? (
          <View style={styles.progres}>
            <View style={styles.barisProgres}>
              <Text style={[styles.labelProgres, { color: w.text }]}>
                {diproses ? 'Memproses di server…' : `Mengirim… ${persen}%`}
              </Text>
              <Text style={[styles.hitung, { color: w.textSecondary }]}>
                {ukuranTeks(progres.terkirim)} / {ukuranTeks(progres.total)}
              </Text>
            </View>
            <View style={[styles.relKirim, { backgroundColor: w.surfaceMuted }]}>
              <View style={[styles.isiRel, { width: `${persen}%`, backgroundColor: w.accent }]} />
            </View>
            <View style={styles.barisProgres}>
              <Text style={[styles.catatan, styles.fleks, { color: w.textSecondary }]}>
                {diproses
                  ? 'Berkas sudah terkirim; server sedang menyimpan laporan. Biarkan aplikasi tetap terbuka.'
                  : 'Biarkan aplikasi tetap terbuka sampai selesai.'}
              </Text>
              {!diproses && <Tombol judul="Batalkan" ragam="teks" onPress={() => pengiriman.current?.batalkan()} />}
            </View>
          </View>
        ) : (
          <View style={styles.barisTombol}>
            {langkah === 2 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => pindahLangkah(1)}
                style={({ pressed }) => [
                  styles.mundur,
                  { borderColor: w.borderStrong },
                  pressed && [styles.ditekan, { backgroundColor: w.surfaceMuted }],
                ]}>
                <Text style={[styles.teksMundur, { color: w.text }]}>Kembali</Text>
              </Pressable>
            )}
            <Tombol
              judul={langkah === 1 ? 'Lanjutkan' : 'Kirim laporan'}
              besar
              onPress={langkah === 1 ? lanjutkan : tekanKirim}
              style={styles.fleks}
            />
          </View>
        )}
      </View>

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

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  fleks: {
    flex: 1,
  },
  tebal: {
    fontFamily: Fonts.bold,
  },
  mati: {
    opacity: 0.45,
  },
  ditekan: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  // Isi tidak memanjang sendiri: kaki mengikuti tepat di bawahnya bila isi pendek (langkah 1).
  gulir: {
    flexGrow: 0,
    flexShrink: 1,
  },
  isi: {
    gap: 12,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  pembuka: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  eyebrow: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  h1: {
    marginTop: 12,
    marginBottom: 12,
    fontFamily: Fonts.judulTebal,
    fontSize: 31,
    letterSpacing: -0.4,
    lineHeight: 38,
  },
  teksPembuka: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  demo: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: 14,
    borderRadius: 16,
  },
  teksDemo: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  daftarJenis: {
    borderTopWidth: 1,
  },
  jenis: {
    minHeight: 66,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
  },
  ikonJenis: {
    width: 24,
    alignItems: 'center',
  },
  namaJenis: {
    fontFamily: Fonts.bold,
    fontSize: 15,
  },
  bantuanJenis: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
  },
  radio: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 10,
  },
  bidang: {
    gap: 10,
  },
  // Kotak bergaris putus-putus; kamera di kiri, galeri di kanan.
  unggah: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    overflow: 'hidden',
  },
  unggahKamera: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  judulUnggah: {
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  teksUnggah: {
    marginTop: 3,
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
  },
  pemisah: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  unggahGaleri: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  teksGaleri: {
    fontFamily: Fonts.monoTebal,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  keselamatan: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 3,
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
  },
  teksKeselamatan: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  barisAnonim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  judulAnonim: {
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  teksAnonim: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
  persetujuan: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  kaki: {
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 9,
  },
  barisTombol: {
    flexDirection: 'row',
    gap: 10,
  },
  // Pil bergaris seperti "Undo" di artboard Report, setinggi tombol kirim.
  mundur: {
    height: 56,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teksMundur: {
    fontFamily: Fonts.tebal,
    fontSize: 15,
  },
  galat: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  teksGalat: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  progres: {
    gap: 6,
  },
  barisProgres: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  labelProgres: {
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  hitung: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  relKirim: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  isiRel: {
    height: '100%',
  },
  catatan: {
    fontFamily: Fonts.medium,
    fontSize: 11,
  },
});
