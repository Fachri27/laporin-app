import { API_URL, MODE_DEMO } from '@/lib/api';
import { tokenSesi } from '@/lib/akun';

/**
 * "Laporkan" konten buatan pengguna (syarat App Store & Google Play):
 * komentar, laporan warga di umpan, atau siaran langsung. Boleh tanpa akun.
 * Server: POST /api/mobile/laporkan (lihat docs/AKUN.md).
 */

export type JenisKonten = 'komentar' | 'laporan' | 'siaran';

export const ALASAN_LAPORAN = [
  { kode: 'palsu', label: 'Informasi palsu atau bukan kejadian karhutla' },
  { kode: 'tidak-pantas', label: 'Konten kekerasan, seksual, atau tidak pantas' },
  { kode: 'kebencian', label: 'Ujaran kebencian, pelecehan, atau ancaman' },
  { kode: 'spam', label: 'Spam, iklan, atau penipuan' },
  { kode: 'bahaya', label: 'Membahayakan orang atau membuka data pribadi' },
  { kode: 'lainnya', label: 'Lainnya' },
] as const;

export type KodeAlasan = (typeof ALASAN_LAPORAN)[number]['kode'];

export async function laporkanKonten(isi: {
  jenis: JenisKonten;
  id: string;
  alasan: KodeAlasan;
  catatan: string;
}): Promise<{ ok: true } | { ok: false; galat: string }> {
  if (MODE_DEMO) return { ok: true };
  const token = tokenSesi();
  try {
    const r = await fetch(`${API_URL}/api/mobile/laporkan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ ...isi, catatan: isi.catatan.trim() }),
    });
    if (r.ok) return { ok: true };
    const json = (await r.json().catch(() => null)) as { galat?: string } | null;
    return { ok: false, galat: json?.galat ?? `Laporan gagal terkirim (HTTP ${r.status}).` };
  } catch {
    return { ok: false, galat: 'Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.' };
  }
}
