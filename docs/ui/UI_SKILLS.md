# Satelink UI & Design Skills Inventory

This document tracks all design, interaction, animation, and UI review skills installed and evaluated for the Satelink marketing redesign and design engineering workflows.

---

## Architecture Context

- **Primary Marketing Site (`satelink.network`)**: Owned by `apps/web` (Next.js 15 App Router, Tailwind CSS v4, Framer Motion v12, Radix UI, Lucide icons, Geist / Inter / Source Serif 4 / JetBrains Mono fonts).
- **Corporate Site (`jakuraa.com`)**: Owned by `apps/corporate` (Next.js 15 App Router, Tailwind CSS v4, Source Serif 4 + Inter fonts).
- **Shared Marketing Design System**: `@satelink/web-ui` ("Satelink Signal") located in `packages/web-ui` (provides `--sl-*` design tokens in `tokens.css`, `foundation.css`, `motion` primitives, infographics, and shared layout components).
- **Internal Dashboard System**: `@satelink/ui` located in `packages/ui` (distinct admin/node operator system).

---

## 1. Installed Skills

### Anthropic Frontend Design

- **Skill**: `frontend-design`
- **Purpose**: Guidance for distinctive, intentional visual design when building new UI or reshaping existing interfaces. Helps establish aesthetic direction, typography hierarchy, and avoid generic or templated AI design defaults.
- **Installation method**: `npx skills add anthropics/skills --skill frontend-design`
- **Installed version/source**: `anthropics/skills` (`skills/frontend-design/SKILL.md`, hash: `89496d5d...`)
- **Location**: `.agents/skills/frontend-design` and `.claude/skills/frontend-design`
- **How to invoke**: Automatically triggers on UI redesign/build tasks, or invoke explicitly via skill prompt referencing frontend design guidelines.
- **Where it applies**: `apps/web/src/app/(marketing)` (`satelink.network`) and `apps/corporate` (`jakuraa.com`).
- **Known overlap**: Overlaps in philosophy with `design-taste-frontend`; `frontend-design` focuses on conceptual identity, layout balance, and anti-cliché art direction, while `design-taste-frontend` provides tactical CSS/motion rules and design reads.
- **Verification result**: Verified present in `.agents/skills` and `.claude/skills`, discoverable by `skills list`, frontmatter valid.

---

### Leonxlnx Taste Skill (Frontend)

- **Skill**: `design-taste-frontend`
- **Purpose**: Anti-slop frontend skill for landing pages and marketing redesigns. Enforces brief inference ("Design Read"), rejects templated SaaS aesthetics, and mandates typography restraint, authentic section variation, and calibrated palette usage.
- **Installation method**: `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"`
- **Installed version/source**: `https://github.com/Leonxlnx/taste-skill` (`skills/taste-skill/SKILL.md`, hash: `6d838b24...`)
- **Location**: `.agents/skills/design-taste-frontend` and `.claude/skills/design-taste-frontend`
- **How to invoke**: Triggered when redesigning landing pages, crafting visual sections, or assessing page craft. Requires stating a one-line "Design Read" before implementing.
- **Where it applies**: `apps/web` landing page, marketing subpages (`/pricing`, `/network`, `/platform`, `/solutions`), and `apps/corporate`.
- **Known overlap**: Pairs with `frontend-design` for visual aesthetic guidance and with `emil-design-eng` for interaction polish.
- **Verification result**: Verified present in `.agents/skills` and `.claude/skills`, discoverable by `skills list`, frontmatter valid.

---

### Emil Kowalski Design & Motion Skills Suite

Installed from `emilkowalski/skills` via `npx skills@latest add emilkowalski/skills`:

#### A. `animate`
- **Purpose**: Step-by-step decision framework for building animations from scratch: gating whether it should animate, selecting tool/properties, defining spring curves/timing, handling interruptions and exit transitions.
- **Source**: `emilkowalski/skills` (`skills/animate/SKILL.md`)
- **Location**: `.agents/skills/animate` and `.claude/skills/animate`
- **How to invoke**: Use when implementing motion primitives, scroll triggers, hero reveals, or interactive transitions.
- **Where it applies**: `packages/web-ui/src/motion`, `apps/web` marketing components.
- **Known overlap**: Integrates directly with Framer Motion (`framer-motion: ^12.38.0`) in `apps/web`.
- **Verification result**: Verified present, discoverable by `skills list`.

