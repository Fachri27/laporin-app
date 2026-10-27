import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useIsFocused, useScrollToTop } from 'expo-router';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TombolIkon } from '@/components/bilah-atas';
import { ruangBilahBawah } from '@/components/bilah-bawah';
import { ChipFilter } from '@/components/chip-filter';
import { KisiUndak } from '@/components/poster-laporan';
import { TitikLive } from '@/components/titik-live';
import { Tombol } from '@/components/tombol';
import { VideoUmpan } from '@/components/umpan/media-umpan';
import { Fonts, Media, SINYAL, TINTA, TULANG } from '@/constants/theme';
import { useAplikasiAktif } from '@/hooks/use-aplikasi-aktif';
import { useTheme } from '@/hooks/use-theme';
import { bukaKomentar, bukaLaporan } from '@/lib/aksi-laporan';
import { aturSuka, useAkun } from '@/lib/akun';
import { muatSiaranPublik, useSiaranPublik } from '@/lib/live';
import { kosongkanKabar, muatKabar, useKabar } from '@/lib/notifikasi';
import {
  hitunganTeks,
  kreditLaporan,
  LEBAR_LAYAR_PX,
  muatUmpan,
  sampulDari,
  SITUS_URL,
  urlGambar,
  useUmpan,
  type Berita,
} from '@/lib/umpan';

const KARTU_TERKINI = 12;

/**
 * Beranda dari artboard "Feed", dipangkas supaya tidak ramai: merek kapital kecil (+ jumlah siaran
 * live bila ada), judul besar berisi jumlah laporan, chip pulau, kartu sorotan (laporan terbaru
 * yang bergambar; yang bervideo diputar otomatis tanpa suara), lalu "TERBARU" dengan kisi
 * berundak dua kolom laporan berikutnya. Chip menyaring judul, sorotan, dan kisi sekaligus. Semua dari data nyata: umpan
 * situs dan siaran publik. Mengetuk kartu membuka detail.
 */
