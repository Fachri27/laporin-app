import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BilahAtas } from '@/components/bilah-atas';
import { BarisGeser, JudulBagian, PosterLaporan } from '@/components/poster-laporan';
import { Fonts, Media } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { bukaLaporan, menuLaporan } from '@/lib/aksi-laporan';
import { posisiSekali } from '@/lib/lokasi-live';
import { catatPencarian, hapusRiwayatCari, useRiwayatCari } from '@/lib/riwayat-cari';
import { tanggalKejadian } from '@/lib/story';
import {
  jarakKm,
  jarakTeks,
  kreditLaporan,
  sampulDari,
  tanggalSingkat,
  tempatPendek,
  urlGambar,
  useUmpan,
  type Berita,
} from '@/lib/umpan';

type Urutan = 'semua' | 'terdekat' | 'video' | 'disukai';

const URUTAN: { id: Urutan; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'terdekat', label: 'Terdekat' },
  { id: 'video', label: 'Video' },
  { id: 'disukai', label: 'Paling disukai' },
];

/** "Sedang ramai" & kartu peta = laporan dalam rentang ini (tanggal kejadian). */
const HARI_RAMAI = 7;
/** Kredit bawaan umpan, bukan nama orang — tidak masuk "Sumber Terverifikasi". */
const BUKAN_SUMBER = new Set(['laporan warga', 'anonim']);

/** Ejaan lain nama pulau: label pulau dari situs "Sumatra"/"Jawa", lokasi hasil geocode berbahasa Inggris ("Java"). */
const ALIAS_CARI: [RegExp, string][] = [
  [/sumatera/g, 'sumatra'],
  [/\bjava\b/g, 'jawa'],
  [/\bborneo\b/g, 'kalimantan'],
];

/** Dipakai untuk kata kunci dan teks laporan, jadi ejaan mana pun saling cocok. */
function normalkan(t: string): string {
  let s = t.toLowerCase();
  for (const [pola, ganti] of ALIAS_CARI) s = s.replace(pola, ganti);
  return s;
}

type Ringkasan = {
  /** Laporan dengan tanggal kejadian dalam HARI_RAMAI hari terakhir. */
  jumlahPekan: number;
  /** Provinsi terbanyak; `semuaWaktu` = sepekan sepi, dihitung dari seluruh umpan. */
  ramai: { semuaWaktu: boolean; wilayah: string[] };
  /** Pengambil foto/video dengan laporan terbanyak: [nama, jumlah]. */
  sumber: [string, number][];
};

/**
 * Pencarian bergaya Discover di desain, dibuka dari ikon cari di beranda. Kata kunci kosong:
 * pencarian terbaru (di HP ini), wilayah yang sedang ramai, kartu peta, sumber laporan
 * terbanyak, dan laporan terbaru. Berisi kata kunci — atau chip selain "Semua" — daftar
 * laporan dengan urutan/saringan itu. Datanya umpan yang sama dengan beranda.
 */
