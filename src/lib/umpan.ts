import { useFocusEffect } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { AppState, Dimensions, PixelRatio } from 'react-native';

import { lupakanJumlahSuka } from '@/lib/akun';

/**
 * Umpan laporan karhutla — daftar yang sama dengan beranda fire.nusantara.earth.
 *
 * Dibaca dari GET /api/umpan milik situs: publik, hanya-baca, di-cache CDN
 * 5 menit. Karena itu umpan selalu dari situs, terpisah dari API_URL (tujuan
 * KIRIM laporan, yang saat uji bisa diarahkan ke mock server). Lihat docs/UMPAN.md.
 */

export const SITUS_URL = (
  (process.env.EXPO_PUBLIC_SITUS_URL ?? '').trim() || 'https://fire.nusantara.earth'
).replace(/\/+$/, '');

/** Sama dengan ItemMedia di situs (lib/media.ts). `url`/`poster` relatif ke situs. */
export type ItemMedia = {
  jenis: 'gambar' | 'video';
  url: string;
  poster?: string;
  /** Kredit pengambil gambar, mis. "Janang". */
  keterangan?: string;
};

/** Sama dengan Berita di situs (lib/events.ts), tanpa field yang tidak dipakai aplikasi. */
export type Berita = {
  id: number;
  slug: string | null;
  pulau: string | null;
  provinsi: string | null;
  /** Sudah diformat situs, mis. "10 Oktober 2026". */
  tanggal: string;
  judul: string;
  lokasi: string | null;
  lat: number;
  lng: number;
  deskripsi: string | null;
  media: ItemMedia[];
  /** true = media tegak, boleh memenuhi layar; false = tampil utuh di atas latar buram. */
  vertikal: boolean;
  jumlahKomentar: number;
  jumlahSuka: number;
};

/** Sama dengan Komentar di situs (lib/komentar.ts). Balasan datar, ditandai `sebutan`. */
export type Komentar = {
  id: number;
  nama: string;
  isi: string;
  /** Sudah diformat situs, mis. "15 hari yang lalu". */
  waktu: string;
  sebutan: string | null;
  /** Penanda penulis (HMAC dari server) untuk fitur Blokir. Kosong di server lama. */
  penulis?: string;
  balasan?: Komentar[];
};

type Keadaan = {
  status: 'memuat' | 'siap' | 'galat';
  berita: Berita[];
  /** Epoch ms pengambilan terakhir yang berhasil. */
  diambil: number;
};

/** Umpan dianggap basi setelah 5 menit — sama dengan s-maxage di situs. */
const BASI_MS = 5 * 60_000;
/**
 * Batas tunggu jaringan. Di sinyal lemah koneksi bisa tersambung tanpa data
 * yang datang, dan fetch tanpa batas waktu menggantung selamanya.
 */
const BATAS_TUNGGU_MS = 15_000;
/** Angka komentar lokal dipakai paling lama selama cache situs (s-maxage + stale-while-revalidate). */
const KOMENTAR_LOKAL_MS = 15 * 60_000;

let keadaan: Keadaan = { status: 'memuat', berita: [], diambil: 0 };
const pendengar = new Set<() => void>();
let sedangMuat: Promise<boolean> | null = null;
/**
 * Jumlah komentar setelah warga berkomentar di HP ini — menimpa angka umpan,
 * yang di-cache situs beberapa menit, sampai umpan menyusul.
 */
const komentarLokal = new Map<number, { jumlah: number; waktu: number }>();

function ubah(sebagian: Partial<Keadaan>) {
  keadaan = { ...keadaan, ...sebagian };
  for (const f of pendengar) f();
}

function segarkanBilaBasi() {
  if (Date.now() - keadaan.diambil > BASI_MS) void muatUmpan();
}

function langgan(f: () => void) {
  pendengar.add(f);
  segarkanBilaBasi();
  return () => {
    pendengar.delete(f);
  };
}

// Tab tetap terpasang dan aplikasi bisa berjam-jam di latar belakang: umpan
// diperiksa lagi saat aplikasi dibuka kembali dan saat layar pemakainya fokus.
AppState.addEventListener('change', (s) => {
  if (s === 'active' && pendengar.size > 0) segarkanBilaBasi();
});

export function useUmpan(): Keadaan {
  useFocusEffect(segarkanBilaBasi);
  return useSyncExternalStore(langgan, () => keadaan);
}

