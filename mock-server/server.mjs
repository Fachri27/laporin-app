/**
 * Server tiruan untuk menguji aplikasi tanpa menyentuh produksi.
 *
 *   npm run mock                           → http://0.0.0.0:4000
 *   PORT=5000 node mock-server/server.mjs
 *
 * Lalu di .env aplikasi: EXPO_PUBLIC_API_URL=http://<IP-laptop>:4000
 *
 *   POST /api/mobile/laporan     laporan + berkas (multipart); Bearer → masuk Laporanku
 *   GET  /api/mobile/captcha     "captcha" tiruan untuk WebView aplikasi — langsung lolos
 *   POST /api/mobile/tiket       { token } → { tiket } sekali pakai, 30 menit
 *   POST /api/mobile/live/token  token siaran untuk aplikasi (lihat siaran.mjs); publik wajib akun
 *   GET  /api/mobile/live        siaran publik untuk beranda aplikasi
 *   POST /api/mobile/live/tonton token warga untuk menonton siaran publik; tamu hanya menonton
 *   GET  /live                   halaman penonton petugas
 *   GET  /live/uji               siaran uji dari peramban, sebagai "warga lain"
 *   …/api/mobile/masuk, /saya, /laporan/{id}/suka|komentar  akun warga (lihat akun.mjs)
 *
 * Aturannya meniru simpanLaporanPublik() di repo situs (judul, deskripsi,
 * koordinat, 1–6 berkas, total 100 MB, jenis dideteksi dari magic byte, tiket
 * wajib untuk tamu/anonim), jadi laporan yang lolos di sini juga lolos di server
 * sungguhan. Bedanya hanya captcha: tanpa Turnstile, halaman /api/mobile/captcha
 * langsung memberi token. FormData diurai oleh Request bawaan Node (≥ 18).
 */

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import * as akun from './akun.mjs';
import {
  daftarSiaran,
  daftarSiaranPublik,
  IP_LAN,
  LIVEKIT_URL,
  tokenPelapor,
  tokenPenonton,
  tokenWarga,
} from './siaran.mjs';

const PORT = Number(process.env.PORT ?? 4000);
const DI_SINI = dirname(fileURLToPath(import.meta.url));
const FOLDER = join(DI_SINI, 'unggahan');
const LIVEKIT_UMD = join(DI_SINI, '..', 'node_modules', 'livekit-client', 'dist', 'livekit-client.umd.js');

const BATAS_BERKAS = 6;
const BATAS_TOTAL_BYTE = 100 * 1024 * 1024;
const UMUR_TIKET_MS = 30 * 60 * 1000;

/** Tiket captcha yang sudah dibagikan → kedaluwarsa (epoch ms). Sekali pakai, seperti lib/tiket-lapor situs. */
const tiketAktif = new Map();

function buatTiket() {
  const tiket = `mock-${randomBytes(12).toString('hex')}`;
  tiketAktif.set(tiket, Date.now() + UMUR_TIKET_MS);
  return tiket;
}

function pakaiTiket(tiket) {
  const sampai = tiketAktif.get(tiket);
  tiketAktif.delete(tiket);
  return sampai !== undefined && sampai > Date.now();
}

/**
 * Pengganti halaman Turnstile situs (app/api/mobile/captcha): pesan JSON yang
 * sama ke WebView aplikasi, tapi langsung lolos tanpa widget.
 */
