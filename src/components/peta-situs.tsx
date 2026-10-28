import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { ruangBilahBawah } from '@/components/bilah-bawah';
import { Tombol } from '@/components/tombol';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { bukaLaporan } from '@/lib/aksi-laporan';
import { sampulDari, SITUS_URL, tanggalSingkat, tempatPendek, urlGambar, useUmpan, type Berita } from '@/lib/umpan';

/**
 * Peta sematan situs (app/[locale]/embed di repo situs): peta yang sama persis dengan situs —
 * citra satelit, sebaran asap Copernicus, hotspot NASA FIRMS, angin, dan angka laporan per
 * provinsi. Kendali, legenda, dan linimasanya milik halaman itu.
 */
const URL_PETA = `${SITUS_URL}/id/embed`;

/** Tinggi kartu laporan terpilih (sampul 64 + padding 8 × 2 + garis 1 × 2) dan jaraknya ke kendali situs. */
const TINGGI_KARTU = 82;

/** Navigasi yang boleh terjadi di dalam WebView; tautan lain (Copernicus, NASA FIRMS, …) dibuka di peramban. */
function bolehDiWebView(url: string): boolean {
  return url.startsWith(SITUS_URL) || /^https:\/\/([a-z0-9-]+\.)*windy\.com\//.test(url) || /^(about|blob|data):/.test(url);
}

/** Tema aplikasi untuk next-themes situs (kunci localStorage "theme", kelas pada <html>). */
function skripTema(tema: 'dark' | 'light'): string {
  return `(function () {
  try { localStorage.setItem('theme', '${tema}'); } catch (e) {}
  var h = document.documentElement;
  if (h.classList) { h.classList.remove('light', 'dark'); h.classList.add('${tema}'); }
  h.style.colorScheme = '${tema}';
})();
true;`;
}

/**
 * --sela-bawah: ruang yang ditutupi laci di web ponsel. Situs sudah mengangkat linimasa,
 * legenda, dan tombolnya di atas ruang ini, dan kamera Nusantara ikut memperhitungkannya —
 * di sini dipakai untuk bilah bawah melayang (dan kartu laporan terpilih).
 */
function skripSela(sela: number): string {
  return `document.documentElement.style.setProperty('--sela-bawah', '${sela}px');\ntrue;`;
}

/** ID Google Analytics situs (app/[locale]/layout.tsx di repo situs). */
const GA_SITUS = 'G-TDJESR6SNL';

/**
 * Situs memuat Google Analytics di semua halaman publik, termasuk sematan peta. Aplikasi tidak
 * memakai analitik (isian App Privacy & Data Safety, docs/RILIS.md), jadi GA dimatikan di WebView
 * lewat penanda opt-out resmi gtag.js: window['ga-disable-<ID>'] = true sebelum gtag.js mengirim
 * apa pun. Situs memuat gtag.js dengan lazyOnload (setelah halaman selesai dimuat), jadi skrip ini
 * — di awal halaman, diulang setelah dimuat — sudah jalan lebih dulu. ID lain yang mungkin dipasang
 * situs kelak ikut dimatikan begitu tag gtag.js-nya muncul.
 */
const SKRIP_TANPA_GA = `(function () {
  var matikan = function (id) { window['ga-disable-' + id] = true; };
  matikan('${GA_SITUS}');
  var periksa = function (el) {
    var m = el && el.src && /googletagmanager\\.com\\/gtag\\/js\\?(?:.*&)?id=([A-Z0-9-]+)/.exec(el.src);
    if (m) matikan(m[1]);
  };
  Array.prototype.forEach.call(document.getElementsByTagName('script'), periksa);
  if (window.MutationObserver && !window.__pengamatGa) {
    window.__pengamatGa = new MutationObserver(function (daftar) {
      daftar.forEach(function (d) { Array.prototype.forEach.call(d.addedNodes, periksa); });
    });
    window.__pengamatGa.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
true;`;

/**
 * Setelah halaman dimuat: sembunyikan tombol "Buka di Fire" (aplikasi ini sudah Fire), dan
 * tunggu peta MapLibre situs (window._maplibreMap) memasang lapisan provinsinya. Ketukan
 * provinsi di sematan memanggil window.open ke situs; di sini dicegat dan nama provinsinya
 * dikirim ke aplikasi supaya dibuka di Pencarian.
 */
