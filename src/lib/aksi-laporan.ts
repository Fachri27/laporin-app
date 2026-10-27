import { router } from 'expo-router';
import { Platform, Share } from 'react-native';

import type { SiaranPublik } from '@/lib/live';
import { tampilkanMenu } from '@/lib/menu-aksi';
import { urlHalaman, type Berita } from '@/lib/umpan';

/**
 * Aksi atas satu laporan umpan yang dipakai kartu beranda, Pencarian, Peta, Profil,
 * dan layar detail — supaya tujuannya sama di mana pun laporan diketuk.
 */

/** Singular: ketuk ganda selama animasi buka tidak menumpuk dua layar detail. */
/** `media` = buka di foto/video ke-n (dari carousel kartu beranda). */
export function bukaLaporan(id: number, media = 0) {
  router.push(
    { pathname: '/laporan/[id]', params: { id: String(id), ...(media > 0 && { media: String(media) }) } },
    { dangerouslySingular: true },
  );
}

/** `tulis` = langsung fokus ke kolom komentar. */
export function bukaKomentar(b: Pick<Berita, 'id' | 'slug' | 'judul'>, tulis = false) {
  router.push({
    pathname: '/komentar/[id]',
    params: { id: String(b.id), slug: b.slug ?? '', judul: b.judul, ...(tulis && { tulis: '1' }) },
  });
}

/** Tab Peta, langsung menyorot laporan ini. */
export function lihatDiPeta(id: number) {
  router.navigate({ pathname: '/peta', params: { id: String(id) } });
}

export async function bagikanLaporan(b: Pick<Berita, 'judul' | 'slug'>) {
  const url = urlHalaman(b);
  try {
    // iOS menggabungkan message + url sendiri; Android hanya membaca message.
    await Share.share(Platform.OS === 'ios' ? { message: b.judul, url } : { message: `${b.judul}\n${url}` });
  } catch {
    // Lembar bagikan ditutup atau gagal dibuka — tidak perlu diberitahukan.
  }
}

/**
 * Tombol ⋯ di kartu & detail: lihat di peta, atau laporkan konten (moderasi, wajib di toko aplikasi).
 * `denganPeta: false` bila layar sudah punya tombol peta sendiri.
 */
export function menuLaporan(b: Pick<Berita, 'id' | 'judul'>, denganPeta = true) {
  tampilkanMenu(b.judul, [
    ...(denganPeta ? [{ label: 'Lihat di peta', aksi: () => lihatDiPeta(b.id) }] : []),
    {
      label: 'Laporkan',
      merusak: true,
      aksi: () => router.push({ pathname: '/laporkan', params: { jenis: 'laporan', id: String(b.id), ringkas: b.judul } }),
    },
  ]);
}

/** Menonton siaran publik warga lain. Singular: ketukan ganda tidak menumpuk dua koneksi (suara dobel). */
export function tontonSiaran(s: Pick<SiaranPublik, 'ruang' | 'judul' | 'nama' | 'mulai'>) {
  router.push(
    { pathname: '/tonton/[ruang]', params: { ruang: s.ruang, judul: s.judul, nama: s.nama, mulai: String(s.mulai) } },
    { dangerouslySingular: true },
  );
}
