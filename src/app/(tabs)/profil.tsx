import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PanelMasuk } from '@/components/akun/panel-masuk';
import { Fonts, Media, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ambilLaporanSaya, segarkanAkun, useAkun, type LaporanSaya } from '@/lib/akun';
import { hitunganTeks, muatUmpan, urlGambar, useUmpan, type Berita } from '@/lib/umpan';

type Tab = 'laporan' | 'disukai';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function tanggalPendek(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${BULAN[d.getMonth()]}`;
}

function bukaDiBeranda(id: number) {
  router.navigate({ pathname: '/', params: { laporan: String(id) } });
}

/** Profil dari desain: kepala halaman, kartu profil, angka, kartu kontribusi, grid Laporan / Disukai. */
export default function LayarProfil() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const akun = useAkun();

  const kepalaHalaman = (
    <View style={[styles.kepalaHalaman, { paddingTop: insets.top + Spacing.three }]}>
      <View>
        <Text style={[styles.eyebrow, { color: w.textSecondary }]}>AKUN LAPOR</Text>
        <Text style={[styles.h1, { color: w.text }]}>Profil</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pengaturan dan privasi"
        onPress={() => router.push('/pengaturan')}
        style={({ pressed }) => [styles.tombolKotak, { backgroundColor: pressed ? w.border : w.surfaceMuted }]}>
        <Ionicons name="settings-outline" size={20} color={w.text} />
      </Pressable>
    </View>
  );

  if (akun.status === 'memuat') {
    return (
      <View style={[styles.layar, styles.tengah, { backgroundColor: w.background }]}>
        <ActivityIndicator color={w.accentText} />
      </View>
    );
  }

  if (akun.status === 'tamu') {
    return (
      <View style={[styles.layar, { backgroundColor: w.background }]}>
        {kepalaHalaman}
        {/* Bisa digulir: di layar kecil atau huruf besar panelnya lebih tinggi dari layar. */}
        <ScrollView
          style={styles.layar}
          contentContainerStyle={styles.isiMasuk}
          keyboardShouldPersistTaps="handled">
          <PanelMasuk />
        </ScrollView>
      </View>
    );
  }

  return <ProfilMasuk kepalaHalaman={kepalaHalaman} />;
}

function ProfilMasuk({ kepalaHalaman }: { kepalaHalaman: ReactNode }) {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { pengguna, statistik, disukai, jumlahSuka } = useAkun();
  const { berita } = useUmpan();
  const [tab, setTab] = useState<Tab>('laporan');
  const [laporan, setLaporan] = useState<LaporanSaya[] | null>(null);
  const [galat, setGalat] = useState('');
  const [menyegarkan, setMenyegarkan] = useState(false);
  // Laporan tayang yang belum ada di umpan HP ini: dicari lagi setelah umpan dimuat ulang.
  const [dicari, setDicari] = useState<{ id: number; judul: string } | null>(null);
  const sudahDicari = useRef<typeof dicari>(null);

  function bukaLaporan(l: LaporanSaya & { beritaId: number }) {
    if (berita.some((b) => b.id === l.beritaId)) return bukaDiBeranda(l.beritaId);
    // Umpan di HP hanya dimuat ulang tiap beberapa menit — beranda tidak akan menemukannya
    // dan diam-diam membuka kartu teratas. Muat ulang dulu, lalu periksa lagi di efek bawah.
    void muatUmpan().then(() => setDicari({ id: l.beritaId, judul: l.judul }));
  }

  // Render setelah muatUmpan selesai sudah membaca umpan terbaru (useSyncExternalStore).
  useEffect(() => {
    if (!dicari || sudahDicari.current === dicari) return;
    sudahDicari.current = dicari;
    if (berita.some((b) => b.id === dicari.id)) bukaDiBeranda(dicari.id);
    else
      Alert.alert(
        dicari.judul,
        'Laporan ini sudah tayang, tetapi belum muncul di beranda HP ini. Coba lagi beberapa menit lagi.',
      );
  }, [dicari, berita]);

  const muat = useCallback(async () => {
    const [hasil] = await Promise.all([ambilLaporanSaya(), segarkanAkun()]);
    if (hasil.ok) {
      setLaporan(hasil.laporan);
      setGalat('');
    } else {
      setGalat(hasil.galat);
    }
  }, []);

  // Dimuat ulang setiap kali tab Profil dibuka: laporan baru / status verifikasi bisa berubah.
  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  async function segarkan() {
    setMenyegarkan(true);
    await muat();
    setMenyegarkan(false);
  }

  const daftarDisukai = berita.filter((b) => disukai.has(b.id));
  const nama = pengguna?.nama ?? 'Akun Anda';
  const handle = pengguna?.email ? `@${pengguna.email.split('@')[0]}` : null;
  const menunggu = laporan?.filter((l) => l.status === 'menunggu').length;
  const tayang = statistik?.tayang ?? 0;

  const kepala = (
    <View>
      {kepalaHalaman}

      <View style={styles.isiKepala}>
        <View style={styles.kartuProfil}>
          {pengguna?.foto ? (
            <Image source={{ uri: pengguna.foto }} style={styles.avatar} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.avatar, styles.tengah, styles.avatarInisial]}>
              <Text style={styles.inisial}>{(nama.trim()[0] ?? '?').toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.fleks}>
            <Text style={[styles.nama, { color: w.text }]} numberOfLines={1}>
              {nama}
            </Text>
            {handle && (
              <Text style={[styles.handle, { color: w.textSecondary }]} numberOfLines={1}>
                {handle}
              </Text>
            )}
            <View style={styles.peran}>
              <Ionicons name="shield-checkmark-outline" size={14} color={w.accentText} />
              <Text style={[styles.teksPeran, { color: w.accentText }]}>Pelapor warga</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/profil-ubah')}
            style={({ pressed }) => [
              styles.tombolEdit,
              { borderColor: w.border, backgroundColor: pressed ? w.surfaceMuted : w.surface },
            ]}>
            <Text style={[styles.teksEdit, { color: w.text }]}>Edit</Text>
          </Pressable>
        </View>

        <View style={[styles.angka, { borderColor: w.border }]}>
          <Angka nilai={statistik?.laporan} label="Laporan" />
          <Angka nilai={statistik?.tayang} label="Tayang" garis />
          <Angka nilai={menunggu} label="Menunggu" garis />
          <Angka nilai={statistik?.disukai} label="Disukai" garis />
        </View>

        <View style={[styles.kontribusi, { backgroundColor: w.inverse }]}>
          <View style={styles.ikonKontribusi}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Media.limau} />
          </View>
          <View style={styles.fleks}>
            <Text style={styles.labelKontribusi}>KONTRIBUSI</Text>
            <Text style={[styles.judulKontribusi, { color: w.onInverse }]}>
              {tayang > 0
                ? // Belum tentu tampil di beranda: kurator bisa menyimpan kejadiannya sebagai draf.
                  `${tayang} laporan Anda sudah diverifikasi petugas`
                : 'Laporan Anda akan tayang setelah diperiksa petugas'}
            </Text>
            <Text style={styles.teksKontribusi}>Dihitung dari laporan yang lolos verifikasi petugas.</Text>
          </View>
        </View>
      </View>

      <View style={[styles.tabs, { borderBottomColor: w.border }]}>
        {(['laporan', 'disukai'] as const).map((t) => {
          const pilih = tab === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: pilih }}
              onPress={() => setTab(t)}
              style={[styles.tab, pilih && { borderBottomColor: w.accentText }]}>
              <Ionicons
                name={t === 'laporan' ? 'grid-outline' : 'heart-outline'}
                size={18}
                color={pilih ? w.text : w.textSecondary}
              />
              <Text style={[styles.teksTab, { color: pilih ? w.text : w.textSecondary }]}>
                {t === 'laporan' ? 'Laporan' : 'Disukai'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const kosong =
    tab === 'laporan' ? (
      laporan === null && !galat ? (
        <ActivityIndicator color={w.accentText} style={styles.pemuat} />
      ) : (
        <Kosong
          ikon="camera-outline"
          teks={galat || 'Belum ada laporan. Tekan ➕ untuk memotret dan melaporkan kebakaran di sekitar Anda.'}
        />
      )
    ) : (
      <Kosong ikon="heart-outline" teks="Laporan yang Anda sukai di beranda muncul di sini." />
    );

  const segar = (
    <RefreshControl refreshing={menyegarkan} onRefresh={() => void segarkan()} tintColor={w.accentText} />
  );

  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      {/* Latar status bar: grid yang digulir tidak boleh menimpa jam & baterai. */}
      <View style={[styles.latarStatus, { height: insets.top, backgroundColor: w.background }]} />
      {tab === 'laporan' ? (
        <FlatList
          key="laporan"
          data={laporan ?? []}
          keyExtractor={(l) => l.id}
          numColumns={3}
          ListHeaderComponent={kepala}
          ListEmptyComponent={kosong}
          renderItem={({ item }) => <UbinLaporan laporan={item} onBuka={bukaLaporan} />}
          columnWrapperStyle={styles.barisGrid}
          refreshControl={segar}
        />
      ) : (
        <FlatList
          key="disukai"
          data={daftarDisukai}
          keyExtractor={(b) => String(b.id)}
          numColumns={3}
          ListHeaderComponent={kepala}
          ListEmptyComponent={kosong}
          renderItem={({ item }) => (
            // Angka suka terbaru dari HP ini; umpan di-cache beberapa menit.
            <UbinDisukai berita={item} jumlahSuka={jumlahSuka.get(item.id) ?? item.jumlahSuka} />
          )}
          columnWrapperStyle={styles.barisGrid}
          refreshControl={segar}
        />
      )}
    </View>
  );
}

function Angka({ nilai, label, garis = false }: { nilai: number | undefined; label: string; garis?: boolean }) {
  const w = useTheme();
  return (
    <View style={[styles.sel, garis && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: w.border }]}>
      <Text style={[styles.nilai, { color: w.text }]}>{nilai === undefined ? '–' : hitunganTeks(nilai)}</Text>
      <Text style={[styles.labelAngka, { color: w.textSecondary }]}>{label}</Text>
    </View>
  );
}

function UbinLaporan({
  laporan: l,
  onBuka,
}: {
  laporan: LaporanSaya;
  onBuka: (l: LaporanSaya & { beritaId: number }) => void;
}) {
  const w = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${l.judul}, ${l.status}`}
      onPress={() => {
        if (l.beritaId !== null) onBuka({ ...l, beritaId: l.beritaId });
        else
          Alert.alert(
            l.judul,
            l.status === 'ditolak'
              ? 'Laporan ini tidak lolos verifikasi petugas.'
              : l.status === 'tayang'
                ? // Disetujui, tetapi kejadiannya masih draf atau sudah diturunkan dari situs.
                  'Laporan ini sudah diverifikasi petugas, tetapi belum atau tidak ditampilkan di beranda.'
                : 'Laporan ini sedang diperiksa petugas dan belum tampil di beranda.',
          );
      }}
      style={[styles.ubin, { backgroundColor: w.border }]}>
      {l.sampul ? (
        <Image source={{ uri: l.sampul }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tengah]}>
          <Ionicons name="videocam" size={24} color={w.textSecondary} />
        </View>
      )}
      <View style={styles.ikonUbin}>
        <Ionicons name={l.jumlahBerkas > 1 ? 'copy-outline' : l.sampul ? 'image-outline' : 'play'} size={15} color="#fff" />
      </View>
      {l.status === 'tayang' ? (
        <View style={styles.centang}>
          <Ionicons name="checkmark" size={10} color={Media.onLimau} />
        </View>
      ) : (
        <View style={[styles.lencana, { backgroundColor: l.status === 'ditolak' ? w.danger : w.warning }]}>
          <Text style={styles.teksLencana}>{l.status === 'ditolak' ? 'Ditolak' : 'Menunggu'}</Text>
        </View>
      )}
      <Text style={styles.tanggalUbin}>{tanggalPendek(l.dibuat)}</Text>
    </Pressable>
  );
}

