import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BilahAtas } from '@/components/bilah-atas';
import { Tombol } from '@/components/tombol';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const w = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      <StatusBar style="auto" />
      <BilahAtas judul="Siaran langsung" onKembali={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.isi, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.ikon, { backgroundColor: w.accentSoft }]}>
          <Ionicons name={ikon} size={28} color={w.accentText} />
        </View>
        <Text style={[styles.judul, { color: w.text }]}>{judul}</Text>
        <Text style={[styles.teks, { color: w.textSecondary }]}>{teks}</Text>
        <View style={[styles.kotakKode, { backgroundColor: w.surface, borderColor: w.border }]}>
          <Text selectable style={[styles.kode, { color: w.text }]}>
            {kode}
          </Text>
        </View>
        <Tombol judul="Kembali" ragam="terang" besar onPress={() => router.back()} style={styles.tombol} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  isi: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  ikon: {
    width: 64,
    height: 64,
    marginBottom: 4,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  judul: {
    maxWidth: 340,
    fontFamily: Fonts.judulTebal,
    fontSize: 21,
    lineHeight: 26,
    textAlign: 'center',
  },
  teks: {
    maxWidth: 340,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  kotakKode: {
    alignSelf: 'stretch',
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  kode: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 19,
  },
  tombol: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
});
