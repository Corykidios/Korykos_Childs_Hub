# Chaos Duck 🦆

**Every decision deserves at least one unnecessary adventure.**

Chaos Duck is an open-source, model-agnostic AI personality that turns ordinary conversations into tiny, cozy RPG moments before helping users make real decisions.

## Vision
Chaos Duck blends five vibes:
- 🦆 Magical duck
- 🧙 Mildly confused wizard
- 🎲 Friendly game master
- 📦 Traveling merchant
- 🌿 Forest NPC

The result: wholesome nonsense, dramatic micro-quests, and practical outcomes.

## Compatibility Matrix
| Platform | Status | Notes |
|---|---|---|
| Claude | ✅ | Use `prompts/claude.md` |
| ChatGPT | ✅ | Use `prompts/chatgpt.md` |
| Gemini | ✅ | Use `prompts/gemini.md` |
| Cursor | ✅ | Use `prompts/system-prompt.md` |
| Codex | ✅ | Use `prompts/system-prompt.md` |
| Roo Code | ✅ | Use `prompts/system-prompt.md` |
| Cline | ✅ | Use `prompts/system-prompt.md` |
| Any LLM Agent | ✅ | Model/provider agnostic prompt design |

## Installation
1. Clone this repository
2. Pick the prompt file for your tool
3. Paste prompt content into your system/developer instruction area
4. Optionally load content libraries for richer behavior

```bash
git clone https://github.com/BreezeButter/chaos-duck.git
cd chaos-duck
```

## Usage
1. Start with `prompts/system-prompt.md`
2. Add model-specific variants as needed
3. Feed the content libraries (events, inventory, achievements, encounters)
4. Ask normal questions and let the duck begin a tiny quest first

## Example notification-style output
```text
🚨 NEW QUEST
🌐 The Digital Thing
Objective: Figure out what we're building.

Choose your champion:
💻 Open 47 tabs and call it research
🧃 Hydrate first and pretend it's architecture
📦 Ask the merchant for a suspicious framework
```

## Screenshots / Examples
See `/examples/conversations.md` for sample interactions, including:
- thirsty user flow
- coding decision flow
- study planning flow
- shopping flow

## Repository Structure
```
chaos-duck/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── prompts/
├── lore/
├── inventory/
├── achievements/
├── events/
├── encounters/
├── examples/
└── skills/
```

## Contribution Guide
Please read `CONTRIBUTING.md`. Keep all additions:
- wholesome
- emoji-forward
- silly but helpful
- never rude or sarcastic

## Final Goal
A cozy RPG where a magical duck helps humans make decisions through delightful nonsense.
