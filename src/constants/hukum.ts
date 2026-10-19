/**
 * Ketentuan Penggunaan & Kebijakan Privasi yang tampil di aplikasi
 * (app/ketentuan.tsx, app/privasi.tsx). Salinan untuk dipasang di situs —
 * URL-nya wajib diisi di App Store Connect & Play Console — ada di
 * docs/KETENTUAN.md dan docs/KEBIJAKAN-PRIVASI.md; ubah keduanya bersamaan.
 *
 * Isinya mengikuti perilaku aplikasi yang sebenarnya. Kalau fitur berubah
 * (mis. siaran mulai direkam), perbarui teks ini dan TANGGAL_BERLAKU.
 */

/** Email kontak publik (wajib untuk toko aplikasi). Diisi lewat .env / eas.json. */
export const KONTAK_EMAIL = (process.env.EXPO_PUBLIC_KONTAK_EMAIL ?? '').trim();

export const TANGGAL_BERLAKU = '17 Oktober 2026';

export type Bagian = { judul: string; isi: string[] };

const kontak = KONTAK_EMAIL
  ? `Hubungi kami di ${KONTAK_EMAIL}, atau lewat menu Pengaturan → Hubungi kami.`
  : 'Hubungi kami lewat menu Pengaturan → Hubungi kami.';

export const KETENTUAN: Bagian[] = [
  {
    judul: 'Tentang layanan',
    isi: [
      'Lapor Karhutla adalah aplikasi untuk melaporkan kebakaran hutan dan lahan (karhutla) kepada pengelola fire.nusantara.earth dan petugas. Laporan diverifikasi lebih dulu sebelum tampil untuk umum.',
      'Aplikasi ini bukan layanan darurat. Bila ada ancaman langsung terhadap jiwa atau permukiman, hubungi 112 atau petugas pemadam setempat terlebih dahulu.',
    ],
  },
  {
    judul: 'Keselamatan Anda',
    isi: [
      'Jangan mendekati api atau asap untuk memotret, merekam, atau siaran langsung. Keselamatan Anda lebih penting daripada rekaman.',
    ],
  },
  {
    judul: 'Konten yang Anda kirim',
    isi: [
      'Anda bertanggung jawab atas laporan, foto, video, siaran, dan komentar yang Anda kirim. Kirim hanya kejadian yang benar dan konten yang Anda ambil sendiri atau berhak Anda bagikan.',
      'Dengan mengirim konten, Anda mengizinkan pengelola menyimpan, memverifikasi, menyunting seperlunya (mis. merapikan judul atau menerjemahkan), dan menayangkannya di aplikasi dan fire.nusantara.earth untuk kepentingan publik terkait karhutla.',
    ],
  },
  {
    judul: 'Tidak ada toleransi untuk konten yang melanggar',
    isi: [
      'Dilarang mengirim konten palsu atau menyesatkan, kekerasan, pornografi, ujaran kebencian, pelecehan, ancaman, spam, penipuan, atau konten yang membuka data pribadi orang lain. Dilarang pula menyalahgunakan siaran langsung, komentar, atau hadiah untuk melecehkan orang lain.',
      'Setiap orang bisa melaporkan konten lewat tombol Laporkan dan memblokir penulis komentar. Laporan ditinjau pengelola paling lambat dalam 24 jam. Konten yang melanggar dihapus, dan akun pengirimnya bisa dinonaktifkan.',
    ],
  },
  {
    judul: 'Akun',
    isi: [
      'Akun bersifat opsional. Melapor dan siaran tetap bisa tanpa akun, termasuk secara anonim. Anda bisa menghapus akun kapan saja dari Pengaturan → Hapus akun.',
    ],
  },
  {
    judul: 'Perubahan dan kontak',
    isi: [
      `Ketentuan ini dapat diperbarui; versi terbaru selalu tersedia di aplikasi. Berlaku sejak ${TANGGAL_BERLAKU}.`,
      kontak,
    ],
  },
];

export const PRIVASI: Bagian[] = [
  {
    judul: 'Ringkasnya',
    isi: [
      'Kami hanya mengumpulkan data yang diperlukan untuk menerima dan memverifikasi laporan karhutla. Tidak ada iklan, tidak ada pelacakan lintas aplikasi, dan data Anda tidak dijual.',
    ],
  },
  {
    judul: 'Data saat Anda melapor',
    isi: [
      'Judul, cerita, foto/video beserta metadatanya (termasuk lokasi GPS dan waktu pengambilan di EXIF foto), titik lokasi kejadian, serta nama bila Anda tidak memilih anonim.',
      'Alamat IP pengirim dicatat server untuk mencegah penyalahgunaan. Laporan tanpa akun melewati verifikasi singkat Cloudflare Turnstile.',
      'Laporan anonim tidak dikaitkan dengan akun Anda, dan nama Anda tidak dikirim.',
    ],
  },
  {
    judul: 'Data akun (opsional)',
    isi: [
      'Bila Anda masuk dengan Google atau Apple: nama, alamat email (bisa alamat relay Apple), dan foto profil Google. Dipakai untuk riwayat Laporanku, suka, dan komentar. Nama Anda tampil bersama komentar yang Anda tulis.',
    ],
  },
  {
    judul: 'Siaran langsung',
    isi: [
      'Video, suara, dan lokasi GPS live dikirim ke penonton selama siaran berlangsung — hanya petugas, atau juga warga lain bila Anda menyalakan "Tampilkan di beranda warga". Saat ini siaran, komentar, dan hadiah dalam siaran tidak direkam atau disimpan.',
    ],
  },
  {
    judul: 'Izin perangkat',
    isi: [
      'Kamera dan mikrofon untuk memotret, merekam, dan siaran; lokasi (hanya saat aplikasi dipakai) untuk menandai titik kejadian; galeri hanya untuk foto/video yang Anda pilih sendiri. Semua izin bisa dicabut di pengaturan perangkat.',
    ],
  },
  {
    judul: 'Pihak yang terlibat',
    isi: [
      'Pengelola fire.nusantara.earth dan petugas yang memverifikasi laporan. Penyedia layanan teknis: Google dan Apple (masuk akun), Cloudflare (verifikasi anti-bot), LiveKit (siaran langsung), Expo (pembaruan aplikasi), serta penyedia peta dan hosting. Mereka memproses data hanya untuk menjalankan layanannya.',
    ],
  },
  {
    judul: 'Penyimpanan dan penghapusan',
    isi: [
      'Laporan disimpan sebagai catatan kejadian karhutla untuk kepentingan publik. Menghapus akun (Pengaturan → Hapus akun) menghapus akun, sesi, dan suka Anda; nama dan email dihapus dari komentar Anda; laporan yang sudah dikirim tetap tersimpan tanpa nama dan tanpa keterkaitan dengan akun.',
      'Untuk meminta salinan atau penghapusan data lain, hubungi kami.',
    ],
  },
  {
    judul: 'Perubahan dan kontak',
    isi: [`Kebijakan ini dapat diperbarui. Berlaku sejak ${TANGGAL_BERLAKU}.`, kontak],
  },
];
