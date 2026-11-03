# Pet Sort Sanctuary — Visual Style Contract (draft for approval)

Direction: **"Cozy Sticker Scrapbook"** — warm, hand-drawn, kawaii. Everything looks like a chunky die-cut sticker with a brown ink outline on a peach paw-print page.
Reference observations (from the user's screenshots; used for *feel*, not copied — no logo, mascot, or artwork is reused):

| Observation | Rule for our game |
|---|---|
| Peach/cream page with a faint tiled paw pattern | Background `#F9DFC3`→`#FBE9D3` with a repeating paw-print tile at ~6% opacity on every screen |
| Every shape has a thick dark-brown outline | Outline `#7A4A2B`, 3px on controls, 4px on panels, 2px on tokens |
| Buttons: flat saturated fill, thick outline, small bottom "lip", label in dark-brown caps | Primary green `#9BD35A`, secondary blue `#8FC4F2`, danger red `#E2615B`; label `#6B3E1E`, uppercase, 900 weight |
| Currency pills: icon overlapping a cream capsule, "+" button | HUD pills = cream capsule + overlapping icon + round green "+" |
| Bottom tab bar, selected tab raised and lighter, icon pops above the bar | Home / Shop / Pets tab bar replaces the side rails; active tab lifted with a bigger icon |
| Puffy 3D bubble title letters in yellow / pink / blue with white sticker edge | Logo built from three stacked words with offset shadow + white sticker border |
| Cream square level/lock badges, small ribbon banner titles | Ribbon banners (blue) for section titles; lock badge for gated content |
| Lots of empty breathing room, one hero illustration | Home keeps ONE hero (the sanctuary scene card), generous spacing |

## Tokens
- Page `#F9DFC3`, page-light `#FDF0DE`, card `#FFF6E8`, card-shade `#F6D9B5`
- Ink/outline `#7A4A2B`, text-dark `#6B3E1E`, text-soft `#A98763`
- Accents: green `#9BD35A`, blue `#8FC4F2`, pink `#F4A8B8`, yellow `#F7C95C`, orange `#F0A868`, red `#E2615B`
- Radii: 14 (chips), 20 (buttons), 28 (panels), full (pills/tokens)
- Shadow: soft warm `rgba(122,74,43,0.25)`, offset y 3–4, no blur-heavy glows
- Type: rounded heavy display (proposal: Fredoka or Baloo 2, both OFL/free), numbers 800+. Fallback: system bold.

## Pets (the big upgrade)
Emoji circles are placeholders. Target: each species as a flat-colour sticker character (round body, dot eyes, tiny blush, 2px ink outline, white die-cut edge), 8 species × (idle, selected, happy). Art source is a decision for the user (see Open Decisions).

## Motion ("juice")
- Pick up: token squashes, lifts 14px, shadow grows (spring).
- Place: arc to destination, small squash on landing, 3 confetti stars.
- Rescue: group hops in sync, white flash ring, +coin chips fly to HUD.
- Buttons: press scale 0.95 with lip shrinking.
- All motion respects reduced-motion (skip arcs/confetti, keep state changes).

## Screens in scope (order of rollout)
1. Level screen  2. Home / Sanctuary (tab bar, paw background)  3. Level-complete / fail panels  4. Shop, Pets, Map  5. Splash logo.

## States to cover per screen
Loading (splash bar), empty (no pets in habitat, no eggs), error (can't afford / habitat full — toast + next step), partial (locked zones), success (rewards panel), permission n/a (no permissions requested).

## Targets for the render check
375x812 (primary phone), 390x844, and 768x1024 (tablet centered 560px frame). Touch targets >= 44px. Contrast of `#6B3E1E` on `#9BD35A` and `#FFF6E8` checked at implementation.

## Open decisions (need the user)
1. **Pet art source:** (A) free/paid asset pack, (B) AI-generated sprites via CellCog (needs `/mcp` authorisation, may cost), (C) Figma kit, (D) keep emoji for now and restyle only the UI shell.
2. **Font:** OK to add `expo-font` + `@expo-google-fonts/fredoka` (~100 KB, npm, no account)?
3. Keep the side icon rails, or switch to the bottom tab bar from the references? (Recommended: tab bar.)
