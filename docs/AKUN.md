# Akun warga (login Google, profil, suka & komentar)

Akun **opsional**. Melapor dan siaran tetap bisa tanpa akun, termasuk anonim. Akun menambah:

- **Laporan saya**: riwayat laporan dengan status *menunggu / tayang / ditolak*.
- Nama pelapor terisi otomatis.
- **Suka & komentar** di beranda. Akun menggantikan captcha Turnstile dan pemeriksaan same-origin
  yang membuat fitur ini tidak bisa dipakai dari aplikasi (lihat [UMPAN.md](UMPAN.md)).

**Laporan anonim tidak pernah terikat ke akun.** Aplikasi tidak mengirim token sesi bersama
laporan anonim, jadi server pun tidak tahu siapa pengirimnya. Ini penting untuk pelapor yang
melaporkan pembakaran oleh pihak berkuasa.

## Alur masuk

```
HP ──GoogleSignin.signIn()──▶ Google ──idToken (JWT)──▶ HP
HP ──POST /api/mobile/masuk/google { idToken }──▶ Server
Server: verifikasi idToken (tanda tangan Google, aud = Web client ID, email_verified)
        upsert users (google_id) → buat token sesi
HP ◀── { token, pengguna } ── Server        token disimpan di expo-secure-store
HP ──Authorization: Bearer <token>──▶ semua endpoint di bawah
```

## Kontrak

Semua JSON. Endpoint bertanda 🔒 butuh `Authorization: Bearer <token>`; tanpa token / token
dicabut → `401`, dan aplikasi otomatis keluar di HP itu.

| Metode & jalur | Isi | Jawaban |
|----------------|-----|---------|
| `POST /api/mobile/masuk/google` | `{ idToken }` | `{ token, pengguna }` |
| `POST /api/mobile/masuk/apple` | `{ identityToken, nama? }` (iOS; `nama` hanya ada saat izin pertama) | `{ token, pengguna }` |
| `POST /api/mobile/keluar` 🔒 | — | `{ ok: true }` (token dicabut) |
| `GET /api/mobile/saya` 🔒 | — | `{ pengguna, statistik: { laporan, tayang, disukai } }` |
| `PATCH /api/mobile/saya` 🔒 | `{ nama }` (≤ 100) | `{ pengguna }` |
| `DELETE /api/mobile/saya` 🔒 | — | `{ ok: true }` — hapus akun (wajib di toko). Sesi & suka dihapus, nama/email dihapus dari komentar, laporan tetap tanpa pemilik |
| `GET /api/mobile/saya/laporan` 🔒 | — | `{ laporan: LaporanSaya[] }`, terbaru dulu |
| `GET /api/mobile/saya/disukai` 🔒 | — | `{ disukai: number[] }` (id kejadian) |
| `POST`/`DELETE /api/mobile/laporan/{id}/suka` 🔒 | — | `{ disukai, jumlah }` (`jumlah` = total terbaru) |
| `POST /api/mobile/laporan/{id}/komentar` 🔒 | `{ isi, balas_ke? }` (≤ 2000) | `201 { komentar: Komentar }` |
| `POST /api/mobile/laporan` | multipart (lihat [API.md](API.md)) | Dengan 🔒 → masuk Laporan saya |
| `POST /api/mobile/laporkan` | `{ jenis: 'komentar'\|'laporan'\|'siaran', id, alasan, catatan? }` (🔒 opsional) | `{ ok: true }`; komentar disembunyikan setelah 3 pelapor |
| `POST /api/mobile/live/token` | lihat [LIVE.md](LIVE.md) | Dengan 🔒 → nama pelapor dari akun |

```ts
type Pengguna = { id: string; nama: string; email: string | null; foto: string | null };
type LaporanSaya = {
  id: string; judul: string;
  status: 'menunggu' | 'tayang' | 'ditolak';
  dibuat: string;            // ISO 8601
  sampul: string | null;     // URL gambar
  jumlahBerkas: number;
  beritaId: number | null;   // id kejadian di umpan setelah tayang
};
```

Galat: `4xx { galat: "pesan untuk warga" }`.

`Komentar` dari situs membawa `penulis`: HMAC 16 karakter dari akun/email/IP penulis. Aplikasi
memakainya untuk **Blokir** (disimpan di HP, `lib/blokir.ts`) tanpa menerima data pribadi orang lain.

**Implementasi:** repo situs, branch `feat/api-mobile` (`lib/akun-mobile.ts`, `app/api/mobile/*`,
tabel `mobile_sessions` & `content_reports`). Acuan uji lokal tanpa situs: `mock-server/akun.mjs`.

## Menyiapkan Google Cloud