const HALAMAN_CAPTCHA = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verifikasi</title><style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px system-ui,sans-serif;opacity:.75}</style></head>
<body><p>Mock server: verifikasi otomatis lolos.</p>
<script>window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ token: 'mock-captcha' }));</script>
</body></html>`;

function deteksiMime(b) {
  const cocok = (o, ...x) => x.every((v, i) => b[o + i] === v);
  if (cocok(0, 0xff, 0xd8, 0xff)) return { mime: 'image/jpeg', ext: 'jpg' };
  if (cocok(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: 'image/png', ext: 'png' };
  if (cocok(0, 0x52, 0x49, 0x46, 0x46) && cocok(8, 0x57, 0x45, 0x42, 0x50)) return { mime: 'image/webp', ext: 'webp' };
  if (cocok(0, 0x1a, 0x45, 0xdf, 0xa3)) return { mime: 'video/webm', ext: 'webm' };
  if (cocok(4, 0x66, 0x74, 0x79, 0x70)) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return brand === 'qt  ' ? { mime: 'video/quicktime', ext: 'mov' } : { mime: 'video/mp4', ext: 'mp4' };
  }
  return null;
}

function koordinat(latMentah, lngMentah) {
  const adaLat = latMentah.trim() !== '';
  const adaLng = lngMentah.trim() !== '';
  if (!adaLat && !adaLng) return null;
  if (adaLat !== adaLng) return { galat: 'Latitude dan longitude harus diisi berdua.' };
  const lat = Number(latMentah.trim().replace(',', '.'));
  const lng = Number(lngMentah.trim().replace(',', '.'));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { galat: 'Latitude harus angka antara -90 dan 90.' };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { galat: 'Longitude harus angka antara -180 dan 180.' };
  if (lat === 0 && lng === 0) return { galat: 'Titik 0, 0 bukan lokasi di Indonesia. Periksa lagi atau kosongkan.' };
  return { lat, lng };
}

async function terimaLaporan(data, pengguna) {
  const judul = String(data.get('judul') ?? '').trim();
  const deskripsi = String(data.get('deskripsi') ?? '').trim();
  const anonim = String(data.get('anonim') ?? '') !== '';
  const nama = anonim ? '' : String(data.get('nama') ?? '').trim() || (pengguna?.nama ?? '');

  // Seperti situs: akun (tidak anonim) menggantikan captcha; tamu & anonim wajib tiket.
  if ((!pengguna || anonim) && !pakaiTiket(String(data.get('tiket') ?? ''))) {
    return { ok: false, galat: 'Verifikasi captcha gagal. Coba lagi.', bidang: 'captcha' };
  }

  if (!judul) return { ok: false, galat: 'Judul laporan wajib diisi.', bidang: 'judul' };
  if (judul.length > 255) return { ok: false, galat: 'Judul maksimal 255 karakter.', bidang: 'judul' };
  if (!deskripsi) return { ok: false, galat: 'Ceritakan kejadiannya sedikit.', bidang: 'deskripsi' };
  if (deskripsi.length > 5000) return { ok: false, galat: 'Deskripsi maksimal 5000 karakter.', bidang: 'deskripsi' };

  const titik = koordinat(String(data.get('lat') ?? ''), String(data.get('lng') ?? ''));
  if (titik && 'galat' in titik) return { ok: false, galat: titik.galat, bidang: 'koordinat' };

  const berkas = data.getAll('berkas').filter((v) => v instanceof File && v.size > 0);
  if (berkas.length > BATAS_BERKAS) return { ok: false, galat: `Maksimal ${BATAS_BERKAS} berkas per laporan.`, bidang: 'berkas' };
  if (berkas.length === 0) return { ok: false, galat: 'Sertakan minimal satu foto atau video sebagai bukti.', bidang: 'berkas' };

  const terbaca = [];
  for (const b of berkas) {
    const isi = new Uint8Array(await b.arrayBuffer());
    const jenis = deteksiMime(isi);
    if (!jenis) return { ok: false, galat: `${b.name}: Jenis berkas tidak didukung.`, bidang: 'berkas' };
    terbaca.push({ b, isi, jenis });
  }

  const folder = join(FOLDER, new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(folder, { recursive: true });
  const tersimpan = [];
  for (const [i, { b, isi, jenis }] of terbaca.entries()) {
    const nama = `${i + 1}.${jenis.ext}`;
    await writeFile(join(folder, nama), isi);
    tersimpan.push({ nama, asli: b.name, dikirimSebagai: b.type, terdeteksi: jenis.mime, byte: isi.length });
  }

  const laporan = {
    judul,
    deskripsi,
    nama: nama || null,
    anonim,
    titik,
    berkas: tersimpan,
    diterima: new Date().toISOString(),
    // Laporan anonim tidak pernah terikat ke akun, walau pengirimnya sedang masuk.
    pemilik: anonim ? null : (pengguna?.id ?? null),
    // Ubah manual ke "tayang"/"ditolak" untuk menguji status di Laporanku.
    status: 'menunggu',
  };
  await writeFile(join(folder, 'laporan.json'), JSON.stringify(laporan, null, 2));
  console.log(`\n✔ Laporan diterima → ${folder}`);
  console.log(JSON.stringify(laporan, null, 2));
  return { ok: true };
}

createServer(async (req, res) => {
  const balas = (status, json) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(json));
  };

  const url = new URL(req.url, 'http://lokal');
  const kirimBerkas = async (path, type) => {
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(await readFile(path));
  };

  try {
    if (req.method === 'GET' && url.pathname === '/live') {
      return await kirimBerkas(join(DI_SINI, 'penonton.html'), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/live/uji') {
      return await kirimBerkas(join(DI_SINI, 'pelapor-uji.html'), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/livekit-client.umd.js') {
      return await kirimBerkas(LIVEKIT_UMD, 'text/javascript; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/api/live/siaran') {
      return balas(...(await daftarSiaran()));
    }
    if (req.method === 'GET' && url.pathname === '/api/live/penonton') {
      return balas(...(await tokenPenonton(url.searchParams.get('ruang'))));
    }
    if (req.method === 'POST' && url.pathname === '/api/mobile/live/token') {
      const isi = await bacaJsonKecil(req);
      if (isi === undefined) return balas(400, { galat: 'Kiriman tidak bisa dibaca server.' });
      // Anonim tidak pernah terikat ke akun, walau kirimannya membawa token.
      return balas(...(await tokenPelapor(isi, isi.anonim === true ? null : akun.penggunaDari(req))));
    }
    if (req.method === 'GET' && url.pathname === '/api/mobile/live') {
      return balas(...(await daftarSiaranPublik()));
    }
    if (req.method === 'POST' && url.pathname === '/api/mobile/live/tonton') {
      const isi = await bacaJsonKecil(req);
      if (isi === undefined) return balas(400, { galat: 'Kiriman tidak bisa dibaca server.' });
      return balas(...(await tokenWarga(isi, akun.penggunaDari(req))));
    }
    if (req.method === 'GET' && url.pathname === '/api/mobile/captcha') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(HALAMAN_CAPTCHA);
    }
    if (req.method === 'POST' && url.pathname === '/api/mobile/tiket') {
      const isi = await bacaJsonKecil(req);
      if (typeof isi?.token !== 'string' || !isi.token) return balas(403, { galat: 'Verifikasi captcha gagal. Coba lagi.' });
      return balas(200, { tiket: buatTiket() });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/unggahan/')) {
      return await kirimUnggahan(url.pathname, res);
    }
    const hasilAkun = await ruteAkun(req, url);
    if (hasilAkun) return balas(...hasilAkun);
  } catch (e) {
    console.error('✘', e);
    return balas(500, { galat: 'Server galat.' });
  }

  if (req.method !== 'POST' || url.pathname !== '/api/mobile/laporan') {
    return balas(404, { ok: false, galat: 'Tidak ada di sini.' });
  }
  if (Number(req.headers['content-length'] ?? 0) > BATAS_TOTAL_BYTE + 1024 * 1024) {
    req.resume();
    return balas(413, { ok: false, galat: 'Total berkas melebihi 100 MB.', bidang: 'berkas' });
  }

  console.log(`→ ${req.method} ${req.url} (${req.headers['content-length'] ?? '?'} byte) dari ${req.socket.remoteAddress}`);
  try {
    const permintaan = new Request(`http://lokal${req.url}`, {
      method: 'POST',
      headers: req.headers,
      body: Readable.toWeb(req),
      duplex: 'half',
    });
    const hasil = await terimaLaporan(await permintaan.formData(), akun.penggunaDari(req));
    if (!hasil.ok) console.log(`✘ Ditolak: ${hasil.galat}`);
    balas(hasil.ok ? 200 : 422, hasil);
  } catch (e) {
    console.error('✘ Gagal mengurai kiriman:', e);
    balas(400, { ok: false, galat: 'Kiriman tidak bisa dibaca server.' });
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Mock server Lapor Karhutla di http://${IP_LAN}:${PORT}`);
  console.log(`  .env aplikasi   : EXPO_PUBLIC_API_URL=http://${IP_LAN}:${PORT}`);
  console.log(`  Penonton siaran : http://localhost:${PORT}/live`);
  console.log(`  Siaran uji      : http://localhost:${PORT}/live/uji  (jadi "warga lain" yang sedang live)`);
  console.log(`  Server LiveKit  : ${LIVEKIT_URL}  (jalankan: npm run livekit)`);
});

