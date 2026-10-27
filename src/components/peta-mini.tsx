import { Platform, StyleSheet } from 'react-native';
import MapView, { type MapStyleElement } from 'react-native-maps';

import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Gaya Google Maps (Android) untuk mode gelap, sewarna tinta desain: daratan tinta, jalan
 * tulang samar, label redup, ikon tempat disembunyikan. Apple Maps (iOS) mengikuti mode HP sendiri.
 */
const GAYA_GELAP: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#161817' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#979590' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0C0E0D' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#30312F' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2C2D2B' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A0B0B' }] },
];

/**
 * Pratinjau peta di kartu lokasi formulir: berpusat di titik laporan, tidak
 * bisa digeser — titiknya diubah lewat kartu lokasi; penanda & pil akurasi digambar di atasnya
 * oleh kartu-lokasi.tsx. Dimuat malas di sana, hanya bila peta tersedia di build ini
 * (lib/peta-tersedia.ts).
 */
export default function PetaMini({ lat, lng }: { lat: number; lng: number }) {
  const gelap = useColorScheme() === 'dark';
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      region={{ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      customMapStyle={Platform.OS === 'android' && gelap ? GAYA_GELAP : undefined}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      showsUserLocation={false}
      showsCompass={false}
      pointerEvents="none"
    />
  );
}
