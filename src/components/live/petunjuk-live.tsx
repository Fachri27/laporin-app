import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tombol } from '@/components/tombol';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

/** Layar petunjuk saat fitur siaran belum bisa dipakai (Expo Go, mode demo). */
export function Petunjuk({
  ikon,
  judul,
  teks,
  kode,
}: {
  ikon: ComponentProps<typeof Ionicons>['name'];
  judul: string;
  teks: string;
  kode: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.layar, styles.tengah, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four }]}>
      <Ionicons name={ikon} size={56} color={Colors.dark.accent} />
      <Text style={styles.judul}>{judul}</Text>
      <Text style={styles.teks}>{teks}</Text>
      <Text selectable style={styles.kode}>
        {kode}
      </Text>
      <Tombol judul="Kembali" besar onPress={() => router.back()} style={styles.tombol} />
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
    backgroundColor: '#000',
  },
  tengah: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  judul: {
    color: '#fff',
    fontSize: 21,
    fontFamily: Fonts.judulTebal,
    textAlign: 'center',
  },
  teks: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  kode: {
    alignSelf: 'stretch',
    color: '#f0f0f0',
    fontFamily: Fonts.mono,
    fontSize: 12.5,
    lineHeight: 19,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  tombol: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
});
