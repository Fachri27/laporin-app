import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AudioSession,
  isTrackReference,
  LiveKitRoom,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from '@livekit/react-native';
import { mediaDevices } from '@livekit/react-native-webrtc';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import {
  ConnectionQuality,
  ConnectionState,
  RoomEvent,
  Track,
  VideoPresets,
  type Participant,
  type RemoteParticipant,
} from 'livekit-client';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
  PilLive,
  SorotanHadiah,
  TombolSamping,
  useInteraksiLive,
} from '@/components/live/interaksi-live';
import { PersiapanLive, SiaranSelesai } from '@/components/live/persiapan-live';
import { TitikLive } from '@/components/titik-live';
import { Fonts, gradasi, Media, SINYAL, Spacing, TINTA, TULANG } from '@/constants/theme';
import { useKini } from '@/hooks/use-kini';
import { tokenSesi, useAkun } from '@/lib/akun';
import { durasiTeks } from '@/lib/batas-laporan';
import { useDraf } from '@/lib/draf-laporan';
import { AWALAN_PETUGAS, mintaTiketSiaran, TOPIK_LOKASI, type TiketSiaran } from '@/lib/live';
import { ambilPosisi, koordinatTeks, masihSegar, useLokasiLive, type PosisiLive } from '@/lib/lokasi-live';

/** GPS dikirim ke penonton paling sering tiap 5 detik — cukup untuk orang berjalan kaki. */
const JEDA_KIRIM_GPS_MS = 5000;
/**
 * Posisi lebih tua dari ini (mis. sisa sesi GPS sebelumnya) tidak dikirim
 * sebagai titik siaran: petugas bisa diarahkan ke tempat yang salah.
 */
const BATAS_SEGAR_GPS_MS = 2 * 60_000;

const PESAN_IZIN_MEDIA = 'Kamera atau mikrofon tidak bisa dipakai. Periksa izinnya di Pengaturan HP lalu coba lagi.';
const PESAN_GAGAL_SAMBUNG = 'Gagal menyambung ke server siaran. Periksa koneksi lalu coba lagi.';
const PESAN_GAGAL_KAMERA = 'Kamera tidak bisa dinyalakan. Tutup aplikasi lain yang memakai kamera lalu coba lagi.';

type Tahap =
  | { jenis: 'siap' }
  | { jenis: 'menghubungkan' }
  /** `suara`: izin mikrofon diberikan; tanpa itu siaran tetap jalan, hanya video. */
  | { jenis: 'live'; tiket: TiketSiaran; mulai: number; publik: boolean; suara: boolean }
  | { jenis: 'selesai'; durasi: number; terputus: boolean };

/**
 * Siaran langsung ke petugas lewat LiveKit. Dimuat malas oleh app/live.tsx
 * hanya di development build, karena impor LiveKit di Expo Go langsung crash.
 */
