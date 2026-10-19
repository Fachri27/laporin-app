import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Media } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ambilDraf } from '@/lib/draf-laporan';
import { pulihkanPilihanGaleri } from '@/lib/galeri';

type Ikon = ComponentProps<typeof Ionicons>['name'];

type Item =
  | { jenis: 'tab'; name: string; label: string; ikon: Ikon; ikonAktif: Ikon }
  | { jenis: 'lapor' | 'live'; label: string; ikon: Ikon };

const ITEM: Item[] = [
  { jenis: 'tab', name: 'index', label: 'Beranda', ikon: 'home-outline', ikonAktif: 'home' },
  { jenis: 'tab', name: 'jelajah', label: 'Jelajah', ikon: 'search-outline', ikonAktif: 'search' },
  { jenis: 'lapor', label: 'Lapor', ikon: 'add' },
  { jenis: 'live', label: 'Live', ikon: 'radio-outline' },
  { jenis: 'tab', name: 'profil', label: 'Profil', ikon: 'person-outline', ikonAktif: 'person' },
];

/** Tinggi isi bilah tanpa ruang aman bawah. */
const TINGGI_ISI = 58;

/** Tinggi bilah bawah, termasuk ruang aman bawah. */
function tinggiBilahBawah(bawahAman: number): number {
  return TINGGI_ISI + Math.max(bawahAman, 10);
}

/**
 * Bilah bawah dari desain: Beranda · Jelajah · ➕ · Live · Profil. ➕ dan Live
 * bukan tab — ➕ membuka kamera (atau melanjutkan draf), Live membuka siaran.
 * Di beranda bilahnya hitam pekat; di halaman lain mengikuti tema halaman.
 */
export function BilahBawah({ state, navigation, insets }: BottomTabBarProps) {
  const w = useTheme();
  const aktif = state.routes[state.index];
  // Di beranda bilahnya hitam pekat supaya menyatu dengan video.
  const gelap = aktif.name === 'index';
  const warna = gelap
    ? { aktif: '#fff', biasa: 'rgba(255,255,255,0.6)', latar: '#000', garis: 'rgba(255,255,255,0.1)' }
    : { aktif: w.text, biasa: w.textSecondary, latar: w.background, garis: w.border };

  function tekanTab(name: string) {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    // tabPress tetap dipancarkan supaya useScrollToTop di beranda bekerja saat tab ditekan ulang.
    const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!e.defaultPrevented && aktif.key !== route.key) navigation.navigate(name);
  }

  // Android bisa mematikan aplikasi saat galeri terbuka: ambil pilihan yang tertunda ke draf,
  // lalu ➕ melanjutkannya. Bilah ini terpasang sejak aplikasi dibuka.
  useEffect(() => {
    void pulihkanPilihanGaleri();
  }, []);

  // navigate, bukan push: ketukan ganda sebelum layar terbuka tidak menumpuk dua kamera/siaran.
  function lapor() {
    if (ambilDraf().lampiran.length > 0) router.navigate('/lapor');
    else router.navigate({ pathname: '/kamera', params: { lanjut: '1' } });
  }

  return (
    <View
      style={[
        styles.bilah,
        {
          height: tinggiBilahBawah(insets.bottom),
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: warna.latar,
          borderTopColor: warna.garis,
        },
      ]}>
      {ITEM.map((item) => {
        if (item.jenis === 'lapor') {
          return (
            <Pressable
              key="lapor"
              accessibilityRole="button"
              accessibilityLabel="Buat laporan"
              onPress={lapor}
              style={({ pressed }) => [styles.slot, pressed && styles.ditekan]}>
              <View style={styles.tombolLapor}>
                <Ionicons name="add" size={26} color={Media.onLimau} />
              </View>
              <Text style={[styles.label, { color: warna.biasa }]}>{item.label}</Text>
            </Pressable>
          );
        }
        const fokus = item.jenis === 'tab' && aktif.name === item.name;
        return (
          <Pressable
            key={item.label}
            accessibilityRole={item.jenis === 'tab' ? 'tab' : 'button'}
            accessibilityState={{ selected: fokus }}
            accessibilityLabel={item.jenis === 'live' ? 'Siaran langsung' : item.label}
            onPress={() => (item.jenis === 'tab' ? tekanTab(item.name) : router.navigate('/live'))}
            style={styles.slot}>
            <View style={styles.wadahIkon}>
              <Ionicons
                name={fokus && item.jenis === 'tab' ? item.ikonAktif : item.ikon}
                size={24}
                color={fokus ? warna.aktif : warna.biasa}
              />
            </View>
            <Text style={[styles.label, { color: fokus ? warna.aktif : warna.biasa }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bilah: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 9,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingBottom: 2,
  },
  ditekan: {
    transform: [{ scale: 0.94 }],
  },
  wadahIkon: {
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tombolLapor: {
    width: 48,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Media.limau,
    boxShadow: '0 5px 18px rgba(184,243,74,0.25)',
  },
  label: {
    fontFamily: Fonts.semibold,
    fontSize: 11,
  },
});
