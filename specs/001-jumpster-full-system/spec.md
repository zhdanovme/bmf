# Feature Specification: Jumpster Full System

**Feature Branch**: `001-jumpster-full-system`
**Created**: 2026-01-15
**Status**: Draft
**Input**: BMF behavioral model from `bmfs/links/jumpster/*`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete First Training Session (Priority: P1)

New user opens the app, completes onboarding, and finishes their first exercise session to earn rewards.

**Why this priority**: Core value proposition — users must experience the exercise-reward loop immediately to understand and engage with the product.

**Independent Test**: User can complete a full training session, see rewards earned (XP, Coins), and track energy consumption.

**Acceptance Scenarios**:

1. **Given** new user opens app, **When** they follow onboarding prompts, **Then** they see welcome screen, camera permission request, and first exercise selection
2. **Given** user starts exercise, **When** camera detects movements, **Then** action counter increases in real-time
3. **Given** user performs actions, **When** energy depletes, **Then** XP and Coins are earned proportionally
4. **Given** user finishes session, **When** results screen displays, **Then** they see total actions, XP earned, Coins earned, and daily progress

---

### User Story 2 - Earn Aura Through Daily Consistency (Priority: P1)

User completes 200% of daily energy expenditure to earn Aura points and unlock streak bonuses.

**Why this priority**: Aura is the core retention mechanic — creates daily habit and provides tangible progression benefits.

**Independent Test**: User spends 200% energy in a day and receives Aura point with visible bonus multipliers.

**Acceptance Scenarios**:

1. **Given** user starts day with 100% energy, **When** they train until energy reaches 0%, **Then** daily progress shows 100%
2. **Given** energy regenerates or user buys bottle, **When** they continue training to 0% again, **Then** daily progress reaches 200%
3. **Given** user reaches 200% daily progress, **When** Aura is awarded, **Then** current Aura count increases by 1
4. **Given** user has Aura streak, **When** they check bonuses, **Then** they see increased XP multiplier, Coins multiplier, faster energy regen, and higher max energy

---

### User Story 3 - Participate in P2P Battle (Priority: P2)

User joins or creates a competitive pool, stakes currency, and competes against others in real-time exercise competition.

**Why this priority**: P2P creates social engagement and monetization through stakes. Secondary to core training loop.

**Independent Test**: Two users can join same pool, compete simultaneously, and see results with prize distribution.

**Acceptance Scenarios**:

1. **Given** user has sufficient balance, **When** they create pool with stake amount, **Then** pool appears in public list (if open) or generates invite link (if private)
2. **Given** pool reaches participant quota, **When** preparation countdown completes, **Then** all participants enter competition view simultaneously
3. **Given** competition is active, **When** participants perform actions, **Then** leaderboard updates in real-time showing action counts
4. **Given** competition timer ends, **When** winner is determined, **Then** prize pool distributes minus platform fee (10%)
5. **Given** competition ends in tie, **When** scores are equal, **Then** tie-breaker round initiates automatically

---

### User Story 4 - Purchase and Use Items from Market (Priority: P2)

User browses market, purchases items with earned Coins or Platinum, and activates boosts for enhanced rewards.

**Why this priority**: Economy system supports both engagement (spending earnings) and monetization (premium purchases).

**Independent Test**: User can purchase Energy Bottle, use it, and see energy restored immediately.

**Acceptance Scenarios**:

1. **Given** user opens market, **When** items load, **Then** they see available items with prices in Coins or Platinum
2. **Given** user has sufficient Coins, **When** they purchase Energy Bottle, **Then** item appears in inventory and balance decreases
3. **Given** user has Energy Bottle in inventory, **When** they use it, **Then** energy restores to maximum and item is consumed
4. **Given** user purchases XP or Coins booster, **When** activated, **Then** rewards from training sessions increase for duration

---

### User Story 5 - Complete Daily Quests (Priority: P2)

User views available quests, completes objectives through gameplay, and claims rewards.

**Why this priority**: Quests provide guided objectives and additional reward opportunities, enhancing engagement.

**Independent Test**: User completes "Full Energy Session" quest and receives reward.

**Acceptance Scenarios**:

