# Siaran langsung (LiveKit)

## Arsitektur

```
HP pelapor ──(WebRTC: video+audio+atribut GPS)──▶ Server LiveKit ──▶ Peramban petugas (CMS)
     │                                                ▲
     └──POST /api/mobile/live/token──▶ Server situs ───┘ (hanya menandatangani token)
```

- **Video tidak pernah lewat server situs.** Situs hanya membuat ruang dan menandatangani
  token. API secret LiveKit tinggal di server, tidak pernah di aplikasi.
- **Satu ruang per siaran** (`siaran-<waktu>-<acak>`). Ruang dibuang otomatis 30 detik
  setelah pelapor keluar.
- **GPS live** dikirim aplikasi sebagai *participant attributes* (`lat`, `lng`, `akurasi`,
  `waktu`), paling sering tiap 5 detik. Penonton menerima event `ParticipantAttributesChanged`.
- **Video 540p** dari kamera belakang, dengan simulcast + dynacast supaya tetap jalan di 4G lemah.
- **Komentar, hati & hadiah ala siaran TikTok** lewat *text stream* LiveKit: petugas berkomentar,
  mengetuk video, dan mengirim hadiah apresiasi; pelapor melihatnya di layar dan bisa membalas.
  Lihat [Interaksi](#interaksi).

## Uji lokal (sudah jalan)

```bash
npm run livekit   # livekit-server --dev (key "devkey", secret "secret")
npm run mock      # token + halaman penonton di http://localhost:4000/live
```

`.env` aplikasi: `EXPO_PUBLIC_API_URL=http://<IP-laptop>:4000`. HP harus satu Wi-Fi
dengan laptop, karena HP menghubungi LiveKit langsung di `ws://<IP-laptop>:7880`.

Aplikasi harus berupa **development build**. Expo Go tidak memuat modul WebRTC:

```bash
npx eas-cli@latest build --profile development --platform android   # APK, tanpa Android Studio
# atau, kalau Android Studio / Xcode terpasang:
npx expo run:android
npx expo run:ios --device
```

Setelah terpasang, jalankan `npx expo start` seperti biasa. Development build membaca kode
dari dev server sama seperti Expo Go, jadi build ulang hanya perlu kalau ada modul native baru.

## Kontrak token

```
POST /api/mobile/live/token
Content-Type: application/json

{ "judul": "Api mendekati permukiman", "nama": "Budi", "anonim": false, "lat": -1.68, "lng": 113.38 }

200 → { "url": "wss://…", "token": "<JWT>", "ruang": "siaran-…" }
4xx → { "galat": "pesan untuk warga" }
```

Izin token pelapor: `roomJoin`, `canPublish`, `canPublishData`, `canUpdateOwnMetadata`
(untuk atribut GPS), dan `canSubscribe` (untuk menerima komentar & hati; petugas tidak
menerbitkan media, jadi pelapor tetap tidak menerima video/suara). Izin token petugas:
`roomJoin`, `canSubscribe`, `canPublishData` (komentar & hati), **tanpa** `canPublish`.
Implementasi acuan ada di `mock-server/siaran.mjs`.

## Interaksi

Lewat *text stream* LiveKit (`localParticipant.sendText` / `room.registerTextStreamHandler`).
Topiknya dipakai bersama aplikasi (`src/lib/live.ts`), `mock-server/penonton.html`, dan CMS:

| Topik | Isi | Tampilan |
|-------|-----|----------|
| `komentar` | Teks, maks. 200 karakter. Nama pengirim = nama peserta | Gelembung di kiri bawah video, 6 terakhir |
| `suka` | Jumlah ketukan sebagai teks (`"3"`). Ketukan beruntun digabung per 400 ms | Hati melayang dari titik ketukan / kanan bawah |
| `hadiah` | JSON `{"id":"damkar","jumlah":3}`. Ketukan beruntun pada hadiah yang sama digabung per 400 ms | Spanduk kiri dengan combo "x N" (maks. 2, hilang 3 dtk tanpa tambahan); hadiah besar juga melintas selayar penuh |

**Hadiah** bersifat simbolis: tanpa koin, tanpa uang, tanpa saldo. Daftarnya (`DAFTAR_HADIAH`
di `src/lib/live.ts`, disalin ke `penonton.html`) harus sama di semua klien; `id` yang tidak
dikenal diabaikan penerima.

| id | Hadiah | Besar |
|----|--------|-------|
| `tepuk` | 👏 Tepuk tangan | |
| `air` | 💧 Tetes air | |
| `terima-kasih` | 🙏 Terima kasih | |
| `pohon` | 🌳 Pohon | |
| `pemadam` | 🧯 Pemadam | |
| `medali` | 🏅 Medali | |
| `damkar` | 🚒 Mobil damkar | ✓ |
| `bom-air` | 🚁 Bom air | ✓ |

Komentar dan hadiah **tidak disimpan** di mana pun; hanya hidup selama siaran. Kalau perlu jadi bukti,
simpan lewat webhook/agent di server, bukan di klien.

## Ditonton warga (siaran publik)

Bawaannya siaran **hanya untuk petugas**. Di layar persiapan, pelapor bisa menyalakan
**"Tampilkan di beranda warga"**. Kalau dinyalakan, siarannya muncul sebagai kartu LIVE di atas umpan
beranda: pratinjau video bisu, avatar bercincin merah, lalu ketuk untuk menonton
(`app/tonton/[ruang].tsx`). Penonton warga bisa berkomentar, mengetuk hati, dan mengirim hadiah.

```
GET  /api/mobile/live            → [{ ruang, judul, nama, mulai, penonton, lat, lng }]   hanya siaran publik
POST /api/mobile/live/tonton     { "ruang": "siaran-…" }  (Bearer opsional → nama penonton)
     200 → { url, token }   403 → bukan siaran publik   404 → sudah berakhir
```

- Pilihan publik disimpan di metadata ruang (`publik: true`) saat token pelapor dibuat; token
  warga hanya diberikan untuk ruang itu.
- Token warga: identitas `warga-…`, `roomJoin`, `canSubscribe`, `canPublishData`, **tanpa**
  `canPublish`.
- `lat`/`lng` di daftar dibulatkan ke 2 desimal (~1 km).
- Di umpan, daftar live hanya diperbarui saat warga berada di kartu teratas, supaya laporan yang sedang
  ditonton tidak tergeser. Kartu yang siarannya sudah usai berubah menjadi "Siaran sudah berakhir".

**Sebelum produksi:** atribut peserta (`lat`, `lng`, `akurasi`) terlihat oleh **semua** peserta
ruang, termasuk penonton warga. Aplikasi memang hanya menampilkan perkiraannya, tapi klien yang
dimodifikasi tetap bisa membaca titik persisnya. Untuk siaran publik, kirim atribut yang sudah
dibulatkan, dan kirim titik persis hanya ke petugas, misalnya lewat text stream dengan
`destinationIdentities` berisi peserta `petugas-…`.

**Uji tanpa HP kedua:** buka **http://localhost:4000/live/uji** di laptop. Halaman itu siaran sebagai
"warga lain", dengan animasi api atau kamera laptop, dan mencatat komentar, hati, dan hadiah yang
masuk. Setelah itu buka beranda aplikasi di HP.

## Memasang di situs (fire-buminusantara)

> **Sudah dipasang** di branch `feat/api-mobile`: `lib/siaran.ts`, `app/api/mobile/live/{token,tonton}`,
> `GET /api/mobile/live`, serta `GET /api/admin/siaran` & `/api/admin/siaran/token` untuk CMS. Tanpa
> `LIVEKIT_*` semua rute siaran menjawab 503. Yang belum ada: **halaman CMS** untuk petugas menonton
> (langkah 5). Langkah di bawah dipertahankan sebagai referensi.

1. **Server LiveKit.**
   - Paling mudah: **LiveKit Cloud**. Daftar, lalu isi `LIVEKIT_URL=wss://<proyek>.livekit.cloud`,
     `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` di `.env` situs.
   - Self-host: `livekit-server` di VPS dengan domain + TLS (wss) dan port **7881/TCP serta
     50000–60000/UDP** terbuka. Tanpa UDP, video akan sering putus.
2. **`npm i livekit-server-sdk`** di repo situs.
3. **Token pelapor**, `app/api/mobile/live/token/route.ts`:

   ```ts
   import { randomBytes } from "node:crypto";
   import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
   import { ipDari } from "@/lib/turnstile";
   import { lewatBatas } from "@/lib/batas-laju";
   import { koordinat } from "@/lib/batas-laporan";

   const { LIVEKIT_URL = "", LIVEKIT_API_KEY = "", LIVEKIT_API_SECRET = "" } = process.env;
   const ruangan = new RoomServiceClient(LIVEKIT_URL.replace(/^ws/, "http"), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

   export async function POST(req: Request) {
     const ip = ipDari(req);
     // Siaran lebih mahal dari laporan: 3 siaran / 10 menit / IP.
     if (ip && (await lewatBatas(`live:${ip}`, 3, 600))) {
       return Response.json({ galat: "Terlalu banyak siaran dari jaringan ini. Coba lagi nanti." }, { status: 429 });
     }
     const isi = await req.json().catch(() => null);
     const judul = String(isi?.judul ?? "").trim();
     if (!judul || judul.length > 255) {
       return Response.json({ galat: "Tulis singkat apa yang sedang terjadi." }, { status: 422 });
     }
     const anonim = isi?.anonim === true;
     const nama = anonim ? "" : String(isi?.nama ?? "").trim().slice(0, 100);
     const titik = koordinat(String(isi?.lat ?? ""), String(isi?.lng ?? ""));
     const lokasi = titik && !("galat" in titik) ? titik : null;

     const ruang = `siaran-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
     await ruangan.createRoom({
       name: ruang, emptyTimeout: 120, departureTimeout: 30, maxParticipants: 25,
       metadata: JSON.stringify({ judul, nama: nama || null, anonim, mulai: Date.now(), ...lokasi }),
     });

     const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
       identity: `pelapor-${randomBytes(4).toString("hex")}`,
       name: nama || (anonim ? "Anonim" : "Warga"),
       attributes: lokasi ? { lat: String(lokasi.lat), lng: String(lokasi.lng) } : {},
       ttl: "2h",
     });
     at.addGrant({ room: ruang, roomJoin: true, canPublish: true, canSubscribe: true,
                   canPublishData: true, canUpdateOwnMetadata: true });

     return Response.json({ url: LIVEKIT_URL, token: await at.toJwt(), ruang });
   }
   ```

   Jangan pasang filter `POLA_BOT` di sini. React Native di Android memakai user agent
   `okhttp/…`. Kalau captcha mobile (`docs/API.md`) sudah ada, minta `tiket` yang sama di sini.

4. **Token petugas**, hanya untuk yang login CMS (`app/api/admin/siaran/token/route.ts`):

   ```ts
   import { AccessToken } from "livekit-server-sdk";
   import { pastikanBolehKelola } from "@/lib/sesi";

   export async function GET(req: Request) {
     const sesi = await pastikanBolehKelola();
     if (!sesi) return Response.json({ galat: "Masuk dulu." }, { status: 401 });
     const ruang = new URL(req.url).searchParams.get("ruang") ?? "";
     if (!/^siaran-[a-z0-9-]+$/.test(ruang)) return Response.json({ galat: "Ruang tidak dikenal." }, { status: 400 });

     const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
       identity: `petugas-${sesi.id}`, name: sesi.nama, ttl: "1h",
     });
     at.addGrant({ room: ruang, roomJoin: true, canSubscribe: true, canPublish: false, canPublishData: true });
     return Response.json({ url: process.env.LIVEKIT_URL, token: await at.toJwt() });
   }
   ```

5. **Halaman CMS `/admin/siaran`:** daftar ruang aktif lewat `ruangan.listRooms()` +
   `listParticipants()`, lalu pemutar memakai `livekit-client` (atau `@livekit/components-react`).
   Logikanya bisa disalin dari `mock-server/penonton.html`; di sana teks pelapor selalu dirender
   lewat `textContent`.

## Langkah berikutnya yang disarankan

- **Rekaman sebagai bukti:** LiveKit Egress bisa menyimpan siaran ke S3/MinIO, yang sudah dipakai
  situs untuk media. Rekaman bisa masuk antrean verifikasi seperti laporan biasa.
- **Notifikasi petugas:** webhook LiveKit `room_started` bisa memberi tahu tab CMS yang terbuka
  (mirip `umumkanTunggakan()`) supaya siaran tidak menunggu ditonton.
- **Suara dua arah:** beri petugas `canPublish` audio (pelapor sudah `canSubscribe`), supaya petugas
  bisa memberi arahan langsung ("geser ke kiri", "menjauh dari api").
