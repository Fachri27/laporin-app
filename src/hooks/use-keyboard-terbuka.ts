import { useEffect, useState } from 'react';
import { Dimensions, Keyboard } from 'react-native';

/** Tinggi keyboard yang sedang tampil dalam dp, 0 bila tertutup. */
export function useTinggiKeyboard(): number {
  const [tinggi, setTinggi] = useState(() => (Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0));
  useEffect(() => {
    const tampil = Keyboard.addListener('keyboardDidShow', (e) => setTinggi(e.endCoordinates.height));
    const sembunyi = Keyboard.addListener('keyboardDidHide', () => setTinggi(0));
    return () => {
      tampil.remove();
      sembunyi.remove();
    };
  }, []);
  return tinggi;
}

/**
 * Apakah keyboard sedang tampil. Dipakai kaki formulir: saat keyboard terbuka, ruang aman
 * bawah (bilah navigasi/gestur) sudah tertutup keyboard, jadi tidak perlu jarak tambahan.
 */
export function useKeyboardTerbuka(): boolean {
  return useTinggiKeyboard() > 0;
}

/**
 * Seberapa tinggi keyboard menutupi tepi bawah layar, dalam dp (0 bila tertutup) — untuk lembar
 * (formSheet) yang menempel di bawah layar tetapi tidak naik sendiri di atas keyboard. Dihitung
 * dari batas atas keyboard (`screenY`), bukan dari `height`: di Android React Native melaporkan
 * tinggi keyboard dikurangi bilah navigasi, padahal di edge-to-edge keyboard juga menutupi area itu.
 */
export function useRuangKeyboard(): number {
  const [ruang, setRuang] = useState(0);
  useEffect(() => {
    const tampil = Keyboard.addListener('keyboardDidShow', (e) =>
      setRuang(Math.max(0, Math.round(Dimensions.get('screen').height - e.endCoordinates.screenY))),
    );
    const sembunyi = Keyboard.addListener('keyboardDidHide', () => setRuang(0));
    return () => {
      tampil.remove();
      sembunyi.remove();
    };
  }, []);
  return ruang;
}
