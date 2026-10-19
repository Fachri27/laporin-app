import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalParticipant, useRoomContext } from '@livekit/react-native';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { Fonts, Media, Radius, Spacing } from '@/constants/theme';
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

const WARNA_HATI = [Media.limau, '#ff2d55', '#ffcc00', Media.limau, '#ff9500'];
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

/** Lencana peran di komentar & spanduk; warga tanpa lencana. */
const LENCANA_PERAN: Partial<Record<Peran, string>> = { petugas: 'Petugas', pelapor: 'Pelapor' };
const NAMA_PERAN: Record<Peran, string> = { petugas: 'Petugas', pelapor: 'Pelapor', warga: 'Warga' };

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
        <View style={styles.barisNama}>
          <Lencana peran={k.peran} />
          <Text style={styles.namaKiriman} numberOfLines={1}>
            {k.nama}
          </Text>
        </View>
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

/** Lencana peran dari identitas server, supaya nama akun tidak bisa menyamar sebagai petugas. */
function Lencana({ peran }: { peran: Peran | null }) {
  const label = peran ? LENCANA_PERAN[peran] : undefined;
  if (!label) return null;
  return (
    <View style={[styles.lencana, peran === 'petugas' ? styles.lencanaPetugas : styles.lencanaPelapor]}>
      <Text style={[styles.teksLencana, peran === 'petugas' && styles.teksLencanaPetugas]}>{label}</Text>
    </View>
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

/** Komentar terakhir di kiri bawah video; yang lebih lama memudar. */
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
            style={[styles.gelembung, { opacity: 0.5 + (0.5 * (i + 1)) / terakhir.length }]}>
            <View style={styles.barisNama}>
              <Lencana peran={k.peran} />
              <Text style={[styles.nama, k.saya && styles.namaSaya]} numberOfLines={1}>
                {k.nama}
              </Text>
            </View>
            <Text style={styles.teksKomentar}>{k.isi}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function KolomKomentar({
  onKirim,
  onHati,
  onHadiah,
  placeholder = 'Komentar untuk petugas…',
}: {
  onKirim: (isi: string) => Promise<boolean>;
  /** Tombol hati di samping kolom, seperti .live-compose di desain. */
  onHati?: () => void;
  /** Tombol hadiah untuk penonton: membuka PanelHadiah. */
  onHadiah?: () => void;
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
      <View style={styles.pilKomentar}>
        <TextInput
          value={isi}
          onChangeText={setIsi}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.6)"
          maxLength={BATAS_KOMENTAR}
          returnKeyType="send"
          onSubmitEditing={() => void kirim()}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kirim komentar"
          disabled={!bisaKirim}
          onPress={() => void kirim()}
          hitSlop={6}
          style={[styles.kirim, !bisaKirim && styles.kirimMati]}>
          <Ionicons name="send" size={18} color={Media.limau} />
        </Pressable>
      </View>
      {onHadiah && (
        <Pressable accessibilityRole="button" accessibilityLabel="Kirim hadiah" onPress={onHadiah} hitSlop={6} style={styles.tombolHati}>
          <Ionicons name="gift" size={21} color={Media.limau} />
        </Pressable>
      )}
      {onHati && (
        <Pressable accessibilityRole="button" accessibilityLabel="Kirim hati" onPress={onHati} hitSlop={6} style={styles.tombolHati}>
          <Ionicons name="heart-outline" size={22} color="#fff" />
        </Pressable>
      )}
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
          <Text style={styles.ketPanel}>Apresiasi untuk pelapor · gratis, tanpa koin</Text>
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
    maxWidth: '80%',
    gap: 8,
  },
  // .chat-stream di desain: gelembung kaca, nama hijau di atas isi.
  gelembung: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(15,18,16,0.55)',
  },
  barisNama: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  nama: {
    flexShrink: 1,
    color: Media.namaObrolan,
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  lencana: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  lencanaPetugas: {
    backgroundColor: Media.limau,
  },
  lencanaPelapor: {
    backgroundColor: Media.merah,
  },
  teksLencana: {
    color: '#fff',
    fontFamily: Fonts.bold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  teksLencanaPetugas: {
    color: Media.onLimau,
  },
  namaSaya: {
    color: Media.limau,
  },
  teksKomentar: {
    color: '#fff',
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    lineHeight: 18,
  },
  kolom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pilKomentar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.27)',
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(13,17,14,0.42)',
  },
  input: {
    flex: 1,
    height: 42,
    color: '#fff',
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  kirim: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kirimMati: {
    opacity: 0.4,
  },
  tombolHati: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  hati: {
    position: 'absolute',
  },
  daftarKiriman: {
    alignSelf: 'flex-start',
    gap: 6,
  },
  // Spanduk gift TikTok: pil gelap memudar ke kanan, emoji menyembul, combo miring besar.
  spanduk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 300,
    padding: 3,
    borderRadius: Radius.pill,
    experimental_backgroundImage: 'linear-gradient(to right, rgba(15,18,16,0.75), rgba(15,18,16,0.15))',
  },
  avatarKiriman: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: Media.limau,
    backgroundColor: '#304036',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inisialKiriman: {
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 13,
  },
  teksSpanduk: {
    flexShrink: 1,
  },
  namaKiriman: {
    flexShrink: 1,
    color: '#fff',
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  ketKiriman: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: Fonts.regular,
    fontSize: 11.5,
  },
  emojiKiriman: {
    fontSize: 32,
    lineHeight: 38,
    marginVertical: -6,
  },
  combo: {
    paddingRight: 10,
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 24,
    fontStyle: 'italic',
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
    backgroundColor: 'rgba(184,243,74,0.16)',
  },
  emojiSorotan: {
    fontSize: 120,
    lineHeight: 140,
  },
  keteranganSorotan: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(15,18,16,0.7)',
  },
  teksSorotan: {
    color: '#fff',
    fontFamily: Fonts.semibold,
    fontSize: 14,
    textAlign: 'center',
  },
  namaSorotan: {
    color: Media.limau,
    fontFamily: Fonts.bold,
  },
  panelHadiah: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    backgroundColor: 'rgba(16,19,18,0.96)',
    gap: Spacing.three,
  },
  kepalaPanel: {
    gap: 2,
  },
  judulPanel: {
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 16,
  },
  ketPanel: {
    color: Media.redup,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
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
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selBesar: {
    borderColor: 'rgba(184,243,74,0.35)',
  },
  selDitekan: {
    transform: [{ scale: 0.92 }],
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  emojiSel: {
    fontSize: 34,
    lineHeight: 42,
  },
  namaSel: {
    color: '#fff',
    fontFamily: Fonts.medium,
    fontSize: 11.5,
  },
});
