import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Siaran langsung memakai LiveKit (WebRTC), yang butuh modul native. Modul itu
 * tidak ada di Expo Go — hanya di development build (`npx expo run:android`,
 * `eas build --profile development`). Di Expo Go seluruh fitur lapor tetap
 * jalan; hanya layar siaran yang menampilkan petunjuk.
 *
 * Berkas ini sengaja tanpa impor LiveKit: ia dibaca index.js sebelum apa pun.
 */
export const siaranTersedia =
  Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
