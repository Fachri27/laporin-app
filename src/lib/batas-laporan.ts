/**
 * Batas kiriman laporan — salinan dari lib/batas-laporan.ts di repo situs
 * (fire-buminusantara). Server tetap memeriksa ulang; di sini hanya supaya
 * warga tidak menunggu unggahan 100 MB selesai untuk tahu laporannya ditolak.
 * Kalau angka di server berubah, ubah juga di sini.
 */

/** Jumlah lampiran per laporan. */
export const BATAS_BERKAS = 6;

/** Atap ukuran total satu kiriman (= serverActions.bodySizeLimit di situs). */
export const BATAS_TOTAL_BYTE = 100 * 1024 * 1024;
export const BATAS_TOTAL_TEKS = `${BATAS_TOTAL_BYTE / (1024 * 1024)} MB`;

export const BATAS_JUDUL = 255;
export const BATAS_DESKRIPSI = 5000;
export const BATAS_NAMA = 100;

/** Situs menyarankan video ≤ 30 detik: sinyal lemah gampang putus. */
export const DURASI_VIDEO_DETIK = 30;

/** Jenis yang diterima server (dideteksi dari magic byte, lib/unggah.ts). */
export const MIME_DITERIMA = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

/** Papan ketik Indonesia sering memberi koma desimal ("-1,234"). */
function angkaKoordinat(mentah: string): number {
  return Number(mentah.trim().replace(',', '.'));
}

/** Koordinat opsional, tapi tidak setengah-setengah. Sama persis dengan server. */
export function koordinat(
  latMentah: string,
  lngMentah: string,
): { lat: number; lng: number } | null | { galat: string } {
  const adaLat = latMentah.trim() !== '';
  const adaLng = lngMentah.trim() !== '';
  if (!adaLat && !adaLng) return null;
  if (adaLat !== adaLng) return { galat: 'Latitude dan longitude harus diisi berdua.' };

  const lat = angkaKoordinat(latMentah);
  const lng = angkaKoordinat(lngMentah);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { galat: 'Latitude harus angka antara -90 dan 90.' };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { galat: 'Longitude harus angka antara -180 dan 180.' };
  }
  if (lat === 0 && lng === 0) {
    return { galat: 'Titik 0, 0 bukan lokasi di Indonesia. Periksa lagi atau kosongkan.' };
  }
  return { lat, lng };
}

/** "12.3 MB" / "840 KB" — sama dengan ukuranTeks() di situs. */
export function ukuranTeks(byte: number): string {
  if (byte >= 1024 * 1024) return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(byte / 1024))} KB`;
}

/** 75 → "01:15" */
export function durasiTeks(detik: number): string {
  const total = Math.max(0, Math.round(detik));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
