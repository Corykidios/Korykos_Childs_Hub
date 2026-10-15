# Making the charts explain themselves

_2026-06-16_

The results view draws correct lines from correct numbers and was still
misleading, because a chart that encodes shape without context invites the
wrong conclusion. This is what was wrong and what replaced it.

## The defect

The sentiment line showed a low of -0.375 at round 15 and a milder -0.10 at
round 19. Same chart, same axis, so the deeper dip reads as more significant.

It is not. Round 15 was a round where the time-of-day scheduler had the entire
crowd asleep, so that -0.375 rests on about 16 posts from the 22 protagonists.
Round 19 was the loudest round of the run, and its -0.10 rests on about 89
posts from a broad mix of agents.

The thin, unreliable point was drawn more dramatically than the thick, reliable
one. The chart encoded **shape** but not **regime**. Axis labelling does not fix
that, because the question being asked of the chart is how much to trust a given
point, and the chart had no way to answer it.

## Three moves

**Annotate.** State what happened in plain language, persistently, under the
chart rather than in a tooltip. A caption reading "the -0.37 low at round 15
fell on a night round, when only the 22 principals were posting" does more than
any axis treatment. These captions are computed deterministically from the
metrics, so they are always present, always accurate, and cost nothing.

**Contextualise.** Shade the rounds where only protagonists were active, on
every chart, so a point is always read inside its regime. Round 0 is a related
case: it contains a burst of over twelve thousand follow actions as the
population wires up its social graph, which compressed all 23 real rounds into
unreadable stubs. It is now broken off-scale and labelled, which keeps the
outlier visible without letting it destroy the axis.

**Connect.** A point on a line should be a door into the posts that produced it.
Charts, the faction scoreboard, the reply network, and the quotes all navigate
into the story feed at that round or that agent, so the abstraction and the
evidence stay linked.

## Replacing a chart that could not work

Faction sentiment over time was originally six lines on one axis. With around
300 free-text faction labels folded into six blocs, and several blocs falling
quiet in any given round, the lines crossed constantly and supported no
conclusion.

A scoreboard replaced it: one row per bloc, a bar for how vocal it was, a number
for its net sentiment, and a plain-language read. The conclusion that was
invisible in the line chart, that the pro-U.S. bloc is the only net-positive one
at +0.35 and is internally split, is the first thing the scoreboard shows.

Where a time series was the right form, the underlying data was fixed rather
than drawn around. Per-round, per-faction sentiment did not exist in the
metrics, so it was accumulated at zero extra cost inside the loop that was
already classifying sentiment. Rounds below a minimum action count render as
gaps rather than as points, because a bloc that posted twice should not produce
a dramatic line.

## What was cut

Three ideas were dropped for failing the honesty bar:

- Coloured "calm" and "alarmed" zones behind the sentiment axis, which
  editorialise on a lexicon score that does not support the claim.
- Confidence-weighted stroke width, redundant with the regime bands and harder
  to read.
- A generated narrative as the primary story. The deterministic version is
  factual and free, so generated prose is an optional enhancement that the view
  degrades gracefully without.

The verdict needle is labelled "discourse lean" and never as a probability.
Quotes are real posts attributed to real names rather than internal identifiers.

## Why this generalises

The instinct when a chart is unconvincing is to make it prettier. This chart was
correct and unconvincing because it omitted how much evidence sat behind each
point. Supplying that made a plain chart trustworthy, and it also exposed that
one of the charts should not have been a line chart at all.
