import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { memo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { Fonts, Media } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { bukaLaporan } from '@/lib/aksi-laporan';
import { sampulDari, tanggalSingkat, tempatPendek, urlGambar, type Berita } from '@/lib/umpan';

/** Judul bagian: huruf judul di kiri, tautan mono kecil "LIHAT SEMUA ›" di kanan. */
export function JudulBagian({ judul, tautan, onTautan }: { judul: string; tautan?: string; onTautan?: () => void }) {
  const w = useTheme();
  return (
    <View style={styles.judulBagian}>
      <Text style={[styles.teksJudulBagian, { color: w.text }]} accessibilityRole="header">
        {judul}
      </Text>
      {tautan && onTautan && (
        <Pressable accessibilityRole="button" accessibilityLabel={tautan} onPress={onTautan} hitSlop={8} style={styles.tautan}>
          <Text style={[styles.teksTautan, { color: w.textSecondary }]}>{tautan.toUpperCase()}</Text>
          <Feather name="chevron-right" size={14} color={w.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

/** Baris geser horizontal dengan jarak tepi 16. */
export function BarisGeser({ children, jarak = 10 }: { children: ReactNode; jarak?: number }) {
  return (
    // handled: di Pencarian, poster bisa langsung diketuk walau keyboard masih terbuka.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.baris, { gap: jarak }]}>
      {children}
    </ScrollView>
  );
}

/**
 * Kisi kartu yang mengalir ke bawah, tanpa geser ke samping: dua kolom di "Laporan Serupa"
 * detail (tiga kolom terlalu sempit untuk judulnya). Lebar kartu dibagi rata dari lebar layar.
 */
export function KisiPoster({ berita, kolom = 3, style }: { berita: Berita[]; kolom?: 2 | 3; style?: ViewStyle }) {
  const { width } = useWindowDimensions();
  const jarak = kolom === 2 ? 10 : 8;
  const lebar = Math.floor((width - 2 * 16 - (kolom - 1) * jarak) / kolom);
  const tinggi = Math.round(lebar * (kolom === 2 ? 0.68 : 0.9));
  return (
    <View style={[styles.kisi, { gap: jarak }, style]}>
      {berita.map((b) => (
        <PosterLaporan key={b.id} berita={b} lebar={lebar} tinggi={tinggi} />
      ))}
    </View>
  );
}

/** Tinggi sampul kisi berundak di desain (lebar kolom 174), berselang-seling. */
const TINGGI_UNDAK = [220, 170, 190, 250, 160, 230];
/** Perkiraan tinggi judul dua baris + baris mono di bawah sampul, untuk membagi kolom. */
const TINGGI_TEKS_UNDAK = 62;

/** Label pojok sampul: "▶ VIDEO", "4 FOTO", atau "FOTO". */
function labelMedia(b: Pick<Berita, 'media'>): string {
  if (b.media.some((m) => m.jenis === 'video')) return '▶ VIDEO';
  return b.media.length > 1 ? `${b.media.length} FOTO` : 'FOTO';
}

/**
 * Kisi berundak dua kolom di beranda (artboard Feed, bagian "Latest"): tinggi sampul berselang-
 * seling dari desain, dan tiap kartu masuk ke kolom yang sedang lebih pendek supaya kedua kolom
 * berakhir hampir sejajar.
 */
export function KisiUndak({ berita, style }: { berita: Berita[]; style?: ViewStyle }) {
  const { width } = useWindowDimensions();
  const jarak = 10;
  const lebar = Math.floor((width - 2 * 16 - jarak) / 2);
  const kolom: { b: Berita; tinggi: number }[][] = [[], []];
  const panjang = [0, 0];
  berita.forEach((b, i) => {
    const tinggi = Math.round((TINGGI_UNDAK[i % TINGGI_UNDAK.length] * lebar) / 174);
    const k = panjang[0] <= panjang[1] ? 0 : 1;
    kolom[k].push({ b, tinggi });
    panjang[k] += tinggi + TINGGI_TEKS_UNDAK;
  });
  return (
    <View style={[styles.undak, { gap: jarak }, style]}>
      {kolom.map((isi, k) => (
        <View key={k} style={[styles.kolomUndak, { width: lebar }]}>
          {isi.map(({ b, tinggi }) => (
            <KartuUndak key={b.id} berita={b} tinggi={tinggi} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Satu kartu kisi berundak: sampul bersudut 20 berlabel media, lalu judul dan tempat · tanggal. */
const KartuUndak = memo(function KartuUndak({ berita: b, tinggi }: { berita: Berita; tinggi: number }) {
  const w = useTheme();
  const sampul = sampulDari(b);
  const tempat = tempatPendek(b) || b.pulau;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={b.judul}
      onPress={() => bukaLaporan(b.id)}
      style={({ pressed }) => [styles.kartuUndak, pressed && styles.ditekan]}>
      <View style={[styles.sampulUndak, { height: tinggi, backgroundColor: w.surfaceMuted }]}>
        {sampul ? (
          <Image source={{ uri: urlGambar(sampul, 384) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={sampul} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.tengah]}>
            <Ionicons name="flame-outline" size={28} color={w.textSecondary} />
          </View>
        )}
        <View style={styles.labelUndak} pointerEvents="none">
          <Text style={styles.teksLabelUndak}>{labelMedia(b)}</Text>
        </View>
      </View>
      <View style={styles.teksUndak}>
        <Text style={[styles.judulUndak, { color: w.text }]} numberOfLines={2}>
          {b.judul}
        </Text>
        <Text style={[styles.metaUndak, { color: w.textSecondary }]} numberOfLines={1}>
          {tempat ? <Text style={{ color: w.accentText }}>{tempat.toUpperCase()} · </Text> : null}
          {tanggalSingkat(b.tanggal).toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
});

/**
 * Kartu satu laporan, seperti kartu kecil desain: sampul bersudut 20 (▶ di pojok bila
 * bervideo), lalu pita gelap berisi judul huruf judul — hanya itu, supaya kisinya tidak
 * ramai. Judul di bawah foto, bukan menimpanya, supaya bukti tidak tertutup. `tinggi` = tinggi
 * sampul. Ketuk = detail.
 */
export const PosterLaporan = memo(function PosterLaporan({
  berita: b,
  lebar = 168,
  tinggi = 112,
}: {
  berita: Berita;
  lebar?: number;
  tinggi?: number;
}) {
  const w = useTheme();
  const sampul = sampulDari(b);
  const video = b.media.some((m) => m.jenis === 'video');
  const sempit = lebar < 140;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={b.judul}
      onPress={() => bukaLaporan(b.id)}
      style={({ pressed }) => [styles.kartu, { width: lebar, backgroundColor: w.surface }, pressed && styles.ditekan]}>
      <View style={{ height: tinggi, backgroundColor: w.surfaceMuted }}>
        {sampul ? (
          <Image source={{ uri: urlGambar(sampul, 384) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={sampul} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.tengah]}>
            <Ionicons name="flame-outline" size={28} color={w.textSecondary} />
          </View>
        )}
        {video && (
          <View style={styles.pil} pointerEvents="none">
            <Ionicons name="play" size={11} color={Media.teks} />
          </View>
        )}
      </View>
      <View style={[styles.pita, sempit && styles.pitaSempit]}>
        <Text style={[styles.judul, sempit && styles.judulSempit, { color: w.text }]} numberOfLines={2}>
          {b.judul}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  judulBagian: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  teksJudulBagian: {
    flexShrink: 1,
    fontFamily: Fonts.judulTebal,
    fontSize: 21,
    lineHeight: 26,
  },
  tautan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingBottom: 4,
  },
  teksTautan: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  baris: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  kisi: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  kartu: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  undak: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  kolomUndak: {
    gap: 16,
  },
  kartuUndak: {
    gap: 8,
  },
  sampulUndak: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  labelUndak: {
    position: 'absolute',
    right: 8,
    top: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Media.pil,
  },
  teksLabelUndak: {
    color: Media.teks,
    fontFamily: Fonts.monoTebal,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  teksUndak: {
    gap: 4,
    paddingHorizontal: 4,
  },
  judulUndak: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    lineHeight: 17.5,
  },
  metaUndak: {
    fontFamily: Fonts.monoTebal,
    fontSize: 9,
    letterSpacing: 0.54,
  },
  ditekan: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  tengah: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pil: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 26,
    height: 22,
    paddingLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: Media.pil,
  },
  pita: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  pitaSempit: {
    paddingHorizontal: 9,
    paddingTop: 7,
    paddingBottom: 9,
  },
  judul: {
    fontFamily: Fonts.judul,
    fontSize: 15,
    lineHeight: 18,
  },
  judulSempit: {
    fontSize: 13,
    lineHeight: 16,
  },
});
