import { useEffect, useSyncExternalStore } from 'react';

import { API_URL, MODE_DEMO } from '@/lib/api';

/**
 * Tiket siaran langsung dari server.
 *
 * Aplikasi tidak pernah memegang API secret LiveKit: server yang membuat ruang
 * dan menandatangani token (lihat docs/LIVE.md). Token pelapor hanya boleh
 * menerbitkan video/audio dan memperbarui atributnya sendiri (posisi GPS).
 */

/**
 * Interaksi selama siaran, lewat text stream LiveKit. Topiknya sama dengan
 * halaman penonton (mock-server/penonton.html) dan CMS petugas.
 * - komentar: isi teks, maks. BATAS_KOMENTAR karakter. Nama pengirim = nama peserta.
 * - suka: jumlah ketukan (angka sebagai teks); ketukan beruntun digabung dulu.
 * - hadiah: JSON `{ "id": "damkar", "jumlah": 3 }`; id dari DAFTAR_HADIAH,
 *   ketukan beruntun pada hadiah yang sama digabung dulu seperti suka.
 * - lokasi: hanya siaran publik, dari pelapor ke peserta `petugas-…` saja
 *   (destinationIdentities): JSON `{ "lat", "lng", "akurasi": number|null, "waktu": epoch ms }`.
 *   Atribut peserta pelapor di siaran publik hanya berisi lat/lng 2 desimal.
 */
export const TOPIK_KOMENTAR = 'komentar';
export const TOPIK_SUKA = 'suka';
export const TOPIK_HADIAH = 'hadiah';
export const TOPIK_LOKASI = 'lokasi';
export const BATAS_KOMENTAR = 200;

/**
 * Sensor kata kasar komentar siaran, sama dengan saring() di situs
 * (lib/komentar.ts + lib/kata-kasar.json): kata ≤ 3 huruf sisakan 1 huruf,
 * selebihnya sisakan 2 huruf.
 */
const KATA_KASAR = [
  'anjing', 'babi', 'bajingan', 'banci', 'bangsat', 'bedebah', 'brengsek', 'kampret', 'keparat', 'kontol',
  'memek', 'ngentot', 'pecun', 'perek', 'sialan', 'silit', 'tai', 'tolol', 'goblok', 'idiot', 'bego', 'shit',
  'fuck', 'asshole', 'bastard', 'bitch', 'dick', 'piss', 'slut', 'whore', 'crap', '4njing',
];
const POLA_KASAR = new RegExp(`\\b(?:${[...KATA_KASAR].sort((a, b) => b.length - a.length).join('|')})\\b`, 'gi');

export function saringKomentar(teks: string): string {
  return teks.replace(POLA_KASAR, (cocok) => {
    const simpan = cocok.length <= 3 ? 1 : 2;
    return cocok.slice(0, simpan) + '*'.repeat(cocok.length - simpan);
  });
}

export type Hadiah = {
  id: string;
  nama: string;
  emoji: string;
  /** Hadiah besar juga tampil selayar penuh, bukan hanya di spanduk kiri. */
  besar: boolean;
};

/**
 * Hadiah apresiasi dari petugas, seperti gift di siaran TikTok, tapi simbolis:
 * tanpa koin dan tanpa uang. Urutan & id harus sama dengan mock-server/penonton.html.
 */
export const DAFTAR_HADIAH: readonly Hadiah[] = [
  { id: 'tepuk', nama: 'Tepuk tangan', emoji: '👏', besar: false },
  { id: 'air', nama: 'Tetes air', emoji: '💧', besar: false },
  { id: 'terima-kasih', nama: 'Terima kasih', emoji: '🙏', besar: false },
  { id: 'pohon', nama: 'Pohon', emoji: '🌳', besar: false },
  { id: 'pemadam', nama: 'Pemadam', emoji: '🧯', besar: false },
  { id: 'medali', nama: 'Medali', emoji: '🏅', besar: false },
  { id: 'damkar', nama: 'Mobil damkar', emoji: '🚒', besar: true },
  { id: 'bom-air', nama: 'Bom air', emoji: '🚁', besar: true },
];

/** Isi pesan topik hadiah → hadiah yang dikenal, atau null bila tidak sah. */
export function bacaHadiah(teks: string): { hadiah: Hadiah; jumlah: number } | null {
  try {
    const isi = JSON.parse(teks) as { id?: unknown; jumlah?: unknown };
    const hadiah = DAFTAR_HADIAH.find((h) => h.id === isi?.id);
    if (!hadiah) return null;
    const jumlah = Math.min(99, Math.max(1, Math.floor(Number(isi.jumlah)) || 1));
    return { hadiah, jumlah };
  } catch {
    return null;
  }
}

export type TiketSiaran = {
  /** wss://… server LiveKit */
  url: string;
  token: string;
  ruang: string;
};

export type IsianSiaran = {
  judul: string;
  nama: string;
  anonim: boolean;
  titik: { lat: number; lng: number } | null;
  /** Tampil di beranda warga lain; tanpa ini hanya petugas yang bisa menonton. */
  publik: boolean;
  /** Token sesi akun, null bila tamu atau anonim. */
  token: string | null;
};

