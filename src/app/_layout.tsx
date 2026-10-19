import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// Splash tetap tampil sampai huruf desain (DM Sans, Manrope) termuat.
void SplashScreen.preventAutoHideAsync();

// Tautan laporkarhutla://komentar/123 dsb. yang membuka aplikasi dari luar tetap
// punya beranda di bawahnya: Tutup/kembali tidak keluar dari aplikasi.
export const unstable_settings = { anchor: '(tabs)' };

/** Layar berlatar gelap (media): ikon status bar harus terang, juga di mode terang HP. */
const LAYAR_GELAP = new Set(['kamera', 'live', 'tonton/[ruang]']);
/** Lembar dari bawah: status bar berada di atas layar di belakangnya. */
const LEMBAR = new Set(['komentar/[id]', 'laporkan', 'masuk']);

type RuteAkar = { name: string; state?: { index?: number; routes: { name: string }[] } };

/** Apakah yang tampil di bawah status bar layar gelap. Beranda (umpan) juga gelap. */
function statusBarDiAtasGelap(state: { index: number; routes: RuteAkar[] }): boolean {
  let i = state.index;
  while (i > 0 && LEMBAR.has(state.routes[i].name)) i--;
  const r = state.routes[i];
  if (!r) return false;
  if (r.name === '(tabs)') return (r.state?.routes[r.state.index ?? 0]?.name ?? 'index') === 'index';
  return LAYAR_GELAP.has(r.name);
}

export default function RootLayout() {
  const gelap = useColorScheme() === 'dark';
  const w = useTheme();
  const dasar = gelap ? DarkTheme : DefaultTheme;
  // Satu sumber gaya status bar untuk seluruh Stack, dari state navigasi akar: layar
  // yang tetap terpasang di bawah layar lain tidak bisa "membocorkan" gayanya.
  const [diAtasGelap, setDiAtasGelap] = useState(true);
  const [hurufSiap, hurufGalat] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (hurufSiap || hurufGalat) void SplashScreen.hideAsync();
  }, [hurufSiap, hurufGalat]);

  // Gagal memuat huruf bukan alasan untuk tidak membuka aplikasi: pakai huruf sistem.
  if (!hurufSiap && !hurufGalat) return null;

  return (
    // Gesture cubit (zoom) di kamera & beranda butuh akar gesture-handler.
    <GestureHandlerRootView style={styles.akar}>
      <ThemeProvider
        value={{
          ...dasar,
          colors: {
            ...dasar.colors,
            primary: w.accentText,
            background: w.background,
            card: w.background,
            text: w.text,
            border: w.border,
          },
        }}>
        <StatusBar style={diAtasGelap ? 'light' : 'auto'} />
        <Stack
          screenListeners={{
            state: (e) => setDiAtasGelap(statusBarDiAtasGelap(e.data.state as { index: number; routes: RuteAkar[] })),
          }}
          screenOptions={{
            // Label "‹ Beranda" menyesatkan bila layar dibuka dari Jelajah/Profil: cukup panah.
            headerBackButtonDisplayMode: 'minimal',
            headerTintColor: w.text,
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: Fonts.judul, fontSize: 16 },
            headerStyle: { backgroundColor: w.background },
            contentStyle: { backgroundColor: w.background },
          }}>
          {/* Beranda (umpan ala video pendek) + profil, dengan tombol ➕ untuk melapor. */}
          <Stack.Screen name="(tabs)" options={{ title: 'Beranda', headerShown: false }} />
          <Stack.Screen name="lapor" options={{ title: 'Detail laporan' }} />
          <Stack.Screen name="peta" options={{ title: 'Peta laporan' }} />
          <Stack.Screen name="pengaturan" options={{ title: 'Pengaturan dan privasi' }} />
          <Stack.Screen name="profil-ubah" options={{ title: 'Edit profil', presentation: 'modal' }} />
          <Stack.Screen name="ketentuan" options={{ title: 'Ketentuan Penggunaan' }} />
          <Stack.Screen name="privasi" options={{ title: 'Kebijakan Privasi' }} />
          <Stack.Screen
            name="laporkan"
            options={{
              presentation: 'formSheet',
              headerShown: false,
              sheetAllowedDetents: [0.85, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 20,
            }}
          />
          <Stack.Screen
            name="komentar/[id]"
            options={{
              presentation: 'formSheet',
              headerShown: false,
              sheetAllowedDetents: [0.65, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 20,
            }}
          />
          <Stack.Screen
            name="masuk"
            options={{
              presentation: 'formSheet',
              headerShown: false,
              sheetAllowedDetents: 'fitToContents',
              sheetGrabberVisible: true,
              sheetCornerRadius: 20,
            }}
          />
          <Stack.Screen
            name="kamera"
            options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="live"
            options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="tonton/[ruang]"
            options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen name="terkirim" options={{ headerShown: false, gestureEnabled: false }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  akar: {
    flex: 1,
  },
});
