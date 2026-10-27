import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TombolIkon } from '@/components/bilah-atas';
import { ruangBilahBawah } from '@/components/bilah-bawah';
import { LembarPilihan } from '@/components/lembar-pilihan';
import { Fonts, Media, Radius, TINTA, TULANG } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { bukaLaporan } from '@/lib/aksi-laporan';
import { posisiSekali } from '@/lib/lokasi-live';
import {
  jarakKm,
  jarakTeks,
  muatUmpan,
  sampulDari,
  tanggalSingkat,
  tempatPendek,
  urlGambar,
  useUmpan,
  type Berita,
} from '@/lib/umpan';

const INDONESIA = { latitude: -2.5, longitude: 118, latitudeDelta: 22, longitudeDelta: 42 };
const SEMUA = 'semua';
/** Lingkup "Dalam radius …" di lembar bawah — kira-kira selebar peta setelah tombol lokasiku. */
const RADIUS_KM = 50;
/** Lembar bawah menutupi sedikit tepi bawah peta, supaya sudut bulatnya berlatar peta. */
const TUMPANG = 32;

function regionDari(b: Pick<Berita, 'lat' | 'lng'>) {
  return { latitude: b.lat, longitude: b.lng, latitudeDelta: 2, longitudeDelta: 2 };
}

/**
 * Laporan berjarak kurang dari ~10 m berbagi satu penanda: dari penanda yang
 * bertumpuk hanya yang teratas bisa diketuk, dan memperbesar peta tidak memisahkannya.
 */