export async function mintaTiketSiaran(
  isian: IsianSiaran,
): Promise<{ ok: true; tiket: TiketSiaran } | { ok: false; galat: string }> {
  try {
    const r = await fetch(`${API_URL}/api/mobile/live/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(isian.token && { Authorization: `Bearer ${isian.token}` }),
      },
      body: JSON.stringify({
        judul: isian.judul.trim(),
        nama: isian.anonim ? '' : isian.nama.trim(),
        anonim: isian.anonim,
        publik: isian.publik,
        lat: isian.titik?.lat ?? null,
        lng: isian.titik?.lng ?? null,
      }),
    });
    const json = (await r.json().catch(() => null)) as Partial<TiketSiaran> & { galat?: string } | null;
    if (r.ok && json?.url && json.token && json.ruang) {
      return { ok: true, tiket: { url: json.url, token: json.token, ruang: json.ruang } };
    }
    return { ok: false, galat: json?.galat ?? `Server menolak siaran (HTTP ${r.status}).` };
  } catch {
    return { ok: false, galat: 'Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.' };
  }
}

/** Awalan identitas peserta, dibuat server saat menandatangani token. */
export const AWALAN_PELAPOR = 'pelapor-';
export const AWALAN_PETUGAS = 'petugas-';

export type Peran = 'petugas' | 'pelapor' | 'warga';

/**
 * Peran peserta dari identitasnya — ditandatangani server, jadi tidak bisa
 * dipalsukan lewat nama akun (mis. warga bernama "Petugas BPBD").
 */
export function peranDari(identity: string): Peran {
  if (identity.startsWith(AWALAN_PETUGAS)) return 'petugas';
  if (identity.startsWith(AWALAN_PELAPOR)) return 'pelapor';
  return 'warga';
}

/** Siaran warga yang pelapornya memilih "Tampilkan di beranda". */
export type SiaranPublik = {
  ruang: string;
  judul: string;
  nama: string;
  /** Epoch ms. */
  mulai: number;
  penonton: number;
  /**
   * Dibulatkan server ke ~1 km. Penonton warga juga hanya menerima perkiraan
   * ini (metadata ruang & atribut pelapor); titik persis hanya lewat topik
   * lokasi ke petugas.
   */
  lat: number | null;
  lng: number | null;
};

/** Daftar siaran di beranda diperbarui selama beranda terbuka. */
const JEDA_MUAT_SIARAN_MS = 8000;

let siaranPublik: SiaranPublik[] = [];
let jejakSiaran = '[]';
const pendengarSiaran = new Set<() => void>();

function langgananSiaran(f: () => void) {
  pendengarSiaran.add(f);
  return () => {
    pendengarSiaran.delete(f);
  };
}

function siaranSah(x: unknown): x is SiaranPublik {
  const s = x as Partial<SiaranPublik> | null;
  return typeof s?.ruang === 'string' && typeof s.judul === 'string' && typeof s.mulai === 'number';
}

/** Gagal = daftar lama tetap dipakai; beranda tidak boleh rusak karena server siaran mati. */
export async function muatSiaranPublik(): Promise<void> {
  if (MODE_DEMO) return;
  try {
    const r = await fetch(`${API_URL}/api/mobile/live`, { headers: { Accept: 'application/json' } });
    const data: unknown = r.ok ? await r.json() : null;
    if (!Array.isArray(data)) return;
    const baru = data.filter(siaranSah).map((s) => ({ ...s, nama: s.nama || 'Warga', penonton: s.penonton ?? 0 }));
    // Referensi baru hanya bila isinya berubah, supaya umpan tidak render ulang tiap 8 detik.
    const jejak = JSON.stringify(baru);
    if (jejak === jejakSiaran) return;
    jejakSiaran = jejak;
    siaranPublik = baru;
    for (const f of pendengarSiaran) f();
  } catch {}
}

/** Siaran publik yang sedang berjalan, terbaru dulu. `pantau` = perbarui berkala. */
export function useSiaranPublik(pantau: boolean): SiaranPublik[] {
  const daftar = useSyncExternalStore(langgananSiaran, () => siaranPublik);
  useEffect(() => {
    if (!pantau || MODE_DEMO) return;
    void muatSiaranPublik();
    const id = setInterval(() => void muatSiaranPublik(), JEDA_MUAT_SIARAN_MS);
    return () => clearInterval(id);
  }, [pantau]);
  return daftar;
}

/**
 * Token untuk menonton siaran publik sebagai warga. Dengan token akun: boleh
 * komentar, hati, dan hadiah; tanpa akun (tamu, pratinjau beranda) hanya
 * menonton. `ulang` = gagal sementara (jaringan/server), layak dicoba lagi.
 */
export async function mintaTiketTonton(
  ruang: string,
  token: string | null,
): Promise<{ ok: true; tiket: Omit<TiketSiaran, 'ruang'> } | { ok: false; galat: string; ulang: boolean }> {
  try {
    const r = await fetch(`${API_URL}/api/mobile/live/tonton`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ ruang }),
    });
    const json = (await r.json().catch(() => null)) as { url?: string; token?: string; galat?: string } | null;
    if (r.ok && json?.url && json.token) return { ok: true, tiket: { url: json.url, token: json.token } };
    return {
      ok: false,
      galat: json?.galat ?? `Server menolak (HTTP ${r.status}).`,
      ulang: r.status === 429 || r.status >= 500,
    };
  } catch {
    return { ok: false, galat: 'Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.', ulang: true };
  }
}