function UbinDisukai({ berita: b, jumlahSuka }: { berita: Berita; jumlahSuka: number }) {
  const w = useTheme();
  const awal = b.media[0];
  const sampul = awal?.jenis === 'video' ? awal.poster : awal?.url;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={b.judul}
      onPress={() => bukaDiBeranda(b.id)}
      style={[styles.ubin, { backgroundColor: w.border }]}>
      {sampul && <Image source={{ uri: urlGambar(sampul, 384) }} style={StyleSheet.absoluteFill} contentFit="cover" />}
      <View style={styles.ikonUbin}>
        <Ionicons name={awal?.jenis === 'video' ? 'play' : 'image-outline'} size={15} color="#fff" />
      </View>
      <View style={styles.sukaUbin}>
        <Ionicons name="heart" size={12} color="#fff" />
        <Text style={styles.tanggalUbinTeks}>{hitunganTeks(jumlahSuka)}</Text>
      </View>
    </Pressable>
  );
}

function Kosong({ ikon, teks }: { ikon: 'camera-outline' | 'heart-outline'; teks: string }) {
  const w = useTheme();
  return (
    <View style={styles.kosong}>
      <Ionicons name={ikon} size={36} color={w.textSecondary} />
      <Text style={[styles.teksKosong, { color: w.textSecondary }]}>{teks}</Text>
    </View>
  );
}

