import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, Text as RNText, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { SPECIES } from '../meta/data';
import { getSave } from '../store';

// "Cozy Sticker Scrapbook" palette — see docs/STYLE.md
export const C = {
  page: '#F9DFC3',
  cream: '#FFF6E8',
  creamDark: '#F2D3AE',
  outline: '#7A4A2B',
  ink: '#6B3E1E',
  inkSoft: '#A98763',
  green: '#9BD35A',
  greenDark: '#78B03A',
  sky: '#8FC4F2',
  skyDark: '#68A3D6',
  orange: '#F0A868',
  orangeDark: '#CF8545',
  pink: '#F4A8B8',
  yellow: '#F7C95C',
  teal: '#86D3C5',
  red: '#E2615B',
  white: '#FFFFFF',
  shadow: 'rgba(122,74,43,0.25)',
};

const FONT: Record<string, string> = {
  '400': 'Fredoka_400Regular',
  '500': 'Fredoka_500Medium',
  '600': 'Fredoka_600SemiBold',
  '700': 'Fredoka_700Bold',
};

// ---- vector icons -------------------------------------------------------------
// Strings anywhere in the UI can contain tokens like ":star:" or ":coin:"; <Text> below swaps them for icons.
interface IconDef {
  set: 'ion' | 'mci';
  name: string;
  /** Fixed colour; icons without one follow the surrounding text colour. */
  color?: string;
}

export const ICONS = {
  coin: { set: 'ion', name: 'paw' }, // drawn specially: gold disc with a paw
  gem: { set: 'mci', name: 'diamond-stone', color: '#4DA8FF' },
  star: { set: 'ion', name: 'star', color: '#F5B82E' },
  starOutline: { set: 'ion', name: 'star-outline', color: '#C9A24B' },
  egg: { set: 'mci', name: 'egg', color: '#E2B27B' },
  ad: { set: 'ion', name: 'play-circle', color: '#E07B39' },
  home: { set: 'ion', name: 'home' },
  brick: { set: 'mci', name: 'wall', color: '#C46A4A' },
  back: { set: 'ion', name: 'arrow-back' },
  sparkle: { set: 'ion', name: 'sparkles', color: '#F5B82E' },
  shuffle: { set: 'ion', name: 'shuffle' },
  heart: { set: 'ion', name: 'heart', color: '#E2615B' },
  party: { set: 'ion', name: 'trophy', color: '#F5B82E' },
  undo: { set: 'ion', name: 'arrow-undo' },
  hint: { set: 'ion', name: 'bulb', color: '#F5B82E' },
  lock: { set: 'ion', name: 'lock-closed', color: '#A98763' },
  settings: { set: 'ion', name: 'settings' },
  task: { set: 'ion', name: 'clipboard' },
  flame: { set: 'ion', name: 'flame', color: '#F08A3D' },
  gift: { set: 'ion', name: 'gift', color: '#E2615B' },
  paw: { set: 'ion', name: 'paw' },
  tree: { set: 'mci', name: 'tree', color: '#5BAA4B' },
  carrot: { set: 'mci', name: 'carrot', color: '#F08A3D' },
  nest: { set: 'mci', name: 'bird', color: '#5BA8E6' },
  forest: { set: 'mci', name: 'pine-tree', color: '#3E8E55' },
  sleepy: { set: 'mci', name: 'sleep' },
  playful: { set: 'mci', name: 'tennis-ball', color: '#B7C93A' },
  curious: { set: 'mci', name: 'magnify' },
  shy: { set: 'mci', name: 'eye-off-outline' },
  brave: { set: 'mci', name: 'shield-star' },
  mischief: { set: 'mci', name: 'emoticon-devil-outline' },
  zzz: { set: 'mci', name: 'sleep', color: '#8FA3B5' },
  up: { set: 'ion', name: 'arrow-up' },
  down: { set: 'ion', name: 'arrow-down' },
  bird: { set: 'mci', name: 'bird', color: '#7FB6E6' },
  butterfly: { set: 'mci', name: 'butterfly', color: '#E26B8B' },
  leaf: { set: 'ion', name: 'leaf', color: '#6BBF59' },
  map: { set: 'ion', name: 'map' },
  pointer: { set: 'mci', name: 'hand-pointing-up' },
  restart: { set: 'ion', name: 'refresh' },
  bolt: { set: 'ion', name: 'flash', color: '#F5B82E' },
  sad: { set: 'ion', name: 'sad' },
  food: { set: 'mci', name: 'food-drumstick', color: '#C0763E' },
  check: { set: 'ion', name: 'checkmark-circle', color: '#5BAA4B' },
  close: { set: 'ion', name: 'close' },
  shop: { set: 'ion', name: 'bag-handle' },
  play: { set: 'ion', name: 'play' },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const d: IconDef = ICONS[name];
  if (name === 'coin') {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F7C95C', borderWidth: Math.max(1.5, size / 11), borderColor: C.outline, alignItems: 'center', justifyContent: 'center', marginHorizontal: 1 }}>
        <Ionicons name="paw" size={size * 0.52} color={C.outline} />
      </View>
    );
  }
  const col = color ?? d.color ?? C.ink;
  const Set = d.set === 'ion' ? Ionicons : MaterialCommunityIcons;
  return <Set name={d.name as never} size={size} color={col} style={{ marginHorizontal: 1 }} />;
}

