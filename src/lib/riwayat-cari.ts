import { useSyncExternalStore } from 'react';

import { bacaAman, simpanAman } from '@/lib/penyimpanan-aman';

/** "Pencarian terbaru" di layar Pencarian — hanya di HP ini, terbaru dulu. */

const KUNCI = 'lapor-karhutla.riwayat-cari';
const MAKS = 8;

let riwayat: readonly string[] = [];
let dimuat = false;
const pendengar = new Set<() => void>();

function langgan(f: () => void) {
  pendengar.add(f);
  if (!dimuat) {
    dimuat = true;
    void bacaAman(KUNCI).then((teks) => {
      try {
        const daftar = JSON.parse(teks ?? '[]') as unknown;
        if (Array.isArray(daftar)) ubah(daftar.filter((x): x is string => typeof x === 'string').slice(0, MAKS));
      } catch {}
    });
  }
  return () => {
    pendengar.delete(f);
  };
}

function ubah(baru: readonly string[]) {
  riwayat = baru;
  for (const f of pendengar) f();
}

export function useRiwayatCari(): readonly string[] {
  return useSyncExternalStore(langgan, () => riwayat);
}

export function catatPencarian(kata: string) {
  const k = kata.trim();
  if (!k) return;
  ubah([k, ...riwayat.filter((x) => x.toLowerCase() !== k.toLowerCase())].slice(0, MAKS));
  void simpanAman(KUNCI, JSON.stringify(riwayat));
}

export function hapusRiwayatCari() {
  ubah([]);
  void simpanAman(KUNCI, '[]');
}
