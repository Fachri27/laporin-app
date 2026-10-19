# Lapor Karhutla — aplikasi mobile

Aplikasi pelaporan kebakaran hutan dan lahan untuk [fire.nusantara.earth](https://fire.nusantara.earth/id).
Bentuknya seperti aplikasi video pendek: **beranda** berisi laporan selayar penuh yang digeser ke
atas/bawah, tombol **➕** untuk melapor, dan **profil** dengan login Google (opsional). Pelaporan memakai foto/rekam langsung dari kamera
dengan **GPS live**, atau **siaran langsung** ke petugas lewat LiveKit. Dibangun dengan Expo SDK 57 +
Expo Router.

- Beranda, peta, dan fitur lapor (kamera, galeri, GPS, kirim) berjalan di **Expo Go**.
- **Siaran langsung** butuh **development build**, karena WebRTC adalah modul native yang tidak
  ada di Expo Go. Di Expo Go, layar siaran hanya menampilkan petunjuk.

## Desain

Tampilan mengikuti Figma Make **"Disaster Reporting App Design"**: layar media (beranda, kamera,
siaran) gelap kehijauan, halaman (jelajah, profil, formulir) terang, aksen hijau limau `#b8f34a`,
huruf DM Sans + Manrope. Token warna & huruf ada di `src/constants/theme.ts`: `Colors` (terang/gelap),
`Media` (layar media), `Fonts`. Di latar terang, teks aksen memakai `accentText` (hijau tua), bukan
limau, supaya terbaca.

Bilah bawah: **Beranda · Jelajah · ➕ Lapor · Live · Profil**.

**Pengecualian: Beranda** sengaja memakai tampilan umpan sebelumnya (ala TikTok, huruf sistem,
tombol aksi tanpa lingkaran, bilah bawah hitam pekat), bukan layar "Home" dari Figma.

## Beranda

- **Umpan selayar penuh**, isinya sama dengan daftar di beranda situs (`GET /api/umpan`). Video
  diputar otomatis dan berulang (ketuk untuk jeda). Laporan dengan beberapa foto/video bisa digeser
  ke samping.
- **Terbaru · Terdekat**: Terdekat mengurutkan menurut jarak dari posisi warga.
- Tombol samping: ❤️ suka, 💬 komentar (lembar dari bawah), bagikan tautan laporan, lihat di peta,
  dan suara. **Ketuk ganda** = suka, **cubit** = perbesar (kembali saat dilepas), ketuk = jeda video.
- **Tekan lama** foto/video (seperti TikTok) → **Mode bersih** atau **Laporkan**. Mode bersih
  menyembunyikan tombol, cerita, dan bilah atas sehingga hanya media yang tampil; laporan tetap bisa
  digeser. Keluar lewat tombol ⤡ di kanan atas atau tekan lama lagi.
- Kiri atas **LIVE** (siaran langsung), kanan atas **Peta**: titik semua laporan. Ketuk penanda
  lalu **Tonton** untuk membuka laporannya di beranda.
- **Siaran warga lain** yang dipilih tampil publik muncul sebagai kartu **LIVE** di atas umpan
  (pratinjau video bisu, avatar bercincin merah). Ketuk untuk menonton, berkomentar, mengetuk hati,
  dan mengirim hadiah. Lihat [docs/LIVE.md](docs/LIVE.md#ditonton-warga-siaran-publik).
- **Profil** ala TikTok: masuk dengan Google, angka Laporan · Tayang · Disukai, grid **Laporanku**
  (dengan status verifikasi) dan **Disukai**, edit profil, pengaturan & keluar. Lihat
  [docs/AKUN.md](docs/AKUN.md).
- **➕**: kamera terbuka langsung → foto/video/unggah dari galeri → **Lanjut** ke isian judul dan
  cerita → kirim. Mode **LIVE** di kamera membuka siaran langsung. Kalau ada draf yang belum
  terkirim, ➕ melanjutkannya.
- Menyukai dan berkomentar butuh akun (Google, atau Apple di iPhone). Semuanya di dalam aplikasi, tanpa
  membuka situs. Tekan lama komentar → **Laporkan** atau **Blokir** penulisnya. Pengaturan memuat
  Ketentuan, Kebijakan Privasi, Hubungi kami, dan **Hapus akun**. Lihat [docs/AKUN.md](docs/AKUN.md).

## Fitur lapor

- **Kamera live** di dalam aplikasi: mode FOTO dan VIDEO (maks. 30 detik, 720p), **zoom dengan cubit**,
  lampu kilat/senter, kamera depan/belakang.
- **HUD GPS live** di atas kamera: koordinat, akurasi (±m), dan jam yang terus berjalan.
- **Koordinat tertanam di EXIF foto**, jadi bukti lokasi ikut di berkasnya, bukan cuma di form.
- **Titik laporan otomatis**: mengikuti GPS live, lalu terkunci di posisi foto/video pertama.
  Bisa juga diketik manual.
- Lampiran dari **galeri** (HEIC iPhone otomatis diubah ke JPEG).
- Unggahan dengan **progres %** dan tombol batal. Kalau gagal, isian dan berkas tetap tersimpan.
- Validasi sama persis dengan server situs: 1–6 berkas, total 100 MB, judul, deskripsi, koordinat.
- **Siaran langsung ke petugas** (LiveKit): video 540p kamera belakang + suara, GPS live terkirim
  ke penonton, jumlah penonton, indikator kualitas sinyal, sambung ulang otomatis, layar tetap menyala.
  Ala TikTok: komentar, ketuk = hati, dan **hadiah** apresiasi dari petugas (spanduk combo "x N",
  hadiah besar melintas selayar penuh; simbolis, tanpa koin).
  Penonton hanya petugas, tidak tampil di situs publik. Lihat [docs/LIVE.md](docs/LIVE.md).
- Mode terang/gelap, teks berbahasa Indonesia seperti di situs.

## Menjalankan di HP (Expo Go)

1. Pasang **Expo Go** dari Play Store / App Store. Versinya harus mendukung **SDK 57**.
2. Di laptop:
   ```bash
   npm install
   npx expo start
   ```
3. Pindai QR code: Android lewat aplikasi Expo Go, iPhone lewat aplikasi Kamera.
   HP dan laptop harus di Wi-Fi yang sama. Kalau tidak bisa, pakai `npx expo start --tunnel`.

## Tiga mode pengiriman

| Mode | `.env` | Untuk apa |
|------|--------|-----------|
| **Demo** (bawaan) | `EXPO_PUBLIC_API_URL` kosong | Mencoba seluruh alur. Unggahan hanya disimulasikan |
| **Mock server** | `EXPO_PUBLIC_API_URL=http://<IP-laptop>:4000` | Menguji unggahan multipart sungguhan dari HP |
| **Situs lokal** | `EXPO_PUBLIC_API_URL` & `EXPO_PUBLIC_SITUS_URL` = `http://<IP-laptop>:3000` | Repo situs branch `feat/api-mobile`, `next dev -H 0.0.0.0` dengan `MOBILE_MASUK_UJI=1` |
| **Server situs** | `EXPO_PUBLIC_API_URL=https://fire.nusantara.earth` | Produksi (`.env.production`, `eas.json`), lihat [docs/API.md](docs/API.md) |

Mode ini hanya mengatur tujuan **kirim**. Beranda selalu membaca laporan dari situs
(`EXPO_PUBLIC_SITUS_URL`, bawaan produksi), karena sifatnya hanya-baca.

```bash
cp .env.example .env              # lalu isi EXPO_PUBLIC_API_URL
node mock-server/server.mjs       # mock server; berkas masuk ke mock-server/unggahan/
npx expo start --clear            # --clear wajib setelah mengubah .env
```

IP laptop bisa dilihat dengan `ipconfig getifaddr en0` (macOS).

## Mencoba siaran langsung

```bash
npm run livekit                   # server LiveKit lokal (brew install livekit)
npm run mock                      # token siaran + halaman penonton
# .env → EXPO_PUBLIC_API_URL=http://<IP-laptop>:4000
npx eas-cli@latest build --profile development --platform android   # sekali, pasang APK-nya di HP
npx expo start                    # buka lewat aplikasi development build, bukan Expo Go
```

Tonton dari laptop di **http://localhost:4000/live**. Untuk mencoba **menonton** siaran warga lain
dari HP, buka **http://localhost:4000/live/uji** di laptop lalu mulai siaran (publik); kartunya
muncul di atas beranda. Integrasi produksi ke situs: [docs/LIVE.md](docs/LIVE.md).

> **Penting:** situs saat ini menerima laporan lewat Server Action + Cloudflare Turnstile,
> bukan REST API. Aplikasi baru bisa mengirim ke produksi setelah endpoint
> `POST /api/mobile/laporan` dan alur captcha mobile dibuat. Kode dan alasannya ada di
> [docs/API.md](docs/API.md).

## Struktur

```
src/
  app/                    ← rute Expo Router (setiap berkas = satu layar)
    _layout.tsx           Stack navigator + tema
    (tabs)/_layout.tsx    tab Beranda · ➕ · Profil (bilah bawah kustom)
    (tabs)/index.tsx      beranda: umpan laporan selayar penuh
    (tabs)/profil.tsx     profil ala TikTok: Laporanku / Disukai, atau panel masuk
    peta.tsx              peta laporan (memuat react-native-maps hanya bila tersedia)
    komentar/[id].tsx     lembar komentar satu laporan (menulis butuh akun; tekan lama = laporkan/blokir)
    laporkan.tsx          lembar "Laporkan" komentar / laporan / siaran
    ketentuan.tsx         Ketentuan Penggunaan (teks di constants/hukum.ts)
    privasi.tsx           Kebijakan Privasi
    masuk.tsx             lembar "masuk dulu" (saat tamu menyukai/berkomentar)
    pengaturan.tsx        pengaturan dan privasi, hukum, hubungi kami, keluar, hapus akun
    profil-ubah.tsx       edit nama profil
    lapor.tsx             formulir laporan (judul, cerita, lokasi, kirim)
    kamera.tsx            kamera live (foto/video/unggah) + HUD GPS
    terkirim.tsx          layar sukses
    live.tsx              siaran langsung (memuat LiveKit hanya di development build)
    tonton/[ruang].tsx    menonton siaran publik warga lain
  components/             tombol, isian, kartu lokasi, grid lampiran, titik live, bilah bawah
    umpan/                kartu umpan + media (foto / video expo-video), gestur cubit & ketuk ganda
    akun/panel-masuk.tsx  pilihan masuk: Apple (iOS), Google, atau "masuk uji" di dev server
    captcha-laporan.tsx   verifikasi Turnstile di WebView untuk laporan tanpa akun
    peta-laporan.tsx      peta + penanda laporan
    live/siaran-live.tsx  layar siaran LiveKit
    live/tonton-live.tsx  layar menonton siaran (penonton warga)
    live/pratinjau-live.tsx  pratinjau bisu siaran di kartu beranda
    umpan/kartu-live.tsx  kartu LIVE di umpan beranda
  lib/
    api.ts                kirim multipart via XHR (progres) + mode demo
    umpan.ts              umpan & komentar dari situs (hanya-baca)
    akun.ts               sesi akun: login Google/Apple, profil, Laporanku, suka & komentar, hapus akun
    laporkan.ts           kirim laporan konten (Laporkan)
    blokir.ts             penulis komentar yang diblokir di HP ini
    menu-aksi.ts          menu tekan lama (ActionSheet iOS / dialog Android)
    penyimpanan-aman.ts   token sesi di expo-secure-store
    versi.ts              teks versi + EAS Update yang sedang berjalan
    draf-laporan.ts       state draf yang dipakai bersama form & kamera
    galeri.ts             pilih foto/video dari galeri ke draf
    lokasi-live.ts        satu langganan GPS untuk seluruh aplikasi
    batas-laporan.ts      batas & validasi, disalin dari repo situs
    live.ts               minta token siaran ke server
    live-tersedia.ts      deteksi Expo Go vs development build
    peta-tersedia.ts      deteksi apakah Google Maps siap (Android)
index.js                  entri: registerGlobals() LiveKit sebelum expo-router
mock-server/
  server.mjs              server uji: laporan, token siaran, halaman penonton
  siaran.mjs              pembuat ruang & token LiveKit
  penonton.html           panel petugas untuk menonton siaran
  pelapor-uji.html        siaran uji dari peramban, sebagai "warga lain" (/live/uji)
docs/API.md               kontrak API laporan + kode endpoint untuk repo situs
docs/LIVE.md              arsitektur siaran + kode endpoint untuk repo situs
docs/UMPAN.md             sumber beranda, video, kunci peta
docs/AKUN.md              login Google/Apple, kontrak akun/suka/komentar/laporkan, menyiapkan Google Cloud
docs/RILIS.md             rilis App Store & Google Play: kunci, isian toko, build & submit
docs/KETENTUAN.md         Ketentuan Penggunaan untuk dipasang di situs
docs/KEBIJAKAN-PRIVASI.md Kebijakan Privasi untuk dipasang di situs
```

## Catatan untuk developer web

| Di web | Di sini |
|--------|---------|
| `<input type="file" capture>` | `expo-camera` (`CameraView`) dan `expo-image-picker` |
| `navigator.geolocation.watchPosition` | `Location.watchPositionAsync` di `lib/lokasi-live.ts` |
| `fetch` + `FormData` dengan `File` | `FormData.append('berkas', { uri, name, type })`. Berkas dirujuk lewat URI, bukan Blob |
| `fetch` tidak punya progres unggah | `XMLHttpRequest` + `xhr.upload.onprogress` |
| CSS / Tailwind | `StyleSheet.create`, flexbox kolom secara bawaan |
| React Router / App Router | Expo Router: berkas di `src/app/` = rute, `router.push('/kamera')` |
| Zustand / context | `useSyncExternalStore` sederhana di `lib/*.ts` |
| `getUserMedia` + WebRTC | `@livekit/react-native` (`LiveKitRoom`, `VideoTrack`) |
| `npm i paket` | `npx expo install paket`; paket native → development build |

Perintah pengecekan: `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`.

## Build dan update

Rilis ke App Store & Google Play — persiapan akun, kunci, isian toko, dan perintah build/submit — ada
di **[docs/RILIS.md](docs/RILIS.md)**.

Ada tiga profil di `eas.json`. Semuanya APK Android untuk distribusi internal, kecuali production.

| Profil | Aplikasi di HP | Kode JS dari | Untuk |
|--------|----------------|--------------|-------|
| `development` | **Lapor Karhutla** | Metro di laptop (`npx expo start`) | Mengembangkan; perubahan cukup **Reload** |
| `preview` | **Lapor Karhutla (Uji)**, paket `….lapor.preview` | Tertanam + **EAS Update** | Dicoba orang lain tanpa laptop |
| `production` | Lapor Karhutla | Tertanam + EAS Update | Rilis toko aplikasi |

`preview` punya paket sendiri (`app.config.js`) sehingga bisa terpasang **berdampingan**
dengan development build, tidak saling menimpa.

```bash
npx eas-cli@latest build --profile development --platform android   # hanya bila modul native berubah
npx eas-cli@latest build --profile preview --platform android       # sekali, lalu pakai update
```

### Update tanpa install ulang (EAS Update)

Perubahan kode JS, tampilan, dan gambar dikirim langsung ke HP. Aplikasi mengunduhnya di
belakang layar dan memakainya **saat dibuka berikutnya**.

```bash
npx eas-cli@latest update --channel preview --environment preview --clear-cache --message "perbaiki scroll"
```

- `--clear-cache` **wajib**: tanpa itu Metro bisa memakai cache lama dari dev server, dan
  `EXPO_PUBLIC_API_URL` milik `.env` (IP laptop) ikut terkirim, bukan milik `.env.production`.
- `runtimeVersion` memakai **fingerprint** (sidik jari bagian native). Update hanya diterima build
  yang modul native-nya sama, jadi tidak ada crash seperti "Cannot find native module".
  Setelah menambah modul native (`npx expo install` paket native), **buat build baru** dulu.
  Nama/paket varian tidak dihitung (`fingerprint.config.js`).
- Bundling rilis memakai `.env.production`, bukan `.env`. Isinya kosong (mode demo), karena build
  rilis Android menolak `http://`. Isi dengan alamat `https` setelah endpoint situs siap, lalu
  kirim lewat update; tidak perlu build ulang.

Teks izin kamera/mikrofon/lokasi/galeri, ikon, dan splash sudah diatur di `app.json`.
