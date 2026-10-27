import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalParticipant, useRoomContext } from '@livekit/react-native';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { Fonts, gradasi, Media, SINYAL, Spacing, TINTA, TULANG } from '@/constants/theme';
import { blokirPenulis, useBlokir } from '@/lib/blokir';
import {
  bacaHadiah,
  BATAS_KOMENTAR,
  DAFTAR_HADIAH,
  peranDari,
  saringKomentar,
  TOPIK_HADIAH,
  TOPIK_KOMENTAR,
  TOPIK_SUKA,
  type Hadiah,
  type Peran,
} from '@/lib/live';
import { tampilkanMenu } from '@/lib/menu-aksi';

/**
 * Komentar, "ketuk layar = hati", dan hadiah selama siaran, seperti siaran
 * langsung di TikTok. Dipakai dua sisi: pelapor yang siaran (siaran-live.tsx)
 * dan warga yang menonton siaran publik (tonton-live.tsx). Petugas di CMS /
 * mock-server/penonton.html memakai topik yang sama.
 */

export type Komentar = {
  id: string;
  /** Identitas peserta dari server — kunci blokir. */
  identity: string;
  nama: string;
  /** Dari identitas, bukan nama (nama akun bebas diubah); null = komentar sendiri. */
  peran: Peran | null;
  isi: string;
  saya: boolean;
};
type Hati = { id: number; x: number; y: number; warna: string; goyang: number; miring: number; tunda: number };
/** Spanduk hadiah di kiri; hadiah sama dari pengirim yang sama menambah combo "x N". */
export type Kiriman = { kunci: string; nama: string; peran: Peran | null; hadiah: Hadiah; combo: number; versi: number };
/** Antrean animasi selayar penuh untuk hadiah besar, diputar satu per satu. */
export type Sorotan = { id: number; nama: string; hadiah: Hadiah; jumlah: number };

const WARNA_HATI = [SINYAL, TULANG, Media.oranye, SINYAL, Media.namaObrolan];
/** Ketukan beruntun dikirim sekaligus — 20 ketukan per detik tidak perlu jadi 20 pesan. */
const JEDA_GABUNG_SUKA_MS = 400;
const MAKS_HATI = 30;
/** Seperti TikTok: paling banyak dua spanduk sekaligus; yang tertua tergeser. */
const MAKS_JALUR_KIRIMAN = 2;
/** Spanduk hilang bila tidak ada tambahan combo selama ini. */
const TAMPIL_KIRIMAN_MS = 3000;
const MAKS_ANTRE_SOROTAN = 5;
const DURASI_SOROTAN_MS = 2800;
/** Batas laju per pengirim: klien nakal bisa membanjiri komentar ke semua peserta. */
const MAKS_KOMENTAR_PER_JENDELA = 3;
const JENDELA_LAJU_MS = 10_000;

/** Penanda peran di belakang nama ("BUDI · PELAPOR"); warga tanpa penanda. */
const LENCANA_PERAN: Partial<Record<Peran, string>> = { petugas: 'Petugas', pelapor: 'Pelapor' };
const NAMA_PERAN: Record<Peran, string> = { petugas: 'Petugas', pelapor: 'Pelapor', warga: 'Warga' };
/** Warna nama kapital kecil: petugas sinyal, pelapor (pembawa siaran) & komentar sendiri tulang, warga tulang redup. */
const WARNA_NAMA: Record<Peran, string> = { petugas: SINYAL, pelapor: TULANG, warga: 'rgba(237,232,223,0.7)' };

let nomorHati = 0;
let nomorSorotan = 0;

/** Nama peserta; bila kosong, nama perannya (dari identitas server). */
function namaPeserta(room: ReturnType<typeof useRoomContext>, identity: string): string {
  return room.remoteParticipants.get(identity)?.name || NAMA_PERAN[peranDari(identity)];
}

