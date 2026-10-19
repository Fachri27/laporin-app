import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

/** Titik berdenyut penanda data live (GPS aktif / sedang merekam). */
export function TitikLive({ warna, berdenyut = true, ukuran = 8 }: { warna: string; berdenyut?: boolean; ukuran?: number }) {
  const [denyut] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!berdenyut) {
      denyut.setValue(0);
      return;
    }
    const putaran = Animated.loop(
      Animated.timing(denyut, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    putaran.start();
    return () => putaran.stop();
  }, [berdenyut, denyut]);

  return (
    <View style={{ width: ukuran * 2, height: ukuran * 2, alignItems: 'center', justifyContent: 'center' }}>
      {berdenyut && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: ukuran,
              backgroundColor: warna,
              opacity: denyut.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: denyut.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }],
            },
          ]}
        />
      )}
      <View style={{ width: ukuran, height: ukuran, borderRadius: ukuran / 2, backgroundColor: warna }} />
    </View>
  );
}
