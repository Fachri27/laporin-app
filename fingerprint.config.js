/**
 * Runtime version (policy "fingerprint" di app.json) = sidik jari bagian native.
 * Update EAS hanya diterima build yang sidik jarinya sama, jadi update tidak
 * pernah sampai ke build yang modul native-nya berbeda (penyebab crash seperti
 * "Cannot find native module 'ExpoVideo'").
 *
 * Nama & paket varian (app.config.js) bukan perbedaan kode native, jadi diabaikan.
 * @type {import('expo/fingerprint').Config}
 */
const config = {
  sourceSkips: ['ExpoConfigNames', 'ExpoConfigAndroidPackage', 'ExpoConfigIosBundleIdentifier'],
  // Continuous Native Generation: android/ & ios/ selalu dibuat ulang oleh prebuild. Di EAS
  // prebuild berjalan SEBELUM runtime version dihitung, dan deteksi "diabaikan git" di sana tidak
  // selalu berlaku — tanpa ini sidik jari EAS memuat folder native dan berbeda dari laptop.
  ignorePaths: ['android/**', 'ios/**'],
};

module.exports = config;
