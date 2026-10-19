import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useIsFocused, useLocalSearchParams, useScrollToTop } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tombol } from '@/components/tombol';
import { KartuLive } from '@/components/umpan/kartu-live';
import { KartuUmpan } from '@/components/umpan/kartu-umpan';
import { Colors, Media, Radius, Spacing } from '@/constants/theme';
import { muatSiaranPublik, useSiaranPublik, type SiaranPublik } from '@/lib/live';
import { tampilkanMenu } from '@/lib/menu-aksi';
import { posisiSekali } from '@/lib/lokasi-live';
import { jarakKm, muatUmpan, useUmpan, type Berita } from '@/lib/umpan';

type Urutan = 'terbaru' | 'terdekat';

/** Siaran langsung warga tampil di atas umpan, sebelum laporan. */
type ItemBeranda = { jenis: 'live'; siaran: SiaranPublik } | { jenis: 'laporan'; berita: Berita };

/** Kunci kartu di daftar — juga untuk mengingat kartu yang sedang ditonton. */
function kunciItem(x: ItemBeranda): string {
  return x.jenis === 'live' ? `live-${x.siaran.ruang}` : String(x.berita.id);
}

/**
 * Kartu dianggap ditonton setelah hampir seluruhnya terlihat, yaitu di ujung
 * geseran. Pemutar video baru dibuat/diputar setelah itu, bukan di tengah
 * animasi, supaya geseran tidak tersendat.
 */
const ATURAN_TERLIHAT = { itemVisiblePercentThreshold: 90 };

/**
 * Beranda: laporan karhutla selayar penuh, digeser ke atas/bawah seperti
 * aplikasi video pendek. Isinya sama dengan daftar di beranda situs.
 */
