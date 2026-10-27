import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { BATAS_BERKAS, BATAS_TOTAL_BYTE, BATAS_TOTAL_TEKS, MIME_DITERIMA } from '@/lib/batas-laporan';
import { jenisDari, type IdJenis } from '@/lib/jenis-kejadian';

/** Titik laporan. `null` di draf = ikuti GPS live (lihat lokasi-live.ts). */
export type Titik = {
  lat: number;
  lng: number;
  akurasi: number | null;
  /** kamera = posisi saat foto/video diambil; foto = GPS di EXIF foto galeri; manual = diketik warga. */
  sumber: 'kamera' | 'foto' | 'manual';
  /** Lampiran asal titik kamera/foto: bila lampiran itu dihapus, titiknya ikut pindah. */
  idLampiran?: string;
};

export type Lampiran = {
  id: string;
  uri: string;
  jenis: 'foto' | 'video';
  mime: string;
  nama: string;
  ukuran: number;
  /** Detik, hanya untuk video. */
  durasi: number | null;
  asal: 'kamera' | 'galeri';
  /** Posisi GPS saat diambil (kamera), atau GPS di EXIF foto galeri. */
  titik: { lat: number; lng: number; akurasi: number | null } | null;
};

export type Draf = {
  /** Jenis kejadian dari langkah 1; hanya mengisi judul awal (lib/jenis-kejadian.ts). */
  jenis: IdJenis | null;
  judul: string;
  deskripsi: string;
  nama: string;
  anonim: boolean;
  lampiran: Lampiran[];
  titik: Titik | null;
  /** Warga memilih "Ikuti GPS live": foto/video berikutnya tidak lagi mengunci titik. */
  ikutiGps: boolean;
};

const KOSONG: Draf = {
  jenis: null,
  judul: '',
  deskripsi: '',
  nama: '',
  anonim: false,
  lampiran: [],
  titik: null,
  ikutiGps: false,
};

/*
 * Draf disimpan di penyimpanan permanen, bukan hanya di memori: OS bisa mematikan aplikasi
 * kapan saja (iOS selalu mematikannya saat izin diubah di Pengaturan; Android murah saat
 * galeri terbuka), dan bukti yang dipotret di lapangan tidak boleh ikut hilang. Berkasnya
 * dipindah dari cache — yang boleh dibersihkan OS — ke folder draf.
 */
const VERSI_SIMPAN = 1;
const NAMA_JSON = 'draf.json';

function folderDraf(): Directory {
  return new Directory(Paths.document, 'draf-laporan');
}

/** Awalan uri berkas di folder draf, selalu diakhiri '/'. */
function awalanFolder(): string {
  const uri = folderDraf().uri;
  return uri.endsWith('/') ? uri : `${uri}/`;
}

let draf: Draf = pulihkan();
const pendengar = new Set<() => void>();
let tundaSimpan: ReturnType<typeof setTimeout> | undefined;

function ubah(baru: Draf, simpanSegera = true) {
  draf = baru;
  for (const f of pendengar) f();
  clearTimeout(tundaSimpan);
  // Ketikan disimpan sesaat kemudian; lampiran & titik langsung.
  if (simpanSegera) simpanSekarang();
  else tundaSimpan = setTimeout(simpanSekarang, 400);
}

// Aplikasi ke latar = bisa dimatikan kapan saja: simpan ketikan yang masih tertunda.
AppState.addEventListener('change', (s) => {
  if (s !== 'active' && tundaSimpan !== undefined) simpanSekarang();
});

function simpanSekarang() {
  clearTimeout(tundaSimpan);
  tundaSimpan = undefined;
  try {
    const folder = folderDraf();
    const json = new File(folder, NAMA_JSON);
    const d = draf;
    if (!d.jenis && !d.judul && !d.deskripsi && !d.nama && d.lampiran.length === 0 && !d.titik) {
      // Draf kosong: buang foldernya sekalian, termasuk berkas yang tadi gagal dibuang.
      if (folder.exists) folder.delete();
      return;
    }
    folder.create({ intermediates: true, idempotent: true });
    const awalan = awalanFolder();
    // Berkas di folder draf dicatat namanya saja: di iOS lokasi folder aplikasi berubah setiap pembaruan.
    const lampiran = d.lampiran.map((l) => ({ ...l, uri: l.uri.startsWith(awalan) ? l.uri.slice(awalan.length) : l.uri }));
    // Tulis ke berkas sementara lalu pindahkan, supaya draf lama tidak rusak bila aplikasi mati di tengah jalan.
    const sementara = new File(folder, `${NAMA_JSON}.tmp`);
    sementara.write(JSON.stringify({ ...d, lampiran, versi: VERSI_SIMPAN }));
    sementara.moveSync(json, { overwrite: true });
  } catch {
    // Gagal menyimpan bukan alasan menghentikan warga melapor; draf tetap ada di memori.
  }
}

