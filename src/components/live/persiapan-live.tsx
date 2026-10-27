import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TombolIkon } from '@/components/bilah-atas';
import { LembarPilihan, type Pilihan } from '@/components/lembar-pilihan';
import { TitikLive } from '@/components/titik-live';
import { Tombol } from '@/components/tombol';
import { Fonts } from '@/constants/theme';
import { useGulirKeIsian } from '@/hooks/use-gulir-ke-isian';
import { useKeyboardTerbuka } from '@/hooks/use-keyboard-terbuka';
import { useKini } from '@/hooks/use-kini';
import { useTheme } from '@/hooks/use-theme';
import { BATAS_JUDUL, durasiTeks } from '@/lib/batas-laporan';
import { ubahIsian, useDraf } from '@/lib/draf-laporan';
import { koordinatTeks, masihSegar, useLokasiLive } from '@/lib/lokasi-live';

type Props = {
  menghubungkan: boolean;
  galat: string;
  /** Izin ditolak permanen: tampilkan tautan ke Pengaturan HP. */
  kePengaturan: boolean;
  publikAktif: boolean;
  masuk: boolean;
  akunMemuat: boolean;
  /** Posisi lebih tua dari ini tidak dikirim sebagai titik siaran. */
  batasSegarGpsMs: number;
  onUbahPublik: (nyala: boolean) => void;
  onMulai: () => void;
};

type Penonton = 'petugas' | 'publik';

/**
 * Persiapan siaran langsung, sebahasa dengan layar laporkan di desain: label kapital kecil
 * "SIAPKAN SIARAN" dan tombol tutup, judul besar, status GPS (pengganti pratinjau kamera —
 * kamera baru menyala setelah izin diminta saat siaran dimulai), judul siaran, siapa yang
 * menonton, lalu tombol pil sinyal "Mulai siaran". Tanpa impor LiveKit, jadi aman dimuat di
 * mana pun; siarannya sendiri ada di siaran-live.tsx.
 */
