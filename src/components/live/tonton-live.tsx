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
  Platform,
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
  menuKomentarLive,
  PanelHadiah,
  SorotanHadiah,
  useInteraksiLive,
} from '@/components/live/interaksi-live';
import { Tombol } from '@/components/tombol';
import { Fonts, Media, Radius, Spacing } from '@/constants/theme';
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
 * Warga menonton siaran publik warga lain, seperti menonton LIVE di TikTok:
 * video penuh, komentar, ketuk = hati, dan laci hadiah. Dimuat malas oleh
 * app/tonton/[ruang].tsx hanya di development build.
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
          <ActivityIndicator color="#fff" />
          <Text style={styles.teksRedup}>Membuka siaran {nama}…</Text>
        </>
      ) : (
        <>
          <Ionicons name={tahap.ulang ? 'cloud-offline-outline' : 'radio-outline'} size={56} color="rgba(255,255,255,0.5)" />
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.layar}>
      {kamera ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <VideoTrack trackRef={kamera} style={StyleSheet.absoluteFill} objectFit="cover" />
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tengah]}>
          <ActivityIndicator color="#fff" />
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
        <DaftarKomentar komentar={interaksi.komentar} onTekanLama={(k) => menuKomentarLive(k, ruang)} />
        {tamu ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/masuk', params: { alasan: 'untuk berkomentar dan memberi hadiah' } })}
            style={styles.ajakMasuk}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={Media.limau} />
            <Text style={styles.ajakMasukTeks}>Masuk untuk berkomentar, kirim hati, dan hadiah</Text>
          </Pressable>
        ) : (
          <KolomKomentar
            placeholder="Tulis komentar…"
            onKirim={interaksi.kirimKomentar}
            onHadiah={() => {
              Keyboard.dismiss();
              setPanelHadiah(true);
            }}
            onHati={() => interaksi.ketuk(width - 44, height * 0.7)}
          />
        )}
      </View>

      <LapisanHati hati={interaksi.hati} onSelesai={interaksi.hapusHati} />
      <SorotanHadiah sorotan={interaksi.sorotan} onSelesai={interaksi.hapusSorotan} />

      {status === ConnectionState.Reconnecting && (
        <View style={styles.selubung}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.selubungTeks}>Sinyal terputus — menyambung ulang…</Text>
        </View>
      )}

      <View style={[styles.atas, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
        <View style={styles.barisAtas}>
          <View style={styles.tuanRumah}>
            <View style={styles.cincinAvatar}>
              <View style={styles.avatar}>
                <Text style={styles.inisial}>{(namaTuan.trim()[0] ?? 'W').toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.fleks}>
              <Text style={styles.namaTuan} numberOfLines={1}>
                {namaTuan}
              </Text>
              <Text style={styles.judulKecil} numberOfLines={1}>
                {judul}
              </Text>
            </View>
          </View>
          <View style={styles.pil}>
            <Ionicons name="eye-outline" size={12} color="#fff" />
            <Text style={styles.pilTeks}>{penonton}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Laporkan siaran"
            onPress={() =>
              router.push({ pathname: '/laporkan', params: { jenis: 'siaran', id: ruang, ringkas: `${namaTuan}: ${judul}` } })
            }
            hitSlop={8}
            style={styles.tutup}>
            <Ionicons name="flag-outline" size={20} color="#fff" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup siaran"
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.tutup}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.barisStatus}>
          <View style={[styles.lencanaLive, !tersambung && styles.lencanaMenunggu]}>
            {tersambung && <View style={styles.titikLive} />}
            <Text style={styles.lencanaLiveTeks}>{tersambung ? 'LIVE' : 'MENGHUBUNGKAN'}</Text>
          </View>
          {mulai !== null && (
            <View style={styles.pil}>
              <Text style={styles.pilTeks}>{durasiTeks((kini - mulai) / 1000)}</Text>
            </View>
          )}
          {interaksi.jumlahSuka > 0 && (
            <View style={styles.pil}>
              <Ionicons name="heart" size={12} color={Media.limau} />
              <Text style={styles.pilTeks}>{interaksi.jumlahSuka}</Text>
            </View>
          )}
          {interaksi.jumlahHadiah > 0 && (
            <View style={styles.pil}>
              <Ionicons name="gift" size={12} color={Media.limau} />
              <Text style={styles.pilTeks}>{interaksi.jumlahHadiah}</Text>
            </View>
          )}
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
    backgroundColor: '#000',
  },
  tengah: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  fleks: {
    flex: 1,
  },
  lebar: {
    alignSelf: 'stretch',
    marginTop: Spacing.three,
  },
  lebarRapat: {
    alignSelf: 'stretch',
  },
  judulBesar: {
    color: '#fff',
    fontSize: 21,
    fontFamily: Fonts.judulTebal,
    textAlign: 'center',
  },
  teksRedup: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  areaKetuk: {
    flex: 1,
  },
  // Dalam alur biasa (bukan absolute) supaya ikut naik saat papan ketik muncul.
  bawah: {
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.55))',
  },
  // Sebentuk dengan kolom komentar, supaya tamu tahu di sini tempatnya.
  ajakMasuk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.27)',
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(13,17,14,0.42)',
  },
  ajakMasukTeks: {
    flex: 1,
    color: '#fff',
    fontFamily: Fonts.semibold,
    fontSize: 14,
  },
  atas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: Spacing.four,
    gap: 8,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0))',
  },
  barisAtas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Pil tuan rumah ala TikTok: avatar bercincin merah, nama, judul.
  tuanRumah: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 12,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cincinAvatar: {
    padding: 2,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Media.merah,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#304036',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inisial: {
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 13,
  },
  namaTuan: {
    color: '#fff',
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  judulKecil: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: Fonts.regular,
    fontSize: 11.5,
  },
  tutup: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barisStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  lencanaLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: Media.merah,
  },
  lencanaMenunggu: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  lencanaLiveTeks: {
    color: '#fff',
    fontSize: 11,
    fontFamily: Fonts.judulTebal,
    letterSpacing: 0.8,
  },
  titikLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  pil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pilTeks: {
    color: '#fff',
    fontSize: 11.5,
    fontFamily: Fonts.semibold,
    fontVariant: ['tabular-nums'],
  },
  selubung: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  selubungTeks: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.semibold,
  },
});
