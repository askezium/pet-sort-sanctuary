import React, { useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LEVELS_PER_CHAPTER, chapterName, chapterOf, chapterProgress, claimChapter, highestUnlockedLevel } from '../meta/game';
import { useNav } from '../nav';
import { update, useSave } from '../store';
import { Text, Bar, Btn, C, Pill, shadow } from '../ui/kit';

export default function MapScreen() {
  const nav = useNav();
  const s = useSave();
  const cur = highestUnlockedLevel(s);
  const last = Math.max(20, Math.ceil((cur + 6) / LEVELS_PER_CHAPTER) * LEVELS_PER_CHAPTER);
  const scroll = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any;
  const ch = chapterOf(cur);
  const prog = chapterProgress(s, ch);
  // Level 1 sits at the bottom of the trail, like climbing a path.
  const levels = Array.from({ length: last }, (_, i) => last - i);

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Pressable onPress={() => nav.go({ name: 'home' })} style={styles.back} accessibilityLabel="Back" accessibilityRole="button" testID="back">
          <Text style={{ fontSize: 26 }}>:back:</Text>
        </Pressable>
        <Text style={styles.title}>Rescue Trail</Text>
        <Pill icon=":coin:" value={s.coins} />
        <Pill icon=":gem:" value={s.gems} />
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingVertical: 20, alignItems: 'center' }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {levels.map((n) => {
          const stars = s.levels[n] ?? 0;
          const unlocked = n <= cur;
          const isCur = n === cur;
          const startOfChapter = n % LEVELS_PER_CHAPTER === 0;
          const offset = Math.sin(n * 0.9) * 60;
          return (
            <View key={n} style={{ alignItems: 'center' }}>
              {startOfChapter ? <Text style={styles.chapter}>Chapter {chapterOf(n)} · {chapterName(chapterOf(n))}</Text> : null}
              <Pressable
                disabled={!unlocked}
                onPress={() => nav.go({ name: 'level', id: n })}
                testID={`node-${n}`}
                accessibilityLabel={`Level ${n}`}
                style={{ transform: [{ translateX: offset }], marginVertical: 8 }}
              >
                <View style={[styles.node, unlocked ? { backgroundColor: stars ? C.green : C.orange } : { backgroundColor: '#C9C2B6' }, isCur && styles.curNode]}>
                  <Text style={styles.nodeText}>{unlocked ? n : ':lock:'}</Text>
                </View>
                {unlocked && stars > 0 ? <Text style={styles.stars}>{':star:'.repeat(stars)}</Text> : null}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.chapterTitle}>Chapter {ch}: {chapterName(ch)}</Text>
        <View style={{ width: 220, marginVertical: 4 }}><Bar value={prog} max={LEVELS_PER_CHAPTER} color={C.orange} height={14} /></View>
        {prog >= LEVELS_PER_CHAPTER && !s.chapters[ch] ? (
          <Btn small label="Claim Chapter Reward :gift:" color={C.orange} dark={C.orangeDark} onPress={() => { if (update((x) => claimChapter(x, ch))) nav.toast('Chapter complete! Rare Egg + 5 :gem:'); }} />
        ) : (
          <Text style={styles.sub}>{prog}/{LEVELS_PER_CHAPTER} levels · reward: Rare Egg + 5 :gem:</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', paddingTop: Platform.OS === 'web' ? 10 : 44 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 },
  back: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', ...shadow },
  title: { flex: 1, fontSize: 22, fontWeight: '900', color: C.ink, textAlign: 'center' },
  chapter: { fontSize: 16, fontWeight: '900', color: C.greenDark, marginTop: 24, marginBottom: 4 },
  node: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: C.outline, ...shadow },
  curNode: { borderColor: C.yellow, borderWidth: 6, transform: [{ scale: 1.15 }] },
  nodeText: { fontSize: 26, fontWeight: '900', color: C.ink },
  stars: { textAlign: 'center', fontSize: 14, marginTop: 2 },
  footer: { alignItems: 'center', paddingVertical: 10, paddingBottom: Platform.OS === 'web' ? 12 : 28, backgroundColor: 'rgba(255,255,255,0.8)' },
  chapterTitle: { fontWeight: '900', fontSize: 16, color: C.ink },
  sub: { fontSize: 12, fontWeight: '700', color: C.inkSoft },
});
