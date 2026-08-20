---
name: Luminous Vector
colors:
  surface: '#15121a'
  surface-dim: '#15121a'
  surface-bright: '#3c3740'
  surface-container-lowest: '#100d14'
  surface-container-low: '#1e1a22'
  surface-container: '#221e26'
  surface-container-high: '#2c2831'
  surface-container-highest: '#37333c'
  on-surface: '#e8e0eb'
  on-surface-variant: '#cec2d5'
  inverse-surface: '#e8e0eb'
  inverse-on-surface: '#332f37'
  outline: '#978d9e'
  outline-variant: '#4b4453'
  surface-tint: '#d9b9ff'
  primary: '#d9b9ff'
  on-primary: '#460085'
  primary-container: '#56039f'
  on-primary-container: '#c190ff'
  inverse-primary: '#7a3bc4'
  secondary: '#d8baf9'
  on-secondary: '#3c2559'
  secondary-container: '#563e73'
  on-secondary-container: '#c9acea'
  tertiary: '#ffb688'
  on-tertiary: '#512400'
  tertiary-container: '#632d00'
  on-tertiary-container: '#e39460'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eedbff'
  primary-fixed-dim: '#d9b9ff'
  on-primary-fixed: '#2a0054'
  on-primary-fixed-variant: '#611baa'
  secondary-fixed: '#eedbff'
  secondary-fixed-dim: '#d8baf9'
  on-secondary-fixed: '#260e42'
  on-secondary-fixed-variant: '#533c71'
  tertiary-fixed: '#ffdbc7'
  tertiary-fixed-dim: '#ffb688'
  on-tertiary-fixed: '#311300'
  on-tertiary-fixed-variant: '#703709'
  background: '#15121a'
  on-background: '#e8e0eb'
  surface-variant: '#37333c'
typography:
  headline-xl:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.1em
  numeric-display:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin: 40px
  container-max: 1440px
---

## Brand & Style

This design system is defined by a high-tech, futuristic aesthetic that blends the structural rigidity of architectural software with the immersive atmosphere of premium dark-mode interfaces. The brand personality is precise, avant-garde, and data-driven, targeting professional users who value efficiency and high-fidelity visual feedback.

The core visual style is **Glassmorphism**, elevated by a distinctive **Pixel Grid Overlay** that reinforces a sense of digital craftsmanship and structural integrity. Every surface feels like a semi-transparent layer of polished obsidian, catching light only at the edges. The emotional response is one of sophisticated control—sophistication through darkness, and clarity through deep violet and amber accents.

## Colors

The palette has transitioned to an atmospheric, multi-tonal spectrum centered on **Vivid Violet (#9457DF)**.

- **Primary:** Violet (#9457DF) is used for critical data points, active states, and focus indicators, replacing the previous neon green with a more mysterious, high-energy hue.
- **Surface Layers:** The background remains a deep neutral black (#0D0D0D), while interactive cards and panels use semi-transparent variations of the secondary lavender-grey (#866CA5).
- **Functional Colors:** Tertiary amber (#632D00) is used for high-priority alerts and distinct data categories, providing a warm counterpoint to the cool primary tones.

## Typography

The typography strategy pairs the wide, geometric stance of **Sora** for headlines with the utilitarian clarity of **Inter** for body text. To lean into the technical nature of the design system, **JetBrains Mono** is utilized for metadata and labels.

The "Montreal" logo style—extended, wide, and futuristic—is mirrored in the headline letter-spacing and weight. Use `label-caps` for all navigational elements and section headers to maintain a disciplined, "head-up display" (HUD) feel.

## Layout & Spacing

This design system utilizes a **Fixed Grid** model for desktop to ensure the glassmorphic layers align perfectly with the pixel-grid background. 

- **The Grid:** A 12-column grid with 24px gutters. Elements should snap to the grid to maintain the architectural "Vector" look.
- **The Pixel Overlay:** A repeating 4px x 4px or 8px x 8px dot or line grid is applied as a fixed background layer. All component margins must be multiples of 8px to ensure they never "break" the visual rhythm of the background pattern.
- **Adaptation:** On mobile, the grid collapses to a single column with 16px side margins, while cards transition from 3D-stacked layers to flat, full-width blocks.

## Elevation & Depth

Depth is not achieved through traditional drop shadows, but through **Tonal Stacking** and **Backdrop Blurs**.

1.  **Base Layer:** Solid black with the pixel grid overlay.
2.  **Level 1 (Cards/Panels):** 60% opacity background with a 20px backdrop blur. A 1px internal border (stroke) using 15% white simulates a "glass edge."
3.  **Level 2 (Modals/Popovers):** 80% opacity with 40px blur and a subtle 1px primary-color (#9457DF) outer glow.
4.  **Interactive State:** On hover, elements increase in stroke opacity. Active elements emit a soft violet bloom (blur: 15px, opacity: 0.2) rather than a dark shadow.

## Shapes

The shape language is "Advanced Geometric." While the overall structure is rigid and grid-based, individual containers use a **Medium Roundedness (0.5rem)** to prevent the UI from feeling overly aggressive or dated. 

Buttons and specific status tags use **Pill-shaped** geometry to provide a clear visual contrast against the rectangular layout of the data cards. This juxtaposition makes interactive elements immediately identifiable.

## Components

### Buttons
Primary buttons are solid Violet (#9457DF) with white text. Secondary buttons use a "Ghost" style: 1px violet border with a 10% violet fill and backdrop blur.

### Chips & Tags
Used for status and categories. They should have a 1px border and use the `label-caps` typography. When active, they glow with the primary violet accent or tertiary amber for critical status.

### Cards
The signature component. Each card must have a `backdrop-filter: blur(20px)` and a subtle 1px border. The top-right corner often features a "View Detail" arrow icon to maintain the dashboard's directional flow.

### Input Fields
Inputs are dark with an underline-only border or a very subtle 4-sided border. When focused, the border transitions to Violet with a soft outer glow.

### Data Visualization
Charts should use monochromatic gradients of the primary violet and secondary lavender. Use thin, 1px lines for axes and ensure the pixel grid is visible through the transparent fills of area charts.