1. **Given** new day begins, **When** user checks quests, **Then** daily quests list refreshes with new objectives
2. **Given** user has incomplete quest, **When** objective is met through gameplay, **Then** quest shows as claimable
3. **Given** quest is claimable, **When** user claims reward, **Then** they receive Coins, XP, or Spins as specified
4. **Given** user has referral quest, **When** friends join via referral link, **Then** progress updates toward milestone

---

### User Story 6 - Spin Roulette for Prizes (Priority: P3)

User uses earned or purchased Spins to play roulette and win random prizes.

**Why this priority**: Adds excitement and random reward element, but not core to value proposition.

**Independent Test**: User with Spin balance can spin wheel and receive one of the possible prizes.

**Acceptance Scenarios**:

1. **Given** user has Spin(s) available, **When** they access roulette, **Then** they see wheel with possible prizes
2. **Given** user initiates spin, **When** wheel animation completes, **Then** random prize is selected and awarded
3. **Given** user has no Spins, **When** they try to spin, **Then** they're offered to purchase Spins with Platinum

---

### User Story 7 - Connect TON Wallet and Earn Crypto (Priority: P3)

User connects external TON wallet to unlock cryptocurrency rewards for milestone achievements.

**Why this priority**: Adds real-money incentive but requires blockchain integration complexity.

**Independent Test**: User can connect wallet, reach Aura milestone (10, 50, or 100), and see TON credited.

**Acceptance Scenarios**:

1. **Given** user without connected wallet, **When** they initiate connection, **Then** TonConnect flow opens
2. **Given** wallet connection succeeds, **When** confirmed, **Then** wallet address appears in profile
3. **Given** user with wallet reaches Aura milestone, **When** milestone completes, **Then** TON reward is credited to balance
4. **Given** user has TON balance, **When** they request withdrawal, **Then** funds transfer to connected wallet

---

### User Story 8 - Subscribe to Influencer and Equip Skin (Priority: P3)

User subscribes to an influencer to unlock character skins and join their dedicated leaderboard.

**Why this priority**: Social/creator integration for growth, but not essential for core experience.

**Independent Test**: User can subscribe to influencer, unlock skin, and appear on influencer's leaderboard.

**Acceptance Scenarios**:

1. **Given** user browses influencers, **When** they select one, **Then** they see influencer profile with available skins
2. **Given** user subscribes to influencer, **When** subscription activates, **Then** skins unlock and user joins influencer leaderboard
3. **Given** user has unlocked skin, **When** they equip it, **Then** character appearance changes on dashboard

---

### Edge Cases

- What happens when user loses camera tracking during training? Session pauses with prompt to re-enter frame
- What happens when P2P pool creator leaves before start? Pool is cancelled, all stakes refunded
- What happens when network disconnects during competition? Actions sync when connection restores
- What happens when user misses a day of training? Aura streak resets to 0
- What happens when withdrawal fails? Transaction shows error, TON remains in app balance

## Requirements *(mandatory)*

### Functional Requirements

**Onboarding**
- **FR-001**: System MUST guide new users through welcome, camera permission, first training, and Aura explanation
- **FR-002**: System MUST allow users to skip camera permission and wallet connection during onboarding
- **FR-003**: System MUST mark user as FTUE-completed after onboarding to prevent re-triggering

**Training Core**
- **FR-010**: System MUST detect user movements via camera and count valid exercise repetitions
- **FR-011**: System MUST require calibration (user in frame) before counting begins
- **FR-012**: System MUST award XP and Coins for each valid action during training
- **FR-013**: System MUST consume energy during training (configurable per exercise type)
- **FR-014**: System MUST allow training in "XP only" mode when energy is insufficient
- **FR-015**: System MUST support pause, resume, and cancel during active session
- **FR-016**: System MUST display session results (duration, actions, XP, Coins, energy spent)

**Energy System**
- **FR-020**: System MUST track current and maximum energy per user
- **FR-021**: System MUST regenerate energy automatically over time (configurable rate)
- **FR-022**: System MUST allow energy restoration via consumable items
- **FR-023**: Aura bonuses MUST increase regeneration rate and maximum energy cap

**Aura System**
- **FR-030**: System MUST track daily energy expenditure as percentage of maximum
- **FR-031**: System MUST award 1 Aura when user reaches 200% daily energy spent
- **FR-032**: System MUST reset daily progress at 06:00 in user's timezone
- **FR-033**: System MUST reset Aura streak to 0 if user misses a day
- **FR-034**: System MUST apply Aura-based multipliers to XP and Coins rewards
- **FR-035**: System MUST award TON at Aura milestones (10, 50, 100) for wallet-connected users

