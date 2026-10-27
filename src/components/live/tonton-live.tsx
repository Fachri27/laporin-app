import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AudioSession,
  isTrackReference,
  LiveKitRoom,
  useConnectionState,
  useRemoteParticipants,
  useTracks,
  VideoTrack,
} from '@livekit/react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { ConnectionState, DisconnectReason, Track } from 'livekit-client';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DaftarKiriman,
  DaftarKomentar,
  KolomKomentar,
  LapisanHati,
  LencanaLive,
  menuKomentarLive,
  PanelHadiah,
  PilLive,
  SorotanHadiah,
  TombolSamping,
  useInteraksiLive,
} from '@/components/live/interaksi-live';
import { Tombol } from '@/components/tombol';
import { Fonts, gradasi, Media, SINYAL, Spacing, TINTA, TULANG } from '@/constants/theme';
import { useKini } from '@/hooks/use-kini';
import { tokenSesi, useAkun } from '@/lib/akun';
import { durasiTeks } from '@/lib/batas-laporan';
import { AWALAN_PELAPOR, mintaTiketTonton } from '@/lib/live';

type Props = {
  ruang: string;
  /** Dari kartu beranda, supaya kepala layar langsung terisi sebelum tersambung. */
  judul: string;
  nama: string;
  mulai: number | null;
};

type Tahap =
  | { jenis: 'memuat' }
  /** `tamu`: tiket diminta tanpa akun — hanya menonton, tanpa komentar/hati/hadiah. */
  | { jenis: 'tonton'; url: string; token: string; tamu: boolean }
  /** `ulang`: putus karena jaringan/server, bukan siarannya usai — tawarkan sambung lagi. */
  | { jenis: 'selesai'; pesan: string; ulang: boolean };

/** Pelapor tidak muncul selama ini setelah tersambung = siarannya sudah usai. */
const TUNGGU_PELAPOR_MS = 5000;

/**
 * Warga menonton siaran publik warga lain (artboard "Live broadcast"): video penuh, lencana
 * LIVE · durasi · penonton · tutup di atas, pembawa siaran di bawahnya, komentar di kiri bawah
 * dengan tombol bulat hati / hadiah / laporkan di sampingnya, lalu kolom komentar. Ketuk video
 * = hati. Dimuat malas oleh app/tonton/[ruang].tsx hanya di development build.
 */
export default function TontonLive({ ruang, judul, nama, mulai }: Props) {
  const insets = useSafeAreaInsets();
  const [tahap, setTahap] = useState<Tahap>({ jenis: 'memuat' });
  const [percobaan, setPercobaan] = useState(0);
  const { status: statusAkun } = useAkun();
  const tamu = statusAkun !== 'masuk';

  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  // Tiket diminta setelah sesi tersimpan terbaca, dan diminta ulang bila warga
  // masuk/keluar di tengah menonton (tiket tamu tidak boleh berkomentar).
  useEffect(() => {
    if (statusAkun === 'memuat') return;
    let batal = false;
    void mintaTiketTonton(ruang, tamu ? null : tokenSesi()).then((h) => {
      if (batal) return;
      setTahap(h.ok ? { jenis: 'tonton', ...h.tiket, tamu } : { jenis: 'selesai', pesan: h.galat, ulang: h.ulang });
    });
    return () => {
      batal = true;
    };
  }, [ruang, statusAkun, tamu, percobaan]);

  const berakhir = useCallback(() => setTahap({ jenis: 'selesai', pesan: 'Siaran sudah berakhir.', ulang: false }), []);

  // Ruang dihapus/ditutup atau kita dikeluarkan = siaran memang usai. Selain
  // itu (sinyal hilang lebih lama dari jendela sambung ulang) pelapor bisa
  // jadi masih siaran.
  const putus = useCallback(
    (alasan?: DisconnectReason) => {
      if (
        alasan === DisconnectReason.ROOM_DELETED ||
        alasan === DisconnectReason.ROOM_CLOSED ||
        alasan === DisconnectReason.PARTICIPANT_REMOVED
      ) {
        berakhir();
      } else {
        setTahap({ jenis: 'selesai', pesan: 'Koneksi ke siaran terputus.', ulang: true });
      }
    },
    [berakhir],
  );

  function sambungLagi() {
    setTahap({ jenis: 'memuat' });
    setPercobaan((n) => n + 1);
  }

  if (tahap.jenis === 'tonton' && tahap.tamu === tamu) {
    return (
      <LiveKitRoom
        serverUrl={tahap.url}
        token={tahap.token}
        connect
        audio={false}
        video={false}
        options={{ adaptiveStream: true }}
        onDisconnected={putus}
        onError={() => setTahap({ jenis: 'selesai', pesan: 'Siaran tidak bisa diputar.', ulang: true })}>
        <RuangTonton ruang={ruang} judul={judul} nama={nama} mulai={mulai} tamu={tahap.tamu} onBerakhir={berakhir} />
      </LiveKitRoom>
    );
  }

  return (
    <View style={[styles.layar, styles.tengah, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four }]}>
      {tahap.jenis !== 'selesai' ? (
        // Termasuk tiket lama yang menunggu diganti setelah warga masuk/keluar.
        <>
          <ActivityIndicator color={TULANG} />
          <Text style={styles.teksRedup}>Membuka siaran {nama}…</Text>
        </>
      ) : (
        <>
          <Ionicons name={tahap.ulang ? 'cloud-offline-outline' : 'radio-outline'} size={56} color="rgba(237,232,223,0.5)" />
          <Text style={styles.judulBesar}>{tahap.pesan}</Text>
          <Text style={styles.teksRedup} numberOfLines={2}>
            {judul}
          </Text>
          {tahap.ulang && <Tombol judul="Sambungkan lagi" besar onPress={sambungLagi} style={styles.lebar} />}
          <Tombol
            judul="Kembali ke beranda"
            ragam={tahap.ulang ? 'teks' : 'primer'}
            besar
            onPress={() => router.back()}
            style={tahap.ulang ? styles.lebarRapat : styles.lebar}
          />
        </>
      )}
    </View>
  );
}

