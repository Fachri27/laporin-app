import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Bayangan, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pulihkanPilihanGaleri } from '@/lib/galeri';
import { useSiaranPublik } from '@/lib/live';

type Item =
  | { jenis: 'tab'; name: string; label: string; ikon: ComponentProps<typeof Feather>['name'] }
  | { jenis: 'lapor'; label: string };

const ITEM: Item[] = [
  { jenis: 'tab', name: 'index', label: 'Beranda', ikon: 'home' },
  { jenis: 'tab', name: 'peta', label: 'Peta', ikon: 'map' },
  { jenis: 'lapor', label: 'Lapor' },
  { jenis: 'tab', name: 'siaran', label: 'Live', ikon: 'radio' },
  { jenis: 'tab', name: 'profil', label: 'Profil', ikon: 'user' },
];

const TINGGI_BILAH = 64;

/** Jarak bilah dari tepi bawah: desain 26 di iPhone (ruang aman 34), paling sedikit 12. */
function jarakBawah(ruangBawah: number): number {
  return Math.max(ruangBawah - 8, 12);
}

/**
 * Ruang yang ditutupi bilah melayang, dari tepi bawah layar sampai sedikit di atas bilah.
 * Isi yang digulir di layar tab memberi ruang sebesar ini di ujungnya supaya kartu terakhir
 * tidak tertutup; peta & foto boleh terus sampai ke tepi di belakang bilah.
 */
export function ruangBilahBawah(ruangBawah: number): number {
  return jarakBawah(ruangBawah) + TINGGI_BILAH + 16;
}

/**
 * Bilah bawah melayang dari desain: pil tulang (tinta di mode terang) di atas isi, Beranda ·
 * Peta · Lapor · Live · Profil. Tab terpilih = lingkaran tinta berikon tulang. Lapor bukan tab:
 * pil sinyal berikon kamera dengan tulisan, membuka formulir laporan (melanjutkan draf yang
 * belum terkirim). Titik sinyal di Live = ada siaran publik yang sedang berlangsung.
 */
export function BilahBawah({ state, navigation, insets }: BottomTabBarProps) {
  const w = useTheme();
  const aktif = state.routes[state.index];
  // Tanpa memantau sendiri: daftarnya dimuat beranda & tab Live.
  const adaSiaran = useSiaranPublik(false).length > 0;

  function tekanTab(name: string) {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    // tabPress tetap dipancarkan supaya useScrollToTop di beranda bekerja saat tab ditekan ulang.
    const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!e.defaultPrevented && aktif.key !== route.key) navigation.navigate(name);
  }

  // Android bisa mematikan aplikasi saat galeri terbuka: ambil pilihan yang tertunda ke draf,
  // lalu Lapor melanjutkannya. Bilah ini terpasang sejak aplikasi dibuka.
  useEffect(() => {
    void pulihkanPilihanGaleri();
  }, []);

  return (
    <View style={[styles.bilah, { bottom: jarakBawah(insets.bottom), backgroundColor: w.bilah }]}>
      {ITEM.map((item) => {
        if (item.jenis === 'lapor') {
          return (
            <Pressable
              key="lapor"
              accessibilityRole="button"
              accessibilityLabel="Buat laporan"
              // navigate, bukan push: ketukan ganda sebelum layar terbuka tidak menumpuk dua formulir.
              onPress={() => router.navigate('/lapor')}
              style={({ pressed }) => [styles.lapor, { backgroundColor: w.accent }, pressed && styles.ditekan]}>
              <Feather name="camera" size={19} color={w.onAccent} />
              <Text style={[styles.teksLapor, { color: w.onAccent }]} maxFontSizeMultiplier={1.2}>
                {item.label}
              </Text>
            </Pressable>
          );
        }
        const fokus = aktif.name === item.name;
        return (
          <Pressable
            key={item.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: fokus }}
            accessibilityLabel={item.name === 'siaran' && adaSiaran ? `${item.label}, ada siaran berlangsung` : item.label}
            onPress={() => tekanTab(item.name)}
            style={({ pressed }) => [styles.slot, fokus && { backgroundColor: w.onBilah }, pressed && styles.ditekan]}>
            <Feather name={item.ikon} size={21} color={fokus ? w.bilah : w.onBilah} />
            {item.name === 'siaran' && adaSiaran && (
              <View style={[styles.titikLive, { backgroundColor: w.accent, borderColor: fokus ? w.onBilah : w.bilah }]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bilah: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: TINGGI_BILAH,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: TINGGI_BILAH / 2,
    boxShadow: Bayangan.hutan,
  },
  slot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ditekan: {
    transform: [{ scale: 0.94 }],
  },
  lapor: {
    height: 48,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 24,
  },
  teksLapor: {
    fontFamily: Fonts.judulTebal,
    fontSize: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  titikLive: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
  },
});
