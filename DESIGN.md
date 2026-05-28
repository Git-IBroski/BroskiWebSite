---
name: Neo-Broski Brutalism
colors:
  primary: "#b8c3ff"
  on-primary: "#002388"
  primary-container: "#2e5bff"
  on-primary-container: "#efefff"
  secondary: "#ffb3b2"
  on-secondary: "#680013"
  secondary-container: "#ff525e"
  on-secondary-container: "#5b0010"
  tertiary: "#00dbe9"
  on-tertiary: "#00363a"
  tertiary-container: "#007981"
  on-tertiary-container: "#c4faff"
  error: "#ffb4ab"
  on-error: "#690005"
  error-container: "#93000a"
  on-error-container: "#ffdad6"
  background: "#131315"
  on-background: "#e5e1e4"
  surface: "#131315"
  on-surface: "#e5e1e4"
  surface-variant: "#353437"
  on-surface-variant: "#c4c5d9"
  outline: "#8e90a2"
  outline-variant: "#434656"
  surface-container-lowest: "#0e0e10"
  surface-container-low: "#1b1b1d"
  surface-container: "#201f21"
  surface-container-high: "#2a2a2c"
  surface-container-highest: "#353437"
  surface-bright: "#39393b"
  surface-dim: "#131315"
  surface-tint: "#b8c3ff"
typography:
  headline-lg:
    fontFamily: Bungee
    fontSize: 48px
    fontWeight: "400"
    lineHeight: 1.1
    letterSpacing: -0.02em
    textTransform: uppercase
  headline-md:
    fontFamily: Bungee
    fontSize: 32px
    fontWeight: "400"
    lineHeight: 1.2
  body-lg:
    fontFamily: Spline Sans
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 1.6
  body-sm:
    fontFamily: Spline Sans
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.5
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: "700"
    lineHeight: 1.0
    letterSpacing: 0.1em
    textTransform: uppercase
rounded:
  sm: 0.25rem
  lg: 0.5rem
  xl: 0.75rem
  "2xl": 1rem
  "3xl": 1.5rem
  full: 9999px
spacing:
  unit: 4px
  stack-sm: 8px
  gutter: 16px
  stack-md: 20px
  margin: 24px
  stack-lg: 40px
elevation:
  neo-shadow: 4px 4px 0px 0px #0e0e10
  neo-shadow-lg: 8px 8px 0px 0px #0e0e10
  bloom: 0 0 15px 2px #00dbe9, 4px 4px 0px 0px #0e0e10
components:
  card-brutal:
    backgroundColor: "{colors.surface-container}"
    borderColor: "{colors.surface-container-lowest}"
    borderWidth: 3px
    rounded: "{rounded.3xl}"
    shadow: "{elevation.neo-shadow}"
  button-primary:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    borderColor: "{colors.surface-container-lowest}"
    borderWidth: 3px
    rounded: "{rounded.2xl}"
    shadow: "{elevation.neo-shadow-lg}"
    typography: "{typography.headline-md}"
  badge-warning:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    borderColor: "{colors.surface-container-lowest}"
    borderWidth: 3px
    rounded: "{rounded.2xl}"
    shadow: "{elevation.neo-shadow}"
    typography: "{typography.label-caps}"
    rotation: -2deg
---

# Design System: Neo-Broski Brutalism

## Overview
The **Broski Community Hub** design system is a high-energy, gaming-centric aesthetic that blends the structural rigidity of Neo-Brutalism with the frenetic intensity of modern gaming subcultures. It is designed to evoke the feeling of a late-night Discord session: loud, communal, and unapologetically bold.

The visual direction, dubbed **Neo-Broski Brutalism**, utilizes heavy black strokes, intentional offsets, and aggressive contrast, balanced by modern rounded corners and vibrant "neon" accents.

## Brand Identity
- **Personality**: Energetic, Loud, Communal, Playful.
- **Tone**: High-octane gaming culture.
- **Visual Hook**: "Blocky Neon Chaos" — combining solid geometric structures with vibrant, glowing interactive states.

## Color Strategy
The system follows a Material 3 color logic adapted for a dark-themed, high-contrast environment.
- **Surface Strategy**: Deep charcoal neutrals (`#131315`) provide a stable, "power dark" foundation.
- **Primary/Secondary Highs**: Vibrant blues and reds are used for key actions and community branding.
- **Neon Accents**: Tertiary Cyan (`#00dbe9`) is reserved for interactive "glow" states (Bloom), drawing inspiration from rhythm games and futuristic UIs.

## Typography
A trio of distinct typefaces creates a clear functional hierarchy:
- **Headlines (Bungee)**: Blocky, heavy, and playful. Used for primary impact and brand personality.
- **Body (Spline Sans)**: Clean and highly legible. Used for descriptions and long-form content.
- **Technical/Meta (Space Grotesk)**: Geometric and wide. Used for labels, tags, and data-heavy information.

## Layout & Geometry
The layout is governed by a rigid 4px unit system but intentionally breaks "perfect" alignment to create energy.
- **Neo-Shadows**: Instead of soft blurs, depth is achieved through solid, 100% opacity black offsets (4px or 8px).
- **Rotations**: Intentional 2-3 degree rotations on badges and hero cards create a "sticker" or "pasted-on" feel.
- **Dot Grids**: Backgrounds utilize a subtle dot-matrix pattern (`#353437`) to reinforce the digital/gaming canvas.

## Interactive Experience
Interactions are tactile and high-feedback:
- **Bloom**: Hovering over primary actions triggers a neon outer glow (`#00dbe9`) combined with the hard shadow.
- **Tactile Click**: Active states translate elements by 4px down and right, "covering" the shadow to simulate a physical button press.
- **Transitions**: Smooth transitions (300-500ms) soften the brutalist geometry during state changes.

## Components
### Brutal Cards
Cards feature thick 3px borders and heavy 24px (`3xl`) rounded corners. This juxtaposition of "hard" borders and "soft" corners is a signature of the Neo-Broski style.

### High-Energy Buttons
Buttons are large and command attention with `Bungee` typography and `neo-shadow-lg`. They act as the primary drivers of community engagement (e.g., "Entra su Discord").

### Dynamic Badges
Used for status indicators and small alerts, these badges are often rotated and feature the same thick border and shadow logic as larger components.