export default function LayarBeranda() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const fokus = useIsFocused();
  const aplikasiAktif = useAplikasiAktif();
  const akun = useAkun();
  const { status, berita } = useUmpan();
  const siaran = useSiaranPublik(fokus);
  const { belumDibaca } = useKabar();
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [gagalSegar, setGagalSegar] = useState(false);
  const gulir = useRef<ScrollView>(null);
  // Menekan tab Beranda lagi = kembali ke atas.
  useScrollToTop(gulir);
  /** Batas bawah kartu sorotan di dalam gulungan; lewat dari situ videonya berhenti. */
  const [batasSorotan, setBatasSorotan] = useState(Number.POSITIVE_INFINITY);
  const [lewatSorotan, setLewatSorotan] = useState(false);
  /** Video sorotan diputar tanpa suara sampai warga menyalakannya. */
  const [bisu, setBisu] = useState(true);
  /** Saringan pulau; null = semua. */
  const [pulau, setPulau] = useState<string | null>(null);

  // Titik di lonceng = ada kabar status laporan yang belum dilihat (lib/notifikasi.ts).
  const idAkun = akun.status === 'masuk' ? akun.pengguna?.id : undefined;
  useEffect(() => {
    if (idAkun && fokus) void muatKabar(idAkun);
    else if (akun.status === 'tamu') kosongkanKabar();
  }, [idAkun, fokus, akun.status]);

  // Chip pulau diurutkan dari yang paling banyak laporannya.
  const jumlahPulau = new Map<string, number>();
  for (const b of berita) if (b.pulau) jumlahPulau.set(b.pulau, (jumlahPulau.get(b.pulau) ?? 0) + 1);
  const daftarPulau = [...jumlahPulau.keys()].sort((a, b) => (jumlahPulau.get(b) ?? 0) - (jumlahPulau.get(a) ?? 0));
  // Pulau terpilih yang hilang setelah umpan disegarkan kembali ke Semua.
  const pulauAktif = pulau && jumlahPulau.has(pulau) ? pulau : null;
  const daftar = pulauAktif ? berita.filter((b) => b.pulau === pulauAktif) : berita;
  // Sorotan: laporan terbaru yang punya gambar; sisanya ke kisi.
  const sorotan = daftar.find((b) => sampulDari(b)) ?? daftar[0];
  const terkini = daftar.filter((b) => b !== sorotan).slice(0, KARTU_TERKINI);

  const [baris1, baris2] =
    berita.length > 0
      ? [`${daftar.length} laporan`, pulauAktif ? `di ${pulauAktif}` : daftarPulau.length > 0 ? `dari ${daftarPulau.length} pulau` : 'terverifikasi']
      : status === 'memuat'
        ? ['Memuat', 'laporan']
        : status === 'galat'
          ? ['Gagal', 'memuat']
          : ['Belum ada', 'laporan'];

  async function segarkan() {
    setMenyegarkan(true);
    // Siaran & kabar tidak ditunggu: masing-masing menyusul sendiri.
    void muatSiaranPublik();
    if (idAkun) void muatKabar(idAkun);
    const ok = await muatUmpan();
    setMenyegarkan(false);
    setGagalSegar(!ok);
  }

  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      <ScrollView
        ref={gulir}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const lewat = e.nativeEvent.contentOffset.y > batasSorotan - 40;
          if (lewat !== lewatSorotan) setLewatSorotan(lewat);
        }}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: ruangBilahBawah(insets.bottom) + 8 }}
        refreshControl={
          <RefreshControl
            refreshing={menyegarkan}
            onRefresh={() => void segarkan()}
            tintColor={w.text}
            colors={[w.accent]}
            progressViewOffset={insets.top}
          />
        }>
        <View style={styles.kepala}>
          <Pressable
            accessibilityRole={siaran.length > 0 ? 'button' : undefined}
            accessibilityLabel={siaran.length > 0 ? `${siaran.length} siaran live berlangsung. Buka tab Live.` : undefined}
            disabled={siaran.length === 0}
            onPress={() => router.navigate('/siaran')}
            hitSlop={8}
            style={styles.status}>
            <TitikLive warna={w.accent} berdenyut={siaran.length > 0} ukuran={8} />
            <Text style={[styles.teksStatus, { color: w.text }]} numberOfLines={1}>
              LAPORIN{siaran.length > 0 ? ` · ${siaran.length} LIVE` : ''}
            </Text>
          </Pressable>
          <View style={styles.aksiKepala}>
            <TombolIkon ikon="search" label="Cari laporan" onPress={() => router.push('/cari')} />
            <TombolIkon
              ikon="bell"
              label={belumDibaca > 0 ? `Notifikasi, ${belumDibaca} baru` : 'Notifikasi'}
              titik={belumDibaca > 0}
              onPress={() => router.push('/notifikasi')}
            />
          </View>
        </View>

        <Text style={[styles.h1, { color: w.text }]} accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit>
          <Text style={{ color: w.accentText }}>{baris1}</Text>
          {'\n'}
          {baris2}
        </Text>
        {gagalSegar && berita.length > 0 && (
          <Text style={[styles.catatan, { color: w.danger }]}>Gagal memperbarui. Periksa koneksi lalu tarik ke bawah.</Text>
        )}

        {daftarPulau.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chip}>
            <ChipFilter label="Semua" netral aktif={!pulauAktif} onPress={() => setPulau(null)} />
            {daftarPulau.map((p) => (
              <ChipFilter key={p} label={p} aktif={p === pulauAktif} onPress={() => setPulau(p)} />
            ))}
          </ScrollView>
        )}

        {sorotan ? (
          <View onLayout={(e) => setBatasSorotan(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
            <KartuSorotan
              berita={sorotan}
              // Lebih tinggi dari desain (286 di layar 390) supaya videonya terlihat jelas.
              tinggi={Math.round(Math.min(Math.max(width * 1.15, 380), 560))}
              putar={fokus && !lewatSorotan && aplikasiAktif}
              tampilVideo={fokus}
              bisu={bisu}
              onBisu={() => setBisu((x) => !x)}
            />
          </View>
        ) : (
          <View style={[styles.kosong, { backgroundColor: w.surface }]}>
            {status === 'memuat' ? (
              <ActivityIndicator color={w.text} size="large" />
            ) : (
              <>
                <Feather name={status === 'galat' ? 'wifi-off' : 'search'} size={28} color={w.textSecondary} />
                <Text style={[styles.teksKosong, { color: w.textSecondary }]}>
                  {status === 'galat'
                    ? __DEV__
                      ? // IP laptop di .env berubah setiap ganti Wi-Fi: tunjukkan alamat yang dicoba.
                        `Tidak bisa menghubungi ${SITUS_URL}. Periksa EXPO_PUBLIC_SITUS_URL di .env, lalu npx expo start --clear.`
                      : 'Periksa koneksi lalu tarik ke bawah untuk mencoba lagi.'
                    : 'Laporan yang sudah diverifikasi petugas tampil di sini.'}
                </Text>
                {status === 'galat' && <Tombol judul="Coba lagi" ikon="refresh" ragam="sekunder" onPress={() => void muatUmpan()} />}
              </>
            )}
          </View>
        )}

        {terkini.length > 0 && (
          <>
            <View style={styles.kepalaKisi}>
              <Text style={[styles.labelKisi, { color: w.text }]} accessibilityRole="header">
                TERBARU <Text style={{ color: w.accent }}>●</Text> {terkini.length} LAPORAN
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={pulauAktif ? `Lihat semua laporan di ${pulauAktif}` : 'Lihat semua laporan'}
                // Sedang disaring: Pencarian langsung menelusuri pulau itu.
                onPress={() => (pulauAktif ? router.push({ pathname: '/cari', params: { q: pulauAktif } }) : router.push('/cari'))}
                hitSlop={10}>
                <Text style={[styles.labelKisi, { color: w.text }]}>LIHAT SEMUA →</Text>
              </Pressable>
            </View>
            <KisiUndak berita={terkini} />
          </>
        )}
      </ScrollView>
      {/* Isi yang digulir tidak lewat di bawah jam & ikon status bar. */}
      <View pointerEvents="none" style={[styles.penutup, { height: insets.top, backgroundColor: w.background }]} />
    </View>
  );
}

