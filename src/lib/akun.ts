import { requireOptionalNativeModule } from 'expo';
import { useSyncExternalStore } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

import { API_URL, MODE_DEMO } from '@/lib/api';
import { bacaAman, hapusAman, simpanAman } from '@/lib/penyimpanan-aman';
import type { Komentar } from '@/lib/umpan';

/**
 * Akun warga — OPSIONAL. Melapor dan siaran tetap bisa tanpa akun; akun
 * menambah riwayat laporan, isi nama otomatis, serta suka & komentar.
 *
 * Login dengan Google (Android & iOS) atau Apple (iOS): aplikasi meminta token
 * identitas dari penyedia, lalu menukarnya dengan token sesi milik server
 * (POST /api/mobile/masuk/google|apple). Token sesi disimpan terenkripsi dan
 * dikirim sebagai `Authorization: Bearer …`. Kontrak lengkap: docs/AKUN.md.
 */

export type Pengguna = {
  id: string;
  nama: string;
  email: string | null;
  foto: string | null;
};

export type Statistik = {
  /** Laporan yang dikirim dengan akun ini (bukan yang anonim). */
  laporan: number;
  /** Yang sudah diverifikasi petugas dan tayang. */
  tayang: number;
  /** Laporan di beranda yang disukai akun ini. */
  disukai: number;
};

export type LaporanSaya = {
  id: string;
  judul: string;
  status: 'menunggu' | 'tayang' | 'ditolak';
  /** ISO 8601. */
  dibuat: string;
  /** URL gambar sampul, atau null bila tidak ada. */
  sampul: string | null;
  jumlahBerkas: number;
  /** id kejadian di umpan bila sudah tayang — untuk membukanya di beranda. */
  beritaId: number | null;
};

type Keadaan = {
  status: 'memuat' | 'tamu' | 'masuk';
  pengguna: Pengguna | null;
  statistik: Statistik | null;
  /** id laporan umpan yang disukai akun ini. */
  disukai: ReadonlySet<number>;
  /**
   * Jumlah suka terbaru per laporan setelah warga menekan suka di HP ini —
   * menimpa angka di umpan, yang di-cache situs beberapa menit.
   */
  jumlahSuka: ReadonlyMap<number, number>;
};

const KUNCI_TOKEN = 'lapor-karhutla.sesi';
const KUNCI_PROFIL = 'lapor-karhutla.profil';
const GOOGLE_WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
const GOOGLE_IOS_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();

/** Modul native Google Sign-In hanya ada di development/preview build terbaru, bukan Expo Go. */
const ADA_GOOGLE_NATIVE = TurboModuleRegistry.get('RNGoogleSignin') != null;

function cariHalanganGoogle(): string | null {
  if (MODE_DEMO) return 'Masuk butuh server — aplikasi sedang dalam mode demo.';
  if (!ADA_GOOGLE_NATIVE) return 'Masuk dengan Google butuh versi aplikasi terbaru (bukan Expo Go).';
  // iOS juga butuh client ID iOS: tanpanya configure() di native selalu menolak.
  const envKosong = !GOOGLE_WEB_CLIENT_ID
    ? 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'
    : Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID
      ? 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
      : null;
  if (!envKosong) return null;
  // Nama env & dokumen hanya untuk pengembang; warga cukup tahu fiturnya belum ada.
  return __DEV__
    ? `Masuk dengan Google belum disiapkan (${envKosong}, lihat docs/AKUN.md).`
    : 'Masuk dengan Google belum tersedia di versi aplikasi ini.';
}

/** Alasan tombol "Lanjutkan dengan Google" tidak bisa dipakai; null = bisa. */
export const halanganGoogle = cariHalanganGoogle();

/**
 * Sign in with Apple — wajib di iOS karena ada login Google (App Store
 * Guideline 4.8). Build lama tanpa modul native-nya tidak menampilkannya.
 */
