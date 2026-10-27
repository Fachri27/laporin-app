import { Tabs } from 'expo-router/js-tabs';

import { BilahBawah } from '@/components/bilah-bawah';

export default function LayoutTab() {
  return (
    <Tabs tabBar={(props) => <BilahBawah {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="peta" options={{ title: 'Peta' }} />
      <Tabs.Screen name="siaran" options={{ title: 'Live' }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