function hatiBaru(x: number, y: number, tunda = 0): Hati {
  return {
    id: ++nomorHati,
    x,
    y,
    tunda,
    warna: WARNA_HATI[Math.floor(Math.random() * WARNA_HATI.length)],
    goyang: (Math.random() - 0.5) * 70,
    miring: (Math.random() - 0.5) * 30,
  };
}

export function useInteraksiLive() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { width, height } = useWindowDimensions();
  const [komentar, setKomentar] = useState<Komentar[]>([]);
  const [hati, setHati] = useState<Hati[]>([]);
  const [jumlahSuka, setJumlahSuka] = useState(0);
  const [kiriman, setKiriman] = useState<Kiriman[]>([]);
  const [sorotan, setSorotan] = useState<Sorotan[]>([]);
  const [jumlahHadiah, setJumlahHadiah] = useState(0);
  const sukaTertunda = useRef(0);
  const pengatur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadiahTertunda = useRef(new Map<string, number>());
  const pengaturHadiah = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lajuKomentar = useRef(new Map<string, number[]>());
  // Penanganan text stream dipasang sekali; daftar blokir terbaru dibaca lewat ref.
  const diblokir = useBlokir();
  const diblokirTerkini = useRef(diblokir);
  useEffect(() => {
    diblokirTerkini.current = diblokir;
  }, [diblokir]);

  const tambahHati = useCallback((baru: Hati[]) => {
    setHati((h) => [...h, ...baru].slice(-MAKS_HATI));
  }, []);

  const hapusHati = useCallback((id: number) => {
    setHati((h) => h.filter((x) => x.id !== id));
  }, []);

  const terimaHadiah = useCallback((kunci: string, nama: string, peran: Peran | null, hadiah: Hadiah, jumlah: number) => {
    setJumlahHadiah((j) => j + jumlah);
    setKiriman((daftar) => {
      const ada = daftar.find((k) => k.kunci === kunci);
      if (ada) return daftar.map((k) => (k === ada ? { ...k, combo: k.combo + jumlah, versi: k.versi + 1 } : k));
      return [...daftar, { kunci, nama, peran, hadiah, combo: jumlah, versi: 0 }].slice(-MAKS_JALUR_KIRIMAN);
    });
    if (hadiah.besar) {
      // Antrean penuh = hadiah besar berikutnya cukup tampil di spanduk.
      setSorotan((s) => [...s, { id: ++nomorSorotan, nama, hadiah, jumlah }].slice(0, MAKS_ANTRE_SOROTAN));
    }
  }, []);

  const hapusKiriman = useCallback((kunci: string) => {
    setKiriman((daftar) => daftar.filter((k) => k.kunci !== kunci));
  }, []);

  const hapusSorotan = useCallback((id: number) => {
    setSorotan((s) => s.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    room.registerTextStreamHandler(TOPIK_KOMENTAR, async (reader, { identity }) => {
      const isi = saringKomentar((await reader.readAll()).trim().slice(0, BATAS_KOMENTAR));
      if (!isi || diblokirTerkini.current.has(identity)) return;
      const kini = Date.now();
      const jejak = (lajuKomentar.current.get(identity) ?? []).filter((t) => kini - t < JENDELA_LAJU_MS);
      if (jejak.length >= MAKS_KOMENTAR_PER_JENDELA) return;
      lajuKomentar.current.set(identity, [...jejak, kini]);
      const komentarBaru: Komentar = {
        id: `${identity}-${kini}`,
        identity,
        nama: namaPeserta(room, identity),
        peran: peranDari(identity),
        isi,
        saya: false,
      };
      setKomentar((k) => [...k.slice(-29), komentarBaru]);
    });
    room.registerTextStreamHandler(TOPIK_SUKA, async (reader, { identity }) => {
      const teks = await reader.readAll();
      if (diblokirTerkini.current.has(identity)) return;
      const n = Math.min(50, Math.max(1, parseInt(teks, 10) || 1));
      setJumlahSuka((j) => j + n);
      // Hati dari penonton naik dari kanan bawah, berderet.
      tambahHati(
        Array.from({ length: Math.min(n, 8) }, (_, i) =>
          hatiBaru(width - 56 + (Math.random() - 0.5) * 30, height * 0.62, i * 120),
        ),
      );
    });
    room.registerTextStreamHandler(TOPIK_HADIAH, async (reader, { identity }) => {
      const k = bacaHadiah(await reader.readAll());
      if (!k || diblokirTerkini.current.has(identity)) return;
      terimaHadiah(`${identity}:${k.hadiah.id}`, namaPeserta(room, identity), peranDari(identity), k.hadiah, k.jumlah);
    });
    return () => {
      room.unregisterTextStreamHandler(TOPIK_KOMENTAR);
      room.unregisterTextStreamHandler(TOPIK_SUKA);
      room.unregisterTextStreamHandler(TOPIK_HADIAH);
    };
  }, [room, tambahHati, terimaHadiah, width, height]);

  useEffect(
    () => () => {
      if (pengatur.current) clearTimeout(pengatur.current);
      if (pengaturHadiah.current) clearTimeout(pengaturHadiah.current);
    },
    [],
  );

  /** Ketukan di layar: hati muncul di titik ketukan dan terkirim ke penonton. */
  function ketuk(x: number, y: number) {
    tambahHati([hatiBaru(x, y)]);
    setJumlahSuka((j) => j + 1);
    sukaTertunda.current += 1;
    if (pengatur.current) return;
    pengatur.current = setTimeout(() => {
      const n = sukaTertunda.current;
      sukaTertunda.current = 0;
      pengatur.current = null;
      localParticipant.sendText(String(n), { topic: TOPIK_SUKA }).catch(() => {});
    }, JEDA_GABUNG_SUKA_MS);
  }

  /** Hadiah dari penonton: tampil langsung, ketukan beruntun dikirim sekaligus per hadiah. */
  function kirimHadiah(hadiah: Hadiah) {
    terimaHadiah(`saya:${hadiah.id}`, 'Anda', null, hadiah, 1);
    const tertunda = hadiahTertunda.current;
    tertunda.set(hadiah.id, (tertunda.get(hadiah.id) ?? 0) + 1);
    if (pengaturHadiah.current) return;
    pengaturHadiah.current = setTimeout(() => {
      pengaturHadiah.current = null;
      for (const [id, jumlah] of tertunda) {
        localParticipant.sendText(JSON.stringify({ id, jumlah }), { topic: TOPIK_HADIAH }).catch(() => {});
      }
      tertunda.clear();
    }, JEDA_GABUNG_SUKA_MS);
  }

  async function kirimKomentar(isi: string): Promise<boolean> {
    const bersih = saringKomentar(isi);
    try {
      await localParticipant.sendText(bersih, { topic: TOPIK_KOMENTAR });
      const milikSaya: Komentar = {
        id: `saya-${Date.now()}`,
        identity: localParticipant.identity,
        nama: 'Anda',
        peran: null,
        isi: bersih,
        saya: true,
      };
      setKomentar((k) => [...k.slice(-29), milikSaya]);
      return true;
    } catch {
      return false;
    }
  }

  return {
    // Yang baru diblokir langsung hilang, termasuk komentarnya yang sudah tampil.
    komentar: komentar.filter((k) => !diblokir.has(k.identity)),
    hati,
    jumlahSuka,
    ketuk,
    kirimKomentar,
    hapusHati,
    kiriman,
    hapusKiriman,
    kirimHadiah,
    sorotan: sorotan[0] ?? null,
    hapusSorotan,
    jumlahHadiah,
  };
}

