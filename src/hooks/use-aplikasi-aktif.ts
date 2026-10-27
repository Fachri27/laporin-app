import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

function pantau(ubah: () => void) {
  const sub = AppState.addEventListener('change', ubah);
  return () => sub.remove();
}

/**
 * Apakah aplikasi sedang di depan (tidak di latar belakang). Video yang diputar otomatis
 * berhenti sendiri saat aplikasi ditinggalkan, tetapi tidak jalan lagi saat kembali —
 * dengan ini pemutarnya bisa dilanjutkan.
 */
export function useAplikasiAktif(): boolean {
  return useSyncExternalStore(pantau, () => AppState.currentState !== 'background');
}