const SKRIP_JEMBATAN = `${SKRIP_TANPA_GA}
(function () {
  if (window.__jembatanAplikasi) return;
  window.__jembatanAplikasi = true;
  var kirim = function (pesan) { window.ReactNativeWebView.postMessage(JSON.stringify(pesan)); };
  var gaya = document.createElement('style');
  gaya.textContent = 'button[aria-label="Buka di Fire"] { display: none !important; }';
  document.head.appendChild(gaya);
  var dibuka = false;
  window.open = function () { dibuka = true; return null; };
  var coba = 0;
  (function tunggu() {
    var peta = window._maplibreMap;
    if (!peta || !peta.getLayer || !peta.getLayer('batas-provinsi-fill')) {
      if (++coba < 480) setTimeout(tunggu, 250);
      return;
    }
    peta.on('click', 'batas-provinsi-fill', function (e) {
      var f = e.features && e.features[0];
      var nama = f && f.properties && f.properties.nama;
      // Pendengar situs (window.open) bisa jalan sebelum atau sesudah pendengar ini.
      setTimeout(function () {
        if (dibuka && nama) kirim({ jenis: 'provinsi', nama: nama });
        dibuka = false;
      }, 0);
    });
    kirim({ jenis: 'siap' });
  })();
})();
true;`;

/** Penanda sinyal di titik laporan yang dibuka dari "Lihat di peta", atau dihapus bila `titik` null. */
function skripSorot(titik: { lat: number; lng: number } | null, sela: number): string {
  const data = titik
    ? { type: 'Feature', geometry: { type: 'Point', coordinates: [titik.lng, titik.lat] }, properties: {} }
    : { type: 'FeatureCollection', features: [] };
  return `(function () {
  var peta = window._maplibreMap;
  if (!peta) return;
  var data = ${JSON.stringify(data)};
  var sumber = peta.getSource('laporan-aplikasi');
  if (sumber) sumber.setData(data);
  else {
    peta.addSource('laporan-aplikasi', { type: 'geojson', data: data });
    peta.addLayer({ id: 'laporan-aplikasi-cincin', type: 'circle', source: 'laporan-aplikasi',
      paint: { 'circle-radius': 18, 'circle-color': 'rgba(255, 74, 28, 0.3)' } });
    peta.addLayer({ id: 'laporan-aplikasi', type: 'circle', source: 'laporan-aplikasi',
      paint: { 'circle-radius': 8, 'circle-color': '#FF4A1C', 'circle-stroke-width': 3, 'circle-stroke-color': '#EDE8DF' } });
  }
  ${titik ? `peta.flyTo({ center: [${titik.lng}, ${titik.lat}], zoom: 7, padding: { top: 0, right: 0, bottom: ${sela}, left: 0 } });` : ''}
})();
true;`;
}

/**
 * Tab Peta: peta situs di WebView, dari tepi atas (di bawah status bar) sampai ke belakang bilah
 * bawah yang melayang. Laporan terpilih disimpan di parameter `id` — tombol peta di kartu &
 * detail membuka /peta?id=… — lalu ditandai di peta dan ditampilkan di kartu di atas bilah bawah.
 * Dimuat malas oleh (tabs)/peta.tsx, hanya bila modul native WebView ada.
 */
