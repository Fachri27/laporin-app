import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Media, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { durasiTeks } from '@/lib/batas-laporan';
import type { Lampiran } from '@/lib/draf-laporan';

type Props = {
  lampiran: Lampiran[];
  onHapus: (id: string) => void;
  nonaktif?: boolean;
};

/** Kisi bukti foto/video di formulir: ubin persegi bersudut 14 dengan label mono kecil di pojok, tanpa menutup isi. */
export function GridLampiran({ lampiran, onHapus, nonaktif = false }: Props) {
  const w = useTheme();
  return (
    <View style={styles.grid}>
      {lampiran.map((l) => (
        <View key={l.id} style={[styles.ubin, { backgroundColor: w.surfaceMuted, borderColor: w.border }]}>
          {l.jenis === 'foto' ? (
            <Image source={{ uri: l.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.video]}>
              <Ionicons name="videocam" size={28} color={Media.teks} />
            </View>
          )}

          <View style={styles.lencanaBawah}>
            {l.jenis === 'video' && (
              <View style={styles.lencana}>
                <Ionicons name="play" size={10} color={Media.teks} />
                <Text style={styles.lencanaTeks}>{l.durasi != null ? durasiTeks(l.durasi) : 'VIDEO'}</Text>
              </View>
            )}
            {l.titik && (
              <View style={styles.lencana}>
                <Ionicons name="location" size={10} color={Media.teks} />
              </View>
            )}
          </View>

          {!nonaktif && (
            <Pressable
              accessibilityLabel={`Hapus ${l.jenis}`}
              hitSlop={8}
              onPress={() => onHapus(l.id)}
              style={styles.hapus}>
              <Ionicons name="close" size={16} color={Media.teks} />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  ubin: {
    width: '31.5%',
    aspectRatio: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: 'hidden',
  },
  video: {
    backgroundColor: Media.kartu,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lencanaBawah: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    gap: 4,
  },
  lencana: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Media.pil,
  },
  lencanaTeks: {
    color: Media.teks,
    fontFamily: Fonts.monoTebal,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  hapus: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Media.kaca,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
