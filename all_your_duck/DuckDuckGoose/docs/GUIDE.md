# DuckDuckGoose — Reading Your Results

A plain-language walkthrough: what each stage does, what every graph shows, what the numbers mean, and how to interpret them.

---

## 0. What this tool actually does — and what it does NOT claim

DuckDuckGoose takes a folder of documents, builds a crowd of AI "people" seeded from them, drops them onto a simulated social platform (Reddit-style), and has them argue **your question** for a number of rounds. It then reports what that simulated discussion *concluded*.

**Read this once and keep it in mind:** the result is **"what the simulated forum's discourse implies,"** not a calibrated real-world forecast. When you see *"NO, 30% confidence,"* that means *"the simulated discussion leaned NO, and the analysis is only ~30% sure of that read"* — it is **not** "a 30% chance the real event happens." Every number below describes the **conversation**, not the world. The tool is built to be *documented, not fabricated*: it shows you what the agents actually said and how it was measured, and it deliberately avoids dressing that up as a real-world prediction.

---

## 1. The pipeline (the row of steps at the top)

You move left → right through six stages. Each unlocks the next.

| Stage | What it does |
|---|---|
| **Corpus** | Create a project, give it your **anchor question**, and upload/point at the documents the simulation is seeded from. |
| **Universe** | Extract the people/places/orgs from the docs into an **entity graph**, then build the **population** — N agents (real figures + a crowd) with personas, stances, and follow-relationships. |
| **Run** | Launch the simulation: pick platform (Reddit, Twitter, or **both** — "both" runs two platforms and adds an optional cross-feed), number of rounds, and time-dials, then watch a live event stream. |
| **Story** | *Watch* a finished or running sim unfold as a threaded social feed (see §2). |
| **Results** | *Read* the analysis: the verdict, the charts, the faction scoreboard, the reply network, and the full report (see §3). |
| **Talk** | Interview or chat with any individual agent about what it did and saw (see §4). |