export default function LayarBeranda() {
  const insets = useSafeAreaInsets();
  const fokus = useIsFocused();
  const { status, berita } = useUmpan();
  const { laporan } = useLocalSearchParams<{ laporan?: string }>();
  const [ukuran, setUkuran] = useState<{ lebar: number; tinggi: number } | null>(null);
  // Kartu yang ditonton diingat dengan kuncinya: bila umpan berganti sendiri (laporan atau
  // siaran baru di atas, kembali dari latar belakang), kartu itu tetap di layar walau
  // posisinya bergeser. kunci null = ikuti posisi saja (awal, tarik-segarkan, ganti urutan).
  const [ditonton, setDitonton] = useState<{ kunci: string | null; indeks: number }>({ kunci: null, indeks: 0 });
  /** Indeks kartu yang sedang tampil di FlatList. */
  const indeksTampil = useRef(0);
  const [urutan, setUrutan] = useState<Urutan>('terbaru');
  const [acuan, setAcuan] = useState<{ lat: number; lng: number } | null>(null);
  const [mencariLokasi, setMencariLokasi] = useState(false);
  const [bisu, setBisu] = useState(false);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [pesan, setPesan] = useState('');
  const [sedangZoom, setSedangZoom] = useState(false);
  // Mode bersih ala TikTok: hanya media yang tampil, tetap bisa digeser ke laporan lain.
  const [bersih, setBersih] = useState(false);
  const bersihSekarang = useRef(false);
  const tampak = useSharedValue(1);
  const gayaAtas = useAnimatedStyle(() => ({ opacity: tampak.value }));
  const gayaKeluar = useAnimatedStyle(() => ({ opacity: 1 - tampak.value }));
  const daftar = useRef<FlatList<ItemBeranda>>(null);
  const siaranPublik = useSiaranPublik(fokus);
  // Siaran yang usai saat kartunya sedang ditonton tetap di umpan dengan tulisan "Siaran
  // sudah berakhir" sampai warga menggeser; siaran lain langsung mengikuti daftar terbaru.
  const [siaranLalu, setSiaranLalu] = useState(siaranPublik);
  const [liveUsai, setLiveUsai] = useState<{ siaran: SiaranPublik; indeks: number } | null>(null);
  if (siaranLalu !== siaranPublik) {
    setSiaranLalu(siaranPublik);
    const i = siaranLalu.findIndex((s) => `live-${s.ruang}` === ditonton.kunci);
    if (i >= 0 && !siaranPublik.some((s) => s.ruang === siaranLalu[i].ruang)) setLiveUsai({ siaran: siaranLalu[i], indeks: i });
  }
  if (liveUsai && ditonton.kunci !== `live-${liveUsai.siaran.ruang}`) setLiveUsai(null);
  const liveDiUmpan = useMemo(() => {
    if (!liveUsai || siaranPublik.some((s) => s.ruang === liveUsai.siaran.ruang)) return siaranPublik;
    const d = [...siaranPublik];
    d.splice(Math.min(liveUsai.indeks, d.length), 0, liveUsai.siaran);
    return d;
  }, [siaranPublik, liveUsai]);
  // Menekan tab Beranda lagi = kembali ke laporan teratas.
  useScrollToTop(daftar);

  // Titik acuan dikunci saat "Terdekat" dipilih, supaya urutan tidak berubah sendiri saat warga berjalan.
  const urut = useMemo(
    () => (urutan === 'terdekat' && acuan ? [...berita].sort((a, b) => jarakKm(acuan, a) - jarakKm(acuan, b)) : berita),
    [urutan, acuan, berita],
  );
  const atas = insets.top + 44;
  const daftarItem = useMemo<ItemBeranda[]>(
    () => [
      ...liveDiUmpan.map((siaran) => ({ jenis: 'live' as const, siaran })),
      ...urut.map((b) => ({ jenis: 'laporan' as const, berita: b })),
    ],
    [liveDiUmpan, urut],
  );
  const iDitonton = ditonton.kunci === null ? -1 : daftarItem.findIndex((x) => kunciItem(x) === ditonton.kunci);
  // Kartu yang ditonton hilang dari umpan: tetap di posisi yang sama.
  const aktif = iDitonton >= 0 ? iDitonton : Math.min(ditonton.indeks, Math.max(0, daftarItem.length - 1));

  // Kartu teratas terakhir yang dilihat warga. Kartu baru yang masuk di atasnya tidak
  // menggeser layar (lihat di bawah), jadi diberitahukan lewat pil yang membawa ke atas.
  const kunciAtas = daftarItem[0] ? kunciItem(daftarItem[0]) : null;
  const [atasDilihat, setAtasDilihat] = useState(kunciAtas);
  if (aktif === 0 && atasDilihat !== kunciAtas) setAtasDilihat(kunciAtas);
  const iAtasDilihat = atasDilihat === null ? -1 : daftarItem.findIndex((x) => kunciItem(x) === atasDilihat);
  const pil =
    aktif > 0 && iAtasDilihat > 0
      ? daftarItem.slice(0, iAtasDilihat).some((x) => x.jenis === 'live')
        ? 'LIVE baru'
        : 'Laporan baru'
      : null;

  // Umpan berganti sendiri: gulir ke posisi baru kartu yang sedang ditonton supaya layar
  // tidak meloncat ke kartu lain (dan video laporan yang ditonton tidak berhenti).
  useLayoutEffect(() => {
    if (aktif === indeksTampil.current) return;
    indeksTampil.current = aktif;
    daftar.current?.scrollToIndex({ index: aktif, animated: false });
  }, [aktif, daftarItem]);

  const gantiBisu = useCallback(() => setBisu((x) => !x), []);

  // Stabil (tanpa dependensi state) supaya kartu umpan yang di-memo tidak ikut render ulang.
  const gantiBersih = useCallback(() => {
    const baru = !bersihSekarang.current;
    bersihSekarang.current = baru;
    setBersih(baru);
    setPesan(baru ? 'Mode bersih · tekan lama lagi untuk keluar' : '');
    tampak.set(withTiming(baru ? 0 : 1, { duration: 160 }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [tampak]);

  // Tekan lama ala TikTok: menu Mode bersih & Laporkan. Di mode bersih langsung keluar.
  const menuKartu = useCallback(
    (b: Berita) => {
      if (bersihSekarang.current) return gantiBersih();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      tampilkanMenu(b.judul, [
        { label: 'Mode bersih', aksi: gantiBersih },
        {
          label: 'Laporkan',
          merusak: true,
          aksi: () => router.push({ pathname: '/laporkan', params: { jenis: 'laporan', id: String(b.id), ringkas: b.judul } }),
        },
      ]);
    },
    [gantiBersih],
  );

  const saatTerlihat = useCallback(({ viewableItems }: { viewableItems: ViewToken<ItemBeranda>[] }) => {
    const v = viewableItems[0];
    if (v?.index == null) return;
    const indeks = v.index;
    // Indeks sama tetapi kartunya lain = umpan berganti di bawah layar, bukan digeser warga:
    // kartu yang ditonton tetap, efek di atas menggulir ke posisi barunya.
    const diam = indeks === indeksTampil.current;
    indeksTampil.current = indeks;
    setDitonton((d) => (diam && d.kunci !== null ? d : { kunci: kunciItem(v.item), indeks }));
  }, []);

  /** Lupakan kartu yang ditonton: kartu teratas (yang baru) boleh menggantikannya. */
  function ikutiAtas() {
    indeksTampil.current = 0;
    setDitonton({ kunci: null, indeks: 0 });
  }

  useEffect(() => {
    if (!pesan) return;
    const id = setTimeout(() => setPesan(''), 2400);
    return () => clearTimeout(id);
  }, [pesan]);

  // Dari peta/Laporanku, "Tonton" membuka beranda tepat di laporan itu. Laporan yang baru
  // tayang bisa belum ada di umpan yang termuat: umpan diambil ulang sekali sebelum menyerah.
  const laporanDicari = useRef<string | null>(null);
  useEffect(() => {
    if (!laporan || !ukuran || status === 'memuat') return;
    const i = daftarItem.findIndex((x) => x.jenis === 'laporan' && String(x.berita.id) === laporan);
    if (i >= 0) {
      laporanDicari.current = null;
      daftar.current?.scrollToIndex({ index: i, animated: false });
      router.setParams({ laporan: undefined });
      return;
    }
    if (laporanDicari.current === laporan) return;
    laporanDicari.current = laporan;
    void muatUmpan().then((ok) => {
      // Sudah ketemu: efek ini jalan lagi begitu umpan baru masuk dan menggulir ke sana.
      if (laporanDicari.current !== laporan) return;
      laporanDicari.current = null;
      setPesan(ok ? 'Laporan ini belum muncul di beranda. Coba lagi sebentar lagi.' : 'Gagal memperbarui. Periksa koneksi.');
      router.setParams({ laporan: undefined });
    });
  }, [laporan, ukuran, status, daftarItem]);

  async function pilihUrutan(u: Urutan) {
    if (u === urutan || mencariLokasi) return;
    // Posisi diambil lagi setiap kali "Terdekat" dipilih: warga bisa sudah berpindah jauh.
    // posisiSekali memakai posisi yang masih baru bila ada, jadi biasanya langsung.
    if (u === 'terdekat') {
      setMencariLokasi(true);
      const p = await posisiSekali();
      setMencariLokasi(false);
      if (!p) return setPesan('Lokasi tidak tersedia. Izinkan lokasi untuk melihat laporan terdekat.');
      setAcuan({ lat: p.lat, lng: p.lng });
    }
    setUrutan(u);
    ikutiAtas();
    daftar.current?.scrollToOffset({ offset: 0, animated: false });
  }

  async function segarkan() {
    // Tarik-segarkan (selalu dari kartu teratas) = lihat yang terbaru, bukan mempertahankan kartu lama.
    ikutiAtas();
    setMenyegarkan(true);
    // Siaran tidak ditunggu: daftarnya menyusul sendiri, dan putarannya tidak boleh tertahan siaran.
    void muatSiaranPublik();
    const ok = await muatUmpan();
    setMenyegarkan(false);
    if (!ok) setPesan('Gagal memperbarui. Periksa koneksi.');
  }

  let isi;
  if (ukuran && daftarItem.length > 0) {
    isi = (
      <FlatList
        ref={daftar}
        data={daftarItem}
        keyExtractor={kunciItem}
        renderItem={({ item, index }) =>
          item.jenis === 'live' ? (
            <KartuLive
              siaran={item.siaran}
              lebar={ukuran.lebar}
              tinggi={ukuran.tinggi}
              putar={fokus && index === aktif}
              berakhir={!siaranPublik.some((s) => s.ruang === item.siaran.ruang)}
              acuan={urutan === 'terdekat' ? acuan : null}
              atas={atas}
            />
          ) : (
            <KartuUmpan
              berita={item.berita}
              lebar={ukuran.lebar}
              tinggi={ukuran.tinggi}
              putar={fokus && index === aktif}
              siapkan={Math.abs(index - aktif) <= 1}
              bisu={bisu}
              onBisu={gantiBisu}
              acuan={urutan === 'terdekat' ? acuan : null}
              atas={atas}
              onPesan={setPesan}
              onZoom={setSedangZoom}
              bersih={bersih}
              onTekanLama={menuKartu}
            />
          )
        }
        getItemLayout={(_, index) => ({ length: ukuran.tinggi, offset: ukuran.tinggi * index, index })}
        // Satu geseran = satu kartu, seperti TikTok. Lebih ringan dan mantap di
        // Android daripada pagingEnabled, yang bisa melompati beberapa kartu.
        snapToInterval={ukuran.tinggi}
        scrollEnabled={!sedangZoom}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={saatTerlihat}
        viewabilityConfig={ATURAN_TERLIHAT}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={100}
        windowSize={5}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={menyegarkan}
            onRefresh={() => void segarkan()}
            tintColor="#fff"
            colors={[Colors.dark.accent]}
            progressViewOffset={atas}
          />
        }
      />
    );
  } else if (status === 'galat') {
    isi = (
      <View style={styles.tengah}>
        <Ionicons name="cloud-offline-outline" size={48} color="rgba(255,255,255,0.7)" />
        <Text style={styles.teksTengah}>Gagal memuat laporan. Periksa koneksi lalu coba lagi.</Text>
        <Tombol judul="Coba lagi" ikon="refresh" onPress={() => void muatUmpan()} />
      </View>
    );
  } else if (status === 'siap') {
    isi = (
      <View style={styles.tengah}>
        <Ionicons name="leaf-outline" size={48} color="rgba(255,255,255,0.7)" />
        <Text style={styles.teksTengah}>Belum ada laporan yang tayang.</Text>
        <Tombol judul="Muat ulang" ikon="refresh" onPress={() => void segarkan()} />
      </View>
    );
  } else {
    isi = (
      <View style={styles.tengah}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <View
      style={styles.layar}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setUkuran((u) => (u?.lebar === width && u.tinggi === height ? u : { lebar: width, tinggi: height }));
      }}>
      {fokus && <StatusBar style="light" />}
      {isi}

      <Animated.View
        style={[styles.atas, { paddingTop: insets.top + Spacing.two }, gayaAtas]}
        pointerEvents={bersih ? 'none' : 'box-none'}>
        {/* Seperti TikTok: LIVE di kiri atas, (pencarian →) peta di kanan atas. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Siaran langsung ke petugas"
          onPress={() => router.push('/live')}
          hitSlop={10}
          style={[styles.ikonAtas, styles.ikonKiri, { top: insets.top + 2 }]}>
          <Ionicons name="radio-outline" size={22} color="#fff" />
          <Text style={styles.ikonAtasTeks}>LIVE</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Peta laporan"
          onPress={() => router.push('/peta')}
          hitSlop={10}
          style={[styles.ikonAtas, styles.ikonKanan, { top: insets.top + 2 }]}>
          <Ionicons name="map-outline" size={22} color="#fff" />
        </Pressable>
        {(['terbaru', 'terdekat'] as const).map((u) => (
          <Pressable
            key={u}
            accessibilityRole="tab"
            accessibilityState={{ selected: urutan === u }}
            onPress={() => void pilihUrutan(u)}
            hitSlop={8}
            style={styles.tabUrutan}>
            <Text style={[styles.tabTeks, urutan === u && styles.tabTeksAktif]}>
              {u === 'terbaru' ? 'Terbaru' : 'Terdekat'}
            </Text>
            <View style={[styles.garis, urutan !== u && styles.garisMati]} />
          </Pressable>
        ))}
        {mencariLokasi && <ActivityIndicator color="#fff" size="small" style={styles.pemuatLokasi} />}
      </Animated.View>

      {pil && !bersih && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${pil} di atas — ketuk untuk melihat`}
          onPress={() => daftar.current?.scrollToOffset({ offset: 0, animated: false })}
          hitSlop={8}
          style={[styles.pil, pil === 'LIVE baru' && styles.pilLive, { top: atas + Spacing.two }]}>
          <Ionicons name="arrow-up" size={14} color="#fff" />
          <Text style={styles.pilTeks}>{pil}</Text>
        </Pressable>
      )}

      <Animated.View
        style={[styles.keluarBersih, { top: insets.top + 2 }, gayaKeluar]}
        pointerEvents={bersih ? 'auto' : 'none'}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keluar dari mode bersih"
          onPress={gantiBersih}
          hitSlop={10}
          style={styles.tombolKeluarBersih}>
          <Ionicons name="contract-outline" size={20} color="#fff" />
        </Pressable>
      </Animated.View>

      {pesan !== '' && (
        <View style={styles.pesan} pointerEvents="none">
          <Text style={styles.pesanTeks}>{pesan}</Text>
        </View>
      )}
    </View>
  );
}

const bayangan = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

const styles = StyleSheet.create({
  layar: {
    flex: 1,
    backgroundColor: '#000',
  },
  tengah: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  teksTengah: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  atas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: Spacing.four,
  },
  tabUrutan: {
    alignItems: 'center',
    gap: 4,
  },
  tabTeks: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '700',
    ...bayangan,
  },
  tabTeksAktif: {
    color: '#fff',
    fontWeight: '800',
  },
  garis: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  garisMati: {
    opacity: 0,
  },
  ikonAtas: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  ikonKiri: {
    left: Spacing.three,
  },
  ikonKanan: {
    right: Spacing.three,
  },
  ikonAtasTeks: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    ...bayangan,
  },
  keluarBersih: {
    position: 'absolute',
    right: Spacing.three,
  },
  tombolKeluarBersih: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pemuatLokasi: {
    position: 'absolute',
    right: Spacing.five + Spacing.three,
    bottom: 6,
  },
  pil: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  pilLive: {
    backgroundColor: Media.merah,
  },
  pilTeks: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  pesan: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.medium,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  pesanTeks: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
});
