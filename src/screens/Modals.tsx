import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { mulberry32 } from '../core/rng';
import {
  DAILY_REWARDS, HABITAT_LEVELS, PERSONALITY_EMOJI, RARITY_COLOR, SPECIES, habitatById, petById,
} from '../meta/data';
import {
  TASK_BONUS, TASK_LABEL, TASK_REWARD_COINS, canUpgradeHabitat, claimDaily, claimTask, claimTaskBonus,
  collectProduction, dailyStatus, feedPet, habitatCapacity, openEgg, pendingProduction, petsIn, placePet,
  unplacePet, upgradeCost, upgradeHabitat, type EggKind, type EggResult,
} from '../meta/game';
import { useNav } from '../nav';
import { showRewarded } from '../services/ads';
import { track } from '../services/analytics';
import { resetSave, update, useSave } from '../store';
import { Text, Btn, C, Overlay, Panel, PetImage, haptic } from '../ui/kit';

export function ModalHost() {
  const { modal, close } = useNav();
  if (!modal) return null;
  switch (modal.type) {
    case 'habitat': return <HabitatPanel id={modal.id} onClose={close} />;
    case 'egg': return <EggOpen kind={modal.kind} onClose={close} />;
    case 'daily': return <Daily onClose={close} />;
    case 'tasks': return <Tasks onClose={close} />;
    case 'settings': return <Settings onClose={close} />;
  }
}

function HabitatPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useSave();
  const nav = useNav();
  const def = habitatById(id);
  const st = s.habitats[id];
  const pets = petsIn(s, id);
  const cap = habitatCapacity(s, id);
  const cost = upgradeCost(s, id);
  const prod = pendingProduction(s, id, Date.now());
  const can = canUpgradeHabitat(s, id);
  return (
    <Overlay onClose={onClose}>
      <Panel title={`${def.emoji} ${def.name}`} onClose={onClose}>
        <Text style={styles.sub}>{HABITAT_LEVELS[st.level].name} · Lv {st.level + 1}</Text>
        <View style={styles.avatars}>
          {pets.map((pid) => {
            const p = petById(pid);
            const fed = s.fed[pid] === Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
            return (
              <View key={pid} style={{ alignItems: 'center', margin: 4 }}>
                <View style={[styles.avatar, { backgroundColor: SPECIES[p.species].color, borderColor: RARITY_COLOR[p.rarity] }]}>
                  <PetImage species={p.species} size={46} />
                </View>
                <Text style={styles.petName}>{p.name}</Text>
                <Btn small label={fed ? 'Fed ✓' : 'Feed 🍖'} disabled={fed} color={C.pink} dark="#D9588A" onPress={() => { if (update((x) => feedPet(x, pid, Date.now()))) nav.toast(`${p.name} loved it! +5 🪙`); }} style={{ minWidth: 70 }} />
              </View>
            );
          })}
          {pets.length === 0 ? <Text style={styles.sub}>Empty. Open an egg, then tap "Place Pet".</Text> : null}
        </View>
        <Text style={styles.line}>Capacity {pets.length}/{cap}{pets.length >= cap ? ' · Habitat Full' : ''}</Text>
        {HABITAT_LEVELS[st.level].coinsPerMin > 0 ? (
          <Btn label={prod > 0 ? `Collect 🪙 ${prod}` : 'Producing coins…'} disabled={prod <= 0} color={C.yellow} dark="#D9AD14" onPress={() => { update((x) => collectProduction(x, id, Date.now())); nav.toast(`+${prod} coins`); }} />
        ) : (
          <Text style={styles.sub}>Upgrade to Cozy to produce coins</Text>
        )}
        {cost ? (
          <>
            <Btn
              label={`Upgrade 🪙${cost.coins} 🧱${cost.materials}`}
              color={can ? C.green : C.orange}
              dark={can ? C.greenDark : C.orangeDark}
              onPress={() => {
                if (update((x) => upgradeHabitat(x, id, Date.now()))) {
                  track('habitat_upgraded', { habitat: id, level: st.level + 1 });
                  nav.toast(`${def.name} upgraded! 🎉`);
                } else nav.toast(s.coins < cost.coins ? `Need ${cost.coins - s.coins} more coins — play levels!` : `Need ${cost.materials - s.materials} more 🧱 — earned from levels`);
              }}
              testID="upgrade"
            />
            <Text style={styles.sub}>Next: {HABITAT_LEVELS[st.level + 1].name} holds {HABITAT_LEVELS[st.level + 1].capacity}</Text>
          </>
        ) : <Text style={styles.line}>Max level reached ✨</Text>}
      </Panel>
    </Overlay>
  );
}

