import { requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';

/**
 * Versi aplikasi + update EAS yang sedang berjalan, mis.
 * "Versi 1.0.0 · pembaruan 14 Okt 17.10 (3f2a1b0) · kanal preview".
 * Supaya penguji (dan kita) tahu update terakhir sudah sampai di HP.
 *
 * Dibaca langsung dari modul native ExpoUpdates — opsional — bukan lewat paket
 * expo-updates: paket itu memanggil requireNativeModule dan langsung crash di
 * development build yang dibuat sebelum expo-updates dipasang.
 */
type ModulUpdates = {
  isEnabled?: boolean;
  updateId?: string | null;
  channel?: string | null;
  isEmbeddedLaunch?: boolean;
  commitTime?: string | number | null;
};

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function versiAplikasi(): string {
  const versi = `Versi ${Constants.expoConfig?.version ?? '?'}`;
  const updates = requireOptionalNativeModule<ModulUpdates>('ExpoUpdates');
  if (!updates?.isEnabled) return __DEV__ ? `${versi} · pengembangan` : versi;

  const bagian = [versi];
  if (updates.isEmbeddedLaunch || !updates.updateId || !updates.commitTime) {
    bagian.push('bawaan build');
  } else {
    // Diformat manual, seperti jamTeks di kamera, supaya tidak bergantung Intl.
    const d = new Date(updates.commitTime);
    const dua = (n: number) => String(n).padStart(2, '0');
    bagian.push(
      `pembaruan ${d.getDate()} ${BULAN[d.getMonth()]} ${dua(d.getHours())}.${dua(d.getMinutes())} (${updates.updateId.slice(0, 7)})`,
    );
  }
  if (updates.channel) bagian.push(`kanal ${updates.channel}`);
  return bagian.join(' · ');
}

export const VERSI_TEKS = versiAplikasi();
