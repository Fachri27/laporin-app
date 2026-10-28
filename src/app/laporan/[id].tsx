import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { TombolIkon } from '@/components/bilah-atas';
import { JudulBagian, KisiPoster } from '@/components/poster-laporan';
import { Tombol } from '@/components/tombol';
import { HatiKetukGanda, type HatiKetuk } from '@/components/umpan/hati-ketuk';
import { KontrolVideo } from '@/components/umpan/kontrol-video';
import { MediaUmpan } from '@/components/umpan/media-umpan';
import type { KendaliVideo, StatusPutar } from '@/components/umpan/video-umpan';
import { Fonts, Media, SINYAL, TULANG } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { bagikanLaporan, bukaKomentar, lihatDiPeta, menuLaporan } from '@/lib/aksi-laporan';
import { aturSuka, useAkun } from '@/lib/akun';
import { aturSimpan, useTersimpan } from '@/lib/simpan';
import {
  hitunganTeks,
  koordinatSingkat,
  kreditLaporan,
  muatUmpan,
  tanggalSingkat,
  tempatSingkat,
  useUmpan,
  type Berita,
} from '@/lib/umpan';

let nomorHati = 0;

/** "Laporan Serupa": laporan lain dari provinsi yang sama dulu, lalu yang terbaru. */
const JUMLAH_TERKAIT = 12;

/** Kredit tanpa nama orang: jumlah laporannya tidak berarti apa-apa. */
const KREDIT_UMUM = new Set(['Laporan warga', 'Anonim']);

/**
 * Detail satu laporan, dari artboard "Post detail": pemutar bersudut bawah 32 di atas (video
 * dengan kontrol Netflix — mundur/maju 10 detik, posisi, layar penuh; foto bisa dicubit, ketuk
 * ganda = suka; geser antar media, segmen kemajuan di bawahnya), lalu sumber, judul, cerita,
 * lajur Lokasi · Tanggal · Sumber, Suka · Komentar · Bagikan · Laporkan, lalu **Laporan Serupa**.
 * Di atas media hanya tombol & label kecil di pojok; keterangan panjang di bawahnya, supaya bukti
 * tidak tertutup.
 */
export default function LayarDetailLaporan() {
  const w = useTheme();
  // `media` = urutan foto/video yang sedang tampil di kartu beranda saat diketuk.
  const { id, media } = useLocalSearchParams<{ id: string; media?: string }>();
  const { status, berita } = useUmpan();
  const b = berita.find((x) => String(x.id) === id) ?? null;
  // Laporan yang baru tayang bisa belum ada di umpan yang termuat: umpan diambil ulang sekali.
  const dicariUlang = useRef(false);
  const [selesaiDicari, setSelesaiDicari] = useState(false);

  useEffect(() => {
    if (b || status === 'memuat' || dicariUlang.current) return;
    dicariUlang.current = true;
    void muatUmpan().then(() => setSelesaiDicari(true));
  }, [b, status]);

  if (b) return <Detail berita={b} awal={Math.min(Math.max(0, Number(media) || 0), Math.max(0, b.media.length - 1))} />;

  const menunggu = status === 'memuat' || !selesaiDicari;
  return (
    <View style={[styles.layar, styles.tengah, { backgroundColor: w.background }]}>
      {menunggu ? (
        <ActivityIndicator color={w.accentText} />
      ) : (
        <>
          <Feather name="search" size={30} color={w.textSecondary} />
          <Text style={[styles.judulKosong, { color: w.text }]}>Laporan belum tersedia</Text>
          <Text style={[styles.teksKosong, { color: w.textSecondary }]}>
            {status === 'galat'
              ? 'Gagal memuat laporan. Periksa koneksi lalu coba lagi.'
              : 'Laporan ini belum muncul di beranda. Coba lagi beberapa menit lagi.'}
          </Text>
          <Tombol judul="Kembali" ragam="teks" onPress={() => router.back()} />
        </>
      )}
    </View>
  );
}

