/**
 * Akun warga untuk uji lokal — tiruan kontrak di docs/AKUN.md.
 *
 * Data disimpan di mock-server/unggahan/akun.json (ikut di-.gitignore).
 * Server sungguhan memakai tabel `users` situs (kolom google_id), lihat docs/AKUN.md.
 *
 *   GOOGLE_WEB_CLIENT_ID=…  → idToken Google wajib ditujukan ke client ini (aud).
 *                             Kosong = aud tidak diperiksa (hanya untuk uji!).
 */

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DI_SINI = dirname(fileURLToPath(import.meta.url));
export const FOLDER_UNGGAHAN = join(DI_SINI, 'unggahan');
const BERKAS = join(FOLDER_UNGGAHAN, 'akun.json');
const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID ?? '';

/** @type {{ pengguna: Record<string, any>, sesi: Record<string, string>, suka: Record<string, number[]>, komentar: any[] }} */
let data = { pengguna: {}, sesi: {}, suka: {}, komentar: [] };
try {
  data = { ...data, ...JSON.parse(readFileSync(BERKAS, 'utf8')) };
} catch {}

function simpanData() {
  mkdirSync(FOLDER_UNGGAHAN, { recursive: true });
  writeFileSync(BERKAS, JSON.stringify(data, null, 2));
}

const publik = (p) => ({ id: p.id, nama: p.nama, email: p.email ?? null, foto: p.foto ?? null });

function buatSesi(pengguna) {
  const token = randomBytes(32).toString('hex');
  data.sesi[token] = pengguna.id;
  simpanData();
  return { token, pengguna: publik(pengguna) };
}

/** Pengguna dari header `Authorization: Bearer …`, atau null. */
export function penggunaDari(req) {
  const h = req.headers.authorization ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  const id = token ? data.sesi[token] : null;
  return id ? (data.pengguna[id] ?? null) : null;
}

/**
 * POST /api/mobile/masuk/google { idToken }
 * Uji: memeriksa token lewat endpoint tokeninfo Google. Server sungguhan
 * memverifikasi tanda tangan JWT dengan kunci publik Google (google-auth-library).
 */
export async function masukGoogle(isi) {
  const idToken = String(isi?.idToken ?? '');
  if (!idToken) return [400, { galat: 'idToken kosong.' }];
  let klaim;
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!r.ok) return [401, { galat: 'Token Google tidak sah atau kedaluwarsa.' }];
    klaim = await r.json();
  } catch {
    return [502, { galat: 'Server tidak bisa menghubungi Google.' }];
  }
  if (GOOGLE_WEB_CLIENT_ID && klaim.aud !== GOOGLE_WEB_CLIENT_ID) {
    return [401, { galat: 'Token Google bukan untuk aplikasi ini.' }];
  }
  if (klaim.email_verified !== 'true' && klaim.email_verified !== true) {
    return [401, { galat: 'Email Google belum terverifikasi.' }];
  }
  const id = `google-${klaim.sub}`;
  const lama = data.pengguna[id];
  data.pengguna[id] = {
    id,
    googleId: klaim.sub,
    email: klaim.email,
    // Nama yang sudah diubah warga di aplikasi tidak ditimpa nama Google.
    nama: lama?.nama ?? klaim.name ?? klaim.email.split('@')[0],
    foto: klaim.picture ?? lama?.foto ?? null,
    dibuat: lama?.dibuat ?? new Date().toISOString(),
  };
  console.log(`● Masuk dengan Google: ${klaim.email}`);
  return [200, buatSesi(data.pengguna[id])];
}

/**
 * POST /api/mobile/masuk/uji { nama } — untuk menguji tanpa Google. Situs punya rute yang
 * sama, hanya di `next dev` dengan MOBILE_MASUK_UJI=1 (404 di produksi).
 */
