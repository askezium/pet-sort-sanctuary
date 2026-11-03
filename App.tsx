import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Collection from './src/screens/Collection';
import Home from './src/screens/Home';
import LevelScreen from './src/screens/LevelScreen';
import MapScreen from './src/screens/MapScreen';
import { ModalHost } from './src/screens/Modals';
import Shop from './src/screens/Shop';
import Splash from './src/screens/Splash';
import { NavProvider, useNav } from './src/nav';
import { registerAdHost } from './src/services/ads';
import { recentEvents } from './src/services/analytics';
import { getSave } from './src/store';
import { Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { useFonts } from 'expo-font';
import { Text, Btn, C, Overlay, Panel, PawBg, Toast } from './src/ui/kit';
import TabBar from './src/ui/TabBar';

/** Simulated rewarded-ad screen. Replace with a real ad SDK behind src/services/ads.ts. */
function AdHost() {
  const [ad, setAd] = useState<{ done: (ok: boolean) => void; left: number } | null>(null);
  useEffect(() => {
    registerAdHost(() => new Promise<boolean>((resolve) => setAd({ done: resolve, left: 3 })));
    return () => registerAdHost(null);
  }, []);
  useEffect(() => {
    if (!ad || ad.left <= 0) return;
    const t = setTimeout(() => setAd({ ...ad, left: ad.left - 1 }), 1000);
    return () => clearTimeout(t);
  }, [ad]);
  if (!ad) return null;
  const close = (ok: boolean) => {
    ad.done(ok);
    setAd(null);
  };
  return (
    <Overlay dim={0.9}>
      <Panel title="📺 Sample Ad">
        <Text style={styles.adText}>Simulated rewarded ad{'\n'}(no real ads in this prototype)</Text>
        <Btn label={ad.left > 0 ? `Reward in ${ad.left}…` : 'Claim Reward'} disabled={ad.left > 0} onPress={() => close(true)} testID="ad-claim" />
        <Btn small label="Skip (no reward)" color="#B9AFA3" dark="#8E857A" onPress={() => close(false)} testID="ad-skip" />
      </Panel>
    </Overlay>
  );
}

function Router() {
  const { route, toastMsg } = useNav();
  return (
    <View style={styles.frame}>
      <PawBg />
      <View style={{ flex: 1 }}>
        {route.name === 'splash' && <Splash />}
        {route.name === 'home' && <Home />}
        {route.name === 'map' && <MapScreen />}
        {route.name === 'level' && <LevelScreen key={route.id} id={route.id} />}
        {route.name === 'shop' && <Shop />}
        {route.name === 'collection' && <Collection />}
      </View>
      {(route.name === 'home' || route.name === 'shop' || route.name === 'collection') && <TabBar />}
      <ModalHost />
      <AdHost />
      <Toast message={toastMsg} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold });
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Handle for automated checks: readable state without poking the DOM.
      (globalThis as unknown as Record<string, unknown>).__pss = {
        save: () => getSave(),
        events: () => recentEvents(),
      };
    }
  }, []);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.page }} />;
  return (
    <NavProvider>
      <StatusBar style="dark" />
      <View style={styles.outer}>
        <Router />
      </View>
    </NavProvider>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#2B2118', alignItems: 'center' },
  frame: { flex: 1, width: '100%', maxWidth: 560, backgroundColor: C.page, overflow: 'hidden' },
  adText: { fontSize: 16, fontWeight: '800', color: C.ink, textAlign: 'center', marginVertical: 14 },
});
