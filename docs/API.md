# Integrasi backend — `POST /api/mobile/laporan`

## Kenapa perlu endpoint baru

Form laporan di fire.nusantara.earth **tidak memakai REST API**. Ia mengirim lewat
Next.js Server Action (`kirimLaporan` di `app/[locale]/lapor/aksi.ts`) yang dijaga
Cloudflare Turnstile. Aplikasi mobile tidak bisa memanggil Server Action dengan aman:
ID aksinya berubah setiap deploy, dan Turnstile butuh widget yang berjalan di domain situs.

Untungnya inti penyimpanannya, `simpanLaporanPublik(data: FormData, ip)` di
`lib/laporan-publik.ts`, sudah menerima `FormData` mentah. Aplikasi ini mengirim
field yang **sama persis** dengan form web, jadi endpoint mobile cukup meneruskannya.

## Kontrak

```
POST {EXPO_PUBLIC_API_URL}/api/mobile/laporan
Content-Type: multipart/form-data
Accept: application/json
```

| Field       | Wajib | Isi                                                                 |
|-------------|-------|---------------------------------------------------------------------|
| `judul`     | ya    | ≤ 255 karakter                                                      |
| `deskripsi` | ya    | ≤ 5000 karakter                                                     |
| `berkas`    | ya    | 1–6 berkas, total ≤ 100 MB. JPG/PNG/WebP/MP4/MOV/WebM (field berulang) |
| `lat`,`lng` | tidak | Desimal, berpasangan. Dari GPS live, posisi saat foto, atau manual  |
| `nama`      | tidak | ≤ 100 karakter; tidak dikirim bila anonim                           |
| `anonim`    | tidak | `"1"` bila pelapor memilih anonim                                   |
| `tiket`     | *     | Tiket captcha sekali pakai — wajib bila tanpa akun atau anonim (lihat Captcha) |

Foto dari kamera aplikasi membawa **GPS di EXIF** (`GPSLatitude`/`GPSLongitude`/`GPSAltitude`),
jadi `exifDariBerkas()` di server tetap punya cadangan lokasi, dan petugas melihatnya di CMS.
Video iPhone direkam H.264 (`avc1`) dalam `.mov` supaya bisa diputar di Chrome/Android.

**Jawaban** — sama dengan `HasilLapor`:

```jsonc
// 200
{ "ok": true }
// 4xx
{ "ok": false, "galat": "Ceritakan kejadiannya sedikit.", "bidang": "deskripsi" }
```

Aplikasi menampilkan `galat` apa adanya. Untuk 413 dan 429 tanpa JSON, aplikasi punya pesan sendiri.

## Implementasi di repo situs (fire-buminusantara)

> **Sudah dipasang** di branch `feat/api-mobile`: `app/api/mobile/laporan/route.ts`, plus akun
> (`Bearer`) yang menggantikan captcha dan mengisi `reporter_user_id`. Kode di bawah adalah bentuk
> awalnya, untuk referensi.

`app/api/mobile/laporan/route.ts`:

```ts
import { revalidatePath } from "next/cache";
import { simpanLaporanPublik } from "@/lib/laporan-publik";
import { ipDari } from "@/lib/turnstile";
import { lewatBatas } from "@/lib/batas-laju";

/**
 * Laporan warga dari aplikasi mobile. Sama dengan kirimLaporan (server action),
 * tapi sebagai route handler supaya bisa dipanggil di luar peramban.
 */
export async function POST(req: Request) {
  const ip = ipDari(req);
  // Ember laju yang SAMA dengan form web: 5 laporan / 10 menit / IP.
  if (ip && (await lewatBatas(`lapor:${ip}`, 5, 600))) {
    return Response.json(
      { ok: false, galat: "Terlalu banyak laporan dari jaringan ini. Coba lagi dalam 10 menit." },
      { status: 429 },
    );
  }

  let data: FormData;
  try {
    data = await req.formData();
  } catch {
    return Response.json({ ok: false, galat: "Kiriman tidak bisa dibaca server." }, { status: 400 });
  }

  const hasil = await simpanLaporanPublik(data, ip);
  if (hasil.ok) {
    revalidatePath("/[locale]", "page");
    revalidatePath("/[locale]/lapor", "page");
    revalidatePath("/[locale]/karhutla", "page");
  }
  return Response.json(hasil, { status: hasil.ok ? 200 : 422 });
}
```

Hal yang sudah dicek di repo situs:

- `proxy.ts` mengecualikan `/api` dari matcher, jadi `proxyClientMaxBodySize` tidak berlaku
  di sini (lagipula sudah `101mb`). Route handler tidak punya batas body bawaan.
- **Jangan pakai `POLA_BOT`** dari `app/api/laporan/[id]/suka/route.ts` di endpoint ini: daftar itu
  memuat `okhttp`, dan React Native di Android mengirim user agent `okhttp/4.x`. Semua
  laporan dari Android akan tertolak.
- Kalau ada reverse proxy (nginx dsb.) di depan server, `client_max_body_size` untuk
  `/api/mobile/` harus ≥ 101 MB.

## Captcha

`simpanLaporanPublik` menolak kiriman tanpa `tiket` atau `captcha` yang sah:

- **Pengembangan** (`next dev` tanpa `TURNSTILE_SECRET_KEY`): `turnstileSah()` meloloskan
  semua, jadi aplikasi bisa langsung diuji ke situs lokal setelah route di atas dipasang.
- **Produksi**: semua kiriman dari aplikasi akan dijawab
  `"Verifikasi captcha gagal. Coba lagi."` sampai alur tiket mobile ada.

Alur produksi — **sudah dibuat** (`components/captcha-laporan.tsx` di aplikasi;
`/api/mobile/captcha` + `/api/mobile/tiket` di situs). Kiriman dengan akun (tidak anonim) tidak perlu
captcha: server membuat tiketnya sendiri. Rancangan awalnya:

1. Situs menyediakan halaman kecil, mis. `/id/captcha-mobile`, yang merender widget Turnstile
   dan mengirim tokennya lewat `window.ReactNativeWebView.postMessage(token)`. Karena dimuat
   dari domain situs sendiri, validasi hostname Turnstile tetap lolos.
2. Aplikasi membuka halaman itu di `react-native-webview` (tersedia di Expo Go) sesaat
   sebelum mengirim, lalu menukar token di `POST /api/mobile/tiket`:

   ```ts
   // app/api/mobile/tiket/route.ts
   import { ipDari, turnstileSah } from "@/lib/turnstile";
   import { buatTiket } from "@/lib/tiket-lapor";

   export async function POST(req: Request) {
     const { token } = await req.json().catch(() => ({}));
     const sah = await turnstileSah(typeof token === "string" ? token : null, ipDari(req));
     return sah
       ? Response.json({ tiket: buatTiket() })
       : Response.json({ galat: "Verifikasi captcha gagal." }, { status: 403 });
   }
   ```
3. Tiket (berlaku 30 menit, sekali pakai) ikut di field `tiket`, sama seperti form web
   sekarang, sehingga unggahan lambat di sinyal lemah tidak kedaluwarsa di tengah jalan.