export function masukUji(isi) {
  const nama = String(isi?.nama ?? '').trim().slice(0, 100) || 'Penguji';
  const id = `uji-${nama.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  data.pengguna[id] ??= { id, nama, email: `${id}@contoh.test`, foto: null, dibuat: new Date().toISOString() };
  console.log(`● Masuk uji: ${nama}`);
  return [200, buatSesi(data.pengguna[id])];
}

export function keluar(req) {
  const h = req.headers.authorization ?? '';
  if (h.startsWith('Bearer ')) {
    delete data.sesi[h.slice(7).trim()];
    simpanData();
  }
  return [200, { ok: true }];
}

/** Semua laporan di unggahan/ yang dikirim akun ini (laporan anonim tidak punya pemilik). */
function laporanMilik(pengguna) {
  if (!existsSync(FOLDER_UNGGAHAN)) return [];
  return readdirSync(FOLDER_UNGGAHAN, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      try {
        return { folder: d.name, ...JSON.parse(readFileSync(join(FOLDER_UNGGAHAN, d.name, 'laporan.json'), 'utf8')) };
      } catch {
        return null;
      }
    })
    .filter((l) => l?.pemilik === pengguna.id)
    .sort((a, b) => b.diterima.localeCompare(a.diterima));
}

export function profil(req) {
  const p = penggunaDari(req);
  if (!p) return [401, { galat: 'Masuk dulu.' }];
  const milik = laporanMilik(p);
  return [
    200,
    {
      pengguna: publik(p),
      statistik: {
        laporan: milik.length,
        tayang: milik.filter((l) => l.status === 'tayang').length,
        disukai: (data.suka[p.id] ?? []).length,
      },
    },
  ];
}

export function ubahProfil(req, isi) {
  const p = penggunaDari(req);
  if (!p) return [401, { galat: 'Masuk dulu.' }];
  const nama = String(isi?.nama ?? '').trim();
  if (!nama) return [422, { galat: 'Nama tidak boleh kosong.' }];
  if (nama.length > 100) return [422, { galat: 'Nama maksimal 100 karakter.' }];
  p.nama = nama;
  simpanData();
  return [200, { pengguna: publik(p) }];
}

/** GET /api/mobile/saya/laporan — sampul dilayani mock di /unggahan/<folder>/<berkas>. */
export function laporanSaya(req, asal) {
  const p = penggunaDari(req);
  if (!p) return [401, { galat: 'Masuk dulu.' }];
  return [
    200,
    {
      laporan: laporanMilik(p).map((l) => {
        const sampul = l.berkas.find((b) => b.terdeteksi.startsWith('image/'));
        return {
          id: l.folder,
          judul: l.judul,
          status: l.status ?? 'menunggu',
          dibuat: l.diterima,
          sampul: sampul ? `${asal}/unggahan/${encodeURIComponent(l.folder)}/${sampul.nama}` : null,
          jumlahBerkas: l.berkas.length,
          beritaId: l.beritaId ?? null,
        };
      }),
    },
  ];
}

export function daftarSuka(req) {
  const p = penggunaDari(req);
  if (!p) return [401, { galat: 'Masuk dulu.' }];
  return [200, { disukai: data.suka[p.id] ?? [] }];
}

/** POST/DELETE /api/mobile/laporan/{id}/suka. `jumlah` null: mock tidak tahu angka suka situs. */
export function aturSuka(req, beritaId, suka) {
  const p = penggunaDari(req);
  if (!p) return [401, { galat: 'Masuk dulu untuk menyukai.' }];
  const set = new Set(data.suka[p.id] ?? []);
  if (suka) set.add(beritaId);
  else set.delete(beritaId);
  data.suka[p.id] = [...set];
  simpanData();
  return [200, { disukai: suka, jumlah: null }];
}

/** DELETE /api/mobile/saya — hapus akun beserta sesi, suka, dan nama di komentar. */
export function hapusAkun(req) {
  const p = penggunaDari(req);
  if (!p) return [401, { galat: 'Masuk dulu.' }];
  for (const k of data.komentar) if (k.pemilik === p.id) Object.assign(k, { nama: 'Akun dihapus', pemilik: null });
  for (const [t, id] of Object.entries(data.sesi)) if (id === p.id) delete data.sesi[t];
  delete data.suka[p.id];
  delete data.pengguna[p.id];
  simpanData();
  console.log(`● Akun dihapus: ${p.nama}`);
  return [200, { ok: true }];
}

/** POST /api/mobile/laporkan { jenis, id, alasan, catatan? } — laporan konten (Laporkan). */
export function laporkan(req, isi) {
  const jenis = ['komentar', 'laporan', 'siaran'].find((j) => j === isi?.jenis);
  if (!jenis || !isi?.id) return [422, { galat: 'Konten yang dilaporkan tidak dikenal.' }];
  if (!isi?.alasan) return [422, { galat: 'Pilih alasan laporan.' }];
  (data.laporanKonten ??= []).push({ jenis, id: String(isi.id), alasan: isi.alasan, catatan: isi.catatan ?? null, pelapor: penggunaDari(req)?.id ?? null, waktu: new Date().toISOString() });
  simpanData();
  console.log(`⚑ Dilaporkan: ${jenis} ${isi.id} (${isi.alasan})`);
  return [200, { ok: true }];
}

/** POST /api/mobile/laporan/{id}/komentar { isi } */
export function kirimKomentar(req, beritaId, isi) {
  const p = penggunaDari(req);
  if (!p) return [401, { galat: 'Masuk dulu untuk berkomentar.' }];
  const teks = String(isi?.isi ?? '').trim();
  if (!teks) return [422, { galat: 'Komentar wajib diisi.' }];
  if (teks.length > 2000) return [422, { galat: 'Komentar maksimal 2000 karakter.' }];
  const komentar = { id: Date.now(), nama: p.nama, isi: teks, waktu: 'baru saja', sebutan: null, penulis: p.id.slice(0, 16), balasan: [] };
  data.komentar.push({ ...komentar, beritaId, pemilik: p.id, dibuat: new Date().toISOString() });
  simpanData();
  console.log(`● Komentar dari ${p.nama} di laporan ${beritaId}: ${teks}`);
  return [201, { komentar }];
}
