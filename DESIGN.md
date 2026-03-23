# Queue Whisperer Interactive — Design Document

## Overview

A single-page interactive experience that teaches G/G/1 queueing theory through the narrative and characters from Seyed Iravani's "Operations Engineering and Management" textbook. The site is both a companion to the book (Chapters 1 and 3) and a standalone educational tool for a broad audience, including kids interested in queueing theory.

The experience is story-driven with progressive levels that unlock controls, culminating in a full G/G/1 sandbox. Users can skip directly to the sandbox at any time.

## Audience

- Students in Prof. Iravani's course at Northwestern
- General readers of the book
- Kids and curious learners with no prior queueing background
- The site ships as a companion with the book

## Characters (from the book)

Three characters appear as PNG sprites with multiple emotional states:

### Quentin Lineworth III ("The Queue Whisperer")
- The narrator and guide
- Grew up obsessed with lines, earned a PhD in queueing theory
- Comic-book fan who sees villains everywhere
- Poses: confident/thumbs-up, concerned/thinking, alarmed/stopwatch-out, celebrating

### Randomizer (Villain #1 — Variability)
- Real name: Dr. Chaos, Lord of Variability
- Trickster who creates randomness in arrival times and service times
- Armed with enchanted dice
- Poses: defeated/sleeping (low CV), alert/scheming (mid CV), cackling/powerful (high CV), maximum-chaos boss mode (CV = 1.0)

### Chain Master (Villain #2 — Dependency)
- Real name: Ka'Lor Veynar, Dependucer
- Creates invisible chains between people in line, forcing dependency
- One person's slow service ripples through everyone behind them
- Poses: weak/chains-broken (low ρ), rising/chains-tightening (mid ρ), dominant/chains-everywhere (high ρ), unstoppable (ρ > 0.95)

## Art Style

Ink-on-paper comic book style consistent with the book's illustrations. May be colorized (not restricted to black-and-white). All character assets are PNGs with transparent backgrounds, rendered at 2x for retina (e.g., 256×320 actual, displayed at 128×160).

Total PNG assets needed: ~12 poses (4 per character × 3 characters).

## Page Architecture

Single scrollable page with 7 sections:

### Section 1: Hero
- Full-width hero with comic-book energy
- Quentin sprite (confident pose) + teaser queue animation
- Book tagline
- Two CTAs: "Start the story" (scrolls to Level 0) and "Skip to sandbox" (scrolls to Section 6)