function Detail({ berita: b, awal }: { berita: Berita; awal: number }) {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const fokus = useIsFocused();
  const akun = useAkun();
  const { berita } = useUmpan();
  const [indeks, setIndeks] = useState(awal);
  const [bisu, setBisu] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [hati, setHati] = useState<HatiKetuk[]>([]);
  /** Lebar/tinggi media pertama setelah termuat; wadah media mengikuti bentuknya. */
  const [rasio, setRasio] = useState<number | null>(null);
  /** Kontrol video gaya Netflix (muncul saat video diketuk). */
  const [kontrol, setKontrol] = useState(false);
  const [kendali, setKendali] = useState<KendaliVideo | null>(null);
  const [putaran, setPutaran] = useState<StatusPutar | null>(null);
  /** Media sudah tergulir lewat: status bar mengikuti latar halaman, bukan pemutar gelap. */
  const [lewatMedia, setLewatMedia] = useState(false);
  const halaman = useRef<ScrollView>(null);
  const daftarMedia = useRef<FlatList<Berita['media'][number]>>(null);
  const disukai = akun.disukai.has(b.id);
  const jumlahSuka = Math.max(akun.jumlahSuka.get(b.id) ?? b.jumlahSuka, disukai ? 1 : 0);
  // Tinggi mengikuti foto (tanpa pita buram/hitam), dibatasi supaya foto panorama tidak terlalu
  // pipih dan foto tegak tidak menghabiskan layar. Sebelum termuat: 4:3.
  const tinggiMedia = Math.round(Math.min(Math.max(width / (rasio ?? 4 / 3), width * 0.56), height * 0.58));
  const kredit = kreditLaporan(b);
  const media = b.media[indeks] ?? b.media[0];
  const banyak = b.media.length > 1;
  // Baris di bawah nama: jumlah laporan dari sumber yang sama di umpan, atau tanggalnya.
  const laporanSumber = KREDIT_UMUM.has(kredit) ? 0 : berita.filter((x) => kreditLaporan(x) === kredit).length;
  const tempat = b.provinsi ?? b.pulau;
  const tersimpan = useTersimpan().includes(b.id);

  const terkait = useMemo(() => {
    const lain = berita.filter((x) => x.id !== b.id);
    return [...lain.filter((x) => b.provinsi && x.provinsi === b.provinsi), ...lain.filter((x) => !b.provinsi || x.provinsi !== b.provinsi)].slice(
      0,
      JUMLAH_TERKAIT,
    );
  }, [berita, b.id, b.provinsi]);

  function mintaMasuk(alasan: string) {
    router.push({ pathname: '/masuk', params: { alasan } });
  }

  function tekanSuka() {
    if (akun.status !== 'masuk') return mintaMasuk('untuk menyukai laporan');
    void aturSuka(b.id, !disukai, jumlahSuka);
  }

  /** Pindah media: lewat geser atau segmen di bawah pemutar. */
  function pindahKe(i: number) {
    if (i !== indeks) {
      setIndeks(i);
      setPutaran(null);
      setKontrol(false);
    }
  }

  function pilihMedia(i: number) {
    pindahKe(i);
    daftarMedia.current?.scrollToIndex({ index: i, animated: false });
    halaman.current?.scrollTo({ y: 0, animated: true });
  }

  function laporkan() {
    router.push({ pathname: '/laporkan', params: { jenis: 'laporan', id: String(b.id), ringkas: b.judul } });
  }

  // Ketuk ganda selalu menyukai (tidak membatalkan), seperti di umpan video.
  const ketukGanda = useCallback(
    (x: number, y: number) => {
      setHati((h) => [...h.slice(-5), { id: ++nomorHati, x, y, miring: (Math.random() - 0.5) * 40 }]);
      if (akun.status !== 'masuk') return mintaMasuk('untuk menyukai laporan');
      if (!disukai) void aturSuka(b.id, true, jumlahSuka);
    },
    [akun.status, disukai, b.id, jumlahSuka],
  );

  const hapusHati = useCallback((id: number) => setHati((h) => h.filter((x) => x.id !== id)), []);
  const tekanLama = useCallback(() => menuLaporan(b, false), [b]);
  const ubahKontrol = useCallback(() => setKontrol((x) => !x), []);

  const satuMedia = (m: Berita['media'][number], i: number) => {
    const aktif = i === indeks;
    const video = m.jenis === 'video';
    return (
      <MediaUmpan
        media={m}
        penuh={false}
        latarBuram={false}
        onRasio={i === 0 ? setRasio : undefined}
        putar={fokus && aktif}
        siapkan={Math.abs(i - indeks) <= 1}
        bisu={bisu}
        onKetukGanda={ketukGanda}
        onZoom={setZoom}
        onTekanLama={tekanLama}
        onKetuk={video && aktif ? ubahKontrol : undefined}
        onKendali={video && aktif ? setKendali : undefined}
        onPutaran={video && aktif ? setPutaran : undefined}
      />
    );
  };

  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      {/* Di atas pemutar gelap status bar terang; sesudahnya mengikuti tema. */}
      {fokus && <StatusBar style={lewatMedia ? 'auto' : 'light'} />}
      <ScrollView
        ref={halaman}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        scrollEnabled={!zoom}
        onScroll={(e) => {
          const lewat = e.nativeEvent.contentOffset.y > insets.top + tinggiMedia - 20;
          if (lewat !== lewatMedia) setLewatMedia(lewat);
        }}
        scrollEventThrottle={32}>
        {/* Pemutar: latar tinta, media utuh, kontrol saat video diketuk; ruang status bar di atasnya. */}
        <View style={[styles.pemutar, { paddingTop: insets.top }]}>
          <View style={{ height: tinggiMedia }}>
            {banyak ? (
              <FlatList
                ref={daftarMedia}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={!zoom && !kontrol}
                data={b.media}
                keyExtractor={(m, i) => `${i}-${m.url}`}
                getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                initialScrollIndex={awal}
                extraData={`${indeks}-${bisu}`}
                onMomentumScrollEnd={(e) => pindahKe(Math.round(e.nativeEvent.contentOffset.x / width))}
                renderItem={({ item, index }) => <View style={{ width, height: tinggiMedia }}>{satuMedia(item, index)}</View>}
              />
            ) : (
              satuMedia(b.media[0] ?? { jenis: 'gambar', url: '' }, 0)
            )}

            {media?.jenis === 'video' && <KontrolVideo tampil={kontrol} status={putaran} kendali={kendali} onTampil={setKontrol} />}

            {hati.map((h) => (
              <HatiKetukGanda key={h.id} hati={h} onSelesai={hapusHati} />
            ))}
          </View>

          {/* Kembali di kiri; tempat · urutan media dan tombol suara di kanan — kecil, di pojok. */}
          <View pointerEvents="box-none" style={[styles.atas, { top: insets.top + 8 }]}>
            <TombolIkon ikon="chevron-left" label="Kembali" kaca onPress={() => router.back()} />
            <View pointerEvents="box-none" style={styles.aksiAtas}>
              {(tempat || banyak) && (
                <View style={styles.label}>
                  <View style={styles.titikLabel} />
                  <Text style={styles.teksLabel} numberOfLines={1}>
                    {[tempat?.toUpperCase(), banyak && `${indeks + 1}/${b.media.length}`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              )}
              {media?.jenis === 'video' && (
                <TombolIkon
                  ikon={bisu ? 'volume-x' : 'volume-2'}
                  label={bisu ? 'Nyalakan suara' : 'Bisukan'}
                  kaca
                  onPress={() => setBisu((x) => !x)}
                />
              )}
            </View>
          </View>

          {/* Segmen per media, terisi sampai yang sedang tampil. Ketuk = pindah ke media itu. */}
          {banyak && (
            <View style={styles.segmen}>
              {b.media.map((m, i) => (
                <Pressable
                  key={`${i}-${m.url}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Media ${i + 1} dari ${b.media.length}`}
                  accessibilityState={{ selected: i === indeks }}
                  onPress={() => pilihMedia(i)}
                  hitSlop={{ top: 12, bottom: 12 }}
                  style={[styles.satuSegmen, { backgroundColor: i <= indeks ? TULANG : Media.garis }]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.salinan}>
          <View style={styles.penulis}>
            <Avatar nama={kredit} ukuran={38} />
            <View style={styles.fleks}>
              <View style={styles.barisNama}>
                <Text style={[styles.nama, { color: w.text }]} numberOfLines={1}>
                  {kredit}
                </Text>
                <View style={[styles.lencana, { borderColor: w.borderStrong }]}>
                  <Text style={[styles.teksLencana, { color: w.text }]}>TERVERIFIKASI</Text>
                </View>
              </View>
              <Text style={[styles.subNama, { color: w.textSecondary }]} numberOfLines={1}>
                {laporanSumber > 1 ? `${laporanSumber} laporan terverifikasi` : b.tanggal}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: tersimpan }}
              onPress={() => aturSimpan(b.id, !tersimpan)}
              style={({ pressed }) => [
                styles.simpan,
                tersimpan ? { backgroundColor: w.chipAktif, borderColor: w.chipAktif } : { borderColor: w.text },
                pressed && styles.ditekan,
              ]}>
              <Feather name={tersimpan ? 'check' : 'bookmark'} size={14} color={tersimpan ? w.onChipAktif : w.text} />
              <Text style={[styles.teksSimpan, { color: tersimpan ? w.onChipAktif : w.text }]}>{tersimpan ? 'Tersimpan' : 'Simpan'}</Text>
            </Pressable>
          </View>

          <Text style={[styles.h1, { color: w.text }]} accessibilityRole="header">
            {b.judul}
          </Text>
          {b.deskripsi && <Text style={[styles.cerita, { color: w.text }]}>{b.deskripsi}</Text>}

          <View style={[styles.lajur, { borderColor: w.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Lokasi ${tempatSingkat(b) || koordinatSingkat(b.lat, b.lng)}. Lihat di peta.`}
              onPress={() => lihatDiPeta(b.id)}
              style={({ pressed }) => [styles.sel, pressed && styles.ditekanRingan]}>
              <View style={styles.barisLabelSel}>
                <Text style={[styles.labelSel, { color: w.textSecondary }]}>LOKASI</Text>
                <Feather name="map-pin" size={10} color={w.accentText} />
              </View>
              {/* "2,25° LS" / "113,95° BT": lintang & bujur masing-masing satu baris. */}
              <Text style={[styles.isiSel, { color: w.text }]}>{koordinatSingkat(b.lat, b.lng).replace(/ (?=\d)/, '\n')}</Text>
            </Pressable>
            <View style={[styles.sel, styles.selTengah, { borderColor: w.border }]}>
              <Text style={[styles.labelSel, { color: w.textSecondary }]}>TANGGAL</Text>
              <Text style={[styles.isiSel, { color: w.text }]}>{tanggalSingkat(b.tanggal).toUpperCase()}</Text>
            </View>
            <View style={[styles.sel, styles.selTengah, { borderColor: w.border }]}>
              <Text style={[styles.labelSel, { color: w.textSecondary }]}>SUMBER</Text>
              <Text style={[styles.isiSel, { color: w.text }]} numberOfLines={2}>
                {kredit.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.aksi}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${disukai ? 'Batal suka' : 'Suka'}, ${jumlahSuka} suka`}
              accessibilityState={{ selected: disukai }}
              onPress={tekanSuka}
              style={({ pressed }) => [
                styles.pil,
                disukai ? { backgroundColor: w.accent, borderColor: w.accent } : { borderColor: w.border },
                pressed && styles.ditekan,
              ]}>
              <Ionicons name={disukai ? 'heart' : 'heart-outline'} size={18} color={disukai ? w.onAccent : w.text} />
              <Text style={[styles.teksPil, { color: disukai ? w.onAccent : w.text }]}>{hitunganTeks(jumlahSuka)}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Komentar, ${b.jumlahKomentar}`}
              onPress={() => bukaKomentar(b, b.jumlahKomentar === 0)}
              style={({ pressed }) => [styles.pil, { borderColor: w.border }, pressed && styles.ditekan]}>
              <Ionicons name="chatbubble-outline" size={17} color={w.text} />
              <Text style={[styles.teksPil, { color: w.text }]}>{hitunganTeks(b.jumlahKomentar)}</Text>
            </Pressable>
            <TombolIkon ikon="share" label="Bagikan" onPress={() => void bagikanLaporan(b)} />
            <View style={styles.fleks} />
            <Pressable accessibilityRole="button" onPress={laporkan} hitSlop={8} style={({ pressed }) => [styles.laporkan, pressed && styles.ditekan]}>
              <Feather name="flag" size={16} color={w.textSecondary} />
              <Text style={[styles.teksLaporkan, { color: w.textSecondary }]}>Laporkan</Text>
            </Pressable>
          </View>
        </View>

        {terkait.length > 0 && (
          <>
            <JudulBagian judul="Laporan Serupa" />
            <KisiPoster berita={terkait} kolom={2} style={styles.kisiSerupa} />
          </>
        )}
      </ScrollView>
      {/* Isi yang digulir tidak lewat di bawah jam & ikon status bar. */}
      <View
        pointerEvents="none"
        style={[styles.penutup, { height: insets.top, backgroundColor: lewatMedia ? w.background : Media.latar }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  tengah: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 6,
  },
  judulKosong: {
    marginTop: 8,
    fontFamily: Fonts.judulTebal,
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  teksKosong: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  ditekan: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  ditekanRingan: {
    opacity: 0.7,
  },
  penutup: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  pemutar: {
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    backgroundColor: Media.latar,
  },
  atas: {
    position: 'absolute',
    left: 8,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  aksiAtas: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: Media.kaca,
  },
  titikLabel: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: SINYAL,
  },
  teksLabel: {
    flexShrink: 1,
    color: Media.teks,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  segmen: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },
  satuSegmen: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  salinan: {
    paddingTop: 18,
    paddingHorizontal: 20,
    gap: 14,
  },
  penulis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barisNama: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nama: {
    flexShrink: 1,
    fontFamily: Fonts.bold,
    fontSize: 15,
  },
  lencana: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 4,
  },
  teksLencana: {
    fontFamily: Fonts.monoTebal,
    fontSize: 8.5,
    letterSpacing: 0.5,
  },
  subNama: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
  // Pengganti "Follow" di desain: Simpan laporan ini (Tersimpan di Profil).
  simpan: {
    height: 38,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 19,
  },
  teksSimpan: {
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  h1: {
    paddingTop: 2,
    fontFamily: Fonts.judulTebal,
    fontSize: 24,
    letterSpacing: -0.4,
    lineHeight: 29,
  },
  cerita: {
    opacity: 0.82,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  lajur: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  sel: {
    flex: 1,
    paddingVertical: 10,
    gap: 4,
  },
  selTengah: {
    paddingLeft: 12,
    borderLeftWidth: 1,
  },
  barisLabelSel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  labelSel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 0.7,
  },
  isiSel: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    lineHeight: 15,
  },
  aksi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
  },
  pil: {
    height: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 22,
  },
  teksPil: {
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  laporkan: {
    height: 44,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teksLaporkan: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
  },
  kisiSerupa: {
    paddingTop: 0,
  },
  fleks: {
    flex: 1,
    minWidth: 0,
  },
});
