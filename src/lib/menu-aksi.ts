import { ActionSheetIOS, Alert, Platform } from 'react-native';

export type PilihanMenu = { label: string; aksi: () => void; merusak?: boolean };

/**
 * Menu aksi singkat (mis. tekan lama): lembar aksi bawaan iOS, dialog di
 * Android. Dialog Android memuat paling banyak tiga tombol, jadi pilihan
 * dibatasi dua + Batal.
 */
export function tampilkanMenu(judul: string, pilihan: PilihanMenu[]) {
  const dua = pilihan.slice(0, 2);
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: judul,
        options: [...dua.map((p) => p.label), 'Batal'],
        cancelButtonIndex: dua.length,
        destructiveButtonIndex: dua.flatMap((p, i) => (p.merusak ? [i] : [])),
      },
      (i) => dua[i]?.aksi(),
    );
    return;
  }
  Alert.alert(judul, undefined, [
    { text: 'Batal', style: 'cancel' },
    ...dua.map((p) => ({ text: p.label, style: p.merusak ? ('destructive' as const) : ('default' as const), onPress: p.aksi })),
  ]);
}
