// Entri aplikasi.
//
// LiveKit mewajibkan registerGlobals() dipanggil sebelum livekit-client dimuat,
// tapi modul native-nya tidak ada di Expo Go — jadi hanya dipanggil di
// development build. Pakai require (bukan import) supaya urutan ini tidak
// diangkat ke atas oleh Babel.
const { siaranTersedia } = require('./src/lib/live-tersedia');

if (siaranTersedia) {
  require('@livekit/react-native').registerGlobals();
}

require('expo-router/entry');
