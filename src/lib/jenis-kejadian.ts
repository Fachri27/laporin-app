/**
 * Jenis kejadian di langkah 1 formulir (desain "Apa yang kamu lihat?").
 *
 * Server laporan belum punya kolom jenis (docs/API.md), jadi jenis tidak dikirim
 * sendiri: ia mengisi judul awal laporan, yang tetap bisa diubah warga di langkah 2.
 */
export type IdJenis = 'api' | 'asap' | 'lahan' | 'dampak';

export type JenisKejadian = {
  id: IdJenis;
  nama: string;
  bantuan: string;
  /** Judul awal laporan bila warga belum menulis judul sendiri. */
  judul: string;
};

export const JENIS_KEJADIAN: readonly JenisKejadian[] = [
  { id: 'api', nama: 'Api aktif', bantuan: 'Terlihat nyala api', judul: 'Api aktif terlihat' },
  { id: 'asap', nama: 'Kabut asap', bantuan: 'Asap mengganggu', judul: 'Kabut asap pekat' },
  { id: 'lahan', nama: 'Lahan terbakar', bantuan: 'Area bekas terbakar', judul: 'Lahan bekas terbakar' },
  { id: 'dampak', nama: 'Dampak lainnya', bantuan: 'Kesehatan & aktivitas', judul: 'Dampak kebakaran hutan dan lahan' },
];

export function jenisDari(id: string | null | undefined): JenisKejadian | null {
  return JENIS_KEJADIAN.find((j) => j.id === id) ?? null;
}
