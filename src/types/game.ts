export type BeastSize = 'Small' | 'Medium' | 'Large' | 'Massive';

export type DiceValue = 'D4' | 'D6' | 'D8' | 'D10' | 'D12' | 'D20' | '-';

export interface StatProfile {
  move: DiceValue;        // M: Movement die (moves max of die in inches on normal ground, e.g. D8 = 8")
  strike: DiceValue;      // S: Strike die
  block: DiceValue;       // B: Block die
  ranged: DiceValue;      // R: Ranged die
  nimbleness: DiceValue;  // N: Nimbleness die
  concealment: DiceValue; // C: Concealment die
  awareness: DiceValue;   // A: Awareness die
  fortitude: DiceValue;   // F: Fortitude die
  presence: DiceValue;    // P: Presence die
  wounds: number;         // Wounds boxes (17 in B&B 2e; shaded boxes 4, 7, 10, 13 give -1; 17 = OoA)
}

export interface StatNumericModifiers {
  move: number;        // +/- die steps
  strike: number;      // +/- die steps
  block: number;
  ranged: number;
  nimbleness: number;
  concealment: number;
  awareness: number;
  fortitude: number;
  presence: number;
  wounds: number;      // +/- permanent wound boxes (e.g. Old Battle Wound = -1)
}

export type MagicalArchetype =
  | 'Natural'
  | 'Light'
  | 'Dark'
  | 'Wild'
  | 'Unbound'
  | 'Noble'
  | 'Divine'
  | 'Channelling'
  | 'Fate-weaving'
  | 'Illusionism'
  | 'Elementalism'
  | 'Necromancy';

export interface SpeciesRef {
  id: string;
  name: string;
  size: BeastSize;
  baseSizeMm?: string; // e.g. "30mm", "40mm", "50mm"
  baseLevel?: number;  // Small=1, Medium=2, Large=3, Massive=4
  cost: number;        // Signing-on Fee in Pennies
  isRareSpecies?: boolean;
  cannotBeMagicUser?: boolean; // e.g. Mist Ghasts and Stag Beetle Grubs cannot use Spells
  stats: StatProfile;
  innateSkillIds: string[];
  specialRules?: string;
}

export type StatDieKey = Exclude<keyof StatNumericModifiers, 'wounds'>;

export interface AllegianceStartingBonusRule {
  name: string; // e.g., "Fast and Furious"
  maxModels: number; // e.g., 2 or 3
  type: 'stat' | 'skill';
  allowedStats?: StatDieKey[];
  allowedSkillIds?: string[];
  description: string;
}

export interface AllegianceRef {
  id: string;
  name: string;
  theme: string;
  startingDenType: string;
  startingDenUpgradeId: string;
  allegianceArchetype?: 'Warrior' | 'Ranger' | 'Cunning Folk' | 'All-rounder';
  allowedMagicArchetypes?: MagicalArchetype[];
  maxMagicUsers?: number; // e.g. 1 for Routiers (Martial Pride)
  allModelsMustBeMagicUsers?: boolean; // e.g. true for Arcane Conclave (Magical Studies)
  leaderAndSecondMustBeMagicUserOrStableGhast?: boolean; // e.g. true for Undead
  magicUserRuleNote?: string;
  startingPenniesOverride?: number; // e.g. 375 for Freebeasts & Witch Hunters
  startingBonus?: AllegianceStartingBonusRule;
  allowedSpeciesNote: string;
  specialRules: string;
}

export type EquipmentCategory =
  | 'One-Handed Weapon'
  | 'Double-Handed Weapon'
  | 'Ranged Weapon'
  | 'Armour'
  | 'Shield'
  | 'Accessory'
  | 'Potion & Consumable'
  | 'Magical Ingredient'
  | 'Bonded Critter / Grub'
  | 'Rare & Relic';

export type EquipmentSlot =
  | 'Weapon 1'
  | 'Weapon 2'
  | 'Armour 1'
  | 'Armour 2'
  | 'Item'
  | 'Special'
  | 'Special 2'
  | 'Special 3'
  | "Mage's Pouch"
  | 'Weapon Upgrade'
  // Legacy compatibility slots
  | 'Main Hand'
  | 'Off Hand'
  | 'Two-Handed'
  | 'Ranged'
  | 'Armour'
  | 'Accessory'
  | 'Consumable';

