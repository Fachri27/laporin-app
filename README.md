# Laporin — aplikasi mobile Lapor Karhutla

Aplikasi pelaporan kebakaran hutan dan lahan untuk [fire.nusantara.earth](https://fire.nusantara.earth/id),
bermerek **Laporin**. **Beranda** berisi sorotan dan baris poster laporan terverifikasi, tombol **Lapor**
di tengah bilah bawah membuka formulir dua langkah, dan **profil** dengan login Google/Apple (opsional).
Pelaporan memakai foto/rekam langsung dari kamera dengan **GPS live**, atau **siaran langsung** ke
petugas lewat LiveKit. Dibangun dengan Expo SDK 57 + Expo Router.

- Beranda, peta, dan fitur lapor (kamera, galeri, GPS, kirim) berjalan di **Expo Go**.
- **Siaran langsung** butuh **development build**, karena WebRTC adalah modul native yang tidak
  ada di Expo Go. Di Expo Go, layar siaran hanya menampilkan petunjuk.

## Desain

Tampilan mengikuti desain **"SAKSI — witness network for disaster photo & video"** (kanvas desain
Claude "Disaster Video App": Feed, Post detail, Live broadcast, Comments, Report, sampul). Merek contoh
"SAKSI" diganti **LAPORIN.**, jenis kejadiannya tetap karhutla. Tiga warna: **tinta** `#0C0E0D`
(latar), **tulang** `#EDE8DF` (teks, tombol terang, bilah bawah), **sinyal** `#FF4A1C` (aksen; teks di
atasnya tinta). Keterangan, garis, dan panel = tulang tembus pandang di atas tinta. **Mode gelap persis
desain**, **mode terang** padanannya dibalik (latar tulang, teks tinta, bilah tinta); tema mengikuti
mode HP. Huruf **Poppins** untuk semuanya, sama dengan situs (desain aslinya memakai Big Shoulders
Display, Inter Tight, dan JetBrains Mono): judul huruf biasa, label kecil & tombol utama kapital. Ikon
Feather/Ionicons. Token ada di `src/constants/theme.ts`:
`Colors` (terang/gelap), `Media` (kamera, siaran & story yang tetap gelap), `Fonts`, `Bayangan`.
Komponen dasar: `merek.tsx` (wordmark), `bilah-atas.tsx` (bilah atas + tombol ikon bulat bergaris),
`poster-laporan.tsx` (judul bagian, baris geser, kisi kartu, kartu laporan), `chip-filter.tsx`,
`avatar.tsx`, `tombol.tsx` (pil: `primer` sinyal · `terang` tulang/tinta · `sekunder` bergaris ·
`teks`), `isian.tsx`, `lembar-pilihan.tsx`.

Bilah bawah **melayang** (pil tulang di atas isi): **Beranda · Peta · LAPOR · Live · Profil**; Lapor =
pil sinyal berikon kamera. Layar tab memberi ruang di ujung gulungannya (`ruangBilahBawah`). Pencarian
dibuka dari ikon 🔍 dan Notifikasi dari ikon 🔔 di kepala beranda.

Teks dibuat seringkas mungkin dan tidak diulang; angka 0 tidak ditampilkan. Foto/video bukti tidak
ditimpa tombol atau teks (judul kartu ada di pita di bawah foto); pengecualian satu-satunya kartu
sorotan beranda, yang memang sampul bergaya poster.

Bagian desain yang datanya belum ada di situs **tidak** ditampilkan sebagai data palsu: nomor
laporan, pengikut, live terjadwal, unduhan, tingkat kedaruratan (pengguna memilih tidak memakainya),
dan estimasi waktu verifikasi tidak dibuat. Dua fitur dibuat **di HP saja** karena situs belum
menyimpannya: **Simpan/Tersimpan** (`lib/simpan.ts`) dan **Notifikasi** = kabar status laporanmu
sendiri (`lib/notifikasi.ts`).

## Beranda

- **Kepala**: merek bermono (ditambah jumlah siaran live bila ada; ketuk = tab Live), 🔍 dan 🔔. Lalu
  judul besar berisi jumlah laporan ("85 LAPORAN / DARI 5 PULAU", atau "… DI PAPUA" saat disaring).
- **Chip pulau** (SEMUA · KALIMANTAN · PAPUA …, urut jumlah laporan) menyaring judul, sorotan, dan kisi.
- **Kartu sorotan** (lebih tinggi dari desain supaya videonya jelas): laporan terbaru yang bergambar —
  provinsi, judul, kredit, suka, komentar, tombol putar → detail. Laporan bervideo memutar videonya sendiri tanpa suara (tombol
  🔇 menyalakan suara), berhenti saat kartunya tergulir lewat, Beranda ditinggalkan, atau aplikasi ke
  latar belakang.
- **TERBARU ● n LAPORAN** dan **LIHAT SEMUA →** (membuka Pencarian, untuk pulau itu bila sedang
  disaring), lalu **kisi berundak 2 kolom** (12 laporan berikutnya, tinggi foto berselang-seling seperti
  desain, tanpa geser ke samping): label media di pojok foto, judul, tempat · tanggal → detail. Siaran
  publik ada di tab **Live**.
- **Pencarian** (`app/cari.tsx`) dan **Notifikasi** (`app/notifikasi.tsx`): lihat di bawah.
- **Detail laporan** (`app/laporan/[id].tsx`), artboard Post detail: pemutar di atas bersudut bawah —
  video dengan kontrol Netflix (`umpan/kontrol-video.tsx`: ketuk = kontrol, mundur/maju 10 detik, ketuk
  bilah posisi untuk melompat, layar penuh bawaan HP), foto bisa dicubit, **ketuk ganda** = suka; tombol
  kembali, label provinsi · urutan media, dan segmen per media (ketuk = pindah) — lalu baris penulis
  (kredit, jumlah laporannya, **Simpan**), judul, cerita, lajur **LOKASI** (ketuk = peta) · **TANGGAL** ·
  **SUMBER**, Suka · Komentar · Bagikan · **Laporkan**, lalu **Laporan Serupa** (kisi 2 kolom). Tekan lama
  media → **Laporkan**.
- **Komentar** (lembar, artboard Comments): "KOMENTAR n", urutan Terbaru/Terlama, Balas · Laporkan, kolom
  tulis berbentuk pil. **Laporkan** (lembar, artboard Report): alasan bernomor, rincian, Kirim laporan.
- **Peta** (tab): peta yang sama dengan situs — sematan `/id/embed` di WebView: citra satelit, sebaran
  asap, hotspot, angin, dan angka laporan per provinsi (ketuk provinsi = Pencarian provinsi itu). "Lihat
  di peta" dari kartu/detail menandai titik laporannya dan menampilkan kartunya di atas bilah bawah.
- **Live** (tab, `app/(tabs)/siaran.tsx`): judul jumlah siaran, ajakan **Mulai live** ke petugas, dan kisi
  siaran publik. Layar siaran & tonton mengikuti artboard Live broadcast (lencana LIVE, durasi, penonton,
  komentar bernama mono, tombol samping); pita berjalan dan SOS di desain tidak dibuat karena belum ada
  datanya.
- **Lapor** (`app/lapor.tsx`): dua langkah — **jenis kejadian** (mengisi judul awal; server belum punya
  kolom jenis), lalu **detail**: judul, lokasi (GPS live / titik dari kamera / manual) dengan pratinjau
  peta, cerita, foto & video, anonim/nama → **Kirim Laporan**. Isian tersimpan sebagai draf; halaman
  sukses (`app/terkirim.tsx`) memuat garis waktu status.
- **Profil**: masuk dengan Google/Apple, angka Laporan · Terverifikasi · Disukai, tab **Laporan** (dengan
  status verifikasi) · **Disukai** · **Tersimpan** berupa kisi, edit profil, pengaturan & keluar.
  Lihat [docs/AKUN.md](docs/AKUN.md).
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
| **Server situs** | `EXPO_PUBLIC_API_URL=https://fire.nusantara.earth` | Produksi (EAS environment variables & `eas.json`), lihat [docs/API.md](docs/API.md) |

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
    (tabs)/_layout.tsx    tab Beranda · Peta · Live · Profil (bilah bawah melayang dengan tombol Lapor)
    (tabs)/index.tsx      beranda: kepala bermono, judul jumlah laporan, chip pulau, kartu sorotan, kisi 2 kolom
    (tabs)/peta.tsx       peta kejadian (memuat WebView hanya bila tersedia)
    (tabs)/siaran.tsx     tab Live: siaran publik + mulai siaran
    (tabs)/profil.tsx     profil: Laporan saya / Disukai / Tersimpan, atau panel masuk
    cari.tsx              Pencarian: riwayat, wilayah ramai, hasil + urutan
    notifikasi.tsx        kabar status laporan milik akun
    laporan/[id].tsx      detail gaya Netflix: pemutar, judul, Putar/Peta, aksi, Laporan Serupa
    komentar/[id].tsx     lembar komentar satu laporan (menulis butuh akun; tekan lama = laporkan/blokir)
    laporkan.tsx          lembar "Laporkan" komentar / laporan / siaran
    ketentuan.tsx         Ketentuan Penggunaan (teks di constants/hukum.ts)
    privasi.tsx           Kebijakan Privasi
    masuk.tsx             lembar "masuk dulu" (saat tamu menyukai/berkomentar)
    pengaturan.tsx        pengaturan dan privasi, hukum, hubungi kami, keluar, hapus akun
    profil-ubah.tsx       edit nama profil
    lapor.tsx             formulir dua langkah: jenis → detail (judul, lokasi, cerita, foto/video) → kirim
    kamera.tsx            kamera live (foto/video/unggah) + HUD GPS
    terkirim.tsx          halaman sukses + garis waktu status
    live.tsx              siaran langsung (memuat LiveKit hanya di development build)
    tonton/[ruang].tsx    menonton siaran publik warga lain
    story/[kunci].tsx     penampil story satu provinsi (lanjut ke provinsi berikutnya)
  components/             merek, bilah atas/bawah, avatar, tombol, isian, kartu lokasi, grid lampiran
    poster-laporan.tsx    judul bagian, baris geser, kisi berundak (beranda), kisi 2/3 kolom, kartu laporan
    chip-filter.tsx       chip saringan pil bermono bertitik (pulau di beranda)
    umpan/                media detail (foto / video expo-video) dengan cubit & ketuk ganda, kontrol video gaya Netflix
    story/video-story.tsx video satu item story (dimuat malas bila expo-video ada)
    akun/panel-masuk.tsx  pilihan masuk: Apple (iOS), Google, atau "masuk uji" di dev server
    captcha-laporan.tsx   verifikasi Turnstile di WebView untuk laporan tanpa akun
    peta-situs.tsx        peta sematan situs di WebView + kartu laporan terpilih
    live/siaran-live.tsx  layar siaran LiveKit
    live/tonton-live.tsx  layar menonton siaran (penonton warga)
    live/persiapan-live.tsx  persiapan & akhir siaran (tanpa impor LiveKit)
  lib/
    api.ts                kirim multipart via XHR (progres) + mode demo
    umpan.ts              umpan & komentar dari situs (hanya-baca)
    story.ts              story per provinsi dari umpan + tanda sudah dilihat
    aksi-laporan.ts       buka detail/komentar/peta, bagikan, menu ⋯ satu laporan
    jenis-kejadian.ts     jenis kejadian di langkah 1 formulir
    akun.ts               sesi akun: login Google/Apple, profil, Laporan saya, suka & komentar, hapus akun
    simpan.ts             laporan tersimpan (bookmark) — hanya di HP
    notifikasi.ts         kabar status laporan milik akun + tanda sudah dibaca (di HP)
    riwayat-cari.ts       pencarian terbaru — hanya di HP
    waktu.ts              "18 menit lalu"
    video.ts              batas penyangga pemutar video (mencegah kehabisan memori)
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
  `EXPO_PUBLIC_API_URL` milik `.env` (IP laptop) yang sudah tertanam di cache ikut terkirim.
- `runtimeVersion` memakai **fingerprint** (sidik jari bagian native). Update hanya diterima build
  yang modul native-nya sama, jadi tidak ada crash seperti "Cannot find native module".
  Setelah menambah modul native (`npx expo install` paket native), **buat build baru** dulu.
  Nama/paket varian tidak dihitung (`fingerprint.config.js`).
- Nilai `EXPO_PUBLIC_*` untuk build EAS dan update diambil dari **EAS environment variables**
  lingkungan `--environment` itu, bukan dari `.env` atau `.env.production`. Ubah lewat
  `npx eas-cli@latest env:set`, lalu kirim lewat update; tidak perlu build ulang (lihat
  [docs/RILIS.md](docs/RILIS.md)). `.env.production` hanya dipakai bundling rilis lokal (`npx expo export`).

Teks izin kamera/mikrofon/lokasi/galeri, ikon, dan splash sudah diatur di `app.json`.
