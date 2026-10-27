import type { BufferOptions } from 'expo-video';

/**
 * Batas penyangga semua pemutar video (umpan, detail, story). Bawaan ExoPlayer di Android
 * boleh menyangga hingga ±130 MB per video di memori Java; dengan dua–tiga pemutar hidup
 * sekaligus (detail menyiapkan video tetangganya) aplikasi kehabisan memori dan tertutup.
 * 10 detik ke depan, paling banyak 12 MB per pemutar, sudah cukup untuk video lapangan.
 */
export const PENYANGGA_VIDEO: BufferOptions = {
  preferredForwardBufferDuration: 10,
  minBufferForPlayback: 2,
  maxBufferBytes: 12 * 1024 * 1024,
  prioritizeTimeOverSizeThreshold: false,
};
