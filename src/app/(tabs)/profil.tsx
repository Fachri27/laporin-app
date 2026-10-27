import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PanelMasuk } from '@/components/akun/panel-masuk';
import { Avatar } from '@/components/avatar';
import { BilahAtas, TombolIkon } from '@/components/bilah-atas';
import { ruangBilahBawah } from '@/components/bilah-bawah';
import { Tombol } from '@/components/tombol';
import { Colors, Fonts, Media } from '@/constants/theme';
import { useGulirKeIsian } from '@/hooks/use-gulir-ke-isian';
import { useTheme } from '@/hooks/use-theme';
import { bukaLaporan } from '@/lib/aksi-laporan';
import { ambilLaporanSaya, segarkanAkun, useAkun, type LaporanSaya } from '@/lib/akun';
import { useTersimpan } from '@/lib/simpan';
import { hitunganTeks, muatUmpan, sampulDari, urlGambar, useUmpan, type Berita } from '@/lib/umpan';
import { waktuLalu } from '@/lib/waktu';

type Tab = 'laporan' | 'disukai' | 'tersimpan';

const TAB: { kunci: Tab; label: string }[] = [
  { kunci: 'laporan', label: 'Laporan' },
  { kunci: 'disukai', label: 'Disukai' },
  { kunci: 'tersimpan', label: 'Tersimpan' },
];

/** Satu ubin kisi: laporan milik akun ini, atau laporan umpan (disukai / tersimpan). */
type Ubin = { jenis: 'saya'; laporan: LaporanSaya } | { jenis: 'berita'; berita: Berita };

const STATUS: Record<LaporanSaya['status'], string> = {
  tayang: 'Terverifikasi',
  menunggu: 'Sedang ditinjau',
  ditolak: 'Ditolak',
};

/** Titik status di pil ubin. Pilnya selalu gelap (di atas foto), jadi warnanya versi gelap. */
const WARNA_STATUS: Record<LaporanSaya['status'], string> = {
  tayang: Media.hijau,
  menunggu: Colors.dark.warning,
  ditolak: Colors.dark.danger,
};

/** Kisi tiga kolom berjarak 6, sejajar tepi 16 seperti kartu beranda. */
const JARAK_UBIN = 6;
const TEPI = 16;

/**
 * Profil: wordmark + ikon Pengaturan di atas, kepala profil di tengah, angka tiga kolom
 * bergaris seperti data laporan di detail, lalu chip Laporan / Disukai / Tersimpan berupa kisi
 * ubin tiga kolom. Hanya data nyata: tanpa @handle, bio, atau pengikut (situs tidak punya datanya).
 */
export default function LayarProfil() {
  const w = useTheme();
  const akun = useAkun();

  if (akun.status === 'memuat') {
    return (
      <View style={[styles.layar, { backgroundColor: w.background }]}>
        <BilahProfil />
        <ActivityIndicator color={w.accentText} style={styles.pemuat} />
      </View>
    );
  }

  if (akun.status === 'tamu') return <ProfilTamu />;

  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      <BilahProfil />
      <ProfilMasuk />
    </View>
  );
}

/** .topbar profil: wordmark di kiri, Pengaturan di kanan. Tetap di atas saat kisi digulir. */
function BilahProfil() {
  return (
    <BilahAtas>
      <TombolIkon ikon="settings" label="Pengaturan" onPress={() => router.push('/pengaturan')} />
    </BilahAtas>
  );
}

