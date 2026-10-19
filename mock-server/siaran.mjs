/**
 * Siaran langsung (LiveKit) untuk uji lokal.
 *
 * Server ini hanya MEMBAGIKAN TOKEN; video tidak pernah lewat sini, melainkan
 * langsung HP → server LiveKit → peramban petugas. Secret LiveKit tinggal di
 * server, tidak pernah di aplikasi.
 *
 * Bawaan cocok dengan `livekit-server --dev` (key "devkey", secret "secret").
 * Untuk LiveKit Cloud: LIVEKIT_URL=wss://xxx.livekit.cloud LIVEKIT_API_KEY=… LIVEKIT_API_SECRET=…
 */

import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

/** IP laptop di Wi-Fi — HP harus bisa menjangkau LiveKit lewat alamat ini. */
export const IP_LAN =
  (networkInterfaces().en0 ?? Object.values(networkInterfaces()).flat()).find(
    (i) => i && i.family === 'IPv4' && !i.internal,
  )?.address ?? '127.0.0.1';

export const LIVEKIT_URL = process.env.LIVEKIT_URL ?? `ws://${IP_LAN}:7880`;
const KUNCI = process.env.LIVEKIT_API_KEY ?? 'devkey';
const RAHASIA = process.env.LIVEKIT_API_SECRET ?? 'secret';

const layananRuang = new RoomServiceClient(LIVEKIT_URL.replace(/^ws/, 'http'), KUNCI, RAHASIA);

const acak = (n = 4) => randomBytes(n).toString('hex');
const AWALAN_PELAPOR = 'pelapor-';

function angkaKoordinat(v, min, max) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return v !== null && v !== '' && Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** Dibulatkan ke 2 desimal (~1 km): beranda warga cukup tahu kira-kira di mana. */
const kasar = (n) => (n == null ? null : Math.round(n * 100) / 100);

/**
 * POST /api/mobile/live/token — dipanggil aplikasi saat warga menekan "Mulai siaran".
 * Membuat ruang baru per siaran, lalu token yang hanya boleh menerbitkan.
 * `publik: true` = pelapor memilih siarannya tampil di beranda warga lain —
 * wajib akun dan tidak boleh anonim (`pengguna` = akun dari Bearer, atau null).
 */
export async function tokenPelapor(isian, pengguna) {
  const anonim = isian?.anonim === true;
  const publik = isian?.publik === true;
  // Urutan & pesan sama dengan app/api/mobile/live/token di situs.
  if (publik && anonim) return [422, { galat: 'Siaran di beranda warga tidak bisa anonim.' }];
  if (publik && !pengguna) return [401, { galat: 'Masuk dulu untuk menyiarkan ke beranda warga.' }];

  const judul = String(isian?.judul ?? '').trim();
  if (!judul) return [422, { galat: 'Tulis singkat apa yang sedang terjadi.' }];
  if (judul.length > 255) return [422, { galat: 'Judul maksimal 255 karakter.' }];

  const nama = anonim ? '' : (String(isian?.nama ?? '').trim() || (pengguna?.nama ?? '')).slice(0, 100);
  // Metadata ruang & atribut awal token terbaca SEMUA penonton: ruang publik hanya
  // mendapat titik kasar. Titik persis dikirim aplikasi ke petugas (topik "lokasi").
  const bulatkan = publik ? kasar : (n) => n;
  const lat = bulatkan(angkaKoordinat(isian?.lat, -90, 90));
  const lng = bulatkan(angkaKoordinat(isian?.lng, -180, 180));
  const ruang = `siaran-${Date.now().toString(36)}-${acak(2)}`;

  try {
    await layananRuang.createRoom({
      name: ruang,
      // Ruang dibuang 2 menit setelah kosong; 30 dtk setelah pelapor pergi.
      emptyTimeout: 120,
      departureTimeout: 30,
      maxParticipants: 25,
      metadata: JSON.stringify({ judul, nama: nama || null, anonim, publik, mulai: Date.now(), lat, lng }),
    });
  } catch (e) {
    console.error('✘ LiveKit tidak bisa dihubungi:', e.message);
    return [502, { galat: 'Server siaran belum jalan. Di laptop: npm run livekit' }];
  }

  const at = new AccessToken(KUNCI, RAHASIA, {
    identity: `${AWALAN_PELAPOR}${acak()}`,
    name: nama || (anonim ? 'Anonim' : 'Warga'),
    attributes: lat !== null && lng !== null ? { lat: String(lat), lng: String(lng) } : {},
    ttl: '2h',
  });
  at.addGrant({
    room: ruang,
    roomJoin: true,
    canPublish: true,
    // Untuk menerima komentar & hati dari petugas (text stream). Petugas tidak
    // menerbitkan video/suara, jadi pelapor tetap tidak menerima media apa pun.
    canSubscribe: true,
    canPublishData: true,
    // Supaya aplikasi bisa memperbarui atribut lat/lng selama siaran.
    canUpdateOwnMetadata: true,
  });

  console.log(`● Siaran dibuka: ${ruang} — "${judul}"${publik ? ' (publik)' : ''}`);
  return [200, { url: LIVEKIT_URL, token: await at.toJwt(), ruang }];
}

