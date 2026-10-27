import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lazy, Suspense, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TitikLive } from '@/components/titik-live';
import { Tombol } from '@/components/tombol';
import { Fonts, Media, Spacing } from '@/constants/theme';
import { useKini } from '@/hooks/use-kini';
import { useTheme } from '@/hooks/use-theme';
import { koordinat } from '@/lib/batas-laporan';
import { aturTitik, type Titik } from '@/lib/draf-laporan';
import { BATAS_UMUR_POSISI_MS, koordinatTeks, masihSegar, ulangiLokasi, useLokasiLive } from '@/lib/lokasi-live';
import { halanganPeta } from '@/lib/peta-tersedia';

// Dimuat malas: modul native peta tidak boleh dievaluasi di build yang belum siap (lihat peta-tersedia.ts).
const PetaMini = halanganPeta === null ? lazy(() => import('@/components/peta-mini')) : null;

const LABEL_SUMBER: Record<Titik['sumber'] | 'gps', string> = {
  gps: 'GPS live',
  kamera: 'Dari kamera',
  foto: 'Dari foto',
  manual: 'Diisi manual',
};

/**
 * Titik laporan: panel "Lokasi kejadian" berkoordinat mono + pratinjau peta. Tanpa campur tangan warga
 * ia mengikuti GPS live; begitu ada foto/video dari kamera (atau foto galeri ber-GPS), titiknya
 * dikunci ke posisi saat pengambilan. "Ubah" = isi koordinat manual. Pratinjau peta hanya
 * tampil bila peta tersedia di build ini; tanpa alamat karena situs tidak menyediakannya.
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
  const adaPeta = PetaMini !== null && tampil !== null;

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

  const keterangan = tampil
    ? [
        sumber === 'gps' ? (live ? 'GPS live' : 'GPS') : LABEL_SUMBER[sumber],
        // Ada peta = akurasi sudah tertulis di pilnya.
        !adaPeta && tampil.akurasi != null && `±${Math.round(tampil.akurasi)} m`,
        sumber === 'gps' && posisiDipakai && `diperbarui ${umurTeks(kini - posisiDipakai.waktu)}`,
        sumber === 'kamera' && 'posisi saat foto/video pertama diambil',
        sumber === 'foto' && 'lokasi yang tercatat di foto',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <View style={styles.wadah}>
      <View style={[styles.kartu, { backgroundColor: w.surface, borderColor: w.border }]}>
        <View style={styles.barisLabel}>
          {live ? (
            <TitikLive warna={w.accent} berdenyut ukuran={7} />
          ) : (
            <Feather name="map-pin" size={15} color={w.textSecondary} />
          )}
          <Text style={[styles.label, { color: w.textSecondary }]}>Lokasi kejadian</Text>
        </View>

        {tampil ? (
          <View>
            <View style={styles.baris}>
              <Text selectable style={[styles.koordinat, styles.fleks, { color: w.text }]}>
                {koordinatTeks(tampil.lat, tampil.lng)}
              </Text>
              {!manual && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ubah titik lokasi secara manual"
                  hitSlop={10}
                  onPress={bukaManual}>
                  <Text style={[styles.ubah, { color: w.accentText }]}>UBAH</Text>
                </Pressable>
              )}
            </View>
            <Text style={[styles.keterangan, { color: w.textSecondary }]}>{keterangan}</Text>
          </View>
        ) : (
          <PesanStatus status={status} onManual={manual ? undefined : bukaManual} />
        )}

        {manual ? (
          <View style={styles.manual}>
            <View style={styles.barisManual}>
              <TextInput
                value={latTeks}
                onChangeText={setLatTeks}
                placeholder="Latitude"
                accessibilityLabel="Latitude"
                keyboardType="numbers-and-punctuation"
                placeholderTextColor={w.textSecondary}
                style={[styles.inputManual, { color: w.text, borderColor: w.border, backgroundColor: w.background }]}
              />
              <TextInput
                value={lngTeks}
                onChangeText={setLngTeks}
                placeholder="Longitude"
                accessibilityLabel="Longitude"
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
          tampil &&
          sumber !== 'gps' && (
            <View style={styles.aksi}>
              <Tombol judul="Ikuti GPS live" ikon="navigate" ragam="teks" onPress={() => aturTitik(null)} />
            </View>
          )
        )}
      </View>

      {PetaMini && tampil && (
        // Peta sungguhan berpusat di titik, penanda sinyal di tengah, label akurasi di pojok.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.peta, { backgroundColor: w.surfaceMuted, borderColor: w.border }]}>
          <Suspense fallback={null}>
            <PetaMini lat={tampil.lat} lng={tampil.lng} />
          </Suspense>
          <View pointerEvents="none" style={styles.tengah}>
            <View style={styles.pin}>
              <Ionicons name="location" size={25} color={w.accent} />
            </View>
          </View>
          {tampil.akurasi != null && (
            <View pointerEvents="none" style={styles.pilAkurasi}>
              <Text style={styles.teksAkurasi}>AKURASI ±{Math.round(tampil.akurasi)} M</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** Belum ada titik: status GPS singkat dan semua aksinya dalam satu baris. */
function PesanStatus({ status, onManual }: { status: ReturnType<typeof useLokasiLive>['status']; onManual?: () => void }) {
  const w = useTheme();
  const mencari = status === 'memuat' || status === 'mencari' || status === 'aktif';
  const ditolak = status === 'ditolak';
  return (
    <View style={styles.isi}>
      <View style={styles.status}>
        {mencari ? (
          <ActivityIndicator color={w.accentText} />
        ) : (
          <Ionicons name="warning-outline" size={18} color={w.danger} />
        )}
        <Text style={[styles.koordinat, styles.fleks, { color: w.text }]}>
          {mencari ? 'Mencari sinyal GPS…' : ditolak ? 'Izin lokasi ditolak' : 'GPS mati atau sinyal lemah'}
        </Text>
      </View>
      <View style={styles.aksi}>
        {/* Izin ditolak: lokasi-live memeriksa ulang sendiri saat kembali dari Pengaturan, jadi tanpa "Coba lagi". */}
        {ditolak && <Tombol judul="Buka pengaturan" ragam="teks" onPress={() => void Linking.openSettings()} />}
        {!mencari && !ditolak && <Tombol judul="Coba lagi" ikon="refresh" ragam="teks" onPress={ulangiLokasi} />}
        {onManual && <Tombol judul="Isi manual" ikon="create-outline" ragam="teks" onPress={onManual} />}
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
  wadah: {
    gap: 12,
  },
  kartu: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: Spacing.two,
  },
  barisLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 16,
  },
  label: {
    fontFamily: Fonts.monoTebal,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  baris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  isi: {
    gap: Spacing.one,
  },
  koordinat: {
    fontFamily: Fonts.monoTebal,
    fontSize: 14,
  },
  ubah: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  keterangan: {
    marginTop: 4,
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
    marginBottom: -Spacing.one,
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
    height: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    fontFamily: Fonts.mono,
    fontSize: 14,
  },
  galat: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
  },
  peta: {
    height: 140,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tengah: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Lingkaran sinyal pudar bercincin.
  pin: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,74,28,0.18)',
    boxShadow: '0 0 0 9px rgba(255,74,28,0.08)',
  },
  pilAkurasi: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Media.kacaTebal,
  },
  teksAkurasi: {
    color: Media.teks,
    fontFamily: Fonts.monoTebal,
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
