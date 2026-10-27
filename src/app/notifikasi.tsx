import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BilahAtas } from '@/components/bilah-atas';
import { Tombol } from '@/components/tombol';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { bukaLaporan } from '@/lib/aksi-laporan';
import { useAkun } from '@/lib/akun';
import { muatKabar, tandaiDibaca, useKabar, type Kabar } from '@/lib/notifikasi';
import { waktuLalu } from '@/lib/waktu';

type Nada = 'aman' | 'tunggu' | 'tolak';

const ISI: Record<Kabar['status'], { ikon: ComponentProps<typeof Feather>['name']; nada: Nada; judul: string }> = {
  tayang: { ikon: 'check', nada: 'aman', judul: 'Laporanmu terverifikasi' },
  menunggu: { ikon: 'clock', nada: 'tunggu', judul: 'Laporanmu sedang ditinjau' },
  ditolak: { ikon: 'x', nada: 'tolak', judul: 'Laporanmu tidak ditayangkan' },
};

/** Awal hari ini (waktu HP) — pemisah "Hari ini" dan "Sebelumnya". */
function awalHariIni(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Notifikasi, dibuka dari lonceng di beranda: kabar status laporan milik akun ini
 * (lib/notifikasi.ts). Tiap kabar = lingkaran ikon status, judul, laporan, waktu kapital kecil;
 * yang belum dibaca bertitik sinyal. Mengetuk kabar yang sudah tayang membuka laporannya.
 */
export default function LayarNotifikasi() {
  const w = useTheme();
  const akun = useAkun();
  const { status, kabar, belumDibaca } = useKabar();
  const idAkun = akun.status === 'masuk' ? akun.pengguna?.id : undefined;

  useFocusEffect(
    useCallback(() => {
      if (idAkun) void muatKabar(idAkun);
    }, [idAkun]),
  );

  const batas = awalHariIni();
  const hariIni = kabar.filter((k) => Date.parse(k.dibuat) >= batas);
  const sebelumnya = kabar.filter((k) => Date.parse(k.dibuat) < batas);

  let isi;
  if (akun.status !== 'masuk') {
    isi = (
      <Kosong ikon="bell" judul="Masuk untuk melihat kabar laporanmu" teks="Kabar saat laporanmu ditinjau dan terverifikasi tampil di sini.">
        <Tombol judul="Masuk" onPress={() => router.push({ pathname: '/masuk', params: { alasan: 'untuk melihat kabar laporanmu' } })} />
      </Kosong>
    );
  } else if (kabar.length === 0) {
    isi =
      status === 'memuat' || status === 'kosong' ? (
        <ActivityIndicator color={w.accentText} style={styles.pemuat} />
      ) : status === 'galat' ? (
        <Kosong ikon="wifi-off" judul="Gagal memuat notifikasi" teks="Periksa koneksi lalu coba lagi.">
          <Tombol judul="Coba lagi" ragam="teks" onPress={() => idAkun && void muatKabar(idAkun)} />
        </Kosong>
      ) : (
        <Kosong ikon="bell" judul="Belum ada kabar" teks="Kabar saat laporanmu ditinjau dan terverifikasi tampil di sini." />
      );
  } else {
    isi = (
      <ScrollView contentContainerStyle={styles.daftar}>
        {hariIni.length > 0 && <Label teks="HARI INI" />}
        {hariIni.map((k) => (
          <BarisKabar key={k.id} kabar={k} />
        ))}
        {sebelumnya.length > 0 && <Label teks="SEBELUMNYA" />}
        {sebelumnya.map((k) => (
          <BarisKabar key={k.id} kabar={k} />
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.layar, { backgroundColor: w.background }]}>
      <BilahAtas judul="Notifikasi" onKembali={() => router.back()}>
        {belumDibaca > 0 && (
          <Pressable accessibilityRole="button" onPress={tandaiDibaca} hitSlop={8} style={styles.tandai}>
            <Text style={[styles.teksTandai, { color: w.accentText }]}>TANDAI DIBACA</Text>
          </Pressable>
        )}
      </BilahAtas>
      {isi}
    </View>
  );
}

function Label({ teks }: { teks: string }) {
  const w = useTheme();
  return <Text style={[styles.label, { color: w.textSecondary }]}>{teks}</Text>;
}

function BarisKabar({ kabar: k }: { kabar: Kabar }) {
  const w = useTheme();
  const isi = ISI[k.status];
  const warna = { aman: [w.success, w.successSoft], tunggu: [w.warning, w.warningSoft], tolak: [w.accent, w.accentSoft] }[isi.nada];
  const bisaDibuka = k.beritaId !== null;
  return (
    <Pressable
      accessibilityRole={bisaDibuka ? 'button' : undefined}
      accessibilityLabel={`${k.baru ? 'Baru. ' : ''}${isi.judul}: ${k.judul}`}
      disabled={!bisaDibuka}
      onPress={() => k.beritaId !== null && bukaLaporan(k.beritaId)}
      style={({ pressed }) => [styles.baris, { borderBottomColor: w.border }, pressed && styles.ditekan]}>
      {/* Lingkaran ikon berwarna status, bergaris tipis seperti tombol ikon lain. */}
      <View style={[styles.simbol, { backgroundColor: warna[1], borderColor: w.border }]}>
        <Feather name={isi.ikon} size={19} color={warna[0]} />
      </View>
      <View style={styles.fleks}>
        <Text style={[styles.judul, { color: w.text }]}>{isi.judul}</Text>
        <Text style={[styles.teks, { color: w.textSecondary }]} numberOfLines={2}>
          {k.judul}
        </Text>
        <Text style={[styles.waktu, { color: w.textSecondary }]}>{waktuLalu(Date.parse(k.dibuat)).toUpperCase()}</Text>
      </View>
      {/* Yang baru cukup ditandai titik sinyal. */}
      {k.baru ? (
        <View style={[styles.titik, { backgroundColor: w.accent }]} />
      ) : (
        bisaDibuka && <Feather name="chevron-right" size={17} color={w.textSecondary} style={styles.panah} />
      )}
    </Pressable>
  );
}

function Kosong({
  ikon,
  judul,
  teks,
  children,
}: {
  ikon: ComponentProps<typeof Feather>['name'];
  judul: string;
  teks: string;
  children?: ReactNode;
}) {
  const w = useTheme();
  return (
    <View style={styles.kosong}>
      <View style={[styles.ikonKosong, { backgroundColor: w.surface, borderColor: w.border }]}>
        <Feather name={ikon} size={26} color={w.textSecondary} />
      </View>
      <Text style={[styles.judulKosong, { color: w.text }]}>{judul}</Text>
      <Text style={[styles.teksKosong, { color: w.textSecondary }]}>{teks}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
  },
  fleks: {
    flex: 1,
    minWidth: 0,
  },
  ditekan: {
    opacity: 0.75,
  },
  tandai: {
    paddingHorizontal: 6,
  },
  teksTandai: {
    fontFamily: Fonts.monoTebal,
    fontSize: 10.5,
    letterSpacing: 0.5,
  },
  pemuat: {
    marginTop: 48,
  },
  daftar: {
    paddingBottom: 24,
  },
  // Pemisah kelompok: label mono abu.
  label: {
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 4,
    fontFamily: Fonts.monoTebal,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  // Baris bergaris bawah.
  baris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  simbol: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  judul: {
    fontFamily: Fonts.bold,
    fontSize: 14.5,
  },
  teks: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  waktu: {
    marginTop: 5,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  titik: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  panah: {
    marginLeft: -2,
  },
  kosong: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 36,
    gap: 8,
  },
  ikonKosong: {
    width: 64,
    height: 64,
    marginBottom: 8,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  judulKosong: {
    fontFamily: Fonts.judulTebal,
    fontSize: 22,
    lineHeight: 27,
    textAlign: 'center',
  },
  teksKosong: {
    marginBottom: 10,
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
});
