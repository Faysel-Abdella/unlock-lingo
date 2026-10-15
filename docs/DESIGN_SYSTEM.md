# Unlock Lingo design system

Built with the `ui-ux-pro-max` skill (`.claude/skills/ui-ux-pro-max`) and adapted to the product
brief: *minimal, calm, fast, clean, premium, not childish*. Tokens live in `src/theme/tokens.ts`.
Components read them through `useTheme()` and never hard-code colours.

## How it was derived

| Decision | Skill output | Applied as |
| -------- | ------------ | ---------- |
| Style | `--design-system "language learning micro-learning calm premium minimal mobile"`, with dials variance 3 (minimal), motion 3 (subtle), density 4. Result: **Minimalism & Swiss Style** (clean, spacious, functional, high contrast, grid-based) | Flat surfaces, hairline borders, no shadows or gradients, strong type hierarchy |
| Typography | The design-system pick was *Baloo 2 / Comic Neue*, tagged "kids, playful". **Rejected**: it contradicts "not childish". Retried with `--domain typography "calm premium professional readable"`. Result: **Premium Sans (DM Sans)** | DM Sans, 4 weights, large tight display size for the word |
| Colour | `--domain color "education calm focus premium"`. Result: **LMS palette** (education teal + amber, plus green for success) | Teal for actions, amber for highlights and streaks, neutral teal-tinted surfaces. The skill's teal `#0D9488` only reaches 3.7:1 with white, so buttons use `#0F766E` (5.5:1). |
| Pattern | The design-system pick was "Hero + Testimonials + CTA" (a marketing landing page). **Not applicable** to an app. | Not used |
| Platform | `--stack react-native "pressable feedback"` | `Pressable` everywhere, Android ripple, accessibility labels |
| Delivery rules | `references/pro-rules.md` pre-delivery checklist | 48dp targets, decorative icons hidden from screen readers, colour never the only signal, contrast measured per theme |

## Tokens

- **Spacing:** 4/8 rhythm (`xs` 4 … `xxxl` 48). Screen gutter 24.
- **Radius:** 8 / 12 / 16 / 24 / pill. Cards 16, the learning card 24.
- **Touch target:** 48dp minimum (Android; also covers iOS 44pt). Smaller visuals extend `hitSlop`.
- **Type:** DM Sans.

  | Role | Size / line height | Weight |
  | ---- | ------------------ | ------ |
  | Display (the word) | 48/56, −1.2 tracking | Bold |
  | Title | 30/36 | Bold |
  | Heading | 20/28 | Semibold |
  | Body | 16/24 | Regular |
  | Caption | 13/18 | Regular |
  | Label | 12/16, uppercase, +1.2 tracking | Medium |
  | Stat | 34/40 | Bold |

  Every role sets an explicit `fontFamily` per weight, because Android can't synthesise weights
  for custom fonts.
- **Motion:** press feedback 120 ms. Nothing animates for decoration.

## Colour and contrast

Measured with the WCAG formula against `background`, `surface` and `surfaceMuted` in each theme
separately.

| Token | Light | Min ratio | Dark | Min ratio |
| ----- | ----- | --------- | ---- | --------- |
| text | `#0E1B19` | 15.7 | `#EAF2F0` | 14.1 |
| textMuted | `#475652` | 6.9 | `#A9B8B4` | 7.8 |
| textSubtle | `#5F6E6A` | 4.8 | `#8D9C98` | 5.6 |
| accent | `#0F766E` | 4.9 | `#5EEAD4` | 10.8 |
| warning (amber) | `#92400E` | 6.3 | `#FBBF24` | 9.6 |
| success | `#166534` | 6.2 | `#4ADE80` | 9.2 |
| danger | `#B91C1C` | 5.8 | `#F87171` | 5.8 |
| borderStrong (controls, ≥3:1) | `#7D8F8A` | 3.2 | `#56706A` | 3.3 |
| Button label on accent | white | 5.5 | `#042F2E` | 9.8 |

`border` is decorative only (dividers, card outlines). Answer options and inputs use
`borderStrong`.

## Rules for new UI

- Use `Pressable` with `android_ripple` and a pressed opacity. Never change layout on press.
- Icon-only controls get an `accessibilityLabel` and state. Icons next to visible text are hidden
  from the accessibility tree.
- Correct and incorrect answers are shown with an icon **and** colour, never colour alone.
- Ionicons only: outline for inactive, filled for active or selected. No emoji as icons.