/** Spanduk hadiah di atas komentar: pengirim, nama hadiah, dan combo "x N". */
export function DaftarKiriman({ kiriman, onSelesai }: { kiriman: Kiriman[]; onSelesai: (kunci: string) => void }) {
  if (kiriman.length === 0) return null;
  return (
    <View style={styles.daftarKiriman} pointerEvents="none">
      {kiriman.map((k) => (
        <SpandukKiriman key={k.kunci} kiriman={k} onSelesai={onSelesai} />
      ))}
    </View>
  );
}

function SpandukKiriman({ kiriman: k, onSelesai }: { kiriman: Kiriman; onSelesai: (kunci: string) => void }) {
  const [masuk] = useState(() => new Animated.Value(0));
  const [lompat] = useState(() => new Animated.Value(1));
  const [pudar] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(masuk, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [masuk]);

  // Setiap tambahan combo: angka melompat dan hitungan mundur hilang diulang.
  useEffect(() => {
    pudar.stopAnimation();
    pudar.setValue(1);
    lompat.setValue(1.8);
    Animated.spring(lompat, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    const hilang = Animated.sequence([
      Animated.delay(TAMPIL_KIRIMAN_MS),
      Animated.timing(pudar, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]);
    hilang.start(({ finished }) => {
      if (finished) onSelesai(k.kunci);
    });
    return () => hilang.stop();
  }, [k.versi, k.kunci, lompat, pudar, onSelesai]);

  return (
    <Animated.View
      style={[
        styles.spanduk,
        {
          opacity: Animated.multiply(masuk, pudar),
          transform: [{ translateX: masuk.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }],
        },
      ]}>
      <View style={styles.avatarKiriman}>
        <Text style={styles.inisialKiriman}>{(k.nama.trim()[0] ?? 'P').toUpperCase()}</Text>
      </View>
      <View style={styles.teksSpanduk}>
        <NamaPeserta nama={k.nama} peran={k.peran} />
        <Text style={styles.ketKiriman} numberOfLines={1}>
          mengirim {k.hadiah.nama}
        </Text>
      </View>
      <Text style={styles.emojiKiriman}>{k.hadiah.emoji}</Text>
      <Animated.Text style={[styles.combo, { transform: [{ scale: lompat }] }]}>x{k.combo}</Animated.Text>
    </Animated.View>
  );
}

/** Hadiah besar: melintas di tengah layar, dengan hujan tetes air. */
export function SorotanHadiah({ sorotan, onSelesai }: { sorotan: Sorotan | null; onSelesai: (id: number) => void }) {
  if (!sorotan) return null;
  return <AnimasiSorotan key={sorotan.id} sorotan={sorotan} onSelesai={onSelesai} />;
}

function AnimasiSorotan({ sorotan: s, onSelesai }: { sorotan: Sorotan; onSelesai: (id: number) => void }) {
  const { width, height } = useWindowDimensions();
  const [t] = useState(() => new Animated.Value(0));
  // Satu nilai penggerak untuk semua tetes; tiap tetes punya jendela waktunya sendiri.
  const [tetes] = useState(() =>
    Array.from({ length: 14 }, () => ({ x: Math.random(), mulai: 0.2 + Math.random() * 0.4, ukuran: 18 + Math.random() * 14 })),
  );

  useEffect(() => {
    const animasi = Animated.timing(t, { toValue: 1, duration: DURASI_SOROTAN_MS, easing: Easing.linear, useNativeDriver: true });
    animasi.start(({ finished }) => {
      if (finished) onSelesai(s.id);
    });
    return () => animasi.stop();
  }, [t, s.id, onSelesai]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.sorotan]} pointerEvents="none">
      {tetes.map((d, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.tetes,
            {
              left: d.x * (width - 30),
              fontSize: d.ukuran,
              opacity: t.interpolate({
                inputRange: [d.mulai, d.mulai + 0.04, d.mulai + 0.3, d.mulai + 0.35],
                outputRange: [0, 1, 1, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateY: t.interpolate({
                    inputRange: [d.mulai, d.mulai + 0.35],
                    outputRange: [0, height * 0.8],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}>
          💧
        </Animated.Text>
      ))}

      <Animated.View
        style={[
          styles.panggung,
          {
            opacity: t.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [width, 0, 0, -width] }) },
              { translateY: t.interpolate({ inputRange: [0.2, 0.35, 0.5, 0.65, 0.8], outputRange: [0, -10, 0, -10, 0], extrapolate: 'clamp' }) },
              { scale: t.interpolate({ inputRange: [0, 0.2, 0.28, 0.36, 0.8, 1], outputRange: [0.6, 1, 1.15, 1, 1, 0.8] }) },
            ],
          },
        ]}>
        <View style={styles.cahaya} />
        <Text style={styles.emojiSorotan}>{s.hadiah.emoji}</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.keteranganSorotan,
          { opacity: t.interpolate({ inputRange: [0.18, 0.26, 0.8, 0.9], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }) },
        ]}>
        <Text style={styles.teksSorotan} numberOfLines={2}>
          <Text style={styles.namaSorotan}>{s.nama}</Text> mengirim {s.hadiah.nama}
          {s.jumlah > 1 && ` x${s.jumlah}`}
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * Nama berkapital kecil dengan penanda peran dari identitas server ("BUDI · PELAPOR"), supaya
 * nama akun tidak bisa menyamar sebagai petugas. `peran` null = komentar sendiri.
 */
function NamaPeserta({ nama, peran }: { nama: string; peran: Peran | null }) {
  const label = peran ? LENCANA_PERAN[peran] : undefined;
  return (
    <Text style={[styles.nama, { color: peran ? WARNA_NAMA[peran] : TULANG }]} numberOfLines={1}>
      {nama.toUpperCase()}
      {label && ` · ${label.toUpperCase()}`}
    </Text>
  );
}

/**
 * Lencana "● LIVE" di kepala siaran: huruf judul di atas sinyal, titik tinta berkedip.
 * Belum tersambung = "MENGHUBUNGKAN" di atas tinta, tanpa titik.
 */
export function LencanaLive({ tersambung }: { tersambung: boolean }) {
  const [kedip] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!tersambung) return;
    let putaran: Animated.CompositeAnimation | null = null;
    let batal = false;
    // Gerak dikurangi (pengaturan aksesibilitas HP): titik diam saja.
    void AccessibilityInfo.isReduceMotionEnabled().then((kurangi) => {
      if (batal || kurangi) return;
      putaran = Animated.loop(
        Animated.sequence([
          Animated.timing(kedip, { toValue: 0.15, duration: 0, delay: 600, useNativeDriver: true }),
          Animated.timing(kedip, { toValue: 1, duration: 0, delay: 600, useNativeDriver: true }),
        ]),
      );
      putaran.start();
    });
    return () => {
      batal = true;
      putaran?.stop();
      kedip.setValue(1);
    };
  }, [tersambung, kedip]);

  return (
    <View style={[styles.lencanaLive, !tersambung && styles.lencanaMenunggu]}>
      {tersambung && <Animated.View style={[styles.titikLive, { opacity: kedip }]} />}
      <Text style={[styles.teksLencanaLive, !tersambung && styles.teksMenunggu]} maxFontSizeMultiplier={1.2}>
        {tersambung ? 'LIVE' : 'MENGHUBUNGKAN'}
      </Text>
    </View>
  );
}