/** Rute akun warga. `null` = bukan rute akun. */
async function ruteAkun(req, url) {
  const p = url.pathname;
  const m = req.method;
  const isi = async () => (await bacaJsonKecil(req)) ?? {};
  if (m === 'POST' && p === '/api/mobile/masuk/google') return akun.masukGoogle(await isi());
  if (m === 'POST' && p === '/api/mobile/masuk/uji') return akun.masukUji(await isi());
  if (m === 'POST' && p === '/api/mobile/keluar') return akun.keluar(req);
  if (m === 'GET' && p === '/api/mobile/saya') return akun.profil(req);
  if (m === 'PATCH' && p === '/api/mobile/saya') return akun.ubahProfil(req, await isi());
  if (m === 'DELETE' && p === '/api/mobile/saya') return akun.hapusAkun(req);
  if (m === 'POST' && p === '/api/mobile/laporkan') return akun.laporkan(req, await isi());
  if (m === 'POST' && p === '/api/mobile/masuk/apple') return [501, { galat: 'Sign in with Apple hanya di server situs (APPLE_BUNDLE_ID).' }];
  if (m === 'GET' && p === '/api/mobile/saya/laporan') return akun.laporanSaya(req, `http://${req.headers.host}`);
  if (m === 'GET' && p === '/api/mobile/saya/disukai') return akun.daftarSuka(req);
  const suka = p.match(/^\/api\/mobile\/laporan\/(\d+)\/suka$/);
  if (suka && (m === 'POST' || m === 'DELETE')) return akun.aturSuka(req, Number(suka[1]), m === 'POST');
  const komentar = p.match(/^\/api\/mobile\/laporan\/(\d+)\/komentar$/);
  if (komentar && m === 'POST') return akun.kirimKomentar(req, Number(komentar[1]), await isi());
  return null;
}

const JENIS_BERKAS = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' };

/** GET /unggahan/<folder>/<berkas> — sampul untuk grid Laporanku. Hanya di dalam folder unggahan. */
async function kirimUnggahan(pathname, res) {
  const jalur = resolve(FOLDER, '.' + decodeURIComponent(pathname.slice('/unggahan'.length)));
  const jenis = JENIS_BERKAS[extname(jalur).toLowerCase()];
  if (!jalur.startsWith(FOLDER + sep) || !jenis) {
    res.writeHead(404);
    return res.end();
  }
  try {
    const isi = await readFile(jalur);
    res.writeHead(200, { 'Content-Type': jenis, 'Cache-Control': 'max-age=3600' });
    res.end(isi);
  } catch {
    res.writeHead(404);
    res.end();
  }
}

/** Badan JSON kecil (≤ 16 KB). `undefined` = tidak bisa dibaca. */
async function bacaJsonKecil(req) {
  let teks = '';
  for await (const potong of req) {
    teks += potong;
    if (teks.length > 16 * 1024) return undefined;
  }
  try {
    return JSON.parse(teks || '{}');
  } catch {
    return undefined;
  }
}
