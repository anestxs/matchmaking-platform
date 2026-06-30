# Matchmaking Platform — Logic & Requirements

Domain and business-logic requirements for the platform. This document captures
*what the system must do* (rules, entities, flows). For *how it's built* (stack,
infrastructure), see [README.md](./README.md).

---

## 1. Core Concepts (Glossary)

The model distinguishes three "group" concepts that must not be conflated:

- **Party** — the group that queues together (1–N players, pre-formed by
  friends). Ephemeral: exists before and during queue time.
- **MatchTeam** — a full side in a match (size = mode), assembled by matchmaking
  from one or more parties. Created when a match is found.
- **TournamentEntry** — a competitor slot in a tournament bracket (size = mode).
  Lives for the duration of the tournament.

There is no persistent "team / clan" entity — all groups are assembled per-match
or per-tournament.

---

## 2. Game Modes

- Supported modes: **1v1, 2v2, 3v3, 4v4, 5v5**.
- The mode determines the **per-side team size** N (1 through 5).
- Modeled as a fixed enum (`Mode`), not a database table. Team size is derived
  from the mode.

---

## 3. Matchmaking Logic

### 3.1 Queueing & party fill
- A player queues either solo or as a pre-formed **party** of up to N players,
  for a **selected mode**.
- If a party is smaller than the mode's team size, the system **automatically
  fills the team** with other waiting parties/players until a full MatchTeam of
  size N is formed.
- Fill is by combining parties whose sizes sum to N. Examples for 5v5:
  - quad + solo
  - trio + duo
  - trio + solo + solo
  - duo + duo + solo
  - duo + solo + solo + solo
  - 5 × solo
- The matchmaker forms **two** MatchTeams of size N (one per side) per match.

### 3.2 Balancing
- Teams are balanced by **MMR** (see §4). Matchmaking compares ratings to form
  fair sides, accounting for each player's skill *and uncertainty* (not naive
  average MMR). With the OpenSkill rating model, balance uses the conservative
  per-player estimate `mu − 3·sigma`.
- Optimal server/region selection by ping is a goal (data sourced from clients).

### 3.3 Captain
- Each MatchTeam has a **captain**, selected **automatically as the player with
  the highest MMR** on that team.
- The captain is a **snapshot** taken at team-assembly time (stored, not
  recomputed later, since MMR changes after the match).

### 3.4 Queue state location
- The **live queue pool** (parties currently searching) is held in **Redis** —
  hot, ephemeral, real-time state (e.g. sorted sets keyed by MMR, partitioned by
  region + mode). It is **not** a relational table.
- Only **durable results** (matches, teams, participants) are persisted to
  PostgreSQL once a match is found.

### 3.5 Correctness rules
- **No double-booking**: a player can never be claimed into two matches at once.
- **Idempotent match creation**: match-found handling must dedupe so retries
  cannot create duplicate matches.

---

## 4. Rating / MMR

- MMR is tracked **per user, per mode** — a user can have a distinct rating for
  each of 1v1…5v5.
- Rating uses the **OpenSkill** model (Weng-Lin Bayesian, team-aware). Each
  rating is **two values** — `mu` (estimated skill) and `sigma` (uncertainty).
  The **displayed MMR** is the conservative estimate `mu − 3·sigma`.
- Each rating record also tracks games played and wins/losses.
- A participant's rating is **snapshotted** before/after each match
  (`muBefore`/`sigmaBefore`, `muAfter`/`sigmaAfter`) for rating-change display
  and history.
- Rating computation is isolated behind a small **strategy interface**
  (`computeNewRatings(match) → ratings`) so the algorithm can be swapped without
  touching the rest of the app.

---

## 5. Matches

- A **Match** has: mode, status (pending / live / completed / cancelled),
  timestamps, and a winning side.
- A Match has two **MatchTeams** (sides A and B), each with a captain and an
  average MMR.
- Each MatchTeam contains **MatchParticipants** linking users to the side,
  optionally recording the **party they came from** and their MMR snapshot.

---

## 6. Tournaments

All modes are available for tournaments.

### 6.1 Creation
- **Any user** can create a tournament, choosing its **mode**.
- Format: **single-elimination** bracket. `format` is modeled as an enum so
  other formats (double-elimination, round-robin, swiss) can be added later
  without a rewrite.