**Currency System**
- **FR-040**: System MUST maintain separate balances for Coins, Platinum, and TON
- **FR-041**: Coins MUST be earnable through training and quests
- **FR-042**: Platinum MUST be purchasable with TON or real currency
- **FR-043**: TON MUST be earnable through milestones and P2P victories

**P2P Battles**
- **FR-050**: System MUST support creating pools with configurable: exercise, players (2-10), duration, stake, currency
- **FR-051**: System MUST support public (discoverable) and private (invite-only) pools
- **FR-052**: System MUST start competition when participant quota is reached
- **FR-053**: System MUST track and broadcast action counts in real-time during competition
- **FR-054**: System MUST distribute prize pool to winners minus 10% platform fee
- **FR-055**: System MUST initiate tie-breaker when top scores are equal
- **FR-056**: Pool creator MUST be able to kick participants and cancel pool before start
- **FR-057**: System MUST refund stakes when pool is cancelled

**Market & Items**
- **FR-060**: System MUST display available items with prices in Coins or Platinum
- **FR-061**: System MUST track inventory of purchased consumable items
- **FR-062**: Booster items MUST apply temporary multipliers to training rewards
- **FR-063**: Energy Bottles MUST restore energy to maximum when consumed

**Quests**
- **FR-070**: System MUST generate daily quests that reset at 06:00 user timezone
- **FR-071**: System MUST track quest progress automatically based on user actions
- **FR-072**: System MUST allow claiming rewards for completed quests
- **FR-073**: System MUST provide milestone quests for Aura achievements
- **FR-074**: System MUST provide referral quests for inviting friends

**Roulette**
- **FR-080**: System MUST allow spinning with available Spin tokens
- **FR-081**: System MUST randomly select from configured prize pool
- **FR-082**: System MUST allow purchasing Spins with Platinum

**Wallet**
- **FR-090**: System MUST support TON wallet connection via TonConnect
- **FR-091**: System MUST track pending and available TON balance
- **FR-092**: System MUST support TON withdrawal to connected wallet
- **FR-093**: System MUST track withdrawal history and status

**Influencers**
- **FR-100**: System MUST display available influencers with their skins
- **FR-101**: System MUST support subscription to influencers
- **FR-102**: Subscription MUST unlock influencer's character skins
- **FR-103**: Subscribed users MUST appear on influencer's dedicated leaderboard

**Leaderboards**
- **FR-110**: System MUST maintain global leaderboard by XP and Aura
- **FR-111**: System MUST maintain per-influencer leaderboards for subscribers
- **FR-112**: System MUST support filtering by period (all-time, weekly, 24h)

### Key Entities

- **User**: Core user profile with Telegram ID, display name, level, total XP, and FTUE status
- **Energy Balance**: Current/max energy per user, regeneration tracking
- **Aura Stats**: Current streak count, milestone progress, bonus multipliers
- **Training Session**: Active session state, exercise type, action count, XP/Coins earned
- **Daily Progress**: Per-day energy expenditure tracking for Aura calculation
- **Coins/Platinum/TON Balances**: Separate currency balances per user
- **Pool**: P2P competition definition with exercise, stakes, participants, timing
- **Pool Participant**: User's participation in pool with action count and results
- **Inventory Item**: Owned consumables with quantities
- **Active Boost**: Temporary multiplier with expiration time
- **Quest**: Daily/milestone/referral objectives with progress and rewards
- **Connected Wallet**: TON wallet address linked to user account
- **Influencer Subscription**: User's subscription to influencer with skin access

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users complete onboarding flow in under 5 minutes
- **SC-002**: 70% of users complete at least one training session on first day
- **SC-003**: Average daily session count per active user exceeds 2
- **SC-004**: 30% of daily active users achieve 200% energy (earn Aura)
- **SC-005**: Aura streak retention: 50% of users maintain 7+ day streaks
- **SC-006**: P2P participation: 20% of active users participate in at least one battle per week
- **SC-007**: Market engagement: 60% of earned Coins are spent within 7 days
- **SC-008**: Quest completion: 80% of daily quests are completed by active users
- **SC-009**: Wallet connection: 40% of users connect TON wallet within first week
- **SC-010**: System supports 10,000 concurrent users during peak hours