/**
 * Pil kecil kapital di kepala siaran (durasi, penonton, kualitas sinyal). Tanpa `teks` = ikon saja;
 * `label` lalu dibacakan pembaca layar.
 */
export function PilLive({
  ikon,
  warnaIkon = TULANG,
  teks,
  label,
  besar = false,
}: {
  ikon?: ComponentProps<typeof Ionicons>['name'];
  warnaIkon?: string;
  teks?: string;
  label?: string;
  /** Durasi: angka sedikit lebih besar, seperti desain. */
  besar?: boolean;
}) {
  return (
    <View accessible={!!label} accessibilityLabel={label} style={[styles.pilLive, !teks && styles.pilIkon]}>
      {ikon && <Ionicons name={ikon} size={14} color={warnaIkon} />}
      {teks !== undefined && (
        <Text style={[styles.teksPilLive, besar && styles.teksPilBesar]} maxFontSizeMultiplier={1.2}>
          {teks}
        </Text>
      )}
    </View>
  );
}

/**
 * Tombol bulat 52 di kolom samping video (hati, hadiah, laporkan): tinta pekat bergaris tulang
 * tipis. `angka` = hitungan kecil di bawah ikon (mis. jumlah hati selama siaran).
 */
export function TombolSamping({
  ikon,
  warna = TULANG,
  label,
  onPress,
  angka,
}: {
  ikon: ComponentProps<typeof Ionicons>['name'];
  warna?: string;
  label: string;
  onPress: () => void;
  angka?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={angka ? `${label}, ${angka}` : label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.tombolSamping, pressed && styles.ditekan]}>
      <Ionicons name={ikon} size={angka ? 19 : 21} color={warna} />
      {angka !== undefined && angka > 0 && (
        <Text style={styles.angkaSamping} maxFontSizeMultiplier={1.1}>
          {angka > 999 ? `${Math.floor(angka / 100) / 10}rb` : angka}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Tekan lama komentar orang lain: laporkan (penonton; `ruang` diisi) dan
 * blokir pengirimnya — syarat toko untuk konten buatan pengguna.
 */
export function menuKomentarLive(k: Komentar, ruang: string | null) {
  tampilkanMenu(k.nama, [
    ...(ruang
      ? [
          {
            label: 'Laporkan komentar',
            merusak: true,
            aksi: () =>
              router.push({
                pathname: '/laporkan',
                params: {
                  jenis: 'siaran',
                  id: ruang,
                  ringkas: `${k.nama}: ${k.isi}`.slice(0, 120),
                  catatan: `Komentar siaran dari ${k.nama} (${k.identity}): ${k.isi}`,
                },
              }),
          },
        ]
      : []),
    {
      label: `Blokir ${k.nama}`,
      aksi: () =>
        Alert.alert(`Blokir ${k.nama}?`, 'Komentar dan hadiahnya tidak akan tampil lagi di HP ini. Bisa dibuka lagi dari Pengaturan.', [
          { text: 'Batal', style: 'cancel' },
          { text: 'Blokir', style: 'destructive', onPress: () => void blokirPenulis(k.identity) },
        ]),
    },
  ]);
}

/** Komentar terakhir di kiri bawah video, tanpa gelembung (nama kapital kecil di atas isi); yang lebih lama memudar. */
export function DaftarKomentar({ komentar, onTekanLama }: { komentar: Komentar[]; onTekanLama?: (k: Komentar) => void }) {
  const terakhir = komentar.slice(-6);
  if (terakhir.length === 0) return null;
  return (
    <View style={styles.daftar} pointerEvents="box-none">
      {terakhir.map((k, i) => {
        const bisaDitekan = !k.saya && onTekanLama !== undefined;
        return (
          <Pressable
            key={k.id}
            disabled={!bisaDitekan}
            onLongPress={() => onTekanLama?.(k)}
            accessibilityHint={bisaDitekan ? 'Tekan lama untuk melaporkan atau memblokir' : undefined}
            style={[styles.komentar, { opacity: 0.5 + (0.5 * (i + 1)) / terakhir.length }]}>
            <NamaPeserta nama={k.nama} peran={k.saya ? null : k.peran} />
            <Text style={styles.teksKomentar}>{k.isi}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Kolom komentar pil 52 tinta pekat bergaris, dan tombol kirim bulat tulang di sebelahnya. */
export function KolomKomentar({
  onKirim,
  placeholder = 'Komentar untuk petugas…',
}: {
  onKirim: (isi: string) => Promise<boolean>;
  placeholder?: string;
}) {
  const [isi, setIsi] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const bisaKirim = isi.trim() !== '' && !mengirim;

  async function kirim() {
    const teks = isi.trim();
    if (!teks || mengirim) return;
    setMengirim(true);
    const ok = await onKirim(teks);
    setMengirim(false);
    if (ok) setIsi('');
  }

  return (
    <View style={styles.kolom}>
      <TextInput
        value={isi}
        onChangeText={setIsi}
        accessibilityLabel="Tulis komentar"
        placeholder={placeholder}
        placeholderTextColor="rgba(237,232,223,0.6)"
        maxLength={BATAS_KOMENTAR}
        returnKeyType="send"
        onSubmitEditing={() => void kirim()}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kirim komentar"
        accessibilityState={{ disabled: !bisaKirim }}
        disabled={!bisaKirim}
        onPress={() => void kirim()}
        hitSlop={4}
        style={({ pressed }) => [styles.kirim, !bisaKirim && styles.kirimMati, pressed && styles.ditekan]}>
        <Ionicons name="paper-plane-outline" size={20} color={TINTA} />
      </Pressable>
    </View>
  );
}

/**
 * Laci hadiah ala TikTok untuk penonton. Tetap terbuka setelah memilih, jadi
 * ketuk berulang = combo "x N"; ketuk di luar laci untuk menutup.
 */
export function PanelHadiah({ onKirim, onTutup, bawah }: { onKirim: (h: Hadiah) => void; onTutup: () => void; bawah: number }) {
  const [masuk] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(masuk, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [masuk]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onTutup} accessibilityLabel="Tutup hadiah" />
      <Animated.View
        style={[
          styles.panelHadiah,
          { paddingBottom: bawah + Spacing.three },
          { transform: [{ translateY: masuk.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) }] },
        ]}>
        <View style={styles.kepalaPanel}>
          <Text style={styles.judulPanel}>Kirim hadiah</Text>
          <Text style={styles.ketPanel}>APRESIASI UNTUK PELAPOR · GRATIS, TANPA KOIN</Text>
        </View>
        <View style={styles.gridHadiah}>
          {DAFTAR_HADIAH.map((h) => (
            <Pressable
              key={h.id}
              accessibilityRole="button"
              accessibilityLabel={`Kirim ${h.nama}`}
              onPress={() => onKirim(h)}
              style={({ pressed }) => [styles.selHadiah, h.besar && styles.selBesar, pressed && styles.selDitekan]}>
              <Text style={styles.emojiSel}>{h.emoji}</Text>
              <Text style={styles.namaSel} numberOfLines={1}>
                {h.nama}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

export function LapisanHati({ hati, onSelesai }: { hati: Hati[]; onSelesai: (id: number) => void }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {hati.map((h) => (
        <HatiMelayang key={h.id} hati={h} onSelesai={onSelesai} />
      ))}
    </View>
  );
}

function HatiMelayang({ hati: h, onSelesai }: { hati: Hati; onSelesai: (id: number) => void }) {
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animasi = Animated.sequence([
      Animated.delay(h.tunda),
      Animated.timing(t, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    animasi.start(({ finished }) => {
      if (finished) onSelesai(h.id);
    });
    return () => animasi.stop();
  }, [t, h.id, h.tunda, onSelesai]);

  return (
    <Animated.View
      style={[
        styles.hati,
        {
          left: h.x - 22,
          top: h.y - 22,
          opacity: t.interpolate({ inputRange: [0, 0.08, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -240] }) },
            { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, h.goyang, -h.goyang / 2] }) },
            { scale: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.3, 1.25, 0.9] }) },
            { rotate: `${h.miring}deg` },
          ],
        },
      ]}>
      <Ionicons name="heart" size={44} color={h.warna} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  daftar: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 12,
  },
  komentar: {
    alignSelf: 'flex-start',
    gap: 2,
  },
  nama: {
    flexShrink: 1,
    fontFamily: Fonts.monoTebal,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  teksKomentar: {
    color: TULANG,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 19,
  },
  ditekan: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  lencanaLive: {
    height: 30,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 9,
    backgroundColor: SINYAL,
  },
  lencanaMenunggu: {
    backgroundColor: Media.kaca,
  },
  titikLive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TINTA,
  },
  teksLencanaLive: {
    color: TINTA,
    fontFamily: Fonts.judulTebal,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  teksMenunggu: {
    color: TULANG,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  pilLive: {
    height: 30,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 9,
    backgroundColor: Media.kaca,
  },
  pilIkon: {
    width: 30,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  teksPilLive: {
    color: TULANG,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  teksPilBesar: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  tombolSamping: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Media.garis,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    backgroundColor: Media.kaca,
  },
  angkaSamping: {
    color: TULANG,
    fontFamily: Fonts.monoTebal,
    fontSize: 9,
    fontVariant: ['tabular-nums'],
  },
  kolom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 52,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Media.garis,
    borderRadius: 26,
    backgroundColor: Media.kaca,
    color: TULANG,
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  kirim: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TULANG,
  },
  kirimMati: {
    opacity: 0.45,
  },
  hati: {
    position: 'absolute',
  },
  daftarKiriman: {
    alignSelf: 'flex-start',
    gap: 6,
  },
  // Spanduk hadiah: pil tinta memudar ke kanan, emoji menyembul, combo besar berhuruf judul.
  spanduk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 300,
    padding: 3,
    borderRadius: 24,
    ...gradasi('linear-gradient(to right, rgba(12,14,13,0.86), rgba(12,14,13,0.2))'),
  },
  avatarKiriman: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: SINYAL,
    backgroundColor: 'rgba(237,232,223,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inisialKiriman: {
    color: TULANG,
    fontFamily: Fonts.tebal,
    fontSize: 13,
  },
  teksSpanduk: {
    flexShrink: 1,
    gap: 2,
  },
  ketKiriman: {
    color: Media.redup,
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
  emojiKiriman: {
    fontSize: 32,
    lineHeight: 38,
    marginVertical: -6,
  },
  combo: {
    paddingRight: 10,
    color: TULANG,
    fontFamily: Fonts.judulTebal,
    fontSize: 21,
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  sorotan: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    overflow: 'hidden',
  },
  tetes: {
    position: 'absolute',
    top: -40,
  },
  panggung: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cahaya: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,74,28,0.18)',
  },
  emojiSorotan: {
    fontSize: 120,
    lineHeight: 140,
  },
  keteranganSorotan: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Media.kaca,
  },
  teksSorotan: {
    color: TULANG,
    fontFamily: Fonts.semibold,
    fontSize: 14,
    textAlign: 'center',
  },
  namaSorotan: {
    color: SINYAL,
    fontFamily: Fonts.bold,
  },
  panelHadiah: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 20,
    paddingHorizontal: Spacing.three,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(237,232,223,0.16)',
    backgroundColor: Media.kacaTebal,
    gap: Spacing.three,
  },
  kepalaPanel: {
    gap: 4,
    paddingHorizontal: 4,
  },
  judulPanel: {
    color: TULANG,
    fontFamily: Fonts.judulTebal,
    fontSize: 21,
    lineHeight: 26,
  },
  ketPanel: {
    color: 'rgba(237,232,223,0.62)',
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  gridHadiah: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.two,
  },
  selHadiah: {
    width: '25%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selBesar: {
    borderColor: 'rgba(255,74,28,0.45)',
  },
  selDitekan: {
    transform: [{ scale: 0.92 }],
    backgroundColor: 'rgba(237,232,223,0.08)',
  },
  emojiSel: {
    fontSize: 34,
    lineHeight: 42,
  },
  namaSel: {
    color: TULANG,
    fontFamily: Fonts.medium,
    fontSize: 11.5,
  },
});