/** Siaran yang sedang berjalan (ada pelapor yang menerbitkan), terbaru dulu. null = LiveKit mati. */
async function siaranAktif() {
  let semua;
  try {
    semua = await layananRuang.listRooms();
  } catch {
    return null;
  }
  const aktif = semua.filter((r) => r.name.startsWith('siaran-') && r.numPublishers > 0);
  const hasil = await Promise.all(
    aktif.map(async (r) => {
      const meta = bacaJson(r.metadata);
      const peserta = await layananRuang.listParticipants(r.name).catch(() => []);
      const pelapor = peserta.find((p) => p.identity.startsWith(AWALAN_PELAPOR));
      const a = pelapor?.attributes ?? {};
      return {
        ruang: r.name,
        judul: meta.judul ?? r.name,
        nama: pelapor?.name ?? meta.nama ?? 'Warga',
        mulai: meta.mulai ?? Number(r.creationTime) * 1000,
        lat: a.lat ? Number(a.lat) : meta.lat ?? null,
        lng: a.lng ? Number(a.lng) : meta.lng ?? null,
        akurasi: a.akurasi ? Number(a.akurasi) : null,
        publik: meta.publik === true,
        penonton: Math.max(0, r.numParticipants - 1),
      };
    }),
  );
  return hasil.sort((a, b) => b.mulai - a.mulai);
}

/** GET /api/live/siaran — semua siaran, untuk panel petugas. */
export async function daftarSiaran() {
  const daftar = await siaranAktif();
  if (!daftar) return [502, { galat: 'Server siaran (LiveKit) tidak bisa dihubungi.' }];
  return [200, daftar];
}

/**
 * GET /api/mobile/live — siaran publik untuk beranda aplikasi. Hanya yang
 * pelapornya memilih "Tampilkan di beranda", dan tanpa lokasi persis.
 */
export async function daftarSiaranPublik() {
  const daftar = await siaranAktif();
  if (!daftar) return [502, { galat: 'Server siaran tidak bisa dihubungi.' }];
  return [
    200,
    daftar
      .filter((s) => s.publik)
      .map((s) => ({ ruang: s.ruang, judul: s.judul, nama: s.nama, mulai: s.mulai, penonton: s.penonton, lat: kasar(s.lat), lng: kasar(s.lng) })),
  ];
}

/**
 * POST /api/mobile/live/tonton { ruang } — token warga untuk menonton siaran publik,
 * tanpa menerbitkan video/suara. Dengan akun (`pengguna` dari Bearer) boleh
 * berkomentar, hati, dan hadiah; tamu hanya menonton (canPublishData: false).
 */
export async function tokenWarga(isian, pengguna) {
  const ruang = String(isian?.ruang ?? '');
  if (!/^siaran-[a-z0-9-]+$/.test(ruang)) return [400, { galat: 'Siaran tidak dikenal.' }];
  let ruangan;
  try {
    [ruangan] = await layananRuang.listRooms([ruang]);
  } catch {
    return [502, { galat: 'Server siaran tidak bisa dihubungi.' }];
  }
  if (!ruangan || ruangan.numPublishers === 0) return [404, { galat: 'Siaran sudah berakhir.' }];
  if (bacaJson(ruangan.metadata).publik !== true) return [403, { galat: 'Siaran ini hanya untuk petugas.' }];

  const at = new AccessToken(KUNCI, RAHASIA, { identity: `warga-${acak()}`, name: pengguna?.nama || 'Warga', ttl: '1h' });
  at.addGrant({ room: ruang, roomJoin: true, canSubscribe: true, canPublish: false, canPublishData: pengguna != null });
  return [200, { url: LIVEKIT_URL, token: await at.toJwt() }];
}

/**
 * GET /api/live/penonton?ruang=… — token menonton (hanya berlangganan).
 * DI PRODUKSI rute ini WAJIB di balik login CMS; di sini terbuka karena hanya
 * untuk jaringan lokal.
 */
export async function tokenPenonton(ruang) {
  if (!ruang || !/^siaran-[a-z0-9-]+$/.test(ruang)) return [400, { galat: 'Ruang tidak dikenal.' }];
  const at = new AccessToken(KUNCI, RAHASIA, { identity: `petugas-${acak()}`, name: 'Petugas', ttl: '1h' });
  // canPublishData: komentar & hati ke pelapor. Tetap tanpa canPublish (video/suara).
  at.addGrant({ room: ruang, roomJoin: true, canSubscribe: true, canPublish: false, canPublishData: true });
  return [200, { url: LIVEKIT_URL, token: await at.toJwt() }];
}

function bacaJson(teks) {
  try {
    return JSON.parse(teks || '{}');
  } catch {
    return {};
  }
}
