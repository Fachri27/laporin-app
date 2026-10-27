import { useSyncExternalStore } from 'react';

import { bacaAman, simpanAman } from '@/lib/penyimpanan-aman';

/**
 * Laporan yang disimpan warga (ikon bookmark di kartu & detail), untuk dibuka lagi dari
 * tab "Tersimpan" di profil. Situs belum punya fitur simpan, jadi daftarnya hanya di HP
 * ini — tidak ikut pindah ke HP lain dan tidak butuh akun. Terbaru di depan.
 */

const KUNCI = 'lapor-karhutla.tersimpan';
/** expo-secure-store membatasi ±2 KB per nilai; 200 id laporan ±1,2 KB. */
const MAKS = 200;

let tersimpan: readonly number[] = [];
let dimuat = false;
const pendengar = new Set<() => void>();

function langgan(f: () => void) {
  pendengar.add(f);
  if (!dimuat) {
    dimuat = true;
    void bacaAman(KUNCI).then((teks) => {
      try {
        const daftar = JSON.parse(teks ?? '[]') as unknown;
        if (Array.isArray(daftar)) {
          // Yang disimpan sebelum daftar termuat tetap di depan.
          const lama = daftar.filter((x): x is number => typeof x === 'number');
          ubah([...tersimpan, ...lama.filter((id) => !tersimpan.includes(id))].slice(0, MAKS));
        }
      } catch {}
    });
  }
  return () => {
    pendengar.delete(f);
  };
}

function ubah(baru: readonly number[]) {
  tersimpan = baru;
  for (const f of pendengar) f();
}

/** id laporan tersimpan, terbaru dulu. */
export function useTersimpan(): readonly number[] {
  return useSyncExternalStore(langgan, () => tersimpan);
}

export function aturSimpan(id: number, simpan: boolean) {
  ubah(simpan ? [id, ...tersimpan.filter((x) => x !== id)].slice(0, MAKS) : tersimpan.filter((x) => x !== id));
  void simpanAman(KUNCI, JSON.stringify(tersimpan));
}
