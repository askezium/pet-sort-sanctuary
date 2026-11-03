import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useNav } from '../nav';
import { loadSave } from '../store';
import { C, PetImage, Text } from '../ui/kit';

const OFFSETS: [number, number][] = [
  [-4, 0], [4, 0], [0, -4], [0, 4], [-3, -3], [3, -3], [-3, 3], [3, 3],
];

/** Puffy sticker lettering: the word drawn several times in the outline colour behind the fill colour. */
function StickerWord({ word, color, size }: { word: string; color: string; size: number }) {
  const base = { fontSize: size, fontWeight: '900' as const, letterSpacing: 2 };
  return (
    <View style={{ marginVertical: -4 }}>
      {OFFSETS.map(([dx, dy], i) => (
        <Text key={i} style={[base, styles.ghost, { color: C.outline, left: dx, top: dy }]}>{word}</Text>
      ))}
      <Text style={[base, { color }]}>{word}</Text>
    </View>
  );
}

export default function Splash() {
  const nav = useNav();
  const p = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    const bar = new Promise<void>((res) => Animated.timing(p, { toValue: 1, duration: 1300, useNativeDriver: false }).start(() => res()));
    // Dev aid on web: open the app with #hold-splash to keep this screen up for visual checks.
    const hold = typeof location !== 'undefined' && location.hash === '#hold-splash';
    Promise.all([loadSave(), bar]).then(() => alive && !hold && nav.go({ name: 'home' }));
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bounce, { toValue: -8, duration: 450, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]));
    loop.start();
    return () => { alive = false; loop.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={styles.root} testID="splash">
      <Animated.View style={[styles.pets, { transform: [{ translateY: bounce }] }]}>
        <PetImage species={0} size={92} />
        <PetImage species={4} size={92} />
        <PetImage species={6} size={92} />
      </Animated.View>
      <StickerWord word="PET" color={C.yellow} size={64} />
      <StickerWord word="SORT" color={C.pink} size={64} />
      <StickerWord word="SANCTUARY" color={C.sky} size={44} />
      <Text style={styles.loading}>LOADING…</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: p.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
      <Text style={styles.tag}>Sort. Rescue. Rebuild.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  pets: { flexDirection: 'row', marginBottom: 14 },
  ghost: { position: 'absolute' },
  loading: { marginTop: 40, fontSize: 18, fontWeight: '900', color: C.ink, letterSpacing: 1 },
  track: { width: 240, height: 22, borderRadius: 11, borderWidth: 3, borderColor: C.outline, backgroundColor: C.cream, marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.orange },
  tag: { marginTop: 12, fontWeight: '700', color: C.inkSoft },
});