function EggOpen({ kind, onClose }: { kind?: EggKind; onClose: () => void }) {
  const s = useSave();
  const nav = useNav();
  const order: EggKind[] = ['epic', 'rare', 'common'];
  const [chosen, setChosen] = useState<EggKind | null>(kind ?? null);
  const active = chosen && s.eggs[chosen] > 0 ? chosen : order.find((k) => s.eggs[k] > 0) ?? null;
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [res, setRes] = useState<EggResult | null>(null);
  const [lastKind, setLastKind] = useState<EggKind | null>(null);
  const wobble = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;

  function tapEgg() {
    if (!active) return;
    if (stage === 0) {
      haptic('tap');
      setStage(1);
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -1, duration: 140, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 90, useNativeDriver: true }),
      ]).start();
      return;
    }
    if (stage === 1) {
      let out: EggResult | null = null;
      const ok = update((x) => {
        const r = openEgg(x, active, mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0));
        if (!r) return null;
        out = r.result;
        return r.save;
      });
      if (!ok || !out) return;
      const r = out as EggResult;
      setRes(r);
      setLastKind(active);
      setStage(2);
      reveal.setValue(0);
      Animated.spring(reveal, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 14 }).start();
      haptic('good');
      track('egg_opened', { kind: active, rarity: r.pet.rarity });
      track(r.duplicate ? 'duplicate_pet_received' : 'pet_collected', { pet: r.pet.id });
    }
  }

  function again() {
    setRes(null);
    setStage(0);
  }

  const spark = res ? { common: 1, rare: 5, epic: 9, legendary: 14 }[res.pet.rarity] : 0;
  const sparkles = Array.from({ length: spark }).map((_, i) => (
    <Text key={i} style={{ position: 'absolute', fontSize: 20, left: 130 + Math.cos(i * 2.4) * (70 + (i % 3) * 22), top: 60 + Math.sin(i * 2.4) * (60 + (i % 2) * 24) }}>{['✨', '⭐', '💫'][i % 3]}</Text>
  ));

  return (
    <Overlay dim={0.75} onClose={stage === 2 || !active ? onClose : undefined}>
      <Panel title={stage === 2 ? (res?.duplicate ? 'Old Friend!' : 'New Pet!') : active ? 'Tap the egg!' : 'No Eggs'} onClose={onClose}>
        {!active && stage !== 2 ? (
          <>
            <Text style={{ fontSize: 60 }}>🥚</Text>
            <Text style={styles.line}>Win levels, claim daily rewards, or visit the shop to get eggs.</Text>
          </>
        ) : stage < 2 && active ? (
          <>
            <Text style={styles.sub}>{active.toUpperCase()} EGG · you have {s.eggs[active]}</Text>
            <View style={styles.eggRow}>
              {order.map((k) => s.eggs[k] > 0 ? <Btn key={k} small label={`${k} ×${s.eggs[k]}`} color={k === active ? C.green : '#B9AFA3'} dark={k === active ? C.greenDark : '#8E857A'} onPress={() => { setChosen(k); setStage(0); }} style={{ minWidth: 70 }} /> : null)}
            </View>
            <Animated.Text
              testID="egg"
              onPress={tapEgg}
              accessibilityRole="button"
              accessibilityLabel="Egg"
              style={{ fontSize: 120, marginVertical: 8, transform: [{ rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] }) }, { scale: stage === 1 ? 1.1 : 1 }] }}
            >
              {stage === 1 ? '🐣' : '🥚'}
            </Animated.Text>
            <Text style={styles.line}>{stage === 0 ? 'Tap to crack it' : 'Tap again to reveal!'}</Text>
          </>
        ) : res ? (
          <>
            <View style={{ width: 280, height: 190, alignItems: 'center', justifyContent: 'center' }}>
              {sparkles}
              <Animated.View style={{ transform: [{ scale: reveal }], alignItems: 'center' }}>
                <View style={[styles.portrait, { backgroundColor: SPECIES[res.pet.species].color, borderColor: RARITY_COLOR[res.pet.rarity] }]}>
                  <PetImage species={res.pet.species} size={112} />
                </View>
              </Animated.View>
            </View>
            <Text style={styles.petBig}>{res.pet.name}</Text>
            <Text style={[styles.rarity, { color: RARITY_COLOR[res.pet.rarity] }]}>{res.pet.rarity.toUpperCase()} {SPECIES[res.pet.species].name}</Text>
            <Text style={styles.sub}>{PERSONALITY_EMOJI[res.pet.personality]} {res.pet.personality}</Text>
            {res.duplicate ? <Text style={styles.line}>New Pet Heart +{res.hearts} 💖</Text> : null}
            {!res.duplicate ? (
              <Btn label="Place Pet" testID="place-pet" onPress={() => {
                const r = placePet(s, res.pet.id);
                if ('error' in r) nav.toast(r.error);
                else { update(() => r); nav.toast(`${res.pet.name} moved in! 🏡`); onClose(); }
              }} />
            ) : null}
            {(lastKind && s.eggs[lastKind] > 0) || order.some((k) => s.eggs[k] > 0) ? <Btn label="Open Another" color={C.sky} dark={C.skyDark} onPress={again} testID="open-another" /> : null}
            <Btn label="Done" small color="#B9AFA3" dark="#8E857A" onPress={onClose} testID="egg-done" />
          </>
        ) : null}
      </Panel>
    </Overlay>
  );
}

