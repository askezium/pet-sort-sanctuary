import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  HABITATS, HABITAT_LEVELS, PERSONALITY_EMOJI, SPECIES, petById, type HabitatDef,
} from '../meta/data';
import {
  canUnlockHabitat, canUpgradeHabitat, collectProduction, dailyStatus, habitatCapacity, highestUnlockedLevel,
  mainGoal, pendingProduction, petsIn, playerLevel, unlockHabitat,
} from '../meta/game';
import { useNav } from '../nav';
import { track } from '../services/analytics';
import { update, useSave } from '../store';
import { Text, Bar, Btn, C, IconBtn, PetImage, Pill, shadow } from '../ui/kit';

/** The daily-reward popup greets the player once per app launch, not on every return to the hub. */
let dailyPopupShown = false;

function Wanderer({ species, sleepy, seed, range }: { species: number; sleepy: boolean; seed: number; range: number }) {
  const x = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (sleepy) {
      const l = Animated.loop(Animated.sequence([
        Animated.timing(bob, { toValue: -3, duration: 1400, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]));
      l.start();
      return () => l.stop();
    }
    const dur = 2200 + (seed % 5) * 500;
    const l = Animated.loop(Animated.sequence([
      Animated.timing(x, { toValue: range, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(x, { toValue: -range, duration: dur * 1.6, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const b = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: -5, duration: 260 + (seed % 3) * 60, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 260 + (seed % 3) * 60, useNativeDriver: true }),
    ]));
    l.start();
    b.start();
    return () => { l.stop(); b.stop(); };
  }, [x, bob, sleepy, seed, range]);
  return (
    <Animated.View style={{ transform: [{ translateX: x }, { translateY: bob }], marginHorizontal: 2 }}>
      <PetImage species={species} size={40} />
      {sleepy ? <Text style={{ position: 'absolute', top: -10, right: -6, fontSize: 14 }}>💤</Text> : null}
    </Animated.View>
  );
}

function Flyer({ emoji, top, dur, delay }: { emoji: string; top: number; dur: number; delay: number }) {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(-60)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(x, { toValue: width + 60, duration: dur, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(x, { toValue: -60, duration: 0, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [x, width, dur, delay]);
  return <Animated.Text pointerEvents="none" style={{ position: 'absolute', top, fontSize: 26, transform: [{ translateX: x }] }}>{emoji}</Animated.Text>;
}

export default function Home() {
  const nav = useNav();
  const s = useSave();
  const { width } = useWindowDimensions();
  const now = Date.now();
  const lvl = playerLevel(s.xp);
  const next = highestUnlockedLevel(s);
  const daily = dailyStatus(s, now);
  const taskReady = s.tasks.list.some((t) => !t.claimed && t.progress >= t.target) || (s.tasks.list.length > 0 && s.tasks.list.every((t) => t.claimed) && !s.tasks.bonusClaimed);
  const eggCount = s.eggs.common + s.eggs.rare + s.eggs.epic;
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    track('sanctuary_visit');
    const t = setInterval(force, 15000);
    return () => clearInterval(t);
  }, []);
  // Priority popup for returning players with a daily reward waiting.
  useEffect(() => {
    if (!dailyPopupShown && s.tutorialDone && dailyStatus(s, Date.now()).claimable) {
      dailyPopupShown = true;
      const t = setTimeout(() => nav.openIfIdle({ type: 'daily' }), 600);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function tapHabitat(h: HabitatDef) {
    const st = s.habitats[h.id];
    if (!st.unlocked) {
      if (canUnlockHabitat(s, h.id)) {
        update((x) => unlockHabitat(x, h.id, Date.now()));
        track('habitat_unlocked', { habitat: h.id });
        nav.toast(`${h.name} unlocked! 🎉`);
      } else nav.toast(`${h.name} needs ${h.unlockStars} ⭐ (you have ${s.stars})`);
      return;
    }
    nav.open({ type: 'habitat', id: h.id });
  }

  const colW = Math.min(width, 520) - 150;

  return (
    <View style={styles.root} testID="home">
      <ScrollView contentContainerStyle={{ paddingTop: 150, paddingBottom: 170, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        {HABITATS.map((h, idx) => {
          const st = s.habitats[h.id];
          const pets = petsIn(s, h.id);
          const cap = st.unlocked ? habitatCapacity(s, h.id) : 0;
          const canUp = st.unlocked && canUpgradeHabitat(s, h.id);
          const prod = pendingProduction(s, h.id, now);
          const unlockable = !st.unlocked && canUnlockHabitat(s, h.id);
          return (
            <Pressable key={h.id} onPress={() => tapHabitat(h)} testID={`habitat-${h.id}`} accessibilityLabel={h.name} style={{ alignSelf: idx % 2 ? 'flex-end' : 'flex-start', marginHorizontal: 72, marginVertical: 8 }}>
              <View style={[styles.card, { width: colW, backgroundColor: st.unlocked ? h.color : '#D8D2C8', opacity: st.unlocked ? 1 : 0.85 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 44 }}>{st.unlocked ? h.emoji : '🔒'}</Text>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.cardTitle}>{h.name}</Text>
                    {st.unlocked ? (
                      <Text style={styles.cardSub}>{HABITAT_LEVELS[st.level].name} · {pets.length}/{cap}</Text>
                    ) : (
                      <Text style={styles.cardSub}>{unlockable ? 'Tap to unlock!' : `Needs ${h.unlockStars} ⭐ (${s.stars})`}</Text>
                    )}
                  </View>
                </View>
                {st.unlocked ? (
                  <View style={styles.yard}>
                    {pets.length === 0 ? <Text style={styles.cardSub}>No pets yet — open eggs to find some!</Text> : null}
                    {pets.slice(0, 5).map((pid, i) => {
                      const pet = petById(pid);
                      return <Wanderer key={pid} species={pet.species} sleepy={pet.personality === 'sleepy'} seed={i + pid.length} range={14 + i * 3} />;
                    })}
                  </View>
                ) : null}
                {canUp ? <View style={[styles.flag, { right: 8 }]}><Text style={styles.flagText}>⬆ Upgrade</Text></View> : null}
                {prod >= 5 ? (
                  <Pressable style={[styles.flag, { left: 8, backgroundColor: C.yellow }]} onPress={() => { update((x) => collectProduction(x, h.id, Date.now())); nav.toast(`Collected ${prod} coins 🪙`); }} accessibilityLabel="Collect coins" testID={`collect-${h.id}`}>
                    <Text style={[styles.flagText, { color: C.ink }]}>🪙 {prod}</Text>
                  </Pressable>
                ) : null}
                {unlockable ? <View style={[styles.flag, { right: 8, backgroundColor: C.green }]}><Text style={styles.flagText}>Unlock!</Text></View> : null}
              </View>
            </Pressable>
          );
        })}
        <Text style={styles.footer}>More land opens as you earn ⭐</Text>
      </ScrollView>

      <Flyer emoji="🕊️" top={190} dur={14000} delay={0} />
      <Flyer emoji="🦋" top={330} dur={19000} delay={3000} />
      <Flyer emoji="🍃" top={460} dur={23000} delay={6000} />

      {/* top HUD */}
      <View style={styles.hud} pointerEvents="box-none">
        <View style={styles.levelBox}>
          <Text style={styles.lvlText}>Lv {lvl.level}</Text>
          <View style={{ width: 70 }}><Bar value={lvl.into} max={lvl.need} color={C.sky} /></View>
        </View>
        <View style={styles.goal}>
          <Text style={styles.goalText} numberOfLines={2}>{mainGoal(s)}</Text>
        </View>
        <Pressable onPress={() => nav.open({ type: 'settings' })} style={styles.gear} accessibilityLabel="Settings" accessibilityRole="button" testID="settings">
          <Text style={{ fontSize: 26 }}>⚙️</Text>
        </Pressable>
      </View>

      {/* rails */}
      <View style={[styles.rail, { left: 8 }]} pointerEvents="box-none">
        <IconBtn icon="🥚" label="Eggs" badge={eggCount || undefined} onPress={() => nav.open({ type: 'egg' })} testID="rail-eggs" />
      </View>
      <View style={[styles.rail, { right: 8 }]} pointerEvents="box-none">
        <IconBtn icon="📋" label="Tasks" badge={taskReady} onPress={() => nav.open({ type: 'tasks' })} testID="rail-tasks" />
        <IconBtn icon="🔥" label="Streak" badge={daily.claimable} onPress={() => nav.open({ type: 'daily' })} testID="rail-daily" />
        <IconBtn icon="🗺️" label="Map" onPress={() => nav.go({ name: 'map' })} testID="rail-map" />
      </View>

      {/* bottom bar */}
      <View style={styles.bottom} pointerEvents="box-none">
        <View style={styles.pills} pointerEvents="none">
          <Pill icon="🪙" value={s.coins} />
          <Pill icon="💎" value={s.gems} />
        </View>
        <View style={{ alignItems: 'center', width: '100%' }}>
          <Btn label={s.totals.levelsCompleted === 0 ? 'Start Rescue ▶' : `Play Level ${next}`} big onPress={() => nav.go({ name: 'level', id: next })} testID="play" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  hud: { position: 'absolute', top: Platform.OS === 'web' ? 8 : 40, left: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelBox: { backgroundColor: C.cream, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6, minHeight: 48, justifyContent: 'center', borderWidth: 3, borderColor: C.outline, ...shadow },
  lvlText: { fontWeight: '900', fontSize: 16, color: C.ink },
  goal: { flex: 1, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6, minHeight: 48, justifyContent: 'center', ...shadow },
  goalText: { fontWeight: '800', fontSize: 12, color: C.ink, textAlign: 'center' },
  gear: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', ...shadow },
  rail: { position: 'absolute', top: 110, width: 56 },
  bottom: { position: 'absolute', bottom: Platform.OS === 'web' ? 10 : 26, left: 8, right: 8, alignItems: 'center' },
  pills: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 4 },
  card: { borderRadius: 26, padding: 12, borderWidth: 4, borderColor: C.outline, ...shadow },
  cardTitle: { fontSize: 17, fontWeight: '900', color: C.ink },
  cardSub: { fontSize: 12, fontWeight: '700', color: C.inkSoft },
  yard: { marginTop: 8, minHeight: 44, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 16, paddingVertical: 4, overflow: 'hidden' },
  flag: { position: 'absolute', top: -12, backgroundColor: C.orange, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: C.outline },
  flagText: { color: C.white, fontWeight: '900', fontSize: 12 },
  footer: { marginTop: 14, fontWeight: '800', color: 'rgba(60,80,50,0.7)' },
});