**Agent tiers** (you'll see these everywhere as colors/badges):

| Tier | What it is | Color cue |
|---|---|---|
| **protagonist** | The named main characters (real-world figures). Run on the strongest model, always active, best to interview. **You choose how many** when you build the population (a handful by default; the example run referred to throughout this guide had 22). | coral |
| **crowd_llm** | The lightweight-LLM crowd — ordinary "people" who react. | cyan/sky |
| **crowd_policy** | The compiled-rule crowd (no LLM, cheap to run at scale) — the mass that creates volume. | muted grey |

---

## 2. The Story feed — watching it unfold

Pick a run, then use the controls to replay the conversation round by round.

- **▶ Play** auto-advances from wherever the scrubber currently is, revealing posts as they were written; if you're already at the last round, it rewinds to 0 and replays. The **round scrubber** lets you jump anywhere; **Round N / max** shows where you are.
- **Activity timeline** (the little bar chart): each bar is one round, height = how busy it was. The bar for your **current** round is highlighted (accent color) and rounds up to it are shaded as "past". Click a bar to jump there; hovering shows a tooltip.
- **Sort**: *Active* (threads with the most recent replies first), *Latest* (newest posts first), *Top* (most up-voted first).
- **Posts & replies**: each card shows the author's **name**, **@handle**, a **tier color**, a **faction badge** (their stance), a **★** if they're a protagonist, the **round** it was posted, and **↑likes ↓dislikes**. Replies are nested one level under their post (that's all the depth the platform records — it's not faked deeper).

**The instrument strip** (the two mini-charts above the feed) moves *with* the scrubber:

| Strip | What it shows | How to read |
|---|---|---|
| **net mood** | The round's overall sentiment, sign-colored (green positive / red negative). | The vertical **playhead** marks your current round; the readout (e.g. *"−0.37 · negative"*) is that round's mood. |
| **discourse lean** | Which *stance bloc* posted more that round. It compares the two opposing stance blocs the run identified (here: pro-reopening vs hardline-closure) — so it reads *"reopening-leaning / closure-leaning / evenly split"*. It's a measure of which camp was **louder**, **not** a probability, and it's tied to those specific stance labels (a different question would have different ones). |

Shaded bands behind the strips = **"night" rounds** (see §3) where only the protagonists were posting.

---

## 3. The Results page — reading the analysis

### 3a. The verdict (top of the page)

- **The answer** — the report's directional conclusion to your question, in prose.
- **Confidence gauge** — a 0–100% bar. This is the analysis's certainty in *that read of the discourse*:

| Range | Label | Read it as |
|---|---|---|
| **< 34%** | low | a *directional* read only — leans this way but far from settled |
| **34% to <66%** | moderate | leans this way but contested |
| **≥ 66%** | high | the discourse points clearly this way |

- **Loudest voices** — the 2–3 top posts by **net votes** (likes − dislikes), by name. These are the *amplified* arguments, not cherry-picked. (The ↑ number shown is the like count; ranking uses the net.)
- **How it unfolded** — a short spine of key moments: the elite-only "night" round(s), the loudest round, the mood low, and the close. If a richer narrative has been generated for the run, these become fuller prose (written by the model — see the footer); otherwise they're deterministic key-moment beats.

### 3b. The charts (and a one-line caption under each)

Behind the line charts you'll see **faint shaded bands = "night" rounds** — rounds where *only the protagonists posted* (the time-of-day scheduler had the crowd asleep). This matters: a dramatic dip in a night round rests on a handful of elite posts, while a gentler dip in a busy "day" round rests on dozens. **Always read a point inside its band.**

| Chart | What each point/bar is | Range | How to read |
|---|---|---|---|
| **Sentiment trend** | Each round's net mood = (positive − negative) ÷ all classified posts that round. | **−1 … +1** | Above the dashed zero-line = net positive, below = net negative, near zero = mixed. The labelled **pins** mark the global **low** (rose) and **high** (emerald). |
| **Action volume** | How many actions happened each round. | counts | Round 0's giant follow-burst is broken **off-scale** (it's just the agents wiring up who-follows-whom, not debate), so the real rounds are legible. Tall = a loud round. |
| **Who's talking (divergence)** | The fraction of a round's actions made by **protagonists**. | **0 … 1** | **1.0 = a "night" round** (only the elites posted). Low = the crowd carried the round. |
| **Who won the argument (faction scoreboard)** | One row per stance **bloc**: a **bar** for how vocal it was (sized *relative to the loudest bloc* — the top bloc's bar is always full; hover for the exact share %), a **number** = its net sentiment = (pos − neg) ÷ that bloc's posts. | number **−1 … +1** | Longer bar = louder bloc (so the top row is the most-posting bloc, not necessarily 100% of posts). Green/+ number = the bloc was net positive; red/− = net negative; ~0 = divided. (e.g. a bloc that's loud but at −0.10 argued a lot but unhappily.) |
| **Topic engagement** | How many posts touched each of your question's sub-topics (keyword/stem matched, so near-synonyms count). | counts | Bigger = the conversation centered there. |

### 3c. Reply network — "who talked to whom"

A radial graph of the most-engaged agents.

| Element | Meaning |
|---|---|
| **A dot (node)** | An agent. **Size = engagement** (posts×3 + comments + likes-received×0.2). **Color = faction bloc.** A **ring** around it = a protagonist. |
| **A line (edge)** | A reply, directed: one person commented on another's post. **Thicker = more times that person replied to that author** (each direction is its own line, not merged into a single "between them" total). |
| **Clustering** | Same-faction figures are placed next to each other on the ring, so you can see the blocs and the lines crossing *between* them (cross-camp arguments). |
| **Hover** | Hovering a figure isolates them — lights up only their conversations and shows *"N posts, M replies, engagement X."* |

### 3d. The report & batch comparison

- **Report** — the full multi-section written analysis (generate it if it isn't there). Each section is flagged `ok` / `ungrounded` (couldn't cite specifics) / `failed`.
- **Batch comparison** — if you ran several variants (different random seeds), a table comparing their outcomes side by side, so you can see how stable the result is.

---

## 4. Talk — interviewing an agent

Pick a run and an agent (protagonists give the richest answers), then choose a mode:

| Mode | What it is | When available |
|---|---|---|
| **Persona chat** | The agent's persona is rebuilt from the run's records and answers your questions. **Reliable.** | Any run that has started (running, interviewable, finished, stopped). |
| **Live interview** | Asks the *live* worker agent, in character, using its whole run memory. Richer but can be slow/empty. | Only while the run's worker is still alive (a running / "interviewable" run). |

Your Q&A is saved per agent and survives switching away and back.

---

## 5. The numbers, at a glance

| Number you'll see | What it measures | Range | Quick read |
|---|---|---|---|
| Sentiment score | net mood of a round's posts | −1 … +1 | + good mood, − bad mood, 0 mixed |
| Confidence | analysis's certainty in the verdict | 0–100% | <34 low · 34 to <66 moderate · ≥66 high |
| Faction net sentiment | a bloc's mood | −1 … +1 | the bloc's happiness |
| Faction share | a bloc's slice of the talk | 0–100% | how loud the bloc was (the *bar* is drawn relative to the loudest bloc) |
| Protagonist share | elites' slice of a round | 0 … 1 | 1.0 = elite-only "night" round |
| Discourse lean | which stance bloc dominated a round | −1 … +1 | + = reopening-stance bloc louder · − = closure-stance bloc louder (tied to this run's stance labels, not a generic yes/no) |
| Engagement (network) | how active a figure was | relative | sizes the node; compare to others |
| ↑ / ↓ on a post | up- / down-votes | counts | popularity of that post |

---

## 6. How to read it all responsibly

1. **It's a discourse measurement, not a forecast.** "30% confidence in NO" = "the analysis is 30% sure the *conversation* leaned NO." It says nothing calibrated about the real event.
2. **Weight by volume.** A −0.9 mood from 4 night-round posts is far less meaningful than a −0.2 from 90 day-round posts. The night/day bands and the action-volume chart are there precisely so you don't over-trust thin moments.
3. **Factions are approximate.** Blocs are auto-labeled from agent stances and grouped for display; treat them as useful groupings, not precise categories. (A "pro-U.S." bloc can still be split internally — the scoreboard's net number shows that.)
4. **Run variants.** A single run is one roll of the dice. Run 2–3 seeds and use the **batch comparison** to see whether the verdict holds.
5. **Cheaper models → shallower agents.** Output quality (depth, staying in voice) scales with the model you bind to the protagonists; the *measurements* above are computed the same way regardless.

---
_This guide reflects the app as built. The **charts and numbers** are produced by deterministic, LLM-free computation. The **agents' posts**, the **written report**, and — when one has been generated — the **richer "How it unfolded" narrative** come from the model(s) you configure (the fallback story-beats, used when no narrative was generated, are deterministic)._