function Daily({ onClose }: { onClose: () => void }) {
  const s = useSave();
  const nav = useNav();
  const st = dailyStatus(s, Date.now());
  async function claim(doubled: boolean) {
    if (doubled && !(await showRewarded('daily_double'))) return;
    if (update((x) => claimDaily(x, Date.now(), doubled))) {
      track('daily_reward_claimed', { day: st.dayIndex + 1, doubled });
      nav.toast(`Day ${st.dayIndex + 1} reward claimed!`);
    }
  }
  return (
    <Overlay onClose={onClose}>
      <Panel title="Daily Streak 🔥" onClose={onClose} width={360}>
        <Text style={styles.sub}>Current streak: {st.streak} day{st.streak === 1 ? '' : 's'} · missing one day won't reset it</Text>
        <View style={styles.grid}>
          {DAILY_REWARDS.map((r, i) => {
            const done = i < st.dayIndex;
            const today = i === st.dayIndex;
            return (
              <View key={i} style={[styles.dayCell, today && { borderColor: C.orange, backgroundColor: '#FFF1DC' }, done && { opacity: 0.5 }]}>
                <Text style={styles.dayNum}>Day {i + 1}</Text>
                <Text style={{ fontSize: 26 }}>{done ? '✅' : r.icon}</Text>
                <Text style={styles.dayLabel}>{r.label}</Text>
              </View>
            );
          })}
        </View>
        <Btn label={st.claimable ? 'Claim' : 'Come back tomorrow'} disabled={!st.claimable} onPress={() => claim(false)} testID="claim-daily" />
        {st.claimable ? <Btn label="Claim x2 — Watch Ad 📺" color={C.orange} dark={C.orangeDark} small onPress={() => claim(true)} testID="claim-daily-x2" /> : null}
      </Panel>
    </Overlay>
  );
}