/**
 * Kartu sorotan: foto/video selebar kartu bersudut 28, provinsi di kiri atas, tombol suara
 * (video) di kanan atas, tombol putar tulang, lalu di pita gelap bawah: judul, kredit, suka,
 * dan komentar (angka 0 tidak ditulis). Satu-satunya kartu yang teksnya menumpang di atas foto
 * (seperti desain); sisanya di bawah foto.
 */
function KartuSorotan({
  berita: b,
  tinggi,
  putar,
  tampilVideo,
  bisu,
  onBisu,
}: {
  berita: Berita;
  tinggi: number;
  putar: boolean;
  /** Pemutar dilepas saat Beranda ditinggalkan (tab lain, detail), supaya tidak menyangga di belakang. */
  tampilVideo: boolean;
  bisu: boolean;
  onBisu: () => void;
}) {
  const akun = useAkun();
  const video = b.media.find((m) => m.jenis === 'video');
  const sampul = video?.poster ?? sampulDari(b);
  const adaVideo = video !== undefined && VideoUmpan !== null;
  const kredit = kreditLaporan(b);
  const disukai = akun.disukai.has(b.id);
  const jumlahSuka = Math.max(akun.jumlahSuka.get(b.id) ?? b.jumlahSuka, disukai ? 1 : 0);
  const tempat = b.provinsi ?? b.pulau;

  function tekanSuka() {
    if (akun.status !== 'masuk') return router.push({ pathname: '/masuk', params: { alasan: 'untuk menyukai laporan' } });
    void aturSuka(b.id, !disukai, jumlahSuka);
  }

  return (
    <View style={[styles.sorotan, { height: tinggi }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Buka laporan: ${b.judul}`}
        onPress={() => bukaLaporan(b.id)}
        style={StyleSheet.absoluteFill}>
        {sampul && (
          <Image source={{ uri: urlGambar(sampul, LEBAR_LAYAR_PX) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        )}
        {/* Seperti trailer: berputar sendiri selama kartunya terlihat. */}
        {adaVideo && VideoUmpan && tampilVideo && (
          <Suspense fallback={null}>
            <VideoUmpan latar uri={video.url} sampul={sampul} penuh putar={putar} bisu={bisu} />
          </Suspense>
        )}
      </Pressable>
      <View pointerEvents="none" style={styles.selubung} />

      <View pointerEvents="box-none" style={styles.atasSorotan}>
        {tempat ? (
          <View style={styles.label}>
            <View style={styles.titikLabel} />
            <Text style={styles.teksLabel} numberOfLines={1}>
              {tempat.toUpperCase()}
            </Text>
          </View>
        ) : (
          <View />
        )}
        {adaVideo && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={bisu ? 'Nyalakan suara video' : 'Matikan suara video'}
            onPress={onBisu}
            hitSlop={8}
            style={({ pressed }) => [styles.label, styles.suara, pressed && styles.ditekan]}>
            <Feather name={bisu ? 'volume-x' : 'volume-2'} size={14} color={TULANG} />
          </Pressable>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={video ? 'Putar video laporan' : 'Lihat foto laporan'}
        onPress={() => bukaLaporan(b.id)}
        style={({ pressed }) => [styles.putar, { top: Math.round(tinggi * 0.3) }, pressed && styles.ditekan]}>
        <Ionicons name={video ? 'play' : 'images'} size={video ? 22 : 20} color={TINTA} style={video && styles.geserPutar} />
      </Pressable>

      <View pointerEvents="box-none" style={styles.bawahSorotan}>
        <Text style={styles.judulSorotan} numberOfLines={2}>
          {b.judul}
        </Text>
        <View style={styles.barisPenulis}>
          <Text style={styles.nama} numberOfLines={1}>
            {kredit}
          </Text>
          <View style={styles.fleks} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: disukai }}
            accessibilityLabel={`${disukai ? 'Batal suka' : 'Suka'}, ${jumlahSuka} suka`}
            onPress={tekanSuka}
            hitSlop={6}
            style={styles.aksi}>
            <Ionicons name={disukai ? 'heart' : 'heart-outline'} size={18} color={disukai ? SINYAL : TULANG} />
            {jumlahSuka > 0 && <Text style={styles.teksAksi}>{hitunganTeks(jumlahSuka)}</Text>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Komentar, ${b.jumlahKomentar}`}
            onPress={() => bukaKomentar(b)}
            hitSlop={6}
            style={styles.aksi}>
            <Ionicons name="chatbubble-outline" size={17} color={TULANG} />
            {b.jumlahKomentar > 0 && <Text style={styles.teksAksi}>{hitunganTeks(b.jumlahKomentar)}</Text>}
          </Pressable>
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
  },
  ditekan: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  penutup: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  kepala: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  status: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teksStatus: {
    flexShrink: 1,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  aksiKepala: {
    flexDirection: 'row',
    gap: 8,
  },
  h1: {
    marginTop: 14,
    paddingHorizontal: 20,
    fontFamily: Fonts.judulTebal,
    fontSize: 36,
    letterSpacing: -0.6,
    lineHeight: 42,
  },
  catatan: {
    paddingTop: 6,
    paddingHorizontal: 20,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
  },
  chip: {
    gap: 6,
    paddingTop: 14,
    paddingHorizontal: 16,
  },
  sorotan: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Media.kartu,
  },
  selubung: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 124,
    backgroundColor: TINTA,
    // Lebih pekat dari desain (0,7): cap waktu & alamat yang terekam di video tidak tembus.
    opacity: 0.93,
  },
  atasSorotan: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: TINTA,
  },
  titikLabel: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: SINYAL,
  },
  teksLabel: {
    flexShrink: 1,
    color: TULANG,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.7,
  },
  suara: {
    width: 36,
    height: 30,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
  },
  putar: {
    position: 'absolute',
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TULANG,
  },
  geserPutar: {
    marginLeft: 3,
  },
  bawahSorotan: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 16,
    gap: 8,
  },
  judulSorotan: {
    color: TULANG,
    fontFamily: Fonts.judul,
    fontSize: 22,
    lineHeight: 27,
  },
  barisPenulis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nama: {
    flexShrink: 1,
    color: TULANG,
    fontFamily: Fonts.semibold,
    fontSize: 13,
  },
  aksi: {
    height: 32,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  teksAksi: {
    color: TULANG,
    fontFamily: Fonts.semibold,
    fontSize: 13,
  },
  kosong: {
    marginTop: 12,
    marginHorizontal: 16,
    minHeight: 260,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 28,
  },
  teksKosong: {
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  kepalaKisi: {
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  labelKisi: {
    paddingVertical: 6,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 1.1,
  },
});
