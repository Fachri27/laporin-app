import type { Lampiran } from '@/lib/draf-laporan';

/**
 * Pengiriman laporan ke server.
 *
 * Situs web mengirim laporan lewat Server Action Next.js (bukan REST) yang
 * dijaga Cloudflare Turnstile — keduanya tidak bisa dipanggil langsung dari
 * aplikasi. Jadi aplikasi ini menembak endpoint khusus mobile, kontraknya ada
 * di docs/API.md. Bentuk field-nya sama dengan form web supaya server cukup
 * meneruskan FormData ke simpanLaporanPublik().
 *
 * EXPO_PUBLIC_API_URL kosong = MODE DEMO: unggahan disimulasikan, tidak ada
 * yang dikirim ke mana pun.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

export const MODE_DEMO = API_URL === '';
export const ALAMAT_KIRIM = `${API_URL}/api/mobile/laporan`;

/** Sama dengan HasilLapor di situs. */
export type HasilLapor =
  | { ok: true }
  | { ok: false; galat: string; bidang?: string };

export type Progres = { terkirim: number; total: number };

export type IsianLaporan = {
  judul: string;
  deskripsi: string;
  nama: string;
  anonim: boolean;
  titik: { lat: number; lng: number } | null;
  lampiran: Lampiran[];
  /**
   * Token sesi akun (lib/akun.ts) supaya laporan masuk "Laporanku". Pemanggil
   * mengisinya null bila anonim: laporan anonim tidak boleh terikat ke akun.
   */
  token: string | null;
  /** Tiket captcha sekali pakai (POST /api/mobile/tiket); wajib bila tanpa token. */
  tiket: string | null;
};

export type Pengiriman = {
  hasil: Promise<HasilLapor>;
  batalkan: () => void;
};

const PESAN_TERPUTUS =
  'Kiriman terputus — periksa koneksi lalu tekan Kirim lagi. Isian dan berkas Anda masih di sini.';

/** Putus setelah berkas terunggah penuh: server mungkin sudah menyimpannya, kirim ulang bisa ganda. */
const PESAN_MUNGKIN_TERKIRIM =
  'Koneksi terputus saat server memproses laporan — laporan Anda mungkin sudah diterima. Bila masuk dengan akun, cek Laporanku sebelum mengirim ulang.';

export function kirimLaporan(isian: IsianLaporan, onProgres: (p: Progres) => void): Pengiriman {
  return MODE_DEMO ? kirimDemo(isian, onProgres) : kirimSungguhan(isian, onProgres);
}

function buatFormData(isian: IsianLaporan): FormData {
  const data = new FormData();
  data.append('judul', isian.judul.trim());
  data.append('deskripsi', isian.deskripsi.trim());
  if (isian.anonim) {
    data.append('anonim', '1');
  } else if (isian.nama.trim()) {
    data.append('nama', isian.nama.trim());
  }
  if (isian.tiket) data.append('tiket', isian.tiket);
  if (isian.titik) {
    data.append('lat', isian.titik.lat.toFixed(7));
    data.append('lng', isian.titik.lng.toFixed(7));
  }
  for (const l of isian.lampiran) {
    // Cara React Native melampirkan berkas: objek {uri, name, type}, bukan Blob
    // (tipe DOM tidak mengenalnya, maka di-cast). Berkas dikirim apa adanya,
    // jadi EXIF (GPS & waktu) di foto ikut sampai server.
    data.append('berkas', { uri: l.uri, name: l.nama, type: l.mime } as unknown as Blob);
  }
  return data;
}

/**
 * XMLHttpRequest, bukan fetch: fetch di React Native tidak melaporkan progres
 * unggahan, padahal di sinyal lemah warga perlu tahu kirimannya masih jalan.
 */
function kirimSungguhan(isian: IsianLaporan, onProgres: (p: Progres) => void): Pengiriman {
  const xhr = new XMLHttpRequest();
  let unggahPenuh = false;
  const hasil = new Promise<HasilLapor>((selesai) => {
    xhr.open('POST', ALAMAT_KIRIM);
    xhr.setRequestHeader('Accept', 'application/json');
    if (isian.token) xhr.setRequestHeader('Authorization', `Bearer ${isian.token}`);
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      unggahPenuh = e.loaded >= e.total;
      onProgres({ terkirim: e.loaded, total: e.total });
    };
    xhr.onload = () => selesai(bacaJawaban(xhr.status, xhr.responseText));
    xhr.onerror = () => selesai({ ok: false, galat: unggahPenuh ? PESAN_MUNGKIN_TERKIRIM : PESAN_TERPUTUS });
    xhr.ontimeout = () => selesai({ ok: false, galat: unggahPenuh ? PESAN_MUNGKIN_TERKIRIM : PESAN_TERPUTUS });
    xhr.onabort = () => selesai({ ok: false, galat: 'Pengiriman dibatalkan.', bidang: 'batal' });
    xhr.send(buatFormData(isian));
  });
  return { hasil, batalkan: () => xhr.abort() };
}

function bacaJawaban(status: number, teks: string): HasilLapor {
  let json: unknown = null;
  try {
    json = JSON.parse(teks);
  } catch {}
  if (json && typeof json === 'object' && 'ok' in json) {
    const j = json as { ok: unknown; galat?: unknown; bidang?: unknown };
    if (j.ok === true && status >= 200 && status < 300) return { ok: true };
    if (typeof j.galat === 'string') {
      return { ok: false, galat: j.galat, bidang: typeof j.bidang === 'string' ? j.bidang : undefined };
    }
  }
  if (status === 413) return { ok: false, galat: 'Total berkas terlalu besar untuk server.' };
  if (status === 429) {
    return { ok: false, galat: 'Terlalu banyak laporan dari jaringan ini. Coba lagi dalam 10 menit.' };
  }
  return { ok: false, galat: `Server menolak laporan (HTTP ${status}). Coba lagi.` };
}

/** Simulasi ±3 detik supaya alur kirim bisa dicoba di Expo Go tanpa server. */
function kirimDemo(isian: IsianLaporan, onProgres: (p: Progres) => void): Pengiriman {
  const total = Math.max(1, isian.lampiran.reduce((n, l) => n + l.ukuran, 0));
  let terkirim = 0;
  let id: ReturnType<typeof setInterval> | undefined;
  let akhiri: (h: HasilLapor) => void = () => {};
  const hasil = new Promise<HasilLapor>((selesai) => {
    akhiri = selesai;
    id = setInterval(() => {
      terkirim = Math.min(total, terkirim + total / 30);
      onProgres({ terkirim, total });
      if (terkirim >= total) {
        clearInterval(id);
        selesai({ ok: true });
      }
    }, 100);
  });
  return {
    hasil,
    batalkan: () => {
      clearInterval(id);
      akhiri({ ok: false, galat: 'Pengiriman dibatalkan.', bidang: 'batal' });
    },
  };
}
