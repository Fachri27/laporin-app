import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { durasiTeks } from '@/lib/batas-laporan';
import type { Lampiran } from '@/lib/draf-laporan';

type Props = {
  lampiran: Lampiran[];
  onHapus: (id: string) => void;
  nonaktif?: boolean;
};

export function GridLampiran({ lampiran, onHapus, nonaktif = false }: Props) {
  const w = useTheme();
  return (
    <View style={styles.grid}>
      {lampiran.map((l) => (
        <View key={l.id} style={[styles.ubin, { backgroundColor: w.border }]}>
          {l.jenis === 'foto' ? (
            <Image source={{ uri: l.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.video]}>
              <Ionicons name="videocam" size={28} color="#fff" />
            </View>
          )}

          <View style={styles.lencanaBawah}>
            {l.jenis === 'video' && (
              <View style={styles.lencana}>
                <Ionicons name="play" size={10} color="#fff" />
                <Text style={styles.lencanaTeks}>{l.durasi != null ? durasiTeks(l.durasi) : 'Video'}</Text>
              </View>
            )}
            {l.titik && (
              <View style={styles.lencana}>
                <Ionicons name="location" size={10} color="#fff" />
              </View>
            )}
          </View>

          {!nonaktif && (
            <Pressable
              accessibilityLabel={`Hapus ${l.jenis}`}
              hitSlop={8}
              onPress={() => onHapus(l.id)}
              style={styles.hapus}>
              <Ionicons name="close" size={16} color="#fff" />
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
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  video: {
    backgroundColor: '#1a1919',
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
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  lencanaTeks: {
    color: '#fff',
    fontFamily: Fonts.bold,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  hapus: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
