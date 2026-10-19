import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Media, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { posisiSekali } from '@/lib/lokasi-live';
import { hitunganTeks, jarakKm, jarakTeks, LEBAR_LAYAR_PX, muatUmpan, urlGambar, useUmpan, type Berita } from '@/lib/umpan';

type Urutan = 'terbaru' | 'terdekat' | 'video' | 'disukai';

const URUTAN: { id: Urutan; label: string }[] = [
  { id: 'terbaru', label: 'Terbaru' },
  { id: 'terdekat', label: 'Terdekat' },
  { id: 'video', label: 'Video' },
  { id: 'disukai', label: 'Paling disukai' },
];

/** Latar lingkaran pulau, bergiliran seperti .ring-1…4 di desain. */
const LATAR_CINCIN = ['#dfecef', '#f1e6dc', '#ece7d9', '#e2eadc'];

function sampulDari(b: Berita): string | undefined {
  const m = b.media[0];
  return m?.jenis === 'video' ? m.poster : m?.url;
}

function bukaDiBeranda(id: number) {
  router.navigate({ pathname: '/', params: { laporan: String(id) } });
}

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

function JarakBaris() {
  return <View style={styles.jarakBaris} />;
}

/**
 * Jelajah ("Explore" di desain): cari, saring per pulau, sorotan kejadian
 * terbaru, dan grid laporan. Datanya umpan yang sama dengan beranda; mengetuk
 * laporan membukanya di beranda.
 */
