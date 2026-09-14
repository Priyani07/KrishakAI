# Krishak Phase 1 Design Brief

## Three visual approaches considered

### Theme Name: Field Atlas
Very Brief Intro: A calm agricultural technology system combining deep navy navigation, field greens, soil ochres, and documentary photography. It treats every tool as part of a practical field atlas rather than a generic dashboard.
Probability: 0.06

### Theme Name: Fresh Market Ledger
Very Brief Intro: A bright editorial catalog direction with paper-like surfaces, crop cards, restrained green accents, and data-first layouts inspired by seed and fertilizer reference sheets.
Probability: 0.03

### Theme Name: Sensor Canopy
Very Brief Intro: A dark connected-farm direction using quiet network lines, sensor-node motifs, and luminous crop accents to suggest real-time agricultural intelligence without becoming cyberpunk.
Probability: 0.08

## Chosen approach: Field Atlas

### Design Movement
Contemporary editorial agritech: documentary field imagery, natural materials, practical information hierarchy, and restrained digital precision.

### Core Principles
1. **Tools before decoration:** every card and CTA must lead to a real route or clearly state that the module is coming in a later phase.
2. **Field-to-screen contrast:** deep navy frames the platform, living greens anchor agriculture, and warm ochre marks actions and priorities.
3. **Editorial rhythm:** use asymmetrical sections, strong left-aligned headings, labeled metadata, and generous breathing room rather than a generic centered SaaS grid.
4. **Trust through clarity:** no fake sensor values, AI predictions, reviews, or testimonials are introduced in Phase 1.

### Color Philosophy
The signature brand color is **Krishak Leaf #5B8E3D**, a grounded green that feels cultivated rather than neon. Deep navy #0D1824 provides a trustworthy shared shell, forest #173F2A supports agricultural depth, field mist #F3F6EF keeps long pages readable, and harvest ochre #E7A72F is reserved for action and emphasis. Color should distinguish page families while keeping navigation consistent.

### Layout Paradigm
Use a strong top navigation and split-page composition: wide hero/intro bands, then an offset feature constellation where cards feel like field markers rather than uniform tiles. Detail pages use a narrow reading column beside a contextual rail or metadata strip. The main hub can use a responsive grid, but cards should have varied accent treatments and intentional vertical rhythm.

### Signature Elements
1. Thin contour-line and sensor-node motifs used sparingly in the agricultural footer and hub background.
2. Small uppercase field labels such as `FIELD TOOL`, `COMMUNITY`, and `GUIDE` above page titles.
3. Rounded crop-marker cards with a colored edge or icon plate, not excessive all-over pill shapes.

### Interaction Philosophy
Interactions should feel deliberate and useful. Navigation is immediate. Cards lift slightly and reveal a clearer action label on hover. Placeholder pages state exactly what is planned without pretending to produce results. Mobile navigation uses a compact drawer with visible focus states.

### Animation
Use short 180–240ms ease-out transitions for card lift, link color, and mobile menu reveal. Stagger hub cards by 40ms only when the user has not requested reduced motion. Do not animate data that does not exist. Respect `prefers-reduced-motion`.

### Typography System
Use **DM Sans** for readable interface copy and **Fraunces** for large editorial page titles only. Headlines use a confident 700 weight with tight line height; body copy remains 400–500 with a generous line height. Navigation uses compact 600-weight text. Avoid Inter and avoid display type for long labels.

### Brand Essence
Krishak is a practical digital field atlas for farmers and agricultural communities who need clearer tools, guidance, and support in one connected place.
Personality: grounded, capable, optimistic.

### Brand Voice
Headlines are direct and field-aware. CTAs are specific and action-oriented. Microcopy explains what is available now and what is planned without hype.

Example lines:
- “Make the next field decision with better context.”
- “Choose a tool, then keep moving.”

### Wordmark & Logo
Use the generated leaf-and-sun emblem as the primary mark, paired with a custom text lockup in Fraunces small caps or a visually adjusted wordmark. Never rely on a default text-only logo. The mark must appear in the navbar at a clearly visible size and as the favicon.

### Signature Brand Color
**Krishak Leaf — #5B8E3D**.

## Phase 1 implementation reminders

- JavaScript/JSX only; no TypeScript.
- Use internal routes for every approved Phase 1 destination.
- Do not use local development endpoints in application source.
- Keep the agricultural footer separate from the community footer because the reference screenshots show two page families.
- Placeholder pages must be honest, route-complete, and visually consistent.
- Do not modify the uploaded reference project at `/home/ubuntu/krishak_analysis/source/Krishak-main`.
