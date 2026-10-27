import Feather from '@expo/vector-icons/Feather';
import { router, useIsFocused } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ruangBilahBawah } from '@/components/bilah-bawah';
import { JudulBagian } from '@/components/poster-laporan';
import { TitikLive } from '@/components/titik-live';
import { Tombol } from '@/components/tombol';
import { Fonts, Media, SINYAL, TINTA, TULANG } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tontonSiaran } from '@/lib/aksi-laporan';
import { useSiaranPublik, type SiaranPublik } from '@/lib/live';
import { hitunganTeks } from '@/lib/umpan';
import { waktuLalu } from '@/lib/waktu';

/** Jarak tepi & antarkolom kisi kartu. */
const TEPI = 16;
const JARAK_KOLOM = 10;

/**
 * Tab Live, sebahasa dengan artboard "Live broadcast": judul besar dengan jumlah siaran publik
 * yang sedang berjalan, ajakan "Mulai live" berlatar sinyal, lalu kisi siaran — paling ramai
 * dulu. Siaran tidak punya gambar sampul (videonya hanya ada saat ditonton), jadi sampulnya
 * avatar penyiar — bukan foto rekaan. Siaran terjadwal tidak dibuat: situs tidak punya jadwal.
 */
export default function LayarSiaran() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const fokus = useIsFocused();
  const siaran = useSiaranPublik(fokus);
  const urut = [...siaran].sort((a, b) => b.penonton - a.penonton);

  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: ruangBilahBawah(insets.bottom) + 8 }}
        showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={[styles.h1, { color: w.text }]}>
          <Text style={{ color: w.accentText }}>{urut.length > 0 ? `${urut.length} siaran` : 'Siaran'}</Text>
          {'\n'}
          {urut.length > 0 ? 'sedang live' : 'langsung'}
        </Text>
        <Text style={[styles.sub, { color: w.textSecondary }]}>
          {urut.length > 0 ? 'DARI WARGA DI LOKASI KEJADIAN' : 'BELUM ADA SIARAN PUBLIK'}
        </Text>

        <BannerMulai />

        {urut.length > 0 ? (
          <>
            <JudulBagian judul="Sedang siaran" />
            <View style={styles.kisi}>
              {urut.map((s) => (
                <KartuSiaran key={s.ruang} siaran={s} />
              ))}
            </View>
          </>
        ) : (
          <View style={[styles.kosong, { backgroundColor: w.surface }]}>
            <View style={[styles.ikonKosong, { backgroundColor: w.surfaceMuted }]}>
              <Feather name="radio" size={22} color={w.textSecondary} />
            </View>
            <Text style={[styles.teksKosong, { color: w.textSecondary }]}>Siaran yang dibuka untuk publik tampil di sini.</Text>
          </View>
        )}
      </ScrollView>
      {/* Isi yang digulir tidak lewat di bawah jam & ikon status bar. */}
      <View pointerEvents="none" style={[styles.penutup, { height: insets.top, backgroundColor: w.background }]} />
    </View>
  );
}

/** Ajakan siaran berlatar sinyal: selalu ada, karena tab ini pintu utama siaran. */
function BannerMulai() {
  return (
    <View style={styles.banner}>
      <View style={styles.barisLabel}>
        <TitikLive warna={TINTA} ukuran={7} />
        <Text style={styles.labelBanner}>SIARAN LAPANGAN</Text>
      </View>
      <Text style={styles.judulBanner}>Siarkan dari lokasi.</Text>
      <Text style={styles.teksBanner}>Tunjukkan kondisi terkini ke petugas secara langsung.</Text>
      <Tombol judul="Mulai live" ikon="radio-outline" ragam="terang" onPress={() => router.navigate('/live')} style={styles.tombolMulai} />
    </View>
  );
}

/** Kartu siaran: sampul gelap berlencana LIVE & jumlah penonton, lalu judul dan penyiar di pita bawah. */
function KartuSiaran({ siaran: s }: { siaran: SiaranPublik }) {
  const w = useTheme();
  const { width } = useWindowDimensions();
  const lebar = Math.floor((width - TEPI * 2 - JARAK_KOLOM) / 2);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tonton siaran ${s.nama}: ${s.judul}, ${s.penonton} menonton`}
      onPress={() => tontonSiaran(s)}
      style={({ pressed }) => [styles.kartu, { width: lebar, backgroundColor: w.surface }, pressed && styles.ditekan]}>
      <View style={[styles.sampul, { backgroundColor: w.surfaceMuted }]}>
        <View style={[styles.cincin, { borderColor: w.accent }]}>
          <Avatar nama={s.nama} ukuran={58} utama />
        </View>
        <View style={styles.lencana}>
          <View style={styles.titikLencana} />
          <Text style={styles.teksLencana}>LIVE</Text>
        </View>
        <View style={styles.penonton}>
          <Feather name="eye" size={11} color={TULANG} />
          <Text style={styles.teksPenonton}>{hitunganTeks(s.penonton)}</Text>
        </View>
      </View>
      <View style={styles.pita}>
        <Text style={[styles.judulKartu, { color: w.text }]} numberOfLines={2}>
          {s.judul}
        </Text>
        <Text style={[styles.ketKartu, { color: w.textSecondary }]} numberOfLines={1}>
          {s.nama.toUpperCase()} · {waktuLalu(s.mulai).toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  penutup: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  ditekan: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  h1: {
    paddingHorizontal: 20,
    paddingTop: 4,
    fontFamily: Fonts.judulTebal,
    fontSize: 36,
    letterSpacing: -0.4,
    lineHeight: 44,
  },
  sub: {
    paddingTop: 8,
    paddingHorizontal: 20,
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  banner: {
    marginTop: 18,
    marginHorizontal: TEPI,
    marginBottom: 28,
    padding: 22,
    borderRadius: 28,
    alignItems: 'flex-start',
    backgroundColor: SINYAL,
  },
  barisLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: -4,
  },
  labelBanner: {
    color: TINTA,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  judulBanner: {
    marginTop: 10,
    color: TINTA,
    fontFamily: Fonts.judulTebal,
    fontSize: 25,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  teksBanner: {
    marginTop: 8,
    maxWidth: 300,
    color: TINTA,
    fontFamily: Fonts.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  tombolMulai: {
    marginTop: 18,
  },
  kisi: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: TEPI,
    columnGap: JARAK_KOLOM,
    rowGap: JARAK_KOLOM,
  },
  kartu: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sampul: {
    aspectRatio: 1.05,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cincin: {
    padding: 2,
    borderWidth: 2,
    borderRadius: 40,
  },
  lencana: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 7,
    backgroundColor: SINYAL,
  },
  titikLencana: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TINTA,
  },
  teksLencana: {
    color: TINTA,
    fontFamily: Fonts.judulTebal,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  penonton: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    height: 24,
    borderRadius: 7,
    backgroundColor: Media.pil,
  },
  teksPenonton: {
    color: TULANG,
    fontFamily: Fonts.monoTebal,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  pita: {
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 11,
    gap: 5,
  },
  judulKartu: {
    fontFamily: Fonts.judul,
    fontSize: 15,
    lineHeight: 18,
  },
  ketKartu: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  kosong: {
    marginHorizontal: TEPI,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
  },
  ikonKosong: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
