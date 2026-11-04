import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useNav } from '../nav';
import { C, Text, haptic } from './kit';

const TABS = [
  { route: 'shop', icon: ':shop:', label: 'Shop' },
  { route: 'home', icon: ':home:', label: 'Main' },
  { route: 'collection', icon: ':paw:', label: 'Pets' },
] as const;

/** Bottom tab bar shown on the three hub screens. The active tab is raised and its icon pops above the bar. */
export default function TabBar() {
  const { route, go } = useNav();
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const active = route.name === t.route;
        return (
          <Pressable
            key={t.route}
            testID={`tab-${t.route}`}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            onPress={() => {
              haptic('tap');
              if (!active) go({ name: t.route });
            }}
            style={[styles.tab, active && styles.active]}
          >
            <Text style={[styles.icon, { color: active ? C.ink : C.inkSoft }, active && { fontSize: 38, marginTop: -22 }]}>{t.icon}</Text>
            <Text style={[styles.label, active && { color: C.ink }]}>{t.label.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: C.creamDark,
    borderTopWidth: 4,
    borderTopColor: C.outline,
    paddingBottom: Platform.OS === 'web' ? 6 : 18,
    paddingTop: 4,
    alignItems: 'flex-end',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 64, paddingBottom: 6, marginHorizontal: 2 },
  active: {
    backgroundColor: C.cream,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: C.outline,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -14,
    minHeight: 78,
  },
  icon: { fontSize: 28 },
  label: { fontSize: 12, fontWeight: '800', color: C.inkSoft, letterSpacing: 0.5 },
});
