# LinkedIn Banner Design Specifications for dbt-Workbench

---

## Banner Specifications

### Technical Requirements

| Specification | Value |
|---------------|-------|
| **Dimensions** | 1128x191 px (minimum 1128x191 px, recommended 1128x191 px) |
| **File Size** | Under 5MB (LinkedIn limit) |
| **Format** | PNG, JPG, or GIF |
| **Safe Area** | Center 191px (avoid placing text near edges) |

### Color Palette

Based on dbt-Workbench brand colors:

| Element | Color | Hex | RGB |
|---------|-------|-----|-----|
| **Primary Background** | Dark Navy | `#1a1a2e` | 26, 26, 46 |
| **Secondary Background** | Dark Gray | `#16213e` | 22, 33, 62 |
| **Accent Blue** | Bright Blue | `#0f4c75` | 15, 76, 117 |
| **Highlight** | Light Blue | `#3282b8` | 50, 130, 184 |
| **Text** | White | `#ffffff` | 255, 255, 255 |
| **Text Secondary** | Light Gray | `#e0e0e0` | 224, 224, 224 |

---

## Banner Concept 1: Feature Showcase

### Layout
```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  [Logo]  dbt-Workbench                    [Tagline on right side]    │
│          Open-Source UI for dbt            Model • Lineage • Orchestration
│                                                                      │
│  [Screenshot UI centered with annotations]                            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Elements

#### Left Side (30%)
- **Logo:** dbt-Workbench brand logo (from `assets/brand.svg`)
  - Size: ~100px width
  - Position: Left-aligned, vertically centered
- **Tagline:** "Open-Source UI for dbt"
  - Font: Inter or Roboto, Medium weight
  - Size: 14px
  - Color: `#ffffff`
  - Position: Below logo

#### Center (40%)
- **UI Screenshot:** Clean capture of dbt-Workbench interface
  - Show: Lineage graph with models and connections
  - Annotations: Small arrows pointing to features
  - Size: ~400px width
  - Add subtle drop shadow for depth

#### Right Side (30%)
- **Feature Pills (3-4 items)**
  ```
  • Model Browsing
  • Lineage Visualization
  • Run Orchestration
  • SQL Workspace
  ```
  - Font: Inter or Roboto, Regular
  - Size: 12px
  - Color: `#e0e0e0`
  - Each pill with small dot bullet (accent blue `#3282b8`)

#### Bottom (Full Width)
- **Call to Action:** Small text at bottom
  - Text: "docker-compose up --build" or "Get Started Free"
  - Font: Monospace (Fira Code or similar)
  - Size: 11px
  - Color: `#3282b8` (accent)
  - Position: Bottom center, subtle

---

## Banner Concept 2: Dark Theme Minimalist

### Layout
```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  dbt-Workbench  |  Open-Source UI for dbt                             │
│                                                                      │
│  [Abstract data flow visualization in background]                    │
│                                                                      │
│                    No Vendor Lock-in • Self-Hosted                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Elements

#### Top Bar
- **Logo:** Left-aligned, ~80px width
- **Name + Tagline:** "dbt-Workbench | Open-Source UI for dbt"
  - Font: Inter, Semi-bold
  - Size: 16px for name, 12px for tagline
  - Color: `#ffffff`

#### Background Visual
- **Abstract Data Flow:**
  - Thin lines connecting small circles/nodes
  - Gradient colors from dark blue (`#1a1a2e`) to lighter blue (`#3282b8`)
  - Subtle glow effect on connections
  - Low opacity (30-40%) to not interfere with text

#### Bottom Bar
- **Value Props:** Three key differentiators
  ```
  No Vendor Lock-in  •  Self-Hosted  •  Open Source
  ```
  - Font: Inter, Regular
  - Size: 11px
  - Color: `#e0e0e0`
  - Spaced with accent blue `•` separators

---

## Banner Concept 3: Code-First

### Layout
```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  dbt-Workbench                                                       │
│  Your open-source control plane for dbt                             │
│                                                                      │
│  [Code snippet box with syntax highlighting]                        │
│  > docker-compose up --build                                         │
│                                                                      │
│  Ready at http://localhost:3000                                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Elements

#### Header
- **Logo:** Top left, ~80px
- **Headline:** "Your open-source control plane for dbt"
  - Font: Inter, Medium
  - Size: 14px
  - Color: `#ffffff`

#### Code Block (Center)
- **Terminal Window Style:**
  - Background: Dark gray (`#0f0f0f`)
  - Rounded corners (4px)
  - Subtle shadow
  - Content:
    ```bash
    $ docker-compose up --build
    ✓ dbt-workbench-ui  ...ready
    ✓ dbt-workbench-api ...ready
    ✓ PostgreSQL        ...ready
    
    → UI: http://localhost:3000
    → API: http://localhost:8000
    ```
  - Font: Fira Code or JetBrains Mono (monospace)
  - Size: 11px
  - Colors:
    - Command: White (`#ffffff`)
    - Success messages: Green (`#4ade80`)
    - URLs: Light blue (`#60a5fa`)

