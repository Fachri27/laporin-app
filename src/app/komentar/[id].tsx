import Feather from '@expo/vector-icons/Feather';
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

import { Avatar } from '@/components/avatar';
import { TombolIkon } from '@/components/bilah-atas';
import { Tombol } from '@/components/tombol';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useRuangKeyboard } from '@/hooks/use-keyboard-terbuka';
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

type Urutan = 'baru' | 'lama';

const URUTAN: { nilai: Urutan; label: string }[] = [
  { nilai: 'baru', label: 'TERBARU' },
  { nilai: 'lama', label: 'TERLAMA' },
];

/**
 * Komentar satu laporan, sebagai lembar dari bawah (artboard "Comments"): judul besar
 * "KOMENTAR n" dengan judul laporan kapital kecil di kanan, pil urutan terbaru/terlama, daftar
 * bergaris tipis, lalu kolom tulis berbentuk pil dan tombol kirim bulat sinyal. Daftarnya dari
 * situs; menulis butuh akun (docs/AKUN.md) — akun menggantikan captcha Turnstile
 * yang dipakai form web. Semuanya di dalam aplikasi; tanpa server (mode
 * demo) komentar hanya bisa dibaca.
 */
export default function LayarKomentar() {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  // tulis=1: dibuka dari kolom komentar di detail laporan — langsung siap mengetik.
  const { id, tulis, judul } = useLocalSearchParams<{ id: string; slug?: string; judul?: string; tulis?: string }>();
  const akun = useAkun();
  const diblokir = useBlokir();
  const [hasil, setHasil] = useState<Hasil>({ status: 'memuat' });
  const [percobaan, setPercobaan] = useState(0);
  const [isi, setIsi] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [galatKirim, setGalatKirim] = useState('');
  const [balasKe, setBalasKe] = useState<Tujuan | null>(null);
  const [urutan, setUrutan] = useState<Urutan>('baru');
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
  // Situs mengirim utas terbaru dulu; "Terlama" cukup membaliknya (balasan di dalam utas tetap kronologis).
  const tampil: Utas[] | null =
    hasil.status === 'siap'
      ? (urutan === 'lama' ? [...hasil.komentar].reverse() : hasil.komentar).flatMap((k) => {
          const balasan = (k.balasan ?? []).filter(terlihat);
          return terlihat(k)
            ? [{ komentar: k, akarId: k.id, balasan }]
            : balasan.map((b) => ({ komentar: b, akarId: k.id, balasan: [] }));
        })
      : null;
  const jumlah = tampil?.reduce((n, u) => n + 1 + u.balasan.length, 0) ?? null;
  const bisaBalas = akun.status === 'masuk';
  const bisaKirim = isi.trim() !== '' && !mengirim;
  // Lembar dua tinggi di Android hanya dibesarkan penuh saat keyboard muncul — isinya tidak ikut
  // naik. Ruang setinggi bagian yang tertutup keyboard menjaga kolom tulis tetap di atasnya. iOS: padding KAV.
  const tertutup = useRuangKeyboard();
  const ruangKeyboard = Platform.OS === 'android' ? tertutup : 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.layar, { backgroundColor: w.surface, paddingBottom: ruangKeyboard }]}>
      {/* Pegangan — iOS sudah punya pegangan bawaan lembar (sheetGrabberVisible). */}
      {Platform.OS !== 'ios' && <View style={[styles.pegangan, { backgroundColor: w.borderStrong }]} />}

      {/* Kepala: judul + jumlah tanggapan yang tampil (sinyal), judul laporan kapital kecil, tombol tutup. */}
      <View style={[styles.kepala, { borderBottomColor: w.border }]}>
        <View style={styles.barisJudul}>
          <Text accessibilityRole="header" style={[styles.judul, { color: w.text }]}>
            Komentar{jumlah ? <Text style={{ color: w.accentText }}>{` ${jumlah}`}</Text> : null}
          </Text>
          <Text style={[styles.labelLaporan, { color: w.textSecondary }]} numberOfLines={1}>
            {judul?.toUpperCase()}
          </Text>
          <TombolIkon ikon="x" label="Tutup" onPress={() => router.back()} />
        </View>
        {(tampil?.length ?? 0) > 1 && (
          <View accessibilityRole="tablist" style={styles.barisUrutan}>
            {URUTAN.map((u) => {
              const pilih = u.nilai === urutan;
              return (
                <Pressable
                  key={u.nilai}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: pilih }}
                  onPress={() => setUrutan(u.nilai)}
                  style={({ pressed }) => [
                    styles.urutan,
                    pilih ? { backgroundColor: w.chipAktif, borderColor: w.chipAktif } : { borderColor: w.border },
                    pressed && styles.ditekan,
                  ]}>
                  <Text style={[styles.teksUrutan, { color: pilih ? w.onChipAktif : w.text }]}>{u.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <ScrollView style={styles.fleks} contentContainerStyle={styles.isi} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {hasil.status === 'memuat' && <ActivityIndicator color={w.accentText} style={styles.pemuat} />}
        {hasil.status === 'galat' && (
          <View style={styles.kosong}>
            <Text style={[styles.teksRedup, { color: w.textSecondary }]}>{hasil.galat}</Text>
            <Tombol
              judul="Coba lagi"
              ikon="refresh"
              ragam="sekunder"
              onPress={() => {
                setHasil({ status: 'memuat' });
                setPercobaan((n) => n + 1);
              }}
            />
          </View>
        )}
        {hasil.status === 'siap' && tampil?.length === 0 && (
          <View style={styles.kosong}>
            <Feather name="message-circle" size={34} color={w.textSecondary} />
            <Text style={[styles.teksRedup, { color: w.textSecondary }]}>
              {hasil.komentar.length === 0
                ? 'Belum ada komentar.'
                : 'Komentar dari penulis yang Anda blokir disembunyikan.'}
            </Text>
          </View>
        )}
        {tampil?.map((u) => (
          <View key={u.komentar.id}>
            <BarisKomentar komentar={u.komentar} onBalas={bisaBalas ? () => balas(u.komentar, u.akarId) : undefined} />
            {u.balasan.map((b) => (
              <View key={b.id} style={styles.balasan}>
                <BarisKomentar komentar={b} kecil onBalas={bisaBalas ? () => balas(b, u.akarId) : undefined} />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Kaki: garis atas, kolom tulis berbentuk pil, tombol kirim bulat sinyal. */}
      <View style={[styles.kaki, { borderTopColor: w.border, paddingBottom: (ruangKeyboard > 0 ? 0 : insets.bottom) + 10 }]}>
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
            <View style={styles.barisTulis}>
              <View style={[styles.kolom, { backgroundColor: w.surfaceMuted, borderColor: w.border }]}>
                <TextInput
                  ref={masukan}
                  autoFocus={tulis === '1'}
                  value={isi}
                  onChangeText={setIsi}
                  placeholder={balasKe ? `Balas ${balasKe.nama}…` : 'Tulis komentar yang membantu…'}
                  accessibilityLabel="Tulis komentar"
                  placeholderTextColor={w.textSecondary}
                  maxLength={2000}
                  multiline
                  style={[styles.input, { color: w.text }]}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kirim komentar"
                accessibilityState={{ disabled: !bisaKirim, busy: mengirim }}
                disabled={!bisaKirim}
                onPress={() => void kirim()}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.kirim,
                  { backgroundColor: pressed ? w.accentPressed : w.accent },
                  !bisaKirim && !mengirim && styles.redup,
                ]}>
                {mengirim ? (
                  <ActivityIndicator color={w.onAccent} size="small" />
                ) : (
                  <Feather name="send" size={19} color={w.onAccent} style={styles.ikonKirim} />
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
          // Tamu: kolom yang sama, mengetuknya membuka lembar masuk.
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/masuk', params: { alasan: 'untuk berkomentar' } })}
            style={({ pressed }) => [
              styles.kolom,
              styles.kolomTamu,
              { backgroundColor: pressed ? w.border : w.surfaceMuted, borderColor: w.border },
            ]}>
            <Feather name="user" size={17} color={w.textSecondary} />
            <Text style={[styles.teksTamu, { color: w.textSecondary }]}>Masuk untuk berkomentar</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function laporkanKomentar(k: Komentar) {
  router.push({ pathname: '/laporkan', params: { jenis: 'komentar', id: String(k.id), ringkas: k.isi.slice(0, 120) } });
}

/** Tekan lama: laporkan komentar, atau blokir penulisnya (syarat toko untuk konten buatan pengguna). */
function menuKomentar(k: Komentar) {
  const penulis = k.penulis;
  tampilkanMenu(k.nama, [
    {
      label: 'Laporkan komentar',
      merusak: true,
      aksi: () => laporkanKomentar(k),
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
  /** Ada bila warga sudah masuk — menampilkan "Balas". */
  onBalas?: () => void;
}) {
  const w = useTheme();
  return (
    <Pressable
      onLongPress={() => menuKomentar(k)}
      delayLongPress={350}
      accessibilityHint="Tekan lama untuk melaporkan atau memblokir"
      style={[styles.baris, { borderBottomColor: w.border }]}>
      <Avatar nama={k.nama} ukuran={kecil ? 28 : 34} />
      <View style={styles.badan}>
        <View style={styles.barisNama}>
          <Text style={[styles.nama, { color: w.text }]}>{k.nama}</Text>
          <Text style={[styles.waktu, { color: w.textSecondary }]}>{k.waktu.toUpperCase()}</Text>
        </View>
        <Text style={[styles.teksKomentar, { color: w.text }]}>
          {k.sebutan ? <Text style={[styles.sebutan, { color: w.accentText }]}>{`@${k.sebutan} `}</Text> : null}
          {k.isi}
        </Text>
        {/* Situs tidak punya suka per komentar, jadi tidak ditampilkan. Blokir ada di tekan lama. */}
        <View style={styles.aksi}>
          {onBalas && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Balas ${k.nama}`} onPress={onBalas} hitSlop={6} style={styles.tombolAksi}>
              <Text style={[styles.teksAksi, { color: w.textSecondary }]}>Balas</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Laporkan komentar ${k.nama}`}
            onPress={() => laporkanKomentar(k)}
            hitSlop={6}
            style={styles.tombolAksi}>
            <Text style={[styles.teksAksi, { color: w.textSecondary }]}>Laporkan</Text>
          </Pressable>
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
  ditekan: {
    opacity: 0.75,
  },
  pegangan: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginTop: 10,
    marginBottom: 12,
    borderRadius: Radius.pill,
  },
  kepala: {
    paddingTop: Platform.OS === 'ios' ? Spacing.four : 0,
    borderBottomWidth: 1,
  },
  barisJudul: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
    paddingRight: 14,
    paddingBottom: 12,
  },
  judul: {
    fontFamily: Fonts.judulTebal,
    fontSize: 25,
    letterSpacing: -0.4,
    lineHeight: 30,
    paddingTop: 2,
  },
  // Judul laporan yang dikomentari, dipendekkan ke satu baris.
  labelLaporan: {
    flex: 1,
    textAlign: 'right',
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  barisUrutan: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  urutan: {
    height: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 18,
  },
  teksUrutan: {
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.66,
  },
  isi: {
    paddingHorizontal: 20,
    paddingBottom: Spacing.two,
  },
  pemuat: {
    marginTop: Spacing.five,
  },
  kosong: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  teksRedup: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  balasan: {
    paddingLeft: 34 + 12,
  },
  // Satu komentar: avatar 34, nama & waktu kapital kecil sebaris, isi, lalu Balas · Laporkan.
  baris: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badan: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  barisNama: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
    rowGap: 2,
  },
  nama: {
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  waktu: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  teksKomentar: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  sebutan: {
    fontFamily: Fonts.bold,
  },
  tebal: {
    fontFamily: Fonts.bold,
  },
  aksi: {
    flexDirection: 'row',
    gap: 16,
  },
  tombolAksi: {
    height: 32,
    justifyContent: 'center',
  },
  teksAksi: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
  },
  kaki: {
    gap: Spacing.two,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  barisBalas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: 6,
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
  },
  // Pil 48 bergaris; memanjang ke bawah saat komentarnya beberapa baris.
  kolom: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: 24,
  },
  input: {
    maxHeight: 120,
    paddingTop: 13,
    paddingBottom: 13,
    paddingHorizontal: 0,
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  kirim: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pesawat kertas Feather condong ke kanan atas: digeser sedikit supaya tampak di tengah.
  ikonKirim: {
    marginLeft: -2,
    marginBottom: -1,
  },
  redup: {
    opacity: 0.4,
  },
  kolomTamu: {
    flex: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.two,
  },
  teksTamu: {
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
});
