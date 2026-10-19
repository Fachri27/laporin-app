import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tombol } from '@/components/tombol';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { kirimKomentar, useAkun } from '@/lib/akun';
import { MODE_DEMO } from '@/lib/api';
import { blokirPenulis, useBlokir } from '@/lib/blokir';
import { tampilkanMenu } from '@/lib/menu-aksi';
import { ambilKomentar, naikkanJumlahKomentar, type Komentar } from '@/lib/umpan';

type Hasil = { status: 'memuat' } | { status: 'siap'; komentar: Komentar[] } | { status: 'galat'; galat: string };

/** Komentar yang dibalas; `akarId` = komentar teratas utasnya, tempat balasan tampil (datar). */
type Tujuan = { id: number; nama: string; akarId: number };

/** Satu utas yang tampil: komentar akar beserta balasannya, sesudah penulis yang diblokir disaring. */
type Utas = { komentar: Komentar; akarId: number; balasan: Komentar[] };

/**
 * Komentar satu laporan, sebagai lembar dari bawah. Daftarnya dari situs;
 * menulis butuh akun (docs/AKUN.md) — akun menggantikan captcha Turnstile
 * yang dipakai form web. Semuanya di dalam aplikasi; tanpa server (mode
 * demo) komentar hanya bisa dibaca.
 */
