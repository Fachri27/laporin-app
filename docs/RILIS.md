# Rilis ke App Store & Google Play

Status: **aplikasi siap dibuild dan diajukan.** Yang tersisa ada di luar kode aplikasi: akun
developer, kunci/ID dari Google & Apple, dan server situs (lihat [Server](#server-urusan-tim-situs)).

## Yang sudah disiapkan di aplikasi

| Syarat | Di mana |
|--------|---------|
| Tidak mungkin terkirim ke toko dalam **mode demo** — build `production` gagal bila `EXPO_PUBLIC_API_URL` bukan `https://` | `app.config.js`, `eas.json` |
| Semua fitur di dalam aplikasi, tidak melempar ke website (komentar, suka, kirim laporan, captcha tamu di WebView) | `components/captcha-laporan.tsx` |
| **Hapus akun** dari dalam aplikasi (Apple 5.1.1(v), Google Play) | Pengaturan → Hapus akun |
| **Laporkan** konten (komentar, laporan, siaran) & **Blokir** penulis komentar (Apple 1.2) | tekan lama komentar / kartu umpan, 🚩 di siaran |
| **Ketentuan Penggunaan** (larangan konten melanggar) & **Kebijakan Privasi** di aplikasi, disetujui saat masuk/kirim/siaran | `app/ketentuan.tsx`, `app/privasi.tsx`, `constants/hukum.ts` |
| **Sign in with Apple** di iOS (Apple 4.8, karena ada login Google) | `components/akun/panel-masuk.tsx` |
| Izin minimal: Android tanpa `SYSTEM_ALERT_WINDOW`, tanpa `READ_MEDIA_*`, tanpa lokasi latar belakang; iOS tanpa teks izin Always/Motion/Face ID yang tak dipakai | `app.json` |
| iOS: hanya HTTPS di produksi (ATS), `ITSAppUsesNonExemptEncryption = NO`, privacy manifest | `app.json`, `app.config.js` |
| Ikon 1024 px tanpa kanal alpha (syarat App Store) | `assets/images/icon.png` |
| AAB untuk Play, nomor build naik otomatis (`appVersionSource: remote`) | `eas.json` |

> Modul native baru (WebView, Apple Authentication) mengubah *runtime version*. Development /
> preview build lama tidak menerima EAS Update lagi — buat build baru.

## Yang perlu Anda siapkan

1. **Apple Developer Program** (berbayar per tahun) + aplikasi di App Store Connect dengan bundle ID
   `earth.nusantara.fire.lapor`. Kapabilitas *Sign in with Apple* diatur otomatis oleh EAS.
2. **Google Play Console** — sebaiknya akun **organisasi** (akun pribadi baru wajib uji tertutup dulu
   dengan belasan penguji ±2 minggu). Paket: `earth.nusantara.fire.lapor`.
3. **Google Cloud → OAuth client** (proyek yang sama dengan situs, lihat [AKUN.md](AKUN.md)):
   - *Web application* → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (aplikasi) **dan** `GOOGLE_WEB_CLIENT_ID` (server).
   - *Android* → paket di atas + SHA-1 **App signing key** dari Play Console (Setup → App integrity)
     dan SHA-1 kunci upload EAS (`npx eas-cli credentials`).
   - *iOS* → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` + `GOOGLE_IOS_URL_SCHEME`.
   Tanpa ini tombol Google nonaktif; di iOS warga tetap bisa masuk dengan Apple.
4. **Kunci Maps SDK for Android** (dibatasi ke paket + SHA-1) → `GOOGLE_MAPS_ANDROID_API_KEY`.
   Tanpa kunci, layar peta di Android hanya menampilkan petunjuk (tidak crash).
5. **Email kontak publik** → `EXPO_PUBLIC_KONTAK_EMAIL` (muncul di Pengaturan, Ketentuan, Privasi).

Simpan semuanya sebagai **EAS environment variables** lingkungan `production` (dan `preview`):

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value … --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID  --value … --visibility plaintext
npx eas-cli@latest env:create --environment production --name GOOGLE_IOS_URL_SCHEME             --value … --visibility plaintext
npx eas-cli@latest env:create --environment production --name GOOGLE_MAPS_ANDROID_API_KEY       --value … --visibility sensitive
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_KONTAK_EMAIL          --value … --visibility plaintext
```

Isi juga nilai `EXPO_PUBLIC_*` yang sama di `.env.production`, karena `eas update` membaca file itu.
`EXPO_PUBLIC_API_URL` sudah diisi `https://fire.nusantara.earth`, di `.env.production` dan juga di
`eas.json`.

## Build & kirim

```bash
# Cek cepat bahwa iOS terkompilasi, tanpa akun Apple (build simulator):
npx eas-cli@latest build --profile uji-ios-simulator --platform ios

# Build toko
npx eas-cli@latest build --profile production --platform android   # .aab
npx eas-cli@latest build --profile production --platform ios       # minta login Apple sekali

# Kirim
npx eas-cli@latest submit --profile production --platform ios      # ke TestFlight → App Store Connect
# Android: AAB PERTAMA wajib diunggah manual di Play Console (aturan Google).
# Setelah itu, dengan service account key Play:
npx eas-cli@latest submit --profile production --platform android  # jalur internal, status draf
```

Perubahan JS/tampilan berikutnya cukup `npx eas-cli@latest update --channel production --environment production --clear-cache --message "…"`.
Perubahan modul native = build baru.

## Isian App Store Connect

- **Nama**: Lapor Karhutla · **Subjudul**: Laporkan kebakaran hutan & lahan
- **Kategori**: Utilities (sekunder: News) · **Harga**: gratis, tanpa pembelian dalam aplikasi
- **URL dukungan** & **URL Kebijakan Privasi**: halaman situs berisi [KEBIJAKAN-PRIVASI.md](KEBIJAKAN-PRIVASI.md)
- **Kata kunci**: karhutla,kebakaran hutan,kebakaran lahan,lapor,asap,api,titik api,bencana,lingkungan
- **Deskripsi** (bisa dipakai juga di Play):

  > Lihat api atau asap kebakaran hutan dan lahan? Laporkan langsung dari HP Anda.
  >
  > • Foto dan video dari kamera dengan lokasi GPS akurat — titik kejadian ikut terkirim.
  > • Siaran langsung ke petugas supaya kejadian bisa dilihat saat itu juga.
  > • Lapor tanpa akun, bahkan anonim. Laporan diverifikasi petugas sebelum tayang.
  > • Pantau laporan warga lain di beranda dan peta, sukai, dan beri kabar lewat komentar.
  > • Riwayat "Laporanku" dengan status verifikasi bila masuk dengan Google atau Apple.
  >
  > Aplikasi ini bukan layanan darurat. Bila ada ancaman langsung, hubungi 112.

- **App Privacy** (tidak ada pelacakan; semua "dipakai untuk fungsi aplikasi"):

  | Data | Terkait identitas | Catatan |
  |------|-------------------|---------|
  | Kontak → Nama, Email | Ya | Hanya bila masuk; nama opsional di laporan |
  | Lokasi → Lokasi persis | Ya | Titik kejadian & GPS siaran; laporan anonim tidak terkait akun |
  | Konten pengguna → Foto/video, Audio, Konten lain (komentar) | Ya | |
  | Identifier → User ID | Ya | Akun |

- **Rating usia**: jawab kuesioner — ada konten buatan pengguna dengan moderasi dan siaran langsung.
- **Catatan untuk reviewer** (App Review Information):

  > Akun bersifat opsional. Melapor bisa tanpa akun (tekan ➕, ambil foto, isi judul & cerita, Kirim —
  > verifikasi singkat Cloudflare muncul di dalam aplikasi). Untuk menyukai/berkomentar, masuk dengan
  > Sign in with Apple. Moderasi: tekan lama komentar atau kartu laporan → Laporkan / Blokir; tombol
  > 🚩 di siaran. Hapus akun: Profil → ⚙︎ Pengaturan → Hapus akun. Lokasi hanya dipakai saat aplikasi
  > terbuka. Siaran langsung butuh kamera & mikrofon dan hanya ditonton petugas kecuali pelapor
  > memilih "Tampilkan di beranda warga".

- **Screenshot**: iPhone 6,9" (1320×2868) minimal 3 — beranda, kamera + HUD GPS, form laporan,
  siaran langsung, profil. `supportsTablet: false`, jadi screenshot iPad tidak diperlukan.

## Isian Google Play Console

- **Kategori**: Alat (Tools) · gratis · **tanpa iklan** · bukan untuk anak-anak (target 13+/18+)
- **Grafis**: ikon `assets/toko/ikon-play-512.png`, feature graphic `assets/toko/grafis-fitur-1024x500.png`,
  plus minimal 2 screenshot ponsel (ambil dari HP: beranda, kamera, form laporan, siaran).
- **Deskripsi singkat** (≤ 80): Laporkan kebakaran hutan & lahan dengan foto, video, dan siaran langsung.
- **Kebijakan privasi**: URL halaman yang sama dengan App Store.
- **Penghapusan akun**: aplikasi → Pengaturan → Hapus akun; *URL web* untuk permintaan hapus akun
  wajib diisi — pakai halaman privasi (bagian "Penyimpanan dan penghapusan") + email kontak.
- **Keamanan data (Data safety)**: data dienkripsi saat transit; pengguna bisa meminta penghapusan.

  | Jenis data | Dikumpulkan | Dibagikan* | Wajib? | Tujuan |
  |------------|-------------|-----------|--------|--------|
  | Lokasi persis | Ya | Tidak | Opsional (bisa diketik manual) | Fungsi aplikasi |
  | Nama, Email, User ID | Ya | Tidak | Opsional (akun) | Fungsi aplikasi, pengelolaan akun |
  | Foto, Video | Ya | Tidak | Wajib untuk melapor | Fungsi aplikasi |
  | Rekaman suara (siaran) | Ya | Tidak | Opsional | Fungsi aplikasi |
  | Konten lain buatan pengguna (komentar) | Ya | Tidak | Opsional | Fungsi aplikasi |
  | Interaksi aplikasi (suka) | Ya | Tidak | Opsional | Fungsi aplikasi |

  \* Penyedia layanan yang memproses atas nama Anda (hosting, LiveKit, Cloudflare) tidak dihitung "dibagikan".
- **Rating konten (IARC)**: pengguna bisa berinteraksi (komentar, siaran) dan membagikan lokasi; tidak ada
  pembelian digital.
- **Izin**: tidak ada izin sensitif yang perlu deklarasi (tanpa foto/video penuh, lokasi latar belakang,
  layanan latar depan, atau SMS/telepon).

## Server (urusan tim situs)

Aplikasi produksi memanggil `https://fire.nusantara.earth`. Sebelum diajukan ke toko — reviewer
mencoba semua fitur — pastikan:

1. Branch **`feat/api-mobile`** di repo situs sudah di-deploy. Berisi `/api/mobile/*` dan dua migrasi
   tambahan (`20261017120000_api_mobile`, `20261017130000_moderasi_apple_mobile`), yang otomatis jalan
   lewat `prisma migrate deploy` saat container start.
2. Env server (lihat `.env.example` situs): `GOOGLE_WEB_CLIENT_ID`, `APPLE_BUNDLE_ID`,
   `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`, `TURNSTILE_SECRET_KEY` +
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TRUSTED_PROXY_HOPS` (batas laju per IP), `ALERT_WEBHOOK_URL`
   (laporan konten dikirim ke sini).
3. Reverse proxy: `client_max_body_size` ≥ 101 MB untuk `/api/mobile/`.
4. Halaman **Kebijakan Privasi** & **Ketentuan** dari [KEBIJAKAN-PRIVASI.md](KEBIJAKAN-PRIVASI.md) dan
   [KETENTUAN.md](KETENTUAN.md).
5. Belum ada di CMS (API-nya sudah ada): halaman petugas untuk menonton siaran (`/api/admin/siaran`,
   bisa menyalin `mock-server/penonton.html`) dan antrean tinjauan `content_reports`. Komentar yang
   dilaporkan 3 orang tersembunyi otomatis, dan bisa dipulihkan dari moderasi komentar CMS.
6. Sebelum siaran publik dipakai luas: kirim titik GPS persis hanya ke petugas (lihat
   [LIVE.md](LIVE.md#ditonton-warga-siaran-publik)).
