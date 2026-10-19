import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useState, type ComponentProps } from 'react';
import { FlatList, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { HatiKetukGanda, type HatiKetuk } from '@/components/umpan/hati-ketuk';
import { MediaUmpan } from '@/components/umpan/media-umpan';
import { Radius, Spacing } from '@/constants/theme';
import { aturSuka, useAkun } from '@/lib/akun';
import { hitunganTeks, jarakKm, jarakTeks, urlHalaman, type Berita } from '@/lib/umpan';

type Props = {
  berita: Berita;
  lebar: number;
  tinggi: number;
  /** Kartu yang sedang ditonton dan layar beranda sedang fokus: video diputar. */
  putar: boolean;
  /** Kartu aktif atau tetangganya: pemutar video disiapkan. */
  siapkan: boolean;
  bisu: boolean;
  onBisu: () => void;
  /** Titik acuan "Terdekat"; bila ada, jarak ke kejadian ditampilkan. */
  acuan: { lat: number; lng: number } | null;
  /** Tinggi area tab Terbaru/Terdekat di atas kartu. */
  atas: number;
  onPesan: (teks: string) => void;
  /** Kartu sedang dicubit (zoom) — umpan berhenti bisa digeser. */
  onZoom: (aktif: boolean) => void;
  /** Mode bersih: tombol & cerita disembunyikan, hanya media yang tampil. */
  bersih: boolean;
  /** Tekan lama di media — menu mode bersih & laporkan. */
  onTekanLama: (b: Berita) => void;
};

let nomorHati = 0;

/**
 * Satu laporan selayar penuh: media (bisa digeser ke samping), tombol aksi di
 * kanan, cerita di kiri bawah. memo: saat warga menggeser, hanya kartu yang
 * berganti status putar/siapkan yang di-render ulang.
 */
export const KartuUmpan = memo(function KartuUmpan({
  berita: b,
  lebar,
  tinggi,
  putar,
  siapkan,
  bisu,
  onBisu,
  acuan,
  atas,
  onPesan,
  onZoom,
  bersih,
  onTekanLama,
}: Props) {
  const akun = useAkun();
  const [indeks, setIndeks] = useState(0);
  const [terbuka, setTerbuka] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [hati, setHati] = useState<HatiKetuk[]>([]);
  const disukai = akun.disukai.has(b.id);
  // Umpan di-cache situs: hati merah dengan angka 0 berarti suka warga belum terhitung di sana.
  const jumlahSuka = Math.max(akun.jumlahSuka.get(b.id) ?? b.jumlahSuka, disukai ? 1 : 0);
  const media = b.media[indeks] ?? b.media[0];
  const tempat = [b.lokasi?.split(',')[0]?.trim(), b.provinsi].filter(Boolean).join(', ');
  const jarak = acuan ? jarakKm(acuan, b) : null;
  // Selama dicubit atau di mode bersih, tombol & cerita memudar supaya media terlihat utuh (seperti TikTok).
  const sembunyikan = zoom || bersih;
  const tampak = useSharedValue(1);
  const gayaTampak = useAnimatedStyle(() => ({ opacity: tampak.value }));

  useEffect(() => {
    tampak.set(withTiming(sembunyikan ? 0 : 1, { duration: 160 }));
  }, [sembunyikan, tampak]);

  function mintaMasuk(alasan: string) {
    router.push({ pathname: '/masuk', params: { alasan } });
  }

  function tekanSuka() {
    if (akun.status !== 'masuk') return mintaMasuk('untuk menyukai laporan');
    void aturSuka(b.id, !disukai, jumlahSuka).then((ok) => {
      if (!ok) onPesan('Gagal menyukai. Periksa koneksi.');
    });
  }

  // Ketuk ganda selalu menyukai (tidak membatalkan), seperti TikTok.
  function ketukGanda(x: number, y: number) {
    setHati((h) => [...h.slice(-5), { id: ++nomorHati, x, y, miring: (Math.random() - 0.5) * 40 }]);
    if (akun.status !== 'masuk') return mintaMasuk('untuk menyukai laporan');
    if (!disukai) {
      void aturSuka(b.id, true, jumlahSuka).then((ok) => {
        if (!ok) onPesan('Gagal menyukai. Periksa koneksi.');
      });
    }
  }

  const hapusHati = useCallback((id: number) => setHati((h) => h.filter((x) => x.id !== id)), []);

  const tekanLama = useCallback(() => onTekanLama(b), [onTekanLama, b]);

  const gantiZoom = useCallback(
    (aktif: boolean) => {
      setZoom(aktif);
      onZoom(aktif);
    },
    [onZoom],
  );

  function kePeta() {
    router.push({ pathname: '/peta', params: { id: String(b.id) } });
  }

  function bukaKomentar() {
    router.push({ pathname: '/komentar/[id]', params: { id: String(b.id), slug: b.slug ?? '', judul: b.judul } });
  }

  async function bagikan() {
    const url = urlHalaman(b);
    try {
      // iOS menggabungkan message + url sendiri; Android hanya membaca message.
      await Share.share(Platform.OS === 'ios' ? { message: b.judul, url } : { message: `${b.judul}\n${url}` });
    } catch {
      // Lembar bagikan ditutup atau gagal dibuka — tidak perlu diberitahukan.
    }
  }

  return (
    <View style={[styles.kartu, { width: lebar, height: tinggi }]}>
      {b.media.length > 1 ? (
        <FlatList
          horizontal
          pagingEnabled
          nestedScrollEnabled
          decelerationRate="fast"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!zoom}
          data={b.media}
          keyExtractor={(m, i) => `${i}-${m.url}`}
          getItemLayout={(_, i) => ({ length: lebar, offset: lebar * i, index: i })}
          initialNumToRender={1}
          windowSize={3}
          onMomentumScrollEnd={(e) => setIndeks(Math.round(e.nativeEvent.contentOffset.x / lebar))}
          renderItem={({ item, index }) => (
            <View style={{ width: lebar, height: tinggi }}>
              <MediaUmpan
                media={item}
                penuh={b.vertikal}
                putar={putar && index === indeks}
                siapkan={siapkan && index === indeks}
                bisu={bisu}
                onKetukGanda={ketukGanda}
                onZoom={gantiZoom}
                onTekanLama={tekanLama}
              />
            </View>
          )}
        />
      ) : (
        <MediaUmpan
          media={b.media[0] ?? { jenis: 'gambar', url: '' }}
          penuh={b.vertikal}
          putar={putar}
          siapkan={siapkan}
          bisu={bisu}
          onKetukGanda={ketukGanda}
          onZoom={gantiZoom}
          onTekanLama={tekanLama}
        />
      )}

      {hati.map((h) => (
        <HatiKetukGanda key={h.id} hati={h} onSelesai={hapusHati} />
      ))}

      <Animated.View pointerEvents="none" style={[styles.gradasiAtas, { height: atas + Spacing.five }, gayaTampak]} />
      <Animated.View pointerEvents="none" style={[styles.gradasiBawah, gayaTampak]} />

      {/* Titik penanda tetap tampil di mode bersih: tanda masih ada foto lain untuk digeser. */}
      {b.media.length > 1 && (
        <View pointerEvents="none" style={[styles.titik, zoom && styles.sembunyi]}>
          {b.media.map((m, i) => (
            <View key={`${i}-${m.url}`} style={[styles.bulatan, i === indeks && styles.bulatanAktif]} />
          ))}
        </View>
      )}

      {terbuka && !bersih && (
        <Pressable style={styles.selubung} onPress={() => setTerbuka(false)} accessibilityLabel="Tutup cerita" />
      )}

      <Animated.View style={[styles.aksi, gayaTampak]} pointerEvents={sembunyikan ? 'none' : 'auto'}>
        <TombolAksi
          ikon="heart"
          warna={disukai ? '#ff2d55' : '#fff'}
          label={hitunganTeks(jumlahSuka)}
          aksesLabel={disukai ? 'Batal suka' : 'Suka'}
          onPress={tekanSuka}
        />
        <TombolAksi ikon="chatbubble-ellipses" label={hitunganTeks(b.jumlahKomentar)} onPress={bukaKomentar} />
        <TombolAksi ikon="arrow-redo" label="Bagikan" onPress={() => void bagikan()} />
        <TombolAksi ikon="location" label="Peta" onPress={kePeta} />
        {media?.jenis === 'video' && (
          <TombolAksi ikon={bisu ? 'volume-mute' : 'volume-high'} label={bisu ? 'Bisu' : 'Suara'} onPress={onBisu} />
        )}
      </Animated.View>

      <Animated.View
        style={[styles.cerita, b.media.length > 1 && styles.ceritaBertitik, gayaTampak]}
        pointerEvents={sembunyikan ? 'none' : 'auto'}>
        <View style={styles.barisInfo}>
          {tempat !== '' && (
            <Pressable onPress={kePeta} style={styles.chip} accessibilityRole="button" accessibilityLabel={`Lihat ${tempat} di peta`}>
              <Ionicons name="location" size={12} color="#fff" />
              <Text style={styles.chipTeks} numberOfLines={1}>
                {tempat}
              </Text>
            </Pressable>
          )}
          {jarak !== null && <Text style={styles.info}>{jarakTeks(jarak)}</Text>}
        </View>

        <Text style={styles.judul} numberOfLines={terbuka ? undefined : 2}>
          {b.judul}
        </Text>

        {b.deskripsi &&
          (terbuka ? (
            // nestedScrollEnabled: tanpanya di Android umpan (FlatList induk) yang menangkap geseran.
            <ScrollView nestedScrollEnabled style={{ maxHeight: tinggi * 0.4 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.deskripsi} onPress={() => setTerbuka(false)}>
                {b.deskripsi}
              </Text>
            </ScrollView>
          ) : (
            <Text style={styles.deskripsi} numberOfLines={2} onPress={() => setTerbuka(true)}>
              {b.deskripsi}
            </Text>
          ))}
        {b.deskripsi && b.deskripsi.length > 90 && (
          <Text style={styles.lagi} onPress={() => setTerbuka((x) => !x)}>
            {terbuka ? 'Tutup' : 'Selengkapnya'}
          </Text>
        )}

        <Text style={styles.info}>
          {b.tanggal}
          {media?.keterangan ? `  ·  Foto/video: ${media.keterangan}` : ''}
        </Text>
      </Animated.View>
    </View>
  );
});

function TombolAksi({
  ikon,
  label,
  aksesLabel,
  warna = '#fff',
  onPress,
}: {
  ikon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  aksesLabel?: string;
  warna?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={aksesLabel ?? label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.tombolAksi, pressed && { transform: [{ scale: 0.9 }] }]}>
      <Ionicons name={ikon} size={32} color={warna} style={styles.bayanganIkon} />
      <Text style={styles.labelAksi}>{label}</Text>
    </Pressable>
  );
}

const bayangan = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

const styles = StyleSheet.create({
  kartu: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  gradasiAtas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))',
  },
  gradasiBawah: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.75))',
  },
  sembunyi: {
    opacity: 0,
  },
  selubung: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  titik: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.two + 2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  bulatan: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  bulatanAktif: {
    backgroundColor: '#fff',
  },
  aksi: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three + 2,
  },
  tombolAksi: {
    alignItems: 'center',
    gap: 2,
    minWidth: 56,
  },
  bayanganIkon: bayangan,
  labelAksi: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    ...bayangan,
  },
  cerita: {
    position: 'absolute',
    left: Spacing.three,
    right: 80,
    bottom: Spacing.three,
    gap: 6,
  },
  /** Ruang untuk titik-titik penanda media di bawahnya. */
  ceritaBertitik: {
    bottom: Spacing.five,
  },
  barisInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  chipTeks: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  judul: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
    ...bayangan,
  },
  deskripsi: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 19,
    ...bayangan,
  },
  lagi: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '800',
    ...bayangan,
  },
  info: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    ...bayangan,
  },
});