export default function LayarJelajah() {
  const w = useTheme();
  const gelap = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { status, berita, diambil } = useUmpan();
  const [cari, setCari] = useState('');
  const [pulau, setPulau] = useState<string | null>(null);
  const [urutan, setUrutan] = useState<Urutan>('terbaru');
  /** Chip yang terakhir diketuk: lokasi yang datang terlambat tidak boleh menimpa pilihan sesudahnya. */
  const urutanDiminta = useRef<Urutan>('terbaru');
  const [acuan, setAcuan] = useState<{ lat: number; lng: number } | null>(null);
  const [mencariLokasi, setMencariLokasi] = useState(false);
  const [galatLokasi, setGalatLokasi] = useState('');
  const [menyegarkan, setMenyegarkan] = useState(false);
  /** `diambil` umpan saat tarik-segarkan gagal: pesannya hilang sendiri begitu umpan berhasil dimuat ulang. */
  const [gagalSegar, setGagalSegar] = useState<number | null>(null);

  // Pulau yang benar-benar ada di umpan, terbanyak dulu.
  const hitungPulau = new Map<string, number>();
  for (const b of berita) if (b.pulau) hitungPulau.set(b.pulau, (hitungPulau.get(b.pulau) ?? 0) + 1);
  const daftarPulau = [...hitungPulau.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);

  // Pulau ikut dicari: label cincin bisa tidak tertulis di lokasi/provinsi (mis. "DKI Jakarta").
  const teksCari = new Map(
    berita.map((b) => [b.id, normalkan([b.judul, b.lokasi, b.provinsi, b.pulau, b.deskripsi].filter(Boolean).join('\n'))]),
  );
  const kata = normalkan(cari.trim());
  let hasil = berita.filter(
    (b) => (!pulau || b.pulau === pulau) && (!kata || (teksCari.get(b.id) ?? '').includes(kata)),
  );
  if (urutan === 'video') hasil = hasil.filter((b) => b.media.some((m) => m.jenis === 'video'));
  if (urutan === 'disukai') hasil = [...hasil].sort((a, b) => b.jumlahSuka - a.jumlahSuka);
  if (urutan === 'terdekat' && acuan) hasil = [...hasil].sort((a, b) => jarakKm(acuan, a) - jarakKm(acuan, b));
  const sorotan = berita[0];

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

  async function segarkan() {
    setMenyegarkan(true);
    const ok = await muatUmpan();
    setMenyegarkan(false);
    setGagalSegar(ok ? null : diambil);
  }

  // Elemen, bukan komponen: komponen yang dibuat ulang tiap render akan me-remount kolom cari
  // sehingga keyboard tertutup di setiap ketikan.
  const kepalaDaftar = (
    <>
      <View style={styles.kepala}>
        <View>
          <Text style={[styles.eyebrow, { color: w.textSecondary }]}>TELUSURI DENGAN AMAN</Text>
          <Text style={[styles.h1, { color: w.text }]}>Jelajah</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Peta laporan"
          onPress={() => router.push('/peta')}
          style={({ pressed }) => [styles.tombolKotak, { backgroundColor: pressed ? w.border : w.surfaceMuted }]}>
          <Ionicons name="map-outline" size={20} color={w.text} />
        </Pressable>
      </View>
      {gagalSegar === diambil && berita.length > 0 && (
        <Text style={[styles.catatan, { color: w.danger }]}>Gagal memperbarui. Periksa koneksi.</Text>
      )}

      <View style={[styles.cari, { backgroundColor: w.surface, borderColor: w.border }]}>
        <Ionicons name="search" size={20} color={w.textSecondary} />
        <TextInput
          value={cari}
          onChangeText={setCari}
          placeholder="Cari tempat, kejadian, atau laporan"
          placeholderTextColor={w.textSecondary}
          returnKeyType="search"
          style={[styles.inputCari, { color: w.text }]}
        />
        {cari !== '' && (
          <Pressable accessibilityLabel="Hapus pencarian" onPress={() => setCari('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={w.textSecondary} />
          </Pressable>
        )}
      </View>

      {daftarPulau.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barisCincin}>
          <Cincin
            label="Semua"
            ikon="earth-outline"
            latar={gelap ? w.surfaceMuted : '#e8ebe4'}
            aktif={pulau === null}
            onPress={() => setPulau(null)}
          />
          {daftarPulau.map((p, i) => (
            <Cincin
              key={p}
              label={p}
              ikon="flame-outline"
              latar={gelap ? w.surfaceMuted : LATAR_CINCIN[i % LATAR_CINCIN.length]}
              aktif={pulau === p}
              onPress={() => setPulau((x) => (x === p ? null : p))}
            />
          ))}
        </ScrollView>
      )}

      {sorotan && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Kejadian terbaru: ${sorotan.judul}`}
          onPress={() => bukaDiBeranda(sorotan.id)}
          style={styles.sorotan}>
          {sampulDari(sorotan) && (
            <Image
              source={{ uri: urlGambar(sampulDari(sorotan)!, LEBAR_LAYAR_PX) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}
          <View style={styles.bayangSorotan} />
          <View style={styles.labelSorotan}>
            <View style={styles.titikMerah} />
            <Text style={styles.teksLabelSorotan}>KEJADIAN TERBARU</Text>
          </View>
          <Text style={styles.judulSorotan} numberOfLines={2}>
            {sorotan.judul}
          </Text>
          <Text style={styles.metaSorotan} numberOfLines={1}>
            {[sorotan.provinsi, sorotan.tanggal].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.tombolSorotan}>
            <Text style={styles.teksTombolSorotan}>Tonton</Text>
            <Ionicons name="chevron-forward" size={14} color={Media.onLimau} />
          </View>
        </Pressable>
      )}

      <View style={styles.kepalaBagian}>
        <View>
          <Text style={[styles.eyebrow, { color: w.textSecondary }]}>LAPORAN WARGA</Text>
          <Text style={[styles.h2, { color: w.text }]}>Sedang terjadi</Text>
        </View>
        <Pressable onPress={() => router.push('/peta')} hitSlop={8}>
          <Text style={[styles.tautan, { color: w.accentText }]}>Lihat peta</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barisSaring}>
        {URUTAN.map((u) => {
          const pilih = urutan === u.id;
          return (
            <Pressable
              key={u.id}
              accessibilityRole="button"
              accessibilityState={{ selected: pilih }}
              onPress={() => void pilihUrutan(u.id)}
              style={[
                styles.chip,
                pilih
                  ? { backgroundColor: gelap ? w.accent : '#273129', borderColor: gelap ? w.accent : '#273129' }
                  : { backgroundColor: w.surface, borderColor: w.border },
              ]}>
              {u.id === 'terdekat' && mencariLokasi ? (
                <ActivityIndicator size="small" color={w.textSecondary} />
              ) : (
                <Text
                  style={[
                    styles.teksChip,
                    { color: pilih ? (gelap ? w.onAccent : '#fff') : w.textSecondary },
                  ]}>
                  {u.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      {galatLokasi !== '' && <Text style={[styles.catatan, { color: w.danger }]}>{galatLokasi}</Text>}
    </>
  );

  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      {/* Grid divirtualisasi: arsip terus bertambah, dan tiap kartu mengunduh sampulnya sendiri. */}
      <FlatList
        data={hasil}
        keyExtractor={(b) => String(b.id)}
        numColumns={2}
        renderItem={({ item: b }) => (
          <KartuGrid berita={b} jarak={urutan === 'terdekat' && acuan ? jarakKm(acuan, b) : null} />
        )}
        columnWrapperStyle={styles.barisGrid}
        ItemSeparatorComponent={JarakBaris}
        ListHeaderComponent={kepalaDaftar}
        ListEmptyComponent={
          status === 'memuat' && berita.length === 0 ? (
            <ActivityIndicator color={w.accentText} style={styles.pemuat} />
          ) : (
            <Text style={[styles.kosong, { color: w.textSecondary }]}>
              {status === 'galat' ? 'Gagal memuat laporan. Tarik ke bawah untuk mencoba lagi.' : 'Tidak ada laporan yang cocok.'}
            </Text>
          )
        }
        // Satuannya baris (2 kartu).
        initialNumToRender={4}
        windowSize={5}
        style={{ backgroundColor: w.background }}
        contentContainerStyle={[styles.isi, { paddingTop: insets.top + Spacing.three }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={menyegarkan} onRefresh={() => void segarkan()} tintColor={w.accentText} />}
      />
      {/* Latar status bar: konten yang digulir tidak boleh menimpa jam & baterai. */}
      <View style={[styles.latarStatus, { height: insets.top, backgroundColor: w.background }]} />
    </View>
  );
}

function Cincin({
  label,
  ikon,
  latar,
  aktif,
  onPress,
}: {
  label: string;
  ikon: ComponentProps<typeof Ionicons>['name'];
  latar: string;
  aktif: boolean;
  onPress: () => void;
}) {
  const w = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: aktif }}
      accessibilityLabel={`Saring ${label}`}
      onPress={onPress}
      style={styles.cincin}>
      <View
        style={[
          styles.lingkar,
          { backgroundColor: latar, borderColor: aktif ? w.accent : 'transparent' },
        ]}>
        <Ionicons name={ikon} size={22} color={aktif ? w.accentText : w.textSecondary} />
      </View>
      <Text style={[styles.labelCincin, { color: aktif ? w.text : w.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// Di-memo: daftar dirender ulang di setiap ketikan pencarian.
const KartuGrid = memo(function KartuGrid({ berita: b, jarak }: { berita: Berita; jarak: number | null }) {
  const w = useTheme();
  const sampul = sampulDari(b);
  const video = b.media.some((m) => m.jenis === 'video');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={b.judul}
      onPress={() => bukaDiBeranda(b.id)}
      style={({ pressed }) => [styles.kartuGrid, { backgroundColor: w.border }, pressed && styles.ditekan]}>
      {sampul && <Image source={{ uri: urlGambar(sampul, 384) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />}
      <View style={styles.bayangGrid} />
      <View style={styles.tagGrid}>
        <Ionicons name="checkmark" size={10} color={Media.onLimau} />
        <Text style={styles.teksTagGrid}>TERVERIFIKASI</Text>
      </View>
      {video && (
        <View style={styles.ikonVideo}>
          <Ionicons name="play" size={13} color="#fff" />
        </View>
      )}
      <View style={styles.bawahGrid}>
        <Text style={styles.judulGrid} numberOfLines={2}>
          {b.judul}
        </Text>
        <View style={styles.barisMetaGrid}>
          <Text style={[styles.metaGrid, styles.fleks]} numberOfLines={1}>
            {jarak !== null ? jarakTeks(jarak) : (b.provinsi ?? b.pulau ?? '')}
          </Text>
          {b.jumlahSuka > 0 && (
            <>
              <Ionicons name="heart" size={11} color="rgba(255,255,255,0.8)" />
              <Text style={styles.metaGrid}>{hitunganTeks(b.jumlahSuka)}</Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  fleks: {
    flexShrink: 1,
  },
  latarStatus: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  barisMetaGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  isi: {
    paddingHorizontal: 17,
    paddingBottom: Spacing.five,
  },
  kepala: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 17,
  },
  eyebrow: {
    fontFamily: Fonts.judulTebal,
    fontSize: 10.5,
    letterSpacing: 1.5,
  },
  h1: {
    marginTop: 3,
    fontFamily: Fonts.judulTebal,
    fontSize: 30,
    letterSpacing: -1.1,
  },
  h2: {
    marginTop: 3,
    fontFamily: Fonts.judulTebal,
    fontSize: 21,
    letterSpacing: -0.6,
  },
  tombolKotak: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cari: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 13,
  },
  inputCari: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.regular,
    fontSize: 14.5,
  },
  barisCincin: {
    gap: 6,
    paddingVertical: 18,
  },
  cincin: {
    width: 70,
    alignItems: 'center',
    gap: 6,
  },
  lingkar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelCincin: {
    fontFamily: Fonts.medium,
    fontSize: 11.5,
  },
  sorotan: {
    minHeight: 150,
    padding: 17,
    borderRadius: 17,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#2a1b16',
    boxShadow: '0 10px 25px rgba(61,44,29,0.15)',
  },
  bayangSorotan: {
    ...StyleSheet.absoluteFill,
    experimental_backgroundImage: 'linear-gradient(120deg, rgba(42,27,22,0.35), rgba(26,20,17,0.85))',
  },
  labelSorotan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titikMerah: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#f35e4d',
    boxShadow: '0 0 0 4px rgba(243,94,77,0.2)',
  },
  teksLabelSorotan: {
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 10,
    letterSpacing: 1.3,
  },
  judulSorotan: {
    marginTop: 9,
    marginRight: 90,
    color: '#fff',
    fontFamily: Fonts.judul,
    fontSize: 18,
    lineHeight: 23,
  },
  metaSorotan: {
    marginTop: 3,
    marginRight: 90,
    color: 'rgba(255,255,255,0.72)',
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
  tombolSorotan: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Media.limau,
  },
  teksTombolSorotan: {
    color: Media.onLimau,
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  kepalaBagian: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  tautan: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    padding: 4,
  },
  barisSaring: {
    gap: 7,
    paddingVertical: 12,
  },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  teksChip: {
    fontFamily: Fonts.semibold,
    fontSize: 12.5,
  },
  catatan: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    marginBottom: Spacing.two,
  },
  pemuat: {
    marginTop: Spacing.five,
  },
  kosong: {
    marginTop: Spacing.five,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  barisGrid: {
    gap: 7,
  },
  jarakBaris: {
    height: 7,
  },
  kartuGrid: {
    width: '48.6%',
    height: 190,
    borderRadius: 13,
    overflow: 'hidden',
  },
  ditekan: {
    opacity: 0.85,
  },
  bayangGrid: {
    ...StyleSheet.absoluteFill,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.82) 100%)',
  },
  tagGrid: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: Media.limau,
  },
  teksTagGrid: {
    color: Media.onLimau,
    fontFamily: Fonts.judulTebal,
    fontSize: 8.5,
    letterSpacing: 0.7,
  },
  ikonVideo: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  bawahGrid: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },
  judulGrid: {
    color: '#fff',
    fontFamily: Fonts.judul,
    fontSize: 13.5,
    lineHeight: 17,
  },
  metaGrid: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: Fonts.regular,
    fontSize: 11,
  },
});