/** Belum masuk: panel masuk. Kolom "masuk uji" ada di bawah, jadi harus naik di atas keyboard. */
function ProfilTamu() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const gulir = useRef<ScrollView>(null);
  const gulirKeIsian = useGulirKeIsian(gulir);
  return (
    // padding juga di Android: edge-to-edge tidak lagi mengecilkan jendela saat keyboard muncul.
    <KeyboardAvoidingView behavior="padding" style={[styles.layar, { backgroundColor: w.background }]}>
      <BilahProfil />
      {/* Bisa digulir: di layar kecil atau huruf besar panelnya lebih tinggi dari layar. */}
      <ScrollView
        ref={gulir}
        style={styles.layar}
        contentContainerStyle={[styles.isiMasuk, { paddingBottom: ruangBilahBawah(insets.bottom) }]}
        keyboardShouldPersistTaps="handled"
        {...gulirKeIsian}>
        <View style={[styles.panelMasuk, { backgroundColor: w.surface }]}>
          <PanelMasuk />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProfilMasuk() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { pengguna, statistik, disukai, jumlahSuka } = useAkun();
  const umpan = useUmpan();
  const tersimpan = useTersimpan();
  const [tab, setTab] = useState<Tab>('laporan');
  const [laporan, setLaporan] = useState<LaporanSaya[] | null>(null);
  const [galat, setGalat] = useState('');
  const [menyegarkan, setMenyegarkan] = useState(false);

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
    // Umpan ikut diambil ulang: tab Disukai dan Tersimpan dibentuk dari umpan.
    await Promise.all([muat(), muatUmpan()]);
    setMenyegarkan(false);
  }

  const perId = useMemo(() => new Map(umpan.berita.map((b) => [b.id, b])), [umpan.berita]);
  // Angka suka terbaru dari HP ini (umpan di-cache beberapa menit), seperti di kartu beranda.
  const sukaDari = (b: Berita) => Math.max(jumlahSuka.get(b.id) ?? b.jumlahSuka, disukai.has(b.id) ? 1 : 0);

  const daftarDisukai = umpan.berita.filter((b) => disukai.has(b.id));
  // Tersimpan hanya di HP ini, terbaru dulu. Laporan yang sudah tidak ada di umpan dilewati.
  const daftarTersimpan = tersimpan.flatMap((id) => perId.get(id) ?? []);

  const ubin: Ubin[] =
    tab === 'laporan'
      ? (laporan ?? []).map((l) => ({ jenis: 'saya' as const, laporan: l }))
      : (tab === 'disukai' ? daftarDisukai : daftarTersimpan).map((b) => ({ jenis: 'berita' as const, berita: b }));

  const nama = pengguna?.nama ?? 'Akun Anda';
  const tayang = statistik?.tayang ?? 0;
  const lebarUbin = Math.floor((width - TEPI * 2 - JARAK_UBIN * 2) / 3);

  const kepala = (
    <View>
      {/* .profile-head */}
      <View style={styles.kepalaProfil}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profil"
          onPress={() => router.push('/profil-ubah')}
          style={({ pressed }) => pressed && styles.ditekan}>
          <Avatar nama={nama} foto={pengguna?.foto} ukuran={96} utama />
          <View style={[styles.tombolAvatar, { backgroundColor: w.accent, borderColor: w.background }]}>
            <Feather name="edit-2" size={13} color={w.onAccent} />
          </View>
        </Pressable>
        <View style={styles.barisNama}>
          <Text style={[styles.nama, { color: w.text }]} numberOfLines={2}>
            {nama}
          </Text>
        </View>
        {/* Hanya bila ada dasarnya: minimal satu laporan akun ini lolos verifikasi petugas. */}
        {tayang > 0 && (
          <View style={[styles.lencana, { borderColor: w.borderStrong }]}>
            <Text style={[styles.teksLencana, { color: w.text }]}>PELAPOR TERVERIFIKASI</Text>
          </View>
        )}
        {pengguna?.email && (
          <Text style={[styles.surel, { color: w.textSecondary }]} numberOfLines={1}>
            {pengguna.email}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/profil-ubah')}
          style={({ pressed }) => [styles.editProfil, { borderColor: w.text }, pressed && styles.ditekan]}>
          <Text style={[styles.teksEditProfil, { color: w.text }]}>Edit profil</Text>
        </Pressable>
      </View>

      {/* Tiga angka di antara garis, dipisah garis tegak (seperti data laporan di detail). */}
      <View style={[styles.angka, { borderColor: w.border }]}>
        <Angka nilai={statistik?.laporan} label="Laporan" />
        <Angka nilai={statistik?.tayang} label="Terverifikasi" garis />
        <Angka nilai={statistik?.disukai} label="Disukai" garis />
      </View>

      {/* Chip pil kapital kecil; terpilih terisi. */}
      <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: w.border }]}>
        {TAB.map(({ kunci, label }) => {
          const pilih = tab === kunci;
          return (
            <Pressable
              key={kunci}
              accessibilityRole="tab"
              accessibilityState={{ selected: pilih }}
              accessibilityLabel={label}
              onPress={() => setTab(kunci)}
              style={({ pressed }) => [
                styles.tab,
                pilih ? { backgroundColor: w.chipAktif, borderColor: w.chipAktif } : { borderColor: w.border },
                pressed && styles.ditekan,
              ]}>
              <Text style={[styles.teksTab, { color: pilih ? w.onChipAktif : w.text }]} numberOfLines={1}>
                {label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const umpanBelumAda = umpan.berita.length === 0;
  let kosong: ReactNode;
  if (tab === 'laporan') {
    kosong =
      laporan === null && !galat ? (
        <ActivityIndicator color={w.accentText} style={styles.pemuat} />
      ) : galat ? (
        <Kosong ikon="wifi-off" teks={galat}>
          <Tombol judul="Coba lagi" ragam="teks" onPress={() => void segarkan()} />
        </Kosong>
      ) : (
        <Kosong ikon="camera" teks="Laporanmu tampil di sini beserta status verifikasinya.">
          <Tombol judul="Buat laporan" ikon="add" onPress={() => router.navigate('/lapor')} />
        </Kosong>
      );
  } else if (umpanBelumAda && umpan.status === 'memuat') {
    kosong = <ActivityIndicator color={w.accentText} style={styles.pemuat} />;
  } else if (umpanBelumAda && umpan.status === 'galat') {
    kosong = <Kosong ikon="wifi-off" teks="Umpan laporan belum termuat. Tarik ke bawah untuk mencoba lagi." />;
  } else {
    kosong =
      tab === 'disukai' ? (
        <Kosong ikon="heart" teks="Laporan yang kamu sukai di beranda tampil di sini." />
      ) : (
        <Kosong ikon="bookmark" teks="Laporan yang kamu simpan tampil di sini. Daftarnya hanya ada di HP ini." />
      );
  }

  return (
    <FlatList
      data={ubin}
      numColumns={3}
      keyExtractor={(u) => (u.jenis === 'saya' ? `saya-${u.laporan.id}` : `berita-${u.berita.id}`)}
      ListHeaderComponent={kepala}
      ListEmptyComponent={kosong}
      columnWrapperStyle={styles.barisUbin}
      renderItem={({ item }) => {
        if (item.jenis === 'berita') return <UbinBerita berita={item.berita} suka={sukaDari(item.berita)} lebar={lebarUbin} />;
        const b = item.laporan.beritaId !== null ? perId.get(item.laporan.beritaId) : undefined;
        return <UbinLaporanSaya laporan={item.laporan} suka={b ? sukaDari(b) : 0} lebar={lebarUbin} />;
      }}
      // Bilah bawah melayang di atas kisi: baris terakhir tetap bisa digulir keluar dari bawahnya.
      contentContainerStyle={{ paddingBottom: ruangBilahBawah(insets.bottom) }}
      refreshControl={
        <RefreshControl refreshing={menyegarkan} onRefresh={() => void segarkan()} tintColor={w.text} colors={[w.accent]} />
      }
    />
  );
}

function Angka({ nilai, label, garis = false }: { nilai: number | undefined; label: string; garis?: boolean }) {
  const w = useTheme();
  return (
    <View style={[styles.sel, garis && [styles.selBergaris, { borderLeftColor: w.border }]]}>
      <Text style={[styles.labelAngka, { color: w.textSecondary }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <Text style={[styles.nilai, { color: w.text }]}>{nilai === undefined ? '–' : hitunganTeks(nilai)}</Text>
    </View>
  );
}

/** Ubin laporan milik akun ini: status verifikasinya jelas di pil kiri bawah. */
function UbinLaporanSaya({ laporan: l, suka, lebar }: { laporan: LaporanSaya; suka: number; lebar: number }) {
  const saat = Date.parse(l.dibuat);
  const label = [l.judul, STATUS[l.status], !Number.isNaN(saat) && waktuLalu(saat), suka > 0 && `${suka} dukungan`]
    .filter(Boolean)
    .join(', ');
  return (
    <UbinKisi
      sampul={l.sampul}
      banyak={l.jumlahBerkas > 1}
      judul={l.judul}
      label={label}
      lebar={lebar}
      onPress={() => {
        if (l.beritaId !== null) return bukaLaporan(l.beritaId);
        Alert.alert(
          l.judul,
          l.status === 'ditolak'
            ? 'Laporan ini tidak lolos verifikasi petugas.'
            : l.status === 'tayang'
              ? // Disetujui, tetapi kejadiannya masih draf atau sudah diturunkan dari situs.
                'Laporan ini sudah diverifikasi petugas, tetapi belum atau tidak ditampilkan di beranda.'
              : 'Laporan ini sedang diperiksa petugas dan belum tampil di beranda.',
        );
      }}>
      <View style={styles.pilStatus}>
        <View style={[styles.titikStatus, { backgroundColor: WARNA_STATUS[l.status] }]} />
        <Text style={styles.teksUbin} numberOfLines={1}>
          {STATUS[l.status].toUpperCase()}
        </Text>
      </View>
    </UbinKisi>
  );
}

/** Ubin laporan umpan (disukai / tersimpan): ▶ bila ada video, ♥ jumlah suka. */
function UbinBerita({ berita: b, suka, lebar }: { berita: Berita; suka: number; lebar: number }) {
  const sampul = sampulDari(b);
  const video = b.media.some((m) => m.jenis === 'video');
  return (
    <UbinKisi
      sampul={sampul ? urlGambar(sampul, 384) : null}
      banyak={b.media.length > 1}
      judul={b.judul}
      label={[b.judul, video && 'video', suka > 0 && `${suka} dukungan`].filter(Boolean).join(', ')}
      lebar={lebar}
      onPress={() => bukaLaporan(b.id)}>
      {(video || suka > 0) && (
        <View style={styles.pilStatus}>
          {video && <Ionicons name="play" size={10} color={Media.teks} />}
          {suka > 0 && (
            <>
              <Ionicons name="heart" size={10} color={Media.aksen} />
              <Text style={styles.teksUbin}>{hitunganTeks(suka)}</Text>
            </>
          )}
        </View>
      )}
    </UbinKisi>
  );
}

/**
 * Ubin kisi: sampul rasio 0,75 bersudut 14 dengan pil tinta kecil di kiri bawah (status, ▶, ♥).
 * Tanpa sampul: judulnya ditulis di tengah ubin supaya laporan tetap bisa dikenali.
 */
function UbinKisi({
  sampul,
  banyak,
  judul,
  label,
  lebar,
  onPress,
  children,
}: {
  sampul: string | null;
  /** Lebih dari satu foto/video: ikon kecil di pojok kanan atas. */
  banyak: boolean;
  judul: string;
  label: string;
  lebar: number;
  onPress: () => void;
  children: ReactNode;
}) {
  const w = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.ubin, { width: lebar, backgroundColor: w.surfaceMuted }, pressed && styles.ditekan]}>
      {sampul ? (
        <Image source={{ uri: sampul }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={sampul} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tanpaSampul]}>
          <Text style={[styles.judulTanpaSampul, { color: w.textSecondary }]} numberOfLines={4}>
            {judul}
          </Text>
        </View>
      )}
      {banyak && (
        <View pointerEvents="none" style={styles.banyak}>
          <Feather name="copy" size={11} color={Media.teks} />
        </View>
      )}
      <View pointerEvents="none" style={styles.labelUbin}>
        {children}
      </View>
    </Pressable>
  );
}

function Kosong({
  ikon,
  teks,
  children,
}: {
  ikon: ComponentProps<typeof Feather>['name'];
  teks: string;
  children?: ReactNode;
}) {
  const w = useTheme();
  return (
    <View style={styles.kosong}>
      <View style={[styles.ikonKosong, { backgroundColor: w.surfaceMuted }]}>
        <Feather name={ikon} size={24} color={w.textSecondary} />
      </View>
      <Text style={[styles.teksKosong, { color: w.textSecondary }]}>{teks}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  ditekan: {
    opacity: 0.75,
  },
  pemuat: {
    marginTop: 40,
  },
  isiMasuk: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: TEPI,
    paddingTop: 18,
  },
  panelMasuk: {
    paddingVertical: 22,
    borderRadius: 28,
  },
  kepalaProfil: {
    alignItems: 'center',
    paddingTop: 5,
    paddingHorizontal: 28,
    paddingBottom: 20,
  },
  // Tombol sunting bulat sinyal berbingkai warna latar.
  tombolAvatar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barisNama: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nama: {
    flexShrink: 1,
    fontFamily: Fonts.judulTebal,
    fontSize: 24,
    letterSpacing: -0.4,
    lineHeight: 29,
    textAlign: 'center',
  },
  lencana: {
    marginTop: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 4,
  },
  teksLencana: {
    fontFamily: Fonts.monoTebal,
    fontSize: 9.5,
    letterSpacing: 0.6,
  },
  surel: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 13,
  },
  // Seperti tombol "Follow" di desain: pil bergaris sewarna teks.
  editProfil: {
    marginTop: 14,
    height: 38,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 19,
  },
  teksEditProfil: {
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  angka: {
    marginHorizontal: 20,
    marginBottom: 4,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  sel: {
    flex: 1,
    gap: 4,
    paddingVertical: 10,
  },
  selBergaris: {
    paddingLeft: 12,
    borderLeftWidth: 1,
  },
  nilai: {
    fontFamily: Fonts.judulTebal,
    fontSize: 21,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  labelAngka: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
  },
  tabs: {
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: TEPI,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 6,
    borderBottomWidth: 1,
  },
  tab: {
    height: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 18,
  },
  teksTab: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.7,
  },
  barisUbin: {
    gap: JARAK_UBIN,
    marginBottom: JARAK_UBIN,
    paddingHorizontal: TEPI,
  },
  ubin: {
    aspectRatio: 0.75,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tanpaSampul: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  judulTanpaSampul: {
    fontFamily: Fonts.judul,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  banyak: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 4,
    borderRadius: 6,
    backgroundColor: Media.pil,
  },
  labelUbin: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pilStatus: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Media.pil,
  },
  titikStatus: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  teksUbin: {
    flexShrink: 1,
    color: Media.teks,
    fontFamily: Fonts.monoTebal,
    fontSize: 9.5,
    letterSpacing: 0.4,
  },
  kosong: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  ikonKosong: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teksKosong: {
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
});