export interface EquipmentRef {
  id: string;
  name: string;
  category: EquipmentCategory;
  equipmentType?: 'Weapon' | 'Armour' | 'Item' | 'Ingredient' | 'Upgrade';
  defaultSlot: EquipmentSlot;
  slotsRequired?: number; // 1 for standard items; 2 for Heavy & Very Heavy Armour (1 with Born in Harness); 0 for Ingredients in Mage's Pouch
  cost: number; // Base / starting Pennies cost
  postBattlePriceNote?: string; // e.g. "3d6+8p (Rarity 8)"
  rarity: 'Common' | 'Rare (6+)' | 'Rare (7+)' | 'Rare (8+)' | 'Rare (9+)' | 'Rare (10+)' | 'Relic';
  range?: string; // e.g. '18"', '24"', '36"', 'Varies'
  weaponModifiers?: string; // e.g., "-2 Block; Strong (3)"
  armourValue?: number;     // Tough(X) value from Armour/Shield
  nimblenessPenalty?: number; // e.g. -1 for Heavy Armour, Heavy Shield, Heavy Crossbow; -2 for Very Heavy Armour
  requiresStrongLevel?: number; // e.g. 2 for War Bow, 1 for Heavy Crossbow
  requiresSkillId?: string; // e.g. 'sk-fearless' for Cheirosiphon
  requiresMagicUser?: boolean; // e.g. true for Dispel Scroll
  isBlackPowder?: boolean; // e.g. true for Pistol, Blunderbuss, Caliver
  isTwoHandedOrPolearm?: boolean; // Cannot be used with Shields, Torch, Lantern, Blind Dust, Tangle Net
  isShield?: boolean; // Buckler, Light Shield, Heavy Shield, Shield of Attraction
  isBodyArmour?: boolean; // Light Armour, Heavy Armour, Very Heavy Armour, Armour of Ultimate Protection
  maxOnePerBand?: boolean; // Inspiring Object, Bagpipes
  description: string;
}

export type SkillOrSpellCategory =
  | 'Fighting Skill'
  | 'Shooting Skill'
  | 'Cunning Skill'
  | 'Strength Skill'
  | 'Movement Skill'
  | 'Innate Skill'
  | 'Magic Spell';

export interface SkillOrSpellRef {
  id: string;
  name: string;
  category: SkillOrSpellCategory;
  magicalArchetype?: MagicalArchetype;
  castingStat?: 'Fortitude' | 'Presence';
  spellDifficulty?: number;
  spellRange?: string;
  difficultyOrLore?: string; // For spells: e.g. "Natural Magic (Difficulty 5, Range 18\")"
  requirementsText?: string; // e.g., "Must have Wounding Shot; Costs 1 Fate point to use"
  prerequisiteSkillIds?: string[]; // Skill IDs the model must already possess (innate or learned)
  requiredSpeciesIds?: string[]; // Species IDs required to learn this skill (e.g. Shrew Knight Errant for Lance Strike)
  requiresSpell?: boolean; // True if the skill requires the model to know at least 1 Spell (e.g. Gifted, Fae Blooded)
  description: string;
}

export interface DenUpgradeRef {
  id: string;
  name: string;
  labourCost?: number;    // Official 2e Labour cost
  materialsCost?: number; // Official 2e Materials cost
  cost: number;           // Equivalent Pennies cost (Materials * 5p)
  isStartingOnly?: boolean;
  effectSummary: string;
  postGameBenefit: string;
}

export interface InjuryRef {
  id: string;
  tableType?: 'Major (D20)' | 'Minor (D12)';
  rollRange: string; // e.g. "D20: 1-2", "D12: 7-8"
  name: string;
  effect: string;
  pensionPennies?: number; // Pennies added to the Band's Pension box
  levelDelta?: number;     // e.g. -1 Level on Major Injuries
  causesMissNextGame?: boolean;
  causesDeath?: boolean;
  statPenalty?: Partial<StatNumericModifiers>;
}

