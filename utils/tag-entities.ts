#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TagMapping {
  entityId: string;
  tags: string[];
}

// Test case definitions with entity mappings
const TC_MAPPINGS: Record<string, TagMapping[]> = {
  // ONBOARDING
  'tc:onboarding:happy-path': [
    { entityId: 'screen:onboarding:welcome', tags: ['tc:onboarding:happy-path:start'] },
    { entityId: 'screen:onboarding:camera-permission', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'action:training:request-camera-permission', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'screen:training:select-exercise', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'action:training:start', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'screen:training:active-session', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'screen:training:results', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'screen:onboarding:quest-complete', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'action:quests:complete', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'screen:roulette:main', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'action:roulette:spin', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'dialog:roulette:result', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'screen:onboarding:bottle-offer', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'action:onboarding:buy-bottle', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'screen:onboarding:aura-explanation', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'screen:onboarding:wallet-offer', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'screen:onboarding:complete', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'action:onboarding:finish', tags: ['tc:onboarding:happy-path'] },
    { entityId: 'screen:main:dashboard', tags: ['tc:onboarding:happy-path:end'] },
  ],
  'tc:onboarding:skip-camera': [
    { entityId: 'screen:onboarding:welcome', tags: ['tc:onboarding:skip-camera:start'] },
    { entityId: 'screen:onboarding:camera-permission', tags: ['tc:onboarding:skip-camera'] },
    { entityId: 'screen:onboarding:aura-explanation', tags: ['tc:onboarding:skip-camera'] },
    { entityId: 'screen:onboarding:wallet-offer', tags: ['tc:onboarding:skip-camera'] },
    { entityId: 'screen:onboarding:complete', tags: ['tc:onboarding:skip-camera:end'] },
  ],
  'tc:onboarding:camera-denied': [
    { entityId: 'screen:onboarding:camera-permission', tags: ['tc:onboarding:camera-denied:start'] },
    { entityId: 'action:training:request-camera-permission', tags: ['tc:onboarding:camera-denied'] },
    { entityId: 'dialog:training:request-camera-access', tags: ['tc:onboarding:camera-denied:end'] },
  ],
  'tc:onboarding:with-wallet': [
    { entityId: 'screen:onboarding:wallet-offer', tags: ['tc:onboarding:with-wallet:start'] },
    { entityId: 'dialog:wallet:connect', tags: ['tc:onboarding:with-wallet'] },
    { entityId: 'event:wallet:connected', tags: ['tc:onboarding:with-wallet'] },
    { entityId: 'screen:onboarding:complete', tags: ['tc:onboarding:with-wallet:end'] },
  ],
  'tc:onboarding:no-coins-for-bottle': [
    { entityId: 'screen:onboarding:bottle-offer', tags: ['tc:onboarding:no-coins-for-bottle:start'] },
    { entityId: 'screen:onboarding:aura-explanation', tags: ['tc:onboarding:no-coins-for-bottle'] },
    { entityId: 'screen:onboarding:complete', tags: ['tc:onboarding:no-coins-for-bottle:end'] },
  ],

  // TRAINING
  'tc:training:full-session': [
    { entityId: 'screen:training:select-exercise', tags: ['tc:training:full-session:start'] },
    { entityId: 'action:training:start', tags: ['tc:training:full-session'] },
    { entityId: 'action:training:start-calibration', tags: ['tc:training:full-session'] },
    { entityId: 'event:training:calibration-started', tags: ['tc:training:full-session'] },
    { entityId: 'action:training:complete-calibration', tags: ['tc:training:full-session'] },
    { entityId: 'event:training:calibration-complete', tags: ['tc:training:full-session'] },
    { entityId: 'screen:training:active-session', tags: ['tc:training:full-session'] },
    { entityId: 'action:training:record-action', tags: ['tc:training:full-session'] },
    { entityId: 'event:training:action-detected', tags: ['tc:training:full-session'] },
    { entityId: 'action:training:pause', tags: ['tc:training:full-session'] },
    { entityId: 'screen:training:paused', tags: ['tc:training:full-session'] },
    { entityId: 'action:training:resume', tags: ['tc:training:full-session'] },
    { entityId: 'action:training:finish', tags: ['tc:training:full-session'] },
    { entityId: 'action:training:check-quests', tags: ['tc:training:full-session'] },
    { entityId: 'screen:training:results', tags: ['tc:training:full-session:end'] },
  ],
  'tc:training:night-mode': [
    { entityId: 'screen:training:select-exercise', tags: ['tc:training:night-mode:start'] },
    { entityId: 'action:training:start', tags: ['tc:training:night-mode'] },
    { entityId: 'screen:training:active-session', tags: ['tc:training:night-mode'] },
    { entityId: 'action:training:finish', tags: ['tc:training:night-mode'] },
    { entityId: 'screen:training:results', tags: ['tc:training:night-mode:end'] },
  ],
  'tc:training:earn-aura': [
    { entityId: 'screen:training:select-exercise', tags: ['tc:training:earn-aura:start'] },
    { entityId: 'action:training:finish', tags: ['tc:training:earn-aura'] },
    { entityId: 'action:aura:earn', tags: ['tc:training:earn-aura'] },
    { entityId: 'dialog:aura:celebration', tags: ['tc:training:earn-aura:end'] },
  ],
  'tc:training:camera-lost': [
    { entityId: 'screen:training:active-session', tags: ['tc:training:camera-lost:start'] },
    { entityId: 'event:training:camera-lost', tags: ['tc:training:camera-lost'] },
    { entityId: 'action:training:camera-lost', tags: ['tc:training:camera-lost'] },
    { entityId: 'dialog:training:camera-unavailable', tags: ['tc:training:camera-lost:end'] },
  ],
  'tc:training:timeout': [
    { entityId: 'screen:training:active-session', tags: ['tc:training:timeout:start'] },
    { entityId: 'event:training:session-timeout', tags: ['tc:training:timeout'] },
    { entityId: 'action:training:timeout', tags: ['tc:training:timeout'] },
    { entityId: 'dialog:training:timeout', tags: ['tc:training:timeout:end'] },
  ],
  'tc:training:no-energy': [
    { entityId: 'screen:training:select-exercise', tags: ['tc:training:no-energy:start'] },
    { entityId: 'dialog:energy:empty', tags: ['tc:training:no-energy'] },
    { entityId: 'dialog:energy:xp-only', tags: ['tc:training:no-energy:end'] },
  ],

  // AURA
  'tc:aura:earn-daily': [
    { entityId: 'action:aura:daily-check', tags: ['tc:aura:earn-daily:start'] },
    { entityId: 'action:aura:earn', tags: ['tc:aura:earn-daily'] },
    { entityId: 'dialog:aura:celebration', tags: ['tc:aura:earn-daily:end'] },
  ],
  'tc:aura:lose-streak': [
    { entityId: 'action:aura:daily-check', tags: ['tc:aura:lose-streak:start'] },
    { entityId: 'action:aura:lose', tags: ['tc:aura:lose-streak'] },
    { entityId: 'dialog:aura:streak-lost', tags: ['tc:aura:lose-streak:end'] },
  ],
  'tc:aura:use-freeze': [
    { entityId: 'dialog:aura:freeze-confirm', tags: ['tc:aura:use-freeze:start'] },
    { entityId: 'action:aura:activate-freeze', tags: ['tc:aura:use-freeze'] },
    { entityId: 'dialog:aura:freeze-activated', tags: ['tc:aura:use-freeze:end'] },
  ],
  'tc:aura:restore-streak': [
    { entityId: 'dialog:aura:streak-lost', tags: ['tc:aura:restore-streak:start'] },
    { entityId: 'action:aura:use-streak-restore', tags: ['tc:aura:restore-streak'] },
    { entityId: 'dialog:aura:restore-expired', tags: ['tc:aura:restore-streak:end'] },
  ],

  // POOLS
  'tc:pools:create-and-win': [
    { entityId: 'screen:pools:pools-list', tags: ['tc:pools:create-and-win:start'] },
    { entityId: 'screen:pools:create-pool', tags: ['tc:pools:create-and-win'] },
    { entityId: 'action:pools:create', tags: ['tc:pools:create-and-win'] },
    { entityId: 'action:pools:join-created-pool', tags: ['tc:pools:create-and-win'] },
    { entityId: 'screen:pools:pool-details', tags: ['tc:pools:create-and-win'] },
    { entityId: 'action:pools:check-quota', tags: ['tc:pools:create-and-win'] },
    { entityId: 'action:pools:start-preparation', tags: ['tc:pools:create-and-win'] },
    { entityId: 'event:pools:preparation-started', tags: ['tc:pools:create-and-win'] },
    { entityId: 'screen:pools:preparation', tags: ['tc:pools:create-and-win'] },
    { entityId: 'action:pools:start', tags: ['tc:pools:create-and-win'] },
    { entityId: 'event:pools:started', tags: ['tc:pools:create-and-win'] },
    { entityId: 'screen:pools:competition', tags: ['tc:pools:create-and-win'] },
    { entityId: 'action:pools:record-action', tags: ['tc:pools:create-and-win'] },
    { entityId: 'event:pools:action-detected', tags: ['tc:pools:create-and-win'] },
    { entityId: 'action:pools:complete', tags: ['tc:pools:create-and-win'] },
    { entityId: 'action:pools:calculate-results', tags: ['tc:pools:create-and-win'] },
    { entityId: 'action:pools:distribute-prizes', tags: ['tc:pools:create-and-win'] },
    { entityId: 'event:pools:completed', tags: ['tc:pools:create-and-win'] },
    { entityId: 'dialog:pools:you-won', tags: ['tc:pools:create-and-win'] },
    { entityId: 'screen:pools:results', tags: ['tc:pools:create-and-win:end'] },
  ],
  'tc:pools:join-and-play': [
    { entityId: 'screen:pools:pools-list', tags: ['tc:pools:join-and-play:start'] },
    { entityId: 'screen:pools:pool-details', tags: ['tc:pools:join-and-play'] },
    { entityId: 'action:pools:join', tags: ['tc:pools:join-and-play'] },
    { entityId: 'dialog:pools:confirm-join', tags: ['tc:pools:join-and-play'] },
    { entityId: 'action:pools:confirm-join', tags: ['tc:pools:join-and-play'] },
    { entityId: 'event:pools:player-joined', tags: ['tc:pools:join-and-play'] },
    { entityId: 'screen:pools:preparation', tags: ['tc:pools:join-and-play'] },
    { entityId: 'screen:pools:competition', tags: ['tc:pools:join-and-play'] },
    { entityId: 'screen:pools:results', tags: ['tc:pools:join-and-play:end'] },
  ],
  'tc:pools:insufficient-funds': [
    { entityId: 'screen:pools:pools-list', tags: ['tc:pools:insufficient-funds:start'] },
    { entityId: 'action:pools:join', tags: ['tc:pools:insufficient-funds'] },
    { entityId: 'dialog:currency:insufficient-funds', tags: ['tc:pools:insufficient-funds:end'] },
  ],
  'tc:pools:already-in-pool': [
    { entityId: 'screen:pools:pools-list', tags: ['tc:pools:already-in-pool:start'] },
    { entityId: 'action:pools:join', tags: ['tc:pools:already-in-pool'] },
    { entityId: 'dialog:pools:already-in-pool', tags: ['tc:pools:already-in-pool:end'] },
  ],
  'tc:pools:kick-player': [
    { entityId: 'screen:pools:pool-settings', tags: ['tc:pools:kick-player:start'] },
    { entityId: 'dialog:pools:confirm-kick', tags: ['tc:pools:kick-player'] },
    { entityId: 'action:pools:confirm-kick', tags: ['tc:pools:kick-player'] },
    { entityId: 'action:pools:kick', tags: ['tc:pools:kick-player'] },
    { entityId: 'action:pools:refund-kicked', tags: ['tc:pools:kick-player'] },
    { entityId: 'event:pools:kicked', tags: ['tc:pools:kick-player'] },
    { entityId: 'dialog:pools:you-were-kicked', tags: ['tc:pools:kick-player:end'] },
  ],
  'tc:pools:cancel-pool': [
    { entityId: 'screen:pools:pool-settings', tags: ['tc:pools:cancel-pool:start'] },
    { entityId: 'action:pools:cancel', tags: ['tc:pools:cancel-pool'] },
    { entityId: 'event:pools:cancelled', tags: ['tc:pools:cancel-pool'] },
    { entityId: 'screen:pools:pools-list', tags: ['tc:pools:cancel-pool:end'] },
  ],
  'tc:pools:leave-before-start': [
    { entityId: 'screen:pools:pool-details', tags: ['tc:pools:leave-before-start:start'] },
    { entityId: 'action:pools:leave', tags: ['tc:pools:leave-before-start'] },
    { entityId: 'event:pools:player-left', tags: ['tc:pools:leave-before-start'] },
    { entityId: 'screen:pools:pools-list', tags: ['tc:pools:leave-before-start:end'] },
  ],
  'tc:pools:leave-during-preparation': [
    { entityId: 'screen:pools:preparation', tags: ['tc:pools:leave-during-preparation:start'] },
    { entityId: 'action:pools:leave-preparation', tags: ['tc:pools:leave-during-preparation'] },
    { entityId: 'screen:pools:pools-list', tags: ['tc:pools:leave-during-preparation:end'] },
  ],
  'tc:pools:tie-breaker': [
    { entityId: 'screen:pools:competition', tags: ['tc:pools:tie-breaker:start'] },
    { entityId: 'action:pools:complete', tags: ['tc:pools:tie-breaker'] },
    { entityId: 'event:pools:tie-breaker', tags: ['tc:pools:tie-breaker'] },
    { entityId: 'dialog:pools:tie-breaker', tags: ['tc:pools:tie-breaker:end'] },
  ],

  // ROULETTE
  'tc:roulette:spin-and-win': [
    { entityId: 'screen:roulette:main', tags: ['tc:roulette:spin-and-win:start'] },
    { entityId: 'dialog:roulette:main', tags: ['tc:roulette:spin-and-win'] },
    { entityId: 'action:roulette:spin', tags: ['tc:roulette:spin-and-win'] },
    { entityId: 'action:roulette:determine-prize', tags: ['tc:roulette:spin-and-win'] },
    { entityId: 'action:roulette:claim-prize', tags: ['tc:roulette:spin-and-win'] },
    { entityId: 'action:roulette:apply-prize', tags: ['tc:roulette:spin-and-win'] },
    { entityId: 'dialog:roulette:result', tags: ['tc:roulette:spin-and-win:end'] },
  ],
  'tc:roulette:no-spins': [
    { entityId: 'screen:roulette:main', tags: ['tc:roulette:no-spins:start'] },
    { entityId: 'dialog:roulette:no-spins', tags: ['tc:roulette:no-spins'] },
    { entityId: 'action:roulette:buy-spins', tags: ['tc:roulette:no-spins:end'] },
  ],

  // QUESTS
  'tc:quests:complete-daily': [
    { entityId: 'screen:quests:list', tags: ['tc:quests:complete-daily:start'] },
    { entityId: 'action:quests:complete', tags: ['tc:quests:complete-daily'] },
    { entityId: 'action:quests:claim', tags: ['tc:quests:complete-daily'] },
    { entityId: 'dialog:quests:completed', tags: ['tc:quests:complete-daily:end'] },
  ],
  'tc:quests:full-energy-session': [
    { entityId: 'screen:training:active-session', tags: ['tc:quests:full-energy-session:start'] },
    { entityId: 'action:quests:complete', tags: ['tc:quests:full-energy-session'] },
    { entityId: 'action:quests:claim-reward', tags: ['tc:quests:full-energy-session:end'] },
  ],
  'tc:quests:claim-referral': [
    { entityId: 'screen:quests:list', tags: ['tc:quests:claim-referral:start'] },
    { entityId: 'action:quests:claim-referral', tags: ['tc:quests:claim-referral'] },
    { entityId: 'dialog:quests:referral-completed', tags: ['tc:quests:claim-referral:end'] },
  ],

  // ITEMS
  'tc:items:use-energy-bottle': [
    { entityId: 'screen:items:inventory', tags: ['tc:items:use-energy-bottle:start'] },
    { entityId: 'dialog:items:inventory', tags: ['tc:items:use-energy-bottle'] },
    { entityId: 'action:items:use-item', tags: ['tc:items:use-energy-bottle'] },
    { entityId: 'dialog:items:confirm-use', tags: ['tc:items:use-energy-bottle'] },
    { entityId: 'action:items:confirm-use', tags: ['tc:items:use-energy-bottle'] },
    { entityId: 'action:energy:use-bottle', tags: ['tc:items:use-energy-bottle:end'] },
  ],
  'tc:items:activate-boost': [
    { entityId: 'screen:items:inventory', tags: ['tc:items:activate-boost:start'] },
    { entityId: 'dialog:items:inventory', tags: ['tc:items:activate-boost'] },
    { entityId: 'action:items:use-item', tags: ['tc:items:activate-boost'] },
    { entityId: 'action:items:confirm-use', tags: ['tc:items:activate-boost:end'] },
  ],
  'tc:items:buy-from-market': [
    { entityId: 'dialog:items:market', tags: ['tc:items:buy-from-market:start'] },
    { entityId: 'action:items:buy-freeze', tags: ['tc:items:buy-from-market'] },
    { entityId: 'action:items:buy-energy-bottle', tags: ['tc:items:buy-from-market'] },
    { entityId: 'action:items:buy-streak-restore', tags: ['tc:items:buy-from-market'] },
    { entityId: 'screen:items:inventory', tags: ['tc:items:buy-from-market:end'] },
  ],

  // REFERRAL
  'tc:referral:invite-friend': [
    { entityId: 'screen:profile:main', tags: ['tc:referral:invite-friend:start'] },
    { entityId: 'dialog:referral:share', tags: ['tc:referral:invite-friend'] },
    { entityId: 'action:referral:share-telegram', tags: ['tc:referral:invite-friend'] },
    { entityId: 'action:referral:register-referral', tags: ['tc:referral:invite-friend'] },
    { entityId: 'event:referral:new-referral', tags: ['tc:referral:invite-friend'] },
    { entityId: 'action:referral:give-bonus-to-referred', tags: ['tc:referral:invite-friend:end'] },
  ],
  'tc:referral:claim-milestone': [
    { entityId: 'screen:quests:list', tags: ['tc:referral:claim-milestone:start'] },
    { entityId: 'action:referral:check-quests', tags: ['tc:referral:claim-milestone'] },
    { entityId: 'event:referral:milestone-reached', tags: ['tc:referral:claim-milestone'] },
    { entityId: 'action:quests:claim-milestone', tags: ['tc:referral:claim-milestone'] },
    { entityId: 'dialog:quests:milestone-celebration', tags: ['tc:referral:claim-milestone:end'] },
  ],

  // WALLET
  'tc:wallet:connect': [
    { entityId: 'dialog:wallet:connect', tags: ['tc:wallet:connect:start'] },
    { entityId: 'event:wallet:connected', tags: ['tc:wallet:connect'] },
    { entityId: 'dialog:wallet:main', tags: ['tc:wallet:connect:end'] },
  ],
  'tc:wallet:deposit': [
    { entityId: 'dialog:wallet:main', tags: ['tc:wallet:deposit:start'] },
    { entityId: 'dialog:wallet:deposit-ton', tags: ['tc:wallet:deposit:end'] },
  ],
  'tc:wallet:buy-platinum': [
    { entityId: 'dialog:currency:buy-platinum', tags: ['tc:wallet:buy-platinum:start'] },
    { entityId: 'action:currency:confirm-platinum-purchase', tags: ['tc:wallet:buy-platinum'] },
    { entityId: 'dialog:currency:processing', tags: ['tc:wallet:buy-platinum'] },
    { entityId: 'event:currency:platinum-purchased', tags: ['tc:wallet:buy-platinum'] },
    { entityId: 'dialog:currency:purchase-success', tags: ['tc:wallet:buy-platinum:end'] },
  ],
  'tc:wallet:withdraw': [
    { entityId: 'dialog:wallet:main', tags: ['tc:wallet:withdraw:start'] },
    { entityId: 'action:wallet:withdraw', tags: ['tc:wallet:withdraw'] },
    { entityId: 'dialog:wallet:confirm-withdrawal', tags: ['tc:wallet:withdraw'] },
    { entityId: 'action:wallet:confirm-withdrawal', tags: ['tc:wallet:withdraw'] },
    { entityId: 'dialog:wallet:processing', tags: ['tc:wallet:withdraw'] },
    { entityId: 'action:wallet:complete-withdrawal', tags: ['tc:wallet:withdraw'] },
    { entityId: 'event:wallet:withdrawal-completed', tags: ['tc:wallet:withdraw'] },
    { entityId: 'dialog:wallet:withdrawal-success', tags: ['tc:wallet:withdraw:end'] },
  ],

  // PROFILE
  'tc:profile:view-stats': [
    { entityId: 'screen:profile:main', tags: ['tc:profile:view-stats:start', 'tc:profile:view-stats:end'] },
  ],
  'tc:profile:update-settings': [
    { entityId: 'screen:profile:settings', tags: ['tc:profile:update-settings:start'] },
    { entityId: 'action:profile:update-name', tags: ['tc:profile:update-settings'] },
    { entityId: 'action:profile:update-language', tags: ['tc:profile:update-settings:end'] },
  ],

  // LEADERBOARD
  'tc:leaderboard:view-ranking': [
    { entityId: 'screen:leaderboard:main', tags: ['tc:leaderboard:view-ranking:start', 'tc:leaderboard:view-ranking:end'] },
  ],

  // INFLUENCERS
  'tc:influencers:subscribe': [
    { entityId: 'dialog:influencers:list', tags: ['tc:influencers:subscribe:start'] },
    { entityId: 'dialog:influencers:details', tags: ['tc:influencers:subscribe'] },
    { entityId: 'action:influencers:subscribe', tags: ['tc:influencers:subscribe'] },
    { entityId: 'event:influencers:subscription-completed', tags: ['tc:influencers:subscribe'] },
    { entityId: 'dialog:influencers:subscription-success', tags: ['tc:influencers:subscribe:end'] },
  ],
  'tc:influencers:equip-skin': [
    { entityId: 'screen:profile:settings', tags: ['tc:influencers:equip-skin:start'] },
    { entityId: 'action:influencers:equip-skin', tags: ['tc:influencers:equip-skin'] },
    { entityId: 'screen:main:dashboard', tags: ['tc:influencers:equip-skin:end'] },
  ],

  // Additional coverage for missing entities
  'tc:main:app-entry': [
    { entityId: 'action:main:app-entry', tags: ['tc:main:app-entry:start'] },
    { entityId: 'screen:main:dashboard', tags: ['tc:main:app-entry:end'] },
  ],
  'tc:main:error-handling': [
    { entityId: 'action:main:show-error', tags: ['tc:main:error-handling:start'] },
    { entityId: 'dialog:main:error', tags: ['tc:main:error-handling:end'] },
  ],
  'tc:main:maintenance': [
    { entityId: 'event:system:maintenance', tags: ['tc:main:maintenance:start'] },
    { entityId: 'dialog:main:maintenance', tags: ['tc:main:maintenance'] },
    { entityId: 'event:system:maintenance-ended', tags: ['tc:main:maintenance:end'] },
  ],
  'tc:main:update-required': [
    { entityId: 'dialog:main:update-required', tags: ['tc:main:update-required:start', 'tc:main:update-required:end'] },
  ],
  'tc:energy:regeneration': [
    { entityId: 'event:system:energy-regen-tick', tags: ['tc:energy:regeneration:start'] },
    { entityId: 'action:energy:regenerate', tags: ['tc:energy:regeneration:end'] },
  ],
  'tc:energy:daily-reset': [
    { entityId: 'event:system:daily-reset', tags: ['tc:energy:daily-reset:start'] },
    { entityId: 'action:energy:daily-reset', tags: ['tc:energy:daily-reset:end'] },
  ],
  'tc:energy:overflow': [
    { entityId: 'action:energy:use-bottle', tags: ['tc:energy:overflow:start'] },
    { entityId: 'dialog:energy:overflow', tags: ['tc:energy:overflow:end'] },
  ],
  'tc:currency:insufficient-coins': [
    { entityId: 'dialog:currency:insufficient-coins', tags: ['tc:currency:insufficient-coins:start', 'tc:currency:insufficient-coins:end'] },
  ],
  'tc:currency:insufficient-platinum': [
    { entityId: 'dialog:currency:insufficient-platinum', tags: ['tc:currency:insufficient-platinum:start', 'tc:currency:insufficient-platinum:end'] },
  ],
  'tc:currency:purchase-failed': [
    { entityId: 'event:currency:platinum-purchase-failed', tags: ['tc:currency:purchase-failed:start'] },
    { entityId: 'dialog:currency:purchase-failed', tags: ['tc:currency:purchase-failed:end'] },
  ],
  'tc:currency:buy-coins': [
    { entityId: 'action:currency:buy-coins', tags: ['tc:currency:buy-coins:start', 'tc:currency:buy-coins:end'] },
  ],
  'tc:influencers:cancel': [
    { entityId: 'action:influencers:cancel-subscription', tags: ['tc:influencers:cancel:start'] },
    { entityId: 'dialog:influencers:cancel-confirmed', tags: ['tc:influencers:cancel:end'] },
  ],
  'tc:influencers:payment-failed': [
    { entityId: 'event:influencers:subscription-failed', tags: ['tc:influencers:payment-failed:start'] },
    { entityId: 'dialog:influencers:payment-failed', tags: ['tc:influencers:payment-failed:end'] },
  ],
  'tc:influencers:expire': [
    { entityId: 'event:system:subscription-expired', tags: ['tc:influencers:expire:start'] },
    { entityId: 'action:influencers:expire-subscription', tags: ['tc:influencers:expire:end'] },
  ],
  'tc:items:no-bottles': [
    { entityId: 'dialog:items:no-bottles', tags: ['tc:items:no-bottles:start', 'tc:items:no-bottles:end'] },
  ],
  'tc:pools:pool-full': [
    { entityId: 'dialog:pools:pool-full', tags: ['tc:pools:pool-full:start', 'tc:pools:pool-full:end'] },
  ],
  'tc:pools:transfer-ownership': [
    { entityId: 'action:pools:transfer-ownership', tags: ['tc:pools:transfer-ownership:start'] },
    { entityId: 'event:pools:became-owner', tags: ['tc:pools:transfer-ownership:end'] },
  ],
  'tc:pools:view-history': [
    { entityId: 'screen:pools:history', tags: ['tc:pools:view-history:start', 'tc:pools:view-history:end'] },
  ],
  'tc:pools:game-over': [
    { entityId: 'dialog:pools:game-over', tags: ['tc:pools:game-over:start', 'tc:pools:game-over:end'] },
  ],
  'tc:pools:view-current': [
    { entityId: 'action:pools:view-current-pool', tags: ['tc:pools:view-current:start'] },
    { entityId: 'screen:pools:pool-details', tags: ['tc:pools:view-current:end'] },
  ],
  'tc:pools:update-settings': [
    { entityId: 'action:pools:update-duration', tags: ['tc:pools:update-settings:start'] },
    { entityId: 'action:pools:regenerate-link', tags: ['tc:pools:update-settings:end'] },
  ],
  'tc:roulette:jackpot': [
    { entityId: 'dialog:roulette:jackpot', tags: ['tc:roulette:jackpot:start', 'tc:roulette:jackpot:end'] },
  ],
  'tc:profile:help': [
    { entityId: 'dialog:profile:help', tags: ['tc:profile:help:start', 'tc:profile:help:end'] },
  ],
  'tc:profile:support': [
    { entityId: 'dialog:profile:support-form', tags: ['tc:profile:support:start'] },
    { entityId: 'action:profile:submit-support-form', tags: ['tc:profile:support'] },
    { entityId: 'dialog:profile:support-sent', tags: ['tc:profile:support:end'] },
  ],
  'tc:profile:legal': [
    { entityId: 'dialog:profile:privacy', tags: ['tc:profile:legal:start'] },
    { entityId: 'dialog:profile:terms', tags: ['tc:profile:legal:end'] },
  ],
  'tc:profile:purchase-history': [
    { entityId: 'screen:profile:purchase-history', tags: ['tc:profile:purchase-history:start', 'tc:profile:purchase-history:end'] },
  ],
  'tc:training:low-light': [
    { entityId: 'event:training:low-light', tags: ['tc:training:low-light:start'] },
    { entityId: 'dialog:training:low-light', tags: ['tc:training:low-light:end'] },
  ],
  'tc:training:cancel': [
    { entityId: 'action:training:cancel', tags: ['tc:training:cancel:start', 'tc:training:cancel:end'] },
  ],
  'tc:training:check-camera': [
    { entityId: 'action:training:check-camera', tags: ['tc:training:check-camera:start', 'tc:training:check-camera:end'] },
  ],
  'tc:wallet:disconnect': [
    { entityId: 'action:wallet:disconnect', tags: ['tc:wallet:disconnect:start', 'tc:wallet:disconnect:end'] },
  ],
  'tc:wallet:no-balance': [
    { entityId: 'dialog:wallet:no-balance', tags: ['tc:wallet:no-balance:start', 'tc:wallet:no-balance:end'] },
  ],
  'tc:wallet:connect-required': [
    { entityId: 'dialog:wallet:connect-required', tags: ['tc:wallet:connect-required:start', 'tc:wallet:connect-required:end'] },
  ],
  'tc:wallet:withdrawal-failed': [
    { entityId: 'action:wallet:fail-withdrawal', tags: ['tc:wallet:withdrawal-failed:start'] },
    { entityId: 'event:wallet:withdrawal-failed', tags: ['tc:wallet:withdrawal-failed'] },
    { entityId: 'dialog:wallet:withdrawal-failed', tags: ['tc:wallet:withdrawal-failed:end'] },
  ],
  'tc:pools:view-results': [
    { entityId: 'action:pools:view-results', tags: ['tc:pools:view-results:start'] },
    { entityId: 'screen:pools:results', tags: ['tc:pools:view-results:end'] },
  ],
  'tc:dialog:main-null': [
    { entityId: 'dialog:main:null', tags: ['tc:dialog:main-null:start', 'tc:dialog:main-null:end'] },
  ],
};

function findYamlFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name) && !entry.name.startsWith('_')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function addTagToEntity(file: string, entityId: string, tag: string): boolean {
  const content = fs.readFileSync(file, 'utf-8');

  // Check if entity exists in file
  const entityRegex = new RegExp(`^${entityId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, 'm');
  if (!entityRegex.test(content)) {
    return false;
  }

  // Try yq first
  try {
    execSync(
      `yq -i '(.["${entityId}"].tags) = ((.["${entityId}"].tags // []) + ["${tag}"] | unique | sort)' "${file}"`,
      { stdio: 'pipe' }
    );
    return true;
  } catch {
    // Fallback to regex-based approach
    const entityMatch = content.match(new RegExp(`(^${entityId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:[\\s\\S]*?tags:\\s*\\[)([^\\]]*)(\\])`, 'm'));

    if (entityMatch) {
      const [fullMatch, prefix, existingTags, suffix] = entityMatch;
      const tagsArray = existingTags.split(',').map(t => t.trim()).filter(t => t);
      if (!tagsArray.includes(tag)) {
        tagsArray.push(tag);
        tagsArray.sort();
        const newTags = tagsArray.join(', ');
        const newContent = content.replace(fullMatch, `${prefix}${newTags}${suffix}`);
        fs.writeFileSync(file, newContent);
        return true;
      }
    }
    return false;
  }
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx ts-node utils/tag-entities.ts <folder>');
    process.exit(1);
  }

  const folder = args[0];

  if (!fs.existsSync(folder)) {
    console.error(`Folder not found: ${folder}`);
    process.exit(1);
  }

  console.log('Tagging entities with tc:* markers...\n');

  const files = findYamlFiles(folder);
  const entityToFile = new Map<string, string>();

  // Build entity-to-file mapping
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const matches = content.matchAll(/^((?:screen|action|event|dialog|entity|component|layout|context|config):[a-z0-9-]+:[a-z0-9-]+):/gm);
    for (const match of matches) {
      entityToFile.set(match[1], file);
    }
  }

  let tagged = 0;
  let notFound = 0;
  const notFoundEntities: string[] = [];

  // Apply all tags
  for (const [tc, mappings] of Object.entries(TC_MAPPINGS)) {
    for (const { entityId, tags } of mappings) {
      const file = entityToFile.get(entityId);
      if (!file) {
        notFound++;
        if (!notFoundEntities.includes(entityId)) {
          notFoundEntities.push(entityId);
        }
        continue;
      }

      for (const tag of tags) {
        if (addTagToEntity(file, entityId, tag)) {
          tagged++;
        }
      }
    }
  }

  console.log(`Tagged ${tagged} entities`);

  if (notFoundEntities.length > 0) {
    console.log(`\nEntities not found (${notFoundEntities.length}):`);
    for (const e of notFoundEntities.slice(0, 10)) {
      console.log(`   ${e}`);
    }
    if (notFoundEntities.length > 10) {
      console.log(`   ... and ${notFoundEntities.length - 10} more`);
    }
  }
}

main();
