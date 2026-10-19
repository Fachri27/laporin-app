import { useSyncExternalStore } from 'react';

import { bacaAman, simpanAman } from '@/lib/penyimpanan-aman';

/**
 * Penulis komentar yang diblokir warga di HP ini (syarat App Store Guideline
 * 1.2 untuk konten buatan pengguna). Kuncinya `penulis` dari server — HMAC,
 * bukan email/IP — jadi daftar ini tidak menyimpan data pribadi orang lain.
 * Komentar mereka disembunyikan di lembar komentar.
 */

const KUNCI = 'lapor-karhutla.blokir';
/** expo-secure-store membatasi ±2 KB per nilai; 80 × 16 karakter masih jauh di bawahnya. */
const MAKS = 80;

let diblokir: ReadonlySet<string> = new Set();
let dimuat = false;
const pendengar = new Set<() => void>();

function langgan(f: () => void) {
  pendengar.add(f);
  if (!dimuat) {
    dimuat = true;
    void bacaAman(KUNCI).then((teks) => {
      try {
        const daftar = JSON.parse(teks ?? '[]') as unknown;
        if (Array.isArray(daftar)) ubah(new Set(daftar.filter((x): x is string => typeof x === 'string')));
      } catch {}
    });
  }
  return () => {
    pendengar.delete(f);
  };
}

function ubah(baru: ReadonlySet<string>) {
  diblokir = baru;
  for (const f of pendengar) f();
}

export function useBlokir(): ReadonlySet<string> {
  return useSyncExternalStore(langgan, () => diblokir);
}

export async function blokirPenulis(penulis: string): Promise<void> {
  const baru = new Set(diblokir);
  baru.add(penulis);
  const daftar = [...baru].slice(-MAKS);
  ubah(new Set(daftar));
  await simpanAman(KUNCI, JSON.stringify(daftar));
}

export async function bukaSemuaBlokir(): Promise<void> {
  ubah(new Set());
  await simpanAman(KUNCI, '[]');
}