### Section 2: Level 0 — Meet the Queue (Chapter 1)
- Narrative panel with book context (Quentin's origin story)
- Auto-playing queue animation: customers arrive, wait, get served
- No user controls — just observation
- Quentin narrates via speech bubbles
- Introduces the question: "Why do queues form?"
- "Next" button advances to Level 1

### Section 3: Level 1 — Meet Randomizer (Chapter 3, Part 1)
- Randomizer sprite appears
- First controls unlocked: Arrival CV slider + Service CV slider
- Low CV = steady flow, high CV = chaos
- Randomizer's expression changes based on CV values
- Challenge: keep Wq under a target threshold
- Book narrative about discovering variability at Giggly Kingdom

### Section 4: Level 2 — Meet Chain Master (Chapter 3, Part 2)
- Chain Master sprite appears
- New control unlocked: Utilization (ρ) slider
- Visual chain-ripple animation when one customer is slow
- Key insight: high utilization + dependency = long waits even with low variability
- Book narrative about the "Queue Chain of Pain"

### Section 5: Level 3 — The Law of Two Villains (Chapter 3 Finale)
- Both villains on screen simultaneously
- All sliders available
- Challenge/boss fight: Queue starts in crisis (high ρ, high CV). Player must bring Wq below the red line by adjusting ONE parameter group
- When player succeeds, weakened villain collapses, Quentin celebrates
- "Law of Two Villains" reveal: weaken either variability OR dependency to shrink the queue

### Section 6: Sandbox — Full G/G/1 Playground
- All parameters unlocked: arrival rate, service rate, arrival CV, service CV
- Full real-time discrete-event simulation with animated queue
- Responsive villain sprites reacting to queue state
- Live stats dashboard: ρ, Lq, Wq, W, L
- Narrative triggers: extreme parameter values surface book quotes
- This is also the direct destination for "Skip to sandbox"

### Section 7: Footer
- Northwestern branding
- Book info and author credit
- Link to existing queueing.vercel.app calculator
- Purple bar matching existing project style

## Simulation Engine

### Analytical (Kingman's VUT Formula — distribution-free)
Used for the live stats dashboard. Adapted from the existing GGs() function with servers=1:

```
V = (cv²_arrival + cv²_service) / 2
U = ρ / (1 - ρ)          // simplified for s=1
T = mean_service_time

Wq = V × U × T           // mean time in queue
Lq = Wq × arrival_rate   // mean number in queue  
W  = Wq + T              // mean time in system
L  = W × arrival_rate    // mean number in system
```

No distributional assumptions needed — just CVs and utilization.

### Discrete-Event Simulation (Gamma Distribution)
Used for the animated queue visualization. Gamma is chosen because CV maps cleanly to the shape parameter:

Given target mean `μ` and coefficient of variation `CV`:
- Shape: `k = 1 / CV²`
- Scale: `θ = μ × CV²`
- So `k × θ = μ` (mean is preserved)

Special cases:
- CV = 0 → deterministic (return mean directly)
- CV = 1 → exponential (k = 1)
- CV > 1 → hyper-variable (k < 1)

**Animation pacing**: Mean service time is fixed at ~3 seconds of real time. Mean interarrival time is derived from utilization: `meanInterarrival = meanService / ρ`. This keeps the simulation watchable regardless of parameter settings.

### Gamma Random Variate Generation
Use the Marsaglia and Tsang method for shape ≥ 1, with the transformation trick for shape < 1:
```
If k ≥ 1: Marsaglia-Tsang rejection method
If 0 < k < 1: Generate Gamma(k+1) × U^(1/k) where U ~ Uniform(0,1)
```

## Sprite State Machine

Characters swap PNG poses based on queue state thresholds:

| Character    | Trigger            | Threshold     | Pose                    |
|--------------|--------------------|---------------|-------------------------|
| Randomizer   | max(CV_a, CV_s)    | < 0.3         | Defeated / sleeping     |
| Randomizer   | max(CV_a, CV_s)    | 0.3 – 0.7     | Alert / scheming        |
| Randomizer   | max(CV_a, CV_s)    | > 0.7         | Cackling / powerful     |
| Randomizer   | max(CV_a, CV_s)    | = 1.0         | Maximum chaos (boss)    |
| Chain Master | ρ                  | < 0.5         | Weak / chains broken    |
| Chain Master | ρ                  | 0.5 – 0.8     | Rising / tightening     |
| Chain Master | ρ                  | > 0.8         | Dominant / everywhere   |
| Chain Master | ρ                  | > 0.95        | Unstoppable             |
| Quentin      | Wq vs target       | Wq < target   | Confident / thumbs up   |
| Quentin      | Wq vs target       | Wq ≈ target   | Concerned / thinking    |
| Quentin      | Wq vs target       | Wq >> target  | Alarmed / stopwatch     |
| Quentin      | Level complete      | —             | Celebrating             |

## Tech Stack

- Static site (HTML + CSS + JS), no framework
- Deployable to Vercel/Netlify
- Mobile-first responsive design
- No build step required (vanilla JS modules)
- PNG sprites loaded as `<img>` tags, swapped via src attribute
- Canvas or SVG for queue animation (TBD based on performance)
- Existing Northwestern purple (#401F68) and lavender (#B6ACD1) as accent colors

## Responsive Behavior

- Desktop: Queue animation and villain sprites side-by-side
- Mobile (< 750px): Villain sprites stack above the queue scene
- Controls stack vertically on narrow screens
- Stats grid goes from 4 columns → 2 columns on mobile

## File Structure

```
index.html          — Page structure and sections
style.css           — All styling (responsive, animations, theming)
js/
  main.js           — Section navigation, level progression, scroll handling
  simulation.js     — Discrete-event simulation engine (Gamma RNG, event loop)
  analytics.js      — Kingman's formula calculations (adapted from GGs)
  sprites.js        — Character state machine, PNG swapping
  queue-renderer.js — Queue animation (drawing customers, chain ripples)
assets/
  sprites/          — Character PNGs (randomizer-*.png, chainmaster-*.png, quentin-*.png)
  book/             — Book cover, any other static images
```

## Narrative Triggers (Sandbox Mode)

When users hit certain parameter thresholds in the sandbox, story snippets appear:

| Trigger              | Quote/Narrative                                           |
|----------------------|-----------------------------------------------------------|
| ρ > 0.95             | Quentin's DMV story — "the Olympics of waiting"           |
| CV = 0               | "If everything were perfectly predictable, no queue at all"|
| CV = 1.0             | Randomizer at full Poisson power                          |
| ρ < 0.3              | "The villains took a coffee break"                        |
| Wq > 10× service time| "Five stages of queue grief" from Chapter 1               |
| First time ρ > 1.0   | System instability warning + book explanation             |

## Color Palette

Primary: Northwestern purple (#401F68)
Secondary: Lavender (#B6ACD1)  
Accent warm: Coral/amber for Randomizer-related elements
Accent cool: Steel blue for Chain Master-related elements
Success: Green for healthy queue state
Danger: Red for crisis/instability
Background: Light warm gray, matching the book's paper tone

## Open Items

- [ ] Generate ~12 character PNG sprites (4 poses × 3 characters)
- [ ] Decide on canvas vs SVG for queue animation
- [ ] Write book excerpt snippets for narrative panels and sandbox triggers
- [ ] Determine exact "challenge" targets for Levels 1-3
- [ ] Accessibility: keyboard navigation, screen reader support for simulation state