#### B. `emil-design-eng`
- **Purpose**: Encodes Emil Kowalski's core design engineering philosophy: compounding unseen micro-details, component craftsmanship, tactile feedback, and sensory restraint.
- **Source**: `emilkowalski/skills` (`skills/emil-design-eng/SKILL.md`)
- **Location**: `.agents/skills/emil-design-eng` and `.claude/skills/emil-design-eng`
- **How to invoke**: Use when building or refining core UI components (buttons, cards, headers, interactive displays).
- **Where it applies**: `packages/web-ui`, `apps/web`, `apps/corporate`.
- **Known overlap**: Complements `frontend-design` by focusing on engineering implementation and interaction feel.
- **Verification result**: Verified present, discoverable by `skills list`.

#### C. `review-animations`
- **Purpose**: Rigorous code reviewer against animation best practices (flags over-animation, linear easings, inappropriate scale transforms, layout thrashing, lack of `prefers-reduced-motion`).
- **Source**: `emilkowalski/skills` (`skills/review-animations/SKILL.md`)
- **Location**: `.agents/skills/review-animations` and `.claude/skills/review-animations`
- **How to invoke**: Run during PR reviews or pre-commit checks on animation code.
- **Where it applies**: All animation and motion code in `packages/web-ui` and `apps/web`.
- **Known overlap**: Works in tandem with `improve-animations`.
- **Verification result**: Verified present, discoverable by `skills list`.

#### D. `find-animation-opportunities`
- **Purpose**: Read-only exploration tool that analyzes UI code to identify moments where subtle motion would elevate clarity, while rejecting areas that should remain static.
- **Source**: `emilkowalski/skills` (`skills/find-animation-opportunities/SKILL.md`)
- **Location**: `.agents/skills/find-animation-opportunities` and `.claude/skills/find-animation-opportunities`
- **How to invoke**: Ask the agent: "what could be animated here?" or "audit potential motion opportunities".
- **Where it applies**: `apps/web/src/app/(marketing)` pages.
- **Known overlap**: Feeds inputs into `animate`.
- **Verification result**: Verified present, discoverable by `skills list`.

#### E. `improve-animations`
- **Purpose**: Surveys an entire codebase's motion code to generate a prioritized animation roadmap and audit.
- **Source**: `emilkowalski/skills` (`skills/improve-animations/SKILL.md`)
- **Location**: `.agents/skills/improve-animations` and `.claude/skills/improve-animations`
- **How to invoke**: Use when auditing existing animations across the repository.
- **Where it applies**: `packages/web-ui/src/motion` and existing landing page components.
- **Verification result**: Verified present, discoverable by `skills list`.

#### F. `apple-design`
- **Purpose**: Translates Apple's interface guidelines (fluid physical motion, spring dynamics, spatial consistency, depth, optical typography) to modern web applications.
- **Source**: `emilkowalski/skills` (`skills/apple-design/SKILL.md`)
- **Location**: `.agents/skills/apple-design` and `.claude/skills/apple-design`
- **How to invoke**: Use when designing gesture-driven UI, bottom sheets, translucent backdrop-filter materials, or fluid physics.
- **Where it applies**: Marketing interactive showcases and mobile navigation.
- **Verification result**: Verified present, discoverable by `skills list`.

#### G. `mobile-native`
- **Purpose**: Optimizes mobile web performance and ergonomics (100vh bugs, tap highlight flashes, touch target sizes, notch padding, carousel gestures).
- **Source**: `emilkowalski/skills` (`skills/mobile-native/SKILL.md`)
- **Location**: `.agents/skills/mobile-native` and `.claude/skills/mobile-native`
- **How to invoke**: Use when testing responsive mobile viewports on `satelink.network` and `jakuraa.com`.
- **Where it applies**: `apps/web`, `apps/corporate`.
- **Verification result**: Verified present, discoverable by `skills list`.

#### H. `break-ui`
- **Purpose**: Stress-tests components against pathological edge cases (unbreakable strings, huge numbers, zero counts, long labels, localized text) behind a test toggle.
- **Source**: `emilkowalski/skills` (`skills/break-ui/SKILL.md`)
- **Location**: `.agents/skills/break-ui` and `.claude/skills/break-ui`
- **How to invoke**: Ask agent to "stress-test" or "try the worst case" on a component.
- **Where it applies**: Component testing across `packages/web-ui` and `apps/web`.
- **Verification result**: Verified present, discoverable by `skills list`.