export interface RulesDataset {
  version: string;
  species: SpeciesRef[];
  allegiances: AllegianceRef[];
  equipment: EquipmentRef[];
  skillsAndSpells: SkillOrSpellRef[];
  denUpgrades: DenUpgradeRef[];
  injuries: InjuryRef[];
}

export type FighterRole = 'Leader' | 'Second' | 'Henchbeast' | 'Hired Paw / Mercenary';

export type FighterStatus = 'Active' | 'Miss Next Game' | 'Retired' | 'Dead';

export type TabletopCondition =
  | 'Activated'
  | 'Sneaking'
  | 'Berserk'
  | 'Stunned'
  | 'Paralysed'
  | 'Burning'
  | 'Bleeding'
  | 'Poisoned'
  | 'Infected'
  | 'Drunk'
  | 'Temporal Flux'
  | 'Out of Action';

export interface EquippedOrStashedItem {
  instanceId: string;
  equipmentId: string;
  assignedFighterId: string | null; // null = stored in Den Stash
  slot: EquipmentSlot;
  purchaseCost: number;
  customName?: string;
  isMasterSmithed?: boolean;
  isMalleusMaleficarum?: boolean;
  isConsumed?: boolean;
}

export interface FighterAdvanceLog {
  id: string;
  date: string;
  description: string; // e.g., "+1 Strike Step", "Learned Skill: Parry"
}

export interface Fighter {
  id: string;
  name: string;
  title?: string;
  role: FighterRole;
  speciesId: string;
  status: FighterStatus;
  recruitmentCost: number;
  xp: number;
  advancesCount: number;
  usedAllegianceBonus?: boolean;
  isMagicUser?: boolean;
  magicalArchetype?: MagicalArchetype;
  magicalArchetypes?: MagicalArchetype[];
  statModifiers: StatNumericModifiers;
  learnedSkillIds: string[];
  learnedSpellIds: string[];
  injuryIds: string[];
  advanceHistory: FighterAdvanceLog[];
  notes: string;
  // Live Tabletop Match State
  currentWounds: number;
  fatePoints?: number; // Per-model Fate points (Page 36: Leader=3, Second=2, Others=1; max 5)
  conditions: TabletopCondition[];
}

export interface WarbandDenUpgradeInstance {
  id: string;
  upgradeId: string;
  purchasedAfterMatchNumber: number; // 0 = starting upgrade
  isNewThisCycle: boolean; // In B&B 2e, newly bought Den upgrades activate on subsequent games
  notes?: string;
}

export interface TreasuryTransaction {
  id: string;
  date: string;
  deltaPennies: number;
  reason: string;
  balanceAfter: number;
}

export interface Warband {
  id: string;
  userId: string;
  ownerName: string;
  campaignId?: string | null;
  name: string;
  motto?: string;
  allegianceId: string;
  denName: string;
  denType: string;
  treasuryPennies: number;
  pensions?: number;  // 2e Band Roster Pension box (paid to retired/killed beasts' kin)
  labour?: number;    // 2e Band Roster Labour pool for Den Upgrades
  materials?: number; // 2e Band Roster Materials pool for Den Upgrades
  fatePoints?: number; // Deprecated legacy band-level field; Fate points are tracked per Fighter in 2e
  matchesPlayed: number;
  wins: number;
  fighters: Fighter[];
  inventory: EquippedOrStashedItem[]; // Includes both equipped items and Den Stash (assignedFighterId === null)
  denUpgrades: WarbandDenUpgradeInstance[]; // Up to 12 slots on the B&B 2e roster
  treasuryLog: TreasuryTransaction[];
  backstory: string;
  updatedAt: string;
  createdAt: string;
}

export interface CampaignMatch {
  id: string;
  campaignId: string;
  scenario: string;
  warbandAId: string;
  warbandAName: string;
  warbandBId: string;
  warbandBName: string;
  winnerWarbandId: string | null; // null = draw
  summaryNotes: string;
  playedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
}
