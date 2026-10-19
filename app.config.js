// Konfigurasi dinamis di atas app.json.
//
// 1. Varian build, dipilih lewat APP_VARIANT (lihat eas.json).
//    preview = APK uji yang menerima EAS Update. Ia punya nama & paket sendiri
//    supaya bisa terpasang BERDAMPINGAN dengan development build di HP yang sama.
//    Kalau paketnya sama, memasang preview akan menimpa development build.
//    development & production memakai app.json apa adanya.
//    Perbedaan nama/paket tidak dihitung ke runtime version (fingerprint.config.js),
//    jadi semua varian berbagi runtime dan menerima update yang sama.
//
// 2. Login Google (docs/AKUN.md). Tanpa Firebase, plugin google-signin hanya
//    mengatur URL scheme iOS — Android cukup autolinking. Plugin itu menolak
//    berjalan tanpa iosUrlScheme (dan tanpa opsi ia masuk mode Firebase yang
//    mewajibkan google-services.json), jadi baru dipasang setelah
//    GOOGLE_IOS_URL_SCHEME diisi (OAuth client iOS di Google Cloud).
//
// 3. Peta Android (react-native-maps → Google Maps) butuh kunci Maps SDK for
//    Android. Tanpa kunci, layar peta di Android hanya menampilkan petunjuk
//    (lib/peta-tersedia.ts). Simpan di EAS environment variables, bukan di repo.
//
// 4. Pengaman rilis. Tanpa EXPO_PUBLIC_API_URL aplikasi jalan dalam mode demo
//    (laporan warga hanya disimulasikan); alamat http:// (mis. IP laptop dari .env)
//    tidak terjangkau di luar Wi-Fi rumah dan ditolak Android rilis. Bundle seperti
//    itu tidak boleh sampai ke HP warga, jadi dihentikan di sini — di build toko
//    (EAS_BUILD_PROFILE) dan di SETIAP bundling rilis: `eas update` (menjalankan
//    `expo export`), `expo export`, dan export:embed build rilis menyetel
//    NODE_ENV=production sebelum membaca konfigurasi ini. `npx expo start` tidak.
//    Diperiksa di dalam fungsi, bukan saat berkas dimuat: CLI bisa memuat berkas ini
//    lebih dulu, sebelum NODE_ENV disetel, lalu memakai modul yang sama.
//    `eas update --environment …` tidak membaca .env* sama sekali (EXPO_NO_DOTENV):
//    nilainya dari EAS environment variables (docs/RILIS.md).
//    Build toko juga wajib punya email kontak (Pengaturan, Ketentuan, Privasi).
const SKEMA_IOS_GOOGLE = process.env.GOOGLE_IOS_URL_SCHEME;
const KUNCI_MAPS_ANDROID = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

function pastikanSiapRilis() {
  const profil = process.env.EAS_BUILD_PROFILE ?? '';
  // Build untuk toko, dan build simulator iOS yang membuktikan konfigurasi yang sama terkompilasi.
  const rilis = ['production', 'uji-ios-simulator'].includes(profil);
  // Bundling JS rilis. Development build EAS dikecualikan: kodenya dari Metro, tanpa env produksi.
  const bundelRilis = rilis || (process.env.NODE_ENV === 'production' && profil !== 'development');
  const situs = (process.env.EXPO_PUBLIC_SITUS_URL ?? '').trim();

  if (bundelRilis && !/^https:\/\//.test((process.env.EXPO_PUBLIC_API_URL ?? '').trim())) {
    throw new Error(
      'Bundle rilis butuh EXPO_PUBLIC_API_URL berawalan https:// (EAS environment variable; `eas update` selalu ' +
        'dengan --environment preview|production). Tanpa itu aplikasi berjalan dalam mode demo dan laporan warga tidak terkirim.',
    );
  }
  if (bundelRilis && situs && !situs.startsWith('https://')) {
    throw new Error(`Bundle rilis tidak boleh memakai EXPO_PUBLIC_SITUS_URL=${situs} (IP laptop dari .env?). Kosongkan atau isi https://.`);
  }
  if (rilis && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((process.env.EXPO_PUBLIC_KONTAK_EMAIL ?? '').trim())) {
    throw new Error(
      'Build toko butuh EXPO_PUBLIC_KONTAK_EMAIL (EAS environment variable production) — wajib di App Store & Google Play; ' +
        'tanpa itu Pengaturan tidak punya "Hubungi kami".',
    );
  }
}

module.exports = ({ config }) => {
  pastikanSiapRilis();
  // faceIDPermission: false — token disimpan tanpa biometrik, jadi tidak ada teks izin Face ID.
  const plugins = [...(config.plugins ?? []), ['expo-secure-store', { faceIDPermission: false }]];
  if (SKEMA_IOS_GOOGLE) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: SKEMA_IOS_GOOGLE }]);
  }
  if (KUNCI_MAPS_ANDROID) {
    plugins.push(['react-native-maps', { androidGoogleMapsApiKey: KUNCI_MAPS_ANDROID }]);
  }
  const hasil = { ...config, plugins };


  if (process.env.APP_VARIANT !== 'preview') return hasil;
  return {
    ...hasil,
    name: `${config.name} (Uji)`,
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.preview` },
    android: { ...config.android, package: `${config.android.package}.preview` },
  };
};
