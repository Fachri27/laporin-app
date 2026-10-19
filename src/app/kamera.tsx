import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraMode,
  type CameraType,
} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { TitikLive } from '@/components/titik-live';
import { Tombol } from '@/components/tombol';
import { Fonts, Media, Radius, Spacing } from '@/constants/theme';
import { useKini } from '@/hooks/use-kini';
import {
  BATAS_BERKAS,
  BATAS_TOTAL_BYTE,
  BATAS_TOTAL_TEKS,
  DURASI_VIDEO_DETIK,
  durasiTeks,
  ukuranTeks,
} from '@/lib/batas-laporan';
import {
  ambilDraf,
  ekstensi,
  idBaru,
  mimeDari,
  tambahLampiran,
  totalUkuran,
  ukuranBerkas,
  useDraf,
} from '@/lib/draf-laporan';
import { pilihDariGaleri } from '@/lib/galeri';
import {
  koordinatTeks,
  masihSegar,
  perbaikiLokasi,
  posisiSegar,
  useLokasiLive,
  type PosisiLive,
} from '@/lib/lokasi-live';

const MERAH = Media.merah;

/** Cadangan untuk penutup berkas MP4 saat rekaman dihentikan di batas ukuran. */
const CADANGAN_REKAM_BYTE = 1024 * 1024;