export default function PetaSitus() {
  const w = useTheme();
  const tema = useColorScheme() === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  const { berita } = useUmpan();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const web = useRef<WebView>(null);
  /** Peta MapLibre di dalam halaman sudah siap menerima skrip. */
  const [siap, setSiap] = useState(false);
  const [galat, setGalat] = useState(false);
  const [muatUlang, setMuatUlang] = useState(0);
  /** Titik yang sudah ditandai di peta ("lat,lng"), atau null. */
  const disorot = useRef<string | null>(null);

  const pilih = berita.find((b) => String(b.id) === id) ?? null;
  const bawahKartu = ruangBilahBawah(insets.bottom) - 6;
  // Situs menambah 1rem sendiri di atas --sela-bawah; bilah bawah sendiri sudah berjarak 16.
  const sela = pilih ? bawahKartu + TINGGI_KARTU : ruangBilahBawah(insets.bottom) - 16;
  const lat = pilih?.lat;
  const lng = pilih?.lng;

  useEffect(() => {
    if (siap) web.current?.injectJavaScript(skripTema(tema));
  }, [siap, tema]);

  useEffect(() => {
    if (siap) web.current?.injectJavaScript(skripSela(sela));
  }, [siap, sela]);

  useEffect(() => {
    const kunci = lat !== undefined && lng !== undefined ? `${lat},${lng}` : null;
    // Hanya titik lain yang menggerakkan kamera; sela yang berubah, atau umpan yang dimuat ulang, tidak.
    if (!siap || kunci === disorot.current) return;
    disorot.current = kunci;
    web.current?.injectJavaScript(skripSorot(lat !== undefined && lng !== undefined ? { lat, lng } : null, sela));
  }, [siap, lat, lng, sela]);

  function terimaPesan(e: WebViewMessageEvent) {
    let pesan: { jenis?: string; nama?: string } = {};
    try {
      pesan = JSON.parse(e.nativeEvent.data);
    } catch {}
    if (pesan.jenis === 'siap') setSiap(true);
    else if (pesan.jenis === 'provinsi' && pesan.nama) router.push({ pathname: '/cari', params: { q: pesan.nama } });
  }

  function cobaLagi() {
    setGalat(false);
    setSiap(false);
    disorot.current = null;
    setMuatUlang((n) => n + 1);
  }

  return (
    <View style={[styles.layar, { backgroundColor: w.background, paddingTop: insets.top }]}>
      {galat ? (
        <View style={styles.galat}>
          <Feather name="wifi-off" size={26} color={w.text} />
          <Text style={[styles.judulGalat, { color: w.text }]}>Peta gagal dimuat</Text>
          <Text style={[styles.teksGalat, { color: w.textSecondary }]}>Periksa koneksi internet, lalu coba lagi.</Text>
          <Tombol judul="Coba lagi" ragam="sekunder" ikon="refresh" onPress={cobaLagi} />
        </View>
      ) : (
        <WebView
          key={muatUlang}
          ref={web}
          source={{ uri: URL_PETA }}
          style={[styles.web, { backgroundColor: w.background }]}
          injectedJavaScriptBeforeContentLoaded={`${SKRIP_TANPA_GA}\n${skripTema(tema)}\n${skripSela(sela)}`}
          injectedJavaScript={SKRIP_JEMBATAN}
          onMessage={terimaPesan}
          onShouldStartLoadWithRequest={(r) => {
            // iOS: bingkai Windy di dalam halaman ikut lewat sini.
            if (r.isTopFrame === false || bolehDiWebView(r.url)) return true;
            void Linking.openURL(r.url);
            return false;
          }}
          onOpenWindow={(e) => {
            if (/^https?:\/\//.test(e.nativeEvent.targetUrl)) void Linking.openURL(e.nativeEvent.targetUrl);
          }}
          onError={() => setGalat(true)}
          onHttpError={(e) => {
            if (e.nativeEvent.url.startsWith(URL_PETA) && e.nativeEvent.statusCode >= 500) setGalat(true);
          }}
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFill, styles.tengah, { backgroundColor: w.background }]}>
              <ActivityIndicator color={w.accentText} />
            </View>
          )}
          bounces={false}
          overScrollMode="never"
          setBuiltInZoomControls={false}
          webviewDebuggingEnabled={__DEV__}
        />
      )}

      {pilih && !galat && (
        <KartuLaporan berita={pilih} style={{ bottom: bawahKartu }} onTutup={() => router.setParams({ id: undefined })} />
      )}
    </View>
  );
}

/** Laporan yang dibuka dari "Lihat di peta": sampul, judul, tempat · tanggal, dan tombol tutup. */
function KartuLaporan({ berita: b, style, onTutup }: { berita: Berita; style: { bottom: number }; onTutup: () => void }) {
  const w = useTheme();
  const sampul = sampulDari(b);
  const tempat = tempatPendek(b) || b.pulau;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[b.judul, tempat].filter(Boolean).join(', ')}
      onPress={() => bukaLaporan(b.id)}
      style={({ pressed }) => [styles.kartu, style, { backgroundColor: w.surface, borderColor: w.border }, pressed && styles.ditekan]}>
      <View style={[styles.sampul, { backgroundColor: w.surfaceMuted }]}>
        {sampul ? (
          <Image source={{ uri: urlGambar(sampul, 256) }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={sampul} />
        ) : (
          <Ionicons name="flame-outline" size={20} color={w.textSecondary} />
        )}
      </View>
      <View style={styles.fleks}>
        <Text style={[styles.judulKartu, { color: w.text }]} numberOfLines={2}>
          {b.judul}
        </Text>
        <Text style={[styles.ketKartu, { color: w.textSecondary }]} numberOfLines={1}>
          {[tempat, tanggalSingkat(b.tanggal)].filter(Boolean).join(' · ').toUpperCase()}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Tutup" hitSlop={10} onPress={onTutup} style={styles.tutup}>
        <Feather name="x" size={18} color={w.textSecondary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  web: {
    flex: 1,
  },
  fleks: {
    flex: 1,
    minWidth: 0,
  },
  tengah: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ditekan: {
    opacity: 0.7,
  },
  galat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 35,
  },
  judulGalat: {
    marginTop: 8,
    fontFamily: Fonts.judulTebal,
    fontSize: 22,
    lineHeight: 27,
    textAlign: 'center',
  },
  teksGalat: {
    marginBottom: 8,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  kartu: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: TINGGI_KARTU,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  sampul: {
    width: 92,
    height: 64,
    borderRadius: 13,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  judulKartu: {
    fontFamily: Fonts.judul,
    fontSize: 15,
    lineHeight: 18,
  },
  ketKartu: {
    marginTop: 4,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  tutup: {
    padding: 6,
  },
});
