import { requireOptionalNativeModule } from 'expo';

/**
 * Penyimpanan kecil yang terenkripsi (Keychain iOS / Keystore Android) untuk
 * token sesi dan profil akun, lewat expo-secure-store.
 *
 * Build yang dibuat sebelum expo-secure-store dipasang tidak punya modul
 * native-nya, dan mengimpornya di sana langsung crash. Di build seperti itu
 * nilai hanya diingat selama aplikasi terbuka — cukup untuk menguji.
 */
const ADA_NATIVE = requireOptionalNativeModule('ExpoSecureStore') != null;
const cadangan = new Map<string, string>();

async function modul() {
  return ADA_NATIVE ? await import('expo-secure-store') : null;
}

export async function bacaAman(kunci: string): Promise<string | null> {
  try {
    const m = await modul();
    return m ? await m.getItemAsync(kunci) : (cadangan.get(kunci) ?? null);
  } catch {
    return null;
  }
}

export async function simpanAman(kunci: string, nilai: string): Promise<void> {
  try {
    const m = await modul();
    if (m) await m.setItemAsync(kunci, nilai);
    else cadangan.set(kunci, nilai);
  } catch {
    // Gagal menyimpan = harus masuk lagi saat aplikasi dibuka ulang; tidak fatal.
  }
}

export async function hapusAman(kunci: string): Promise<void> {
  try {
    const m = await modul();
    if (m) await m.deleteItemAsync(kunci);
    else cadangan.delete(kunci);
  } catch {
    // Abaikan: nilainya akan tertimpa saat masuk berikutnya.
  }
}