function kunciTitik(b: Berita): string {
  return `${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
}

/**
 * Tab Peta: kepala "Peta kejadian" dengan pemilih pulau, peta semua laporan di umpan,
 * tombol lokasiku, dan lembar bawah (di belakang bilah bawah yang melayang) berisi jumlah
 * kejadian serta satu laporan — yang dipilih di peta, atau yang terdekat/terbaru. Laporan
 * terpilih disimpan di parameter `id`, jadi tombol peta di kartu cukup membuka
 * /peta?id=… untuk menyorotnya. Dimuat malas oleh (tabs)/peta.tsx.
 */
export default function PetaLaporan() {
  const w = useTheme();
  const gelap = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { status, berita } = useUmpan();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const peta = useRef<MapView>(null);
  /** Kamera terakhir — dipulihkan bila peta Android dipasang ulang karena tema berganti. */
  const kamera = useRef<Region | null>(null);
  const pilih = berita.find((b) => String(b.id) === id) ?? null;
  // Laporan yang dibuka dari kartu langsung jadi region awal, tanpa menunggu peta siap.
  const [regionAwal] = useState(() => (pilih ? regionDari(pilih) : INDONESIA));
  /**
   * Laporan yang sudah ada di layar kamera: region awal, atau dipilih dari peta
   * (penanda, geser dalam satu titik). Kamera hanya terbang ke laporan lain.
   */
  const disorot = useRef<number | null>(pilih?.id ?? null);
  const [siap, setSiap] = useState(false);
  const [pulau, setPulau] = useState<string>(SEMUA);
  const [pilihPulau, setPilihPulau] = useState(false);
  const [acuan, setAcuan] = useState<{ lat: number; lng: number } | null>(null);
  const [mencariLokasi, setMencariLokasi] = useState(false);
  const [pesan, setPesan] = useState('');

  // Satu penanda per titik; di dalam titik urutannya mengikuti umpan (terbaru dulu).
  const titik = useMemo(() => {
    const m = new Map<string, Berita[]>();
    for (const b of berita) {
      const k = kunciTitik(b);
      const isi = m.get(k);
      if (isi) isi.push(b);
      else m.set(k, [b]);
    }
    return m;
  }, [berita]);
  const setitik = pilih ? (titik.get(kunciTitik(pilih)) ?? [pilih]) : [];
  const ke = pilih ? setitik.indexOf(pilih) : -1;

  // Pulau yang benar-benar ada di umpan, terbanyak dulu.
  const pilihanPulau = useMemo(() => {
    const hitung = new Map<string, number>();
    for (const b of berita) if (b.pulau) hitung.set(b.pulau, (hitung.get(b.pulau) ?? 0) + 1);
    return [
      { nilai: SEMUA, label: 'Seluruh Indonesia', keterangan: `${berita.length} laporan` },
      ...[...hitung.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([p, n]) => ({ nilai: p, label: p, keterangan: `${n} laporan` })),
    ];
  }, [berita]);

  const terlihat = useMemo(() => (pulau === SEMUA ? berita : berita.filter((b) => b.pulau === pulau)), [berita, pulau]);
  const terdekat = useMemo(() => {
    if (!acuan) return null;
    let dekat: Berita | null = null;
    let min = Infinity;
    for (const b of terlihat) {
      const km = jarakKm(acuan, b);
      if (km < min) {
        dekat = b;
        min = km;
      }
    }
    return dekat;
  }, [terlihat, acuan]);
  // Di lembar: laporan yang dipilih, atau yang terdekat bila lokasi diketahui, atau yang terbaru.
  const sorotan = pilih ?? terdekat ?? terlihat[0] ?? null;

  // Tanpa saringan pulau dan dengan lokasi: hanya kejadian di sekitar warga yang dihitung.
  const dalamRadius = acuan !== null && pulau === SEMUA;
  const jumlah = dalamRadius ? terlihat.filter((b) => jarakKm(acuan, b) <= RADIUS_KM).length : terlihat.length;
  const lingkup = dalamRadius
    ? `Dalam radius ${RADIUS_KM} km`
    : pulau === SEMUA
      ? 'Seluruh Indonesia'
      : `Dari ${berita.length} di seluruh Indonesia`;

  // Izin lokasi yang sudah diberikan langsung dipakai untuk jarak & laporan terdekat.
  // Izin baru hanya diminta saat warga menekan tombol lokasiku.
  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        if (!(await Location.getForegroundPermissionsAsync()).granted) return;
        const p = await posisiSekali();
        if (p && !batal) setAcuan((a) => a ?? { lat: p.lat, lng: p.lng });
      } catch {
        // Lokasi tidak didapat: lembar tetap menghitung seluruh Indonesia.
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(''), 2400);
    return () => clearTimeout(t);
  }, [pesan]);

  // Perintah kamera sebelum peta siap dibuang diam-diam di Android. Umpan yang dimuat
  // ulang mengganti objek `pilih`, tetapi laporan yang sama tidak menggerakkan kamera lagi.
  useEffect(() => {
    if (!siap || !pilih || disorot.current === pilih.id) return;
    disorot.current = pilih.id;
    // Dibuka dari kartu (lihatDiPeta) saat peta disaring ke pulau lain: saringan dilepas.
    setPulau((p) => (p === SEMUA || p === pilih.pulau ? p : SEMUA));
    peta.current?.animateToRegion(regionDari(pilih), 600);
  }, [siap, pilih]);

  function pilihDariPeta(b: Berita) {
    disorot.current = b.id;
    // Penanda redup (pulau lain) diketuk: jumlah di lembar ikut kembali ke seluruh Indonesia.
    if (pulau !== SEMUA && b.pulau !== pulau) setPulau(SEMUA);
    router.setParams({ id: String(b.id) });
  }

  /** Laporan lain di titik yang sama, berputar. */
  function geser(arah: 1 | -1) {
    pilihDariPeta(setitik[(ke + arah + setitik.length) % setitik.length]);
  }

  function saringPulau(p: string) {
    setPulau(p);
    // Laporan terpilih di pulau lain tidak lagi cocok dengan jumlah di lembar.
    if (pilih && p !== SEMUA && pilih.pulau !== p) router.setParams({ id: undefined });
    const isi = p === SEMUA ? berita : berita.filter((b) => b.pulau === p);
    if (isi.length === 0) return;
    peta.current?.fitToCoordinates(
      isi.map((b) => ({ latitude: b.lat, longitude: b.lng })),
      // Atas memberi ruang untuk tinggi penanda; bawah sudah ditambah mapPadding (lembar).
      { edgePadding: { top: 72, right: 44, bottom: 44, left: 44 }, animated: true },
    );
  }

  async function keLokasiku() {
    if (mencariLokasi) return;
    setMencariLokasi(true);
    const p = await posisiSekali();
    setMencariLokasi(false);
    if (!p) return setPesan('Lokasi tidak tersedia. Izinkan lokasi untuk melihat jarak kejadian.');
    setAcuan({ lat: p.lat, lng: p.lng });
    peta.current?.animateToRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: 1.2, longitudeDelta: 1.2 }, 600);
  }

  const kosongMemuat = berita.length === 0 && status === 'memuat';
  const kosongGalat = berita.length === 0 && status === 'galat';

  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      {/* .map-header: di atas peta, bukan melayang di atasnya. */}
      <View style={[styles.kepala, { paddingTop: insets.top + 12 }]}>
        <View style={styles.fleks}>
          <Text style={[styles.eyebrow, { color: w.textSecondary }]}>PETA KEJADIAN</Text>
          <Text style={[styles.h1, { color: w.text }]} numberOfLines={1}>
            {pulau === SEMUA ? 'Di sekitar Anda' : pulau}
          </Text>
        </View>
        {(pilihanPulau.length > 2 || pulau !== SEMUA) && (
          <TombolIkon ikon="layers" label="Pilih pulau" onPress={() => setPilihPulau(true)} />
        )}
      </View>

      <View style={styles.wadahPeta}>
        <MapView
          ref={peta}
          // Peta gelap di mode gelap. Android hanya membaca userInterfaceStyle saat peta dibuat,
          // jadi tema yang berganti memasang ulang petanya (kameranya dipulihkan di onMapReady).
          key={Platform.OS === 'android' ? (gelap ? 'gelap' : 'terang') : undefined}
          userInterfaceStyle={gelap ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          initialRegion={regionAwal}
          // Logo Google/Apple & pusat kamera tidak tertutup lembar bawah.
          mapPadding={{ top: 0, right: 0, bottom: TUMPANG, left: 0 }}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          onMapReady={() => {
            if (kamera.current) peta.current?.animateToRegion(kamera.current, 0);
            setSiap(true);
          }}
          onRegionChangeComplete={(r) => {
            kamera.current = r;
          }}
          onPress={(e) => {
            // iOS ikut memanggil onPress peta saat penanda diketuk.
            if (e.nativeEvent.action !== 'marker-press') router.setParams({ id: undefined });
          }}>
          {[...titik.values()].map((isi) => {
            const dipilih = pilih !== null && isi.includes(pilih);
            const redup = pulau !== SEMUA && isi[0].pulau !== pulau;
            const ukuran = dipilih ? PIN_DIPILIH : PIN;
            return (
              <Marker
                // Kunci ikut status pilih: penanda kustom dengan tracksViewChanges={false} hanya digambar ulang saat dipasang ulang.
                key={`${isi[0].id}-${dipilih ? 1 : 0}-${redup ? 1 : 0}`}
                coordinate={{ latitude: isi[0].lat, longitude: isi[0].lng }}
                // Ujung tetes tepat di titik kejadian: anchor untuk Google Maps, centerOffset untuk Apple Maps.
                anchor={{ x: 0.5, y: (RUANG_PIN + ukuran / 2 + ujungPin(ukuran)) / (ukuran + 2 * RUANG_PIN) }}
                centerOffset={{ x: 0, y: -ujungPin(ukuran) }}
                tracksViewChanges={false}
                zIndex={dipilih ? 2 : redup ? 0 : 1}
                // Mengetuk lagi titik yang sedang dibuka tidak mengembalikan kartu ke laporan pertama.
                onPress={() => pilihDariPeta(dipilih && pilih ? pilih : isi[0])}>
                <Pin jumlah={isi.length} ukuran={ukuran} dipilih={dipilih} redup={redup} />
              </Marker>
            );
          })}
        </MapView>

        {pesan !== '' && (
          <View style={styles.pesan} pointerEvents="none">
            <Text style={styles.teksPesan}>{pesan}</Text>
          </View>
        )}

        {/* .locate-button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lokasiku"
          onPress={() => void keLokasiku()}
          style={({ pressed }) => [styles.lokasiku, { backgroundColor: pressed ? w.surface : w.background, borderColor: w.border }]}>
          {mencariLokasi ? <ActivityIndicator color={w.text} /> : <Feather name="crosshair" size={20} color={w.text} />}
        </Pressable>
      </View>

      {/* Lembar bawah: isinya berhenti di atas bilah bawah yang melayang. */}
      <View style={[styles.lembar, { backgroundColor: w.background, paddingBottom: ruangBilahBawah(insets.bottom) }]}>
        <View style={[styles.pegangan, { backgroundColor: w.borderStrong }]} />
        <View style={styles.kepalaLembar}>
          {kosongMemuat ? (
            <View style={[styles.fleks, styles.barisMemuat]}>
              <ActivityIndicator color={w.accentText} size="small" />
              <Text style={[styles.judulLembar, { color: w.text }]}>Memuat laporan</Text>
            </View>
          ) : (
            <View style={styles.fleks}>
              <Text style={[styles.judulLembar, { color: w.text }]}>
                {kosongGalat ? 'Laporan gagal dimuat' : jumlah === 0 ? 'Tidak ada kejadian' : `${jumlah} kejadian`}
              </Text>
              <Text style={[styles.lingkup, { color: w.textSecondary }]}>
                {(kosongGalat ? 'Periksa koneksi internet' : lingkup).toUpperCase()}
              </Text>
            </View>
          )}
          {kosongGalat ? (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => void muatUmpan()}>
              <Text style={[styles.tautan, { color: w.accentText }]}>COBA LAGI</Text>
            </Pressable>
          ) : (
            !kosongMemuat && (
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                // Disaring per pulau: Pencarian langsung menampilkan laporan pulau itu.
                onPress={() => router.push(pulau === SEMUA ? '/cari' : { pathname: '/cari', params: { q: pulau } })}
                style={styles.tautanAbu}>
                {/* Mono abu dengan panah, seperti "Lihat semua" di judul bagian. */}
                <Text style={[styles.teksTautanAbu, { color: w.textSecondary }]}>LIHAT SEMUA</Text>
                <Feather name="chevron-right" size={14} color={w.textSecondary} />
              </Pressable>
            )
          )}
        </View>

        {sorotan && (
          <BarisKejadian
            berita={sorotan}
            acuan={acuan}
            // Beberapa laporan di titik terpilih: bisa digeser tanpa menutup lembar.
            urutan={sorotan === pilih && setitik.length > 1 ? { ke, dari: setitik.length, geser } : null}
          />
        )}
      </View>

      <LembarPilihan
        terbuka={pilihPulau}
        judul="Tampilkan kejadian di"
        pilihan={pilihanPulau}
        dipilih={pulau}
        onPilih={saringPulau}
        onTutup={() => setPilihPulau(false)}
      />
    </View>
  );
}

/** Satu laporan di lembar bawah: sampul, judul, tempat · jarak, tanggal. */
function BarisKejadian({
  berita: b,
  acuan,
  urutan,
}: {
  berita: Berita;
  acuan: { lat: number; lng: number } | null;
  urutan: { ke: number; dari: number; geser: (arah: 1 | -1) => void } | null;
}) {
  const w = useTheme();
  const sampul = sampulDari(b);
  const tempat = [tempatPendek(b) || b.pulau, acuan && jarakTeks(jarakKm(acuan, b))].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[b.judul, tempat].filter(Boolean).join(', ')}
      onPress={() => bukaLaporan(b.id)}
      style={({ pressed }) => [styles.baris, { backgroundColor: w.surface, borderColor: w.border }, pressed && styles.ditekan]}>
      <View style={[styles.sampul, { backgroundColor: w.surfaceMuted }]}>
        {sampul ? (
          <Image source={{ uri: urlGambar(sampul, 256) }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={sampul} />
        ) : (
          <Ionicons name="flame-outline" size={20} color={w.textSecondary} />
        )}
      </View>
      <View style={styles.fleks}>
        <Text style={[styles.judulBaris, { color: w.text }]} numberOfLines={2}>
          {b.judul}
        </Text>
        <Text style={[styles.ketBaris, { color: w.textSecondary }]} numberOfLines={1}>
          {[tempat, tanggalSingkat(b.tanggal)].filter(Boolean).join(' · ').toUpperCase()}
        </Text>
      </View>
      {urutan ? (
        <View style={[styles.geser, { backgroundColor: w.background, borderColor: w.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Laporan sebelumnya di titik ini" hitSlop={10} onPress={() => urutan.geser(-1)}>
            <Feather name="chevron-left" size={16} color={w.accentText} />
          </Pressable>
          <Text style={[styles.teksGeser, { color: w.accentText }]}>
            {urutan.ke + 1}/{urutan.dari}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Laporan berikutnya di titik ini" hitSlop={10} onPress={() => urutan.geser(1)}>
            <Feather name="chevron-right" size={16} color={w.accentText} />
          </Pressable>
        </View>
      ) : (
        <Feather name="chevron-right" size={19} color={w.textSecondary} />
      )}
    </Pressable>
  );
}

/** Sisi penanda (.map-pin) dan yang terpilih. */
const PIN = 40;
const PIN_DIPILIH = 48;
/**
 * Ruang di sekeliling penanda untuk sudut yang diputar, cincin terpilih, dan bayangan:
 * Android memotong penanda di batas view-nya.
 */
const RUANG_PIN = 16;

/** Jarak ujung tetes dari pusat penanda — kotak diputar −45°, sudut lancipnya berjari-jari 3. */
function ujungPin(ukuran: number): number {
  return ukuran / Math.SQRT2 - 1;
}

/** Penanda tetes sinyal berbingkai tulang: ikon api tinta, angka bila beberapa laporan di satu titik. */
function Pin({ jumlah, ukuran, dipilih, redup }: { jumlah: number; ukuran: number; dipilih: boolean; redup: boolean }) {
  const w = useTheme();
  return (
    <View style={[styles.wadahPin, redup && styles.redup]}>
      <View style={[styles.pin, { width: ukuran, height: ukuran, backgroundColor: w.accent }, dipilih && styles.pinDipilih]}>
        <View style={styles.isiPin}>
          <Ionicons name="flame" size={dipilih ? 20 : 17} color={TINTA} />
          {jumlah > 1 && <Text style={styles.angkaPin}>{jumlah}</Text>}
        </View>
      </View>
    </View>
  );
}

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
  kepala: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 20,
    paddingRight: 12,
    paddingBottom: 14,
  },
  eyebrow: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  h1: {
    marginTop: 6,
    fontFamily: Fonts.judulTebal,
    fontSize: 25,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  wadahPeta: {
    flex: 1,
    // Peta berlanjut di bawah sudut bulat lembar.
    marginBottom: -TUMPANG,
  },
  pesan: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.medium,
    // Di atas peta (media): kaca gelap di kedua tema.
    backgroundColor: Media.kacaTebal,
  },
  teksPesan: {
    color: Media.teks,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    textAlign: 'center',
  },
  lokasiku: {
    position: 'absolute',
    right: 16,
    bottom: TUMPANG + 16,
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
  },
  // Lembar bersudut 32 seperti lembar komentar di desain, bayangan ke atas.
  lembar: {
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    boxShadow: '0 -10px 30px rgba(0,0,0,0.22)',
  },
  pegangan: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    marginBottom: 12,
  },
  kepalaLembar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barisMemuat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
  },
  judulLembar: {
    fontFamily: Fonts.judulTebal,
    fontSize: 21,
    lineHeight: 26,
  },
  lingkup: {
    marginTop: 4,
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  tautan: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  tautanAbu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  teksTautanAbu: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  baris: {
    marginTop: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
  },
  sampul: {
    width: 92,
    height: 64,
    borderRadius: 13,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  judulBaris: {
    fontFamily: Fonts.judul,
    fontSize: 15,
    lineHeight: 18,
  },
  ketBaris: {
    marginTop: 4,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  geser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  teksGeser: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
  },
  wadahPin: {
    padding: RUANG_PIN,
  },
  redup: {
    opacity: 0.35,
  },
  pin: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 3,
    // Bingkai tulang di kedua tema: penanda tetap terpisah dari peta.
    borderWidth: 3,
    borderColor: TULANG,
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
  },
  // Cincin sinyal pudar di sekeliling penanda terpilih.
  pinDipilih: {
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    borderBottomRightRadius: 17,
    boxShadow: '0 0 0 6px rgba(255,74,28,0.25), 0 4px 10px rgba(0,0,0,0.3)',
  },
  isiPin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    transform: [{ rotate: '45deg' }],
  },
  angkaPin: {
    color: TINTA,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
  },
});