/** Draf terakhir dari penyimpanan, tanpa lampiran yang berkasnya sudah tidak ada. */
function pulihkan(): Draf {
  try {
    const folder = folderDraf();
    const json = new File(folder, NAMA_JSON);
    if (!json.exists) return KOSONG;
    const j = JSON.parse(json.textSync()) as Partial<Draf> & { versi?: number };
    if (j.versi !== VERSI_SIMPAN) return KOSONG;
    const awalan = awalanFolder();
    const lampiran = (Array.isArray(j.lampiran) ? j.lampiran : [])
      .map((l) => ({ ...l, uri: l.uri.includes('://') ? l.uri : awalan + l.uri }))
      .filter((l) => adaBerkas(l.uri));
    // Berkas yatim (mis. aplikasi mati sebelum draf sempat disimpan) dibuang.
    const dipakai = new Set(lampiran.filter((l) => l.uri.startsWith(awalan)).map((l) => l.uri.slice(awalan.length)));
    for (const isi of folder.list()) {
      if (isi instanceof File && !isi.name.startsWith(NAMA_JSON) && !dipakai.has(isi.name)) isi.delete();
    }
    const titik = j.titik?.idLampiran && !lampiran.some((l) => l.id === j.titik?.idLampiran) ? null : (j.titik ?? null);
    return {
      jenis: jenisDari(j.jenis)?.id ?? null,
      judul: typeof j.judul === 'string' ? j.judul : '',
      deskripsi: typeof j.deskripsi === 'string' ? j.deskripsi : '',
      nama: typeof j.nama === 'string' ? j.nama : '',
      anonim: j.anonim === true,
      lampiran,
      titik,
      ikutiGps: j.ikutiGps === true,
    };
  } catch {
    return KOSONG;
  }
}