Di [Google Cloud Console](https://console.cloud.google.com/apis/credentials), proyek yang sama
dengan situs, **OAuth consent screen** sudah diisi, lalu buat OAuth client ID berikut.

1. **Web application**: tanpa origin/redirect. Client ID-nya adalah `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   di aplikasi (agar Google memberi `idToken`) dan `aud` yang diperiksa server.
2. **Android**, satu per varian:

   | Varian | Package name | SHA-1 sertifikat (EAS) |
   |--------|--------------|------------------------|
   | development | `earth.nusantara.fire.lapor` | `48:1C:1C:D5:1B:D1:33:44:67:B3:83:9C:19:12:B7:C2:76:52:07:26` |
   | preview (Uji) | `earth.nusantara.fire.lapor.preview` | `3E:E8:27:69:5F:6D:87:EF:17:C8:FB:50:86:8A:BE:C2:88:65:48:1F` |

   SHA-1 di atas dibaca dari APK build EAS. Untuk rilis Play Store, tambahkan SHA-1 **App signing
   key** dari Play Console. Paket/SHA-1 yang tidak terdaftar menghasilkan galat
   `DEVELOPER_ERROR` (kode 10) saat masuk.
3. **iOS** (nanti, saat build iOS): bundle ID `earth.nusantara.fire.lapor`. Isi
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` dan `GOOGLE_IOS_URL_SCHEME` (`com.googleusercontent.apps.…`,
   dipakai `app.config.js` untuk plugin google-signin). Ini menambah plugin native, jadi runtime
   version (fingerprint) berubah untuk **semua** platform: buat build Android & iOS baru, dengan
   kedua variabel itu di EAS environment variables (lihat di bawah).
4. **OAuth consent screen** berstatus *In production*. Selama masih *Testing*, hanya akun penguji
   yang terdaftar di sana yang bisa masuk.

Lalu di aplikasi:

```bash
# .env — dev server di laptop
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com

# Build EAS & eas update — EAS environment variables (tidak membaca .env/.env.production)
npx eas-cli@latest env:set --environment production --environment preview \
  --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value 1234567890-xxxx.apps.googleusercontent.com --visibility plaintext
```

Nilai ini masuk ke kode JS, jadi bisa dikirim lewat `eas update` tanpa build ulang. Server memakai
nilai yang sama sebagai `GOOGLE_WEB_CLIENT_ID`. Mock server memeriksa `aud` bila dijalankan dengan
`GOOGLE_WEB_CLIENT_ID=… npm run mock`.

## Uji tanpa Google

Dari dev server (`__DEV__`) dengan mock server, tab Profil menampilkan **Masuk uji**: cukup isi
nama, tanpa Google. Endpoint `POST /api/mobile/masuk/uji` **hanya ada di mock server**.

Status laporan di Laporan saya bisa diuji dengan mengubah `"status"` di
`mock-server/unggahan/<waktu>/laporan.json` menjadi `"tayang"` atau `"ditolak"`.

## Di situs (fire-buminusantara) — sudah dipasang

Branch `feat/api-mobile`:

- **idToken Google** diverifikasi dengan `jose` terhadap kunci publik Google: tanda tangan, penerbit,
  `aud = GOOGLE_WEB_CLIENT_ID`, dan `email_verified`. **Apple**: kunci publik Apple dengan
  `aud = APPLE_BUNDLE_ID`, disimpan di kolom baru `users.apple_id`.
- **Pengguna**: tabel `users`, peran `commenter`. `bolehKelola()` CMS hanya meloloskan `admin`/`editor`,
  dan akun Google/Apple murni tidak punya kata sandi, jadi tidak bisa masuk CMS. Email yang sudah
  terdaftar (mis. akun CMS) ditautkan tanpa mengubah perannya, dan tidak bisa dihapus dari aplikasi.
- **Token sesi**: 32 byte acak sebagai Bearer; yang disimpan hanya sha256-nya di `mobile_sessions`.
  Keluar = baris dihapus.
- **Pemilik laporan**: `public_reports.reporter_user_id`, diisi hanya bila ada token **dan** tidak anonim.
  `public_reports.event_id` diisi saat petugas memverifikasi (untuk `beritaId` di Laporan saya).
- **Suka**: tabel `event_likes` yang sama, penanda `sha256("akun:<id>")`. **Komentar**: `simpanKomentar`
  (sensor kata kasar tetap berlaku) dengan `user_id`. Batas laju per akun & per IP.
- **Masuk uji** (`/api/mobile/masuk/uji`) hanya aktif bila `NODE_ENV !== production` **dan**
  `MOBILE_MASUK_UJI=1`.