export default function LayarKamera() {
  const insets = useSafeAreaInsets();
  // lanjut=1: dibuka dari tombol ➕ di beranda — setelah memotret, "Lanjut" ke
  // formulir. Tanpa itu, kamera dibuka dari formulir dan "Selesai" kembali ke sana.
  const { lanjut } = useLocalSearchParams<{ lanjut?: string }>();
  const alurBaru = lanjut === '1';
  const kamera = useRef<CameraView>(null);
  const [izinKamera, mintaIzinKamera, cekIzinKamera] = useCameraPermissions();
  const [izinMikrofon, mintaIzinMikrofon, cekIzinMikrofon] = useMicrophonePermissions();
  const draf = useDraf();
  const lokasi = useLokasiLive();
  const kini = useKini(250);

  const [mode, setMode] = useState<CameraMode>('picture');
  const [hadap, setHadap] = useState<CameraType>('back');
  const [lampu, setLampu] = useState(false);
  const [siap, setSiap] = useState(false);
  const [memotret, setMemotret] = useState(false);
  const [mulaiRekam, setMulaiRekam] = useState<number | null>(null);
  const [pesan, setPesan] = useState<{ teks: string; galat: boolean } | null>(null);
  // Zoom kamera 0–1 (0 = tanpa zoom, 1 = zoom maksimum perangkat), diatur dengan cubit.
  const [zoom, setZoom] = useState(0);
  const [mencubit, setMencubit] = useState(false);
  const zoomSaatIni = useSharedValue(0);
  const zoomAwal = useSharedValue(0);

  const sisa = BATAS_BERKAS - draf.lampiran.length;
  const sisaKapasitas = Math.max(0, BATAS_TOTAL_BYTE - totalUkuran(draf.lampiran));
  const merekam = mulaiRekam !== null;
  const detikRekam = merekam ? Math.max(0, (kini - mulaiRekam) / 1000) : 0;
  const terakhir = draf.lampiran.at(-1);

  // Pesan info hilang sendiri; pesan galat bertahan sampai aksi berikutnya.
  useEffect(() => {
    if (!pesan || pesan.galat) return;
    const id = setTimeout(() => setPesan(null), 2200);
    return () => clearTimeout(id);
  }, [pesan]);

  // Hook izin expo-camera hanya membaca status saat dipasang: segarkan saat warga kembali
  // dari Pengaturan, supaya izin yang baru diberikan langsung terpakai.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      void cekIzinKamera();
      void cekIzinMikrofon();
    });
    return () => sub.remove();
  }, [cekIzinKamera, cekIzinMikrofon]);

  if (!izinKamera) return <View style={styles.layar} />;

  if (!izinKamera.granted) {
    // Tanpa kamera warga tetap bisa melapor dengan foto/video dari galeri.
    return (
      <View style={[styles.layar, styles.izin, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Ionicons name="camera-outline" size={56} color={Media.limau} />
        <Text style={styles.izinJudul}>Izinkan kamera</Text>
        <Text style={styles.izinTeks}>
          Kamera dipakai untuk memotret atau merekam kejadian langsung dari lokasi sebagai bukti laporan. Bisa
          juga melampirkan foto/video dari galeri.
        </Text>
        {pesan && <Text style={[styles.izinTeks, pesan.galat && styles.izinGalat]}>{pesan.teks}</Text>}
        <Tombol
          judul={izinKamera.canAskAgain ? 'Izinkan kamera' : 'Buka pengaturan'}
          besar
          onPress={() => void (izinKamera.canAskAgain ? mintaIzinKamera() : Linking.openSettings())}
          style={styles.izinTombol}
        />
        <Tombol
          judul="Pilih dari galeri"
          ikon="images-outline"
          ragam="sekunder"
          onPress={() => void unggah()}
          style={styles.izinTombol}
        />
        {alurBaru && draf.lampiran.length > 0 && (
          <Tombol judul={`Lanjut (${draf.lampiran.length} berkas)`} ragam="teks" onPress={lanjutkan} />
        )}
        <Tombol judul="Kembali" ragam="teks" onPress={() => router.back()} />
      </View>
    );
  }

  function simpan(b: { uri: string; jenis: 'foto' | 'video'; mime: string; nama: string; durasi: number | null; gps: PosisiLive | null }) {
    const { galat } = tambahLampiran([
      {
        id: idBaru(),
        uri: b.uri,
        jenis: b.jenis,
        mime: b.mime,
        nama: b.nama,
        ukuran: ukuranBerkas(b.uri),
        durasi: b.durasi,
        asal: 'kamera',
        titik: b.gps ? { lat: b.gps.lat, lng: b.gps.lng, akurasi: b.gps.akurasi } : null,
      },
    ]);
    if (galat) {
      // Berkas yang ditolak sudah dibuang tambahLampiran.
      setPesan({ teks: galat, galat: true });
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const ke = ambilDraf().lampiran.length;
    setPesan({
      teks: `${b.jenis === 'foto' ? 'Foto' : 'Video'} tersimpan (${ke}/${BATAS_BERKAS})${b.gps ? '' : ' — tanpa GPS'}`,
      galat: false,
    });
  }

  async function ambilFoto() {
    if (!kamera.current || memotret || sisa <= 0) return;
    setMemotret(true);
    setPesan(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Posisi yang ditempel harus segar; posisi basi bisa meleset berkilo-kilometer.
    const gps = posisiSegar();
    try {
      const foto = await kamera.current.takePictureAsync({
        quality: 0.7,
        // exif + additionalExif = koordinat ikut tertanam di berkas JPEG. Server
        // membaca EXIF ini (exifDariBerkas) dan petugas melihatnya di CMS.
        exif: true,
        additionalExif: gps
          ? {
              GPSLatitude: gps.lat,
              GPSLongitude: gps.lng,
              ...(gps.ketinggian != null && { GPSAltitude: gps.ketinggian }),
            }
          : undefined,
      });
      simpan({
        uri: foto.uri,
        jenis: 'foto',
        mime: mimeDari(foto.uri, 'image/jpeg'),
        nama: `foto-${Date.now()}.${ekstensi(foto.uri) || 'jpg'}`,
        durasi: null,
        gps,
      });
    } catch {
      setPesan({ teks: 'Gagal mengambil foto. Coba lagi.', galat: true });
    } finally {
      setMemotret(false);
    }
  }

  async function mulaiRekaman() {
    if (!kamera.current || merekam || sisa <= 0) return;
    // Rekaman berhenti sendiri di sisa kapasitas laporan, supaya tidak ditolak setelah
    // selesai. Jangan pernah 0: di Android itu berarti tanpa batas.
    const batasByte = Math.floor(BATAS_TOTAL_BYTE - totalUkuran(ambilDraf().lampiran) - CADANGAN_REKAM_BYTE);
    if (batasByte < 2 * CADANGAN_REKAM_BYTE) {
      setPesan({ teks: `Kapasitas laporan (${BATAS_TOTAL_TEKS}) sudah penuh. Hapus berkas lain dulu.`, galat: true });
      return;
    }
    setPesan(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const gps = posisiSegar();
    const awal = Date.now();
    setMulaiRekam(awal);
    try {
      const hasil = await kamera.current.recordAsync({
        maxDuration: DURASI_VIDEO_DETIK,
        maxFileSize: batasByte,
        // H.264 diputar di semua peramban; HEVC bawaan iPhone tidak di Chrome/Android.
        ...(Platform.OS === 'ios' && { codec: 'avc1' as const }),
      });
      if (hasil?.uri) {
        simpan({
          uri: hasil.uri,
          jenis: 'video',
          mime: mimeDari(hasil.uri, 'video/mp4'),
          nama: `video-${awal}.${ekstensi(hasil.uri) || 'mp4'}`,
          durasi: Math.min((Date.now() - awal) / 1000, DURASI_VIDEO_DETIK),
          gps,
        });
      }
    } catch {
      setPesan({ teks: 'Gagal merekam video. Coba lagi.', galat: true });
    } finally {
      setMulaiRekam(null);
    }
  }

  function hentikanRekaman() {
    kamera.current?.stopRecording();
  }

  async function gantiMode(baru: CameraMode) {
    if (merekam || baru === mode) return;
    setLampu(false);
    setMode(baru);
    if (baru === 'video' && !izinMikrofon?.granted && izinMikrofon?.canAskAgain !== false) {
      await mintaIzinMikrofon();
    }
  }

  function tutup() {
    if (merekam) hentikanRekaman();
    router.back();
  }

  function aturZoom(z: number) {
    zoomSaatIni.value = z;
    setZoom(z);
  }

  // Cubit = zoom, juga saat merekam. Skala logaritmik: cubit 2× ke luar dan ke
  // dalam terasa sama besar perubahannya.
  const cubit = Gesture.Pinch()
    .onStart(() => {
      zoomAwal.value = zoomSaatIni.value;
      scheduleOnRN(setMencubit, true);
    })
    .onUpdate((e) => {
      const z = Math.min(1, Math.max(0, zoomAwal.value + Math.log2(Math.max(e.scale, 0.01)) * 0.3));
      zoomSaatIni.value = z;
      scheduleOnRN(setZoom, z);
    })
    .onFinalize(() => {
      scheduleOnRN(setMencubit, false);
    });

  function lanjutkan() {
    if (merekam) return;
    if (alurBaru) router.replace('/lapor');
    else router.back();
  }

  async function unggah() {
    setPesan(null);
    const hasil = await pilihDariGaleri();
    // Ada yang dilewati: tetap di sini supaya pesannya terbaca; "Lanjut" membuka formulir.
    if (hasil.galat) setPesan({ teks: hasil.galat, galat: true });
    else if (hasil.ditambah > 0) lanjutkan();
  }

  const bisaAmbil = siap && sisa > 0 && !memotret;
  const bisaLanjut = !merekam && (!alurBaru || draf.lampiran.length > 0);

  return (
    <View style={styles.layar}>
      <GestureDetector gesture={cubit}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <CameraView
            ref={kamera}
            style={StyleSheet.absoluteFill}
            facing={hadap}
            zoom={zoom}
            mode={mode}
            flash={mode === 'picture' && lampu ? 'on' : 'off'}
            enableTorch={mode === 'video' && lampu}
            mute={!izinMikrofon?.granted}
            videoQuality="720p"
            onCameraReady={() => setSiap(true)}
            onMountError={(e) => setPesan({ teks: `Kamera tidak bisa dibuka: ${e.message}`, galat: true })}
          />
        </View>
      </GestureDetector>

      {/* Kepala dari desain "Create": tutup · LAPORAN BARU · (kosong), lalu GPS & jam. */}
      <View style={[styles.atas, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
        <View style={styles.barisAtas}>
          <TombolBulat ikon="close" label="Tutup kamera" onPress={tutup} />
          {merekam ? (
            <View style={[styles.pil, styles.pilRekam]}>
              <TitikLive warna={MERAH} ukuran={7} />
              <Text style={styles.teksRekam}>
                {durasiTeks(detikRekam)} / {durasiTeks(DURASI_VIDEO_DETIK)}
              </Text>
            </View>
          ) : (
            <Text style={styles.judulKepala}>LAPORAN BARU</Text>
          )}
          <View style={styles.pengisi} />
        </View>

        <HudLokasi lokasi={lokasi} kini={kini} />
        {!merekam && <Text style={styles.jam}>{jamTeks(kini)}</Text>}
        {mode === 'video' && !izinMikrofon?.granted && (
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => void (izinMikrofon?.canAskAgain === false ? Linking.openSettings() : mintaIzinMikrofon())}>
            <Text style={styles.jam}>
              Tanpa suara — ketuk untuk {izinMikrofon?.canAskAgain === false ? 'membuka Pengaturan' : 'mengizinkan mikrofon'}
            </Text>
          </Pressable>
        )}
        {mode === 'video' && !merekam && draf.lampiran.length > 0 && (
          <Text style={styles.jam}>Sisa kapasitas laporan {ukuranTeks(sisaKapasitas)}</Text>
        )}
      </View>

      {/* .capture-guide: bingkai bidik + pesan keselamatan. */}
      {!merekam && (
        <View pointerEvents="none" style={styles.panduan}>
          <View style={styles.bingkai} />
          <Text style={styles.teksPanduan}>Jaga jarak aman. Jangan masuk area kebakaran untuk merekam.</Text>
        </View>
      )}

      {/* .capture-tools: alat di sisi kanan. */}
      <View style={styles.alat}>
        <TombolAlat
          ikon={lampu ? 'flash' : 'flash-outline'}
          label="Lampu"
          aktif={lampu}
          onPress={() => setLampu((x) => !x)}
        />
        <TombolAlat
          ikon="camera-reverse-outline"
          label="Balik"
          nonaktif={merekam}
          onPress={() => {
            aturZoom(0);
            setHadap((x) => (x === 'back' ? 'front' : 'back'));
          }}
        />
      </View>

      <View style={[styles.bawah, { paddingBottom: insets.bottom + Spacing.four }]}>
        {pesan && (
          <View style={[styles.pesan, pesan.galat && styles.pesanGalat]}>
            <Text style={styles.pesanTeks}>{pesan.teks}</Text>
          </View>
        )}
        {sisa <= 0 && !pesan && (
          <View style={styles.pesan}>
            <Text style={styles.pesanTeks}>Sudah {BATAS_BERKAS} berkas — batas per laporan.</Text>
          </View>
        )}

        {(mencubit || zoom > 0.01) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembalikan zoom"
            onPress={() => aturZoom(0)}
            hitSlop={8}
            style={styles.pilZoom}>
            <Ionicons name="search" size={13} color="#fff" />
            <View style={styles.relZoom}>
              <View style={[styles.isiRelZoom, { width: `${Math.round(zoom * 100)}%` }]} />
            </View>
            <Text style={styles.teksZoom}>{zoom > 0.01 ? '1×' : 'Zoom'}</Text>
          </Pressable>
        )}

        <View style={styles.pilihMode}>
          <Pressable disabled={merekam} onPress={() => router.replace('/live')} hitSlop={8} style={styles.tombolMode}>
            <Text style={styles.mode}>LIVE</Text>
          </Pressable>
          {(['picture', 'video'] as const).map((m) => (
            <Pressable key={m} disabled={merekam} onPress={() => void gantiMode(m)} hitSlop={8} style={styles.tombolMode}>
              <Text style={[styles.mode, mode === m && styles.modeAktif]}>{m === 'picture' ? 'FOTO' : 'VIDEO'}</Text>
              <View style={[styles.titikMode, mode !== m && styles.tersembunyi]} />
            </Pressable>
          ))}
        </View>

        <View style={styles.barisRana}>
          <View style={styles.sisi}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={terakhir ? 'Lihat berkas laporan' : 'Unggah dari galeri'}
              disabled={merekam}
              onPress={terakhir ? lanjutkan : () => void unggah()}
              style={styles.galeri}>
              {terakhir?.jenis === 'foto' ? (
                <Image source={{ uri: terakhir.uri }} style={styles.gambarGaleri} contentFit="cover" />
              ) : (
                <Ionicons name={terakhir ? 'videocam' : 'images-outline'} size={20} color="#fff" />
              )}
              {draf.lampiran.length > 0 && (
                <View style={styles.hitungan}>
                  <Text style={styles.hitunganTeks}>{draf.lampiran.length}</Text>
                </View>
              )}
            </Pressable>
            {!terakhir && <Text style={styles.labelSisi}>Unggah</Text>}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === 'picture' ? 'Ambil foto' : merekam ? 'Hentikan rekaman' : 'Mulai rekam'}
            disabled={!bisaAmbil && !merekam}
            onPress={() => {
              if (mode === 'picture') void ambilFoto();
              else if (merekam) hentikanRekaman();
              else void mulaiRekaman();
            }}
            style={({ pressed }) => [
              styles.rana,
              !bisaAmbil && !merekam && styles.mati,
              pressed && { transform: [{ scale: 0.94 }] },
            ]}>
            <View style={[styles.ranaDalam, mode === 'video' && { backgroundColor: MERAH }, merekam && styles.ranaRekam]} />
          </Pressable>

          <View style={styles.sisi}>
            {draf.lampiran.length > 0 || !alurBaru ? (
              <Pressable
                accessibilityRole="button"
                disabled={!bisaLanjut}
                onPress={lanjutkan}
                style={[styles.lanjut, !bisaLanjut && styles.mati]}>
                <Text style={styles.teksLanjut}>{alurBaru ? 'Lanjut' : 'Selesai'}</Text>
              </Pressable>
            ) : (
              <Text style={styles.durasi}>{mode === 'video' ? durasiTeks(DURASI_VIDEO_DETIK) : ''}</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function HudLokasi({ lokasi, kini }: { lokasi: ReturnType<typeof useLokasiLive>; kini: number }) {
  const { status, posisi } = lokasi;
  const live = status === 'aktif' && masihSegar(posisi, kini);

  let isi: ReactNode;
  if (posisi) {
    isi = (
      <>
        <TitikLive warna={live ? '#34c759' : '#9a9a9a'} berdenyut={live} ukuran={7} />
        <Text style={styles.hudLabel}>{live ? 'LIVE' : 'GPS'}</Text>
        <Text style={styles.hudKoordinat}>{koordinatTeks(posisi.lat, posisi.lng)}</Text>
        {posisi.akurasi != null && <Text style={styles.hudAkurasi}>±{Math.round(posisi.akurasi)} m</Text>}
      </>
    );
  } else if (status === 'ditolak' || status === 'mati') {
    // Dapat ditekan: minta izin lagi / buka Pengaturan / cari GPS lagi.
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status === 'ditolak' ? 'Izinkan lokasi' : 'Cari GPS lagi'}
        onPress={() => void perbaikiLokasi()}
        hitSlop={6}
        style={styles.pil}>
        <Ionicons name="warning" size={14} color="#ffcc00" />
        <Text style={styles.hudAkurasi}>{status === 'ditolak' ? 'Lokasi tidak diizinkan' : 'GPS mati'}</Text>
        <Text style={styles.hudAksi}>{status === 'ditolak' ? 'Izinkan' : 'Coba lagi'}</Text>
      </Pressable>
    );
  } else {
    isi = <Text style={styles.hudAkurasi}>Mencari GPS…</Text>;
  }
  return <View style={styles.pil}>{isi}</View>;
}

function TombolBulat({
  ikon,
  label,
  onPress,
}: {
  ikon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={styles.bulat}>
      <Ionicons name={ikon} size={22} color="#fff" />
    </Pressable>
  );
}

function TombolAlat({
  ikon,
  label,
  onPress,
  aktif = false,
  nonaktif = false,
}: {
  ikon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  aktif?: boolean;
  nonaktif?: boolean;
}) {
  const warna = aktif ? Media.limau : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: aktif, disabled: nonaktif }}
      disabled={nonaktif}
      onPress={onPress}
      hitSlop={6}
      style={[styles.tombolAlat, nonaktif && styles.mati]}>
      <Ionicons name={ikon} size={25} color={warna} style={styles.bayangIkon} />
      <Text style={[styles.labelAlat, { color: warna }]}>{label}</Text>
    </Pressable>
  );
}

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "Sel, 14 Okt 2026 · 14:32:05" — diformat manual supaya tidak bergantung Intl di Hermes. */
function jamTeks(ms: number): string {
  const d = new Date(ms);
  const dua = (n: number) => String(n).padStart(2, '0');
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()} · ${dua(d.getHours())}:${dua(d.getMinutes())}:${dua(d.getSeconds())}`;
}

const bayangan = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

const styles = StyleSheet.create({
  layar: {
    flex: 1,
    backgroundColor: '#000',
  },
  izin: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
    backgroundColor: Media.latar,
  },
  izinJudul: {
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 22,
  },
  izinTeks: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  izinTombol: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  izinGalat: {
    color: '#ff8a80',
  },
  // .capture-shade: gelap di atas & bawah supaya kontrol terbaca.
  atas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))',
  },
  barisAtas: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pengisi: {
    width: 40,
  },
  judulKepala: {
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 12,
    letterSpacing: 1.8,
  },
  bulat: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Media.kacaTebal,
  },
  pilRekam: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  hudLabel: {
    color: '#fff',
    fontFamily: Fonts.judulTebal,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  hudKoordinat: {
    color: '#fff',
    fontFamily: Fonts.mono,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  hudAkurasi: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
  hudAksi: {
    color: Media.limau,
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  jam: {
    color: '#fff',
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    ...bayangan,
  },
  teksRekam: {
    color: '#fff',
    fontFamily: Fonts.bold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  panduan: {
    position: 'absolute',
    top: '26%',
    alignSelf: 'center',
    width: '70%',
    alignItems: 'center',
  },
  bingkai: {
    alignSelf: 'stretch',
    height: 180,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 22,
  },
  teksPanduan: {
    marginTop: 12,
    color: '#fff',
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    ...bayangan,
  },
  alat: {
    position: 'absolute',
    right: 14,
    top: '30%',
    gap: 16,
  },
  tombolAlat: {
    alignItems: 'center',
    gap: 3,
  },
  bayangIkon: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  labelAlat: {
    fontFamily: Fonts.semibold,
    fontSize: 10.5,
    ...bayangan,
  },
  bawah: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.five,
    gap: Spacing.three,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.7))',
  },
  pesan: {
    alignSelf: 'center',
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    backgroundColor: '#29332d',
  },
  pesanGalat: {
    backgroundColor: 'rgba(200,65,53,0.95)',
  },
  pesanTeks: {
    color: '#eff6eb',
    fontFamily: Fonts.medium,
    fontSize: 13,
    textAlign: 'center',
  },
  pilZoom: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Media.kacaTebal,
  },
  relZoom: {
    width: 90,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  isiRelZoom: {
    height: '100%',
    backgroundColor: Media.limau,
  },
  teksZoom: {
    color: '#fff',
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  // .capture-modes: LIVE · FOTO · VIDEO, terpilih putih + titik limau.
  pilihMode: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
  },
  tombolMode: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  mode: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: Fonts.judul,
    fontSize: 12,
    letterSpacing: 1.2,
    ...bayangan,
  },
  modeAktif: {
    color: '#fff',
  },
  titikMode: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Media.limau,
  },
  tersembunyi: {
    opacity: 0,
  },
  barisRana: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sisi: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  galeri: {
    width: 46,
    height: 46,
    padding: 3,
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gambarGaleri: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  labelSisi: {
    color: '#fff',
    fontFamily: Fonts.semibold,
    fontSize: 11,
    ...bayangan,
  },
  hitungan: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: Media.limau,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitunganTeks: {
    color: Media.onLimau,
    fontFamily: Fonts.judulTebal,
    fontSize: 11,
  },
  // .shutter: cincin putih, isi limau (video: merah; merekam: kotak merah).
  rana: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: '#fff',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ranaDalam: {
    width: '100%',
    height: '100%',
    borderRadius: 33,
    backgroundColor: Media.limau,
  },
  ranaRekam: {
    width: 30,
    height: 30,
    borderRadius: 7,
  },
  mati: {
    opacity: 0.4,
  },
  lanjut: {
    paddingHorizontal: 18,
    height: 40,
    borderRadius: Radius.medium,
    backgroundColor: Media.limau,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teksLanjut: {
    color: Media.onLimau,
    fontFamily: Fonts.judulTebal,
    fontSize: 14,
  },
  durasi: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
});
