# Beranda (umpan laporan) dan peta

Beranda aplikasi menampilkan laporan karhutla selayar penuh, digeser ke atas/bawah seperti
aplikasi video pendek. Isinya **sama dengan daftar di beranda fire.nusantara.earth**.

## Sumber data

| Data | Endpoint situs | Status untuk aplikasi |
|------|----------------|-----------------------|
| Daftar laporan | `GET /api/umpan?bahasa=id` | ✅ Publik, dipakai langsung (`lib/umpan.ts`) |
| Daftar komentar | `GET /api/laporan/{id}/komentar` | ✅ Publik, dipakai langsung |
| Menyukai | `POST`/`DELETE /api/laporan/{id}/suka` | ❌ Ditolak dari aplikasi → pakai akun, [AKUN.md](AKUN.md) |
| Menulis komentar | `POST /api/laporan/{id}/komentar` | ❌ Butuh captcha Turnstile → pakai akun, [AKUN.md](AKUN.md) |

Umpan selalu dibaca dari situs (`EXPO_PUBLIC_SITUS_URL`, bawaan `https://fire.nusantara.earth`),
**terpisah** dari `EXPO_PUBLIC_API_URL` yang menjadi tujuan *kirim* laporan. Jadi saat menguji
kiriman ke mock server, beranda tetap menampilkan laporan sungguhan. Umpan hanya-baca dan
di-cache CDN situs 5 menit, jadi aman dibaca dari produksi.

Bentuk datanya (`Berita`, `ItemMedia`, `Komentar`) disalin dari `lib/events.ts`, `lib/media.ts`,
dan `lib/komentar.ts` di repo situs. Kalau bentuknya berubah di sana, ubah juga di `lib/umpan.ts`.
Kartu yang bentuknya tidak dikenal dilewati, sehingga aplikasi tidak crash.

## Kenapa suka & komentar belum bisa dari aplikasi

- **Suka**: `dariSitusIni()` hanya menerima permintaan dengan `Sec-Fetch-Site: same-origin` atau
  `Origin` = host situs. Aplikasi tidak mengirim keduanya. Selain itu `POLA_BOT` memuat `okhttp`,
  yang merupakan user agent React Native di Android.
- **Komentar**: `turnstileSah(body.captcha)` butuh token Turnstile dari widget di domain situs.

Penggantinya adalah **akun warga** (login Google). Token sesi akun menggantikan same-origin + captcha
sebagai penangkal bot. Kontraknya ada di [AKUN.md](AKUN.md) dan sudah dipakai aplikasi. Dalam mode
demo (tanpa server), lembar komentar tetap menawarkan **Komentari di situs**.

## Usulan awal (sebelum ada akun, tidak dipakai lagi)

Endpoint ini dibuat **di repo situs, terpisah dari repo ini**. Setelah tersedia, aplikasi cukup
menyalakan tombolnya.

**Suka**, `POST`/`DELETE /api/mobile/laporan/{id}/suka`:

```
X-Perangkat: <UUID acak, dibuat sekali per pemasangan aplikasi>
→ 200 { "jumlah": 12 }      (idempoten, sama dengan endpoint web)
→ 429 { "message": "Terlalu cepat." }
```

Anti-bot pengganti pemeriksaan same-origin: pembatas laju per `X-Perangkat` dan per IP, plus
`BATAS_PER_IP` yang sudah ada. **Jangan** pakai `POLA_BOT` di sini.

**Komentar**, `POST /api/mobile/laporan/{id}/komentar`: body sama dengan web
(`nama`, `email`, `isi`, `anonim`, `balas_ke`, `website`), tetapi `captcha` diganti `tiket` dari
alur captcha mobile di [API.md](API.md#captcha). Jawabannya juga sama: `201 { komentar: [...] }`.

## Video

- Diputar dengan `expo-video`. Pemutar hanya dibuat untuk kartu yang sedang ditonton dan dua
  tetangganya, jadi paling banyak tiga pemutar hidup sekaligus. Geser berikutnya langsung jalan,
  tanpa memboroskan kuota.
- `useCaching: true`: video yang sudah ditonton tidak diunduh ulang.
- Media mendatar (`vertikal: false`, sebagian besar laporan) tampil utuh di atas latar buram,
  bukan dipotong. Media tegak memenuhi layar.

## Peta

`react-native-maps`: Apple Maps di iOS, Google Maps di Android.

- **Expo Go**: tanpa pengaturan. Di emulator Android uji coba, Google menolak kunci bawaan Expo Go
  (`Authorization failure`) sehingga ubin peta kosong. Di HP sungguhan seharusnya jalan.
- **Development/production build Android** butuh kunci sendiri. Tanpa kunci, Google Maps SDK
  crash, jadi `lib/peta-tersedia.ts` menampilkan petunjuk sebagai gantinya. Buat kunci Maps SDK
  for Android (dibatasi ke paket `earth.nusantara.fire.lapor` + SHA-1 sertifikat EAS), lalu
  tambahkan di `app.json`:

  ```json
  ["react-native-maps", { "androidGoogleMapsApiKey": "AIza…" }]
  ```

## Modul native baru

`expo-video` dan `react-native-maps` sudah ada di Expo Go. **Development build yang sudah
terpasang harus dibuat ulang** (`npx eas-cli@latest build --profile development`), karena
build lama tidak memuat modul native keduanya.

Supaya build lama tidak crash, keduanya dimuat malas setelah modul native-nya dicek
(`requireOptionalNativeModule('ExpoVideo')`, `TurboModuleRegistry.get('RNMapsAirModule')`).
Di build lama, video tampil sebagai sampul dengan keterangan "butuh versi aplikasi terbaru",
dan tab Peta menampilkan petunjuk build ulang.