export const adaApple =
  Platform.OS === 'ios' && !MODE_DEMO && requireOptionalNativeModule('ExpoAppleAuthentication') != null;

/** Masuk tanpa Google, hanya untuk menguji dengan mock server dari dev server. */
export const bisaMasukUji = __DEV__ && !MODE_DEMO;

/** false = build ini tidak punya satu pun cara masuk: jangan ajak warga masuk (suka, komentar). */
export const adaCaraMasuk = halanganGoogle === null || adaApple || bisaMasukUji;

let token: string | null = null;
let keadaan: Keadaan = { status: 'memuat', pengguna: null, statistik: null, disukai: new Set(), jumlahSuka: new Map() };
const pendengar = new Set<() => void>();

function ubah(sebagian: Partial<Keadaan>) {
  keadaan = { ...keadaan, ...sebagian };
  for (const f of pendengar) f();
}

function langgan(f: () => void) {
  pendengar.add(f);
  return () => {
    pendengar.delete(f);
  };
}

export function useAkun(): Keadaan {
  return useSyncExternalStore(langgan, () => keadaan);
}

/**
 * Token sesi saat ini, untuk permintaan di luar modul ini (kirim laporan, token siaran).
 * Tepat setelah aplikasi dibuka bisa masih null — pakai tokenSesiSiap() bila bisa menunggu.
 */
export function tokenSesi(): string | null {
  return token;
}

/** Token sesi setelah sesi tersimpan selesai dibaca dari penyimpanan aman. */
export async function tokenSesiSiap(): Promise<string | null> {
  await pemulihan;
  return token;
}

/** Saat aplikasi dibuka: pakai profil tersimpan dulu (bisa luring), lalu segarkan dari server di latar. */
async function pulihkan() {
  if (MODE_DEMO) return ubah({ status: 'tamu' });
  const [t, tersimpan] = await Promise.all([bacaAman(KUNCI_TOKEN), bacaAman(KUNCI_PROFIL)]);
  // Sudah masuk (atau keluar) selagi membaca: jangan ditimpa sesi tersimpan yang lama.
  if (token || keadaan.status !== 'memuat') return;
  token = t;
  if (!token) return ubah({ status: 'tamu' });
  let pengguna: Pengguna | null = null;
  try {
    pengguna = tersimpan ? (JSON.parse(tersimpan) as Pengguna) : null;
  } catch {}
  ubah({ status: 'masuk', pengguna });
  void segarkanAkun();
}

// Dimulai saat modul dimuat, bukan menunggu pemakai useAkun pertama: Live, tonton, dan
// kirim laporan juga butuh token walau belum ada layar akun yang tampil.
const pemulihan = pulihkan();

/** Permintaan ke server aplikasi dengan token sesi. 401 = sesi dicabut → keluar di HP ini juga. */
export async function permintaanAkun(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const { json, headers, ...sisa } = init;
  const t = token;
  const r = await fetch(`${API_URL}${path}`, {
    ...sisa,
    ...(json !== undefined && { body: JSON.stringify(json) }),
    headers: {
      Accept: 'application/json',
      ...(json !== undefined && { 'Content-Type': 'application/json' }),
      ...(t && { Authorization: `Bearer ${t}` }),
      ...(headers as Record<string, string> | undefined),
    },
  });
  // Hanya bila sesi yang ditolak masih sesi aktif — bukan jawaban telat setelah keluar atau ganti akun.
  if (r.status === 401 && t && token === t) await keluarLokal();
  return r;
}