function RuangTonton({
  ruang,
  judul,
  nama,
  mulai,
  tamu,
  onBerakhir,
}: {
  ruang: string;
  judul: string;
  nama: string;
  mulai: number | null;
  /** Tanpa akun: hanya menonton; kolom komentar diganti ajakan masuk. */
  tamu: boolean;
  onBerakhir: () => void;
}) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const status = useConnectionState();
  const peserta = useRemoteParticipants();
  const pelapor = peserta.find((p) => p.identity.startsWith(AWALAN_PELAPOR));
  const kamera = useTracks([Track.Source.Camera]).find(
    (t) => t.participant.identity.startsWith(AWALAN_PELAPOR) && isTrackReference(t),
  );
  const interaksi = useInteraksiLive();
  const kini = useKini(1000);
  const [panelHadiah, setPanelHadiah] = useState(false);
  const [pernahAda, setPernahAda] = useState(false);
  if (pelapor && !pernahAda) setPernahAda(true);

  // Pelapor keluar (atau sudah keluar sebelum kita masuk) = siaran selesai.
  useEffect(() => {
    if (status !== ConnectionState.Connected || pelapor) return;
    const id = setTimeout(onBerakhir, pernahAda ? 0 : TUNGGU_PELAPOR_MS);
    return () => clearTimeout(id);
  }, [status, pelapor, pernahAda, onBerakhir]);

  const tersambung = status === ConnectionState.Connected;
  const namaTuan = pelapor?.name || nama;
  // Semua peserta selain pelapor adalah penonton, termasuk kita sendiri.
  const penonton = peserta.length - (pelapor ? 1 : 0) + 1;

  return (
    // padding di kedua platform: Android edge-to-edge tidak lagi mengecilkan jendela saat keyboard muncul.
    <KeyboardAvoidingView behavior="padding" style={styles.layar}>
      {kamera ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <VideoTrack trackRef={kamera} style={StyleSheet.absoluteFill} objectFit="cover" />
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tengah]}>
          <ActivityIndicator color={TULANG} />
          <Text style={styles.teksRedup}>{tersambung ? 'Menunggu video dari pelapor…' : 'Menyambungkan…'}</Text>
        </View>
      )}

      {/* Ketuk di mana saja di video = kirim hati, seperti LIVE di TikTok. Tamu hanya menonton. */}
      <Pressable
        accessibilityLabel={tamu ? undefined : 'Ketuk untuk mengirim hati'}
        style={styles.areaKetuk}
        onPress={(e) => {
          Keyboard.dismiss();
          if (!tamu) interaksi.ketuk(e.nativeEvent.locationX, e.nativeEvent.locationY);
        }}
      />

      <View style={[styles.bawah, { paddingBottom: insets.bottom + Spacing.three }]}>
        <DaftarKiriman kiriman={interaksi.kiriman} onSelesai={interaksi.hapusKiriman} />
        <View style={styles.barisKomentar}>
          <View style={styles.fleks}>
            <DaftarKomentar komentar={interaksi.komentar} onTekanLama={(k) => menuKomentarLive(k, ruang)} />
          </View>
          <View style={styles.samping}>
            {!tamu && (
              <>
                <TombolSamping
                  ikon="heart"
                  warna={SINYAL}
                  label="Kirim hati"
                  angka={interaksi.jumlahSuka}
                  onPress={() => interaksi.ketuk(width - 44, height * 0.6)}
                />
                <TombolSamping
                  ikon="gift-outline"
                  label="Kirim hadiah"
                  angka={interaksi.jumlahHadiah}
                  onPress={() => {
                    Keyboard.dismiss();
                    setPanelHadiah(true);
                  }}
                />
              </>
            )}
            <TombolSamping
              ikon="flag-outline"
              label="Laporkan siaran"
              onPress={() =>
                router.push({ pathname: '/laporkan', params: { jenis: 'siaran', id: ruang, ringkas: `${namaTuan}: ${judul}` } })
              }
            />
          </View>
        </View>
        {tamu ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/masuk', params: { alasan: 'untuk berkomentar dan memberi hadiah' } })}
            style={({ pressed }) => [styles.ajakMasuk, pressed && styles.ditekan]}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={SINYAL} />
            <Text style={styles.ajakMasukTeks}>Masuk untuk berkomentar, kirim hati, dan hadiah</Text>
          </Pressable>
        ) : (
          <KolomKomentar placeholder="Tanya atau kabarkan keadaan…" onKirim={interaksi.kirimKomentar} />
        )}
      </View>

      <LapisanHati hati={interaksi.hati} onSelesai={interaksi.hapusHati} />
      <SorotanHadiah sorotan={interaksi.sorotan} onSelesai={interaksi.hapusSorotan} />

      {status === ConnectionState.Reconnecting && (
        <View style={styles.selubung}>
          <ActivityIndicator color={TULANG} />
          <Text style={styles.selubungTeks}>Sinyal terputus — menyambung ulang…</Text>
        </View>
      )}

      <View style={[styles.atas, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
        <View style={styles.barisAtas}>
          <LencanaLive tersambung={tersambung} />
          {mulai !== null && <PilLive teks={durasiTeks((kini - mulai) / 1000)} besar />}
          <View style={styles.fleks} />
          <PilLive ikon="eye-outline" teks={String(penonton)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup siaran"
            onPress={() => router.back()}
            hitSlop={6}
            style={({ pressed }) => [styles.tutup, pressed && styles.ditekan]}>
            <Ionicons name="close" size={20} color={TULANG} />
          </Pressable>
        </View>

        <View style={styles.tuanRumah}>
          <View style={styles.avatar}>
            <Text style={styles.inisial}>{(namaTuan.trim()[0] ?? 'W').toUpperCase()}</Text>
          </View>
          <View style={styles.fleks}>
            <Text style={styles.namaTuan} numberOfLines={1}>
              {namaTuan}
            </Text>
            <Text style={styles.judulKecil} numberOfLines={1}>
              {judul.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {panelHadiah && !tamu && (
        <PanelHadiah onKirim={interaksi.kirimHadiah} onTutup={() => setPanelHadiah(false)} bawah={insets.bottom} />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  layar: {
    flex: 1,
    backgroundColor: Media.latar,
  },
  tengah: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  fleks: {
    flex: 1,
    minWidth: 0,
  },
  ditekan: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  lebar: {
    alignSelf: 'stretch',
    marginTop: Spacing.three,
  },
  lebarRapat: {
    alignSelf: 'stretch',
  },
  judulBesar: {
    color: TULANG,
    fontFamily: Fonts.judulTebal,
    fontSize: 21,
    lineHeight: 26,
    textAlign: 'center',
  },
  teksRedup: {
    color: Media.redup,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  areaKetuk: {
    flex: 1,
  },
  // Dalam alur biasa (bukan absolute) supaya ikut naik saat papan ketik muncul. Selubung tinta
  // di bawah, seperti desain, supaya komentar terbaca di atas video apa pun.
  bawah: {
    paddingTop: 40,
    paddingLeft: 16,
    paddingRight: 12,
    gap: 14,
    ...gradasi('linear-gradient(to bottom, rgba(12,14,13,0), rgba(12,14,13,0.8) 35%)'),
  },
  barisKomentar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  samping: {
    alignItems: 'center',
    gap: 10,
  },
  // Sebentuk dengan kolom komentar, supaya tamu tahu di sini tempatnya.
  ajakMasuk: {
    minHeight: 52,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: Media.garis,
    borderRadius: 26,
    backgroundColor: Media.kaca,
  },
  ajakMasukTeks: {
    flex: 1,
    color: TULANG,
    fontFamily: Fonts.semibold,
    fontSize: 14,
  },
  atas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingLeft: 16,
    paddingRight: 12,
    paddingBottom: Spacing.four,
    gap: 14,
    ...gradasi('linear-gradient(to bottom, rgba(12,14,13,0.55), rgba(12,14,13,0))'),
  },
  barisAtas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tutup: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Media.kaca,
  },
  tuanRumah: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Pembawa siaran: lingkaran tulang berinisial tinta.
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TULANG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inisial: {
    color: TINTA,
    fontFamily: Fonts.tebal,
    fontSize: 13,
  },
  namaTuan: {
    color: TULANG,
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  judulKecil: {
    marginTop: 1,
    color: Media.redup,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  selubung: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12,14,13,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  selubungTeks: {
    color: TULANG,
    fontSize: 15,
    fontFamily: Fonts.semibold,
  },
});
