import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SHOP_ITEMS, buyItem } from '../meta/game';
import { useNav } from '../nav';
import { showRewarded } from '../services/ads';
import { track } from '../services/analytics';
import { update, useSave } from '../store';
import { Text, Btn, C, Pill, shadow } from '../ui/kit';

export default function Shop() {
  const nav = useNav();
  const s = useSave();

  async function freeCoins() {
    if (await showRewarded('shop_free_coins')) {
      update((x) => ({ ...x, coins: x.coins + 50 }));
      nav.toast('+50 :coin: thanks for watching!');
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Pressable onPress={() => nav.go({ name: 'home' })} style={styles.back} accessibilityLabel="Back" accessibilityRole="button" testID="back">
          <Text style={{ fontSize: 26 }}>:back:</Text>
        </Pressable>
        <Text style={styles.title}>Shop</Text>
        <Pill icon=":coin:" value={s.coins} />
        <Pill icon=":gem:" value={s.gems} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, alignItems: 'center' }}>
        <View style={styles.card}>
          <Text style={{ fontSize: 40 }}>:ad:</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.name}>Free Coins</Text>
            <Text style={styles.desc}>Watch a short ad for +50 coins</Text>
          </View>
          <Btn small label="Watch" color={C.orange} dark={C.orangeDark} onPress={freeCoins} testID="free-coins" />
        </View>
        {SHOP_ITEMS.map((it) => {
          const afford = s[it.currency] >= it.price;
          return (
            <View key={it.id} style={styles.card}>
              <Text style={{ fontSize: 40 }}>{it.icon}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.name}>{it.name}</Text>
                <Text style={styles.desc}>{it.desc}</Text>
              </View>
              <Btn
                small
                testID={`buy-${it.id}`}
                label={`${it.currency === 'coins' ? ':coin:' : ':gem:'} ${it.price}`}
                color={afford ? C.green : '#B9AFA3'}
                dark={afford ? C.greenDark : '#8E857A'}
                onPress={() => {
                  if (update((x) => buyItem(x, it.id))) {
                    track('currency_spent', { item: it.id, currency: it.currency, amount: it.price });
                    nav.toast(`Bought ${it.name}!`);
                  } else nav.toast(`Not enough ${it.currency}`);
                }}
              />
            </View>
          );
        })}
        <Text style={styles.section}>Gem Packs</Text>
        <View style={[styles.card, { opacity: 0.6 }]}>
          <Text style={{ fontSize: 40 }}>:gem:</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.name}>Gem packs, Starter Bundle, Remove Ads</Text>
            <Text style={styles.desc}>Real-money purchases need store billing (RevenueCat / Play & App Store). Not in this prototype.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', paddingTop: Platform.OS === 'web' ? 10 : 44 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 },
  back: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', ...shadow },
  title: { flex: 1, fontSize: 26, fontWeight: '900', color: C.ink, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.cream, borderRadius: 20, padding: 12, marginVertical: 5, width: '100%', maxWidth: 480, borderWidth: 3, borderColor: C.outline },
  name: { fontSize: 17, fontWeight: '900', color: C.ink },
  desc: { fontSize: 12, fontWeight: '700', color: C.inkSoft },
  section: { alignSelf: 'flex-start', marginTop: 14, fontSize: 18, fontWeight: '900', color: C.ink },
});