### 6.2 Populating entries
A **TournamentEntry** (a competitor = team of the mode's size) can be formed
three ways:
1. **Invite** — the creator/participants invite users by **nickname + tag**
   (e.g. `zahar#1234`). Invited users join only after accepting (see §10).
2. **Random** — an empty bracket slot can be filled with a randomly found
   player via a dedicated button in the bracket.
3. **Queue** — any user can start a queue to **find a tournament** for a
   specifically selected mode and be placed into one.

### 6.3 Bracket
- The bracket is a tree of **TournamentMatch** nodes (round, slot, the two
  competing entries, the winner, and an **advancement pointer** to the next
  node).
- A TournamentMatch is **distinct** from a regular Match; it links to the actual
  game played via a `matchId`. Bracket structure stays separate from normal
  matchmaking.

---

## 7. Identity

- Users authenticate via **Discord OAuth2**.
- A user is identified by **nickname + tag** (`zahar#1234`); the
  `(nickname, tag)` pair is unique.
- Sessions and refresh-token rotation are handled via Redis (see README).

---

## 8. Friends & Social

- A user can send a **friend request** to another user. The request stays
  **pending** until the recipient accepts or declines it (see §10); only
  accepted requests become friendships.
- Friendship is **mutual**. Friends can be invited to parties and tournaments,
  and can message each other directly (see §9).
- Removing a friend ends the friendship for both sides.

---

## 9. Chat

- Friends can exchange **direct (1:1) messages**.
- A user can create a **group chat** with multiple members; a group has a name
  and an owner.
- A **Conversation** is either direct or group; **ConversationMembers** are its
  participants; **Messages** belong to a conversation and record sender, body,
  and time.
- Messages are stored in **PostgreSQL**. Real-time delivery is handled by the
  realtime layer (Socket.io); see README.

---

## 10. Invitations

- **No invitation is an immediate join.** Party invitations, tournament
  invitations, and friend requests all follow the same flow: the target user
  receives a **pending** invitation they can **accept** or **decline**.
- A pending invitation surfaces to the invitee as a notification/popup.
  **Accepting** performs the join (adds them to the party, the tournament entry,
  or the friend list); **declining** dismisses it.
- Every invitation carries a **status**: pending, accepted, or declined.

---

## 11. Data Model (entity summary)

Grouped by domain. Field lists are indicative.

**Identity**
- `User` — discordId (unique), nickname, tag, displayName, avatarUrl; unique(nickname, tag)
- `UserRating` — userId, mode, mu, sigma, gamesPlayed, wins; unique(userId, mode) — displayed MMR = mu − 3·sigma

**Social & Chat**
- `Friendship` — requesterId→User, addresseeId→User, status; unique(requesterId, addresseeId)
- `Conversation` — type (DIRECT | GROUP), name? (groups), ownerId?→User
- `ConversationMember` — conversationId→Conversation, userId→User; unique(conversationId, userId)
- `Message` — conversationId→Conversation, senderId→User, body, createdAt

**Invitations** (one table per domain, sharing a common status)
- `PartyInvite` — partyId→Party, inviterId→User, inviteeId→User, status
- `TournamentInvite` — tournamentId→Tournament, inviterId→User, inviteeId→User, status

**Matchmaking**
- `Party` — mode, leaderId→User
- `PartyMember` — partyId, userId; unique(partyId, userId)
- `Match` — mode, status, winnerTeamId?, timestamps
- `MatchTeam` — matchId, side, captainId→User, avgMmr
- `MatchParticipant` — matchTeamId, userId, originPartyId?, muBefore, sigmaBefore, muAfter?, sigmaAfter?
- *(live queue pool = Redis, not a table)*

**Tournaments**
- `Tournament` — name, mode, creatorId→User, status, format, maxEntries, startAt
- `TournamentEntry` — tournamentId, source (INVITE | RANDOM | QUEUE)
- `TournamentEntryMember` — entryId, userId
- `TournamentMatch` — tournamentId, round, slot, entryA?, entryB?, winnerEntryId?, nextMatchId?, matchId?

**Enums**: `Mode`, `MatchStatus`, `TournamentStatus`, `TournamentFormat`,
`EntrySource`, `FriendshipStatus`, `InviteStatus`, `ConversationType`

---

## 12. Design Decisions

- Groups are assembled per-match and per-tournament; there is no persistent
  team/clan entity.
- Party state is stored in PostgreSQL; the live matchmaking queue is held in
  Redis.
- Tournaments use a single-elimination format, modeled as an enum so additional
  formats can be added later.
- Ratings use the OpenSkill model (`mu`/`sigma`); the displayed MMR is
  `mu − 3·sigma`, and rating computation is isolated behind a swappable
  interface.
- Friend requests, party invitations, and tournament invitations all use one
  accept/decline flow; an invitee is never auto-added.
- Party and tournament invitations are modeled as separate per-domain tables
  (`PartyInvite`, `TournamentInvite`) sharing a common status; friend requests
  are represented by the pending status of a `Friendship` row. A user's
  pending-invitation feed is assembled by querying across these.
- Chat messages are stored in PostgreSQL; real-time delivery is handled by the
  realtime layer.