/**
 * Ambil ulang umpan. Mengembalikan false bila gagal; data lama tetap dipakai,
 * jadi warga di sinyal lemah tidak kehilangan apa yang sudah tampil.
 */
export function muatUmpan(): Promise<boolean> {
  sedangMuat ??= (async () => {
    if (keadaan.berita.length === 0 && keadaan.status !== 'memuat') ubah({ status: 'memuat' });
    try {
      const r = await fetch(`${SITUS_URL}/api/umpan?bahasa=id`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(BATAS_TUNGGU_MS),
      });
      const data: unknown = r.ok ? await r.json() : null;
      if (!Array.isArray(data)) throw new Error(`HTTP ${r.status}`);
      ubah({ status: 'siap', berita: data.filter(beritaSah).map((b) => pakaiKomentarLokal(rapikan(b))), diambil: Date.now() });
      // Angka suka di umpan baru sudah memuat suka warga; angka lokal tidak perlu menimpanya lagi.
      lupakanJumlahSuka();
      return true;
    } catch {
      ubah({ status: keadaan.berita.length > 0 ? 'siap' : 'galat' });
      return false;
    } finally {
      sedangMuat = null;
    }
  })();
  return sedangMuat;
}

/**
 * Payload datang dari jaringan: kartu yang bentuknya tidak dikenal dilewati, bukan membuat umpan crash.
 * Titik 0,0 = data lama tanpa lokasi (situs kini menolaknya) — jarak & peta-nya akan menyesatkan.
 */
function beritaSah(x: unknown): x is Berita {
  const b = x as Partial<Berita> | null;
  return (
    typeof b?.id === 'number' &&
    typeof b.judul === 'string' &&
    Number.isFinite(b.lat) &&
    Number.isFinite(b.lng) &&
    !(b.lat === 0 && b.lng === 0) &&
    Array.isArray(b.media)
  );
}

function rapikan(b: Berita): Berita {
  return {
    ...b,
    deskripsi: b.deskripsi?.replace(/\r\n/g, '\n').trim() || null,
    media: b.media.filter((m) => typeof m?.url === 'string' && (m.jenis === 'gambar' || m.jenis === 'video')),
    jumlahSuka: b.jumlahSuka ?? 0,
    jumlahKomentar: b.jumlahKomentar ?? 0,
  };
}

function pakaiKomentarLokal(b: Berita): Berita {
  const lokal = komentarLokal.get(b.id);
  if (!lokal) return b;
  if (b.jumlahKomentar >= lokal.jumlah || Date.now() - lokal.waktu > KOMENTAR_LOKAL_MS) {
    komentarLokal.delete(b.id);
    return b;
  }
  return { ...b, jumlahKomentar: lokal.jumlah };
}

/** Komentar warga terkirim: angka di kartu langsung naik, tanpa menunggu cache situs. */
export function naikkanJumlahKomentar(beritaId: number): void {
  const b = keadaan.berita.find((x) => x.id === beritaId);
  if (!b) return;
  komentarLokal.set(beritaId, { jumlah: b.jumlahKomentar + 1, waktu: Date.now() });
  ubah({ berita: keadaan.berita.map((x) => (x.id === beritaId ? { ...x, jumlahKomentar: x.jumlahKomentar + 1 } : x)) });
}

export async function ambilKomentar(
  id: number,
): Promise<{ ok: true; komentar: Komentar[] } | { ok: false; galat: string }> {
  try {
    const r = await fetch(`${SITUS_URL}/api/laporan/${id}/komentar`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(BATAS_TUNGGU_MS),
    });
    const json = (await r.json().catch(() => null)) as { komentar?: unknown; message?: unknown } | null;
    if (r.ok && Array.isArray(json?.komentar)) return { ok: true, komentar: json.komentar as Komentar[] };
    return { ok: false, galat: typeof json?.message === 'string' ? json.message : `Gagal memuat komentar (HTTP ${r.status}).` };
  } catch {
    return { ok: false, galat: 'Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.' };
  }
}

