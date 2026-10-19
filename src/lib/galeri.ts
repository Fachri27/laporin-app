import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { BATAS_BERKAS } from '@/lib/batas-laporan';
import {
  ambilDraf,
  ekstensi,
  idBaru,
  mimeDari,
  mimeDariIsi,
  tambahLampiran,
  ukuranBerkas,
  type Lampiran,
} from '@/lib/draf-laporan';

/**
 * Pilih foto/video dari galeri lalu tambahkan ke draf. Dipakai formulir dan
 * tombol "Unggah" di kamera.
 *
 * `ditambah` = jumlah berkas yang masuk (0 bila warga batal); `galat` = penjelasan
 * berkas yang dilewati (format/jumlah/ukuran), `null` bila semua masuk.
 */
export async function pilihDariGaleri(): Promise<{ ditambah: number; galat: string | null }> {
  const sisa = BATAS_BERKAS - ambilDraf().lampiran.length;
  if (sisa <= 0) return { ditambah: 0, galat: `Maksimal ${BATAS_BERKAS} berkas per laporan.` };

  const hasil = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: sisa,
    // iOS: kualitas penuh = data asli disalin apa adanya, EXIF (GPS & waktu pengambilan) utuh;
    // di bawah 1 fotonya dikode ulang lewat UIImage dan EXIF-nya hilang. Android: kode ulang
    // tetap menyalin EXIF dan sekaligus mengubah HEIC ke JPEG (kualitas 1 menyalin HEIC mentah).
    quality: Platform.OS === 'ios' ? 1 : 0.8,
    exif: true,
    // HEIC iPhone diubah ke JPEG: server hanya menerima JPG/PNG/WebP.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (hasil.canceled) return { ditambah: 0, galat: null };
  return tambahLampiran(hasil.assets.map(keLampiran));
}

/**
 * Android bisa mematikan aplikasi selama galeri terbuka; pilihan warga lalu diserahkan
 * saat aplikasi dibuka lagi. Panggil sekali saat aplikasi mulai.
 */
export async function pulihkanPilihanGaleri(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const hasil = await ImagePicker.getPendingResultAsync().catch(() => null);
  if (!hasil || !('assets' in hasil) || hasil.canceled || !hasil.assets?.length) return;
  tambahLampiran(hasil.assets.map(keLampiran));
}

function keLampiran(a: ImagePicker.ImagePickerAsset, i: number): Lampiran {
  const video = a.type === 'video';
  const cadangan = video ? 'video/mp4' : 'image/jpeg';
  // Jenis dibaca dari isi berkas, seperti server: Android selalu menamai salinan video ".mp4"
  // walau aslinya AVI, dan menyimpan JPEG hasil kode ulang di berkas ".gif".
  const mime = mimeDariIsi(a.uri) ?? mimeDari(a.uri, a.mimeType?.replace('image/jpg', 'image/jpeg') ?? cadangan);
  return {
    id: idBaru(),
    uri: a.uri,
    jenis: video ? 'video' : 'foto',
    mime,
    nama: a.fileName ?? `galeri-${Date.now()}-${i}.${ekstensi(a.uri) || (video ? 'mp4' : 'jpg')}`,
    // Ukuran berkas yang benar-benar diunggah; untuk foto yang dikode ulang Android
    // melaporkan ukuran sumbernya (mis. HEIC asli).
    ukuran: ukuranBerkas(a.uri) || a.fileSize || 0,
    durasi: a.duration ? a.duration / 1000 : null,
    asal: 'galeri',
    // Lokasi foto lebih tepat daripada posisi warga saat melapor (bisa sudah jauh dari api).
    titik: video ? null : gpsDariExif(a.exif),
  };
}

/** GPS di EXIF foto, atau null. iOS memberi nilai mutlak + Ref (N/S, E/W); Android sudah bertanda. */
function gpsDariExif(exif: Record<string, unknown> | null | undefined): Lampiran['titik'] {
  if (!exif) return null;
  const lat = bertanda(exif.GPSLatitude, exif.GPSLatitudeRef, 'S');
  const lng = bertanda(exif.GPSLongitude, exif.GPSLongitudeRef, 'W');
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng, akurasi: null };
}

function bertanda(nilai: unknown, ref: unknown, negatif: 'S' | 'W'): number | null {
  if (typeof nilai !== 'number' || !Number.isFinite(nilai)) return null;
  if (typeof ref !== 'string' || ref.trim() === '') return nilai;
  return ref.trim().toUpperCase().startsWith(negatif) ? -Math.abs(nilai) : Math.abs(nilai);
}