export function PersiapanLive({
  menghubungkan,
  galat,
  kePengaturan,
  publikAktif,
  masuk,
  akunMemuat,
  batasSegarGpsMs,
  onUbahPublik,
  onMulai,
}: Props) {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const draf = useDraf();
  const gulir = useRef<ScrollView>(null);
  const gulirKeIsian = useGulirKeIsian(gulir);
  const keyboardTerbuka = useKeyboardTerbuka();
  const kolomJudul = useRef<TextInput>(null);
  const [pilihPenonton, setPilihPenonton] = useState(false);
  const tundaMasuk = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(tundaMasuk.current), []);

  const penontonTerkunci = menghubungkan || akunMemuat || (masuk && draf.anonim);
  const galatJudul = galat !== '' && !draf.judul.trim();
  const tampilHitung = draf.judul.length > BATAS_JUDUL * 0.8;

  // Bawaan hanya petugas yang menonton; warga lain hanya melihat perkiraan lokasi (±1 km).
  const pilihanPenonton: Pilihan<Penonton>[] = [
    { nilai: 'petugas', label: 'Hanya petugas', keterangan: 'Bawaan · tidak tampil di beranda warga' },
    {
      nilai: 'publik',
      label: 'Petugas & warga',
      keterangan: masuk ? 'Tampil di beranda warga · lokasi ±1 km' : 'Butuh akun · tampil di beranda warga',
    },
  ];
  let catatanPenonton = '';
  if (masuk && draf.anonim) catatanPenonton = 'Siaran untuk warga tidak tersedia untuk laporan anonim.';
  else if (publikAktif) catatanPenonton = 'Warga hanya melihat perkiraan lokasimu (±1 km).';

  function pilihPenontonBaru(nilai: Penonton) {
    const nyala = nilai === 'publik';
    if (nyala === publikAktif) return;
    // Tamu diarahkan ke lembar masuk. Ditunda sampai lembar pilihan selesai menutup:
    // iOS menolak membuka lembar baru selagi lembar lain masih beranimasi.
    if (!masuk) {
      clearTimeout(tundaMasuk.current);
      tundaMasuk.current = setTimeout(() => onUbahPublik(nyala), 400);
      return;
    }
    onUbahPublik(nyala);
  }

  return (
    // Papan ketik tidak boleh menutup kolom judul; tombol Mulai ikut naik di atasnya.
    // padding juga di Android: edge-to-edge tidak lagi mengecilkan jendela saat keyboard muncul.
    <KeyboardAvoidingView behavior="padding" style={[styles.layar, { backgroundColor: w.background }]}>
      <StatusBar style="auto" />
      <View style={[styles.kepala, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.eyebrow, { color: w.textSecondary }]}>SIAPKAN SIARAN</Text>
        <TombolIkon ikon="x" label="Tutup" onPress={() => router.back()} style={styles.tutup} />
      </View>
      <Text accessibilityRole="header" style={[styles.judul, { color: w.text }]}>
        Siaran{'\n'}
        <Text style={{ color: w.accentText }}>langsung</Text>
      </Text>

      <ScrollView ref={gulir} contentContainerStyle={styles.isi} keyboardShouldPersistTaps="handled" {...gulirKeIsian}>
        <StatusGps batasSegarMs={batasSegarGpsMs} />

        {/* .field: label kecil di dalam kotak. Mengetuk labelnya ikut memfokuskan kolom. */}
        <Pressable
          accessible={false}
          onPress={() => kolomJudul.current?.focus()}
          style={[styles.kolom, { backgroundColor: w.surface, borderColor: galatJudul ? w.danger : w.border }]}>
          <View style={styles.barisLabelKolom}>
            <Text style={[styles.labelKolom, { color: w.textSecondary }]}>JUDUL SIARAN</Text>
            {tampilHitung && (
              <Text style={[styles.hitung, { color: w.textSecondary }]}>
                {draf.judul.length}/{BATAS_JUDUL}
              </Text>
            )}
          </View>
          <TextInput
            ref={kolomJudul}
            accessibilityLabel="Judul siaran"
            value={draf.judul}
            onChangeText={(judul) => ubahIsian({ judul })}
            placeholder="Mis. “Api mendekati permukiman”"
            placeholderTextColor={w.textSecondary}
            maxLength={BATAS_JUDUL}
            editable={!menghubungkan}
            returnKeyType="done"
            style={[styles.input, { color: w.text }]}
          />
        </Pressable>

        {/* .sheet-options: siapa yang menonton; pilihannya di lembar dari bawah. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Siapa yang bisa menonton: ${publikAktif ? 'petugas dan warga' : 'hanya petugas'}`}
          accessibilityState={{ disabled: penontonTerkunci }}
          disabled={penontonTerkunci}
          onPress={() => setPilihPenonton(true)}
          style={({ pressed }) => [
            styles.pilihan,
            { borderColor: w.border },
            pressed && styles.ditekan,
            penontonTerkunci && styles.mati,
          ]}>
          <View style={styles.fleks}>
            <Text style={[styles.labelPilihan, { color: w.textSecondary }]}>SIAPA YANG BISA MENONTON</Text>
            <Text style={[styles.teksNilai, { color: w.text }]}>{publikAktif ? 'Petugas & warga' : 'Hanya petugas'}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={w.text} />
        </Pressable>
        {catatanPenonton !== '' && (
          <Text style={[styles.catatanPilihan, { color: w.textSecondary }]}>{catatanPenonton}</Text>
        )}
      </ScrollView>

      {/* paddingBottom di sini: KeyboardAvoidingView menimpa paddingBottom miliknya sendiri. */}
      <View style={[styles.kaki, { paddingBottom: (keyboardTerbuka ? 0 : insets.bottom) + 14 }]}>
        {galat !== '' && (
          <View style={[styles.galat, { borderColor: w.danger }]}>
            <Feather name="alert-circle" size={17} color={w.danger} />
            <Text style={[styles.teksGalat, { color: w.danger }]}>
              {galat}
              {kePengaturan && (
                <Text style={styles.tebal} onPress={() => void Linking.openSettings()}>
                  {'  '}Buka Pengaturan
                </Text>
              )}
            </Text>
          </View>
        )}
        {/* Pil sinyal berhuruf judul, dengan titik tinta berdenyut. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: menghubungkan }}
          disabled={menghubungkan}
          onPress={onMulai}
          style={({ pressed }) => [styles.tombolMulai, { backgroundColor: pressed ? w.accentPressed : w.accent }]}>
          {menghubungkan ? (
            <ActivityIndicator color={w.onAccent} />
          ) : (
            <>
              <TitikLive warna={w.onAccent} ukuran={7} />
              <Text style={[styles.teksMulai, { color: w.onAccent }]}>Mulai siaran</Text>
            </>
          )}
        </Pressable>
        <Text style={[styles.persetujuan, { color: w.textSecondary }]}>
          Dengan memulai siaran, kamu menyetujui{' '}
          <Text style={[styles.tebal, { color: w.accentText }]} onPress={() => router.push('/ketentuan')}>
            Ketentuan Penggunaan
          </Text>
          .
        </Text>
      </View>

      <LembarPilihan
        terbuka={pilihPenonton}
        judul="Siapa yang bisa menonton?"
        pilihan={pilihanPenonton}
        dipilih={publikAktif ? 'publik' : 'petugas'}
        onPilih={pilihPenontonBaru}
        onTutup={() => setPilihPenonton(false)}
      />
    </KeyboardAvoidingView>
  );
}

/**
 * Setelah siaran, seperti layar "laporan diterima" di desain: label kapital kecil berisi durasi,
 * judul besar, ajakan melengkapi laporan tertulis, lalu dua tombol pil.
 */
export function SiaranSelesai({ durasi, terputus, galat }: { durasi: number; terputus: boolean; galat: string }) {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.layar, styles.selesai, { backgroundColor: w.background, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="auto" />
      <Text style={[styles.eyebrow, { color: w.accentText }]}>
        {terputus ? 'SIARAN TERPUTUS' : 'SIARAN SELESAI'} · {durasiTeks(durasi)}
      </Text>
      <Text accessibilityRole="header" style={[styles.judulSelesai, { color: w.text }]}>
        {terputus ? 'Koneksi\nterputus.' : 'Terima\nkasih.'}
      </Text>
      <Text style={[styles.teksSelesai, { color: w.textSecondary }]}>
        {terputus ? 'Siaran ke petugas berhenti. ' : ''}Lengkapi dengan foto dan cerita supaya petugas punya catatan tertulis.
      </Text>
      {galat !== '' && <Text style={[styles.teksGalat, styles.galatSelesai, { color: w.danger }]}>{galat}</Text>}
      {/* Dibuka dari beranda pun tetap ke formulir; dari formulir = kembali ke formulir yang sama. */}
      <View style={styles.tombolSelesai}>
        <Tombol judul="Lengkapi laporan" ragam="terang" besar onPress={() => router.dismissTo('/lapor')} />
        <Tombol judul="Kembali ke beranda" ragam="sekunder" besar onPress={() => router.dismissTo('/')} />
      </View>
    </View>
  );
}

function StatusGps({ batasSegarMs }: { batasSegarMs: number }) {
  const w = useTheme();
  const { status, posisi } = useLokasiLive();
  const kini = useKini();
  const live = masihSegar(posisi, kini);
  let judul = 'Mencari GPS…';
  let teks = 'Siaran tetap bisa tanpa lokasi';
  // Posisi basi tidak ikut terkirim sebagai titik siaran, jadi juga tidak ditampilkan.
  if (posisi && masihSegar(posisi, kini, batasSegarMs)) {
    judul = koordinatTeks(posisi.lat, posisi.lng);
    teks = [live ? 'GPS live' : 'GPS', posisi.akurasi != null && `±${Math.round(posisi.akurasi)} m`].filter(Boolean).join(' · ');
  } else if (status === 'ditolak') {
    judul = 'Izin lokasi ditolak';
  } else if (status === 'mati') {
    judul = 'GPS mati';
  }
  return (
    <View style={[styles.gps, { backgroundColor: w.surface, borderColor: w.border }]}>
      <View style={[styles.ikonKotak, { backgroundColor: w.accentSoft }]}>
        {live ? <TitikLive warna={w.accent} berdenyut ukuran={8} /> : <Feather name="map-pin" size={18} color={w.accent} />}
      </View>
      <View style={styles.fleks}>
        <Text style={[styles.judulGps, { color: w.text }]}>{judul.toUpperCase()}</Text>
        <Text style={[styles.teksGps, { color: w.textSecondary }]}>{teks.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  selesai: {
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  fleks: {
    flex: 1,
    minWidth: 0,
  },
  tebal: {
    fontFamily: Fonts.bold,
  },
  ditekan: {
    opacity: 0.75,
  },
  mati: {
    opacity: 0.5,
  },
  kepala: {
    paddingLeft: 20,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tutup: {
    marginRight: -4,
  },
  eyebrow: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  judul: {
    marginTop: 10,
    paddingHorizontal: 20,
    fontFamily: Fonts.judulTebal,
    fontSize: 32,
    letterSpacing: -0.4,
    lineHeight: 39,
  },
  isi: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  gps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
  },
  ikonKotak: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  judulGps: {
    fontFamily: Fonts.monoTebal,
    fontSize: 12.5,
    letterSpacing: 0.3,
  },
  teksGps: {
    marginTop: 3,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  kolom: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  barisLabelKolom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  labelKolom: {
    fontFamily: Fonts.monoTebal,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  hitung: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  input: {
    minHeight: 26,
    marginTop: 4,
    padding: 0,
    fontFamily: Fonts.regular,
    fontSize: 15,
  },
  // Baris pilihan bergaris atas-bawah, seperti daftar alasan di layar laporkan.
  pilihan: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  labelPilihan: {
    fontFamily: Fonts.monoTebal,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  teksNilai: {
    marginTop: 3,
    fontFamily: Fonts.bold,
    fontSize: 15,
  },
  catatanPilihan: {
    marginTop: -6,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  kaki: {
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 10,
  },
  galat: {
    flexDirection: 'row',
    gap: 8,
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
  galatSelesai: {
    flex: 0,
    marginTop: 12,
  },
  tombolMulai: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  teksMulai: {
    fontFamily: Fonts.judulTebal,
    fontSize: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  persetujuan: {
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
  },
  judulSelesai: {
    marginTop: 16,
    fontFamily: Fonts.judulTebal,
    fontSize: 40,
    letterSpacing: -0.4,
    lineHeight: 49,
    paddingTop: 4,
  },
  teksSelesai: {
    marginTop: 16,
    maxWidth: 360,
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  tombolSelesai: {
    marginTop: 28,
    gap: 10,
  },
});