/** "/media/video/x.mp4" → URL lengkap di situs. */
export function urlMedia(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${SITUS_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Lebar layar dalam piksel fisik — ukuran gambar selayar penuh yang diminta dari situs. */
export const LEBAR_LAYAR_PX = PixelRatio.getPixelSizeForLayoutSize(Dimensions.get('window').width);

/** Lebar yang dilayani pengubah ukuran gambar situs (bawaan next/image: imageSizes + deviceSizes). */
const LEBAR_GAMBAR = [64, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920];

/**
 * Gambar lewat pengubah ukuran situs (/_next/image), bukan berkas aslinya:
 * foto asli bisa 1–5 MB, versi selebar layar ±50 KB WebP. Ini yang membuat
 * umpan tetap mulus digeser dan hemat kuota. `lebarPx` = lebar tampil dalam piksel fisik.
 */
export function urlGambar(path: string, lebarPx: number): string {
  if (/^https?:\/\//.test(path)) return path;
  const w = LEBAR_GAMBAR.find((x) => x >= lebarPx) ?? LEBAR_GAMBAR[LEBAR_GAMBAR.length - 1];
  return `${SITUS_URL}/_next/image?url=${encodeURIComponent(path.startsWith('/') ? path : `/${path}`)}&w=${w}&q=75`;
}

/** Gambar sampul laporan: foto pertama, atau poster video pertama. */
export function sampulDari(b: Pick<Berita, 'media'>): string | undefined {
  const m = b.media[0];
  return m?.jenis === 'video' ? m.poster : m?.url;
}

/**
 * "Bukit Tunggal, Kalimantan Tengah": bagian pertama alamat geocode + provinsi. Alamat
 * lengkapnya terlalu panjang untuk satu baris ("…, Palangkaraya City, Central Kalimantan, …").
 */
export function tempatSingkat(b: Pick<Berita, 'lokasi' | 'provinsi'>): string {
  const awal = b.lokasi?.split(',')[0]?.trim();
  return [awal, b.provinsi].filter((x, i, a) => x && a.indexOf(x) === i).join(', ');
}

/** "Bukit Tunggal" — bagian pertama alamat, atau provinsi bila alamat kosong. Untuk baris yang sempit. */
export function tempatPendek(b: Pick<Berita, 'lokasi' | 'provinsi'>): string {
  return b.lokasi?.split(',')[0]?.trim() || b.provinsi || '';
}

/** "21 Oktober 2026" (format situs) → "21 Okt"; tahun ditulis bila bukan tahun ini. */
export function tanggalSingkat(tanggal: string, tahunIni = new Date().getFullYear()): string {
  const m = /^(\d{1,2})\s+(\p{L}+)\s+(\d{4})$/u.exec(tanggal.trim());
  if (!m) return tanggal;
  const bulan = m[2].slice(0, 3);
  return Number(m[3]) === tahunIni ? `${m[1]} ${bulan}` : `${m[1]} ${bulan} ${m[3]}`;
}

/**
 * Nama di kepala kartu: kredit pengambil foto/video pertama (mis. "Juliana", "Warga Desa
 * Mangkupadi"). Situs tidak menyimpan nama pelapor di umpan, jadi tanpa kredit = "Laporan warga".
 */
export function kreditLaporan(b: Pick<Berita, 'media'>): string {
  const k = b.media.find((m) => m.keterangan?.trim())?.keterangan?.trim();
  if (!k) return 'Laporan warga';
  return /^anonim$/i.test(k) ? 'Anonim' : k;
}

/** Halaman laporan di situs — untuk dibagikan, atau berkomentar selama aplikasi belum bisa. */
export function urlHalaman(b: Pick<Berita, 'slug'>): string {
  return b.slug ? `${SITUS_URL}/id/fire/${b.slug}` : `${SITUS_URL}/id`;
}

/**
 * -2.2512, 113.951 → "2,25° LS 113,95° BT" (lintang selatan/utara, bujur timur/barat) — untuk kartu
 * & detail laporan. Koordinat GPS persis (kamera, siaran) memakai `koordinatTeks` di lib/lokasi-live.ts.
 */
export function koordinatSingkat(lat: number, lng: number): string {
  const angka = (x: number) => Math.abs(x).toFixed(2).replace('.', ',');
  return `${angka(lat)}° ${lat < 0 ? 'LS' : 'LU'} ${angka(lng)}° ${lng < 0 ? 'BB' : 'BT'}`;
}

/** Jarak lingkaran besar (haversine) dalam km. */
export function jarakKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** 0.4 → "< 1 km", 3.42 → "3,4 km", 1287.2 → "1.287 km" — tanpa Intl, seperti jamTeks di kamera. */
export function jarakTeks(km: number): string {
  if (km < 1) return '< 1 km';
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${String(Math.round(km)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} km`;
}

/** 1234 → "1,2 rb" seperti hitungan di aplikasi video pendek. */
export function hitunganTeks(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace('.', ',').replace(',0', '')} rb`;
  return `${(n / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} jt`;
}
