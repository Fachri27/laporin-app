/**
 * Bahasa visual "SAKSI" (desain Claude, 6 artboard), dipakai untuk merek Laporin:
 * - Tiga warna: tinta #0C0E0D (latar), tulang #EDE8DF (teks, tombol terang, bilah bawah),
 *   sinyal #FF4A1C (aksen; teks di atasnya tinta, bukan putih — putih di atas sinyal tidak terbaca).
 *   Keterangan, garis, dan panel = tulang tembus pandang di atas tinta (62 % / 16 % / 6 %).
 * - Mode gelap = persis desain. Mode terang = padanannya dibalik: latar tulang, teks tinta,
 *   bilah bawah tinta. Layar media (kamera, siaran, story) tetap gelap — lihat `Media`.
 * - Huruf: Poppins untuk semuanya, sama dengan situs (desain aslinya Big Shoulders Display,
 *   Inter Tight, JetBrains Mono). Judul huruf biasa; label kecil & tombol utama kapital — `Fonts`.
 */

import { Platform, type ViewStyle } from 'react-native';

export const TINTA = '#0C0E0D';
export const TULANG = '#EDE8DF';
export const SINYAL = '#FF4A1C';

export const Colors = {
  light: {
    text: TINTA,
    textSecondary: '#5E5E5A',
    background: TULANG,
    /** Panel & kolom isian: tinta 5 % di atas tulang. */
    surface: '#E2DDD4',
    /** Kotak lembut di dalam panel, chip, kerangka gambar. */
    surfaceMuted: '#D9D4CC',
    canvas: TULANG,
    border: '#CAC5BC',
    borderStrong: '#A9A69F',
    accent: SINYAL,
    accentPressed: '#E03A0E',
    accentSoft: 'rgba(255,74,28,0.12)',
    accentBorder: 'rgba(255,74,28,0.45)',
    accentSofter: 'rgba(255,74,28,0.06)',
    /** Sinyal yang cukup gelap untuk teks di atas tulang (kontras ≥ 4,5:1). */
    accentText: '#B02C08',
    onAccent: TINTA,
    onAccentSoft: '#B02C08',
    danger: '#B3261E',
    warning: '#8A5A00',
    warningSoft: 'rgba(176,120,0,0.12)',
    success: '#1E6B43',
    successSoft: 'rgba(30,107,67,0.12)',
    /** Avatar berinisial: tinta 12 %. */
    inverse: 'rgba(12,14,13,0.12)',
    onInverse: TINTA,
    onInverseMuted: 'rgba(12,14,13,0.62)',
    sage: 'rgba(176,120,0,0.12)',
    onSage: '#8A5A00',
    verified: TINTA,
    verifiedSoft: 'rgba(12,14,13,0.08)',
    /** Tombol "terang" desain (tulang di atas tinta) menjadi tinta di mode terang. */
    tombolTerang: TINTA,
    onTombolTerang: TULANG,
    /** Chip/tab terpilih: terisi penuh. */
    chipAktif: TINTA,
    onChipAktif: TULANG,
    /** Bilah bawah melayang: pil tinta di atas latar tulang. */
    bilah: TINTA,
    onBilah: TULANG,
    bilahAtas: TULANG,
    navBiasa: TULANG,
  },
  dark: {
    text: TULANG,
    /** Tulang 62 % di atas tinta. */
    textSecondary: '#979590',
    background: TINTA,
    /** Tulang 6 %. */
    surface: '#1A1B1A',
    /** Tulang 10 %. */
    surfaceMuted: '#232422',
    canvas: TINTA,
    /** Tulang 16 % — garis pembatas & bingkai tombol. */
    border: '#30312F',
    /** Tulang 30 %. */
    borderStrong: '#4F4F4C',
    accent: SINYAL,
    accentPressed: '#E03A0E',
    accentSoft: 'rgba(255,74,28,0.16)',
    accentBorder: 'rgba(255,74,28,0.5)',
    accentSofter: 'rgba(255,74,28,0.08)',
    accentText: SINYAL,
    onAccent: TINTA,
    onAccentSoft: '#FF7A57',
    danger: '#FF7A57',
    warning: '#E8BD55',
    warningSoft: 'rgba(232,189,85,0.12)',
    success: '#7FD6A0',
    successSoft: 'rgba(127,214,160,0.12)',
    /** Avatar berinisial: tulang 20 %. */
    inverse: 'rgba(237,232,223,0.2)',
    onInverse: TULANG,
    onInverseMuted: 'rgba(237,232,223,0.7)',
    sage: 'rgba(232,189,85,0.12)',
    onSage: '#E8BD55',
    verified: TULANG,
    verifiedSoft: 'rgba(237,232,223,0.08)',
    tombolTerang: TULANG,
    onTombolTerang: TINTA,
    chipAktif: TULANG,
    onChipAktif: TINTA,
    /** Bilah bawah melayang: pil tulang di atas latar tinta. */
    bilah: TULANG,
    onBilah: TINTA,
    bilahAtas: TINTA,
    navBiasa: TINTA,
  },
} as const;

