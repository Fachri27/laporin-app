import { useSyncExternalStore } from 'react';

import { bacaAman, simpanAman } from '@/lib/penyimpanan-aman';
import { sampulDari, type Berita, type ItemMedia } from '@/lib/umpan';

/**
 * Story di beranda, seperti Instagram — dibentuk dari umpan yang sudah ada, bukan unggahan
 * terpisah: foto/video laporan terverifikasi yang kejadiannya hari ini atau kemarin,
 * dikelompokkan per provinsi (satu cincin = satu provinsi). Situs belum menyimpan story
 * sendiri, jadi warga belum bisa membuatnya dari aplikasi.
 *
 * Umpan hanya membawa tanggal kejadian ("21 Oktober 2026"), tanpa jam, jadi "24 jam
 * terakhir" didekati dengan hari ini + kemarin (waktu HP).
 */

export type ItemStory = {
  /** id laporan — kunci tanda sudah dilihat. */
  kunci: string;
  berita: Berita;
  media: ItemMedia;
};

export type Story = {
  /** Nama provinsi; juga parameter rute /story/[kunci]. */
  kunci: string;
  /** Singkatan untuk label cincin, mis. "Kalteng". */
  label: string;
  /** Sampul laporan terbaru — isi cincin. */
  sampul: string | undefined;
  /**
   * Satu item per laporan — media pertamanya, sama dengan sampul kartu; sisanya di detail
   * ("Lihat laporan"). Satu provinsi bisa punya belasan laporan sehari. Terlama dulu, seperti Instagram.
   */
  item: ItemStory[];
};


const BULAN: Record<string, number> = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
};

/** "21 Oktober 2026" (format situs, ?bahasa=id) → tengah malam hari itu, waktu HP. */
export function tanggalKejadian(tanggal: string): Date | null {
  const m = /^(\d{1,2})\s+(\p{L}+)\s+(\d{4})$/u.exec(tanggal.trim());
  const bulan = m ? BULAN[m[2].toLowerCase()] : undefined;
  if (!m || bulan === undefined) return null;
  return new Date(Number(m[3]), bulan, Number(m[1]));
}

/** Kejadian hari ini (waktu HP) — label TERKINI di kartu & story. */
export function kejadianHariIni(tanggal: string, sekarang = new Date()): boolean {
  const t = tanggalKejadian(tanggal);
  return (
    t !== null &&
    t.getFullYear() === sekarang.getFullYear() &&
    t.getMonth() === sekarang.getMonth() &&
    t.getDate() === sekarang.getDate()
  );
}

const SINGKATAN: Record<string, string> = {
  'Sumatera Utara': 'Sumut',
  'Sumatera Barat': 'Sumbar',
  'Sumatera Selatan': 'Sumsel',
  'Kepulauan Riau': 'Kepri',
  'Kepulauan Bangka Belitung': 'Babel',
  'DKI Jakarta': 'Jakarta',
  'Jawa Barat': 'Jabar',
  'Jawa Tengah': 'Jateng',
  'Jawa Timur': 'Jatim',
  'DI Yogyakarta': 'DIY',
  'Daerah Istimewa Yogyakarta': 'DIY',
  'Nusa Tenggara Barat': 'NTB',
  'Nusa Tenggara Timur': 'NTT',
  'Kalimantan Barat': 'Kalbar',
  'Kalimantan Tengah': 'Kalteng',
  'Kalimantan Selatan': 'Kalsel',
  'Kalimantan Timur': 'Kaltim',
  'Kalimantan Utara': 'Kaltara',
  'Sulawesi Utara': 'Sulut',
  'Sulawesi Tengah': 'Sulteng',
  'Sulawesi Selatan': 'Sulsel',
  'Sulawesi Tenggara': 'Sultra',
  'Sulawesi Barat': 'Sulbar',
  'Maluku Utara': 'Malut',
  'Papua Barat Daya': 'PBD',
};

/** Label cincin: singkatan yang lazim, atau nama aslinya bila sudah pendek (Riau, Jambi, Papua). */
export function singkatanProvinsi(nama: string): string {
  return SINGKATAN[nama] ?? nama;
}

/** Story dari umpan (terbaru dulu), urut menurut laporan terbaru di tiap provinsi. */
export function kelompokStory(berita: Berita[], sekarang: Date): Story[] {
  const batas = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate() - 1);
  const grup = new Map<string, Story>();
  for (const b of berita) {
    const t = tanggalKejadian(b.tanggal);
    if (!t || t < batas || b.media.length === 0) continue;
    const nama = b.provinsi ?? b.pulau ?? 'Lainnya';
    let s = grup.get(nama);
    if (!s) {
      s = { kunci: nama, label: singkatanProvinsi(nama), sampul: sampulDari(b), item: [] };
      grup.set(nama, s);
    }
    // Umpan terbaru dulu; laporan yang lebih lama masuk ke depan supaya story diputar dari yang terlama.
    s.item.unshift({ kunci: String(b.id), berita: b, media: b.media[0] });
  }
  return [...grup.values()];
}

export function sudahDilihat(s: Story, dilihat: ReadonlySet<string>): boolean {
  return s.item.every((x) => dilihat.has(x.kunci));
}

/** Yang belum dilihat di depan, seperti Instagram; urutan di dalam tiap bagian tetap. */
export function urutkanStory(story: Story[], dilihat: ReadonlySet<string>): Story[] {
  return [...story.filter((s) => !sudahDilihat(s, dilihat)), ...story.filter((s) => sudahDilihat(s, dilihat))];
}

/** Item pertama yang belum dilihat — story yang dibuka lagi melanjutkan dari sana. */
export function awalStory(s: Story, dilihat: ReadonlySet<string>): number {
  return Math.max(0, s.item.findIndex((x) => !dilihat.has(x.kunci)));
}

// --- Tanda sudah dilihat (cincin berwarna → abu-abu), diingat di HP ini. ---

const KUNCI = 'lapor-karhutla.story-dilihat';
/** expo-secure-store membatasi ±2 KB per nilai; 150 id laporan ±1,2 KB. */
const MAKS = 150;

let dilihat: ReadonlySet<string> = new Set();
let dimuat = false;
let tundaSimpan: ReturnType<typeof setTimeout> | undefined;
const pendengar = new Set<() => void>();

function langgan(f: () => void) {
  pendengar.add(f);
  if (!dimuat) {
    dimuat = true;
    void bacaAman(KUNCI).then((teks) => {
      try {
        const daftar = JSON.parse(teks ?? '[]') as unknown;
        if (Array.isArray(daftar)) {
          ubah(new Set([...daftar.filter((x): x is string => typeof x === 'string'), ...dilihat]));
        }
      } catch {}
    });
  }
  return () => {
    pendengar.delete(f);
  };
}

function ubah(baru: ReadonlySet<string>) {
  dilihat = baru;
  for (const f of pendengar) f();
}

export function useStoryDilihat(): ReadonlySet<string> {
  return useSyncExternalStore(langgan, () => dilihat);
}

export function tandaiDilihat(kunci: string) {
  if (dilihat.has(kunci)) return;
  ubah(new Set([...dilihat, kunci].slice(-MAKS)));
  // Digabung: menonton satu story bisa menandai belasan item dalam semenit.
  clearTimeout(tundaSimpan);
  tundaSimpan = setTimeout(() => void simpanAman(KUNCI, JSON.stringify([...dilihat])), 1500);
}