const TOKEN = /:([A-Za-z0-9]+):/g;

function expand(node: React.ReactNode, size: number, textColor: string | undefined): React.ReactNode {
  if (Array.isArray(node)) return node.map((c, i) => (typeof c === 'string' ? <React.Fragment key={i}>{expand(c, size, textColor)}</React.Fragment> : c));
  if (typeof node !== 'string' || !node.includes(':')) return node;
  const out: React.ReactNode[] = [];
  let last = 0;
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(node); m; m = TOKEN.exec(node)) {
    if (m.index > last) out.push(node.slice(last, m.index));
    const n = m[1];
    if (n in ICONS) {
      const own = (ICONS as Record<string, IconDef>)[n].color;
      out.push(<Icon key={out.length} name={n as IconName} size={size} color={own ? undefined : textColor} />);
    } else out.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < node.length) out.push(node.slice(last));
  return out;
}

/** Drop-in for react-native's Text: applies Fredoka for the requested weight and expands :icon: tokens. */
export function Text({ style, children, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) || {};
  const w = String(flat.fontWeight ?? '400');
  const key = w === 'bold' ? '700' : w === 'normal' ? '400' : w >= '700' ? '700' : w;
  const size = Math.round((typeof flat.fontSize === 'number' ? flat.fontSize : 16) * 1.02);
  return (
    <RNText {...rest} style={[style, { fontFamily: FONT[key] ?? FONT['400'], fontWeight: 'normal' }]}>
      {expand(children, size, typeof flat.color === 'string' ? flat.color : undefined)}
    </RNText>
  );
}

export function haptic(kind: 'tap' | 'good' | 'bad' = 'tap') {
  if (Platform.OS === 'web' || !getSave().settings.haptics) return;
  try {
    if (kind === 'tap') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else Haptics.notificationAsync(kind === 'good' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  } catch {
    /* haptics unavailable */
  }
}

interface BtnProps {
  label: string;
  onPress: () => void;
  color?: string;
  dark?: string;
  disabled?: boolean;
  big?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Btn({ label, onPress, color = C.green, dark = C.greenDark, disabled, big, small, style, testID }: BtnProps) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label.replace(/:\w+:/g, '').trim()}
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => to(0.94)}
      onPressOut={() => to(1)}
      onPress={() => {
        haptic('tap');
        onPress();
      }}
    >
      <Animated.View
        style={[
          styles.btn,
          { backgroundColor: disabled ? '#E6D8C6' : color, borderColor: disabled ? '#BFA58B' : C.outline },
          big && styles.btnBig,
          small && styles.btnSmall,
          { transform: [{ scale: s }] },
          style,
        ]}
      >
        <Text style={[styles.btnText, big && { fontSize: 24 }, small && { fontSize: 14 }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function IconBtn({
  icon, onPress, badge, label, size = 52, testID,
}: { icon: string; onPress: () => void; badge?: string | number | boolean; label: string; size?: number; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityLabel={label} accessibilityRole="button" onPress={() => { haptic('tap'); onPress(); }} style={{ marginVertical: 5 }}>
      <View style={[styles.iconBtn, { width: size, height: size, borderRadius: size / 3 }]}>
        <Text style={{ fontSize: size * 0.58, color: C.ink }}>{icon}</Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge === true ? '!' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Pill({ icon, value, color = C.cream }: { icon: string; value: string | number; color?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={styles.pillText}>{value}</Text>
    </View>
  );
}

export function Bar({ value, max, color = C.green, height = 10 }: { value: number; max: number; color?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: C.cream, borderWidth: 2, borderColor: C.outline, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Overlay({ children, onClose, dim = 0.55 }: { children: React.ReactNode; onClose?: () => void; dim?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  }, [a]);
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: `rgba(30,18,10,${dim})` }]}>
      {onClose ? <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" /> : null}
      <Animated.View style={{ width: '100%', alignItems: 'center', transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }], opacity: a }}>
        {children}
      </Animated.View>
    </View>
  );
}