/** Profil, statistik, dan daftar suka terbaru dari server. false bila gagal (data lama tetap dipakai). */
export async function segarkanAkun(): Promise<boolean> {
  const t = token;
  if (!t) return false;
  try {
    const [rSaya, rSuka] = await Promise.all([
      permintaanAkun('/api/mobile/saya'),
      permintaanAkun('/api/mobile/saya/disukai'),
    ]);
    if (!rSaya.ok) return false;
    const saya = (await rSaya.json()) as { pengguna: Pengguna; statistik: Statistik };
    const suka = rSuka.ok ? ((await rSuka.json()) as { disukai: number[] }) : null;
    // Keluar, akun dihapus, atau ganti akun selagi menunggu: jawaban ini milik sesi lama.
    if (token !== t) return false;
    ubah({
      status: 'masuk',
      pengguna: saya.pengguna,
      statistik: saya.statistik,
      ...(suka && { disukai: new Set(suka.disukai) }),
    });
    await simpanAman(KUNCI_PROFIL, JSON.stringify(saya.pengguna));
    return true;
  } catch {
    return false;
  }
}

type HasilMasuk = { ok: true } | { ok: false; galat: string | null };

async function tukarSesi(path: string, isi: unknown): Promise<HasilMasuk> {
  try {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(isi),
    });
    const json = (await r.json().catch(() => null)) as { token?: string; pengguna?: Pengguna; galat?: string } | null;
    if (!r.ok || !json?.token || !json.pengguna) {
      return { ok: false, galat: json?.galat ?? `Server menolak (HTTP ${r.status}).` };
    }
    token = json.token;
    await simpanAman(KUNCI_TOKEN, json.token);
    await simpanAman(KUNCI_PROFIL, JSON.stringify(json.pengguna));
    ubah({ status: 'masuk', pengguna: json.pengguna });
    void segarkanAkun();
    return { ok: true };
  } catch {
    return { ok: false, galat: 'Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.' };
  }
}

type ModulGoogle = typeof import('@react-native-google-signin/google-signin');

/**
 * configure() sebelum memakai Google Sign-In. Wajib juga sebelum signOut/revokeAccess:
 * di Android keduanya ditolak ("apiClient is null") bila configure belum dipanggil sejak
 * aplikasi dibuka, padahal sesi akun dipulihkan tanpa lewat masukGoogle.
 */
function siapkanGoogle(G: ModulGoogle['GoogleSignin']) {
  G.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    ...(GOOGLE_IOS_CLIENT_ID && { iosClientId: GOOGLE_IOS_CLIENT_ID }),
  });
}

/** Lupakan akun Google di HP ini, supaya "Lanjutkan dengan Google" berikutnya menampilkan pemilih akun. */
async function lepasGoogle(cara: 'signOut' | 'revokeAccess') {
  // Tanpa konfigurasi lengkap warga tidak mungkin masuk dengan Google di build ini (dan configure di iOS menolak).
  if (halanganGoogle) return;
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  try {
    siapkanGoogle(GoogleSignin);
    await GoogleSignin[cara]();
  } catch (e) {
    if (__DEV__) console.warn(`GoogleSignin.${cara} gagal`, e);
  }
}

/** `galat: null` = dibatalkan warga, tidak perlu pesan. */
export async function masukGoogle(): Promise<HasilMasuk> {
  if (halanganGoogle) return { ok: false, galat: halanganGoogle };
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = await import(
    '@react-native-google-signin/google-signin'
  );
  try {
    siapkanGoogle(GoogleSignin);
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const hasil = await GoogleSignin.signIn();
    if (!isSuccessResponse(hasil)) return { ok: false, galat: null };
    if (!hasil.data.idToken) return { ok: false, galat: 'Google tidak memberi token. Periksa webClientId.' };
    return await tukarSesi('/api/mobile/masuk/google', { idToken: hasil.data.idToken });
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) {
        return { ok: false, galat: null };
      }
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, galat: 'Google Play Services tidak tersedia atau perlu diperbarui.' };
      }
      // Kode 10 (DEVELOPER_ERROR) di Android = SHA-1/paket belum didaftarkan di Google Cloud.
      return { ok: false, galat: `Gagal masuk dengan Google (kode ${e.code}).` };
    }
    return { ok: false, galat: 'Gagal masuk dengan Google. Coba lagi.' };
  }
}