const bayangTeks = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  latarStatus: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  fleks: {
    flex: 1,
  },
  tengah: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  isiMasuk: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.three,
  },
  kepalaHalaman: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 17,
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
  tombolKotak: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  isiKepala: {
    paddingHorizontal: 17,
  },
  kartuProfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: Media.limau,
  },
  avatarInisial: {
    backgroundColor: '#344138',
  },
  inisial: {
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 22,
  },
  nama: {
    fontFamily: Fonts.judulTebal,
    fontSize: 19,
  },
  handle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
  },
  peran: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  teksPeran: {
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  tombolEdit: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  teksEdit: {
    fontFamily: Fonts.bold,
    fontSize: 12.5,
  },
  angka: {
    flexDirection: 'row',
    marginVertical: 20,
    paddingVertical: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sel: {
    flex: 1,
    alignItems: 'center',
  },
  nilai: {
    fontFamily: Fonts.judulTebal,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
  labelAngka: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: 11.5,
  },
  kontribusi: {
    flexDirection: 'row',
    gap: 11,
    padding: 14,
    borderRadius: 13,
  },
  ikonKontribusi: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(184,243,74,0.1)',
  },
  labelKontribusi: {
    color: '#aabca2',
    fontFamily: Fonts.judulTebal,
    fontSize: 9.5,
    letterSpacing: 1,
  },
  judulKontribusi: {
    marginTop: 3,
    fontFamily: Fonts.judul,
    fontSize: 14,
    lineHeight: 19,
  },
  teksKontribusi: {
    marginTop: 4,
    color: '#96a398',
    fontFamily: Fonts.regular,
    fontSize: 11.5,
  },
  tabs: {
    flexDirection: 'row',
    marginTop: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  teksTab: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
  },
  barisGrid: {
    gap: 2,
  },
  ubin: {
    flex: 1 / 3,
    aspectRatio: 3 / 4,
    marginTop: 2,
    overflow: 'hidden',
  },
  ikonUbin: {
    position: 'absolute',
    top: 7,
    right: 7,
  },
  centang: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Media.limau,
  },
  lencana: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  teksLencana: {
    color: '#fff',
    fontFamily: Fonts.bold,
    fontSize: 10,
  },
  tanggalUbin: {
    position: 'absolute',
    right: 7,
    bottom: 6,
    color: '#fff',
    fontFamily: Fonts.semibold,
    fontSize: 11,
    ...bayangTeks,
  },
  sukaUbin: {
    position: 'absolute',
    left: 7,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tanggalUbinTeks: {
    color: '#fff',
    fontFamily: Fonts.semibold,
    fontSize: 11.5,
    ...bayangTeks,
  },
  pemuat: {
    marginTop: Spacing.five,
  },
  kosong: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.five,
  },
  teksKosong: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