#### I. `ask-sonner`
- **Purpose**: Best-practice integration guide for Sonner toast notifications (theming, positioning, promise toasts).
- **Source**: `emilkowalski/skills` (`skills/ask-sonner/SKILL.md`)
- **Location**: `.agents/skills/ask-sonner` and `.claude/skills/ask-sonner`
- **How to invoke**: Use when configuring or troubleshooting toasts. (Note: `sonner` is already installed in `apps/web` and `packages/web-ui`).
- **Where it applies**: `apps/web`, `packages/web-ui`.
- **Verification result**: Verified present, discoverable by `skills list`.

#### J. Supplementary Emil Kowalski Skills
- `animation-vocabulary`: Reverse-lookup glossary for naming motion effects.
- `pick-ui-library`: Curated library decision tree.
- `prototype`: Visual picker for fast multi-variant component prototyping.
- `animate-expo` & `write-swift`: Mobile native animation / Swift skills (bundled in the pack).

---

### Vercel Web Design Guidelines

- **Skill**: `web-design-guidelines`
- **Purpose**: Automated compliance auditor for Web Interface Guidelines (accessibility, contrast, touch targets, keyboard navigation, layout stability, UX heuristics). Serves as the pre-ship quality gate.
- **Installation method**: `npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines`
- **Installed version/source**: `vercel-labs/agent-skills` (`skills/web-design-guidelines/SKILL.md`, hash: `a6a44d54...`)
- **Location**: `.agents/skills/web-design-guidelines` and `.claude/skills/web-design-guidelines`
- **How to invoke**: Invoke via `check accessibility`, `audit design`, `review UX`, or before merging UI pull requests.
- **Where it applies**: All marketing pages, forms, and interactive views across `satelink.network` and `jakuraa.com`.
- **Known overlap**: Complements `review-animations` by focusing on accessibility and interface standards rather than motion physics.
- **Verification result**: Verified present in `.agents/skills` and `.claude/skills`, discoverable by `skills list`, frontmatter valid.

---

## 2. Skills Evaluated and Intentionally NOT Installed

| Skill | Source / Spec | Reason for Omission |
| :--- | :--- | :--- |
| **`webapp-testing` (Anthropic)** | `/plugin marketplace add anthropics/skills` / `/plugin install example-skills@anthropic-agent-skills` | **Environment limitation**: Claude Code `/plugin` slash commands are unavailable in this non-interactive terminal environment. Per strict rule ("do not improvise"), the CLI command was not invented or bypassed. Equivalent CLI command identified: `npx skills add anthropics/skills --skill webapp-testing`. |
| **`shadcn/ui` Skill** | `shadcn-ui/ui@shadcn` | **Architecture conflict**: `apps/web` already has `shadcn` CLI (`^3.8.4`) and `components.json`. However, the repository has established a monorepo shared package `@satelink/web-ui` ("Satelink Signal") with custom design tokens (`--sl-*`) and foundation styles. Generic shadcn skills encourage generating unmodified shadcn components directly into `apps/web/src/components/ui/`, violating the token and package isolation rules. |
| **`Impeccable`** | `pbakaus/impeccable` | **Instruction overlap & fragmentation**: Impeccable's suite (`colorize`, `bolder`, `delight`, `quieter`, `typeset`) duplicates the guidance already provided by `frontend-design`, `design-taste-frontend`, and `emil-design-eng`. Installing it would create competing aesthetic directives. |
| **`Interface Design`** | `dammyjay93/interface-design` | **Duplication**: General-purpose interface heuristics are already covered by `web-design-guidelines` and `frontend-design`. Installing an unvetted third-party interface skill adds unnecessary noise. |

---

## 3. Verification Summary

- **Skill Directories**:
  - `.agents/skills/`: 17 skills installed and active.
  - `.claude/skills/`: Linked for multi-agent / Claude Code compatibility.
  - `skills-lock.json`: Created at repository root to lock skill sources and hashes.
- **Application Code Status**: 100% untouched. No files in `apps/`, `packages/`, `services/`, or `package.json` were modified.
- **Dependencies Status**: No `npm` / `pnpm` packages were added or altered in `package.json` or `package-lock.json`.
- **Discoverability**: Confirmed via `npx skills list`.
