import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, TurboModuleRegistry } from 'react-native';

/**
 * Peta memakai react-native-maps. Dua hal bisa membuatnya crash saat dibuka:
 *
 * 1. Build tanpa modul native-nya — development build yang dibuat sebelum
 *    react-native-maps dipasang. Expo Go selalu punya.
 * 2. Android tanpa Google Maps API key: Expo Go membawa kuncinya sendiri, tapi
 *    development/production build butuh kunci di plugin react-native-maps, yang
 *    dipasang app.config.js dari env GOOGLE_MAPS_ANDROID_API_KEY (EAS env saat
 *    build/update; di dev ekspor juga saat `expo start`, karena plugin dibaca dari
 *    manifest Metro) — lihat docs/RILIS.md. iOS memakai Apple Maps, tanpa kunci.
 *
 * Web tidak didukung react-native-maps.
 */
export type HalanganPeta = 'web' | 'perlu-build' | 'perlu-kunci' | null;

function adaKunciGoogle(): boolean {
  return (Constants.expoConfig?.plugins ?? []).some(
    (p) =>
      Array.isArray(p) &&
      p[0] === 'react-native-maps' &&
      typeof p[1]?.androidGoogleMapsApiKey === 'string' &&
      p[1].androidGoogleMapsApiKey.trim() !== '',
  );
}

function cariHalangan(): HalanganPeta {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'web';
  if (TurboModuleRegistry.get('RNMapsAirModule') == null) return 'perlu-build';
  if (
    Platform.OS === 'android' &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
    !adaKunciGoogle()
  ) {
    return 'perlu-kunci';
  }
  return null;
}

/** `null` = peta bisa dibuka. */
export const halanganPeta = cariHalangan();
