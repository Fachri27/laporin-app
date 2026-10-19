import * as Location from 'expo-location';
import { useSyncExternalStore } from 'react';
import { AppState, Linking, Platform, type AppStateStatus } from 'react-native';

/**
 * Posisi GPS live yang dibagi ke semua layar.
 *
 * Satu langganan watchPositionAsync untuk seluruh aplikasi: layar form dan
 * layar kamera membaca angka yang sama, dan GPS mati sendiri begitu tidak ada
 * layar yang memakainya (hemat baterai di lapangan).
 */

export type StatusLokasi = 'memuat' | 'ditolak' | 'mati' | 'mencari' | 'aktif';

export type PosisiLive = {
  lat: number;
  lng: number;
  /** Radius ketidakpastian dalam meter. */
  akurasi: number | null;
  ketinggian: number | null;
  /** Epoch ms saat posisi diukur. */
  waktu: number;
};

type Keadaan = { status: StatusLokasi; posisi: PosisiLive | null };

let keadaan: Keadaan = { status: 'memuat', posisi: null };
const pendengar = new Set<() => void>();
let pemakai = 0;
let langganan: Location.LocationSubscription | null = null;
let pantauAplikasi: { remove: () => void } | null = null;
/** Naik setiap mulai/berhenti, supaya hasil async dari sesi lama diabaikan. */
let sesi = 0;

function ubah(sebagian: Partial<Keadaan>) {
  keadaan = { ...keadaan, ...sebagian };
  for (const f of pendengar) f();
}

function dari(lok: Location.LocationObject): PosisiLive {
  return {
    lat: lok.coords.latitude,
    lng: lok.coords.longitude,
    akurasi: lok.coords.accuracy,
    ketinggian: lok.coords.altitude,
    waktu: lok.timestamp,
  };
}

async function mulai() {
  const ini = ++sesi;
  const masihSesiIni = () => ini === sesi;
  // Posisi dari sesi lama (aplikasi bisa hidup di latar berjam-jam) mungkin dari tempat lain
  // sama sekali — jangan sampai tampil atau terkirim seolah posisi sekarang.
  ubah(masihSegar(keadaan.posisi, Date.now(), 5 * 60_000) ? { status: 'memuat' } : { status: 'memuat', posisi: null });
  try {
    const izin = await Location.requestForegroundPermissionsAsync();
    if (!masihSesiIni()) return;
    if (!izin.granted) return ubah({ status: 'ditolak' });

    if (!(await Location.hasServicesEnabledAsync())) {
      if (masihSesiIni()) ubah({ status: 'mati' });
      return;
    }
    if (!masihSesiIni()) return;
    ubah({ status: 'mencari' });

    // Posisi terakhir yang diketahui muncul seketika; GPS presisi menyusul.
    const terakhir = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(
      () => null,
    );
    if (!masihSesiIni()) return;
    if (terakhir && (!keadaan.posisi || terakhir.timestamp > keadaan.posisi.waktu)) ubah({ posisi: dari(terakhir) });

    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 0 },
      (lok) => {
        if (masihSesiIni()) ubah({ status: 'aktif', posisi: dari(lok) });
      },
      () => {
        if (masihSesiIni() && keadaan.status !== 'aktif') ubah({ status: 'mati' });
      },
    );
    if (!masihSesiIni()) return sub.remove();
    langganan = sub;
  } catch {
    if (masihSesiIni()) ubah({ status: 'mati' });
  }
}

function berhenti() {
  sesi++;
  langganan?.remove();
  langganan = null;
}

/**
 * Kembali dari Pengaturan dengan izin baru diberikan atau GPS baru dinyalakan → langsung
 * cari lagi, tanpa warga harus menekan "Coba lagi".
 */
function saatAplikasiAktif(s: AppStateStatus) {
  if (s !== 'active' || pemakai === 0) return;
  if (keadaan.status === 'ditolak') {
    // Hanya cek, jangan meminta: di Android dialog izin sendiri memicu 'active' sehingga
    // meminta di sini bisa memunculkan dialog berulang.
    Location.getForegroundPermissionsAsync().then(
      (izin) => {
        if (izin.granted) ulangiLokasi();
      },
      () => {},
    );
  } else if (keadaan.status === 'mati') {
    Location.hasServicesEnabledAsync().then(
      (nyala) => {
        if (nyala) ulangiLokasi();
      },
      () => {},
    );
  }
}

function langgan(f: () => void) {
  pendengar.add(f);
  pemakai++;
  if (pemakai === 1) {
    pantauAplikasi = AppState.addEventListener('change', saatAplikasiAktif);
    void mulai();
  }
  return () => {
    pendengar.delete(f);
    pemakai--;
    if (pemakai === 0) {
      pantauAplikasi?.remove();
      pantauAplikasi = null;
      berhenti();
    }
  };
}

/** Coba lagi setelah izin diberikan atau GPS dinyalakan. */
export function ulangiLokasi() {
  berhenti();
  if (pemakai > 0) void mulai();
}

/**
 * Aksi untuk pesan "lokasi tidak diizinkan" / "GPS mati": minta izin lagi bila masih boleh
 * bertanya, buka Pengaturan bila sudah ditolak permanen; Android menawarkan menyalakan GPS.
 */
export async function perbaikiLokasi() {
  if (keadaan.status === 'ditolak') {
    const izin = await Location.getForegroundPermissionsAsync().catch(() => null);
    if (izin && !izin.granted && !izin.canAskAgain) return void Linking.openSettings();
  } else if (keadaan.status === 'mati' && Platform.OS === 'android') {
    await Location.enableNetworkProviderAsync().catch(() => {});
  }
  ulangiLokasi();
}

export function ambilPosisi(): PosisiLive | null {
  return keadaan.posisi;
}

/** Umur maksimum posisi GPS yang boleh menjadi titik laporan atau ditempel ke foto/video. */
export const BATAS_UMUR_POSISI_MS = 2 * 60_000;

/**
 * Posisi terakhir, hanya bila masih segar. Posisi basi (GPS hilang di bawah kanopi, atau
 * sisa sesi lama) bisa meleset berkilo-kilometer — lebih baik tanpa titik daripada titik salah.
 */
export function posisiSegar(batasMs = BATAS_UMUR_POSISI_MS): PosisiLive | null {
  return masihSegar(keadaan.posisi, Date.now(), batasMs) ? keadaan.posisi : null;
}

/**
 * Posisi sekali ambil, akurasi sedang — untuk keperluan yang tidak butuh GPS
 * live, mis. mengurutkan laporan terdekat. Tidak menyalakan langganan GPS.
 * `null` bila izin ditolak atau lokasi tidak didapat.
 */
export async function posisiSekali(): Promise<PosisiLive | null> {
  if (masihSegar(keadaan.posisi, Date.now(), 10 * 60_000)) return keadaan.posisi;
  try {
    const izin = await Location.requestForegroundPermissionsAsync();
    if (!izin.granted) return null;
    const terakhir = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }).catch(() => null);
    if (terakhir) return dari(terakhir);
    return dari(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  } catch {
    return null;
  }
}

export function useLokasiLive(): Keadaan {
  return useSyncExternalStore(langgan, () => keadaan);
}

/** Posisi dianggap "live" bila diukur dalam 15 detik terakhir. */
export function masihSegar(posisi: PosisiLive | null, kini: number, batasMs = 15_000): boolean {
  return posisi !== null && kini - posisi.waktu <= batasMs;
}

export function koordinatTeks(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
