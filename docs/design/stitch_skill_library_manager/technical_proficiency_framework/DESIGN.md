---
name: Technical Proficiency Framework
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002113'
  on-tertiary-container: '#009668'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-sm:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar-width: 260px
  container-max: 1440px
  gutter: 24px
  margin-page: 32px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

The design system is engineered for high-productivity desktop environments, specifically tailored for skill management and technical oversight. The brand personality is **Systematic, Precise, and Empowering**. It treats information density as a feature rather than a constraint, utilizing a "Developer-First" aesthetic that prioritizes logic and clarity over decorative flair.

The visual style is **Corporate Modern with a Minimalist edge**. It leverages a structured grid, purposeful whitespace, and a high-contrast palette to ensure that complex data—such as skill hierarchies and usage statistics—remains digestible at a glance. The emotional response should be one of "command and control," giving users confidence in the accuracy and organization of the underlying data.

## Colors

This design system utilizes a sophisticated "Slate & Tech Blue" palette.

- **Primary (#0F172A):** A deep navy/slate used for high-level navigation, primary headings, and structural elements to provide a grounded, professional foundation.
- **Secondary (#3B82F6):** A vibrant blue reserved for interactive elements, primary actions, and focus states.
- **Surface & Background:** The system uses a tiered neutral approach. The main application background is **#F8FAFC**, while cards and containers use pure white (#FFFFFF) to create a clear visual separation.
- **Semantic Accents:** Success and active states utilize **#10B981 (Emerald)**. Warnings and pending actions use **#F59E0B (Amber)**.
- **Borders:** All structural divisions use a low-contrast **#E2E8F0** to maintain a clean, "unboxed" feel while providing enough definition for high information density.

## Typography

The typography system is built on **Inter** for its exceptional legibility and neutral tone, paired with **Geist** for technical labels and metadata to lean into the developer-friendly aesthetic.

- **Hierarchy:** Use `display-sm` only for main dashboard titles. `headline-md` and `sm` should be used for card titles and section headers.
- **Information Density:** `body-md` is the workhorse for general content. `body-sm` is used for descriptions and secondary metadata.
- **Technical Metadata:** Use `label-sm` (uppercase) for status badges, tags, and table headers to provide a distinct visual contrast from standard body text.
- **Line Heights:** Generous line heights are maintained for body text to ensure readability in data-heavy views, while headlines use tighter leading for a punchy, modern look.

## Layout & Spacing

The system follows a **Fixed-Fluid Hybrid** model optimized for desktop productivity.

- **Navigation:** A fixed 260px sidebar on the left contains primary navigation and workspace switching. It uses a slightly darker surface than the main content area.
- **Content Area:** A fluid container with a maximum width of 1440px ensures data doesn't become over-extended on ultra-wide monitors.
- **The 8px Grid:** All spacing (padding, margins, gaps) must be a multiple of 8px.
- **Information Clusters:** Use 16px (stack-md) for gaps between cards and 8px (stack-sm) for elements within a card.
- **Responsive Reflow:** For tablet views, the sidebar collapses into a 64px icon rail, and the main grid transitions from a 3-column to a 1-column layout for skill cards.

## Elevation & Depth

This design system uses a **Low-Contrast Layering** approach rather than heavy shadows to maintain a clean, professional look.

- **Level 0 (Background):** #F8FAFC. The foundation of the application.
- **Level 1 (Cards/Sidebar):** White (#FFFFFF) with a 1px border of #E2E8F0. This is the default state for content containers.
- **Level 2 (Active/Hover):** A subtle, diffused shadow: `0px 4px 6px -1px rgba(15, 23, 42, 0.05)`. Used when a user interacts with a skill card.
- **Level 3 (Modals/Popovers):** A more pronounced shadow to indicate focus: `0px 10px 15px -3px rgba(15, 23, 42, 0.1)`.
- **Depth via Tones:** Interactive elements like buttons use flat color fills. Depth is communicated through color shifts (darker on hover) rather than physical elevation.

## Shapes

The shape language is **Structured and Modern**.

- **Standard Radius:** 8px (0.5rem) is used for standard buttons, input fields, and small components.
- **Container Radius:** 12px (0.75rem) is used for skill cards and large dashboard modules to provide a softer, more modern "app" feel.
- **Interactive States:** Focus rings should be a 2px offset solid line using the Secondary color (#3B82F6).
- **Icons:** Use linear, 2px stroke-width icons to match the technical precision of the typography.

## Components

### Buttons
- **Primary:** Solid #3B82F6 with White text. 8px radius.
- **Secondary:** White background with #E2E8F0 border and Primary text.
- **Ghost:** No border or background; text only. Used for secondary actions in lists.

### Skill Detail Cards
Cards are the core of the system. They must include:
- A `headline-sm` title.
- A `label-sm` category tag in the top-right.
- A horizontal progress bar for "Proficiency Level."
- A small sparkline chart showing "Usage Frequency."

### Usage Charts & Stats
Charts should use a simplified geometric style. Use #3B82F6 for primary data series and #E2E8F0 for background grid lines. Avoid gradients in charts; stick to solid fills or 2px strokes.

### Rating/Review Components
Use a 5-step horizontal bar system or a star-rating with 16px icons. Active states use #F59E0B (Amber).

### Progress Indicators
- **Download/Sync:** A slim (4px height) linear progress bar.
- **States:** Use #3B82F6 for "In Progress" and transition the entire bar to #10B981 upon completion.

### Form Inputs
Inputs use #FFFFFF background with a 1px #E2E8F0 border. On focus, the border changes to #3B82F6 with a subtle outer glow (2px). Labels should use `label-md` and sit 4px above the input.