export default function LayarCari() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { status, berita } = useUmpan();
  const riwayat = useRiwayatCari();
  // `q` = kata kunci awal, mis. nama pulau dari "Lihat semua" di Peta.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [cari, setCari] = useState(q ?? '');
  const [urutan, setUrutan] = useState<Urutan>('semua');
  /** Chip yang terakhir diketuk: lokasi yang datang terlambat tidak boleh menimpa pilihan sesudahnya. */
  const urutanDiminta = useRef<Urutan>('semua');
  const [acuan, setAcuan] = useState<{ lat: number; lng: number } | null>(null);
  const [mencariLokasi, setMencariLokasi] = useState(false);
  const [galatLokasi, setGalatLokasi] = useState('');

  // Pulau ikut dicari: nama pulau bisa tidak tertulis di lokasi/provinsi (mis. "DKI Jakarta").
  // Kredit media ikut dicari, jadi mengetuk nama sumber menemukan laporannya.
  const teksCari = useMemo(
    () =>
      new Map(
        berita.map((b) => [
          b.id,
          normalkan([b.judul, b.lokasi, b.provinsi, b.pulau, b.deskripsi, ...b.media.map((m) => m.keterangan)].filter(Boolean).join('\n')),
        ]),
      ),
    [berita],
  );

  const ringkasan = useMemo<Ringkasan>(() => {
    const sekarang = new Date();
    const batas = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate() - HARI_RAMAI);
    const dalamPekan = (b: Berita) => (tanggalKejadian(b.tanggal) ?? new Date(0)) >= batas;
    const hitung = (saring: (b: Berita) => boolean) => {
      const n = new Map<string, number>();
      for (const b of berita) if (b.provinsi && saring(b)) n.set(b.provinsi, (n.get(b.provinsi) ?? 0) + 1);
      return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p]) => p);
    };
    const pekanIni = hitung(dalamPekan);
    // Nama yang sama dengan huruf besar/kecil berbeda dihitung satu; ejaan pertama (terbaru) yang tampil.
    const sumber = new Map<string, [string, number]>();
    for (const b of berita) {
      const nama = kreditLaporan(b);
      const kunci = nama.toLowerCase();
      if (BUKAN_SUMBER.has(kunci)) continue;
      const ada = sumber.get(kunci);
      if (ada) ada[1] += 1;
      else sumber.set(kunci, [nama, 1]);
    }
    return {
      jumlahPekan: berita.filter(dalamPekan).length,
      // Sepekan sepi: wilayah yang paling sering dilaporkan, supaya bagian ini tidak kosong.
      ramai: pekanIni.length > 0 ? { semuaWaktu: false, wilayah: pekanIni } : { semuaWaktu: true, wilayah: hitung(() => true) },
      sumber: [...sumber.values()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    };
  }, [berita]);

  const kata = normalkan(cari.trim());
  // Chip selain "Semua" tanpa kata kunci = menelusuri seluruh umpan (mis. Terdekat = sekitar saya).
  const menelusuri = kata !== '' || urutan !== 'semua';
  let hasil = !menelusuri ? [] : kata ? berita.filter((b) => (teksCari.get(b.id) ?? '').includes(kata)) : berita;
  if (urutan === 'video') hasil = hasil.filter((b) => b.media.some((m) => m.jenis === 'video'));
  if (urutan === 'disukai') hasil = [...hasil].sort((a, b) => b.jumlahSuka - a.jumlahSuka);
  if (urutan === 'terdekat' && acuan) hasil = [...hasil].sort((a, b) => jarakKm(acuan, a) - jarakKm(acuan, b));
  const jarakDari = urutan === 'terdekat' ? acuan : null;

  async function pilihUrutan(u: Urutan) {
    urutanDiminta.current = u;
    setGalatLokasi('');
    if (u === 'terdekat' && !acuan) {
      // Ketukan ulang selama menunggu GPS cukup mencatat pilihan; pencarian yang berjalan menerapkannya.
      if (mencariLokasi) return;
      setMencariLokasi(true);
      const p = await posisiSekali();
      setMencariLokasi(false);
      if (p) setAcuan({ lat: p.lat, lng: p.lng });
      // Warga memilih chip lain selama menunggu GPS: pilihan itu yang berlaku.
      if (urutanDiminta.current !== 'terdekat') return;
      if (!p) return setGalatLokasi('Lokasi tidak tersedia. Izinkan lokasi untuk melihat laporan terdekat.');
    }
    setUrutan(u);
  }

  function buka(b: Berita) {
    catatPencarian(cari);
    bukaLaporan(b.id);
  }

  let jumlah = '';
  if (menelusuri) {
    if (hasil.length > 0) jumlah = kata ? `${hasil.length} hasil ditemukan` : `${hasil.length} laporan`;
    else if (kata) jumlah = 'Tidak ada hasil. Coba kata kunci atau wilayah lain.';
    else if (berita.length > 0) jumlah = 'Belum ada laporan seperti ini.';
  }

  // Elemen, bukan komponen: komponen yang dibuat ulang tiap render akan me-remount kolom cari
  // sehingga keyboard tertutup di setiap ketikan. Urutan anaknya tetap, jadi kolom tidak
  // dipasang ulang saat isi di bawahnya berganti antara jelajah dan hasil.
  const kepala = (
    <View>
      {/* Judul layar dua baris huruf judul, baris kedua abu. */}
      <Text style={[styles.judulLayar, { color: w.text }]} accessibilityRole="header">
        Pantau kondisi{'\n'}
        <Text style={{ color: w.textSecondary }}>di sekitarmu.</Text>
      </Text>

      {/* Kolom cari berbentuk pil. */}
      <View style={[styles.kolom, { backgroundColor: w.surface, borderColor: w.border }]}>
        <Feather name="search" size={20} color={w.textSecondary} />
        <TextInput
          autoFocus={!q}
          value={cari}
          onChangeText={setCari}
          onSubmitEditing={() => catatPencarian(cari)}
          placeholder="Cari wilayah atau kejadian…"
          placeholderTextColor={w.textSecondary}
          returnKeyType="search"
          style={[styles.input, { color: w.text }]}
        />
        {cari !== '' && (
          <Pressable accessibilityRole="button" accessibilityLabel="Hapus pencarian" onPress={() => setCari('')} hitSlop={10}>
            <Feather name="x" size={18} color={w.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Chip pil kapital kecil. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.barisChip}>
        {URUTAN.map((u) => (
          <Chip
            key={u.id}
            label={u.label}
            aktif={urutan === u.id}
            memuat={u.id === 'terdekat' && mencariLokasi}
            onPress={() => void pilihUrutan(u.id)}
          />
        ))}
      </ScrollView>
      {galatLokasi !== '' && <Text style={[styles.catatan, { color: w.danger }]}>{galatLokasi}</Text>}

      {menelusuri ? (
        jumlah !== '' && (
          // Angka hasil = label data kapital kecil; kalimat (tidak ada hasil) tetap huruf badan.
          <Text style={[hasil.length > 0 ? styles.jumlah : styles.jumlahKosong, { color: w.textSecondary }]}>
            {hasil.length > 0 ? jumlah.toUpperCase() : jumlah}
          </Text>
        )
      ) : (
        <Jelajah berita={berita} memuat={status === 'memuat'} riwayat={riwayat} ringkasan={ringkasan} onCari={setCari} />
      )}
    </View>
  );

  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      <BilahAtas onKembali={() => router.back()} />
      <FlatList
        data={menelusuri ? hasil : []}
        keyExtractor={(b) => String(b.id)}
        renderItem={({ item }) => <BarisHasil berita={item} acuan={jarakDari} onPress={buka} />}
        ListHeaderComponent={kepala}
        ListFooterComponent={
          menelusuri && status === 'memuat' && berita.length === 0 ? <ActivityIndicator color={w.accentText} style={styles.pemuat} /> : null
        }
        initialNumToRender={8}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}

/**
 * Chip geser seperti ChipFilter: pil bergaris berhuruf kapital kecil; terpilih terisi tulang
 * (tinta di mode terang). `wilayah` = chip tempat, bertitik sinyal seperti chip pulau di beranda.
 */
function Chip({
  label,
  aktif = false,
  memuat = false,
  wilayah = false,
  onPress,
}: {
  label: string;
  aktif?: boolean;
  memuat?: boolean;
  wilayah?: boolean;
  onPress: () => void;
}) {
  const w = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: aktif, busy: memuat }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        aktif ? { backgroundColor: w.chipAktif, borderColor: w.chipAktif } : { borderColor: w.border },
        pressed && styles.ditekan,
      ]}>
      {memuat ? (
        <ActivityIndicator size="small" color={w.textSecondary} />
      ) : (
        <>
          {wilayah && <View style={[styles.titikChip, { backgroundColor: w.accent }]} />}
          <Text style={[styles.teksChip, { color: aktif ? w.onChipAktif : w.text }]}>{label.toUpperCase()}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Kepala bagian yang tautannya bukan "Lihat semua ›" (Hapus, keterangan): gaya JudulBagian. */
function KepalaBagian({ judul, children }: { judul: string; children?: ReactNode }) {
  const w = useTheme();
  return (
    <View style={styles.kepalaBagian}>
      <Text style={[styles.judulBagian, { color: w.text }]} accessibilityRole="header">
        {judul}
      </Text>
      {children}
    </View>
  );
}

/** Isi Pencarian sebelum ada kata kunci. */
function Jelajah({
  berita,
  memuat,
  riwayat,
  ringkasan,
  onCari,
}: {
  berita: Berita[];
  memuat: boolean;
  riwayat: readonly string[];
  ringkasan: Ringkasan;
  onCari: (kata: string) => void;
}) {
  const w = useTheme();
  const { ramai, sumber } = ringkasan;

  return (
    <View>
      {riwayat.length > 0 && (
        <View style={styles.bagian}>
          <KepalaBagian judul="Pencarian terbaru">
            <Pressable accessibilityRole="button" accessibilityLabel="Hapus pencarian terbaru" onPress={hapusRiwayatCari} hitSlop={8}>
              <Text style={[styles.tautan, { color: w.textSecondary }]}>HAPUS</Text>
            </Pressable>
          </KepalaBagian>
          {riwayat.map((r) => (
            <Pressable
              key={r}
              accessibilityRole="button"
              onPress={() => onCari(r)}
              style={({ pressed }) => [styles.barisRiwayat, { borderBottomColor: w.border }, pressed && styles.ditekan]}>
              <Feather name="clock" size={16} color={w.textSecondary} />
              <Text style={[styles.teksRiwayat, { color: w.text }]} numberOfLines={1}>
                {r}
              </Text>
              <Feather name="arrow-up-left" size={16} color={w.textSecondary} />
            </Pressable>
          ))}
        </View>
      )}

      {memuat && berita.length === 0 && <ActivityIndicator color={w.accentText} style={styles.pemuat} />}

      {ramai.wilayah.length > 0 && (
        <View style={styles.bagian}>
          {/* Rentang sepekan sudah tertulis di kartu peta; hanya cadangan "semua waktu" yang perlu disebut. */}
          <KepalaBagian judul="Sedang ramai">
            {ramai.semuaWaktu && <Text style={[styles.tautan, { color: w.textSecondary }]}>SEMUA WAKTU</Text>}
          </KepalaBagian>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.barisChip}>
            {ramai.wilayah.map((p) => (
              <Chip key={p} label={p} wilayah onPress={() => onCari(p)} />
            ))}
          </ScrollView>
        </View>
      )}

      {berita.length > 0 && <KartuPeta berita={berita} jumlahPekan={ringkasan.jumlahPekan} />}

      {sumber.length > 0 && (
        <View style={styles.bagian}>
          <JudulBagian judul="Sumber Terverifikasi" />
          {/* Avatar berinisial + lencana centang; ketuk = cari laporannya. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.barisSumber}>
            {sumber.map(([nama, n]) => (
              <Pressable
                key={nama}
                accessibilityRole="button"
                accessibilityLabel={`${nama}, ${n} laporan. Cari laporannya`}
                onPress={() => onCari(nama)}
                style={({ pressed }) => [styles.sumber, pressed && styles.ditekan]}>
                <View style={styles.wadahAvatar}>
                  <Avatar nama={nama} ukuran={60} />
                  <View style={[styles.lencana, { backgroundColor: w.chipAktif, borderColor: w.background }]}>
                    <Feather name="check" size={10} color={w.onChipAktif} />
                  </View>
                </View>
                <Text style={[styles.namaSumber, { color: w.text }]} numberOfLines={1}>
                  {nama}
                </Text>
                <Text style={[styles.ketSumber, { color: w.textSecondary }]}>{n} LAPORAN</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {berita.length > 0 && (
        <View style={styles.bagian}>
          <JudulBagian judul="Laporan terbaru" />
          <BarisGeser>
            {berita.slice(0, 10).map((b) => (
              <PosterLaporan key={b.id} berita={b} />
            ))}
          </BarisGeser>
        </View>
      )}
    </View>
  );
}

/**
 * Kartu peta: foto laporan terbaru, jumlah kejadian sepekan, ketuk = tab Peta. Teksnya di
 * bawah foto — foto bukti tidak boleh tertutup teks; di atas foto hanya label kecil tempatnya.
 */
function KartuPeta({ berita, jumlahPekan }: { berita: Berita[]; jumlahPekan: number }) {
  const w = useTheme();
  const terbaru = berita.find((b) => sampulDari(b));
  const sampul = terbaru && sampulDari(terbaru);
  const tempat = terbaru ? tempatPendek(terbaru) || terbaru.pulau : null;
  // Sepekan tanpa kejadian: seluruh laporan di peta, bukan "0 kejadian".
  const [angka, rentang] = jumlahPekan > 0 ? [jumlahPekan, `${HARI_RAMAI} hari terakhir.`] : [berita.length, 'tercatat di peta.'];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${angka} kejadian ${rentang} Lihat peta`}
      onPress={() => router.navigate('/peta')}
      style={({ pressed }) => [styles.fitur, { backgroundColor: w.surface, borderColor: w.border }, pressed && styles.ditekanKartu]}>
      <View style={[styles.fotoFitur, { backgroundColor: w.surfaceMuted }]}>
        {sampul ? (
          <Image source={{ uri: urlGambar(sampul, 720) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={sampul} />
        ) : (
          <Ionicons name="flame-outline" size={34} color={w.textSecondary} />
        )}
        {tempat && (
          <View style={styles.pilFoto} pointerEvents="none">
            <View style={styles.titikPil} />
            <Text style={styles.teksPilFoto} numberOfLines={1}>
              {tempat.toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.salinanFitur}>
        <Text style={[styles.labelMini, { color: w.textSecondary }]}>PETA KEJADIAN</Text>
        <Text style={[styles.judulFitur, { color: w.text }]}>
          <Text style={{ color: w.accentText }}>{angka} kejadian</Text>
          {'\n'}
          {rentang}
        </Text>
        <View style={[styles.tautanFitur, { borderColor: w.border }]}>
          <Feather name="map" size={13} color={w.text} />
          <Text style={[styles.teksTautanFitur, { color: w.text }]}>LIHAT PETA</Text>
        </View>
      </View>
    </Pressable>
  );
}

// Di-memo: daftar dirender ulang di setiap ketikan pencarian.
/** Satu hasil: sampul 105×70, judul huruf judul, tempat · tanggal (· jarak) kapital kecil, menu ⋯. */
const BarisHasil = memo(function BarisHasil({
  berita: b,
  acuan,
  onPress,
}: {
  berita: Berita;
  acuan: { lat: number; lng: number } | null;
  onPress: (b: Berita) => void;
}) {
  const w = useTheme();
  const sampul = sampulDari(b);
  const video = b.media.some((m) => m.jenis === 'video');
  const tempat = tempatPendek(b) || b.pulau || 'Laporan warga';
  const keterangan = [tempat, tanggalSingkat(b.tanggal), acuan && jarakTeks(jarakKm(acuan, b))].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${b.judul}, ${keterangan}`}
      onPress={() => onPress(b)}
      style={({ pressed }) => [styles.hasil, { borderBottomColor: w.border }, pressed && styles.ditekan]}>
      <View style={[styles.sampul, { backgroundColor: w.surfaceMuted }]}>
        {sampul ? (
          <Image source={{ uri: urlGambar(sampul, 256) }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={sampul} />
        ) : (
          <Ionicons name="flame-outline" size={22} color={w.textSecondary} />
        )}
        {video && (
          <View style={styles.pilVideo} pointerEvents="none">
            <Ionicons name="play" size={10} color={Media.teks} />
          </View>
        )}
      </View>
      <View style={styles.fleks}>
        <Text style={[styles.judulHasil, { color: w.text }]} numberOfLines={2}>
          {b.judul}
        </Text>
        <Text style={[styles.ketHasil, { color: w.textSecondary }]} numberOfLines={1}>
          {keterangan.toUpperCase()}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Opsi laporan" onPress={() => menuLaporan(b)} hitSlop={10} style={styles.lainnya}>
        <Feather name="more-horizontal" size={19} color={w.textSecondary} />
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  fleks: {
    flex: 1,
    minWidth: 0,
  },
  ditekan: {
    opacity: 0.7,
  },
  ditekanKartu: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  pemuat: {
    marginTop: 40,
  },
  judulLayar: {
    paddingTop: 6,
    paddingHorizontal: 20,
    paddingBottom: 18,
    fontFamily: Fonts.judulTebal,
    fontSize: 31,
    letterSpacing: -0.4,
    lineHeight: 38,
  },
  // Seperti kolom tulis di desain: pil bergaris tipis di atas panel lembut.
  kolom: {
    height: 52,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 26,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.regular,
    fontSize: 15,
  },
  barisChip: {
    gap: 6,
    paddingHorizontal: 16,
  },
  chip: {
    height: 36,
    minWidth: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
  },
  titikChip: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  teksChip: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.7,
  },
  catatan: {
    marginTop: 12,
    paddingHorizontal: 20,
    fontFamily: Fonts.medium,
    fontSize: 13,
  },
  jumlah: {
    marginTop: 18,
    marginBottom: 4,
    paddingHorizontal: 20,
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  jumlahKosong: {
    marginTop: 18,
    marginBottom: 2,
    paddingHorizontal: 20,
    fontFamily: Fonts.medium,
    fontSize: 13,
  },
  bagian: {
    marginTop: 28,
  },
  kepalaBagian: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  judulBagian: {
    flexShrink: 1,
    fontFamily: Fonts.judulTebal,
    fontSize: 21,
    lineHeight: 26,
  },
  tautan: {
    paddingBottom: 4,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  barisRiwayat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  teksRiwayat: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14.5,
  },
  fitur: {
    marginTop: 28,
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },
  fotoFitur: {
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pilFoto: {
    position: 'absolute',
    left: 14,
    top: 14,
    maxWidth: '75%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Media.pil,
  },
  titikPil: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Media.aksen,
  },
  teksPilFoto: {
    flexShrink: 1,
    color: Media.teks,
    fontFamily: Fonts.monoTebal,
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  salinanFitur: {
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 18,
  },
  labelMini: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  judulFitur: {
    marginTop: 8,
    fontFamily: Fonts.judulTebal,
    fontSize: 22,
    lineHeight: 27,
  },
  tautanFitur: {
    alignSelf: 'flex-start',
    height: 36,
    marginTop: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
  },
  teksTautanFitur: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  barisSumber: {
    gap: 19,
    paddingHorizontal: 20,
  },
  sumber: {
    width: 76,
    alignItems: 'center',
  },
  wadahAvatar: {
    marginBottom: 8,
  },
  lencana: {
    position: 'absolute',
    left: -5,
    bottom: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  namaSumber: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  ketSumber: {
    marginTop: 3,
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  hasil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sampul: {
    width: 105,
    height: 70,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pilVideo: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    paddingLeft: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Media.pil,
  },
  judulHasil: {
    fontFamily: Fonts.judul,
    fontSize: 16,
    lineHeight: 20,
  },
  ketHasil: {
    marginTop: 5,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  lainnya: {
    paddingVertical: 6,
    paddingLeft: 4,
  },
});