export default function SiaranLive() {
  const draf = useDraf();
  const akun = useAkun();
  const [, mintaIzinKamera] = useCameraPermissions();
  const [, mintaIzinMikrofon] = useMicrophonePermissions();
  const [tahap, setTahap] = useState<Tahap>({ jenis: 'siap' });
  const [galat, setGalat] = useState('');
  /** Izin ditolak permanen: hanya bisa diubah dari Pengaturan HP. */
  const [kePengaturan, setKePengaturan] = useState(false);
  // Bawaan: hanya petugas. Warga lain menonton hanya bila pelapor memilihnya sendiri.
  const [publik, setPublik] = useState(false);
  // Siaran publik wajib akun dan tidak anonim, supaya penyiarnya bisa ditindak bila melanggar.
  const masuk = akun.status === 'masuk';
  const publikAktif = publik && masuk && !draf.anonim;
  /** Gagal sebelum tersambung = siaran belum mulai; setelahnya = siaran terputus. */
  const fase = useRef<'menyambung' | 'tersambung' | 'usai'>('menyambung');

  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  async function mulai() {
    if (!draf.judul.trim()) return setGalat('Tulis singkat apa yang sedang terjadi.');
    setGalat('');
    setKePengaturan(false);
    setTahap({ jenis: 'menghubungkan' });

    // Izin diminta sebelum ruang dibuat: penolakan tidak menghabiskan jatah
    // siaran dan bisa diarahkan ke Pengaturan.
    const kamera = await mintaIzinKamera().catch(() => null);
    if (!kamera?.granted) {
      const permanen = kamera?.canAskAgain === false;
      setGalat(permanen ? 'Izin kamera ditolak. Izinkan kamera di Pengaturan HP untuk siaran.' : 'Siaran butuh izin kamera.');
      setKePengaturan(permanen);
      setTahap({ jenis: 'siap' });
      return;
    }
    // Mikrofon ditolak: siaran tetap jalan, hanya video.
    const mikrofon = await mintaIzinMikrofon().catch(() => null);

    const posisi = ambilPosisi();
    const titik = draf.titik ?? (masihSegar(posisi, Date.now(), BATAS_SEGAR_GPS_MS) ? posisi : null);
    const hasil = await mintaTiketSiaran({
      judul: draf.judul,
      nama: draf.nama,
      anonim: draf.anonim,
      titik,
      publik: publikAktif,
      token: draf.anonim ? null : tokenSesi(),
    });
    if (!hasil.ok) {
      setGalat(hasil.galat);
      setTahap({ jenis: 'siap' });
      return;
    }
    fase.current = 'menyambung';
    setTahap({ jenis: 'live', tiket: hasil.tiket, mulai: Date.now(), publik: publikAktif, suara: mikrofon?.granted === true });
  }

  function akhiri(terputus: boolean) {
    fase.current = 'usai';
    setTahap((t) => (t.jenis === 'live' ? { jenis: 'selesai', durasi: (Date.now() - t.mulai) / 1000, terputus } : t));
  }

  /** onError/onDisconnected LiveKit; bisa datang berdua untuk satu kegagalan. */
  function gagal(e?: Error) {
    if (fase.current === 'usai') return;
    if (fase.current === 'tersambung') {
      if (e) setGalat(`Siaran gagal: ${e.message}`);
      akhiri(true);
      return;
    }
    // Belum pernah tersambung: kembali ke persiapan supaya bisa dicoba lagi.
    fase.current = 'usai';
    const izin = e !== undefined && /permission|notallowed/i.test(`${e.name} ${e.message}`);
    // Tanpa galat (putus) atau ConnectionError = server; selain itu dari kamera/mikrofon.
    const sambung = e === undefined || e.name === 'ConnectionError';
    setGalat(izin ? PESAN_IZIN_MEDIA : sambung ? PESAN_GAGAL_SAMBUNG : PESAN_GAGAL_KAMERA);
    setKePengaturan(izin);
    setTahap({ jenis: 'siap' });
  }

  function ubahPublik(nyala: boolean) {
    if (masuk) return setPublik(nyala);
    router.push({ pathname: '/masuk', params: { alasan: 'untuk menampilkan siaran di beranda warga' } });
  }

  if (tahap.jenis === 'live') {
    return (
      <LiveKitRoom
        serverUrl={tahap.tiket.url}
        token={tahap.tiket.token}
        connect
        audio={tahap.suara}
        // Kamera belakang, 540p: cukup jelas untuk asap/api, masih kuat di 4G yang lemah.
        video={{ facingMode: 'environment', resolution: VideoPresets.h540.resolution }}
        options={{ dynacast: true, publishDefaults: { simulcast: true } }}
        onConnected={() => {
          if (fase.current === 'menyambung') fase.current = 'tersambung';
        }}
        onDisconnected={() => gagal()}
        onError={(e) => gagal(e)}>
        <RuangSiaran mulai={tahap.mulai} publik={tahap.publik} onAkhiri={() => akhiri(false)} />
      </LiveKitRoom>
    );
  }

  if (tahap.jenis === 'selesai') {
    return <SiaranSelesai durasi={tahap.durasi} terputus={tahap.terputus} galat={galat} />;
  }

  return (
    <PersiapanLive
      menghubungkan={tahap.jenis === 'menghubungkan'}
      galat={galat}
      kePengaturan={kePengaturan}
      publikAktif={publikAktif}
      masuk={masuk}
      akunMemuat={akun.status === 'memuat'}
      batasSegarGpsMs={BATAS_SEGAR_GPS_MS}
      onUbahPublik={ubahPublik}
      onMulai={() => void mulai()}
    />
  );
}

