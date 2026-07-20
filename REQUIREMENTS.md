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

- A **Match** has: mode, status (pending / ongoing / completed / cancelled),
  timestamps, and a winning team.
- A Match has two **MatchTeams**, each with a captain and an average MMR.
- Each MatchTeam contains **MatchTeamMembers** linking users to the side,
  optionally recording the **party they came from** and their MMR snapshot.

---

## 6. Tournaments

All modes are available for tournaments.

### 6.1 Creation
- **Any user** can create a tournament, choosing its **mode**.
- On creation the tournament is assigned a unique **8-digit join code**
  (`entryCode`) used for open joining (see §6.2).
- Format: **single-elimination** bracket. `format` is modeled as an enum so
  other formats (double-elimination, round-robin, swiss) can be added later
  without a rewrite.

### 6.2 Populating entries
A **TournamentEntry** (a competitor = team of the mode's size) can be formed
two ways:
1. **Invitation** — the creator invites users, either from their **friends** or
   by **nickname + tag** (e.g. `zahar#1234`). Both paths are only different ways
   to pick a user; each produces the same pending invitation, and the invitee
   joins only after accepting (see §10).
2. **Code** — anyone who has the tournament's **8-digit join code** (`entryCode`)
   can join directly. This is an immediate self-join, **not** a pending
   invitation.

### 6.3 Bracket
- The bracket is a tree of **TournamentMatch** nodes (round, slot, the two
  competing entries, the winner, and an **advancement pointer** to the next
  node).
- A TournamentMatch is **distinct** from a regular Match; it links to the actual
  game played via a `matchId`. Bracket structure stays separate from normal
  matchmaking.

---

## 7. Identity & Authentication

- A user is identified by **nickname + tag** (`zahar#1234`); the
  `(nickname, tag)` pair is unique. The **tag is chosen by the user**, not
  auto-generated.
- Authentication supports **multiple methods**, none of which is a mandatory
  "primary":
  - **Password** — the login identifier is either the **email** or the
    **`nickname#tag`** pair.
  - **Discord SSO** (OAuth2).
- A user may register with any single method and **link the others later** in
  settings (add a password/email if they signed up with Discord, or link
  Discord if they signed up with a password).
- Auth methods are modeled apart from the core identity: a password
  (`passwordHash`) lives on the user, while each SSO link is a separate
  **OAuthAccount** row (provider + provider account id), so additional providers
  can be added without reshaping the user.
- **Email is optional** — even for password users, since `nickname#tag` can be
  the login identifier — and is unique when present. It is **normalized
  (lowercased) before storage** so uniqueness is meaningful.
- **Invariant**: a user must always retain at least one working login method —
  a password, or at least one linked OAuth account.
- **Account-linking safety**: an SSO login is **never auto-merged** into an
  existing account by matching email; linking happens only while already
  authenticated (or through a verified-email flow).
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
- A user can create a **group chat** with multiple members; a group has a name,
  an **owner**, and any number of **admins**.
- Each **ConversationMember** has a **role** (member or admin) — admins are
  members with elevated rights. The owner is tracked on the conversation itself.
- If the owner leaves or is deleted, ownership transfers to the
  **longest-tenured admin**; if there are no admins, the conversation is left
  ownerless. This transfer is **application logic**, not a database action.
- A **Conversation** is either direct or group; **ConversationMembers** are its
  participants; **ConversationMessages** belong to a conversation and record
  sender, body, and time.
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

**Identity & Auth**
- `User` — nickname, tag, displayName, avatarUrl, email? (unique), passwordHash?, emailVerifiedAt?; unique(nickname, tag)
- `OAuthAccount` — userId→User (Cascade), provider (DISCORD), providerAccountId; unique(provider, providerAccountId), unique(userId, provider)
- `UserRating` — userId, mode, mu, sigma, gamesPlayed, wins; unique(userId, mode) — displayed MMR = mu − 3·sigma

**Social & Chat**
- `Friendship` — requesterId→User, addresseeId→User, status; unique(requesterId, addresseeId)
- `Conversation` — type (DIRECT | GROUP), name? (groups), ownerId?→User (SetNull)
- `ConversationMember` — conversationId→Conversation, userId→User, role (MEMBER | ADMIN); unique(conversationId, userId)
- `ConversationMessage` — conversationId→Conversation, senderId?→User (SetNull), body, createdAt

**Invitations** (one table per domain, sharing a common status)
- `PartyInvitation` — partyId→Party, inviterId→User, inviteeId→User, status
- `TournamentInvitation` — tournamentId→Tournament, inviterId→User, inviteeId→User, status

**Matchmaking**
- `Party` — mode, leaderId→User
- `PartyMember` — partyId, userId; unique(partyId, userId)
- `Match` — mode, status, winnerTeamId?, timestamps
- `MatchTeam` — matchId, captainId→User, avgMmr
- `MatchTeamMember` — matchTeamId, userId, originPartyId?, muBefore, sigmaBefore, muAfter?, sigmaAfter?
- *(live queue pool = Redis, not a table)*

**Tournaments**
- `Tournament` — name, mode, creatorId?→User (SetNull), status, format, maxEntries, startAt, entryCode (unique, 8-digit)
- `TournamentEntry` — tournamentId, source (INVITATION | CODE)
- `TournamentEntryMember` — entryId, userId
- `TournamentMatch` — tournamentId, round, slot, entryA?, entryB?, winnerEntryId?, nextMatchId?, matchId?

**Enums**: `Mode`, `AuthProvider`, `MatchStatus`, `TournamentStatus`,
`TournamentFormat`, `EntrySource`, `FriendshipStatus`, `InvitationStatus`,
`ConversationType`, `ConversationRole`

---

## 12. Design Decisions

- Authentication is multi-method (password via email or `nickname#tag`, plus
  Discord SSO); no method is a mandatory primary, and users can link additional
  methods later. The password lives on the user; SSO links are separate
  `OAuthAccount` rows so new providers can be added without schema changes. A
  user must always keep at least one login method, and an SSO login is never
  auto-linked to an existing account by email.
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
- Tournament entries are populated only by creator invitations (chosen from
  friends or by nickname + tag) and by an 8-digit join code; there is no random
  fill and no matchmaking queue for tournaments.
- A group conversation has one owner and any number of admins (member role); if
  the owner leaves, ownership passes to the longest-tenured admin, otherwise the
  conversation becomes ownerless — handled in application logic, not a DB action.
- Party and tournament invitations are modeled as separate per-domain tables
  (`PartyInvitation`, `TournamentInvitation`) sharing a common status; friend requests
  are represented by the pending status of a `Friendship` row. A user's
  pending-invitation feed is assembled by querying across these.
- Chat messages are stored in PostgreSQL; real-time delivery is handled by the
  realtime layer.