/** `galat: null` = dibatalkan warga. Nama hanya diberikan Apple saat izin pertama. */
export async function masukApple(): Promise<HasilMasuk> {
  const Apple = await import('expo-apple-authentication');
  try {
    const kred = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
    });
    if (!kred.identityToken) return { ok: false, galat: 'Apple tidak memberi token. Coba lagi.' };
    const nama = [kred.fullName?.givenName, kred.fullName?.familyName].filter(Boolean).join(' ');
    return await tukarSesi('/api/mobile/masuk/apple', {
      identityToken: kred.identityToken,
      nama,
      // Ditukar server dengan refresh token Apple, untuk mencabut izin saat akun dihapus.
      ...(kred.authorizationCode && { authorizationCode: kred.authorizationCode }),
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { ok: false, galat: null };
    return { ok: false, galat: 'Gagal masuk dengan Apple. Coba lagi.' };
  }
}

/** Dev server saja: masuk tanpa Google (mock server, atau situs dengan MOBILE_MASUK_UJI=1). */
export function masukUji(nama: string): Promise<HasilMasuk> {
  return tukarSesi('/api/mobile/masuk/uji', { nama });
}

export async function keluar(): Promise<void> {
  void permintaanAkun('/api/mobile/keluar', { method: 'POST' }).catch(() => {});
  await lepasGoogle('signOut');
  await keluarLokal();
}

type HasilHapus = { ok: true } | { ok: false; galat: string };
let hapusBerjalan: Promise<HasilHapus> | null = null;

/**
 * Hapus akun beserta sesi, suka, dan nama di komentar (DELETE /api/mobile/saya).
 * Wajib tersedia di dalam aplikasi menurut App Store & Google Play. Panggilan
 * ganda selagi berjalan memakai permintaan yang sama — DELETE kedua akan 401.
 */
export function hapusAkun(): Promise<HasilHapus> {
  hapusBerjalan ??= jalankanHapusAkun().finally(() => {
    hapusBerjalan = null;
  });
  return hapusBerjalan;
}

async function jalankanHapusAkun(): Promise<HasilHapus> {
  try {
    const r = await permintaanAkun('/api/mobile/saya', { method: 'DELETE' });
    const json = (await r.json().catch(() => null)) as { galat?: string } | null;
    if (!r.ok) return { ok: false, galat: json?.galat ?? `Gagal menghapus akun (HTTP ${r.status}).` };
  } catch {
    return { ok: false, galat: 'Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.' };
  }
  await lepasGoogle('revokeAccess');
  await keluarLokal();
  return { ok: true };
}

async function keluarLokal() {
  token = null;
  await hapusAman(KUNCI_TOKEN);
  await hapusAman(KUNCI_PROFIL);
  ubah({ status: 'tamu', pengguna: null, statistik: null, disukai: new Set(), jumlahSuka: new Map() });
}

export async function ubahProfil(isi: { nama: string }): Promise<{ ok: true } | { ok: false; galat: string }> {
  const t = token;
  try {
    const r = await permintaanAkun('/api/mobile/saya', { method: 'PATCH', json: isi });
    const json = (await r.json().catch(() => null)) as { pengguna?: Pengguna; galat?: string } | null;
    if (!r.ok || !json?.pengguna) return { ok: false, galat: json?.galat ?? `Gagal menyimpan (HTTP ${r.status}).` };
    // Sesi sudah berganti selagi menunggu: profil ini bukan lagi milik akun yang tampil.
    if (token !== t) return { ok: true };
    ubah({ pengguna: json.pengguna });
    await simpanAman(KUNCI_PROFIL, JSON.stringify(json.pengguna));
    return { ok: true };
  } catch {
    return { ok: false, galat: 'Tidak bisa menghubungi server.' };
  }
}