function RuangSiaran({ mulai, publik, onAkhiri }: { mulai: number; publik: boolean; onAkhiri: () => void }) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const status = useConnectionState();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const penonton = useRemoteParticipants().length;
  const kamera = useTracks([Track.Source.Camera], { onlySubscribed: false }).find(
    (t) => t.participant.isLocal && isTrackReference(t),
  );
  const { posisi } = useLokasiLive();
  const kini = useKini(500);
  const [kualitas, setKualitas] = useState<ConnectionQuality>(ConnectionQuality.Unknown);
  const [depan, setDepan] = useState(false);
  const kirimGpsTerakhir = useRef(0);
  const posisiTerkini = useRef<PosisiLive | null>(null);
  const interaksi = useInteraksiLive();
  const draf = useDraf();
  const { width: lebarLayar, height: tinggiLayar } = useWindowDimensions();

  useEffect(() => {
    const ubah = (q: ConnectionQuality, p: Participant) => {
      if (p.isLocal) setKualitas(q);
    };
    room.on(RoomEvent.ConnectionQualityChanged, ubah);
    return () => {
      room.off(RoomEvent.ConnectionQualityChanged, ubah);
    };
  }, [room]);

  useEffect(() => {
    posisiTerkini.current = posisi;
  }, [posisi]);

  // Posisi live ke penonton lewat atribut peserta (butuh izin canUpdateOwnMetadata di token).
  // Siaran publik ditonton warga mana pun: atributnya hanya perkiraan (~1 km), tanpa akurasi.
  useEffect(() => {
    if (!posisi || status !== ConnectionState.Connected) return;
    const sekarang = Date.now();
    if (!masihSegar(posisi, sekarang, BATAS_SEGAR_GPS_MS)) return;
    if (sekarang - kirimGpsTerakhir.current < JEDA_KIRIM_GPS_MS) return;
    kirimGpsTerakhir.current = sekarang;
    localParticipant
      .setAttributes({
        lat: posisi.lat.toFixed(publik ? 2 : 6),
        lng: posisi.lng.toFixed(publik ? 2 : 6),
        akurasi: !publik && posisi.akurasi != null ? String(Math.round(posisi.akurasi)) : '',
        waktu: String(posisi.waktu),
      })
      .catch(() => {});
  }, [posisi, status, localParticipant, publik]);

  // Siaran publik: titik persis hanya ke petugas, lewat text stream bertujuan
  // (topik lokasi) — berkala, dan segera begitu petugas baru bergabung.
  useEffect(() => {
    if (!publik || status !== ConnectionState.Connected) return;
    const kirim = (tujuan: string[]) => {
      const p = posisiTerkini.current;
      if (!p || tujuan.length === 0 || !masihSegar(p, Date.now(), BATAS_SEGAR_GPS_MS)) return;
      const isi = JSON.stringify({ lat: p.lat, lng: p.lng, akurasi: p.akurasi, waktu: p.waktu });
      localParticipant.sendText(isi, { topic: TOPIK_LOKASI, destinationIdentities: tujuan }).catch(() => {});
    };
    const semuaPetugas = () => [...room.remoteParticipants.keys()].filter((id) => id.startsWith(AWALAN_PETUGAS));
    const bergabung = (p: RemoteParticipant) => {
      if (p.identity.startsWith(AWALAN_PETUGAS)) kirim([p.identity]);
    };
    kirim(semuaPetugas());
    const id = setInterval(() => kirim(semuaPetugas()), JEDA_KIRIM_GPS_MS);
    room.on(RoomEvent.ParticipantConnected, bergabung);
    return () => {
      clearInterval(id);
      room.off(RoomEvent.ParticipantConnected, bergabung);
    };
  }, [publik, status, room, localParticipant]);

  function ubahMikrofon() {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => {
      // Izin mikrofon ditolak saat persiapan: siaran berjalan tanpa suara.
      Alert.alert('Mikrofon tidak bisa dinyalakan', 'Izinkan mikrofon untuk aplikasi ini di Pengaturan HP.', [
        { text: 'Tutup', style: 'cancel' },
        { text: 'Buka Pengaturan', onPress: () => void Linking.openSettings() },
      ]);
    });
  }

  async function balikKamera() {
    const arah = depan ? 'environment' : 'front';
    const perangkat = (await mediaDevices.enumerateDevices()) as { kind: string; deviceId: string; facing?: string }[];
    const cocok = perangkat.find((d) => d.kind === 'videoinput' && d.facing === arah);
    if (cocok && (await room.switchActiveDevice('videoinput', cocok.deviceId))) setDepan(!depan);
  }

  // Tombol back Android tidak boleh memutus siaran diam-diam.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      tanyaAkhiri(onAkhiri);
      return true;
    });
    return () => sub.remove();
  }, [onAkhiri]);

  const tersambung = status === ConnectionState.Connected;
  const gpsLive = masihSegar(posisi, kini);
  // Yang tampil = yang terkirim: posisi basi tidak ditunjukkan sebagai lokasi siaran.
  const posisiTampil = masihSegar(posisi, kini, BATAS_SEGAR_GPS_MS) ? posisi : null;

  return (
    // padding di kedua platform: Android edge-to-edge tidak lagi mengecilkan jendela saat keyboard
    // muncul, jadi kolom komentar harus didorong naik sendiri — sama seperti di iOS.
    <KeyboardAvoidingView behavior="padding" style={styles.layar}>
      {kamera ? (
        // pointerEvents="none": tampilan video native tidak boleh menelan ketukan "hati".
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <VideoTrack trackRef={kamera} style={StyleSheet.absoluteFill} objectFit="cover" mirror={depan} />
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tengah]}>
          <ActivityIndicator color={TULANG} />
          <Text style={styles.teksRedup}>Menyalakan kamera…</Text>
        </View>
      )}

      {/* Ketuk di mana saja di video = kirim hati, seperti siaran TikTok. */}
      <Pressable
        accessibilityLabel="Ketuk untuk mengirim hati"
        style={styles.areaKetuk}
        onPress={(e) => {
          Keyboard.dismiss();
          interaksi.ketuk(e.nativeEvent.locationX, e.nativeEvent.locationY);
        }}
      />

      <View style={[styles.bawah, { paddingBottom: insets.bottom + Spacing.three }]}>
        <DaftarKiriman kiriman={interaksi.kiriman} onSelesai={interaksi.hapusKiriman} />
        <View style={styles.barisKomentar}>
          <View style={styles.fleks}>
            {/* Pelapor hanya bisa memblokir; melaporkan komentar dari sisi penonton. */}
            <DaftarKomentar komentar={interaksi.komentar} onTekanLama={(k) => menuKomentarLive(k, null)} />
          </View>
          <TombolSamping
            ikon="heart"
            warna={SINYAL}
            label="Kirim hati"
            angka={interaksi.jumlahSuka}
            onPress={() => interaksi.ketuk(lebarLayar - 44, tinggiLayar * 0.6)}
          />
        </View>

        <KolomKomentar
          // Siaran publik juga ditonton warga; komentar bukan hanya dari/untuk petugas.
          placeholder={publik ? 'Tulis komentar…' : undefined}
          onKirim={interaksi.kirimKomentar}
        />

        <View style={styles.kendali}>
          <TombolBulat
            ikon={isMicrophoneEnabled ? 'mic' : 'mic-off'}
            label={isMicrophoneEnabled ? 'Matikan mikrofon' : 'Nyalakan mikrofon'}
            aktif={!isMicrophoneEnabled}
            besar
            onPress={ubahMikrofon}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Akhiri siaran"
            onPress={() => tanyaAkhiri(onAkhiri)}
            style={styles.tombolAkhiri}>
            <View style={styles.tombolAkhiriDalam} />
          </Pressable>
          <TombolBulat ikon="camera-reverse-outline" label="Balik kamera" besar onPress={() => void balikKamera()} />
        </View>
      </View>

      <LapisanHati hati={interaksi.hati} onSelesai={interaksi.hapusHati} />
      <SorotanHadiah sorotan={interaksi.sorotan} onSelesai={interaksi.hapusSorotan} />

      {status === ConnectionState.Reconnecting && (
        <View style={styles.selubung}>
          <ActivityIndicator color={TULANG} />
          <Text style={styles.selubungTeks}>Sinyal terputus — menyambung ulang…</Text>
        </View>
      )}

      {/* Kepala dari artboard "Live broadcast": satu baris status, pembawa siaran + GPS, pengingat singkat. */}
      <View style={[styles.atas, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
        <View style={styles.barisStatus}>
          <LencanaLive tersambung={tersambung} />
          <PilLive teks={durasiTeks((kini - mulai) / 1000)} besar />
          <PilLive ikon="eye-outline" teks={String(penonton)} label={`${penonton} menonton`} />
          {interaksi.jumlahHadiah > 0 && (
            <PilLive ikon="gift-outline" warnaIkon={SINYAL} teks={String(interaksi.jumlahHadiah)} label={`${interaksi.jumlahHadiah} hadiah`} />
          )}
          <View style={styles.fleks} />
          <PilLive ikon="cellular" warnaIkon={WARNA_KUALITAS[kualitas]} label={`Sinyal ${TEKS_KUALITAS[kualitas]}`} />
        </View>

        <View style={styles.tuanRumah}>
          <View style={styles.avatarTuan}>
            <Text style={styles.inisialTuan}>{(draf.nama.trim()[0] ?? 'A').toUpperCase()}</Text>
          </View>
          <View style={styles.fleks}>
            <Text style={styles.namaTuan} numberOfLines={1}>
              {draf.judul.trim() || 'Siaran langsung'}
            </Text>
            {/* Lokasi yang sedang terkirim (titik hijau berdenyut = GPS segar) dan siapa penontonnya. */}
            <View style={styles.barisLokasi}>
              <TitikLive warna={gpsLive ? Media.hijau : 'rgba(237,232,223,0.5)'} berdenyut={gpsLive} ukuran={6} />
              <Text style={styles.teksLokasi} numberOfLines={1}>
                {posisiTampil ? koordinatTeks(posisiTampil.lat, posisiTampil.lng) : 'MENCARI GPS…'}
                {posisiTampil?.akurasi != null && ` ±${Math.round(posisiTampil.akurasi)} M`}
                {publik ? ' · PUBLIK' : ' · PETUGAS'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.amanLive}>
          <Ionicons name="warning-outline" size={14} color={SINYAL} />
          <Text style={styles.teksAmanLive} numberOfLines={1}>
            {penonton === 0 && tersambung ? `Menunggu ${publik ? 'penonton' : 'petugas'} bergabung` : 'Jaga jarak aman dari api'}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function tanyaAkhiri(onAkhiri: () => void) {
  Alert.alert('Akhiri siaran?', 'Petugas tidak bisa melihat kejadian lagi setelah siaran diakhiri.', [
    { text: 'Lanjut siaran', style: 'cancel' },
    { text: 'Akhiri', style: 'destructive', onPress: onAkhiri },
  ]);
}

const TEKS_KUALITAS: Record<ConnectionQuality, string> = {
  [ConnectionQuality.Excellent]: 'BAGUS',
  [ConnectionQuality.Good]: 'CUKUP',
  [ConnectionQuality.Poor]: 'LEMAH',
  [ConnectionQuality.Lost]: 'PUTUS',
  [ConnectionQuality.Unknown]: '…',
};

const WARNA_KUALITAS: Record<ConnectionQuality, string> = {
  [ConnectionQuality.Excellent]: Media.hijau,
  [ConnectionQuality.Good]: '#E8BD55',
  [ConnectionQuality.Poor]: Media.oranye,
  [ConnectionQuality.Lost]: SINYAL,
  [ConnectionQuality.Unknown]: 'rgba(237,232,223,0.5)',
};

function TombolBulat({
  ikon,
  label,
  onPress,
  aktif = false,
  besar = false,
}: {
  ikon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  aktif?: boolean;
  besar?: boolean;
}) {
  const ukuran = besar ? 52 : 42;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.bulat,
        { width: ukuran, height: ukuran, borderRadius: ukuran / 2 },
        aktif && styles.bulatAktif,
        pressed && styles.ditekan,
      ]}>
      <Ionicons name={ikon} size={besar ? 23 : 21} color={aktif ? TINTA : TULANG} />
    </Pressable>
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
  teksRedup: {
    color: Media.redup,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  ditekan: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  atas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingLeft: 16,
    paddingRight: 12,
    paddingBottom: Spacing.four,
    gap: 10,
    ...gradasi('linear-gradient(to bottom, rgba(12,14,13,0.55), rgba(12,14,13,0))'),
  },
  fleks: {
    flex: 1,
    minWidth: 0,
  },
  barisStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tuanRumah: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Pembawa siaran: lingkaran tulang berinisial tinta.
  avatarTuan: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TULANG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inisialTuan: {
    color: TINTA,
    fontFamily: Fonts.tebal,
    fontSize: 13,
  },
  namaTuan: {
    color: TULANG,
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  barisLokasi: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  teksLokasi: {
    flexShrink: 1,
    color: Media.redup,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  // Pengingat singkat seukuran isinya, bukan kotak selebar layar yang menutupi video.
  amanLive: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: Media.kaca,
  },
  teksAmanLive: {
    flexShrink: 1,
    color: TULANG,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  selubung: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  areaKetuk: {
    flex: 1,
  },
  // Dalam alur biasa (bukan absolute) supaya ikut naik saat papan ketik muncul. Selubung tinta
  // di bawah supaya komentar terbaca di atas video apa pun.
  bawah: {
    paddingTop: 40,
    paddingLeft: 16,
    paddingRight: 12,
    gap: 12,
    ...gradasi('linear-gradient(to bottom, rgba(12,14,13,0), rgba(12,14,13,0.8) 35%)'),
  },
  barisKomentar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  kendali: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  bulat: {
    borderWidth: 1,
    borderColor: Media.garis,
    backgroundColor: Media.kaca,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulatAktif: {
    borderColor: TULANG,
    backgroundColor: TULANG,
  },
  // Tombol rekam: cincin tulang, kotak sinyal di tengah.
  tombolAkhiri: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: TULANG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tombolAkhiriDalam: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: SINYAL,
  },
});
