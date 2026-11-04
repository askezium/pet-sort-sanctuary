import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HABITATS, PERSONALITY_EMOJI, PETS, RARITY_COLOR, SPECIES, habitatForSpecies, type Pet } from '../meta/data';
import { MAX_PET_LEVEL, petUpgradeCost, placePet, unplacePet, upgradePet } from '../meta/game';
import { useNav } from '../nav';
import { update, useSave } from '../store';
import { Text, Btn, C, Overlay, Panel, PetImage, Pill, shadow } from '../ui/kit';

const TABS = ['All', 'Cats', 'Dogs', 'Rabbits', 'Birds', 'Other'] as const;
const TAB_SPECIES: Record<string, number[] | null> = { All: null, Cats: [0], Dogs: [1], Rabbits: [2], Birds: [3], Other: [4, 5, 6, 7] };

export default function Collection() {
  const nav = useNav();
  const s = useSave();
  const [tab, setTab] = useState<(typeof TABS)[number]>('All');
  const [sel, setSel] = useState<Pet | null>(null);
  const list = PETS.filter((p) => !TAB_SPECIES[tab] || TAB_SPECIES[tab]!.includes(p.species));
  const owned = PETS.filter((p) => s.pets[p.id]).length;

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Pressable onPress={() => nav.go({ name: 'home' })} style={styles.back} accessibilityLabel="Back" accessibilityRole="button" testID="back">
          <Text style={{ fontSize: 26 }}>:back:</Text>
        </Pressable>
        <Text style={styles.title}>Pets {owned}/{PETS.length}</Text>
        <Pill icon=":heart:" value={s.hearts} />
      </View>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && { backgroundColor: C.green }]} accessibilityRole="button" accessibilityLabel={t}>
            <Text style={[styles.tabText, tab === t && { color: C.white }]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {list.map((p) => {
          const has = s.pets[p.id];
          return (
            <Pressable key={p.id} onPress={() => setSel(p)} style={styles.cardWrap} testID={`pet-${p.id}`} accessibilityLabel={has ? p.name : 'Unknown pet'}>
              <View style={[styles.card, { borderColor: has ? RARITY_COLOR[p.rarity] : '#D9D2C6' }]}>
                <PetImage species={p.species} size={64} dim={!has} />
                <Text style={styles.name}>{has ? p.name : '???'}</Text>
                <Text style={[styles.rar, { color: has ? RARITY_COLOR[p.rarity] : '#B5ABA0' }]}>{has ? p.rarity : 'locked'}</Text>
                {has && s.placed[p.id] ? <Text style={styles.home}>:home:</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {sel ? (
        <Overlay onClose={() => setSel(null)}>
          <Panel title={s.pets[sel.id] ? sel.name : 'Unknown Pet'} onClose={() => setSel(null)}>
            {(() => {
              const has = s.pets[sel.id];
              const hab = habitatForSpecies(sel.species);
              return (
                <>
                  <View style={[styles.portrait, { backgroundColor: has ? SPECIES[sel.species].color : '#CFC8BC', borderColor: RARITY_COLOR[sel.rarity] }]}>
                    <PetImage species={sel.species} size={116} dim={!has} />
                  </View>
                  <Text style={[styles.rar, { color: RARITY_COLOR[sel.rarity], fontSize: 16 }]}>{sel.rarity.toUpperCase()} {SPECIES[sel.species].name}</Text>
                  {has ? (
                    <>
                      <Text style={styles.line}>{PERSONALITY_EMOJI[sel.personality]} {sel.personality} · Level {has.level}/{MAX_PET_LEVEL}</Text>
                      <Text style={styles.sub}>Likes: {hab.emoji} {hab.name} · copies found: {has.count}</Text>
                      <Text style={styles.sub}>Coin bonus +{((['common', 'rare', 'epic', 'legendary'].indexOf(sel.rarity) + 1) * has.level * 0.5).toFixed(1)}% while placed</Text>
                      {has.level < MAX_PET_LEVEL ? (
                        <Btn small label={`Upgrade :heart: ${petUpgradeCost(has.level)}`} color={s.hearts >= petUpgradeCost(has.level) ? C.pink : '#B9AFA3'} dark="#D9588A" onPress={() => { if (!update((x) => upgradePet(x, sel.id))) nav.toast('Not enough Pet Hearts — duplicates give hearts'); }} />
                      ) : <Text style={styles.line}>Max level :sparkle:</Text>}
                      {s.placed[sel.id] ? (
                        <Btn label="Remove from Sanctuary" small color="#B9AFA3" dark="#8E857A" onPress={() => update((x) => unplacePet(x, sel.id))} />
                      ) : (
                        <Btn label="Place in Sanctuary" testID="place" onPress={() => {
                          const r = placePet(s, sel.id);
                          if ('error' in r) nav.toast(r.error);
                          else { update(() => r); nav.toast(`${sel.name} moved in! :home:`); }
                        }} />
                      )}
                    </>
                  ) : (
                    <Text style={styles.sub}>Not found yet. Hatch eggs to discover it! Home: {hab.name}</Text>
                  )}
                </>
              );
            })()}
          </Panel>
        </Overlay>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', paddingTop: Platform.OS === 'web' ? 10 : 44 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 },
  back: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', ...shadow },
  title: { flex: 1, fontSize: 24, fontWeight: '900', color: C.ink, textAlign: 'center' },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 8, flexWrap: 'wrap' },
  tab: { paddingHorizontal: 12, minHeight: 40, borderRadius: 20, backgroundColor: C.cream, justifyContent: 'center', borderWidth: 2, borderColor: C.outline },
  tabText: { fontWeight: '900', color: C.ink, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', padding: 8, paddingBottom: 40 },
  cardWrap: { width: '33.33%', padding: 5, maxWidth: 170 },
  card: { backgroundColor: C.cream, borderRadius: 20, borderWidth: 3, alignItems: 'center', paddingVertical: 10 },
  name: { fontWeight: '900', color: C.ink, fontSize: 14 },
  rar: { fontWeight: '900', fontSize: 11, textTransform: 'uppercase' },
  home: { position: 'absolute', top: 4, right: 6, fontSize: 14 },
  portrait: { width: 130, height: 130, borderRadius: 65, borderWidth: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  line: { fontSize: 16, fontWeight: '800', color: C.ink, textAlign: 'center', marginVertical: 3 },
  sub: { fontSize: 12, fontWeight: '700', color: C.inkSoft, textAlign: 'center', marginVertical: 2 },
});