export async function ambilLaporanSaya(): Promise<{ ok: true; laporan: LaporanSaya[] } | { ok: false; galat: string }> {
  try {
    const r = await permintaanAkun('/api/mobile/saya/laporan');
    const json = (await r.json().catch(() => null)) as { laporan?: LaporanSaya[] } | null;
    if (r.ok && Array.isArray(json?.laporan)) return { ok: true, laporan: json.laporan };
    return { ok: false, galat: `Gagal memuat laporan (HTTP ${r.status}).` };
  } catch {
    return { ok: false, galat: 'Tidak bisa menghubungi server.' };
  }
}

/** Tandai/lepas satu laporan di daftar suka; statistik "Disukai" ikut menyesuaikan. */
function pasangSuka(beritaId: number, suka: boolean, jumlahSuka: ReadonlyMap<number, number>) {
  const disukai = new Set(keadaan.disukai);
  if (suka) disukai.add(beritaId);
  else disukai.delete(beritaId);
  ubah({
    disukai,
    jumlahSuka,
    ...(keadaan.statistik && { statistik: { ...keadaan.statistik, disukai: disukai.size } }),
  });
}

/**
 * Suka/batal suka. Langsung tampil di HP (optimistis), dikembalikan bila
 * server menolak. `jumlahSekarang` = angka yang sedang tampil di kartu.
 * Mengembalikan false bila gagal.
 */
export async function aturSuka(beritaId: number, suka: boolean, jumlahSekarang: number): Promise<boolean> {
  const t = token;
  const jumlahLama = keadaan.jumlahSuka.get(beritaId);
  const pasangJumlah = (n: number) => new Map(keadaan.jumlahSuka).set(beritaId, Math.max(0, n));
  pasangSuka(beritaId, suka, pasangJumlah(jumlahSekarang + (suka ? 1 : -1)));
  try {
    const r = await permintaanAkun(`/api/mobile/laporan/${beritaId}/suka`, { method: suka ? 'POST' : 'DELETE' });
    if (r.ok) {
      // Server sungguhan memberi angka pasti; mock memberi null (tidak tahu angka situs).
      const json = (await r.json().catch(() => null)) as { jumlah?: number | null } | null;
      if (typeof json?.jumlah === 'number' && token === t) ubah({ jumlahSuka: pasangJumlah(json.jumlah) });
      return true;
    }
  } catch {}
  // Kembalikan hanya laporan ini, dari keadaan terbaru: suka lain yang sedang berjalan tidak ikut
  // tertimpa. Setelah keluar (mis. 401) keadaan tamu tidak diisi lagi dengan suka akun lama.
  if (token === t) {
    const jumlahSuka = new Map(keadaan.jumlahSuka);
    if (jumlahLama === undefined) jumlahSuka.delete(beritaId);
    else jumlahSuka.set(beritaId, jumlahLama);
    pasangSuka(beritaId, !suka, jumlahSuka);
  }
  return false;
}

/**
 * Umpan baru saja dimuat ulang: angka suka di dalamnya sudah terbaru, jadi
 * angka lokal dari suka di HP ini tidak perlu menimpanya lagi.
 */
export function lupakanJumlahSuka(): void {
  if (keadaan.jumlahSuka.size > 0) ubah({ jumlahSuka: new Map() });
}

/** `balasKe` = id komentar yang dibalas (balasan tampil datar di bawah komentar akarnya). */
export async function kirimKomentar(
  beritaId: number,
  isi: string,
  balasKe?: number | null,
): Promise<{ ok: true; komentar: Komentar } | { ok: false; galat: string }> {
  try {
    const r = await permintaanAkun(`/api/mobile/laporan/${beritaId}/komentar`, {
      method: 'POST',
      json: balasKe ? { isi, balas_ke: balasKe } : { isi },
    });
    const json = (await r.json().catch(() => null)) as { komentar?: Komentar; galat?: string } | null;
    if (r.ok && json?.komentar) return { ok: true, komentar: json.komentar };
    return { ok: false, galat: json?.galat ?? `Komentar gagal terkirim (HTTP ${r.status}).` };
  } catch {
    return { ok: false, galat: 'Tidak bisa menghubungi server.' };
  }
}
