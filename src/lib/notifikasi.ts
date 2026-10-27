import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

import { ambilLaporanSaya, type LaporanSaya } from '@/lib/akun';

/**
 * Notifikasi (ikon lonceng) = kabar status laporan warga sendiri, dari /api/mobile/saya/laporan:
 * diterima & ditinjau, terverifikasi (tayang), atau tidak ditayangkan. Situs belum mengirim
 * notifikasi, jadi daftarnya dibentuk di HP: status yang belum pernah dilihat di layar
 * Notifikasi ditandai baru. Peringatan bencana dan aktivitas warga lain belum ada datanya.
 *
 * Pertama kali dimuat untuk satu akun, semua status dianggap sudah dilihat — supaya pengguna
 * lama tidak mendapat puluhan "kabar baru" sekaligus. Perubahan sesudahnya yang ditandai baru.
 * Catatan "sudah dilihat" disimpan per akun, jadi berganti akun di HP yang sama tetap benar.
 */

export type Kabar = LaporanSaya & { baru: boolean };

type Keadaan = {
  status: 'kosong' | 'memuat' | 'siap' | 'galat';
  kabar: Kabar[];
  belumDibaca: number;
};

const NAMA_BERKAS = 'kabar-dilihat.json';

type Dilihat = Record<string, LaporanSaya['status']>;

let akun: string | null = null;
let laporan: LaporanSaya[] = [];
/** Per id akun: status terakhir yang sudah dilihat warga, per id laporan. */
const semuaDilihat: Record<string, Dilihat> = bacaDilihat();
let keadaan: Keadaan = { status: 'kosong', kabar: [], belumDibaca: 0 };
const pendengar = new Set<() => void>();

function berkas(): File {
  return new File(Paths.document, NAMA_BERKAS);
}

function bacaDilihat(): Record<string, Dilihat> {
  try {
    const f = berkas();
    return f.exists ? (JSON.parse(f.textSync()) as Record<string, Dilihat>) : {};
  } catch {
    return {};
  }
}

function tulisDilihat() {
  try {
    berkas().write(JSON.stringify(semuaDilihat));
  } catch {
    // Gagal menyimpan (web, penyimpanan penuh): kabar yang sama tampil baru lagi lain kali; tidak fatal.
  }
}

function hitung(status: Keadaan['status']) {
  const dilihat = akun ? semuaDilihat[akun] : undefined;
  const kabar = [...laporan]
    .sort((a, b) => Date.parse(b.dibuat) - Date.parse(a.dibuat))
    .map((l) => ({ ...l, baru: dilihat !== undefined && dilihat[l.id] !== l.status }));
  keadaan = { status, kabar, belumDibaca: kabar.filter((k) => k.baru).length };
  for (const f of pendengar) f();
}

export function useKabar(): Keadaan {
  return useSyncExternalStore(
    (f) => {
      pendengar.add(f);
      return () => {
        pendengar.delete(f);
      };
    },
    () => keadaan,
  );
}

let berjalan: Promise<void> | null = null;

function statusSekarang(): Dilihat {
  return Object.fromEntries(laporan.map((l) => [l.id, l.status]));
}

/**
 * Ambil laporan milik akun yang masuk (`idAkun`). Dipanggil beranda (titik di lonceng) dan
 * layar Notifikasi.
 */
export function muatKabar(idAkun: string): Promise<void> {
  if (akun !== idAkun) {
    akun = idAkun;
    laporan = [];
    hitung('kosong');
  }
  berjalan ??= (async () => {
    if (keadaan.status !== 'siap') hitung('memuat');
    const h = await ambilLaporanSaya();
    berjalan = null;
    // Akun berganti selama menunggu: hasil ini milik akun sebelumnya.
    if (akun !== idAkun) return;
    if (!h.ok) return hitung(laporan.length > 0 ? 'siap' : 'galat');
    laporan = h.laporan;
    if (!semuaDilihat[idAkun]) {
      semuaDilihat[idAkun] = statusSekarang();
      tulisDilihat();
    }
    hitung('siap');
  })();
  return berjalan;
}

/** Semua kabar yang sedang tampil dianggap sudah dibaca. */
export function tandaiDibaca() {
  if (!akun) return;
  semuaDilihat[akun] = { ...semuaDilihat[akun], ...statusSekarang() };
  tulisDilihat();
  hitung(keadaan.status);
}

/** Keluar akun: kabar akun sebelumnya tidak boleh tampil. */
export function kosongkanKabar() {
  akun = null;
  laporan = [];
  hitung('kosong');
}
