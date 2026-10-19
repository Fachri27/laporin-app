/**
 * Bahasa visual dari desain Figma "Disaster Reporting App Design":
 * - Layar media (beranda, kamera, siaran) selalu gelap kehijauan — lihat `Media`.
 * - Halaman (jelajah, profil, formulir) terang hangat, atau gelap di mode gelap.
 * - Aksen hijau limau #b8f34a untuk isian (tombol, lencana terverifikasi).
 *   Di atas latar terang limau tidak terbaca, jadi teks/ikon aksen memakai
 *   `accentText` (hijau tua), dan teks di atas limau memakai `onAccent`.
 * - Huruf: DM Sans (badan) dan Manrope (judul, label huruf kapital) — `Fonts`.
 */

import { Platform } from 'react-native';

const LIMAU = '#b8f34a';

export const Colors = {
  light: {
    text: '#1b211d',
    textSecondary: '#777f78',
    background: '#f7f8f5',
    surface: '#ffffff',
    surfaceMuted: '#eceee9',
    border: '#dfe2dc',
    accent: LIMAU,
    accentPressed: '#a6dd3c',
    accentSoft: '#e9f2d8',
    accentText: '#587221',
    onAccent: '#152008',
    onAccentSoft: '#40512a',
    danger: '#c84135',
    warning: '#d97725',
    success: '#587221',
    /** Kartu gelap di halaman terang (mis. kartu kontribusi profil). */
    inverse: '#26342b',
    onInverse: '#dfead5',
  },
  dark: {
    text: '#f7f8f8',
    textSecondary: '#9aa39b',
    background: '#101312',
    surface: '#1a1f1c',
    surfaceMuted: '#232a26',
    border: 'rgba(255,255,255,0.12)',
    accent: LIMAU,
    accentPressed: '#a6dd3c',
    accentSoft: 'rgba(184,243,74,0.14)',
    accentText: LIMAU,
    onAccent: '#152008',
    onAccentSoft: '#d5ecae',
    danger: '#f35e4d',
    warning: '#e08a3c',
    success: LIMAU,
    inverse: '#26342b',
    onInverse: '#dfead5',
  },
} as const;

export type ThemeColors = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** Warna tetap untuk layar media yang selalu gelap (beranda, kamera, siaran). */
export const Media = {
  latar: '#101312',
  kartu: '#151817',
  teks: '#f7f8f8',
  redup: 'rgba(255,255,255,0.62)',
  kaca: 'rgba(10,12,11,0.4)',
  kacaTebal: 'rgba(12,15,13,0.55)',
  garis: 'rgba(255,255,255,0.22)',
  limau: LIMAU,
  onLimau: '#152008',
  merah: '#db4338',
  oranye: '#d97725',
  komunitas: 'rgba(196,98,22,0.85)',
  namaObrolan: '#c8e996',
} as const;

/** Nama keluarga huruf yang dimuat di app/_layout.tsx. Setiap bobot = berkas sendiri. */
export const Fonts = {
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  judul: 'Manrope_700Bold',
  judulTebal: 'Manrope_800ExtraBold',
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
  pill: 999,
} as const;
