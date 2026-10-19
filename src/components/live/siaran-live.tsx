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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
  SorotanHadiah,
  useInteraksiLive,
} from '@/components/live/interaksi-live';
import { TitikLive } from '@/components/titik-live';
import { Tombol } from '@/components/tombol';
import { Colors, Fonts, Media, Radius, Spacing } from '@/constants/theme';
import { useKini } from '@/hooks/use-kini';
import { tokenSesi, useAkun } from '@/lib/akun';
import { BATAS_JUDUL, durasiTeks } from '@/lib/batas-laporan';
import { ubahIsian, useDraf } from '@/lib/draf-laporan';
import { AWALAN_PETUGAS, mintaTiketSiaran, TOPIK_LOKASI, type TiketSiaran } from '@/lib/live';
import { ambilPosisi, koordinatTeks, masihSegar, useLokasiLive, type PosisiLive } from '@/lib/lokasi-live';

const MERAH = '#ff3b30';
const BARA = Colors.dark.accent;

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
  const insets = useSafeAreaInsets();
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
    return (
      <View style={[styles.layar, styles.tengah, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four }]}>
        <Ionicons name={tahap.terputus ? 'cloud-offline-outline' : 'checkmark-circle'} size={64} color={BARA} />
        <Text style={styles.judulBesar}>{tahap.terputus ? 'Siaran terputus' : 'Siaran selesai'}</Text>
        <Text style={styles.teksRedup}>Durasi {durasiTeks(tahap.durasi)}</Text>
        {galat !== '' && <Text style={styles.galat}>{galat}</Text>}
        <Text style={styles.teksRedup}>
          Lengkapi dengan foto dan cerita di formulir laporan supaya petugas punya catatan tertulis.
        </Text>
        {/* Dibuka dari beranda/kamera pun tetap ke formulir; dari formulir = kembali ke formulir yang sama. */}
        <Tombol judul="Lengkapi laporan" besar onPress={() => router.dismissTo('/lapor')} style={styles.lebar} />
      </View>
    );
  }

  const menghubungkan = tahap.jenis === 'menghubungkan';
  let ketPublik =
    'Warga lain bisa menonton, berkomentar, dan memberi hadiah. Mereka hanya melihat perkiraan lokasi (±1 km); titik persis hanya untuk petugas.';
  if (!masuk) ketPublik = 'Butuh akun — ketuk untuk masuk dulu. Siaran tanpa akun hanya ditonton petugas.';
  else if (draf.anonim) ketPublik = 'Tidak tersedia untuk laporan anonim. Siaran anonim hanya ditonton petugas.';
  return (
    // Papan ketik tidak boleh menutup kolom judul; tombol Mulai ikut naik di atasnya.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.layar, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.barisAtas}>
        <TombolBulat ikon="close" label="Tutup" onPress={() => router.back()} />
      </View>

      <ScrollView style={styles.fleks} contentContainerStyle={styles.persiapan} keyboardShouldPersistTaps="handled">
        <View style={styles.ikonLive}>
          <Ionicons name="radio" size={40} color="#fff" />
        </View>
        <Text style={styles.judulBesar}>Siaran langsung</Text>
        <Text style={styles.teksRedup}>Tunjukkan kejadian secara langsung ke petugas.</Text>

        {/* Di atas, supaya tetap terlihat saat papan ketik muncul di layar pendek. */}
        <TextInput
          value={draf.judul}
          onChangeText={(judul) => ubahIsian({ judul })}
          placeholder="Apa yang terjadi? Mis. “Api mendekati permukiman”"
          placeholderTextColor="rgba(255,255,255,0.45)"
          maxLength={BATAS_JUDUL}
          editable={!menghubungkan}
          style={styles.input}
        />
        {galat !== '' && <Text style={styles.galat}>{galat}</Text>}
        {kePengaturan && (
          <Text style={[styles.galat, styles.tautan]} onPress={() => void Linking.openSettings()}>
            Buka Pengaturan
          </Text>
        )}

        <View style={styles.poin}>
          <Poin
            ikon="shield-checkmark-outline"
            teks={
              publikAktif
                ? 'Petugas dan warga lain bisa menonton dari beranda aplikasi. Tidak tampil di situs publik.'
                : 'Hanya petugas yang menonton — tidak tampil di situs publik.'
            }
          />
          <Poin ikon="location-outline" teks="Lokasi GPS live ikut terkirim selama siaran." />
          <Poin
            ikon="cellular-outline"
            teks="Butuh sinyal stabil. Kalau putus-putus, lebih andal rekam video 30 detik di menu Kamera."
          />
        </View>

        <View style={styles.barisPublik}>
          <Ionicons name="people-outline" size={20} color={BARA} />
          <View style={styles.fleks}>
            <Text style={styles.judulPublik}>Tampilkan di beranda warga</Text>
            <Text style={styles.ketPublik}>{ketPublik}</Text>
          </View>
          <Switch
            value={publikAktif}
            onValueChange={ubahPublik}
            disabled={menghubungkan || akun.status === 'memuat' || (masuk && draf.anonim)}
            trackColor={{ true: Media.limau }}
            accessibilityLabel="Tampilkan di beranda warga"
          />
        </View>

        <StatusGps />
      </ScrollView>

      {/* paddingBottom di sini: KeyboardAvoidingView (iOS) menimpa paddingBottom miliknya sendiri. */}
      <View style={{ paddingBottom: insets.bottom + Spacing.three }}>
        <Pressable
          accessibilityRole="button"
          disabled={menghubungkan}
          onPress={() => void mulai()}
          style={({ pressed }) => [styles.tombolMulai, pressed && { opacity: 0.85 }]}>
          {menghubungkan ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <TitikLive warna="#fff" ukuran={8} />
              <Text style={styles.tombolMulaiTeks}>Mulai siaran</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.persetujuan}>
          Dengan memulai siaran, Anda menyetujui{' '}
          <Text style={styles.tautan} onPress={() => router.push('/ketentuan')}>
            Ketentuan Penggunaan
          </Text>
          .
        </Text>
      </View>
    </KeyboardAvoidingView>
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
    // Android: jendela mengecil sendiri saat papan ketik muncul; iOS perlu padding.
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.layar}>
      {kamera ? (
        // pointerEvents="none": tampilan video native tidak boleh menelan ketukan "hati".
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <VideoTrack trackRef={kamera} style={StyleSheet.absoluteFill} objectFit="cover" mirror={depan} />
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tengah]}>
          <ActivityIndicator color="#fff" />
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
        {/* Pelapor hanya bisa memblokir; melaporkan komentar dari sisi penonton. */}
        <DaftarKomentar komentar={interaksi.komentar} onTekanLama={(k) => menuKomentarLive(k, null)} />

        <View style={styles.pilGps}>
          <TitikLive warna={gpsLive ? '#34c759' : '#9a9a9a'} berdenyut={gpsLive} ukuran={7} />
          <Text style={styles.gpsTeks}>
            {posisiTampil ? koordinatTeks(posisiTampil.lat, posisiTampil.lng) : 'Mencari GPS…'}
            {posisiTampil?.akurasi != null && `  ±${Math.round(posisiTampil.akurasi)} m`}
          </Text>
        </View>

        <KolomKomentar
          // Siaran publik juga ditonton warga; komentar bukan hanya dari/untuk petugas.
          placeholder={publik ? 'Tulis komentar…' : undefined}
          onKirim={interaksi.kirimKomentar}
          onHati={() => interaksi.ketuk(lebarLayar - 44, tinggiLayar * 0.7)}
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
          <ActivityIndicator color="#fff" />
          <Text style={styles.selubungTeks}>Sinyal terputus — menyambung ulang…</Text>
        </View>
      )}

      {/* Kepala dari desain "Live": tuan rumah, baris status, pemberitahuan keselamatan. */}
      <View style={[styles.atas, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
        <View style={styles.tuanRumah}>
          <View style={styles.avatarTuan}>
            <Text style={styles.inisialTuan}>{(draf.nama.trim()[0] ?? 'A').toUpperCase()}</Text>
          </View>
          <View style={styles.fleks}>
            <Text style={styles.namaTuan} numberOfLines={1}>
              {draf.judul.trim() || 'Siaran langsung'}
            </Text>
            <View style={styles.barisLokasi}>
              <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.65)" />
              <Text style={styles.teksLokasi} numberOfLines={1}>
                {posisiTampil ? koordinatTeks(posisiTampil.lat, posisiTampil.lng) : 'Mencari GPS…'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.barisStatus}>
          <View style={[styles.lencanaLive, !tersambung && styles.lencanaMenunggu]}>
            {tersambung && <View style={styles.titikLive} />}
            <Text style={styles.lencanaLiveTeks}>{tersambung ? 'LIVE' : 'MENGHUBUNGKAN'}</Text>
          </View>
          <View style={styles.pil}>
            <Text style={styles.pilTeks}>{durasiTeks((kini - mulai) / 1000)}</Text>
          </View>
          <View style={styles.pil}>
            <Ionicons name="eye-outline" size={12} color="#fff" />
            <Text style={styles.pilTeks}>{penonton} menonton</Text>
          </View>
          {publik && (
            <View style={styles.pil}>
              <Ionicons name="people" size={12} color="#fff" />
              <Text style={styles.pilTeks}>Publik</Text>
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
          <View style={styles.pil}>
            <Ionicons name="cellular" size={12} color={WARNA_KUALITAS[kualitas]} />
            <Text style={styles.pilTeks}>{TEKS_KUALITAS[kualitas]}</Text>
          </View>
        </View>

        <View style={styles.amanLive}>
          <Ionicons name="warning-outline" size={17} color="#fff" />
          <Text style={styles.teksAmanLive}>
            {penonton === 0 && tersambung
              ? `Menunggu ${publik ? 'penonton' : 'petugas'} bergabung — siaran tetap berjalan. Jaga jarak aman dari api.`
              : 'Jaga jarak aman dari api dan asap. Keselamatan Anda lebih penting dari rekaman.'}
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
  [ConnectionQuality.Excellent]: 'Bagus',
  [ConnectionQuality.Good]: 'Cukup',
  [ConnectionQuality.Poor]: 'Lemah',
  [ConnectionQuality.Lost]: 'Putus',
  [ConnectionQuality.Unknown]: '…',
};

const WARNA_KUALITAS: Record<ConnectionQuality, string> = {
  [ConnectionQuality.Excellent]: '#34c759',
  [ConnectionQuality.Good]: '#ffcc00',
  [ConnectionQuality.Poor]: '#ff9500',
  [ConnectionQuality.Lost]: MERAH,
  [ConnectionQuality.Unknown]: '#9a9a9a',
};

function StatusGps() {
  const { status, posisi } = useLokasiLive();
  const kini = useKini();
  const live = masihSegar(posisi, kini);
  let teks = 'Mencari GPS…';
  // Posisi basi tidak ikut terkirim sebagai titik siaran, jadi juga tidak ditampilkan.
  if (posisi && masihSegar(posisi, kini, BATAS_SEGAR_GPS_MS)) {
    teks = `${koordinatTeks(posisi.lat, posisi.lng)}${posisi.akurasi != null ? `  ±${Math.round(posisi.akurasi)} m` : ''}`;
  } else if (status === 'ditolak') teks = 'Izin lokasi ditolak — siaran tetap bisa tanpa lokasi';
  else if (status === 'mati') teks = 'GPS mati — siaran tetap bisa tanpa lokasi';
  return (
    <View style={styles.pilGps}>
      <TitikLive warna={live ? '#34c759' : '#9a9a9a'} berdenyut={live} ukuran={7} />
      <Text style={styles.gpsTeks}>{teks}</Text>
    </View>
  );
}

function Poin({ ikon, teks }: { ikon: ComponentProps<typeof Ionicons>['name']; teks: string }) {
  return (
    <View style={styles.barisPoin}>
      <Ionicons name={ikon} size={18} color={BARA} />
      <Text style={styles.poinTeks}>{teks}</Text>
    </View>
  );
}

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
      style={[
        styles.bulat,
        { width: ukuran, height: ukuran, borderRadius: ukuran / 2 },
        aktif && { backgroundColor: '#fff' },
      ]}>
      <Ionicons name={ikon} size={besar ? 24 : 22} color={aktif ? '#000' : '#fff'} />
    </Pressable>
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
  lebar: {
    alignSelf: 'stretch',
    marginTop: Spacing.three,
  },
  persiapan: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  ikonLive: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: MERAH,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  judulBesar: {
    color: '#fff',
    fontSize: 24,
    fontFamily: Fonts.judulTebal,
    textAlign: 'center',
  },
  teksRedup: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  poin: {
    gap: Spacing.two + 2,
    paddingVertical: Spacing.two,
  },
  barisPublik: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  judulPublik: {
    color: '#fff',
    fontFamily: Fonts.semibold,
    fontSize: 14.5,
  },
  ketPublik: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12.5,
    lineHeight: 17,
  },
  barisPoin: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
    alignItems: 'flex-start',
  },
  poinTeks: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    minHeight: 48,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    paddingHorizontal: 14,
    fontSize: 15,
  },
  galat: {
    color: '#ff8a70',
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  tombolMulai: {
    marginHorizontal: Spacing.four,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: MERAH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  persetujuan: {
    marginTop: Spacing.two,
    marginHorizontal: Spacing.four,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  tautan: {
    color: Media.limau,
    fontFamily: Fonts.semibold,
  },
  tombolMulaiTeks: {
    color: '#fff',
    fontSize: 17,
    fontFamily: Fonts.judulTebal,
  },
  // .live-shade + .live-header di desain.
  atas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: Spacing.four,
    gap: 10,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0))',
  },
  fleks: {
    flex: 1,
  },
  tuanRumah: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  avatarTuan: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Media.limau,
    backgroundColor: '#304036',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inisialTuan: {
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 14,
  },
  namaTuan: {
    color: '#fff',
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  barisLokasi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  teksLokasi: {
    color: 'rgba(255,255,255,0.65)',
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  barisStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  titikLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  amanLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 9,
    backgroundColor: 'rgba(19,27,22,0.6)',
  },
  teksAmanLive: {
    flex: 1,
    color: '#fff',
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  barisAtas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
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
  petunjuk: {
    alignSelf: 'center',
    color: '#fff',
    fontSize: 12.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  selubung: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  areaKetuk: {
    flex: 1,
  },
  // Dalam alur biasa (bukan absolute) supaya ikut naik saat papan ketik muncul.
  bawah: {
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.55))',
  },
  pilGps: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  gpsTeks: {
    color: '#fff',
    fontFamily: Fonts.mono,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  kendali: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  bulat: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tombolAkhiri: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tombolAkhiriDalam: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: MERAH,
  },
});