#### Footer
- **Tagline:** "Get started in 30 seconds"
  - Font: Inter, Regular
  - Size: 12px
  - Color: `#3282b8` (accent)
  - Centered at bottom

---

## Image Assets Required

### 1. UI Screenshot for Concept 1
- **File:** `linkedin/assets/ui-screenshot.png`
- **Specs:**
  - Size: 800x600 px (downscaled for banner)
  - Content: Clean lineage graph view
  - Show: ~10-15 models with clear connections
  - Annotations: Add 2-3 small arrows pointing to features
  - Remove: Personal data, sensitive paths
  - Style: Clean, professional, well-labeled

### 2. Logo (PNG)
- **File:** `linkedin/assets/logo.png`
- **Specs:**
  - Convert `assets/brand.svg` to PNG
  - Size: 200x200 px (will be scaled down)
  - Transparent background
  - High resolution

### 3. Abstract Data Flow (Concept 2)
- **File:** `linkedin/assets/data-flow.png`
- **Specs:**
  - 1128x191 px
  - Abstract visualization (nodes + connections)
  - Gradient overlay
  - Dark theme background

### 4. Code Snippet Background (Concept 3)
- **File:** `linkedin/assets/code-snippet.png`
- **Specs:**
  - Terminal window frame
  - Dark background
  - Rounded corners
  - Shadow effect

---

## Design Tools

### Recommended Tools
1. **Figma** - Professional UI design, collaborative
2. **Canva** - Easy to use, templates available
3. **Adobe Illustrator** - Vector graphics, precision control
4. **Sketch** - macOS-native design tool

### Free Alternatives
1. **GIMP** - Open-source image editing
2. **Inkscape** - Open-source vector graphics
3. **Photopea** - Browser-based Photoshop alternative

---

## Brand Guidelines

### Typography
- **Primary Font:** Inter (Google Fonts)
- **Alternative:** Roboto (Google Fonts)
- **Monospace:** Fira Code, JetBrains Mono, or Source Code Pro
- **Usage:** Consistent font family across all assets

### Do's
✅ Use the exact color palette provided
✅ Keep design clean and minimal
✅ Ensure text is readable (high contrast)
✅ Use UI screenshots that reflect the actual product
✅ Include GitHub or Docker logo for credibility

### Don'ts
❌ Don't use stock photos unrelated to the product
❌ Don't overload with too much text
❌ Don't use fonts outside the brand guidelines
❌ Don't distort the logo
❌ Don't add gradients that clash with brand colors

---

## A/B Testing Banners

After launching, test different banners to optimize:

### Variant A: Feature Showcase (Concept 1)
- Focus on product features
- UI screenshot central
- Feature pills on right

### Variant B: Minimalist (Concept 2)
- Clean, abstract design
- Focus on values (no lock-in, self-hosted)
- Subtle data flow visualization

### Variant C: Code-First (Concept 3)
- Emphasize ease of use
- Show getting started command
- Terminal-style aesthetic

### Metrics to Track
- Page visits from LinkedIn
- Click-through rate to website
- Time spent on page
- Follower growth rate

---

## File Naming Convention

```
linkedin/assets/
├── banner-concept-1.png       # Feature showcase
├── banner-concept-2.png       # Minimalist
├── banner-concept-3.png       # Code-first
├── logo-200x200.png          # Transparent PNG logo
├── logo-300x300.png          # Larger version
├── ui-screenshot-clean.png   # Clean UI shot
├── ui-screenshot-annotated.png # With annotations
├── data-flow-bg.png          # Abstract background
└── code-snippet-bg.png       # Terminal window
```

---

## Next Steps

1. **Choose a concept** or create multiple for A/B testing
2. **Create required assets** using design tools
3. **Review against specifications** (size, colors, safe area)
4. **Get team feedback** before finalizing
5. **Export final files** in PNG format
6. **Upload to LinkedIn** Page Manager
7. **Test on different devices** (mobile preview in LinkedIn)
8. **Monitor performance** and iterate

---

## Example Implementation (Figma)

If using Figma:
1. Create new frame: 1128x191 px
2. Add rectangle: Fill `#1a1a2e` (primary background)
3. Place logo: Left side, ~80px
4. Add tagline: Below logo, Inter 14px, white
5. Add UI screenshot: Center, ~400px
6. Add feature pills: Right side, Inter 12px, light gray
7. Export as PNG: 1128x191 px, @1x scale

---

## Questions for Design Review

Before finalizing, ask:
- Is the logo clearly visible and not distorted?
- Is the tagline easy to read?
- Do the UI screenshots look professional?
- Is there enough white/negative space?
- Does it work at different zoom levels?
- Is the color scheme consistent?
- Would this catch a scrolling user's attention?
- Does it communicate the value proposition quickly?
