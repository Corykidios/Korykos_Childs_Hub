# Architecture and design decisions

_2026-06-09_

How DuckDuckGoose is put together, and why. Most of the structural choices
were forced by two constraints: simulations have to stay affordable, and
results have to stay honest.

## The problem

Take a folder of documents and a question. Work out who the documents are
about, build a population of agents grounded in those people, let them argue
the question on a simulated social platform, and report what the resulting
discussion implies.

The engine underneath is [OASIS](https://github.com/camel-ai/oasis) from
CAMEL-AI, used unmodified. OASIS simulates the platform: feeds, posting,
voting, following, and the round loop. Everything upstream of that (deciding
who exists, what they believe, and which of them are worth spending a model
call on) and everything downstream (measuring what happened and explaining
it) is this project.

## The shape

```
┌────────────┐   HTTP    ┌──────────────────────────────┐
│  Vue       │ ────────► │ Flask supervisor             │
│  frontend  │  polling  │  api · run queue · projects  │
└────────────┘           │  task store (SQLite)         │
                         └──────┬───────────────────────┘
              spawn / kill      │   append-only JSONL event stream
              file-drop IPC     │   + heartbeat
                         ┌──────▼───────────────────────┐
                         │ simworker process (per run)  │
                         │  tier scheduler              │
                         │  brains: llm / policy        │
                         │  OASIS env(s) + sqlite       │
                         └──────────────────────────────┘
```

Each run is a separate detached process. The supervisor never imports OASIS
or CAMEL at all.

**Why a separate process rather than async tasks in the web app.** A
simulation is a long, memory-heavy job that loads model backends and an
embedding stack. Running that inside the Flask process means a crash in a
simulation takes down the UI, and a stuck run can only be cleared by
restarting everything. Process isolation makes "stop this run" a real
operation (kill the tree) and makes a crash survivable: the run is marked
failed with its last heartbeat and log tail, and every other run is
unaffected. The cost is that all communication has to be explicit, which is
the next decision.

**Why a file-based event stream rather than a queue or socket.** The worker
appends newline-delimited JSON events; the supervisor reads them. Control
messages go the other way as dropped files, using one protocol module
imported by both sides so the two halves cannot drift. This adds no
infrastructure, survives a supervisor restart mid-run, and leaves the entire
history of a run on disk as the ground truth that metrics, the story feed,
and the report are all computed from. When something looks wrong, the events
file is readable with a text editor. The tradeoff is polling latency, which
does not matter for rounds that take seconds to minutes.

Liveness is determined by heartbeat events plus a process check, never by the
contents of a status file, because a crashed worker leaves a status file
saying "running" forever.

## Agent tiering, which is the core idea

A useful simulation needs a crowd. A crowd of LLM agents is unaffordable:
cost scales with agents multiplied by rounds, and every agent reads a feed
that grows as the run goes on. So agents are split into three tiers.

| Tier | Brain | Purpose |
|---|---|---|
| protagonist | Full LLM, strongest model, always active | The named figures the corpus is actually about |
| crowd_llm | Full LLM, cheap model | Ordinary participants who react in their own words |
| crowd_policy | No LLM at all | The mass that creates volume and cascades |

The third tier is the one that makes scale possible. A **compiled policy** is
generated once at build time: the strong model reads the agent's persona, its
evidence, and the question, then emits structured JSON describing topic
stances, staged reaction rules, susceptibility weights, and a repertoire of
response templates with variation slots. At runtime a plain rule engine
evaluates that policy against what the agent has actually seen and emits an
action directly, with zero model calls.

The point is that the reasoning still happened, it just happened once per
agent instead of once per agent per round. Cost then scales with the number
of protagonists and the LLM crowd ratio, not with total population. A run
with 2,500 agents is not meaningfully more expensive than one with 300.

Policies are inspectable and editable per agent in the interface, which
matters because a policy that produces nonsense is a bug you want to see
rather than a mystery.

One engine detail worth recording: OASIS lets a single step mix
model-driven and manually specified actions, so all three tiers advance in
one `env.step()` call with no fork of the engine. Manual actions bypass the
engine's own action whitelist, so the policy runtime enforces that whitelist
itself.

## From documents to a population

**Extraction and resolution.** Documents are chunked with provenance
(`doc_id` plus chunk index, never a corpus-wide concatenation) and entities
are extracted per document. The hard part is that the same person appears as
"Vladimir Putin", "Putin", and "the Kremlin" across a corpus, and treating
those as three people ruins everything downstream.

Resolution runs in three stages: normalize names and merge declared aliases,
cluster mention contexts by embedding, then ask a model to adjudicate only
the genuinely borderline clusters. Stage two auto-merges only when one name
is a token subset of the other, so "Putin" folds into "Vladimir Putin" while
"Sarah Monroe" and "Sarah Connor" are pushed to adjudication rather than
silently merged. This gate was forced by test cases rather than chosen up
front, and it is stricter than a pure similarity threshold.

**Not everything that exists should get a mouth.** An early run ranked
entities purely by mention count, which made "Strait of Hormuz" the single
most influential entity in the corpus and therefore a protagonist. A
waterway cannot hold an opinion, and the resulting report had to infer its
answer from agent chatter instead of reading measurable state.

The fix was to give every ontology type a role. Some types spawn agents
(people, officials, analysts). Some are affiliations that people belong to
rather than actors in their own right (countries, agencies, corporations).
Some carry world state: the things a report should ground its verdict on
(places, markets, legislation, events). Ranking and spawning filter to
agent-bearing types first, with a minimum-mentions threshold so agents are
built from people the corpus actually says something about rather than
one-line walk-ons.

**Identity.** Every agent gets a permanent internal id. The positional row
ids that OASIS needs exist only at export time, so regenerating or
reordering a population can never silently re-identify an agent.

## Honesty constraints

These are design constraints, not polish, and several features were cut
because they failed them.

**The output is a discourse measurement, not a forecast.** The tool reports
what a simulated conversation concluded. It has no world model and no
calibration against real outcomes, so every number describes the
conversation. The interface repeats this wherever a number could be mistaken
for a prediction, and the verdict is labelled as discourse lean rather than
probability.

**A dynamic world state was designed and then deliberately not built.** The
next step after grounding a report on world-state variables is letting the
simulation move them: enough head-of-state agents post agreement, so the
agreement is signed, so the strait opens. It would look impressive. It would
also be an invented mapping with no ground truth behind it, producing a
clean forecast-shaped trajectory the tool cannot support. It stays unbuilt
until there is a defensible, calibrated mapping to implement.

**Measurements are computed without a model.** Sentiment, topic engagement,
tier divergence, and cascade metrics are deterministic and free. That keeps
the analysis identical whether the run used a frontier model or a small
local one, and it means the charts cannot flatter the result. Chart
annotations are computed facts rather than generated prose, for the same
reason.

**Failures are visible.** Persona and policy generation failures are
surfaced per item and are retryable rather than being quietly replaced with
a generic fallback, because a population secretly padded with filler agents
is worse than one that is honestly short. Report sections that could not
cite specifics are flagged as ungrounded rather than presented as findings.

## Cost and provider choices

Any OpenAI-compatible endpoint works, and five roles bind independently:
builder, embeddings, protagonist brain, crowd LLM brain, and report writer.
The split matters because the roles have genuinely different requirements:
protagonists benefit from a strong model, the crowd does not, and the report
writer is called a handful of times per run.

Embeddings get their own binding rather than being derived from the chat
endpoint. Deriving them means switching chat provider silently repoints the
embedder, which changes the vector space and quietly breaks recall against
everything already stored.

Costs are dominated by input rather than output, because every active agent
reads a feed that grows all run. The practical levers are the number of
protagonists, the crowd LLM ratio, and how many rounds run, in that order.

## What is deliberately out of scope

Organisation-structure modelling, live news ingestion, historical
backtesting, multi-user authentication, cloud deployment, encrypted secret
storage, and any non-OASIS platform. Documents are the only input, which is
also what makes the tool composable: anything that can write a folder of
Markdown can feed it.

## Testing approach

The build was test-first throughout. The parts worth testing are the ones
where being subtly wrong is invisible: entity resolution has golden cases
for both required merges and forbidden merges; the population builder is
checked for exact-N and for identity stability under regeneration; the
policy engine is checked for deterministic output given a policy, a feed,
and a seed, and for whitelist enforcement.

The end-to-end test runs the real OASIS environment with policy agents only,
so the whole pipeline is exercised with no model calls and no network.