export function Panel({ title, children, onClose, width = 340 }: { title?: string; children: React.ReactNode; onClose?: () => void; width?: number }) {
  return (
    <View style={[styles.panel, { width, maxWidth: '94%' }]}>
      {title ? <Text style={styles.panelTitle}>{title}</Text> : null}
      {onClose ? (
        <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" testID="close">
          <Text style={{ fontSize: 18, color: C.white, fontWeight: '900' }}>✕</Text>
        </Pressable>
      ) : null}
      {children}
    </View>
  );
}

const PET_IMAGES = [
  require('../../assets/pets/cat.png'),
  require('../../assets/pets/dog.png'),
  require('../../assets/pets/rabbit.png'),
  require('../../assets/pets/bird.png'),
  require('../../assets/pets/fox.png'),
  require('../../assets/pets/frog.png'),
  require('../../assets/pets/panda.png'),
  require('../../assets/pets/penguin.png'),
];

/** Sticker portrait of a species (index matches SPECIES). */
export function PetImage({ species, size, dim }: { species: number; size: number; dim?: boolean }) {
  // Locked pets show as a flat brown silhouette.
  return (
    <Image
      source={PET_IMAGES[species]}
      style={[{ width: size, height: size }, dim && { tintColor: C.outline, opacity: 0.28 }]}
      resizeMode="contain"
    />
  );
}

export function PetToken({ type, size, lift = 0 }: { type: number; size: number; lift?: number }) {
  const sp = SPECIES[type];
  const y = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(y, { toValue: lift, useNativeDriver: true, speed: 30, bounciness: 10 }).start();
  }, [lift, y]);
  useEffect(() => {
    pop.setValue(0.7);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 14 }).start();
  }, [pop]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: sp.color,
        borderWidth: 3,
        borderColor: sp.dark,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 3,
        transform: [{ translateY: y }, { scale: pop }],
        shadowColor: '#000',
        shadowOpacity: lift ? 0.3 : 0.12,
        shadowRadius: lift ? 6 : 2,
        shadowOffset: { width: 0, height: lift ? 5 : 1 },
      }}
    >
      <PetImage species={type} size={size * 0.92} />
    </Animated.View>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <View style={styles.toast}>
        <Text style={{ color: C.white, fontWeight: '800', fontSize: 15, textAlign: 'center' }}>{message}</Text>
      </View>
    </View>
  );
}

const PAWS = Array.from({ length: 14 * 6 }, (_, i) => {
  const row = Math.floor(i / 6);
  const col = i % 6;
  return { key: i, left: col * 96 + (row % 2) * 48 - 20, top: row * 70 - 10, rot: ((i * 37) % 50) - 25 };
});

/** Page background: peach with a faint tiled paw-print pattern. */
export function PawBg() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: C.page, overflow: 'hidden' }]}>
      {PAWS.map((p) => (
        <Ionicons
          key={p.key}
          name="paw"
          size={30}
          color={C.outline}
          style={{ position: 'absolute', left: p.left, top: p.top, opacity: 0.07, transform: [{ rotate: `${p.rot}deg` }] }}
        />
      ))}
    </View>
  );
}

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.15,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 3,
    borderBottomWidth: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  btnBig: { minHeight: 68, paddingHorizontal: 34, borderRadius: 30, borderBottomWidth: 9 },
  btnSmall: { minHeight: 44, minWidth: 90, paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: 6 },
  btnText: { color: C.ink, fontSize: 18, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  iconBtn: { backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.outline, ...shadow },
  iconLabel: { fontSize: 9, fontWeight: '800', color: C.inkSoft, marginTop: -2 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.white },
  badgeText: { color: C.white, fontSize: 11, fontWeight: '900' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 44, borderRadius: 22, borderWidth: 3, borderColor: C.outline, ...shadow },
  pillText: { fontSize: 20, fontWeight: '900', color: C.ink },
  overlay: { alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  panel: { backgroundColor: C.cream, borderRadius: 28, borderWidth: 4, borderColor: C.outline, padding: 18, paddingTop: 22, alignItems: 'center', ...shadow, shadowOpacity: 0.3 },
  panelTitle: { fontSize: 26, fontWeight: '900', color: C.ink, marginBottom: 10, textAlign: 'center' },
  closeBtn: { position: 'absolute', top: -14, right: -10, width: 44, height: 44, borderRadius: 22, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.outline, zIndex: 3 },
  toastWrap: { position: 'absolute', left: 0, right: 0, top: 110, alignItems: 'center', zIndex: 100 },
  toast: { backgroundColor: 'rgba(40,28,20,0.92)', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 18, maxWidth: '88%' },
});
