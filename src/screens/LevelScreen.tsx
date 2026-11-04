import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { generateLevel } from '../core/levels';
import { mulberry32 } from '../core/rng';
import {
  addMoves, hintMove, movesLeft, movesUsed, playMove, restartSession, shuffleSession, startSession, undoMove,
  type Session,
} from '../core/session';
import { canMove, petsAwayFromRescue, type Move } from '../core/sort';
import { applyLevelComplete, levelReward, noteBoosterUse, useBooster, type BoosterKind, type Reward } from '../meta/game';
import { SPECIES, petById } from '../meta/data';
import { useNav } from '../nav';
import { showRewarded } from '../services/ads';
import { track } from '../services/analytics';
import { getSave, update, useSave } from '../store';
import { Text, Bar, Btn, C, Overlay, Panel, PetImage, PetToken, Pill, haptic, shadow } from '../ui/kit';

const FREE_UNDO = 2;
const FREE_HINT = 2;

export default function LevelScreen({ id }: { id: number }) {
  const nav = useNav();
  const save = useSave();
  const { width } = useWindowDimensions();
  const level = useMemo(() => generateLevel(id), [id]);
  const [sess, setSess] = useState<Session>(() => startSession(level));
  const [sel, setSel] = useState<number | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [collected, setCollected] = useState(false);
  const [rescueFx, setRescueFx] = useState<{ key: number; species: number } | null>(null);
  const fxAnim = useRef(new Animated.Value(0)).current;
  const tutorial = id === 1 && !save.tutorialDone;

  useEffect(() => {
    track('level_start', { level: id });
    if (tutorial) track('tutorial_start');
    setSess(startSession(level));
    pick(null);
    setHint(null);
    setReward(null);
    setCollected(false);
  }, [id, level]); // eslint-disable-line react-hooks/exhaustive-deps

  // Level 1 coaches the player by always showing the next productive move.
  useEffect(() => {
    if (tutorial && sess.status === 'playing') setHint(hintMove(sess));
  }, [tutorial, sess]);

  // React to win / fail.
  useEffect(() => {
    if (sess.status === 'won' && !reward) {
      const r = levelReward(getSave(), level, sess.stars);
      setReward(r);
      haptic('good');
      track('level_complete', { level: id, stars: sess.stars, moves: movesUsed(sess) });
      track('moves_used', { level: id, moves: movesUsed(sess), par: level.par });
      if (!getSave().totals.levelsCompleted) track('first_level_complete');
      if (tutorial) {
        track('tutorial_complete');
        update((s) => ({ ...s, tutorialDone: true }));
      }
    } else if (sess.status === 'failed') {
      haptic('bad');
      track('level_fail', { level: id, reason: sess.failReason ?? '', moves: movesUsed(sess) });
      update((s) => ({ ...s, totals: { ...s.totals, levelsFailed: s.totals.levelsFailed + 1 } }));
    }
  }, [sess.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rescue celebration.
  useEffect(() => {
    if (sess.lastRescue >= 0) {
      setRescueFx({ key: Date.now(), species: sess.lastRescue });
      fxAnim.setValue(0);
      Animated.timing(fxAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start(() => setRescueFx(null));
      haptic('good');
    }
  }, [sess.lastRescue, sess.history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = sess.state.board.length;
  const perRow = n <= 5 ? n : Math.ceil(n / 2);
  const rows = n <= 5 ? 1 : 2;
  const boardW = Math.min(width, 520) - 24;
  const cw = Math.min(88, boardW / perRow - 10);
  const token = Math.min(52, cw - 16);
  const ch = level.capacity * (token + 6) + 18;
  const left = movesLeft(sess);
  const leftColor = left <= 2 ? C.red : left <= 5 ? '#E8A400' : C.ink;

  // Refs mirror the latest session/selection so rapid consecutive taps never read stale state.
  const sessRef = useRef(sess);
  sessRef.current = sess;
  const selRef = useRef<number | null>(null);
  const pick = (v: number | null) => {
    selRef.current = v;
    setSel(v);
  };

  function tap(i: number) {
    const cur = sessRef.current;
    if (cur.status !== 'playing') return;
    const board = cur.state.board;
    const from = selRef.current;
    if (from === null) {
      if (board[i].length > 0) {
        pick(i);
        haptic('tap');
      }
      return;
    }
    if (from === i) return pick(null);
    if (canMove(cur.state, from, i)) {
      const next = playMove(cur, from, i);
      sessRef.current = next;
      setSess(next);
      pick(null);
      setHint(null);
      if (tutorial) track('tutorial_step_complete', { step: movesUsed(cur) + 1 });
    } else {
      setShake(i);
      setTimeout(() => setShake(null), 280);
      haptic('bad');
      pick(board[i].length > 0 ? i : null);
    }
  }

  /** Free quota first, then an owned booster, then a rewarded ad. */
  async function spendBooster(kind: BoosterKind, free: boolean): Promise<boolean> {
    if (free) return true;
    if (update((s) => useBooster(s, kind))) {
      track('booster_used', { kind });
      return true;
    }
    const ok = await showRewarded(`booster_${kind}`);
    if (ok) update(noteBoosterUse);
    return ok;
  }

  async function doUndo() {
    if (sess.history.length === 0 || sess.status === 'won') return;
    if (!(await spendBooster('undo', sess.undosUsed < FREE_UNDO))) return;
    track('undo_used', { level: id });
    setSess((s) => undoMove(s));
    pick(null);
    setHint(null);
  }
  async function doHint() {
    if (sess.status !== 'playing') return;
    if (!(await spendBooster('hint', sess.hintsUsed < FREE_HINT))) return;
    track('hint_used', { level: id });
    setHint(hintMove(sess));
    setSess((s) => ({ ...s, hintsUsed: s.hintsUsed + 1 }));
    pick(null);
  }
  async function doShuffle() {
    if (sess.status !== 'playing') return;
    if (!(await spendBooster('shuffle', false))) return;
    track('booster_used', { kind: 'shuffle' });
    setSess((s) => shuffleSession(s, mulberry32(Date.now() & 0xffffff)));
    pick(null);
    setHint(null);
  }
  function retry() {
    track('level_retry', { level: id });
    setSess(restartSession(sess));
    pick(null);
    setHint(null);
    setReward(null);
  }
  function leave() {
    if (sess.status === 'playing') track('level_quit', { level: id, moves: movesUsed(sess) });
    nav.go({ name: 'home' });
  }
  async function extraMoves(viaAd: boolean) {
    if (viaAd) {
      if (!(await showRewarded('extra_moves'))) return;
    } else if (!update((s) => (s.gems >= 3 ? { ...s, gems: s.gems - 3 } : null))) {
      return nav.toast('Not enough gems');
    }
    track('booster_used', { kind: 'extra_moves', ad: viaAd });
    setSess((s) => addMoves(s, 5));
  }
  function collect(doubled: boolean, next: 'next' | 'home' | 'egg') {
    if (!reward || collected) return;
    setCollected(true);
    update((s) => applyLevelComplete(s, level, reward, level.types * level.capacity, doubled));
    track('currency_earned', { source: 'level', coins: reward.coins * (doubled ? 2 : 1) });
    if (next === 'next') nav.go({ name: 'level', id: id + 1 });
    else if (next === 'egg') {
      nav.go({ name: 'home' });
      setTimeout(() => nav.open({ type: 'egg' }), 50);
    } else nav.go({ name: 'home' });
  }
  async function collectDoubled() {
    if (!(await showRewarded('double_reward'))) return;
    collect(true, 'next');
  }

  const away = petsAwayFromRescue(sess.state);

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Pressable onPress={leave} style={styles.back} accessibilityLabel="Back" accessibilityRole="button" testID="back">
          <Text style={{ fontSize: 26 }}>:back:</Text>
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.title}>Level {id}</Text>
          <Text style={styles.sub}>Rescue all pets · :star: par {level.par}</Text>
        </View>
        <Pill icon=":coin:" value={save.coins} />
      </View>

      <View style={styles.movesRow}>
        <Text style={styles.movesLabel}>Moves left</Text>
        <Text testID="moves-left" style={[styles.moves, { color: leftColor }]}>{left}</Text>
        <View style={{ width: 160, marginTop: 4 }}>
          <Bar value={left} max={sess.moveLimit} color={left <= 2 ? C.red : left <= 5 ? C.yellow : C.green} />
        </View>
      </View>

      <View style={styles.board}>
        {Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 14 }}>
            {sess.state.board.slice(r * perRow, (r + 1) * perRow).map((c, k) => {
              const i = r * perRow + k;
              const isSel = sel === i;
              const isHintFrom = hint?.from === i;
              const isHintTo = hint?.to === i;
              const valid = sel !== null && sel !== i && canMove(sess.state, sel, i);
              return (
                <Pressable key={i} onPress={() => tap(i)} testID={`tube-${i}`} accessibilityLabel={`Container ${i + 1}`} style={{ marginHorizontal: 5 }}>
                  <View
                    style={[
                      styles.tube,
                      { width: cw, height: ch },
                      isSel && { borderColor: C.orange, backgroundColor: '#FFF1DC' },
                      valid && { borderColor: C.green, backgroundColor: '#EAF9E6' },
                      (isHintFrom || isHintTo) && { borderColor: C.yellow, backgroundColor: '#FFF9D6', borderStyle: 'dashed' },
                      shake === i && { borderColor: C.red, transform: [{ translateX: 4 }] },
                    ]}
                  >
                    {c.map((t, j) => (
                      <PetToken key={`${j}-${t}`} type={t} size={token} lift={isSel && j === c.length - 1 ? -12 : 0} />
                    ))}
                  </View>
                  {isHintFrom ? <Text style={styles.hintTag}>:pointer: pick</Text> : isHintTo ? <Text style={styles.hintTag}>:down: here</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
        {tutorial ? <Text style={styles.coach}>Tap a pet, then tap where it should go. Match 4 of a kind to rescue them!</Text> : null}
      </View>

      <View style={styles.bottom}>
        <Booster icon=":undo:" label="Undo" count={Math.max(0, FREE_UNDO - sess.undosUsed) || save.boosters.undo} onPress={doUndo} testID="undo" />
        <Booster icon=":hint:" label="Hint" count={Math.max(0, FREE_HINT - sess.hintsUsed) || save.boosters.hint} onPress={doHint} testID="hint" />
        <Booster icon=":shuffle:" label="Shuffle" count={save.boosters.shuffle} onPress={doShuffle} testID="shuffle" />
        <Booster icon=":restart:" label="Restart" onPress={retry} testID="restart" />
      </View>

      {rescueFx ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.fx, { opacity: fxAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: fxAnim.interpolate({ inputRange: [0, 1], outputRange: [20, -70] }) }, { scale: fxAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 1.3, 1] }) }] }]}
        >
          <PetImage species={rescueFx.species} size={110} />
          <Text style={styles.fxText}>Rescued! :sparkle:</Text>
        </Animated.View>
      ) : null}

      {sess.status === 'won' && reward ? (
        <Overlay dim={0.6}>
          <Panel title="Level Complete! :party:">
            <Text testID="stars" style={{ fontSize: 46, letterSpacing: 4 }}>{':star:'.repeat(sess.stars)}{':starOutline:'.repeat(3 - sess.stars)}</Text>
            <Text style={styles.sub}>{movesUsed(sess)} moves · par {level.par}</Text>
            <View style={styles.rewardBox}>
              <Text style={styles.rewardLine}>:coin: +{reward.coins}</Text>
              <Text style={styles.rewardLine}>:brick: +{reward.materials}</Text>
              <Text style={styles.rewardLine}>:bolt: +{reward.xp} XP</Text>
              {reward.egg ? <Text style={styles.rewardLine}>:egg: {reward.egg === 'common' ? 'Common' : reward.egg === 'rare' ? 'Rare' : 'Epic'} Egg!</Text> : null}
              {!reward.firstClear ? <Text style={styles.sub}>Replay rewards are halved</Text> : null}
            </View>
            {reward.newPets.length > 0 ? (
              <View style={{ alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.sub}>New pets unlocked!</Text>
                <View style={{ flexDirection: 'row' }}>
                  {reward.newPets.map((id) => <PetImage key={id} species={petById(id).species} size={52} />)}
                </View>
              </View>
            ) : null}
            <Btn label="Next Level :play:" big onPress={() => collect(false, reward.egg ? 'egg' : 'next')} testID="next-level" />
            {reward.egg ? <Text style={styles.sub}>Opens your new egg first</Text> : null}
            <Btn label="Collect x2 — Watch Ad :ad:" color={C.orange} dark={C.orangeDark} onPress={collectDoubled} testID="collect-x2" />
            <Btn label="Sanctuary" small color={C.sky} dark={C.skyDark} onPress={() => collect(false, 'home')} testID="to-home" />
          </Panel>
        </Overlay>
      ) : null}

      {sess.status === 'failed' ? (
        <Overlay dim={0.6}>
          <Panel title={sess.failReason === 'stuck' ? 'No Moves Left' : 'Out of Moves'}>
            <Text style={{ fontSize: 54 }}>:sad:</Text>
            <Text style={styles.rewardLine}>{away === 0 ? 'So close!' : `${away} pet${away === 1 ? '' : 's'} away from a rescue`}</Text>
            <Btn label="Retry" big onPress={retry} testID="retry" />
            {sess.failReason === 'moves' ? <Btn label="+5 Moves — Watch Ad :ad:" color={C.orange} dark={C.orangeDark} onPress={() => extraMoves(true)} testID="extra-ad" /> : null}
            {sess.failReason === 'moves' ? <Btn label={`+5 Moves — 3 :gem: (have ${save.gems})`} small color={C.teal} dark="#1B9488" onPress={() => extraMoves(false)} testID="extra-gems" /> : null}
            {sess.history.length > 0 ? <Btn label="Undo last move" small color={C.sky} dark={C.skyDark} onPress={() => setSess((s) => undoMove(s))} /> : null}
            <Btn label="Leave" small color="#B9AFA3" dark="#8E857A" onPress={leave} testID="leave" />
          </Panel>
        </Overlay>
      ) : null}
    </View>
  );
}

