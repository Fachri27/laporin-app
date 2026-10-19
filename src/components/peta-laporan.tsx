import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { urlGambar, useUmpan, type Berita } from '@/lib/umpan';

const INDONESIA = { latitude: -2.5, longitude: 118, latitudeDelta: 22, longitudeDelta: 42 };

function regionDari(b: Berita) {
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
 * Titik semua laporan di umpan. Laporan terpilih disimpan di parameter `id`,
 * jadi tombol "Peta" di beranda cukup membuka /peta?id=… untuk menyorotnya.
 * Dimuat malas oleh app/peta.tsx.
 */
export default function PetaLaporan() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { status, berita } = useUmpan();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const peta = useRef<MapView>(null);
  const pilih = berita.find((b) => String(b.id) === id) ?? null;
  // Laporan yang dibuka dari kartu langsung jadi region awal, tanpa menunggu peta siap.
  const [regionAwal] = useState(() => (pilih ? regionDari(pilih) : INDONESIA));
  /**
   * Laporan yang sudah ada di layar kamera: region awal, atau dipilih dari peta
   * (penanda, geser dalam satu titik). Kamera hanya terbang ke laporan lain.
   */
  const disorot = useRef<number | null>(pilih?.id ?? null);
  const [siap, setSiap] = useState(false);
  const awal = pilih?.media[0];
  const sampul = awal?.jenis === 'video' ? awal.poster : awal?.url;

  // Satu penanda per titik; di dalam titik urutannya mengikuti umpan (terbaru dulu).
  const titik = new Map<string, Berita[]>();
  for (const b of berita) {
    const k = kunciTitik(b);
    const isi = titik.get(k);
    if (isi) isi.push(b);
    else titik.set(k, [b]);
  }
  const setitik = pilih ? (titik.get(kunciTitik(pilih)) ?? [pilih]) : [];
  const ke = pilih ? setitik.indexOf(pilih) : -1;

  // Perintah kamera sebelum peta siap dibuang diam-diam di Android. Umpan yang dimuat
  // ulang mengganti objek `pilih`, tetapi laporan yang sama tidak menggerakkan kamera lagi.
  useEffect(() => {
    if (!siap || !pilih || disorot.current === pilih.id) return;
    disorot.current = pilih.id;
    peta.current?.animateToRegion(regionDari(pilih), 600);
  }, [siap, pilih]);

  function pilihDariPeta(b: Berita) {
    disorot.current = b.id;
    router.setParams({ id: String(b.id) });
  }

  /** Laporan lain di titik yang sama, berputar. */
  function geser(arah: 1 | -1) {
    pilihDariPeta(setitik[(ke + arah + setitik.length) % setitik.length]);
  }

  return (
    <View style={styles.layar}>
      <MapView
        ref={peta}
        style={StyleSheet.absoluteFill}
        initialRegion={regionAwal}
        showsUserLocation
        showsMyLocationButton
        toolbarEnabled={false}
        onMapReady={() => setSiap(true)}
        onPress={(e) => {
          // iOS ikut memanggil onPress peta saat penanda diketuk.
          if (e.nativeEvent.action !== 'marker-press') router.setParams({ id: undefined });
        }}>
        {[...titik.values()].map((isi) => (
          <Marker
            key={isi[0].id}
            coordinate={{ latitude: isi[0].lat, longitude: isi[0].lng }}
            pinColor={w.accent}
            tracksViewChanges={false}
            // Mengetuk lagi titik yang sedang dibuka tidak mengembalikan kartu ke laporan pertama.
            onPress={() => pilihDariPeta(pilih && isi.includes(pilih) ? pilih : isi[0])}
          />
        ))}
      </MapView>

      {/* Header layar sudah di atas peta, jadi tidak perlu jarak status bar. */}
      <View style={[styles.pil, { top: Spacing.two, backgroundColor: w.surface, borderColor: w.border }]}>
        {status === 'memuat' ? (
          <ActivityIndicator color={w.accentText} size="small" />
        ) : (
          <Ionicons name="flame" size={14} color={w.accentText} />
        )}
        <Text style={[styles.pilTeks, { color: w.text }]}>
          {status === 'galat' ? 'Laporan gagal dimuat' : `${berita.length} laporan karhutla`}
        </Text>
      </View>

      {pilih && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            setitik.length > 1
              ? `Tonton laporan ${pilih.judul}, ${ke + 1} dari ${setitik.length} di titik ini`
              : `Tonton laporan ${pilih.judul}`
          }
          // VoiceOver membaca kartu sebagai satu tombol, jadi tombol geser di dalamnya tak terjangkau:
          // sediakan juga sebagai aksi aksesibilitas.
          accessibilityActions={
            setitik.length > 1
              ? [
                  { name: 'sebelumnya', label: 'Laporan sebelumnya di titik ini' },
                  { name: 'berikutnya', label: 'Laporan berikutnya di titik ini' },
                ]
              : undefined
          }
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'berikutnya') geser(1);
            else if (e.nativeEvent.actionName === 'sebelumnya') geser(-1);
          }}
          // Kembali ke beranda yang sudah ada di tumpukan, langsung di laporan ini.
          onPress={() => router.dismissTo({ pathname: '/', params: { laporan: String(pilih.id) } })}
          style={({ pressed }) => [
            styles.kartu,
            { bottom: insets.bottom + Spacing.three, backgroundColor: pressed ? w.accentSoft : w.surface, borderColor: w.border },
          ]}>
          {sampul ? (
            <Image source={{ uri: urlGambar(sampul, 256) }} style={styles.sampul} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.sampul, { backgroundColor: w.border }]} />
          )}
          <View style={styles.fleks}>
            <Text style={[styles.judul, { color: w.text }]} numberOfLines={2}>
              {pilih.judul}
            </Text>
            <Text style={[styles.info, { color: w.textSecondary }]} numberOfLines={1}>
              {[pilih.provinsi, pilih.tanggal].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.barisBawah}>
              <View style={styles.tonton}>
                <Ionicons name="play" size={14} color={w.accentText} />
                <Text style={[styles.tontonTeks, { color: w.accentText }]}>Tonton</Text>
              </View>
              {setitik.length > 1 && (
                <View style={styles.tonton}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Laporan sebelumnya di titik ini"
                    hitSlop={10}
                    onPress={() => geser(-1)}>
                    <Ionicons name="chevron-back" size={18} color={w.textSecondary} />
                  </Pressable>
                  <Text style={[styles.info, { color: w.textSecondary }]}>
                    {ke + 1} dari {setitik.length}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Laporan berikutnya di titik ini"
                    hitSlop={10}
                    onPress={() => geser(1)}>
                    <Ionicons name="chevron-forward" size={18} color={w.textSecondary} />
                  </Pressable>
                </View>
              )}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup"
            hitSlop={10}
            onPress={() => router.setParams({ id: undefined })}>
            <Ionicons name="close" size={20} color={w.textSecondary} />
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  fleks: {
    flex: 1,
    gap: 3,
  },
  pil: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pilTeks: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  kartu: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.two + 2,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sampul: {
    width: 76,
    height: 76,
    borderRadius: Radius.medium,
  },
  judul: {
    fontSize: 15,
    fontFamily: Fonts.judulTebal,
    lineHeight: 20,
  },
  info: {
    fontSize: 12.5,
  },
  barisBawah: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  tonton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tontonTeks: {
    fontSize: 13,
    fontFamily: Fonts.judulTebal,
  },
});
