import { useEffect, useRef, type RefObject } from 'react';
import {
  Keyboard,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

/**
 * Isian yang sedang diketik tetap terlihat setelah keyboard muncul.
 *
 * Pasangan KeyboardAvoidingView behavior="padding" di akar layar. Android edge-to-edge
 * (wajib sejak SDK 54) tidak lagi mengecilkan jendela saat keyboard muncul — seperti iOS,
 * aplikasi yang harus memberi ruang. KAV mengecilkan ScrollView setinggi keyboard; hook ini
 * lalu menggulir ScrollView sampai isian yang fokus masuk ke area yang tersisa. Posisi
 * dibandingkan dalam koordinat layar, jadi bilah atas di atas ScrollView tidak mengacaukannya.
 *
 * Kembalikan props untuk disebar ke ScrollView yang sama.
 */
export function useGulirKeIsian(gulir: RefObject<ScrollView | null>, jarak = 24) {
  const offset = useRef(0);

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      clearTimeout(id);
      // KAV menerapkan padding dari event yang sama: tunggu tata letak barunya selesai.
      id = setTimeout(() => {
        const isian = TextInput.State.currentlyFocusedInput();
        const wadah = gulir.current?.getNativeScrollRef();
        if (!isian || !wadah) return;
        isian.measureInWindow((_x, atasIsian, _w, tinggiIsian) => {
          wadah.measureInWindow((_sx, atasWadah, _sw, tinggiWadah) => {
            const kurang = atasIsian + tinggiIsian + jarak - (atasWadah + tinggiWadah);
            const lebih = atasWadah + jarak - atasIsian;
            if (kurang > 0) gulir.current?.scrollTo({ y: offset.current + kurang, animated: true });
            else if (lebih > 0) gulir.current?.scrollTo({ y: Math.max(0, offset.current - lebih), animated: true });
          });
        });
      }, 120);
    });
    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, [gulir, jarak]);

  return {
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
    },
    scrollEventThrottle: 32,
  };
}
