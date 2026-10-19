import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, TurboModuleRegistry, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tombol } from '@/components/tombol';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_URL } from '@/lib/api';

/**
 * Captcha untuk laporan tanpa akun (tamu atau anonim), diselesaikan di DALAM
 * aplikasi: halaman Turnstile kecil dari server (/api/mobile/captcha) dibuka di
 * WebView, tokennya ditukar dengan tiket sekali pakai di /api/mobile/tiket,
 * lalu tiket itu menumpang kiriman laporan. Laporan dari akun tidak butuh ini.
 */

// Development build lama dibuat sebelum react-native-webview dipasang; mengimpornya
// di sana langsung crash. Jadi WebView dimuat malas hanya bila modul native-nya ada.
const WebViewCaptcha = TurboModuleRegistry.get('RNCWebViewModule')
  ? lazy(() => import('react-native-webview').then((m) => ({ default: m.WebView })))
  : null;

/** Turnstile yang tidak kunjung memberi jawaban dalam waktu ini dianggap gagal dimuat. */
const BATAS_MUAT_MS = 20_000;
const BATAS_TUKAR_MS = 15_000;
const GAGAL_MUAT = 'Verifikasi tidak termuat. Periksa koneksi lalu coba lagi.';

/** Navigasi yang boleh terjadi di dalam WebView; tautan lain (mis. Privasi/Ketentuan Turnstile) dibuka di peramban. */
function bolehDiWebView(url: string): boolean {
  return (
    url.startsWith(API_URL) ||
    url.startsWith('https://challenges.cloudflare.com/') ||
    /^(about|blob|data):/.test(url)
  );
}

type Props = {
  terbuka: boolean;
  /** Tiket sah, atau null bila warga menutup lembarnya. */
  onSelesai: (tiket: string | null) => void;
};

export function CaptchaLaporan({ terbuka, onSelesai }: Props) {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const [galat, setGalat] = useState('');
  const [menukar, setMenukar] = useState(false);
  const [muatUlang, setMuatUlang] = useState(0);
  // Sudah ada jawaban dari halaman captcha (token/galat) sejak dibuka atau dimuat ulang.
  const adaJawaban = useRef(false);

  // Skrip Turnstile gagal dimuat (sinyal lemah, diblokir) = halaman diam selamanya.
  // Setelah batas waktu, tampilkan pesan + "Coba lagi" daripada menunggu tanpa akhir.
  useEffect(() => {
    if (!terbuka || !WebViewCaptcha) return;
    adaJawaban.current = false;
    const id = setTimeout(() => {
      if (!adaJawaban.current) setGalat((g) => g || GAGAL_MUAT);
    }, BATAS_MUAT_MS);
    return () => clearTimeout(id);
  }, [terbuka, muatUlang]);

  function tutup(tiket: string | null) {
    setGalat('');
    setMenukar(false);
    onSelesai(tiket);
  }

  async function terimaPesan(data: string) {
    let pesan: { token?: string; galat?: string } = {};
    try {
      pesan = JSON.parse(data);
    } catch {}
    if (pesan.galat) {
      adaJawaban.current = true;
      return setGalat(pesan.galat);
    }
    if (!pesan.token) return;
    adaJawaban.current = true;
    setGalat('');
    setMenukar(true);
    const batas = new AbortController();
    const id = setTimeout(() => batas.abort(), BATAS_TUKAR_MS);
    try {
      const r = await fetch(`${API_URL}/api/mobile/tiket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token: pesan.token }),
        signal: batas.signal,
      });
      const json = (await r.json().catch(() => null)) as { tiket?: string; galat?: string } | null;
      if (r.ok && json?.tiket) return tutup(json.tiket);
      setGalat(json?.galat ?? 'Verifikasi gagal. Coba lagi.');
    } catch {
      setGalat('Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.');
    } finally {
      clearTimeout(id);
    }
    setMenukar(false);
  }

  return (
    <Modal visible={terbuka} transparent animationType="slide" onRequestClose={() => tutup(null)}>
      <Pressable style={styles.selubung} onPress={() => tutup(null)} accessibilityLabel="Batal" />
      <View style={[styles.lembar, { backgroundColor: w.background, paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.kepala}>
          <View style={styles.fleks}>
            <Text style={[styles.judul, { color: w.text }]}>Verifikasi singkat</Text>
            <Text style={[styles.ket, { color: w.textSecondary }]}>
              Kiriman tanpa akun perlu dipastikan dari manusia. Masuk dengan akun untuk melewati langkah ini.
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={() => tutup(null)} hitSlop={8}>
            <Ionicons name="close" size={24} color={w.textSecondary} />
          </Pressable>
        </View>

        {WebViewCaptcha ? (
          <View style={styles.wadahWeb}>
            <Suspense fallback={<ActivityIndicator color={w.accentText} />}>
              <WebViewCaptcha
                key={muatUlang}
                source={{ uri: `${API_URL}/api/mobile/captcha` }}
                onMessage={(e) => void terimaPesan(e.nativeEvent.data)}
                // Halaman gagal dimuat / dijawab 4xx-5xx (mis. server belum punya rute ini).
                onError={() => setGalat(GAGAL_MUAT)}
                onHttpError={(e) => setGalat(`Verifikasi gagal dimuat (HTTP ${e.nativeEvent.statusCode}). Coba lagi nanti.`)}
                // Tanpa ini WebView menampilkan halaman galat bawaan berbahasa Inggris.
                renderError={() => <View />}
                onShouldStartLoadWithRequest={(r) => {
                  if (!r.isTopFrame || bolehDiWebView(r.url)) return true;
                  if (/^https?:/.test(r.url)) void Linking.openURL(r.url);
                  return false;
                }}
                style={styles.web}
                // Latar transparan supaya menyatu dengan lembar, terang maupun gelap.
                containerStyle={styles.web}
                setSupportMultipleWindows={false}
              />
            </Suspense>
            {menukar && (
              <View style={[StyleSheet.absoluteFill, styles.tengah, { backgroundColor: w.background }]}>
                <ActivityIndicator color={w.accentText} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.wadahWeb}>
            <Text style={[styles.ket, styles.tengahTeks, { color: w.text }]}>
              Versi aplikasi ini belum bisa memverifikasi kiriman tanpa akun. Masuk dengan akun untuk mengirim, atau
              perbarui aplikasi.
            </Text>
          </View>
        )}

        {galat !== '' && <Text style={[styles.ket, styles.tengahTeks, { color: w.danger }]}>{galat}</Text>}
        <View style={styles.aksi}>
          {galat !== '' && WebViewCaptcha && (
            <Tombol
              judul="Coba lagi"
              ikon="refresh"
              ragam="sekunder"
              onPress={() => {
                setGalat('');
                setMuatUlang((n) => n + 1);
              }}
            />
          )}
          <Tombol
            judul="Masuk dengan akun"
            ikon="person-outline"
            ragam="teks"
            onPress={() => {
              tutup(null);
              router.push({ pathname: '/masuk', params: { alasan: 'untuk mengirim tanpa verifikasi' } });
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  selubung: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  lembar: {
    paddingTop: Spacing.four,
    paddingHorizontal: 18,
    gap: Spacing.three,
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
  },
  kepala: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  fleks: {
    flex: 1,
  },
  judul: {
    fontFamily: Fonts.judul,
    fontSize: 16,
  },
  ket: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  tengahTeks: {
    textAlign: 'center',
  },
  wadahWeb: {
    height: 170,
    justifyContent: 'center',
  },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tengah: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  aksi: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
