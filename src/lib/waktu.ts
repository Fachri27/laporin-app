/** "baru saja", "18 menit lalu", "3 jam lalu", "2 hari lalu" — waktu HP dibanding `saat` (epoch ms). */
export function waktuLalu(saat: number, sekarang = Date.now()): string {
  const detik = Math.max(0, Math.round((sekarang - saat) / 1000));
  if (detik < 60) return 'baru saja';
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.round(jam / 24);
  if (hari < 30) return `${hari} hari lalu`;
  return new Date(saat).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
