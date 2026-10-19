import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

export type HatiKetuk = { id: number; x: number; y: number; miring: number };

/** Hati besar di titik ketuk-ganda, seperti saat menyukai video di TikTok. */
export function HatiKetukGanda({ hati: h, onSelesai }: { hati: HatiKetuk; onSelesai: (id: number) => void }) {
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animasi = Animated.timing(t, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animasi.start(({ finished }) => {
      if (finished) onSelesai(h.id);
    });
    return () => animasi.stop();
  }, [t, h.id, onSelesai]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.hati,
        {
          left: h.x - 50,
          top: h.y - 50,
          opacity: t.interpolate({ inputRange: [0, 0.1, 0.65, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { rotate: `${h.miring}deg` },
            { scale: t.interpolate({ inputRange: [0, 0.15, 0.3, 1], outputRange: [0.4, 1.25, 1, 1.1] }) },
            { translateY: t.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0, 0, -60] }) },
          ],
        },
      ]}>
      <Ionicons name="heart" size={100} color="#ff2d55" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hati: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
