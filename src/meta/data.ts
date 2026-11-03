export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8FA3B5',
  rare: '#3FA7F5',
  epic: '#A66CF2',
  legendary: '#FFB020',
};
export const HEARTS_FOR_DUPLICATE: Record<Rarity, number> = { common: 1, rare: 3, epic: 8, legendary: 25 };

export interface Species {
  id: string;
  name: string;
  emoji: string;
  color: string;
  dark: string;
}

/** Index in this list == the pet type id used by the sort board. */
export const SPECIES: Species[] = [
  { id: 'cat', name: 'Cat', emoji: '🐱', color: '#FFC93C', dark: '#D9A21B' },
  { id: 'dog', name: 'Dog', emoji: '🐶', color: '#B98156', dark: '#8F5E38' },
  { id: 'rabbit', name: 'Rabbit', emoji: '🐰', color: '#FF8FB1', dark: '#D96A8D' },
  { id: 'bird', name: 'Bird', emoji: '🐦', color: '#4DA8FF', dark: '#2B82D6' },
  { id: 'fox', name: 'Fox', emoji: '🦊', color: '#FF7A2F', dark: '#D9561A' },
  { id: 'frog', name: 'Frog', emoji: '🐸', color: '#5BC65B', dark: '#3AA03A' },
  { id: 'panda', name: 'Panda', emoji: '🐼', color: '#9B7BF2', dark: '#7656D1' },
  { id: 'penguin', name: 'Penguin', emoji: '🐧', color: '#26C6B0', dark: '#139E8B' },
];

export type Personality = 'sleepy' | 'playful' | 'curious' | 'shy' | 'brave' | 'mischievous';

export interface Pet {
  id: string;
  name: string;
  species: number;
  rarity: Rarity;
  personality: Personality;
}

const p = (id: string, name: string, species: number, rarity: Rarity, personality: Personality): Pet => ({
  id,
  name,
  species,
  rarity,
  personality,
});

export const PETS: Pet[] = [
  p('whiskers', 'Whiskers', 0, 'common', 'playful'),
  p('mochi', 'Mochi', 0, 'rare', 'sleepy'),
  p('duchess', 'Duchess', 0, 'epic', 'curious'),
  p('biscuit', 'Biscuit', 1, 'common', 'playful'),
  p('scout', 'Scout', 1, 'rare', 'brave'),
  p('maple', 'Maple', 1, 'epic', 'mischievous'),
  p('clover', 'Clover', 2, 'common', 'shy'),
  p('bunbun', 'Bun-Bun', 2, 'rare', 'playful'),
  p('velvet', 'Velvet', 2, 'epic', 'sleepy'),
  p('pip', 'Pip', 3, 'common', 'curious'),
  p('robin', 'Robin', 3, 'rare', 'playful'),
  p('phoenix', 'Phoenix', 3, 'legendary', 'brave'),
  p('rusty', 'Rusty', 4, 'common', 'mischievous'),
  p('ember', 'Ember', 4, 'rare', 'curious'),
  p('nova', 'Nova', 4, 'epic', 'brave'),
  p('hopper', 'Hopper', 5, 'common', 'playful'),
  p('lily', 'Lily', 5, 'rare', 'sleepy'),
  p('bamboo', 'Bamboo', 6, 'common', 'sleepy'),
  p('mei', 'Mei', 6, 'rare', 'shy'),
  p('zen', 'Zen', 6, 'epic', 'sleepy'),
  p('waddle', 'Waddle', 7, 'common', 'playful'),
  p('pebble', 'Pebble', 7, 'rare', 'curious'),
  p('aurora', 'Aurora', 7, 'legendary', 'shy'),
];

export const petById = (id: string): Pet => PETS.find((x) => x.id === id) as Pet;

export interface HabitatDef {
  id: string;
  name: string;
  emoji: string;
  species: number[];
  unlockStars: number;
  color: string;
}

export const HABITATS: HabitatDef[] = [
  { id: 'cottage', name: 'Cat Cottage', emoji: '🏡', species: [0], unlockStars: 0, color: '#FFE0A3' },
  { id: 'park', name: 'Dog Park', emoji: '🌳', species: [1], unlockStars: 3, color: '#CDEFB5' },
  { id: 'burrow', name: 'Rabbit Burrow', emoji: '🥕', species: [2], unlockStars: 9, color: '#FAD3E0' },
  { id: 'birdhouse', name: 'Birdhouse', emoji: '🪺', species: [3], unlockStars: 18, color: '#C9E6FF' },
  { id: 'den', name: 'Forest Den', emoji: '🌲', species: [4, 5, 6, 7], unlockStars: 30, color: '#C8E3C0' },
];

export const habitatById = (id: string): HabitatDef => HABITATS.find((h) => h.id === id) as HabitatDef;
export const habitatForSpecies = (species: number): HabitatDef =>
  HABITATS.find((h) => h.species.includes(species)) as HabitatDef;

export const HABITAT_LEVELS = [
  { name: 'Basic Habitat', capacity: 3, coinsPerMin: 0 },
  { name: 'Cozy Habitat', capacity: 5, coinsPerMin: 2 },
  { name: 'Deluxe Habitat', capacity: 8, coinsPerMin: 4 },
  { name: 'Sanctuary Haven', capacity: 12, coinsPerMin: 8 },
];
/** Cost to reach habitat level index i+1 from i. */
export const HABITAT_UPGRADE_COST = [
  { coins: 150, materials: 5 },
  { coins: 400, materials: 15 },
  { coins: 900, materials: 40 },
];
export const PRODUCTION_CAP_MIN = 120;

export const PERSONALITY_EMOJI: Record<Personality, string> = {
  sleepy: '😴',
  playful: '🎾',
  curious: '🔍',
  shy: '🙈',
  brave: '🦁',
  mischievous: '😈',
};

export const DAILY_REWARDS = [
  { label: '100 Coins', icon: '🪙' },
  { label: 'Common Egg', icon: '🥚' },
  { label: 'Booster', icon: '🔀' },
  { label: '250 Coins', icon: '🪙' },
  { label: 'Rare Egg', icon: '🥚' },
  { label: '25 Materials', icon: '🧱' },
  { label: 'Epic Egg', icon: '🥚' },
];