function Tasks({ onClose }: { onClose: () => void }) {
  const s = useSave();
  const nav = useNav();
  const allClaimed = s.tasks.list.length > 0 && s.tasks.list.every((t) => t.claimed);
  return (
    <Overlay onClose={onClose}>
      <Panel title="Daily Tasks 📋" onClose={onClose} width={360}>
        {s.tasks.list.map((t) => {
          const done = t.progress >= t.target;
          return (
            <View key={t.id} style={styles.task}>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskText}>{TASK_LABEL[t.kind](t.target)}</Text>
                <Text style={[styles.sub, { textAlign: 'left' }]}>{t.progress}/{t.target}</Text>
              </View>
              <Btn small label={t.claimed ? '✓' : `+${TASK_REWARD_COINS} 🪙`} disabled={!done || t.claimed} onPress={() => { if (update((x) => claimTask(x, t.id))) track('daily_task_claimed', { kind: t.kind }); }} style={{ minWidth: 80 }} />
            </View>
          );
        })}
        <Text style={styles.sub}>Finish all three: +{TASK_BONUS.coins} 🪙, +{TASK_BONUS.gems} 💎 and a Common Egg</Text>
        <Btn label={s.tasks.bonusClaimed ? 'Bonus claimed ✓' : 'Claim Bonus'} disabled={!allClaimed || s.tasks.bonusClaimed} color={C.orange} dark={C.orangeDark} onPress={() => { if (update(claimTaskBonus)) nav.toast('Bonus claimed! 🎁'); }} />
      </Panel>
    </Overlay>
  );
}

function Settings({ onClose }: { onClose: () => void }) {
  const s = useSave();
  const [confirm, setConfirm] = useState(false);
  const row = (label: string, key: 'sound' | 'music' | 'haptics') => (
    <View style={styles.task} key={key}>
      <Text style={[styles.taskText, { flex: 1 }]}>{label}</Text>
      <Btn small label={s.settings[key] ? 'On' : 'Off'} color={s.settings[key] ? C.green : '#B9AFA3'} dark={s.settings[key] ? C.greenDark : '#8E857A'} onPress={() => update((x) => ({ ...x, settings: { ...x.settings, [key]: !x.settings[key] } }))} style={{ minWidth: 70 }} />
    </View>
  );
  return (
    <Overlay onClose={onClose}>
      <Panel title="Settings ⚙️" onClose={onClose} width={360}>
        <ScrollView style={{ maxHeight: 420, width: '100%' }}>
          {row('Sound', 'sound')}
          {row('Music', 'music')}
          {row('Haptics', 'haptics')}
          <Text style={styles.sub}>Audio files are not added yet, so Sound/Music toggles are stored for later.</Text>
          <Text style={[styles.sub, { marginTop: 10 }]}>Pet Sort Sanctuary · prototype build · Expo SDK 58</Text>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Btn small label={confirm ? 'Tap again to erase everything' : 'Reset progress'} color={C.red} dark="#B83A3A" onPress={() => { if (confirm) { resetSave(); setConfirm(false); onClose(); } else setConfirm(true); }} />
          </View>
        </ScrollView>
      </Panel>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 13, fontWeight: '700', color: C.inkSoft, textAlign: 'center', marginVertical: 2 },
  line: { fontSize: 16, fontWeight: '800', color: C.ink, textAlign: 'center', marginVertical: 4 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  petName: { fontSize: 12, fontWeight: '800', color: C.ink },
  eggRow: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  portrait: { width: 130, height: 130, borderRadius: 65, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  petBig: { fontSize: 28, fontWeight: '900', color: C.ink },
  rarity: { fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginVertical: 10 },
  dayCell: { width: 76, paddingVertical: 6, borderRadius: 14, backgroundColor: C.white, alignItems: 'center', borderWidth: 3, borderColor: C.outline },
  dayNum: { fontSize: 11, fontWeight: '900', color: C.inkSoft },
  dayLabel: { fontSize: 10, fontWeight: '800', color: C.ink, textAlign: 'center' },
  task: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: C.white, borderRadius: 16, padding: 10, marginVertical: 4 },
  taskText: { fontSize: 16, fontWeight: '800', color: C.ink },
});
