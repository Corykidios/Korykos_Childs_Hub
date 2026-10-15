# Preparing a corpus

The corpus is the single biggest lever on output quality. Everything the
simulation knows comes from it: who exists, what they believe, who they are
connected to, and what the report can cite. What follows is what the ingestion
pipeline does with your documents, and what that implies for feeding it well.

## What gets read

Every `.md`, `.markdown`, and `.txt` file under the folder you register,
recursively. Folder structure is flattened, so directory names are for your
benefit rather than the tool's.

Two consequences follow:

- **Any notes, trackers, or scratch files in those formats become corpus.**
  Keep meta files as `.json`, or outside the folder.
- **Documents are content-addressed.** The id is a hash of the content, so
  re-scanning is idempotent and safe to repeat. Editing a document mints a new
  id while the old version remains, which double-counts its entities. Prefer
  adding new documents over editing existing ones.

Each document is titled from its first `# heading`, falling back to the
filename.

## What makes a corpus work

**Entity density.** Entities become agents, and an entity mentioned richly
across four documents produces a far better agent than one mentioned once in
passing. Personas are generated from the merged evidence of every mention, so
thin entities produce thin agents.

**Cross-mention.** The social graph is built from entities co-occurring and
from extracted relationships. Documents that each stay inside their own
storyline produce a disconnected graph and a simulation where nobody has
anyone to argue with. Documents that name people from other storylines build
the connections.

**Genuine disagreement.** The simulation's stance diversity comes from the
corpus. If every document takes the same position, the agents will too, and
the result is a chorus. Include material that argues the other side in
substance rather than as a token counterpoint.

**Ordinary voices.** The crowd tier is seeded from corpus themes. Material
that captures how non-principals talk about the subject makes a much better
crowd than a corpus made entirely of official statements.

**Numbers with dates and units.** The report grounds its verdict on
world-state entities such as prices, levels, and statuses. A corpus with no
measurable quantities leaves the report inferring everything from chatter.

**The first documents matter more than the rest.** The ontology is designed
from a sample of the earliest documents in path-sorted order. Putting framing
and context documents in a folder that sorts first, such as `00-context/`,
gives the ontology generator the best possible view of what kinds of entity
exist in your material.

## The one sharp rule about wikilinks

Obsidian-style `[[wikilinks]]` are read as alias declarations, and an alias
maps its text to **the title of the document it appears in**.

This makes them powerful in one place and harmful everywhere else:

- In a document titled `# Vladimir Putin`, the links `[[Putin]]` and
  `[[the Kremlin's leader]]` correctly declare aliases for that person, and
  those aliases merge unconditionally during resolution.
- In an article titled `# Brent Spikes Past $90`, a `[[Putin]]` link declares
  "Putin" as an alias of *the article*, which actively corrupts deduplication.

So: use wikilinks only in per-entity profile documents, only for aliases of
that document's own subject, and never let two profiles claim the same alias.
Write every other name as plain text. Plain text is not a downgrade, since
resolution handles ordinary name variation on its own.

Related: use an entity's full canonical name on first mention in each
document, then natural shorter forms. Resolution auto-merges a shorter name
into a longer one when the shorter is a token subset, so "Putin" folds into
"Vladimir Putin" reliably, while genuinely distinct similar names are pushed
to model adjudication instead of being merged silently.

## A structure that works

This is one arrangement that has produced good results. Nothing enforces it.

| Folder | Purpose |
|---|---|
| `00-context/` | The frame: background on the question, primers, timeline to date. Sorts first, so it shapes the ontology. |
| `dossiers/` | One document per significant entity, titled with its canonical name. The only place wikilinks belong. |
| `news/` | Dated reports. Each naming several entities in plain text, including some from other storylines. |
| `analysis/` | Opinion and argument, where positions genuinely conflict. |
| `street/` | Ordinary people reacting. Seeds the crowd. |
| `data/` | Indicators with dates and units. What the report grounds on. |

Documents of roughly 300 to 1,200 words work well. Much shorter gives
resolution too little context to work with; much longer gets chunked in ways
that can separate a claim from its subject.

## Where documents come from

**Your own material.** Any folder of Markdown or text. Research notes,
meeting records, reports, an exported archive.

**An Obsidian vault.** Register the folder directly. The wikilink rule above
applies, and a vault whose links are ordinary topic links rather than alias
declarations will need care.

**[Crucible](https://github.com/kandivault-source/crucible).** A companion
tool that researches a topic autonomously and files the results as an
Obsidian-compatible Markdown vault, which is the exact input shape this tool
takes. The two were designed to compose this way, though see the note in the
README: the end-to-end pairing has not yet been verified in practice.

**Synthetic.** A corpus can be written for a question that has no ready
document set, which is how the tool was first exercised. It is the most work
and it carries an obvious caveat: a simulation seeded from generated
documents tells you what a discussion of those documents implies, and their
quality bounds everything downstream. Generated corpora need the same
discipline as real ones, in particular the wikilink rule and cross-mention
between storylines.

## Growing a corpus later

Adding documents under the same ontology is cheap, since previously extracted
documents are reused.

Changing the ontology is not: every document has to be re-extracted, because
the old ones were typed under the previous ontology. That is correct rather
than wasteful, but it is worth knowing before adding a type on a large
corpus. Resolution re-runs globally either way, since new entities have to be
deduplicated against the existing cast.
