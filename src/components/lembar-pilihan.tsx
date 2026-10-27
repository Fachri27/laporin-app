import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TombolIkon } from '@/components/bilah-atas';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Pilihan<T extends string> = { nilai: T; label: string; keterangan?: string };

type Props<T extends string> = {
  terbuka: boolean;
  judul: string;
  pilihan: Pilihan<T>[];
  dipilih: T;
  onPilih: (nilai: T) => void;
  onTutup: () => void;
};

/**
 * Lembar dari bawah berisi daftar pilihan (mis. pulau di Peta): panel bersudut 28 di atas
 * selubung gelap, pegangan, judul huruf judul dan tombol tutup bulat bergaris.
 * Menu bawaan Android hanya memuat tiga tombol, jadi daftar panjang memakai lembar ini.
 */
export function LembarPilihan<T extends string>({ terbuka, judul, pilihan, dipilih, onPilih, onTutup }: Props<T>) {
  const w = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={terbuka} transparent animationType="slide" onRequestClose={onTutup}>
      <Pressable style={styles.selubung} onPress={onTutup} accessibilityLabel="Tutup" />
      <View style={[styles.lembar, { backgroundColor: w.surface, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.pegangan, { backgroundColor: w.borderStrong }]} />
        <View style={styles.kepala}>
          <Text style={[styles.judul, { color: w.text }]} accessibilityRole="header">
            {judul}
          </Text>
          <TombolIkon ikon="x" label="Tutup" onPress={onTutup} />
        </View>
        <ScrollView style={styles.daftar}>
          {pilihan.map((p) => {
            const pilih = p.nilai === dipilih;
            return (
              <Pressable
                key={p.nilai}
                accessibilityRole="button"
                accessibilityState={{ selected: pilih }}
                onPress={() => {
                  onPilih(p.nilai);
                  onTutup();
                }}
                style={({ pressed }) => [styles.baris, { borderBottomColor: w.border }, pressed && styles.ditekan]}>
                <View style={styles.fleks}>
                  <Text style={[styles.label, { color: w.text }, pilih && styles.labelPilih]}>{p.label}</Text>
                  {p.keterangan && <Text style={[styles.keterangan, { color: w.textSecondary }]}>{p.keterangan}</Text>}
                </View>
                {pilih && (
                  <View style={[styles.centang, { backgroundColor: w.accent }]}>
                    <Feather name="check" size={13} color={w.onAccent} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // .sheet-wrap: selubung gelap di kedua tema.
  selubung: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  lembar: {
    maxHeight: '70%',
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  pegangan: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    marginBottom: 14,
  },
  kepala: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  judul: {
    flex: 1,
    fontFamily: Fonts.judulTebal,
    fontSize: 22,
    lineHeight: 27,
    paddingTop: 2,
  },
  daftar: {
    flexGrow: 0,
  },
  fleks: {
    flex: 1,
  },
  ditekan: {
    opacity: 0.7,
  },
  baris: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontFamily: Fonts.semibold,
    fontSize: 15,
  },
  labelPilih: {
    fontFamily: Fonts.bold,
  },
  keterangan: {
    marginTop: 2,
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.5,
  },
  // Lencana centang sinyal untuk yang terpilih.
  centang: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