function Booster({ icon, label, count, onPress, testID }: { icon: string; label: string; count?: number; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={() => { haptic('tap'); onPress(); }} style={styles.booster} accessibilityRole="button" accessibilityLabel={label} testID={testID}>
      <Text style={{ fontSize: 32, color: C.ink }}>{icon}</Text>
      {count !== undefined ? (
        <View style={styles.count}><Text style={styles.countText}>{count > 0 ? count : ':play:'}</Text></View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', alignItems: 'stretch', paddingTop: Platform.OS === 'web' ? 10 : 44 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  back: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', ...shadow },
  title: { fontSize: 26, fontWeight: '900', color: C.ink },
  sub: { fontSize: 13, fontWeight: '700', color: C.inkSoft, textAlign: 'center' },
  movesRow: { alignItems: 'center', marginTop: 6 },
  movesLabel: { fontSize: 12, fontWeight: '800', color: C.inkSoft, letterSpacing: 1, textTransform: 'uppercase' },
  moves: { fontSize: 46, fontWeight: '900', lineHeight: 50 },
  board: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  tube: { backgroundColor: 'rgba(255,246,232,0.9)', borderWidth: 4, borderColor: C.outline, borderRadius: 22, borderTopLeftRadius: 10, borderTopRightRadius: 10, paddingBottom: 6, justifyContent: 'flex-start', alignItems: 'center', flexDirection: 'column-reverse' },
  hintTag: { position: 'absolute', bottom: -18, alignSelf: 'center', fontSize: 12, fontWeight: '900', color: '#B58900' },
  coach: { marginTop: 8, marginHorizontal: 24, textAlign: 'center', fontSize: 16, fontWeight: '800', color: C.ink, backgroundColor: 'rgba(255,255,255,0.8)', padding: 10, borderRadius: 16 },
  bottom: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, paddingBottom: Platform.OS === 'web' ? 14 : 30, paddingTop: 8 },
  booster: { width: 76, height: 70, borderRadius: 20, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.outline, ...shadow },
  boosterLabel: { fontSize: 11, fontWeight: '800', color: C.inkSoft, marginTop: -2 },
  count: { position: 'absolute', top: -6, right: -6, minWidth: 24, height: 24, borderRadius: 12, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.outline },
  countText: { color: C.white, fontWeight: '900', fontSize: 12 },
  fx: { position: 'absolute', top: '36%', left: 0, right: 0, alignItems: 'center' },
  fxText: { fontSize: 28, fontWeight: '900', color: C.white, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  rewardBox: { backgroundColor: C.cream, borderRadius: 18, padding: 12, marginVertical: 8, alignItems: 'center', minWidth: 200 },
  rewardLine: { fontSize: 22, fontWeight: '900', color: C.ink, marginVertical: 1, textAlign: 'center' },
});
