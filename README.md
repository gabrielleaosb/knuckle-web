# Knucklebones

A faithful web recreation of the Knucklebones minigame from **Cult of the Lamb** — playable in your browser, no download required.

**Live:** [kbones.xyz](https://kbones.xyz)

## Game Modes

| Mode | Status |
|------|--------|
| Singleplayer vs Bot (Easy / Medium / Hard) | ✅ Live |
| Multiplayer 1v1 (P2P) | ✅ Live |
| King of the Table (Tournament) | ✅ Live |
| 2v2 Co-op | 🔜 Planned |

## How to Play

Roll a die and place it in one of your three columns. Matching dice in the same column multiply each other's score — three 6s in a column score 108 points. If you place a die in a column where your opponent has the same value, their matching dice are destroyed. Fill your board first to end the round.

## Roadmap

### Short Term
- [ ] **Improved Hard Bot** — deeper minimax (3–4 ply) with alpha-beta pruning and stronger heuristics (column urgency, opponent slot awareness, endgame pressure)
- [ ] **2v2 mode** — co-op pairs, each player controls one half of a shared board
- [ ] **Mobile polish** — better touch targets, landscape layout for small screens

### Mid Term
- [ ] **Public Matchmaking Lobbies** — queue for a 1v1 game without sharing a room code; connection stays P2P (WebRTC) with a lightweight signaling layer for pairing
- [ ] **Sound & Music** — dice roll SFX, ambient background track, mute toggle
- [ ] **Animations** — dice-place, column-clear, and score-pop animations to make moves feel impactful
- [ ] **Custom Dice Skins** — unlockable cosmetic dice (runic, bone, gem, etc.)
- [ ] **Bot Personality Modes** — Aggressive (prioritizes cancels), Defensive (avoids being canceled), Balanced

### Long Term
- [ ] **Ranked & ELO** — persistent player accounts with rating and match history
- [ ] **Spectator Mode** — watch live games without participating
- [ ] **Tournament Brackets** — structured King of the Table with bracket draws and scheduled rounds
- [ ] **Replay System** — share and review past games move by move
- [ ] **Accessibility** — keyboard-only play, high-contrast mode, screen reader labels

## Tech Stack

Vanilla HTML, CSS, and JavaScript — no frameworks or build step. Deployed on [Vercel](https://vercel.com).

## Bot AI

The bot (`knucklebones-bot.js`) is fully isolated from game state and works across all game modes:

- **Easy** — picks a random available column
- **Medium** — greedy heuristic weighing score gain, cancel value, and triple-multiplier building
- **Hard** — 2-ply minimax with expected-value averaging over all possible die rolls