export type ThemeColors = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** Warna tetap untuk layar media yang selalu gelap (kamera, siaran, story) dan label di atas foto. */
export const Media = {
  latar: TINTA,
  kartu: '#161817',
  teks: TULANG,
  redup: 'rgba(237,232,223,0.75)',
  /** Tombol & label di atas foto: kotak tinta pekat, seperti desain. */
  kaca: 'rgba(12,14,13,0.86)',
  kacaTebal: 'rgba(12,14,13,0.92)',
  /** Pil kecil di atas poster (jumlah media, penonton). */
  pil: 'rgba(12,14,13,0.86)',
  garis: 'rgba(237,232,223,0.25)',
  aksen: SINYAL,
  onAksen: TINTA,
  hijau: '#7FD6A0',
  merah: SINYAL,
  /** Titik berdenyut "live". */
  denyut: SINYAL,
  oranye: '#FF8A3D',
  komunitas: 'rgba(255,138,61,0.85)',
  namaObrolan: '#FFB59E',
} as const;

/**
 * Nama keluarga huruf yang dimuat di app/_layout.tsx. Semuanya Poppins, sama dengan situs
 * fire.nusantara.earth (bobot 400–700). Setiap bobot = berkas sendiri.
 */
export const Fonts = {
  /** Label data kecil: koordinat, kode, chip. Huruf kapital dengan jarak huruf. */
  mono: 'Poppins_500Medium',
  monoTebal: 'Poppins_600SemiBold',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  tebal: 'Poppins_700Bold',
  /** Judul kartu & bagian. */
  judul: 'Poppins_700Bold',
  /** Judul besar layar, tombol utama, merek. */
  judulTebal: 'Poppins_700Bold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 12,
  large: 18,
  /** Kartu laporan & lembar. */
  kartu: 20,
  pill: 999,
} as const;

/** Bayangan untuk yang melayang di atas isi. Desainnya datar: tombol tidak berbayang. */
export const Bayangan = {
  lembut: '0 8px 24px rgba(0,0,0,0.18)',
  kartu: '0 4px 14px rgba(0,0,0,0.25)',
  /** Bilah bawah melayang di atas isi. */
  hutan: '0 10px 30px rgba(0,0,0,0.35)',
} as const;

/**
 * Gradasi CSS (linear/radial-gradient) sebagai gaya View. Di HP memakai
 * `experimental_backgroundImage` (React Native 0.76+); react-native-web mengabaikan properti
 * itu tetapi meneruskan `backgroundImage` ke CSS, jadi pratinjau web ikut bergradasi.
 */
export function gradasi(css: string): ViewStyle {
  return (Platform.OS === 'web' ? { backgroundImage: css } : { experimental_backgroundImage: css }) as ViewStyle;
}
