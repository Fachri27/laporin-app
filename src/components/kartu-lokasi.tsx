import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, View } from 'react-native';

import { TitikLive } from '@/components/titik-live';
import { Tombol } from '@/components/tombol';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useKini } from '@/hooks/use-kini';
import { useTheme } from '@/hooks/use-theme';
import { koordinat } from '@/lib/batas-laporan';
import { aturTitik, type Titik } from '@/lib/draf-laporan';
import { BATAS_UMUR_POSISI_MS, koordinatTeks, masihSegar, ulangiLokasi, useLokasiLive } from '@/lib/lokasi-live';

const LABEL_SUMBER: Record<Titik['sumber'] | 'gps', string> = {
  gps: 'GPS LIVE',
  kamera: 'DARI KAMERA',
  foto: 'DARI FOTO',
  manual: 'MANUAL',
};

/**
 * Titik laporan. Tanpa campur tangan warga ia mengikuti GPS live; begitu ada
 * foto/video dari kamera (atau foto galeri ber-GPS), titiknya dikunci ke posisi
 * saat pengambilan.
 */
export function KartuLokasi({ titik }: { titik: Titik | null }) {
  const w = useTheme();
  const kini = useKini();
  const { status, posisi } = useLokasiLive();
  const [manual, setManual] = useState(false);
  const [latTeks, setLatTeks] = useState('');
  const [lngTeks, setLngTeks] = useState('');
  const [galat, setGalat] = useState('');

  const sumber = titik?.sumber ?? 'gps';
  // Posisi basi tidak ikut terkirim (lihat posisiSegar), jadi tidak ditampilkan sebagai titik.
  const posisiDipakai = masihSegar(posisi, kini, BATAS_UMUR_POSISI_MS) ? posisi : null;
  const tampil = titik ?? posisiDipakai;
  const live = sumber === 'gps' && masihSegar(posisi, kini);

  function bukaManual() {
    const awal = tampil;
    setLatTeks(awal ? awal.lat.toFixed(6) : '');
    setLngTeks(awal ? awal.lng.toFixed(6) : '');
    setGalat('');
    setManual(true);
  }

  function simpanManual() {
    const hasil = koordinat(latTeks, lngTeks);
    if (hasil === null) return setGalat('Isi latitude dan longitude, atau batalkan.');
    if ('galat' in hasil) return setGalat(hasil.galat);
    aturTitik({ ...hasil, akurasi: null, sumber: 'manual' });
    setManual(false);
  }

  return (
    <View style={[styles.kartu, { backgroundColor: w.surface, borderColor: w.border }]}>
      <View style={styles.kepala}>
        <Text style={[styles.label, { color: w.textSecondary }]}>Titik lokasi</Text>
        {tampil && (
          <View style={[styles.lencana, { backgroundColor: live ? w.accentSoft : w.background }]}>
            {sumber === 'gps' && <TitikLive warna={live ? w.accentText : w.textSecondary} berdenyut={live} ukuran={6} />}
            <Text style={[styles.lencanaTeks, { color: live ? w.onAccentSoft : w.textSecondary }]}>
              {sumber === 'gps' && !live ? 'GPS' : LABEL_SUMBER[sumber]}
            </Text>
          </View>
        )}
      </View>

      {tampil ? (
        <View style={styles.isi}>
          <Text selectable style={[styles.koordinat, { color: w.text }]}>
            {koordinatTeks(tampil.lat, tampil.lng)}
          </Text>
          <Text style={[styles.keterangan, { color: w.textSecondary }]}>
            {[
              tampil.akurasi != null && `akurasi ±${Math.round(tampil.akurasi)} m`,
              sumber === 'gps' && posisiDipakai && `diperbarui ${umurTeks(kini - posisiDipakai.waktu)}`,
              sumber === 'kamera' && 'posisi saat foto/video pertama diambil',
              sumber === 'foto' && 'lokasi yang tercatat di foto',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ) : (
        <PesanStatus status={status} />
      )}

      {manual ? (
        <View style={styles.manual}>
          <View style={styles.barisManual}>
            <TextInput
              value={latTeks}
              onChangeText={setLatTeks}
              placeholder="Latitude"
              keyboardType="numbers-and-punctuation"
              placeholderTextColor={w.textSecondary}
              style={[styles.inputManual, { color: w.text, borderColor: w.border, backgroundColor: w.background }]}
            />
            <TextInput
              value={lngTeks}
              onChangeText={setLngTeks}
              placeholder="Longitude"
              keyboardType="numbers-and-punctuation"
              placeholderTextColor={w.textSecondary}
              style={[styles.inputManual, { color: w.text, borderColor: w.border, backgroundColor: w.background }]}
            />
          </View>
          {galat !== '' && <Text style={[styles.galat, { color: w.danger }]}>{galat}</Text>}
          <View style={styles.aksi}>
            <Tombol judul="Batal" ragam="teks" onPress={() => setManual(false)} />
            <Tombol judul="Simpan titik" ragam="sekunder" onPress={simpanManual} />
          </View>
        </View>
      ) : (
        <View style={styles.aksi}>
          {sumber !== 'gps' && (
            <Tombol judul="Ikuti GPS live" ikon="navigate" ragam="teks" onPress={() => aturTitik(null)} />
          )}
          <Tombol judul="Isi manual" ikon="create-outline" ragam="teks" onPress={bukaManual} />
        </View>
      )}

      {!tampil && (
        <Text style={[styles.keterangan, { color: w.textSecondary }]}>
          Sangat membantu: laporan tanpa titik tidak bisa diverifikasi sampai petugas menemukan lokasinya.
        </Text>
      )}
    </View>
  );
}

function PesanStatus({ status }: { status: ReturnType<typeof useLokasiLive>['status'] }) {
  const w = useTheme();
  if (status === 'memuat' || status === 'mencari' || status === 'aktif') {
    return (
      <View style={styles.status}>
        <ActivityIndicator color={w.accentText} />
        <Text style={[styles.keterangan, { color: w.textSecondary }]}>
          Mencari sinyal GPS… coba di tempat terbuka.
        </Text>
      </View>
    );
  }
  const ditolak = status === 'ditolak';
  return (
    <View style={styles.isi}>
      <View style={styles.status}>
        <Ionicons name="warning-outline" size={18} color={w.danger} />
        <Text style={[styles.keterangan, styles.fleks, { color: w.text }]}>
          {ditolak
            ? 'Izin lokasi ditolak. Izinkan lokasi di pengaturan, atau isi manual.'
            : 'GPS mati atau sinyal lemah. Nyalakan lokasi lalu coba lagi, atau isi manual.'}
        </Text>
      </View>
      <View style={styles.aksi}>
        {ditolak && <Tombol judul="Buka pengaturan" ragam="teks" onPress={() => void Linking.openSettings()} />}
        <Tombol judul="Coba lagi" ikon="refresh" ragam="teks" onPress={ulangiLokasi} />
      </View>
    </View>
  );
}

function umurTeks(ms: number): string {
  const detik = Math.max(0, Math.round(ms / 1000));
  if (detik < 5) return 'baru saja';
  if (detik < 60) return `${detik} dtk lalu`;
  return `${Math.round(detik / 60)} mnt lalu`;
}

const styles = StyleSheet.create({
  kartu: {
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  kepala: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 12.5,
  },
  lencana: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  lencanaTeks: {
    fontFamily: Fonts.judulTebal,
    fontSize: 10.5,
    letterSpacing: 0.8,
  },
  isi: {
    gap: Spacing.one,
  },
  koordinat: {
    fontFamily: Fonts.mono,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  keterangan: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  fleks: {
    flex: 1,
  },
  aksi: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.one,
    marginHorizontal: -Spacing.two,
  },
  manual: {
    gap: Spacing.two,
  },
  barisManual: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inputManual: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: 12,
    fontFamily: Fonts.mono,
    fontSize: 14,
  },
  galat: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
  },
});
