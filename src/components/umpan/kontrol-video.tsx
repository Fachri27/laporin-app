import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { KendaliVideo, StatusPutar } from '@/components/umpan/video-umpan';
import { Fonts, Media, TINTA } from '@/constants/theme';

/** Kontrol hilang sendiri setelah video berjalan sekian lama tanpa disentuh, seperti Netflix. */
const SEMBUNYI_MS = 3000;
const LOMPAT_DETIK = 10;

/** 75 → "1:15". */
function jam(detik: number): string {
  const d = Math.max(0, Math.floor(detik));
  return `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`;
}

type Props = {
  tampil: boolean;
  status: StatusPutar | null;
  kendali: KendaliVideo | null;
  onTampil: (tampil: boolean) => void;
};

/**
 * Kontrol video gaya Netflix di atas pemutar detail laporan: ketuk video = kontrol muncul;
 * mundur 10 detik · putar/jeda (lingkaran tulang) · maju 10 detik di tengah, bilah posisi
 * (ketuk untuk melompat), waktu kapital kecil, dan layar penuh di bawah. Tanpa kontrol, hanya garis
 * tipis posisi putar.
 * Digambar di luar gestur MediaUmpan, jadi tombolnya tidak berebut sentuhan dengan cubit/ketuk ganda.
 */
export function KontrolVideo({ tampil, status, kendali, onTampil }: Props) {
  const [lebarRel, setLebarRel] = useState(0);
  /** Naik setiap tombol disentuh: hitung mundur sembunyi dimulai ulang. */
  const [sentuhan, setSentuhan] = useState(0);
  const main = status?.main ?? false;
  const kemajuan = status && status.durasi > 0 ? Math.min(1, status.detik / status.durasi) : 0;

  useEffect(() => {
    if (!tampil || !main) return;
    const id = setTimeout(() => onTampil(false), SEMBUNYI_MS);
    return () => clearTimeout(id);
  }, [tampil, main, sentuhan, onTampil]);

  function aksi(f: () => void) {
    setSentuhan((n) => n + 1);
    f();
  }

  if (!tampil) {
    return (
      <View pointerEvents="none" style={styles.relTipis}>
        <View style={[styles.isiRel, { width: `${kemajuan * 100}%` }]} />
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
      {/* Mengetuk di luar tombol = sembunyikan kontrol. */}
      <Pressable accessibilityLabel="Sembunyikan kontrol" onPress={() => onTampil(false)} style={[StyleSheet.absoluteFill, styles.redup]} />

      <View pointerEvents="box-none" style={styles.tengah}>
        <Tombol label={`Mundur ${LOMPAT_DETIK} detik`} onPress={() => aksi(() => kendali?.geser(-LOMPAT_DETIK))}>
          <MaterialCommunityIcons name="rewind-10" size={34} color={Media.teks} />
        </Tombol>
        <Tombol label={main ? 'Jeda' : 'Putar'} onPress={() => aksi(() => kendali?.ketuk())} besar>
          {status?.memuat ? (
            <ActivityIndicator color={TINTA} />
          ) : (
            <Ionicons name={main ? 'pause' : 'play'} size={30} color={TINTA} style={!main && styles.geserPutar} />
          )}
        </Tombol>
        <Tombol label={`Maju ${LOMPAT_DETIK} detik`} onPress={() => aksi(() => kendali?.geser(LOMPAT_DETIK))}>
          <MaterialCommunityIcons name="fast-forward-10" size={34} color={Media.teks} />
        </Tombol>
      </View>

      <View pointerEvents="box-none" style={styles.bawah}>
        <Text style={styles.waktu}>{jam(status?.detik ?? 0)}</Text>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel={`Posisi ${jam(status?.detik ?? 0)} dari ${jam(status?.durasi ?? 0)}`}
          onLayout={(e) => setLebarRel(e.nativeEvent.layout.width)}
          onPress={(e) => aksi(() => lebarRel > 0 && kendali?.keFraksi(e.nativeEvent.locationX / lebarRel))}
          hitSlop={{ top: 14, bottom: 14 }}
          style={styles.wadahRel}>
          <View style={styles.rel}>
            <View style={[styles.isiRel, { width: `${kemajuan * 100}%` }]} />
          </View>
          <View style={[styles.kenop, { left: `${kemajuan * 100}%` }]} />
        </Pressable>
        <Text style={styles.waktu}>{jam(status?.durasi ?? 0)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Layar penuh" onPress={() => kendali?.layarPenuh()} hitSlop={10}>
          <MaterialCommunityIcons name="fullscreen" size={26} color={Media.teks} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function Tombol({
  label,
  onPress,
  besar = false,
  children,
}: {
  label: string;
  onPress: () => void;
  besar?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [besar ? styles.tombolBesar : styles.tombol, pressed && styles.ditekan]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  redup: {
    backgroundColor: 'rgba(12,14,13,0.5)',
  },
  tengah: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 44,
  },
  tombol: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tombolBesar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Media.teks,
  },
  ditekan: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
  geserPutar: {
    marginLeft: 3,
  },
  bawah: {
    position: 'absolute',
    left: 14,
    right: 12,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  waktu: {
    minWidth: 34,
    color: Media.teks,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  wadahRel: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
  },
  rel: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: Media.garis,
  },
  isiRel: {
    height: '100%',
    backgroundColor: Media.aksen,
  },
  kenop: {
    position: 'absolute',
    width: 13,
    height: 13,
    marginLeft: -6.5,
    borderRadius: 7,
    backgroundColor: Media.aksen,
  },
  relTipis: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: Media.garis,
  },
});