export default function LayarKomentar() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  const { id, judul } = useLocalSearchParams<{ id: string; slug?: string; judul?: string }>();
  const akun = useAkun();
  const diblokir = useBlokir();
  const [hasil, setHasil] = useState<Hasil>({ status: 'memuat' });
  const [percobaan, setPercobaan] = useState(0);
  const [isi, setIsi] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [galatKirim, setGalatKirim] = useState('');
  const [balasKe, setBalasKe] = useState<Tujuan | null>(null);
  const masukan = useRef<TextInput>(null);

  async function kirim() {
    const teks = isi.trim();
    if (!teks || mengirim) return;
    const tujuan = balasKe;
    setMengirim(true);
    setGalatKirim('');
    const h = await kirimKomentar(Number(id), teks, tujuan?.id);
    setMengirim(false);
    if (!h.ok) return setGalatKirim(h.galat);
    setIsi('');
    setBalasKe((b) => (b === tujuan ? null : b));
    naikkanJumlahKomentar(Number(id));
    setHasil((x) => {
      if (x.status !== 'siap') return x;
      // Komentar baru di paling atas, sama seperti urutan situs (terbaru dulu); balasan di ujung utasnya (kronologis).
      if (!tujuan || !x.komentar.some((k) => k.id === tujuan.akarId)) return { status: 'siap', komentar: [h.komentar, ...x.komentar] };
      return {
        status: 'siap',
        komentar: x.komentar.map((k) => (k.id === tujuan.akarId ? { ...k, balasan: [...(k.balasan ?? []), h.komentar] } : k)),
      };
    });
  }

  function balas(k: Komentar, akarId: number) {
    setBalasKe({ id: k.id, nama: k.nama, akarId });
    masukan.current?.focus();
  }

  useEffect(() => {
    let batal = false;
    void ambilKomentar(Number(id)).then((h) => {
      if (!batal) setHasil(h.ok ? { status: 'siap', komentar: h.komentar } : { status: 'galat', galat: h.galat });
    });
    return () => {
      batal = true;
    };
  }, [id, percobaan]);

  // Penulis yang diblokir disaring sekali di sini — judul, keadaan kosong, dan daftar memakai hasil yang sama.
  // Akar yang diblokir tidak ikut menyembunyikan balasan orang lain: balasan itu tampil sebagai utas sendiri.
  const terlihat = (k: Komentar) => !k.penulis || !diblokir.has(k.penulis);
  const tampil: Utas[] | null =
    hasil.status === 'siap'
      ? hasil.komentar.flatMap((k) => {
          const balasan = (k.balasan ?? []).filter(terlihat);
          return terlihat(k)
            ? [{ komentar: k, akarId: k.id, balasan }]
            : balasan.map((b) => ({ komentar: b, akarId: k.id, balasan: [] }));
        })
      : null;
  const jumlah = tampil?.reduce((n, u) => n + 1 + u.balasan.length, 0) ?? null;
  const bisaBalas = akun.status === 'masuk';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.layar, { backgroundColor: w.background }]}>
      <View style={styles.kepala}>
        <View style={styles.fleks}>
          <Text style={[styles.judul, { color: w.text }]}>{jumlah === null ? 'Komentar' : `${jumlah} komentar`}</Text>
          {judul ? (
            <Text style={[styles.subjudul, { color: w.textSecondary }]} numberOfLines={1}>
              {judul}
            </Text>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={() => router.back()} hitSlop={8} style={styles.tutup}>
          <Ionicons name="close" size={24} color={w.textSecondary} />
        </Pressable>
      </View>

      {/* .safety-note di desain. */}
      <View style={[styles.catatanAman, { backgroundColor: w.accentSoft }]}>
        <Ionicons name="shield-checkmark-outline" size={18} color={w.onAccentSoft} />
        <Text style={[styles.teksCatatanAman, { color: w.onAccentSoft }]}>
          <Text style={styles.tebal}>Jaga komentar tetap berguna. </Text>
          Bagikan kondisi terkini dan jalur yang aman.
        </Text>
      </View>

      <ScrollView style={styles.fleks} contentContainerStyle={styles.isi} nestedScrollEnabled>
        {hasil.status === 'memuat' && <ActivityIndicator color={w.accentText} style={styles.pemuat} />}
        {hasil.status === 'galat' && (
          <View style={styles.kosong}>
            <Text style={[styles.teksRedup, { color: w.textSecondary }]}>{hasil.galat}</Text>
            <Tombol
              judul="Coba lagi"
              ikon="refresh"
              ragam="teks"
              onPress={() => {
                setHasil({ status: 'memuat' });
                setPercobaan((n) => n + 1);
              }}
            />
          </View>
        )}
        {hasil.status === 'siap' && tampil?.length === 0 && (
          <View style={styles.kosong}>
            <Ionicons name="chatbubbles-outline" size={36} color={w.textSecondary} />
            <Text style={[styles.teksRedup, { color: w.textSecondary }]}>
              {hasil.komentar.length === 0
                ? 'Belum ada komentar.'
                : 'Komentar dari penulis yang Anda blokir disembunyikan.'}
            </Text>
          </View>
        )}
        {tampil?.map((u) => (
          <View key={u.komentar.id} style={styles.utas}>
            <BarisKomentar komentar={u.komentar} onBalas={bisaBalas ? () => balas(u.komentar, u.akarId) : undefined} />
            {u.balasan.map((b) => (
              <View key={b.id} style={styles.balasan}>
                <BarisKomentar komentar={b} kecil onBalas={bisaBalas ? () => balas(b, u.akarId) : undefined} />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.kaki, { paddingBottom: insets.bottom + Spacing.two }]}>
        {akun.status === 'masuk' ? (
          <>
            {balasKe && (
              <View style={styles.barisBalas}>
                <Text style={[styles.teksBalas, { color: w.textSecondary }]} numberOfLines={1}>
                  Membalas <Text style={styles.tebal}>@{balasKe.nama}</Text>
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Batal membalas" onPress={() => setBalasKe(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={w.textSecondary} />
                </Pressable>
              </View>
            )}
            {/* .comment-entry di desain: pil putih berbayang, avatar "Anda", tombol kirim hijau. */}
            <View style={[styles.barisTulis, { backgroundColor: w.surface }]}>
              <View style={styles.avatarSaya}>
                <Text style={styles.inisialSaya}>{(akun.pengguna?.nama.trim()[0] ?? 'A').toUpperCase()}</Text>
              </View>
              <TextInput
                ref={masukan}
                value={isi}
                onChangeText={setIsi}
                placeholder={balasKe ? `Balas ${balasKe.nama}…` : 'Tambahkan kabar dari lapangan…'}
                placeholderTextColor={w.textSecondary}
                maxLength={2000}
                multiline
                style={[styles.input, { color: w.text }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kirim komentar"
                disabled={!isi.trim() || mengirim}
                onPress={() => void kirim()}
                hitSlop={6}
                style={[styles.kirim, (!isi.trim() || mengirim) && styles.mati]}>
                {mengirim ? (
                  <ActivityIndicator color={w.accentText} size="small" />
                ) : (
                  <Ionicons name="send" size={20} color={w.accentText} />
                )}
              </Pressable>
            </View>
            {galatKirim !== '' && <Text style={[styles.teksKaki, { color: w.danger }]}>{galatKirim}</Text>}
          </>
        ) : MODE_DEMO ? (
          <Text style={[styles.teksKaki, { color: w.textSecondary }]}>
            Menulis komentar butuh koneksi ke server aplikasi (mode demo).
          </Text>
        ) : (
          <Tombol
            judul="Masuk untuk berkomentar"
            ikon="person-outline"
            ragam="sekunder"
            onPress={() => router.push({ pathname: '/masuk', params: { alasan: 'untuk berkomentar' } })}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

/** Tekan lama: laporkan komentar, atau blokir penulisnya (syarat toko untuk konten buatan pengguna). */
function menuKomentar(k: Komentar) {
  const penulis = k.penulis;
  tampilkanMenu(k.nama, [
    {
      label: 'Laporkan komentar',
      merusak: true,
      aksi: () => router.push({ pathname: '/laporkan', params: { jenis: 'komentar', id: String(k.id), ringkas: k.isi.slice(0, 120) } }),
    },
    ...(penulis
      ? [
          {
            label: `Blokir ${k.nama}`,
            aksi: () =>
              Alert.alert(`Blokir ${k.nama}?`, 'Komentarnya tidak akan tampil lagi di HP ini. Bisa dibuka lagi dari Pengaturan.', [
                { text: 'Batal', style: 'cancel' },
                { text: 'Blokir', style: 'destructive', onPress: () => void blokirPenulis(penulis) },
              ]),
          },
        ]
      : []),
  ]);
}

function BarisKomentar({
  komentar: k,
  kecil = false,
  onBalas,
}: {
  komentar: Komentar;
  kecil?: boolean;
  /** Ada bila warga sudah masuk — menampilkan tombol "Balas". */
  onBalas?: () => void;
}) {
  const w = useTheme();
  const ukuran = kecil ? 28 : 36;
  return (
    <Pressable
      onLongPress={() => menuKomentar(k)}
      delayLongPress={350}
      accessibilityHint="Tekan lama untuk melaporkan atau memblokir"
      style={styles.baris}>
      <View style={[styles.avatar, { width: ukuran, height: ukuran, borderRadius: ukuran / 2, backgroundColor: w.surfaceMuted }]}>
        <Text style={[styles.inisial, { color: w.text, fontSize: kecil ? 11 : 12.5 }]}>
          {(k.nama.trim()[0] ?? '?').toUpperCase()}
        </Text>
      </View>
      <View style={styles.fleks}>
        <Text style={[styles.nama, { color: w.text }]}>{k.nama}</Text>
        <Text style={[styles.teksKomentar, { color: w.text }]}>
          {k.sebutan ? <Text style={[styles.sebutan, { color: w.accentText }]}>{`@${k.sebutan} `}</Text> : null}
          {k.isi}
        </Text>
        <View style={styles.barisWaktu}>
          <Text style={[styles.waktu, { color: w.textSecondary }]}>{k.waktu}</Text>
          {onBalas && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Balas ${k.nama}`} onPress={onBalas} hitSlop={8}>
              <Text style={[styles.waktu, styles.tebal, { color: w.textSecondary }]}>Balas</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  fleks: {
    flex: 1,
  },
  kepala: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.four,
    paddingHorizontal: 18,
    gap: Spacing.two,
  },
  judul: {
    fontFamily: Fonts.judul,
    fontSize: 16,
  },
  subjudul: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
  },
  tutup: {
    padding: 4,
  },
  catatanAman: {
    flexDirection: 'row',
    gap: 9,
    marginHorizontal: 18,
    marginTop: 14,
    padding: 11,
    borderRadius: 10,
  },
  teksCatatanAman: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  tebal: {
    fontFamily: Fonts.bold,
  },
  isi: {
    paddingHorizontal: 18,
    paddingTop: Spacing.two,
  },
  pemuat: {
    marginTop: Spacing.five,
  },
  kosong: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  teksRedup: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  utas: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  balasan: {
    paddingLeft: 34 + 10,
  },
  baris: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 11,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inisial: {
    fontFamily: Fonts.bold,
  },
  nama: {
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  teksKomentar: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  sebutan: {
    fontFamily: Fonts.bold,
  },
  barisWaktu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 3,
  },
  waktu: {
    fontFamily: Fonts.regular,
    fontSize: 11.5,
  },
  kaki: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingHorizontal: 14,
  },
  barisBalas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: 8,
  },
  teksBalas: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
  },
  teksKaki: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    textAlign: 'center',
  },
  barisTulis: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 24,
    boxShadow: '0 5px 25px rgba(0,0,0,0.1)',
  },
  avatarSaya: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#26312c',
    marginBottom: 3,
  },
  inisialSaya: {
    color: '#fff',
    fontFamily: Fonts.bold,
    fontSize: 11,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
    fontFamily: Fonts.regular,
    fontSize: 14.5,
  },
  kirim: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mati: {
    opacity: 0.35,
  },
});