function adaBerkas(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

function langgan(f: () => void) {
  pendengar.add(f);
  return () => {
    pendengar.delete(f);
  };
}

export function useDraf(): Draf {
  return useSyncExternalStore(langgan, () => draf);
}

export function ambilDraf(): Draf {
  return draf;
}

export function ubahIsian(isian: Partial<Pick<Draf, 'judul' | 'deskripsi' | 'nama' | 'anonim'>>) {
  ubah({ ...draf, ...isian }, false);
}

/**
 * Pilih jenis kejadian. Judul ikut diganti selama warga belum menulis judul sendiri
 * (kosong, atau masih judul bawaan jenis sebelumnya).
 */
export function aturJenis(id: IdJenis) {
  const lama = jenisDari(draf.jenis);
  const judulBawaan = !draf.judul.trim() || draf.judul === lama?.judul;
  ubah({ ...draf, jenis: id, judul: judulBawaan ? (jenisDari(id)?.judul ?? draf.judul) : draf.judul });
}

/** `null` = warga memilih "Ikuti GPS live": foto/video berikutnya tidak lagi mengunci titik. */
export function aturTitik(titik: Titik | null) {
  ubah({ ...draf, titik, ikutiGps: titik === null });
}

export function totalUkuran(lampiran: Lampiran[]): number {
  return lampiran.reduce((n, l) => n + l.ukuran, 0);
}

/**
 * Tambah lampiran. Berkas yang lolos (format didukung, masih dalam batas jumlah &
 * ukuran) ditambahkan; sisanya dilewati dan salinannya dibuang. `galat` menjelaskan
 * yang dilewati, `null` bila semua masuk.
 *
 * Foto/video pertama yang membawa GPS menjadi titik laporan — kecuali warga sudah
 * mengetik koordinat sendiri atau memilih "Ikuti GPS live".
 */
export function tambahLampiran(baru: Lampiran[]): { ditambah: number; galat: string | null } {
  const diterima: Lampiran[] = [];
  const formatDitolak = new Set<string>();
  const alasan = new Set<string>();
  let jumlah = draf.lampiran.length;
  let ukuran = totalUkuran(draf.lampiran);
  for (const l of baru) {
    let tolak = true;
    if (!(MIME_DITERIMA as readonly string[]).includes(l.mime)) formatDitolak.add(labelFormat(l));
    else if (jumlah >= BATAS_BERKAS) alasan.add(`Maksimal ${BATAS_BERKAS} berkas per laporan.`);
    else if (ukuran + l.ukuran > BATAS_TOTAL_BYTE) {
      alasan.add(`Total berkas melebihi ${BATAS_TOTAL_TEKS}. Kurangi atau perkecil dulu.`);
    } else tolak = false;
    if (tolak) {
      buangBerkas(l.uri);
      continue;
    }
    jumlah++;
    ukuran += l.ukuran;
    diterima.push(amankan(l));
  }

  if (diterima.length > 0) {
    let titik = draf.titik;
    if (!titik && !draf.ikutiGps) {
      const pemilik = diterima.find((l) => l.titik);
      if (pemilik) titik = titikDari(pemilik);
    }
    ubah({ ...draf, lampiran: [...draf.lampiran, ...diterima], titik });
  }

  const dilewati = baru.length - diterima.length;
  if (dilewati === 0) return { ditambah: diterima.length, galat: null };
  const sebab = [
    formatDitolak.size > 0 &&
      `Format ${[...formatDitolak].join(', ')} tidak didukung. Gunakan JPG, PNG, WebP, MP4, MOV, atau WebM.`,
    ...alasan,
  ]
    .filter(Boolean)
    .join(' ');
  return {
    ditambah: diterima.length,
    galat: diterima.length > 0 ? `${diterima.length} berkas ditambahkan, ${dilewati} dilewati. ${sebab}` : sebab,
  };
}

/** "GIF", "AVI", … dari nama berkas; atau MIME-nya bila nama tanpa ekstensi. */
function labelFormat(l: Lampiran): string {
  return (l.nama.includes('.') ? ekstensi(l.nama).toUpperCase() : '') || l.mime || 'berkas ini';
}

function titikDari(l: Lampiran): Titik | null {
  if (!l.titik) return null;
  return { ...l.titik, sumber: l.asal === 'kamera' ? 'kamera' : 'foto', idLampiran: l.id };
}

/** Pindahkan berkas dari cache ke folder draf supaya tidak ikut dibersihkan OS. */
function amankan(l: Lampiran): Lampiran {
  try {
    if (!l.uri.startsWith(Paths.cache.uri)) return l;
    const folder = folderDraf();
    folder.create({ intermediates: true, idempotent: true });
    const tujuan = new File(folder, `${l.id}.${ekstensi(l.uri) || (l.jenis === 'video' ? 'mp4' : 'jpg')}`);
    new File(l.uri).moveSync(tujuan);
    return { ...l, uri: tujuan.uri };
  } catch {
    // Tetap di cache: masih bisa dikirim selama aplikasi hidup.
    return l;
  }
}

export function hapusLampiran(id: string) {
  const l = draf.lampiran.find((x) => x.id === id);
  if (!l) return;
  buangBerkas(l.uri);
  const sisa = draf.lampiran.filter((x) => x.id !== id);
  // Titik dari foto/video ikut pindah bersama medianya: ke lampiran bertitik berikutnya,
  // atau kembali mengikuti GPS live.
  let titik = draf.titik;
  if (titik?.idLampiran === id) {
    const pengganti = sisa.find((x) => x.titik);
    titik = pengganti ? titikDari(pengganti) : null;
  }
  ubah({ ...draf, lampiran: sisa, titik });
}

/** Kosongkan draf setelah laporan terkirim, sekaligus hapus berkasnya. */
export function resetDraf() {
  for (const l of draf.lampiran) buangBerkas(l.uri);
  ubah(KOSONG);
}

/**
 * Hanya salinan milik aplikasi (cache & folder draf) yang dibuang — jangan sampai foto
 * asli di galeri ikut terhapus.
 */
function buangBerkas(uri: string) {
  try {
    if (!uri.startsWith(Paths.cache.uri) && !uri.startsWith(awalanFolder())) return;
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Gagal membuang tidak penting; sistem akan membersihkan cache sendiri.
  }
}

export function idBaru(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ukuranBerkas(uri: string): number {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

const MIME_DARI_EKSTENSI: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

export function ekstensi(uri: string): string {
  return uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
}

export function mimeDari(uri: string, cadangan = ''): string {
  return MIME_DARI_EKSTENSI[ekstensi(uri)] ?? cadangan;
}

/**
 * Jenis berkas dari isinya (magic byte), sama dengan deteksiMime di server (lib/unggah.ts):
 * nama & ekstensi bisa menipu. '' = jenis yang tidak diterima server; `null` = tidak terbaca.
 */
export function mimeDariIsi(uri: string): string | null {
  try {
    const h = new File(uri).open();
    try {
      return mimeDariByte(h.readBytes(16));
    } finally {
      h.close();
    }
  } catch {
    return null;
  }
}

export function mimeDariByte(b: Uint8Array): string {
  const cocok = (offset: number, ...byte: number[]) => byte.every((x, i) => b[offset + i] === x);
  const teks = (dari: number, sampai: number) => String.fromCharCode(...b.subarray(dari, sampai));

  if (cocok(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (cocok(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (teks(0, 4) === 'RIFF') {
    if (teks(8, 12) === 'WEBP') return 'image/webp';
    return teks(8, 12) === 'AVI ' ? 'video/x-msvideo' : '';
  }
  // WebM / Matroska: EBML 1A 45 DF A3
  if (cocok(0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm';
  // ISO-BMFF: kotak "ftyp" di offset 4, merek menyusul.
  if (teks(4, 8) === 'ftyp') {
    const merek = teks(8, 12);
    if (merek === 'qt  ') return 'video/quicktime';
    // HEIC/HEIF/AVIF juga ISO-BMFF, tapi foto — server hanya menerima JPG/PNG/WebP.
    if (/^(hei|hev|mif1|msf1)/.test(merek)) return 'image/heic';
    if (/^avi[fs]/.test(merek)) return 'image/avif';
    return 'video/mp4';
  }
  if (teks(0, 4) === 'GIF8') return 'image/gif';
  return '';
}
