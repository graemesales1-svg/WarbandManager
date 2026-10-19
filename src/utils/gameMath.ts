import {
  AllegianceRef,
  AllegianceStartingEquipmentOption,
  DiceValue,
  EquipmentRef,
  EquipmentSlot,
  EquippedOrStashedItem,
  Fighter,
  FighterRole,
  RulesDataset,
  SkillOrSpellRef,
  SpeciesRef,
  StatProfile,
  Warband,
} from '../types/game';

const DICE_LADDER: DiceValue[] = ['D4', 'D6', 'D8', 'D10', 'D12', 'D20'];

export function stepDie(baseDie: DiceValue, steps: number): DiceValue {
  if (baseDie === '-' || steps === 0) return baseDie;
  const idx = DICE_LADDER.indexOf(baseDie);
  if (idx === -1) return baseDie;
  const targetIdx = Math.max(0, Math.min(DICE_LADDER.length - 1, idx + steps));
  return DICE_LADDER[targetIdx];
}

export function formatSigned(val: number): string {
  if (val === 0) return '';
  return val > 0 ? `+${val}` : `${val}`;
}

export function getMoveInchesFromDie(moveDie: DiceValue): number {
  switch (moveDie) {
    case 'D4':
      return 4;
    case 'D6':
      return 6;
    case 'D8':
      return 8;
    case 'D10':
      return 10;
    case 'D12':
      return 12;
    case 'D20':
      return 20;
    default:
      return 6;
  }
}

/**
 * Returns the fighter's combined innate + learned skill IDs.
 */
export function getFighterAllSkillIds(fighter: Fighter, rules: RulesDataset): string[] {
  const sp = rules.species.find((s) => s.id === fighter.speciesId);
  return [...(sp?.innateSkillIds ?? []), ...fighter.learnedSkillIds];
}

/**
 * Computes the fighter's net Strong(X) level from innate + learned skills (Strong minus Weak).
 */
export function getFighterNetStrongLevel(fighter: Fighter, rules: RulesDataset): number {
  const sp = rules.species.find((s) => s.id === fighter.speciesId);
  const parseTier = (ids: string[], prefix: string): number => {
    let maxTier = 0;
    for (const id of ids) {
      if (id.startsWith(prefix)) {
        const n = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(n) && n > maxTier) maxTier = n;
      }
    }
    return maxTier;
  };
  // Note: Wildlings' Born to be Wild Strong(1) is cumulative with Species Strong(X)
  const innateStrong = parseTier(sp?.innateSkillIds ?? [], 'sk-strong-');
  const learnedStrong = parseTier(fighter.learnedSkillIds, 'sk-strong-');
  const totalStrong =
    fighter.usedAllegianceBonus &&
    fighter.learnedSkillIds.includes('sk-strong-1') &&
    innateStrong > 0 &&
    learnedStrong === 1
      ? innateStrong + 1
      : Math.max(innateStrong, learnedStrong);

  const innateWeak = parseTier(sp?.innateSkillIds ?? [], 'sk-weak-');
  const learnedWeak = parseTier(fighter.learnedSkillIds, 'sk-weak-');
  const injuryWeak = fighter.injuryIds.filter((id) => id === 'inj-maj-17-torn-tendon').length;
  const totalWeak = innateWeak + learnedWeak + injuryWeak;

  return totalStrong - totalWeak;
}

/**
 * Determines the effective 2.0 Equipment Type ('Weapon' | 'Armour' | 'Item' | 'Ingredient' | 'Upgrade').
 */
export function getEffectiveEquipmentType(
  eq: EquipmentRef
): 'Weapon' | 'Armour' | 'Item' | 'Ingredient' | 'Upgrade' {
  if (eq.equipmentType) return eq.equipmentType;
  if (eq.category === 'Magical Ingredient') return 'Ingredient';
  if (
    eq.category === 'One-Handed Weapon' ||
    eq.category === 'Double-Handed Weapon' ||
    eq.category === 'Ranged Weapon'
  ) {
    return 'Weapon';
  }
  if (eq.category === 'Armour' || eq.category === 'Shield') {
    return 'Armour';
  }
  return 'Item';
}

const STACKABLE_EQUIPMENT_IDS = new Set([
  'eq-broadhead-arrows',
  'eq-bodkin-arrows',
  'eq-lead-slingshot',
  'eq-superior-black-powder',
  'eq-pain-poison',
  'eq-paralysing-poison',
  'eq-mortal-poison',
]);

/**
 * Returns true if any number of copies of `eq` can be carried in a single Item/Special slot
 * (e.g. Broadhead Arrows, Bodkin Arrows, Lead Slingshot, Superior Black Powder, Poisons).
 */
export function isEquipmentStackable(eq?: EquipmentRef | null): boolean {
  if (!eq) return false;
  return Boolean(
    eq.isStackable ||
      STACKABLE_EQUIPMENT_IDS.has(eq.id) ||
      /\/\s*Stack\)/i.test(eq.name) ||
      /any number.*in (a single|1) Item/i.test(eq.description)
  );
}

/**
 * Returns true if `eq` is a consumable / single-use / stackable item or Magical Ingredient
 * that can be expended during an active tabletop game.
 */
export function isEquipmentConsumable(eq?: EquipmentRef | null): boolean {
  if (!eq) return false;
  return Boolean(
    isEquipmentStackable(eq) ||
      eq.category === 'Potion & Consumable' ||
      eq.category === 'Magical Ingredient'
  );
}

/**
 * Returns the current stack quantity of an inventory item (defaults to 1).
 */
export function getItemQuantity(item: EquippedOrStashedItem): number {
  return Math.max(1, item.quantity ?? 1);
}

/**
 * Formats an equipped or stashed item's display name, including its stack quantity (e.g. "Broadhead Arrows ×5").
 */
export function formatItemDisplayName(
  item: EquippedOrStashedItem,
  eq?: EquipmentRef | null
): string {
  const qty = getItemQuantity(item);
  const rawBaseName = item.customName || eq?.name || 'Unknown Item';
  const cleanBaseName =
    !item.customName && (qty > 1 || isEquipmentStackable(eq))
      ? rawBaseName.replace(/\s*\(1\s+[^)]*\/\s*Stack\)/i, '')
      : rawBaseName;
  if (qty > 1 || isEquipmentStackable(eq)) {
    return `${cleanBaseName} ×${qty}`;
  }
  return cleanBaseName;
}

const SKILL_OR_SPELL_PAGE_MAP: Record<string, string> = {
  // Fighting Skills (Pages 124–128)
  'sk-killing-blow': 'Page 124',
  'sk-melee-master': 'Page 124',
  'sk-parry': 'Page 124',
  'sk-born-in-harness': 'Page 124',
  'sk-furious-charge': 'Page 124',
  'sk-witch-slayer': 'Page 126',
  'sk-close-quarters': 'Page 126',
  'sk-weaponskill': 'Page 126',
  'sk-shield-master': 'Page 126',
  'sk-lance-strike': 'Page 126',
  'sk-feint': 'Page 127',
  'sk-dual-wielder': 'Page 127',
  'sk-zweihander': 'Page 127',
  'sk-shield-bash': 'Page 127',
  'sk-focused-strike': 'Page 127',
  'sk-all-out-attack': 'Page 128',
  'sk-unarmed-fighter': 'Page 128',

  // Shooting Skills (Pages 129–131)
  'sk-expert-shot': 'Page 129',
  'sk-fast-shot': 'Page 129',
  'sk-lethal-volley': 'Page 129',
  'sk-eagle-eyes': 'Page 129',
  'sk-targeteer': 'Page 129',
  'sk-rock-steady': 'Page 130',
  'sk-wounding-shot': 'Page 130',
  'sk-crippling-shot': 'Page 130',
  'sk-kill-shot': 'Page 130',
  'sk-spot-the-weak-point': 'Page 130',
  'sk-pistolier': 'Page 131',

  // Cunning Skills (Pages 131–137)
  'sk-apothecary': 'Page 131',
  'sk-bloodhound': 'Page 131',
  'sk-hedge-magic': 'Pages 131, 133',
  'sk-fearless': 'Page 133',
  'sk-ambusher': 'Page 133',
  'sk-adept-ambusher': 'Page 133',
  'sk-deadly-ambusher': 'Page 134',
  'sk-opportunist': 'Page 134',
  'sk-the-ladys-favour': 'Page 134',
  'sk-critter-boss': 'Page 135',
  'sk-witch-smeller': 'Page 135',
  'sk-lucky': 'Page 135',
  'sk-resist-magic': 'Page 135',
  'sk-spell-breaker': 'Page 135',
  'sk-spell-eater': 'Page 136',
  'sk-battlemage': 'Page 136',
  'sk-healing-aura': 'Page 136',
  'sk-far-reacher': 'Page 136',
  'sk-aether-sight': 'Page 136',
  'sk-herbal-brewer': 'Page 137',
  'sk-brew-master': 'Page 137',
  'sk-taunt': 'Page 137',
  'sk-beguile': 'Page 137',
  'sk-gifted': 'Page 137',

  // Strength Skills (Pages 138–142)
  'sk-strong-1': 'Page 138',
  'sk-strong-2': 'Page 138',
  'sk-strong-3': 'Page 138',
  'sk-strong-4': 'Page 138',
  'sk-tough-1': 'Page 138',
  'sk-tough-2': 'Page 138',
  'sk-tough-3': 'Page 138',
  'sk-tough-4': 'Page 138',
  'sk-tough-5': 'Page 138',
  'sk-weak-1': 'Page 138',
  'sk-weak-2': 'Page 138',
  'sk-weak-3': 'Page 138',
  'sk-weak-4': 'Page 138',
  'sk-weak-5': 'Page 138',
  'sk-weak-6': 'Page 138',
  'sk-weak-7': 'Page 138',
  'sk-weak-8': 'Page 138',
  'sk-delicate-1': 'Page 138',
  'sk-delicate-2': 'Page 138',
  'sk-delicate-3': 'Page 138',
  'sk-delicate-4': 'Page 138',
  'sk-delicate-5': 'Page 138',
  'sk-delicate-6': 'Page 138',
  'sk-delicate-7': 'Page 138',
  'sk-delicate-8': 'Page 138',
  'sk-born-survivor': 'Page 138',
  'sk-beast-of-burden': 'Page 140',
  'sk-fearsome': 'Page 140',
  'sk-berserker': 'Page 140',
  'sk-enduring': 'Page 140',
  'sk-stunning-blow': 'Page 141',
  'sk-knockout-blow': 'Page 141',
  'sk-paladin': 'Page 141',
  'sk-pushback': 'Page 141',
  'sk-martial-code': 'Page 142',

  // Movement Skills (Pages 142–143)
  'sk-dodge': 'Page 142',
  'sk-light-feet': 'Page 142',
  'sk-burst-of-speed': 'Page 142',
  'sk-strider': 'Page 142',
  'sk-freeze': 'Page 143',
  'sk-climber': 'Page 143',
  'sk-leaper': 'Page 143',
  'sk-slippery': 'Page 143',
  'sk-swim': 'Page 143',

  // Innate Skills (Pages 144–147)
  'sk-natural-hunter': 'Page 144',
  'sk-flight': 'Page 144',
  'sk-tunneller': 'Page 144',
  'sk-slow': 'Page 145',
  'sk-spines': 'Page 145',
  'sk-short-sighted': 'Page 145',
  'sk-fighting-mount': 'Page 145',
  'sk-otherworldly': 'Pages 145–146',
  'sk-unreliable': 'Page 146',
  'sk-armless': 'Page 146',
  'sk-darksense': 'Page 147',
  'sk-uncanny': 'Page 147',
  'sk-poisonous': 'Page 147',

  // Magic Spells — Natural (Pages 62–64)
  'sp-nat-haste': 'Page 63',
  'sp-nat-curse': 'Page 63',
  'sp-nat-cure': 'Page 63',
  'sp-nat-luck': 'Page 63',
  'sp-nat-lightning': 'Page 64',
  'sp-nat-push': 'Page 64',

  // Magic Spells — Light (Pages 65–66)
  'sp-light-bless': 'Page 65',
  'sp-light-heal': 'Page 65',
  'sp-light-hearts-of-oak': 'Page 65',
  'sp-light-purifying-flames': 'Page 66',
  'sp-light-purge-witch': 'Page 66',
  'sp-light-invulnerable': 'Page 66',

  // Magic Spells — Dark (Pages 68–70)
  'sp-dark-pain': 'Page 68',
  'sp-dark-control': 'Page 68',
  'sp-dark-paralyse': 'Page 69',
  'sp-dark-the-horror': 'Page 69',
  'sp-dark-rage': 'Page 70',
  'sp-dark-life-eater': 'Page 70',

  // Magic Spells — Wild (Pages 71–72)
  'sp-wild-stags-leap': 'Page 71',
  'sp-wild-bears-strength': 'Page 71',
  'sp-wild-oakflesh': 'Page 71',
  'sp-wild-earth-shaker': 'Page 72',
  'sp-wild-tangleweed': 'Page 72',
  'sp-wild-creeping-things': 'Page 72',

  // Magic Spells — Unbound (Pages 73–76)
  'sp-unb-cloak-of-concealment': 'Page 73',
  'sp-unb-acceleration': 'Page 75',
  'sp-unb-fiery-blast': 'Page 75',
  'sp-unb-distant-fracturing': 'Page 75',
  'sp-unb-portable-protector': 'Page 76',
  'sp-unb-mystical-blade': 'Page 76',

  // Magic Spells — Noble (Pages 77–78)
  'sp-nob-the-gate': 'Page 77',
  'sp-nob-transpose': 'Page 77',
  'sp-nob-channelling': 'Page 77',
  'sp-nob-dampening': 'Page 78',
  'sp-nob-radiance': 'Page 78',
  'sp-nob-revelation': 'Page 78',

  // Magic Spells — Divine (Pages 79–80)
  'sp-div-circle-of-protection': 'Page 79',
  'sp-div-healing-hands': 'Page 79',
  'sp-div-blessing': 'Page 79',
  'sp-div-holy-zeal': 'Page 80',
  'sp-div-smite-the-unholy': 'Page 80',
  'sp-div-light-of-our-lord': 'Page 80',

  // Magic Spells — Channelling (Pages 82–84)
  'sp-chan-crush': 'Page 82',
  'sp-chan-regrowth': 'Page 82',
  'sp-chan-plague': 'Page 83',
  'sp-chan-the-marsh': 'Page 83',
  'sp-chan-surge': 'Page 83',
  'sp-chan-the-mists': 'Page 84',

  // Magic Spells — Fate-weaving (Pages 85–86)
  'sp-fate-fates-twist': 'Page 85',
  'sp-fate-fates-path': 'Page 85',
  'sp-fate-delay': 'Page 85',
  'sp-fate-evade': 'Page 86',
  'sp-fate-fates-ebb': 'Page 86',
  'sp-fate-bright-path': 'Page 86',

  // Magic Spells — Illusionism (Pages 88–90)
  'sp-ill-lure-of-gold': 'Page 88',
  'sp-ill-swarms': 'Page 88',
  'sp-ill-terrify': 'Page 88',
  'sp-ill-mortal-wound': 'Page 89',
  'sp-ill-duplicate': 'Page 89',
  'sp-ill-friend-or-foe': 'Page 89',

  // Magic Spells — Elementalism (Pages 90–92)
  'sp-elem-firebolt': 'Page 90',
  'sp-elem-the-burning': 'Page 90',
  'sp-elem-downpour': 'Page 91',
  'sp-elem-desiccate': 'Page 91',
  'sp-elem-wall-of-stone': 'Page 92',
  'sp-elem-earths-maw': 'Page 92',
  'sp-elem-storm-call': 'Page 92',
  'sp-elem-twister': 'Page 92',

  // Magic Spells — Necromancy (Pages 93–97)
  'sp-necro-danse-macabre': 'Page 93',
  'sp-necro-leeching-grasp': 'Page 95',
  'sp-necro-uncontrollable-fear': 'Page 95',
  'sp-necro-doom-bolt': 'Page 96',
  'sp-necro-invigorate': 'Page 96',
  'sp-necro-curse-of-the-centuries': 'Page 97',
  'sp-necro-drain-thrall': 'Page 97',
  'sp-necro-raise': 'Page 97',
};

/**
 * Returns the official Burrows & Badgers 2nd Edition Rulebook page reference for a Skill or Spell.
 */
export function getSkillOrSpellPageReference(entry: SkillOrSpellRef): string {
  if (entry.pageReference) return entry.pageReference;
  if (SKILL_OR_SPELL_PAGE_MAP[entry.id]) return SKILL_OR_SPELL_PAGE_MAP[entry.id];
  switch (entry.category) {
    case 'Fighting Skill':
      return 'Pages 124–128';
    case 'Shooting Skill':
      return 'Pages 129–131';
    case 'Cunning Skill':
      return 'Pages 131–137';
    case 'Strength Skill':
      return 'Pages 138–142';
    case 'Movement Skill':
      return 'Pages 142–143';
    case 'Innate Skill':
      return 'Pages 144–147';
    case 'Magic Spell':
      return 'Pages 62–97';
    default:
      return 'Pages 123–147';
  }
}

/**
 * How many roster Equipment Slots an item occupies for a given fighter.
 * Heavy & Very Heavy Armour take 2 Armour slots, unless the fighter has Born in Harness (1 slot).
 * Ingredients in a Mage's Pouch and Weapon Upgrades take 0 main roster slots.
 */
export function getEffectiveSlotsRequired(
  eq: EquipmentRef,
  fighter: Fighter,
  rules: RulesDataset
): number {
  const eqType = getEffectiveEquipmentType(eq);
  if (eqType === 'Ingredient' || eqType === 'Upgrade') return 0;
  const baseSlots = eq.slotsRequired ?? 1;
  if (baseSlots === 2 && eqType === 'Armour') {
    const allSkills = getFighterAllSkillIds(fighter, rules);
    if (allSkills.includes('sk-born-in-harness')) {
      return 1;
    }
  }
  return baseSlots;
}

/**
 * Returns the list of main Equipment Slots available to a fighter:
 * - Standard (6 slots): Weapon 1, Weapon 2, Armour 1, Armour 2, Item, Special
 * - With Beast of Burden (8 slots): adds Special 2, Special 3
 */
export function getFighterMainEquipmentSlots(
  fighter: Fighter,
  rules: RulesDataset
): EquipmentSlot[] {
  const allSkills = getFighterAllSkillIds(fighter, rules);
  const hasBeastOfBurden = allSkills.includes('sk-beast-of-burden');
  const baseSlots: EquipmentSlot[] = [
    'Weapon 1',
    'Weapon 2',
    'Armour 1',
    'Armour 2',
    'Item',
    'Special',
  ];
  if (hasBeastOfBurden) {
    baseSlots.push('Special 2', 'Special 3');
  }
  return baseSlots;
}

/**
 * Returns which EquipmentSlot options are valid for a specific EquipmentRef on a given fighter.
 */
export function getValidSlotsForEquipment(
  eq: EquipmentRef,
  fighter: Fighter,
  rules: RulesDataset
): EquipmentSlot[] {
  const eqType = getEffectiveEquipmentType(eq);
  const allSkills = getFighterAllSkillIds(fighter, rules);
  const hasBeastOfBurden = allSkills.includes('sk-beast-of-burden');
  const specialSlots: EquipmentSlot[] = hasBeastOfBurden
    ? ['Special', 'Special 2', 'Special 3']
    : ['Special'];

  if (eqType === 'Ingredient') {
    return ["Mage's Pouch"];
  }
  if (eqType === 'Upgrade') {
    return ['Weapon Upgrade'];
  }
  if (eq.id === 'eq-silk-undershirt') {
    // Page 112: "May be Equipped as Armour, Item, or Special."
    return ['Armour 1', 'Armour 2', 'Item', ...specialSlots];
  }
  if (eqType === 'Weapon') {
    return ['Weapon 1', 'Weapon 2', ...specialSlots];
  }
  if (eqType === 'Armour') {
    const slotsReq = getEffectiveSlotsRequired(eq, fighter, rules);
    if (slotsReq === 2) {
      // Heavy / Very Heavy Armour (without Born in Harness) uses both Armour 1 & Armour 2
      return ['Armour 1'];
    }
    return ['Armour 1', 'Armour 2', ...specialSlots];
  }
  // Item
  return ['Item', ...specialSlots];
}

/**
 * Normalizes legacy slot names ('Main Hand', 'Off Hand', 'Ranged', etc.) to 2.0 slots if needed.
 */
export function normalizeEquipmentSlot(
  slot: EquipmentSlot,
  eq?: EquipmentRef
): EquipmentSlot {
  const valid2e: EquipmentSlot[] = [
    'Weapon 1',
    'Weapon 2',
    'Armour 1',
    'Armour 2',
    'Item',
    'Special',
    'Special 2',
    'Special 3',
    "Mage's Pouch",
    'Weapon Upgrade',
  ];
  if (valid2e.includes(slot)) return slot;
  if (eq) {
    const t = getEffectiveEquipmentType(eq);
    if (t === 'Ingredient') return "Mage's Pouch";
    if (t === 'Upgrade') return 'Weapon Upgrade';
    if (t === 'Weapon') return slot === 'Off Hand' || slot === 'Ranged' ? 'Weapon 2' : 'Weapon 1';
    if (t === 'Armour') return eq.isShield || slot === 'Off Hand' ? 'Armour 2' : 'Armour 1';
    return 'Item';
  }
  switch (slot) {
    case 'Main Hand':
    case 'Two-Handed':
      return 'Weapon 1';
    case 'Ranged':
      return 'Weapon 2';
    case 'Armour':
      return 'Armour 1';
    case 'Off Hand':
      return 'Armour 2';
    case 'Accessory':
      return 'Item';
    case 'Consumable':
      return 'Special';
    default:
      return 'Item';
  }
}

export interface FighterSlotOccupancy {
  maxMainSlots: number; // 6 (or 8 with Beast of Burden)
  usedMainSlots: number;
  slotMap: Record<string, EquippedOrStashedItem | null>;
  twoSlotArmourItem: EquippedOrStashedItem | null; // Heavy/Very Heavy Armour occupying Armour 1 + Armour 2
  magesPouchCount: number; // Number of Mage's Pouches carried
  ingredientsCarried: EquippedOrStashedItem[];
  maxIngredients: number; // 6 per Mage's Pouch
  weaponUpgrades: EquippedOrStashedItem[];
}

/**
 * Computes the fighter's current 2.0 Equipment Slot occupancy.
 */
export function getFighterSlotOccupancy(
  fighter: Fighter,
  warbandInventory: EquippedOrStashedItem[],
  rules: RulesDataset
): FighterSlotOccupancy {
  const mainSlots = getFighterMainEquipmentSlots(fighter, rules);
  const slotMap: Record<string, EquippedOrStashedItem | null> = {};
  for (const s of mainSlots) {
    slotMap[s] = null;
  }

  const equipped = warbandInventory.filter(
    (i) => i.assignedFighterId === fighter.id && !i.isConsumed
  );

  let usedMainSlots = 0;
  let twoSlotArmourItem: EquippedOrStashedItem | null = null;
  let magesPouchCount = 0;
  const ingredientsCarried: EquippedOrStashedItem[] = [];
  const weaponUpgrades: EquippedOrStashedItem[] = [];

  for (const item of equipped) {
    const eq = rules.equipment.find((e) => e.id === item.equipmentId);
    if (!eq) continue;
    const eqType = getEffectiveEquipmentType(eq);
    if (eq.id === 'eq-mages-pouch') {
      magesPouchCount += 1;
    }
    if (eqType === 'Ingredient') {
      ingredientsCarried.push(item);
      continue;
    }
    if (eqType === 'Upgrade') {
      weaponUpgrades.push(item);
      continue;
    }

    const slotsReq = getEffectiveSlotsRequired(eq, fighter, rules);
    usedMainSlots += slotsReq;

    const normSlot = normalizeEquipmentSlot(item.slot, eq);
    if (slotsReq === 2 && eqType === 'Armour') {
      twoSlotArmourItem = item;
      slotMap['Armour 1'] = item;
      slotMap['Armour 2'] = item;
    } else if (slotMap[normSlot] === null) {
      slotMap[normSlot] = item;
    } else {
      // Find first compatible empty slot for display
      const validSlots = getValidSlotsForEquipment(eq, fighter, rules);
      const fallback = validSlots.find((s) => slotMap[s] === null);
      if (fallback) {
        slotMap[fallback] = item;
      }
    }
  }

  return {
    maxMainSlots: mainSlots.length,
    usedMainSlots,
    slotMap,
    twoSlotArmourItem,
    magesPouchCount,
    ingredientsCarried,
    maxIngredients: magesPouchCount * 6,
    weaponUpgrades,
  };
}

/**
 * Finds the best available EquipmentSlot for an item on a fighter, or null if none is free.
 */
export function findAvailableSlotForEquipment(
  eq: EquipmentRef,
  fighter: Fighter,
  warbandInventory: EquippedOrStashedItem[],
  rules: RulesDataset,
  preferredSlot?: EquipmentSlot
): EquipmentSlot | null {
  const eqType = getEffectiveEquipmentType(eq);
  if (eqType === 'Ingredient') return "Mage's Pouch";
  if (eqType === 'Upgrade') return 'Weapon Upgrade';

  const occ = getFighterSlotOccupancy(fighter, warbandInventory, rules);
  const validSlots = getValidSlotsForEquipment(eq, fighter, rules);
  const slotsReq = getEffectiveSlotsRequired(eq, fighter, rules);

  // If stackable, check if fighter already carries a stack of this item
  if (isEquipmentStackable(eq)) {
    if (
      preferredSlot &&
      validSlots.includes(preferredSlot) &&
      occ.slotMap[preferredSlot]?.equipmentId === eq.id
    ) {
      return preferredSlot;
    }
    for (const s of validSlots) {
      if (occ.slotMap[s]?.equipmentId === eq.id) {
        return s;
      }
    }
    const existingAny = warbandInventory.find(
      (i) =>
        i.assignedFighterId === fighter.id &&
        !i.isConsumed &&
        i.equipmentId === eq.id
    );
    if (existingAny) {
      return normalizeEquipmentSlot(existingAny.slot, eq);
    }
  }

  if (slotsReq === 2 && eqType === 'Armour') {
    if (occ.slotMap['Armour 1'] === null && occ.slotMap['Armour 2'] === null) {
      return 'Armour 1';
    }
    return null;
  }

  if (preferredSlot && validSlots.includes(preferredSlot) && occ.slotMap[preferredSlot] === null) {
    return preferredSlot;
  }

  for (const s of validSlots) {
    if (occ.slotMap[s] === null) {
      return s;
    }
  }
  return null;
}

/**
 * Validates whether `eq` can be equipped on `fighter` in `warband` according to all Burrows & Badgers 2nd Edition rules:
 * - Slot availability & Multi-slot Armour (Heavy / Very Heavy Armour = 2 Armour slots unless Born in Harness)
 * - Co-equipping incompatibilities (Two-handed/Polearm vs Shields/Torch/Lantern/Blind Dust/Tangle Net; Torch vs Bows/Crossbows/Black Powder; Father of Swords vs Armour; Ring of Resistance vs Talisman/Lucky Charm/Healing Potion; max 1 Body Armour; max 1 Shield)
 * - Skill & Stat requirements (War Bow requires Strong 2, Heavy Crossbow requires Strong 1, Cheirosiphon requires Fearless, Dispel Scroll / Arcane Tome / Haldyn's Staff / Tome of All-knowing require Magic-user)
 * - Species & Allegiance rules (Mist Ghast cannot carry extra equipment; Armless cannot use Weapons; Kindred Travel Light; Wildlings Stay Pure; Inspiring Object & Bagpipes max 1 per Band; Ingredients require Mage's Pouch up to 6)
 */
export function validateEquipmentForFighter(
  eq: EquipmentRef,
  fighter: Fighter,
  warband: Warband,
  rules: RulesDataset,
  requestedSlot?: EquipmentSlot
): { valid: boolean; reason?: string; suggestedSlot?: EquipmentSlot } {
  const species = rules.species.find((s) => s.id === fighter.speciesId);
  const allegiance = rules.allegiances.find((a) => a.id === warband.allegianceId);
  const allSkillIds = getFighterAllSkillIds(fighter, rules);
  const eqType = getEffectiveEquipmentType(eq);

  const equippedItems = warband.inventory.filter(
    (i) => i.assignedFighterId === fighter.id && !i.isConsumed
  );
  const equippedRefs = equippedItems
    .map((i) => rules.equipment.find((e) => e.id === i.equipmentId))
    .filter((e): e is EquipmentRef => Boolean(e));

  // 1. Mist Ghast restriction (Page 57)
  if (fighter.speciesId.startsWith('sp-mist-ghast')) {
    return {
      valid: false,
      reason:
        'Mist Ghasts count as armed with a One-handed Weapon and cannot carry any other Equipment (Page 57).',
    };
  }

  // 2. Armless restriction (Page 146)
  if (allSkillIds.includes('sk-armless') && eqType === 'Weapon') {
    return {
      valid: false,
      reason: `${species?.name || 'This beast'} has the Innate Skill Armless and cannot use any Weapons (Page 146).`,
    };
  }

  // 3. Allegiance restrictions (Kindred Travel Light, Page 52; Wildlings Stay Pure, Page 54)
  if (allegiance?.id === 'al-kindred') {
    if (
      eq.id === 'eq-heavy-armour' ||
      eq.id === 'eq-very-heavy-armour' ||
      eq.id === 'eq-heavy-shield' ||
      eq.id === 'eq-heavy-crossbow' ||
      eq.isBlackPowder
    ) {
      return {
        valid: false,
        reason:
          'Kindred Special Rule (Travel Light, Page 52): No model in a Kindred Band may use Heavy Armour, Very Heavy Armour, Heavy Shield, Heavy Crossbow, or Black Powder weapons.',
      };
    }
  }
  if (allegiance?.id === 'al-wildlings' && eq.isBlackPowder) {
    return {
      valid: false,
      reason:
        'Wildlings Special Rule (Stay Pure, Page 54): No model in a Wildling Band may use Black Powder weapons.',
    };
  }

  // 4. Band-wide uniqueness (Inspiring Object, Page 113; Bagpipes, Page 60)
  if (eq.maxOnePerBand || eq.id === 'eq-inspiring-object' || eq.id === 'eq-bagpipes') {
    const alreadyInBand = warband.inventory.some(
      (i) =>
        i.equipmentId === eq.id &&
        i.assignedFighterId !== null &&
        !i.isConsumed
    );
    if (alreadyInBand) {
      return {
        valid: false,
        reason: `Only one ${eq.name} is permitted per Band.`,
      };
    }
  }

  // 5. Skill, Stat & Magic-user prerequisites
  if (eq.requiresStrongLevel !== undefined && eq.requiresStrongLevel > 0) {
    const netStrong = getFighterNetStrongLevel(fighter, rules);
    if (netStrong < eq.requiresStrongLevel) {
      return {
        valid: false,
        reason: `Requires at least Strong (${eq.requiresStrongLevel}) to use (${fighter.name} currently has Strong (${Math.max(0, netStrong)})).`,
      };
    }
  }

  if (eq.requiresSkillId) {
    if (!allSkillIds.includes(eq.requiresSkillId)) {
      const reqSk = rules.skillsAndSpells.find((s) => s.id === eq.requiresSkillId);
      return {
        valid: false,
        reason: `Requires the ${reqSk?.name || eq.requiresSkillId} Skill before being equipped.`,
      };
    }
  }

  if (eq.requiresMagicUser) {
    const isMage =
      Boolean(fighter.isMagicUser) ||
      fighter.learnedSpellIds.length > 0 ||
      Boolean(fighter.magicalArchetypes && fighter.magicalArchetypes.length > 0);
    if (!isMage) {
      return {
        valid: false,
        reason: `${eq.name} may only be used by Magic-users.`,
      };
    }
  }

  // 6. Magical Ingredients require Mage's Pouch (up to 6 Ingredients per Pouch, Page 110)
  const occ = getFighterSlotOccupancy(fighter, warband.inventory, rules);
  if (eqType === 'Ingredient') {
    if (occ.magesPouchCount === 0) {
      return {
        valid: false,
        reason:
          "Magical Ingredients must be carried in a Mage's Pouch (Page 110). Equip a Mage's Pouch first.",
      };
    }
    if (occ.ingredientsCarried.length >= occ.maxIngredients) {
      return {
        valid: false,
        reason: `Mage's Pouch is full (${occ.ingredientsCarried.length}/${occ.maxIngredients} Ingredients).`,
      };
    }
    return { valid: true, suggestedSlot: "Mage's Pouch" };
  }

  // 7. Weapon Upgrades require at least 1 Weapon equipped
  if (eqType === 'Upgrade') {
    const hasWeapon = equippedRefs.some((r) => getEffectiveEquipmentType(r) === 'Weapon');
    if (!hasWeapon) {
      return {
        valid: false,
        reason: 'Weapon Upgrades must be applied to an equipped Weapon.',
      };
    }
    return { valid: true, suggestedSlot: 'Weapon Upgrade' };
  }

  // 8. Co-equipping incompatibilities
  const hasTwoHandedOrPolearm = equippedRefs.some(
    (r) =>
      r.isTwoHandedOrPolearm ||
      r.id === 'eq-two-handed' ||
      r.id === 'eq-pole-arm' ||
      r.id === 'eq-relic-axe-slaughter' ||
      r.id === 'eq-relic-father-of-swords'
  );
  const isNewTwoHandedOrPolearm = Boolean(
    eq.isTwoHandedOrPolearm ||
      eq.id === 'eq-two-handed' ||
      eq.id === 'eq-pole-arm' ||
      eq.id === 'eq-relic-axe-slaughter' ||
      eq.id === 'eq-relic-father-of-swords'
  );

  const hasShield = equippedRefs.some(
    (r) =>
      r.isShield ||
      r.id === 'eq-buckler' ||
      r.id === 'eq-light-shield' ||
      r.id === 'eq-heavy-shield' ||
      r.id === 'eq-relic-shield-attraction'
  );
  const isNewShield = Boolean(
    eq.isShield ||
      eq.id === 'eq-buckler' ||
      eq.id === 'eq-light-shield' ||
      eq.id === 'eq-heavy-shield' ||
      eq.id === 'eq-relic-shield-attraction'
  );

  const hasBodyArmour = equippedRefs.some(
    (r) =>
      r.isBodyArmour ||
      r.id === 'eq-light-armour' ||
      r.id === 'eq-heavy-armour' ||
      r.id === 'eq-very-heavy-armour' ||
      r.id === 'eq-relic-armour-ultimate-protection'
  );
  const isNewBodyArmour = Boolean(
    eq.isBodyArmour ||
      eq.id === 'eq-light-armour' ||
      eq.id === 'eq-heavy-armour' ||
      eq.id === 'eq-very-heavy-armour' ||
      eq.id === 'eq-relic-armour-ultimate-protection'
  );

  if (isNewBodyArmour && hasBodyArmour) {
    return {
      valid: false,
      reason: 'A model cannot wear more than one suit of body Armour at the same time.',
    };
  }

  if (isNewShield && hasShield) {
    return {
      valid: false,
      reason: 'A model cannot carry more than one Shield at the same time.',
    };
  }

  if ((isNewTwoHandedOrPolearm && hasShield) || (isNewShield && hasTwoHandedOrPolearm)) {
    return {
      valid: false,
      reason:
        'Two-handed Weapons and Polearms cannot be used with a Buckler, Light Shield, or Heavy Shield (Pages 99 & 106).',
    };
  }

  // The Father of Swords: cannot use any Armour at all (Page 118)
  const hasFatherOfSwords = equippedRefs.some((r) => r.id === 'eq-relic-father-of-swords');
  if (
    (eq.id === 'eq-relic-father-of-swords' &&
      equippedRefs.some((r) => getEffectiveEquipmentType(r) === 'Armour')) ||
    (hasFatherOfSwords && eqType === 'Armour')
  ) {
    return {
      valid: false,
      reason: 'The Father of Swords: The wielder cannot use any Armour or Shields at all (Page 118).',
    };
  }

  // Torch incompatibilities (Page 111)
  const torchIncompatibleIds = new Set([
    'eq-two-handed',
    'eq-pole-arm',
    'eq-relic-axe-slaughter',
    'eq-relic-father-of-swords',
    'eq-buckler',
    'eq-light-shield',
    'eq-heavy-shield',
    'eq-relic-shield-attraction',
    'eq-bow',
    'eq-war-bow',
    'eq-relic-masters-bow',
    'eq-light-crossbow',
    'eq-heavy-crossbow',
    'eq-caliver',
    'eq-blunderbuss',
  ]);
  const hasTorch = equippedRefs.some((r) => r.id === 'eq-torch');
  if (eq.id === 'eq-torch') {
    const conflict = equippedRefs.find(
      (r) => torchIncompatibleIds.has(r.id) || r.isTwoHandedOrPolearm || r.isShield
    );
    if (conflict) {
      return {
        valid: false,
        reason: `A Torch cannot be used with ${conflict.name} (Page 111: incompatible with Two-handed Weapons, Polearms, Shields, Bows, Crossbows, Calivers, and Blunderbusses).`,
      };
    }
  } else if (hasTorch && (torchIncompatibleIds.has(eq.id) || isNewTwoHandedOrPolearm || isNewShield)) {
    return {
      valid: false,
      reason: `${eq.name} cannot be used while carrying a Torch (Page 111).`,
    };
  }

  // Lantern incompatibilities (Page 111: no 2H, Polearm, or Shields)
  const hasLantern = equippedRefs.some((r) => r.id === 'eq-lantern');
  if (
    (eq.id === 'eq-lantern' && (hasTwoHandedOrPolearm || hasShield)) ||
    (hasLantern && (isNewTwoHandedOrPolearm || isNewShield))
  ) {
    return {
      valid: false,
      reason:
        'A Lantern cannot be used with Two-handed Weapons, Polearms, Bucklers, Light Shields, or Heavy Shields (Page 111).',
    };
  }

  // Blind Dust incompatibilities (Page 112: no 2H, Polearm, or Shields)
  const hasBlindDust = equippedRefs.some((r) => r.id === 'eq-blind-dust');
  if (
    (eq.id === 'eq-blind-dust' && (hasTwoHandedOrPolearm || hasShield)) ||
    (hasBlindDust && (isNewTwoHandedOrPolearm || isNewShield))
  ) {
    return {
      valid: false,
      reason:
        'Blind Dust cannot be used with a Two-handed Weapon, a Polearm, or any Shields (Page 112).',
    };
  }

  // Tangle Net incompatibilities (Page 114: no 2H or Polearm)
  const hasTangleNet = equippedRefs.some((r) => r.id === 'eq-tangle-net');
  if (
    (eq.id === 'eq-tangle-net' && hasTwoHandedOrPolearm) ||
    (hasTangleNet && isNewTwoHandedOrPolearm)
  ) {
    return {
      valid: false,
      reason: 'A Tangle Net cannot be used with a Two-handed Weapon or a Polearm (Page 114).',
    };
  }

  // The Ring of Resistance incompatibilities (Page 119: no Talismans, Lucky Charms, or Healing Potions)
  const ringForbiddenIds = new Set([
    'eq-talisman',
    'eq-shielding-talisman',
    'eq-mirroring-talisman',
    'eq-lucky-charm',
    'eq-healing-potion',
  ]);
  const hasRingOfResistance = equippedRefs.some((r) => r.id === 'eq-relic-ring-resistance');
  if (eq.id === 'eq-relic-ring-resistance') {
    const conflict = equippedRefs.find((r) => ringForbiddenIds.has(r.id));
    if (conflict) {
      return {
        valid: false,
        reason: `The Ring of Resistance bearer cannot benefit from ${conflict.name} (Page 119).`,
      };
    }
  } else if (hasRingOfResistance && ringForbiddenIds.has(eq.id)) {
    return {
      valid: false,
      reason:
        'A model wearing The Ring of Resistance cannot benefit from Talismans, Lucky Charms, or Healing Potions (Page 119).',
    };
  }

  // 9. Slot Capacity & Type Validation (Page 98 & 105–106)
  // If item is stackable (e.g. Broadhead/Bodkin Arrows, Lead Slingshot, Superior Black Powder, Poisons)
  // and the fighter already carries a stack of it, adding to that stack uses 0 additional slots.
  if (isEquipmentStackable(eq)) {
    const existingStack = equippedItems.find((i) => i.equipmentId === eq.id);
    if (existingStack) {
      return {
        valid: true,
        suggestedSlot: normalizeEquipmentSlot(existingStack.slot, eq),
      };
    }
  }

  const slotsReq = getEffectiveSlotsRequired(eq, fighter, rules);
  if (occ.usedMainSlots + slotsReq > occ.maxMainSlots) {
    return {
      valid: false,
      reason: `Not enough free Equipment Slots (${occ.usedMainSlots}/${occ.maxMainSlots} used; ${eq.name} requires ${slotsReq} slot${
        slotsReq > 1 ? 's' : ''
      }).`,
    };
  }

  if (slotsReq === 2 && eqType === 'Armour') {
    if (occ.slotMap['Armour 1'] !== null || occ.slotMap['Armour 2'] !== null) {
      return {
        valid: false,
        reason: `${eq.name} requires both Armour slots (Armour 1 & Armour 2) unless the model has Born in Harness. Move any Shield or Silk Undershirt to the Special slot first.`,
      };
    }
    return { valid: true, suggestedSlot: 'Armour 1' };
  }

  const validSlotsForType = getValidSlotsForEquipment(eq, fighter, rules);
  if (requestedSlot && validSlotsForType.includes(requestedSlot)) {
    if (occ.slotMap[requestedSlot] === null) {
      return { valid: true, suggestedSlot: requestedSlot };
    }
  }

  const autoSlot = findAvailableSlotForEquipment(
    eq,
    fighter,
    warband.inventory,
    rules,
    requestedSlot
  );
  if (!autoSlot) {
    return {
      valid: false,
      reason: `No valid ${eqType} or Special slot is available for ${eq.name} (valid slots: ${validSlotsForType.join(
        ', '
      )}).`,
    };
  }

  return { valid: true, suggestedSlot: autoSlot };
}

export function computeFighterStats(
  fighter: Fighter,
  rules: RulesDataset,
  warbandInventory?: EquippedOrStashedItem[]
): {
  base: StatProfile;
  effective: StatProfile;
  level: number;
  totalArmour: number;
  nimblenessEquipmentPenalty: number;
  totalEquipmentCost: number;
  totalFighterValue: number;
} {
  const species = rules.species.find((s) => s.id === fighter.speciesId);
  const base: StatProfile = species?.stats ?? {
    move: 'D8',
    strike: 'D6',
    block: 'D6',
    ranged: 'D6',
    nimbleness: 'D6',
    concealment: 'D6',
    awareness: 'D6',
    fortitude: 'D6',
    presence: 'D6',
    wounds: 17,
  };

  // Sum injury stat penalties & level adjustments
  const injuryPenalties = {
    move: 0,
    strike: 0,
    block: 0,
    ranged: 0,
    nimbleness: 0,
    concealment: 0,
    awareness: 0,
    fortitude: 0,
    presence: 0,
    wounds: 0,
  };
  let injuryLevelDelta = 0;

  for (const injId of fighter.injuryIds) {
    const inj = rules.injuries.find((i) => i.id === injId);
    if (inj?.statPenalty) {
      injuryPenalties.move += inj.statPenalty.move ?? 0;
      injuryPenalties.strike += inj.statPenalty.strike ?? 0;
      injuryPenalties.block += inj.statPenalty.block ?? 0;
      injuryPenalties.ranged += inj.statPenalty.ranged ?? 0;
      injuryPenalties.nimbleness += inj.statPenalty.nimbleness ?? 0;
      injuryPenalties.concealment += inj.statPenalty.concealment ?? 0;
      injuryPenalties.awareness += inj.statPenalty.awareness ?? 0;
      injuryPenalties.fortitude += inj.statPenalty.fortitude ?? 0;
      injuryPenalties.presence += inj.statPenalty.presence ?? 0;
      injuryPenalties.wounds += inj.statPenalty.wounds ?? 0;
    }
    if (inj?.levelDelta) {
      injuryLevelDelta += inj.levelDelta;
    }
  }

  const mods = fighter.statModifiers;
  const effective: StatProfile = {
    move: stepDie(base.move, (mods.move ?? 0) + injuryPenalties.move),
    strike: stepDie(base.strike, (mods.strike ?? 0) + injuryPenalties.strike),
    block: stepDie(base.block, (mods.block ?? 0) + injuryPenalties.block),
    ranged: stepDie(base.ranged, (mods.ranged ?? 0) + injuryPenalties.ranged),
    nimbleness: stepDie(
      base.nimbleness,
      (mods.nimbleness ?? 0) + injuryPenalties.nimbleness
    ),
    concealment: stepDie(
      base.concealment ?? 'D6',
      (mods.concealment ?? 0) + injuryPenalties.concealment
    ),
    awareness: stepDie(
      base.awareness ?? 'D6',
      (mods.awareness ?? 0) + injuryPenalties.awareness
    ),
    fortitude: stepDie(
      base.fortitude,
      (mods.fortitude ?? 0) + injuryPenalties.fortitude
    ),
    presence: stepDie(
      base.presence ?? 'D6',
      (mods.presence ?? 0) + injuryPenalties.presence
    ),
    wounds: Math.max(1, (base.wounds || 17) + (mods.wounds ?? 0) + injuryPenalties.wounds),
  };

  // Calculate 2e Model Level:
  // Small = 1, Medium = 2, Large = 3, Massive = 4 (or species.baseLevel)
  const sizeBaseLevel =
    species?.baseLevel ??
    (species?.size === 'Small'
      ? 1
      : species?.size === 'Medium'
      ? 2
      : species?.size === 'Large'
      ? 3
      : 4);

  const level = Math.max(
    1,
    sizeBaseLevel + fighter.advancesCount + injuryLevelDelta
  );

  // Calculate Armour Tough & Nimbleness roll penalties from equipped gear
  let totalArmour = 0;
  let nimblenessEquipmentPenalty = 0;
  let totalEquipmentCost = 0;
  const allSkills = getFighterAllSkillIds(fighter, rules);
  const hasBornInHarness = allSkills.includes('sk-born-in-harness');

  if (warbandInventory) {
    const equipped = warbandInventory.filter(
      (i) => i.assignedFighterId === fighter.id && !i.isConsumed
    );
    for (const item of equipped) {
      totalEquipmentCost += item.purchaseCost;
      const eq = rules.equipment.find((e) => e.id === item.equipmentId);
      if (!eq) continue;
      if (eq.armourValue) {
        totalArmour += eq.armourValue;
      }
      if (eq.nimblenessPenalty) {
        const isArmourOrShield =
          getEffectiveEquipmentType(eq) === 'Armour' || eq.isBodyArmour || eq.isShield;
        if (!(hasBornInHarness && isArmourOrShield)) {
          nimblenessEquipmentPenalty += eq.nimblenessPenalty;
        }
      }
    }
  }

  return {
    base,
    effective,
    level,
    totalArmour,
    nimblenessEquipmentPenalty,
    totalEquipmentCost,
    totalFighterValue: fighter.recruitmentCost + totalEquipmentCost,
  };
}

/**
 * Official Burrows & Badgers 2nd Edition Band Rating (page 41):
 * Sum of Levels of all active/recovering models in the Band,
 * plus +2 for each Relic / Special Magic Equipment item carried.
 */
export function calculateWarbandRating(warband: Warband, rules: RulesDataset): number {
  const activeFighters = warband.fighters.filter(
    (f) => f.status === 'Active' || f.status === 'Miss Next Game'
  );
  const totalLevels = activeFighters.reduce((sum, f) => {
    const { level } = computeFighterStats(f, rules);
    return sum + level;
  }, 0);

  const magicRelicBonus = warband.inventory.reduce((sum, item) => {
    if (!item.assignedFighterId || item.isConsumed) return sum;
    const eq = rules.equipment.find((e) => e.id === item.equipmentId);
    return sum + (eq?.rarity === 'Relic' ? 2 : 0);
  }, 0);

  return totalLevels + magicRelicBonus;
}

/**
 * Total Penny Value of the Band (models + equipped gear + stash + treasury)
 */
export function calculateWarbandPennyValue(warband: Warband): number {
  const fightersCost = warband.fighters
    .filter((f) => f.status === 'Active' || f.status === 'Miss Next Game')
    .reduce((sum, f) => sum + f.recruitmentCost, 0);
  const gearCost = warband.inventory
    .filter((i) => !i.isConsumed)
    .reduce((sum, i) => sum + i.purchaseCost, 0);
  return fightersCost + gearCost + warband.treasuryPennies;
}

// Official Burrows & Badgers 2nd Edition Experience Advance thresholds (Step 5 Post-Battle: 5 XP per Advance)
export const XP_ADVANCE_THRESHOLDS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
];

export function getEarnedAdvancesCount(xp: number): number {
  return Math.floor(Math.max(0, xp) / 5);
}

export function getNextXpThreshold(xp: number): number | null {
  return (Math.floor(Math.max(0, xp) / 5) + 1) * 5;
}

// Official Burrows & Badgers 2nd Edition Per-Model Fate Point Rules (Rulebook Page 36 & Page 151)
// Leaders start with 3 Fate points, Seconds start with 2 Fate points, all other models start with 1 Fate point.
// A model can have a maximum of 5 Fate points at any time; any extra Fate points earned are lost.
export const MAX_FIGHTER_FATE_POINTS = 5;

export function getStartingFatePointsForRole(role: FighterRole): number {
  switch (role) {
    case 'Leader':
      return 3;
    case 'Second':
      return 2;
    default:
      return 1;
  }
}

export function getFighterFatePoints(fighter: Fighter): number {
  const val = fighter.fatePoints ?? getStartingFatePointsForRole(fighter.role);
  return Math.max(0, Math.min(MAX_FIGHTER_FATE_POINTS, val));
}

export type StatKey =
  | 'move'
  | 'strike'
  | 'block'
  | 'ranged'
  | 'nimbleness'
  | 'concealment'
  | 'awareness'
  | 'fortitude'
  | 'presence';

export interface StatModifierEntry {
  id: string;
  source: string;
  category: 'Skill' | 'Equipment' | 'Wounds' | 'Condition' | 'Situational';
  value: number;
  unit?: 'roll' | 'inches' | 'strong' | 'tough' | 'wounds' | 'note';
  isSituational?: boolean;
  isStackable?: boolean;
  defaultChecked?: boolean;
  note?: string;
}

export interface WeaponStrongSummary {
  weaponName: string;
  weaponType: 'Melee' | 'Ranged';
  netStrong: number;
  label: string;
  ignoresModelStrong: boolean;
  note?: string;
}

export interface FighterStrongBreakdown {
  skillStrong: number;
  skillWeak: number;
  conditionStrong: number;
  netBaseStrong: number;
  baseLabel: string;
  primaryMeleeNetStrong: number;
  primaryMeleeLabel: string;
  primaryMeleeWeaponName: string;
  weapons: WeaponStrongSummary[];
  entries: StatModifierEntry[];
}

export interface FighterToughBreakdown {
  skillTough: number;
  skillDelicate: number;
  armourTough: number;
  conditionTough: number;
  netTough: number;
  netUnarmouredTough: number;
  label: string;
  shortBadgeLabel: string;
  entries: StatModifierEntry[];
}

export interface SingleStatBreakdown {
  statKey: StatKey;
  label: string;
  shortLabel: string;
  baseDie: DiceValue;
  effectiveDie: DiceValue | 'D3';
  dieOverriddenBy?: string;
  advanceSteps: number;
  injurySteps: number;
  permanentRollMod: number;
  activeMatchRollMod: number;
  moveInchesBase?: number;
  moveInchesMod?: number;
  cannotRollReason?: string;
  rerollNotes: string[];
  activeEntries: StatModifierEntry[];
  situationalEntries: StatModifierEntry[];
}

export interface FighterCombatBreakdown {
  strong: FighterStrongBreakdown;
  tough: FighterToughBreakdown;
  stats: Record<StatKey, SingleStatBreakdown>;
  woundPenalty: number;
  woundsTaken: number;
  maxWounds: number;
  woundPenaltyIgnoredBy?: string;
}

function formatStrongWeakLabel(net: number): string {
  if (net > 0) return `Strong (${net})`;
  if (net < 0) return `Weak (${Math.abs(net)})`;
  return 'Net 0';
}

function formatToughDelicateLabel(net: number): string {
  if (net > 0) return `Tough (${net})`;
  if (net < 0) return `Delicate (${Math.abs(net)})`;
  return 'Tough (0)';
}

/**
 * Computes a complete itemized breakdown of a fighter's:
 * 1) Net Strong / Weak (Base + per equipped Melee & Ranged weapon + Conditions)
 * 2) Net Tough / Delicate (Innate/Learned Tough + Armour/Shield Tough - Delicate + Situational)
 * 3) All 9 Main Stats (Base -> Effective Die, Equipment, Skills, Wounds, Status Conditions, and toggleable Situational modifiers)
 */
export function computeFighterCombatBreakdown(
  fighter: Fighter,
  rules: RulesDataset,
  warbandInventory: EquippedOrStashedItem[] = [],
  includeMatchState = true
): FighterCombatBreakdown {
  const species = rules.species.find((s) => s.id === fighter.speciesId);
  const { base, effective } = computeFighterStats(fighter, rules, warbandInventory);
  const allSkills = getFighterAllSkillIds(fighter, rules);

  const equippedItems = warbandInventory.filter(
    (i) => i.assignedFighterId === fighter.id && !i.isConsumed
  );
  const equippedPairs = equippedItems
    .map((item) => {
      const eq = rules.equipment.find((e) => e.id === item.equipmentId);
      return eq ? { item, eq } : null;
    })
    .filter((p): p is { item: EquippedOrStashedItem; eq: EquipmentRef } => Boolean(p));

  const parseTier = (ids: string[], prefix: string): number => {
    let maxTier = 0;
    for (const id of ids) {
      if (id.startsWith(prefix)) {
        const n = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(n) && n > maxTier) maxTier = n;
      }
    }
    return maxTier;
  };

  // =========================================================================
  // 1. STRONG / WEAK BREAKDOWN
  // =========================================================================
  const strongEntries: StatModifierEntry[] = [];
  const innateStrong = parseTier(species?.innateSkillIds ?? [], 'sk-strong-');
  const learnedStrong = parseTier(fighter.learnedSkillIds, 'sk-strong-');
  const hasWildlingCumulativeStrong =
    Boolean(fighter.usedAllegianceBonus) &&
    fighter.learnedSkillIds.includes('sk-strong-1') &&
    innateStrong > 0 &&
    learnedStrong === 1;

  let skillStrong = 0;
  if (hasWildlingCumulativeStrong) {
    skillStrong = innateStrong + 1;
    strongEntries.push({
      id: 'str-innate',
      source: `Innate (${species?.name || 'Species'}): Strong (${innateStrong})`,
      category: 'Skill',
      value: innateStrong,
      unit: 'strong',
    });
    strongEntries.push({
      id: 'str-wildling',
      source: 'Born to be Wild (Allegiance): Strong (1)',
      category: 'Skill',
      value: 1,
      unit: 'strong',
    });
  } else {
    skillStrong = Math.max(innateStrong, learnedStrong);
    if (skillStrong > 0) {
      strongEntries.push({
        id: 'str-skill',
        source: `${
          innateStrong >= learnedStrong
            ? `Innate (${species?.name || 'Species'})`
            : 'Learned Skill'
        }: Strong (${skillStrong})`,
        category: 'Skill',
        value: skillStrong,
        unit: 'strong',
      });
    }
  }

  const innateWeak = parseTier(species?.innateSkillIds ?? [], 'sk-weak-');
  const learnedWeak = parseTier(fighter.learnedSkillIds, 'sk-weak-');
  const injuryWeak = fighter.injuryIds.filter((id) => id === 'inj-maj-17-torn-tendon').length;
  const skillWeak = innateWeak + learnedWeak + injuryWeak;

  if (innateWeak > 0) {
    strongEntries.push({
      id: 'wk-innate',
      source: `Innate (${species?.name || 'Species'}): Weak (${innateWeak})`,
      category: 'Skill',
      value: -innateWeak,
      unit: 'strong',
    });
  }
  if (learnedWeak > 0) {
    strongEntries.push({
      id: 'wk-learned',
      source: `${
        fighter.isMagicUser || fighter.learnedSpellIds.length > 0
          ? 'Magic-user Spells'
          : 'Skill'
      }: Weak (${learnedWeak})`,
      category: 'Skill',
      value: -learnedWeak,
      unit: 'strong',
    });
  }
  if (injuryWeak > 0) {
    strongEntries.push({
      id: 'wk-injury',
      source: `Major Injury (Torn Tendon): Weak (${injuryWeak})`,
      category: 'Skill',
      value: -injuryWeak,
      unit: 'strong',
    });
  }

  const hasBerserk = includeMatchState && fighter.conditions.includes('Berserk');
  const conditionStrong = hasBerserk ? 2 : 0;
  if (hasBerserk) {
    strongEntries.push({
      id: 'str-berserk',
      source: 'Condition (Berserk): Strong (2)',
      category: 'Condition',
      value: 2,
      unit: 'strong',
    });
  }

  const netBaseStrong = skillStrong - skillWeak + conditionStrong;

  // Evaluate equipped weapons for Strong
  const hasBroadheads = equippedPairs.some((p) => p.eq.id === 'eq-broadhead-arrows');
  const hasLeadSlingshot = equippedPairs.some((p) => p.eq.id === 'eq-lead-slingshot');
  const hasSuperiorBlackPowder = equippedPairs.some(
    (p) => p.eq.id === 'eq-superior-black-powder'
  );
  const hasMalleus = equippedPairs.some((p) => p.eq.id === 'eq-malleus-maleficarum');

  const meleeWeapons = equippedPairs.filter(
    (p) => getEffectiveEquipmentType(p.eq) === 'Weapon' && p.eq.category !== 'Ranged Weapon' && !p.eq.range
  );
  const rangedWeapons = equippedPairs.filter(
    (p) =>
      getEffectiveEquipmentType(p.eq) === 'Weapon' &&
      (p.eq.category === 'Ranged Weapon' || Boolean(p.eq.range))
  );

  const getMeleeWeaponStrongBonus = (eqId: string): { bonus: number; note?: string } => {
    switch (eqId) {
      case 'eq-two-handed':
        return { bonus: 3, note: 'Counts as Strong (3)' };
      case 'eq-pole-arm':
        return { bonus: 1, note: 'Counts as Strong (1)' };
      case 'eq-rondel-dagger':
        return { bonus: 1, note: 'Strong (1), ignores Armour Tough' };
      case 'eq-relic-axe-slaughter':
        return { bonus: 3, note: 'Strong (3)' };
      case 'eq-relic-father-of-swords':
        return { bonus: 3, note: 'Strong (3), ignores Armour/Enchantment Tough' };
      default:
        return { bonus: 0 };
    }
  };

  const weaponSummaries: WeaponStrongSummary[] = [];

  if (meleeWeapons.length === 0) {
    const isMistGhast = fighter.speciesId.startsWith('sp-mist-ghast');
    weaponSummaries.push({
      weaponName: isMistGhast
        ? 'Spectral Claws (Mist Ghast 1H Weapon)'
        : allSkills.includes('sk-unarmed-fighter')
        ? 'Unarmed (Unarmed Fighter)'
        : 'Unarmed',
      weaponType: 'Melee',
      netStrong: netBaseStrong,
      label: formatStrongWeakLabel(netBaseStrong),
      ignoresModelStrong: false,
    });
  } else {
    for (const { item, eq } of meleeWeapons) {
      const { bonus, note } = getMeleeWeaponStrongBonus(eq.id);
      const net = netBaseStrong + bonus;
      weaponSummaries.push({
        weaponName: item.customName || eq.name,
        weaponType: 'Melee',
        netStrong: net,
        label: formatStrongWeakLabel(net),
        ignoresModelStrong: false,
        note: [
          bonus > 0 ? `+${bonus} Weapon Strong` : undefined,
          note,
          hasMalleus ? '+2 Strong vs Magic-users/Uncanny (Malleus Maleficarum)' : undefined,
        ]
          .filter(Boolean)
          .join(' • '),
      });
    }
  }

  for (const { item, eq } of rangedWeapons) {
    const isCrossbowOrBlackPowder =
      eq.id === 'eq-light-crossbow' ||
      eq.id === 'eq-heavy-crossbow' ||
      Boolean(eq.isBlackPowder) ||
      eq.id === 'eq-pistol' ||
      eq.id === 'eq-blunderbuss' ||
      eq.id === 'eq-caliver';

    if (isCrossbowOrBlackPowder) {
      let fixedStrong = 0;
      let note = 'Ignores model Strong/Weak';
      if (eq.id === 'eq-light-crossbow') {
        fixedStrong = 2;
        note = 'Fixed Strong (2) (ignores model Strong/Weak & 1 Armour Tough)';
      } else if (eq.id === 'eq-heavy-crossbow') {
        fixedStrong = 4;
        note = 'Fixed Strong (4) (ignores model Strong/Weak & 2 Armour Tough)';
      } else if (eq.id === 'eq-pistol') {
        fixedStrong = 1;
        note = 'Fixed Strong (1) (ignores model Strong/Weak)';
      } else if (eq.id === 'eq-blunderbuss') {
        fixedStrong = 0;
        note = 'Fixed Strong (0) (ignores model Strong/Weak)';
      } else if (eq.id === 'eq-caliver') {
        fixedStrong = 3;
        note = 'Fixed Strong (3) (ignores model Strong/Weak & 2 Armour Tough)';
      }
      if (eq.isBlackPowder && hasSuperiorBlackPowder) {
        note += ' • +1 Strong with Superior Black Powder';
      }
      weaponSummaries.push({
        weaponName: item.customName || eq.name,
        weaponType: 'Ranged',
        netStrong: fixedStrong,
        label: formatStrongWeakLabel(fixedStrong),
        ignoresModelStrong: true,
        note,
      });
    } else if (eq.id === 'eq-cheirosiphon') {
      weaponSummaries.push({
        weaponName: item.customName || eq.name,
        weaponType: 'Ranged',
        netStrong: 0,
        label: 'Special (d8/d12/d20)',
        ignoresModelStrong: true,
        note: 'Uses Fire Stream template rules (Page 102)',
      });
    } else {
      // Bow, War Bow, Sling, Throwing Knives, Master's Bow use model's netBaseStrong
      const ammoNote =
        (eq.id === 'eq-bow' || eq.id === 'eq-war-bow' || eq.id === 'eq-relic-masters-bow') &&
        hasBroadheads
          ? '+1 Strong if using Broadhead Arrows'
          : eq.id === 'eq-sling' && hasLeadSlingshot
          ? '+1 Strong if using Lead Slingshot'
          : undefined;
      weaponSummaries.push({
        weaponName: item.customName || eq.name,
        weaponType: 'Ranged',
        netStrong: netBaseStrong,
        label: formatStrongWeakLabel(netBaseStrong),
        ignoresModelStrong: false,
        note: ammoNote,
      });
    }
  }

  const primaryMelee = weaponSummaries.find((w) => w.weaponType === 'Melee')!;
  if (meleeWeapons.length > 0) {
    const firstMelee = meleeWeapons[0];
    const { bonus } = getMeleeWeaponStrongBonus(firstMelee.eq.id);
    if (bonus > 0) {
      strongEntries.push({
        id: `str-wpn-${firstMelee.item.instanceId}`,
        source: `Equipped (${firstMelee.item.customName || firstMelee.eq.name}): Strong (${bonus})`,
        category: 'Equipment',
        value: bonus,
        unit: 'strong',
      });
    }
  }
  if (hasMalleus) {
    strongEntries.push({
      id: 'str-malleus',
      source: 'Malleus Maleficarum: +2 Strong vs Magic-users & Uncanny',
      category: 'Situational',
      value: 2,
      unit: 'strong',
      isSituational: true,
    });
  }
  if (allSkills.includes('sk-lance-strike')) {
    strongEntries.push({
      id: 'str-lance',
      source: 'Lance Strike: +3 Strong on Charge > 3" (ignores Armour)',
      category: 'Situational',
      value: 3,
      unit: 'strong',
      isSituational: true,
    });
  }
  if (allSkills.includes('sk-wounding-shot')) {
    const totalShotBonus =
      2 +
      (allSkills.includes('sk-crippling-shot') ? 2 : 0) +
      (allSkills.includes('sk-kill-shot') ? 3 : 0);
    strongEntries.push({
      id: 'str-wounding-shot',
      source: `Shooting Skills (Wounding${
        allSkills.includes('sk-crippling-shot') ? '/Crippling' : ''
      }${allSkills.includes('sk-kill-shot') ? '/Kill' : ''} Shot): +${totalShotBonus} Wounds on Shoot`,
      category: 'Situational',
      value: totalShotBonus,
      unit: 'wounds',
      isSituational: true,
    });
  }

  const strongBreakdown: FighterStrongBreakdown = {
    skillStrong,
    skillWeak,
    conditionStrong,
    netBaseStrong,
    baseLabel: formatStrongWeakLabel(netBaseStrong),
    primaryMeleeNetStrong: primaryMelee.netStrong,
    primaryMeleeLabel: primaryMelee.label,
    primaryMeleeWeaponName: primaryMelee.weaponName,
    weapons: weaponSummaries,
    entries: strongEntries,
  };

  // =========================================================================
  // 2. TOUGH / DELICATE BREAKDOWN
  // =========================================================================
  const toughEntries: StatModifierEntry[] = [];
  const innateTough = parseTier(species?.innateSkillIds ?? [], 'sk-tough-');
  const learnedTough = parseTier(fighter.learnedSkillIds, 'sk-tough-');
  const skillTough = Math.max(innateTough, learnedTough);

  if (skillTough > 0) {
    toughEntries.push({
      id: 'tgh-skill',
      source: `${
        innateTough >= learnedTough
          ? `Innate (${species?.name || 'Species'})`
          : 'Learned Skill'
      }: Tough (${skillTough})`,
      category: 'Skill',
      value: skillTough,
      unit: 'tough',
    });
  }

  const innateDelicate = parseTier(species?.innateSkillIds ?? [], 'sk-delicate-');
  const learnedDelicate = parseTier(fighter.learnedSkillIds, 'sk-delicate-');
  const injuryDelicate = fighter.injuryIds.filter(
    (id) => id === 'inj-maj-16-cracked-ribs'
  ).length;
  const skillDelicate = innateDelicate + learnedDelicate + injuryDelicate;

  if (innateDelicate > 0) {
    toughEntries.push({
      id: 'del-innate',
      source: `Innate (${species?.name || 'Species'}): Delicate (${innateDelicate})`,
      category: 'Skill',
      value: -innateDelicate,
      unit: 'tough',
    });
  }
  if (learnedDelicate > 0) {
    toughEntries.push({
      id: 'del-learned',
      source: `${
        fighter.isMagicUser || fighter.learnedSpellIds.length > 0
          ? 'Magic-user Spells'
          : 'Skill'
      }: Delicate (${learnedDelicate})`,
      category: 'Skill',
      value: -learnedDelicate,
      unit: 'tough',
    });
  }
  if (injuryDelicate > 0) {
    toughEntries.push({
      id: 'del-injury',
      source: `Major Injury (Cracked Ribs): Delicate (${injuryDelicate})`,
      category: 'Skill',
      value: -injuryDelicate,
      unit: 'tough',
    });
  }

  let armourTough = 0;
  for (const { item, eq } of equippedPairs) {
    if (eq.armourValue && eq.armourValue > 0) {
      armourTough += eq.armourValue;
      toughEntries.push({
        id: `tgh-eq-${item.instanceId}`,
        source: `Gear (${item.customName || eq.name}): Tough (${eq.armourValue})`,
        category: 'Equipment',
        value: eq.armourValue,
        unit: 'tough',
      });
    }
  }

  const hasSilkUndershirt = equippedPairs.some((p) => p.eq.id === 'eq-silk-undershirt');
  if (hasSilkUndershirt) {
    toughEntries.push({
      id: 'tgh-silk',
      source: 'Silk Undershirt: +1 Tough vs Bows & Crossbows',
      category: 'Situational',
      value: 1,
      unit: 'tough',
      isSituational: true,
    });
  }
  if (allSkills.includes('sk-the-ladys-favour')) {
    toughEntries.push({
      id: 'tgh-ladys-favour',
      source: "The Lady's Favour: +3 Tough vs Shoot Actions",
      category: 'Situational',
      value: 3,
      unit: 'tough',
      isSituational: true,
    });
  }
  if (allSkills.includes('sk-resist-magic')) {
    toughEntries.push({
      id: 'tgh-resist-magic',
      source: 'Resist Magic: Reduces Wounds taken from Spells by 2',
      category: 'Situational',
      value: 2,
      unit: 'tough',
      isSituational: true,
    });
  }

  const conditionTough = 0;
  const netTough = skillTough + armourTough + conditionTough - skillDelicate;
  const netUnarmouredTough = skillTough + conditionTough - skillDelicate;

  const toughBreakdown: FighterToughBreakdown = {
    skillTough,
    skillDelicate,
    armourTough,
    conditionTough,
    netTough,
    netUnarmouredTough,
    label: formatToughDelicateLabel(netTough),
    shortBadgeLabel:
      netTough > 0
        ? `Tough ${netTough}`
        : netTough < 0
        ? `Delicate ${Math.abs(netTough)}`
        : 'Tough 0',
    entries: toughEntries,
  };

  // =========================================================================
  // 3. GLOBAL WOUND & CONDITION MODIFIERS
  // =========================================================================
  const maxWounds = effective.wounds;
  const woundsTaken = includeMatchState
    ? Math.max(0, maxWounds - fighter.currentWounds)
    : 0;
  const rawWoundPenalty = [4, 7, 10, 13].filter((box) => woundsTaken >= box).length;
  const hasEnduring = allSkills.includes('sk-enduring');
  const woundPenaltyIgnoredBy = hasEnduring
    ? 'Enduring Skill'
    : hasBerserk
    ? 'Berserk Condition'
    : undefined;
  const effectiveWoundPenalty =
    includeMatchState && !woundPenaltyIgnoredBy ? -rawWoundPenalty : 0;

  const conds = includeMatchState ? fighter.conditions : [];
  const isStunned = conds.includes('Stunned');
  const isPoisoned = conds.includes('Poisoned');
  const isBurning = conds.includes('Burning');
  const isDrunk = conds.includes('Drunk');
  const isInfected = conds.includes('Infected');
  const isParalysed = conds.includes('Paralysed');

  // Sum injury stat steps per stat for display
  const getInjurySteps = (key: StatKey): number => {
    let steps = 0;
    for (const injId of fighter.injuryIds) {
      const inj = rules.injuries.find((i) => i.id === injId);
      if (inj?.statPenalty?.[key]) {
        steps += inj.statPenalty[key]!;
      }
    }
    return steps;
  };

  const hasBornInHarness = allSkills.includes('sk-born-in-harness');
  const hasZweihander = allSkills.includes('sk-zweihander');
  const hasPaladin = allSkills.includes('sk-paladin');
  const hasUltimateArmour = equippedPairs.some(
    (p) => p.eq.id === 'eq-relic-armour-ultimate-protection'
  );
  const hasBeltOfBalmorr = equippedPairs.some((p) => p.eq.id === 'eq-relic-belt-balmorr');
  const hasAxeOfSlaughter = equippedPairs.some(
    (p) => p.eq.id === 'eq-relic-axe-slaughter'
  );
  const hasMasterSmithed = equippedPairs.some(
    (p) => p.eq.id === 'eq-master-smithed-upgrade'
  );
  const hasBodyArmour = equippedPairs.some(
    (p) =>
      p.eq.isBodyArmour ||
      p.eq.id === 'eq-light-armour' ||
      p.eq.id === 'eq-heavy-armour' ||
      p.eq.id === 'eq-very-heavy-armour' ||
      p.eq.id === 'eq-relic-armour-ultimate-protection'
  );

  const STAT_META: Array<{ key: StatKey; label: string; shortLabel: string }> = [
    { key: 'move', label: 'Move', shortLabel: 'M' },
    { key: 'strike', label: 'Strike', shortLabel: 'S' },
    { key: 'block', label: 'Block', shortLabel: 'B' },
    { key: 'ranged', label: 'Ranged', shortLabel: 'R' },
    { key: 'nimbleness', label: 'Nimbleness', shortLabel: 'N' },
    { key: 'concealment', label: 'Concealment', shortLabel: 'C' },
    { key: 'awareness', label: 'Awareness', shortLabel: 'A' },
    { key: 'fortitude', label: 'Fortitude', shortLabel: 'F' },
    { key: 'presence', label: 'Presence', shortLabel: 'P' },
  ];

  const statsRecord = {} as Record<StatKey, SingleStatBreakdown>;

  for (const { key, label, shortLabel } of STAT_META) {
    const activeEntries: StatModifierEntry[] = [];
    const situationalEntries: StatModifierEntry[] = [];
    const rerollNotes: string[] = [];
    let cannotRollReason: string | undefined;

    if (isParalysed) {
      cannotRollReason = 'Paralysed (Cannot take Actions or Defend)';
    }

    const baseDie = base[key] ?? 'D6';
    let effectiveDie: DiceValue | 'D3' = effective[key] ?? 'D6';
    let dieOverriddenBy: string | undefined;

    if (hasUltimateArmour && (key === 'move' || key === 'nimbleness')) {
      effectiveDie = 'D3';
      dieOverriddenBy = 'The Armour of Ultimate Protection (reduces Move & Nimbleness to D3)';
    }

    let moveInchesBase: number | undefined;
    let moveInchesMod = 0;

    // -----------------------------------------------------------------------
    // Per-Stat Equipment & Skill Modifiers
    // -----------------------------------------------------------------------
    if (key === 'move') {
      moveInchesBase = effectiveDie === 'D3' ? 3 : getMoveInchesFromDie(effectiveDie);
      if (allSkills.includes('sk-strider')) {
        moveInchesMod += 1;
        activeEntries.push({
          id: 'mov-strider',
          source: 'Strider (Skill): +1" Move / Charge / Barge distance',
          category: 'Skill',
          value: 1,
          unit: 'inches',
        });
      }
      if (hasBeltOfBalmorr) {
        moveInchesMod += 3;
        activeEntries.push({
          id: 'mov-balmorr',
          source: 'The Belt of Balmorr: +3" Move distance',
          category: 'Equipment',
          value: 3,
          unit: 'inches',
        });
      }
      if (allSkills.includes('sk-burst-of-speed')) {
        situationalEntries.push({
          id: 'mov-burst',
          source: 'Burst of Speed (1 Fate): +4" Move / +2" Charge',
          category: 'Situational',
          value: 4,
          unit: 'inches',
          isSituational: true,
        });
      }
      if (allSkills.includes('sk-flight')) {
        rerollNotes.push(
          'Flight (Innate): May count Move as D12 (12") when flying (unless in Very Heavy Armour / Heavy Shield).'
        );
      }
      if (allSkills.includes('sk-swim')) {
        rerollNotes.push('Swim: Moves full Move distance in water without Difficult Terrain roll.');
      }
    }

    if (key === 'strike') {
      // Skills
      if (allSkills.includes('sk-weaponskill')) {
        activeEntries.push({
          id: 'strk-weaponskill',
          source: 'Weaponskill (Skill)',
          category: 'Skill',
          value: 1,
          unit: 'roll',
        });
      }
      const oneHandedCount = meleeWeapons.filter(
        (w) =>
          w.eq.category === 'One-Handed Weapon' ||
          w.eq.id === 'eq-one-handed' ||
          w.eq.id === 'eq-spear' ||
          w.eq.id === 'eq-relic-thirsting-blade'
      ).length;
      const hasAnyShield = equippedPairs.some(
        (p) =>
          p.eq.isShield ||
          p.eq.id === 'eq-buckler' ||
          p.eq.id === 'eq-light-shield' ||
          p.eq.id === 'eq-heavy-shield' ||
          p.eq.id === 'eq-relic-shield-attraction'
      );

      if (allSkills.includes('sk-dual-wielder')) {
        if (oneHandedCount >= 2 && !hasAnyShield) {
          activeEntries.push({
            id: 'strk-dual-wielder',
            source: 'Dual-Wielder (2 One-handed Weapons)',
            category: 'Skill',
            value: 2,
            unit: 'roll',
          });
        } else {
          situationalEntries.push({
            id: 'strk-dual-wielder-sit',
            source: 'Dual-Wielder (with 2 One-handed Weapons & no Shield)',
            category: 'Situational',
            value: 2,
            unit: 'roll',
            isSituational: true,
          });
        }
      }

      // Primary Melee Weapon Strike Modifiers
      if (meleeWeapons.length === 0) {
        const isMistGhast = fighter.speciesId.startsWith('sp-mist-ghast');
        if (!isMistGhast && !allSkills.includes('sk-unarmed-fighter')) {
          activeEntries.push({
            id: 'strk-unarmed',
            source: 'Unarmed (No Melee Weapon equipped)',
            category: 'Equipment',
            value: -2,
            unit: 'roll',
          });
        }
      } else {
        const primary = meleeWeapons[0];
        const wName = primary.item.customName || primary.eq.name;
        if (primary.eq.id === 'eq-pole-arm' || primary.eq.id === 'eq-spear') {
          activeEntries.push({
            id: `strk-wpn-${primary.item.instanceId}`,
            source: wName,
            category: 'Equipment',
            value: 1,
            unit: 'roll',
          });
        } else if (primary.eq.id === 'eq-rondel-dagger') {
          activeEntries.push({
            id: `strk-wpn-${primary.item.instanceId}`,
            source: `${wName} (Counts as Unarmed)`,
            category: 'Equipment',
            value: -2,
            unit: 'roll',
          });
        } else if (primary.eq.id === 'eq-relic-axe-slaughter') {
          activeEntries.push({
            id: `strk-wpn-${primary.item.instanceId}`,
            source: wName,
            category: 'Equipment',
            value: 5,
            unit: 'roll',
          });
        } else if (primary.eq.id === 'eq-relic-father-of-swords') {
          activeEntries.push({
            id: `strk-wpn-${primary.item.instanceId}`,
            source: wName,
            category: 'Equipment',
            value: 4,
            unit: 'roll',
          });
        }
        if (hasMasterSmithed) {
          activeEntries.push({
            id: 'strk-master-smithed',
            source: 'Weapon (Master-smithed) Upgrade',
            category: 'Equipment',
            value: 1,
            unit: 'roll',
          });
        }
      }

      // Situational Strike Modifiers
      situationalEntries.push({
        id: 'strk-charge',
        source: allSkills.includes('sk-furious-charge')
          ? 'Charge Action (Furious Charge — any distance)'
          : 'Charge Action (moved 3" or more)',
        category: 'Situational',
        value: 2,
        unit: 'roll',
        isSituational: true,
      });
      situationalEntries.push({
        id: 'strk-outnumber-1',
        source:
          'Outnumbering Target (+1 per friendly model in Base Contact — Page 28: includes Attacker when 1+ ally assists)',
        category: 'Situational',
        value: 1,
        unit: 'roll',
        isSituational: true,
        isStackable: true,
      });
      if (allSkills.includes('sk-close-quarters')) {
        situationalEntries.push({
          id: 'strk-close-quarters',
          source: 'Close Quarters (in Base Contact with Terrain / inside building)',
          category: 'Situational',
          value: 2,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (allSkills.includes('sk-witch-slayer')) {
        situationalEntries.push({
          id: 'strk-witch-slayer',
          source: 'Witch Slayer (vs Magic-user or Uncanny)',
          category: 'Situational',
          value: 3,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (allSkills.includes('sk-martial-code')) {
        situationalEntries.push({
          id: 'strk-martial-code',
          source: 'Martial Code (vs Fearsome enemy)',
          category: 'Situational',
          value: 2,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (allSkills.includes('sk-killing-blow')) {
        situationalEntries.push({
          id: 'strk-killing-blow',
          source: 'Killing Blow (Once per Battle)',
          category: 'Situational',
          value: 7,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (equippedPairs.some((p) => p.eq.id === 'eq-camouflage-cloak')) {
        const cloakBonus = hasBodyArmour ? 1 : 3;
        situationalEntries.push({
          id: 'strk-camo-ambush',
          source: `Camouflage Cloak (Ambush Charge Action)`,
          category: 'Situational',
          value: cloakBonus,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (allSkills.includes('sk-feint')) {
        rerollNotes.push('Feint: Roll two Strike dice and pick highest when fighting 1-on-1.');
      }
    }

    if (key === 'block') {
      if (hasBerserk) {
        cannotRollReason = 'Berserk Condition (Cannot Defend)';
      }
      if (allSkills.includes('sk-parry')) {
        activeEntries.push({
          id: 'blk-parry',
          source: 'Parry (Skill)',
          category: 'Skill',
          value: 2,
          unit: 'roll',
        });
      }
      if (allSkills.includes('sk-weaponskill')) {
        activeEntries.push({
          id: 'blk-weaponskill',
          source: 'Weaponskill (Skill)',
          category: 'Skill',
          value: 1,
          unit: 'roll',
        });
      }
      if (allSkills.includes('sk-spines')) {
        activeEntries.push({
          id: 'blk-spines',
          source: 'Spines (Innate)',
          category: 'Skill',
          value: 1,
          unit: 'roll',
        });
      }

      // Melee weapon Block penalty/bonus
      if (meleeWeapons.length === 0) {
        const isMistGhast = fighter.speciesId.startsWith('sp-mist-ghast');
        if (!isMistGhast && !allSkills.includes('sk-unarmed-fighter')) {
          activeEntries.push({
            id: 'blk-unarmed',
            source: 'Unarmed (No Melee Weapon equipped)',
            category: 'Equipment',
            value: -2,
            unit: 'roll',
          });
        }
      } else {
        const primary = meleeWeapons[0];
        const wName = primary.item.customName || primary.eq.name;
        if (
          primary.eq.id === 'eq-two-handed' ||
          primary.eq.id === 'eq-relic-father-of-swords'
        ) {
          if (!hasZweihander) {
            activeEntries.push({
              id: `blk-wpn-${primary.item.instanceId}`,
              source: wName,
              category: 'Equipment',
              value: -2,
              unit: 'roll',
            });
          } else {
            rerollNotes.push(`Zweihander: Ignores -2 Block penalty from ${wName}.`);
          }
        } else if (primary.eq.id === 'eq-rondel-dagger') {
          activeEntries.push({
            id: `blk-wpn-${primary.item.instanceId}`,
            source: `${wName} (Counts as Unarmed)`,
            category: 'Equipment',
            value: -2,
            unit: 'roll',
          });
        } else if (primary.eq.id === 'eq-relic-axe-slaughter') {
          activeEntries.push({
            id: `blk-wpn-${primary.item.instanceId}`,
            source: `${wName} (-3 Defend)`,
            category: 'Equipment',
            value: -3,
            unit: 'roll',
          });
        }
      }

      // Shield Block bonus
      for (const { item, eq } of equippedPairs) {
        const sName = item.customName || eq.name;
        if (eq.id === 'eq-buckler') {
          activeEntries.push({
            id: `blk-sh-${item.instanceId}`,
            source: sName,
            category: 'Equipment',
            value: 1,
            unit: 'roll',
          });
        } else if (
          eq.id === 'eq-light-shield' ||
          eq.id === 'eq-relic-shield-attraction'
        ) {
          activeEntries.push({
            id: `blk-sh-${item.instanceId}`,
            source: sName,
            category: 'Equipment',
            value: 2,
            unit: 'roll',
          });
        } else if (eq.id === 'eq-heavy-shield') {
          activeEntries.push({
            id: `blk-sh-${item.instanceId}`,
            source: sName,
            category: 'Equipment',
            value: 3,
            unit: 'roll',
          });
        }
      }

      // Bonded Critter: Beetle (+1 Block once per Turn)
      if (equippedPairs.some((p) => p.eq.id === 'eq-critter-beetle')) {
        situationalEntries.push({
          id: 'blk-critter-beetle',
          source: 'Bonded Critter: Beetle (Once per Turn when Attacked)',
          category: 'Situational',
          value: 1,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (allSkills.includes('sk-close-quarters')) {
        situationalEntries.push({
          id: 'blk-close-quarters',
          source: 'Close Quarters (in Base Contact with Terrain / inside building)',
          category: 'Situational',
          value: 2,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (allSkills.includes('sk-shield-master')) {
        rerollNotes.push('Shield Master: May re-roll Block dice when using a Shield.');
      }
      if (allSkills.includes('sk-beguile')) {
        rerollNotes.push('Beguile: May choose to roll Presence instead of Block to Defend.');
      }
    }

    if (key === 'ranged') {
      if (allSkills.includes('sk-expert-shot')) {
        activeEntries.push({
          id: 'rng-expert-shot',
          source: 'Expert Shot (Skill)',
          category: 'Skill',
          value: 2,
          unit: 'roll',
        });
      }

      if (rangedWeapons.length > 0) {
        const primaryRanged = rangedWeapons[0];
        const rName = primaryRanged.item.customName || primaryRanged.eq.name;
        if (primaryRanged.eq.id === 'eq-throwing-knives') {
          activeEntries.push({
            id: `rng-wpn-${primaryRanged.item.instanceId}`,
            source: rName,
            category: 'Equipment',
            value: 1,
            unit: 'roll',
          });
        } else if (primaryRanged.eq.id === 'eq-blunderbuss') {
          activeEntries.push({
            id: `rng-wpn-${primaryRanged.item.instanceId}`,
            source: rName,
            category: 'Equipment',
            value: 3,
            unit: 'roll',
          });
        } else if (primaryRanged.eq.id === 'eq-relic-masters-bow') {
          activeEntries.push({
            id: `rng-wpn-${primaryRanged.item.instanceId}`,
            source: rName,
            category: 'Equipment',
            value: 5,
            unit: 'roll',
          });
        }
        if (hasMasterSmithed && meleeWeapons.length === 0) {
          activeEntries.push({
            id: 'rng-master-smithed',
            source: 'Weapon (Master-smithed) Upgrade',
            category: 'Equipment',
            value: 1,
            unit: 'roll',
          });
        } else if (hasMasterSmithed && meleeWeapons.length > 0) {
          situationalEntries.push({
            id: 'rng-master-smithed-sit',
            source: 'Weapon (Master-smithed) Upgrade (if on Missile Weapon)',
            category: 'Situational',
            value: 1,
            unit: 'roll',
            isSituational: true,
          });
        }
      }

      if (allSkills.includes('sk-fast-shot') && !allSkills.includes('sk-lethal-volley')) {
        situationalEntries.push({
          id: 'rng-fast-shot',
          source: 'Fast Shot (1 Fate — firing two shots)',
          category: 'Situational',
          value: -2,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (allSkills.includes('sk-rock-steady')) {
        situationalEntries.push({
          id: 'rng-rock-steady',
          source: 'Rock Steady (1 Fate — free Move before Shoot)',
          category: 'Situational',
          value: -2,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (equippedPairs.some((p) => p.eq.id === 'eq-camouflage-cloak')) {
        const cloakBonus = hasBodyArmour ? 1 : 3;
        situationalEntries.push({
          id: 'rng-camo-ambush',
          source: 'Camouflage Cloak (Ambush Shoot Action)',
          category: 'Situational',
          value: cloakBonus,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (allSkills.includes('sk-natural-hunter')) {
        rerollNotes.push(
          'Natural Hunter (Innate): Does not benefit from Perfect Roll (+7) or Disastrous Roll (+1 Fate point) on Ranged Roll-offs.'
        );
      }
    }

    if (key === 'nimbleness') {
      for (const { item, eq } of equippedPairs) {
        if (eq.nimblenessPenalty && eq.nimblenessPenalty < 0) {
          const isArmourOrShield =
            getEffectiveEquipmentType(eq) === 'Armour' ||
            Boolean(eq.isBodyArmour) ||
            Boolean(eq.isShield);
          if (hasBornInHarness && isArmourOrShield) {
            rerollNotes.push(
              `Born in Harness: Ignores ${eq.nimblenessPenalty} Nimbleness penalty from ${
                item.customName || eq.name
              }.`
            );
          } else {
            activeEntries.push({
              id: `nmb-eq-${item.instanceId}`,
              source: item.customName || eq.name,
              category: 'Equipment',
              value: eq.nimblenessPenalty,
              unit: 'roll',
            });
          }
        }
      }
      if (hasBeltOfBalmorr) {
        activeEntries.push({
          id: 'nmb-balmorr',
          source: 'The Belt of Balmorr',
          category: 'Equipment',
          value: 3,
          unit: 'roll',
        });
      }
      if (hasAxeOfSlaughter) {
        situationalEntries.push({
          id: 'nmb-axe-slaughter',
          source: 'The Axe of Slaughter (when rolling to Defend)',
          category: 'Situational',
          value: -3,
          unit: 'roll',
          isSituational: true,
          defaultChecked: true,
        });
      }
      if (allSkills.includes('sk-dodge')) {
        situationalEntries.push({
          id: 'nmb-dodge',
          source: 'Dodge (Defending vs Ranged Shoot Action)',
          category: 'Situational',
          value: 2,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (equippedPairs.some((p) => p.eq.id === 'eq-relic-shield-attraction')) {
        situationalEntries.push({
          id: 'nmb-shield-attraction',
          source: 'The Shield of Attraction (Defending vs Shoot Action)',
          category: 'Situational',
          value: 4,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (equippedPairs.some((p) => p.eq.id === 'eq-grappling-hook')) {
        situationalEntries.push({
          id: 'nmb-rope-hook',
          source: 'Rope & Hook (Moving vertically in Difficult Terrain)',
          category: 'Situational',
          value: 2,
          unit: 'roll',
          isSituational: true,
        });
      }
      if (allSkills.includes('sk-leaper')) {
        rerollNotes.push('Leaper: May re-roll Nimbleness dice when jumping.');
      }
    }

    if (key === 'concealment') {
      if (allSkills.includes('sk-light-feet')) {
        activeEntries.push({
          id: 'cnc-light-feet',
          source: 'Light Feet (Skill)',
          category: 'Skill',
          value: 2,
          unit: 'roll',
        });
      }
      if (equippedPairs.some((p) => p.eq.id === 'eq-camouflage-cloak')) {
        const cloakBonus = hasBodyArmour ? 1 : 3;
        activeEntries.push({
          id: 'cnc-camo-cloak',
          source: `Camouflage Cloak (${hasBodyArmour ? 'wearing Armour' : 'unarmoured'})`,
          category: 'Equipment',
          value: cloakBonus,
          unit: 'roll',
        });
      }
      if (equippedPairs.some((p) => p.eq.id === 'eq-scent-masker')) {
        situationalEntries.push({
          id: 'cnc-scent-masker',
          source: 'Scent Masker (Active for 2 Turns after Interact)',
          category: 'Situational',
          value: 3,
          unit: 'roll',
          isSituational: true,
        });
      }
      situationalEntries.push({
        id: 'cnc-shrine-woods',
        source: 'Den Shrine to the Lords of the Woods (+1 Concealment)',
        category: 'Situational',
        value: 1,
        unit: 'roll',
        isSituational: true,
      });
    }

    if (key === 'awareness') {
      if (
        allSkills.includes('sk-bloodhound') ||
        equippedPairs.some((p) => p.eq.id === 'eq-telescope')
      ) {
        rerollNotes.push(
          'Bloodhound / Telescope: May re-roll the dice during any Awareness Roll-offs.'
        );
      }
      if (allSkills.includes('sk-witch-smeller')) {
        rerollNotes.push(
          'Witch Smeller: Automatically succeeds Search Actions against Sneaking Magic-users.'
        );
      }
    }

    if (key === 'fortitude' || key === 'presence') {
      const isMage =
        Boolean(fighter.isMagicUser) ||
        fighter.learnedSpellIds.length > 0 ||
        Boolean(fighter.magicalArchetypes && fighter.magicalArchetypes.length > 0);

      if (equippedPairs.some((p) => p.eq.id === 'eq-focus')) {
        situationalEntries.push({
          id: `${key}-mages-focus`,
          source: "Mage's Focus (Cast Action Roll-off)",
          category: 'Situational',
          value: 1,
          unit: 'roll',
          isSituational: true,
          defaultChecked: isMage,
        });
      }
      if (equippedPairs.some((p) => p.eq.id === 'eq-relic-haldyns-staff')) {
        situationalEntries.push({
          id: `${key}-haldyns-staff`,
          source: "Haldyn's Staff (Cast Action Roll-off)",
          category: 'Situational',
          value: 5,
          unit: 'roll',
          isSituational: true,
          defaultChecked: isMage,
        });
      }
      if (allSkills.includes('sk-gifted')) {
        situationalEntries.push({
          id: `${key}-gifted`,
          source: 'Gifted (Cast Action from chosen Magical Archetype)',
          category: 'Situational',
          value: 1,
          unit: 'roll',
          isSituational: true,
          defaultChecked: isMage,
        });
      }

      // Armour Cast penalties for Magic-users (unless Paladin)
      if (!hasPaladin) {
        for (const { item, eq } of equippedPairs) {
          const aName = item.customName || eq.name;
          if (eq.id === 'eq-light-armour') {
            situationalEntries.push({
              id: `${key}-cast-armour-${item.instanceId}`,
              source: `${aName} (Magic Cast Penalty)`,
              category: 'Situational',
              value: -1,
              unit: 'roll',
              isSituational: true,
              defaultChecked: isMage,
            });
          } else if (eq.id === 'eq-heavy-armour') {
            situationalEntries.push({
              id: `${key}-cast-armour-${item.instanceId}`,
              source: `${aName} (Magic Cast Penalty)`,
              category: 'Situational',
              value: -2,
              unit: 'roll',
              isSituational: true,
              defaultChecked: isMage,
            });
          } else if (eq.id === 'eq-very-heavy-armour') {
            situationalEntries.push({
              id: `${key}-cast-armour-${item.instanceId}`,
              source: `${aName} (Magic Cast Penalty)`,
              category: 'Situational',
              value: -4,
              unit: 'roll',
              isSituational: true,
              defaultChecked: isMage,
            });
          }
        }
      } else if (hasBodyArmour && isMage) {
        rerollNotes.push('Paladin: Ignores Armour penalties to Magic Cast Roll-offs.');
      }

      if (allSkills.includes('sk-resist-magic')) {
        rerollNotes.push(
          `Resist Magic: May re-roll ${label} dice when rolling to resist Magic.`
        );
      }
      if (
        key === 'presence' &&
        equippedPairs.some((p) => p.eq.id === 'eq-signature-item')
      ) {
        rerollNotes.push('Signature Item: Once per game, may re-roll a Presence dice.');
      }
    }

    // Sum Permanent Roll Modifier (Skills + Equipment with unit === 'roll')
    const permanentRollMod = activeEntries
      .filter((e) => e.unit === 'roll')
      .reduce((acc, e) => acc + e.value, 0);

    // -----------------------------------------------------------------------
    // Match State Modifiers (Wounds & Active Conditions)
    // -----------------------------------------------------------------------
    if (includeMatchState) {
      if (rawWoundPenalty > 0) {
        if (woundPenaltyIgnoredBy) {
          rerollNotes.push(
            `Wound Penalty (-${rawWoundPenalty}) is ignored due to ${woundPenaltyIgnoredBy}.`
          );
        } else {
          activeEntries.push({
            id: `${key}-wounds`,
            source: `Wounds Taken (${woundsTaken}/${maxWounds} • ${rawWoundPenalty} shaded box${
              rawWoundPenalty > 1 ? 'es' : ''
            })`,
            category: 'Wounds',
            value: effectiveWoundPenalty,
            unit: 'roll',
          });
        }
      }

      if (hasBerserk && key === 'strike') {
        activeEntries.push({
          id: `${key}-cond-berserk`,
          source: 'Condition: Berserk',
          category: 'Condition',
          value: 2,
          unit: 'roll',
        });
      }
      if (isStunned) {
        activeEntries.push({
          id: `${key}-cond-stunned`,
          source: 'Condition: Stunned (-2 to all Roll-offs)',
          category: 'Condition',
          value: -2,
          unit: 'roll',
        });
      }
      if (isPoisoned) {
        activeEntries.push({
          id: `${key}-cond-poisoned`,
          source: 'Condition: Poisoned (-1 to all Roll-offs)',
          category: 'Condition',
          value: -1,
          unit: 'roll',
        });
      }
      if (isBurning && key !== 'nimbleness') {
        activeEntries.push({
          id: `${key}-cond-burning`,
          source: 'Condition: Burning (-2 to Roll-offs)',
          category: 'Condition',
          value: -2,
          unit: 'roll',
        });
      }
      if (isDrunk) {
        if (key === 'strike' || key === 'ranged' || key === 'nimbleness') {
          activeEntries.push({
            id: `${key}-cond-drunk`,
            source: 'Condition: Drunk (-1 S / R / N)',
            category: 'Condition',
            value: -1,
            unit: 'roll',
          });
        } else if (key === 'fortitude') {
          activeEntries.push({
            id: `${key}-cond-drunk`,
            source: 'Condition: Drunk (+2 Fortitude)',
            category: 'Condition',
            value: 2,
            unit: 'roll',
          });
        }
      }
      if (isInfected && key === 'fortitude') {
        activeEntries.push({
          id: `${key}-cond-infected`,
          source: 'Condition: Infected (-1 Fortitude)',
          category: 'Condition',
          value: -1,
          unit: 'roll',
        });
      }
    }

    const activeMatchRollMod = activeEntries
      .filter((e) => e.unit === 'roll')
      .reduce((acc, e) => acc + e.value, 0);

    statsRecord[key] = {
      statKey: key,
      label,
      shortLabel,
      baseDie,
      effectiveDie,
      dieOverriddenBy,
      advanceSteps: fighter.statModifiers[key] ?? 0,
      injurySteps: getInjurySteps(key),
      permanentRollMod,
      activeMatchRollMod,
      moveInchesBase,
      moveInchesMod,
      cannotRollReason,
      rerollNotes,
      activeEntries,
      situationalEntries,
    };
  }

  return {
    strong: strongBreakdown,
    tough: toughBreakdown,
    stats: statsRecord,
    woundPenalty: effectiveWoundPenalty,
    woundsTaken,
    maxWounds,
    woundPenaltyIgnoredBy,
  };
}

/**
 * Official Burrows & Badgers 2nd Edition Allegiance Starting Rare Equipment Options & Prices (Rulebook Pages 47–61).
 * Any Rare Equipment NOT listed in an Allegiance's table cannot be purchased at Band creation
 * (unless the user enables the custom override), and when listed, uses the exact Allegiance price.
 */
export const ALLEGIANCE_STARTING_RARE_EQUIPMENT: Record<
  string,
  AllegianceStartingEquipmentOption[]
> = {
  'al-royalists': [
    { equipmentId: 'eq-master-smithed-upgrade', cost: 12, note: '12p + cost of weapon' },
    { equipmentId: 'eq-war-bow', cost: 20 },
    { equipmentId: 'eq-heavy-crossbow', cost: 27 },
    { equipmentId: 'eq-caliver', cost: 20 },
    { equipmentId: 'eq-very-heavy-armour', cost: 40 },
    { equipmentId: 'eq-silk-undershirt', cost: 5 },
    { equipmentId: 'eq-telescope', cost: 10 },
    { equipmentId: 'eq-relic', cost: 4 },
    { equipmentId: 'eq-antidote', cost: 3 },
  ],
  'al-rogues': [
    { equipmentId: 'eq-caliver', cost: 25 },
    { equipmentId: 'eq-silk-undershirt', cost: 5 },
    { equipmentId: 'eq-dispel-scroll', cost: 10 },
    { equipmentId: 'eq-blind-dust', cost: 7 },
    { equipmentId: 'eq-telescope', cost: 10 },
    { equipmentId: 'eq-paralysing-poison', cost: 4 },
    { equipmentId: 'eq-pain-poison', cost: 2 },
    { equipmentId: 'eq-mortal-poison', cost: 5 },
    { equipmentId: 'eq-antidote', cost: 3 },
  ],
  'al-freebeasts': [
    { equipmentId: 'eq-heavy-crossbow', cost: 25, note: 'Reduced starting cost (25p)' },
    { equipmentId: 'eq-caliver', cost: 20 },
    { equipmentId: 'eq-very-heavy-armour', cost: 42 },
    { equipmentId: 'eq-silk-undershirt', cost: 5 },
    { equipmentId: 'eq-dispel-scroll', cost: 10 },
    { equipmentId: 'eq-shielding-talisman', cost: 7 },
    { equipmentId: 'eq-mirroring-talisman', cost: 10 },
    { equipmentId: 'eq-blind-dust', cost: 7 },
    { equipmentId: 'eq-telescope', cost: 10 },
    { equipmentId: 'eq-paralysing-poison', cost: 4 },
    { equipmentId: 'eq-pain-poison', cost: 2 },
    { equipmentId: 'eq-mortal-poison', cost: 5 },
    { equipmentId: 'eq-relic', cost: 4 },
    { equipmentId: 'eq-antidote', cost: 3 },
    { equipmentId: 'eq-grimoire', cost: 20 },
  ],
  'al-kindred': [
    { equipmentId: 'eq-master-smithed-upgrade', cost: 12, note: '12p + cost of weapon' },
    { equipmentId: 'eq-war-bow', cost: 20 },
    { equipmentId: 'eq-silk-undershirt', cost: 5 },
    { equipmentId: 'eq-telescope', cost: 10 },
    { equipmentId: 'eq-relic', cost: 4 },
    { equipmentId: 'eq-antidote', cost: 3 },
  ],
  'al-witch-hunters': [
    { equipmentId: 'eq-malleus-maleficarum', cost: 10, note: '10p + cost of weapon' },
    { equipmentId: 'eq-heavy-crossbow', cost: 28 },
    { equipmentId: 'eq-caliver', cost: 22 },
    { equipmentId: 'eq-very-heavy-armour', cost: 40 },
    { equipmentId: 'eq-silk-undershirt', cost: 5 },
    { equipmentId: 'eq-dispel-scroll', cost: 8, note: 'Reduced starting cost (8p)' },
    { equipmentId: 'eq-shielding-talisman', cost: 7 },
    { equipmentId: 'eq-mirroring-talisman', cost: 10 },
    { equipmentId: 'eq-telescope', cost: 10 },
    { equipmentId: 'eq-relic', cost: 4 },
    { equipmentId: 'eq-critter-bonded-grub', cost: 25 },
  ],
  'al-wildlings': [
    { equipmentId: 'eq-very-heavy-armour', cost: 45 },
    { equipmentId: 'eq-dispel-scroll', cost: 10 },
    { equipmentId: 'eq-shielding-talisman', cost: 7 },
    { equipmentId: 'eq-mirroring-talisman', cost: 10 },
    { equipmentId: 'eq-blind-dust', cost: 7 },
    { equipmentId: 'eq-berserker-seeds', cost: 8 },
    { equipmentId: 'eq-old-one-brews', cost: 13 },
    { equipmentId: 'eq-paralysing-poison', cost: 4 },
    { equipmentId: 'eq-pain-poison', cost: 2 },
    { equipmentId: 'eq-mortal-poison', cost: 5 },
    { equipmentId: 'eq-relic', cost: 4 },
    { equipmentId: 'eq-antidote', cost: 3 },
    { equipmentId: 'eq-critter-hornet', cost: 32 },
    { equipmentId: 'eq-critter-centipede', cost: 23 },
    { equipmentId: 'eq-critter-spider', cost: 20 },
    { equipmentId: 'eq-critter-beetle', cost: 23 },
    { equipmentId: 'eq-critter-bonded-grub', cost: 23, note: 'Reduced starting cost (23p)' },
  ],
  'al-arcane-conclave': [
    { equipmentId: 'eq-dispel-scroll', cost: 10 },
    { equipmentId: 'eq-shielding-talisman', cost: 10 },
    { equipmentId: 'eq-mirroring-talisman', cost: 13 },
    { equipmentId: 'eq-grimoire', cost: 17, note: 'Reduced starting cost (17p)' },
  ],
  'al-undead': [
    { equipmentId: 'eq-dispel-scroll', cost: 10 },
    { equipmentId: 'eq-shielding-talisman', cost: 10 },
    { equipmentId: 'eq-mirroring-talisman', cost: 13 },
    { equipmentId: 'eq-grimoire', cost: 20 },
  ],
  'al-routiers': [
    { equipmentId: 'eq-war-bow', cost: 20 },
    { equipmentId: 'eq-heavy-crossbow', cost: 27 },
    { equipmentId: 'eq-caliver', cost: 20 },
    { equipmentId: 'eq-very-heavy-armour', cost: 40 },
    { equipmentId: 'eq-relic', cost: 5 },
  ],
  'al-hillfolk': [
    { equipmentId: 'eq-bagpipes', cost: 20, note: 'Max 1 Piper per Band' },
    { equipmentId: 'eq-critter-hornet', cost: 30, note: 'Reduced starting cost (30p)' },
    { equipmentId: 'eq-critter-centipede', cost: 23 },
    { equipmentId: 'eq-critter-spider', cost: 20 },
    { equipmentId: 'eq-critter-beetle', cost: 23 },
    { equipmentId: 'eq-critter-bonded-grub', cost: 23, note: 'Reduced starting cost (23p)' },
  ],
};

/**
 * Official Stag Beetle Grub Species recruitment price discounts for Witch Hunters (p. 54),
 * Wildlings (p. 55), and Hillfolk (p. 61).
 */
export const ALLEGIANCE_SPECIES_COST_OVERRIDES: Record<string, Record<string, number>> = {
  'al-witch-hunters': {
    'sp-tracker-grub': 23, // Base: 27p
    'sp-attack-grub': 26,  // Base: 28p
    'sp-damping-grub': 24, // Base: 25p
  },
  'al-wildlings': {
    'sp-tracker-grub': 20, // Base: 27p
    'sp-attack-grub': 23,  // Base: 28p
    'sp-damping-grub': 21, // Base: 25p
  },
  'al-hillfolk': {
    'sp-tracker-grub': 21, // Base: 27p
    'sp-attack-grub': 24,  // Base: 28p
    'sp-damping-grub': 22, // Base: 25p
  },
};

export function getAllegianceStartingRareEquipment(
  allegiance: AllegianceRef | undefined
): AllegianceStartingEquipmentOption[] {
  if (!allegiance) return [];
  if (allegiance.startingRareEquipment && allegiance.startingRareEquipment.length > 0) {
    return allegiance.startingRareEquipment;
  }
  return ALLEGIANCE_STARTING_RARE_EQUIPMENT[allegiance.id] ?? [];
}

export function getAllegianceEquipmentOption(
  allegiance: AllegianceRef | undefined,
  equipmentId: string
): AllegianceStartingEquipmentOption | undefined {
  const options = getAllegianceStartingRareEquipment(allegiance);
  return options.find((o) => o.equipmentId === equipmentId);
}

/**
 * Returns the effective Penny cost and metadata for an Equipment item given the Warband's Allegiance.
 */
export function getEquipmentCostForAllegiance(
  eq: EquipmentRef,
  allegiance: AllegianceRef | undefined
): {
  cost: number;
  baseCost: number;
  isCommon: boolean;
  isAllegianceRare: boolean;
  isAvailableAtCreation: boolean;
  priceDiff: number;
  note?: string;
} {
  const isCommon = eq.rarity === 'Common';
  const allegianceOpt = getAllegianceEquipmentOption(allegiance, eq.id);
  const isAllegianceRare = Boolean(allegianceOpt);

  // Also check if Allegiance special rules forbid this Common item (Kindred Travel Light, Wildlings Stay Pure)
  let forbiddenByAllegiance = false;
  if (allegiance?.id === 'al-kindred') {
    if (
      eq.id === 'eq-heavy-armour' ||
      eq.id === 'eq-very-heavy-armour' ||
      eq.id === 'eq-heavy-shield' ||
      eq.id === 'eq-heavy-crossbow' ||
      eq.isBlackPowder
    ) {
      forbiddenByAllegiance = true;
    }
  } else if (allegiance?.id === 'al-wildlings' && eq.isBlackPowder) {
    forbiddenByAllegiance = true;
  }

  const effectiveCost = allegianceOpt ? allegianceOpt.cost : eq.cost;
  const isAvailableAtCreation = (isCommon || isAllegianceRare) && !forbiddenByAllegiance;

  return {
    cost: effectiveCost,
    baseCost: eq.cost,
    isCommon,
    isAllegianceRare,
    isAvailableAtCreation,
    priceDiff: effectiveCost - eq.cost,
    note: allegianceOpt?.note,
  };
}

/**
 * Returns the effective Signing-on Fee for a Species in a given Allegiance
 * (accounting for Stag Beetle Grub discounts for Witch Hunters, Wildlings, and Hillfolk).
 */
export function getSpeciesRecruitCostForAllegiance(
  species: SpeciesRef | undefined,
  allegiance: AllegianceRef | undefined
): {
  cost: number;
  baseCost: number;
  isDiscounted: boolean;
} {
  if (!species) {
    return { cost: 30, baseCost: 30, isDiscounted: false };
  }
  const overrides =
    allegiance?.startingSpeciesCostOverrides ??
    (allegiance ? ALLEGIANCE_SPECIES_COST_OVERRIDES[allegiance.id] : undefined);
  const overrideCost = overrides?.[species.id];
  if (overrideCost !== undefined) {
    return {
      cost: overrideCost,
      baseCost: species.cost,
      isDiscounted: overrideCost < species.cost,
    };
  }
  return {
    cost: species.cost,
    baseCost: species.cost,
    isDiscounted: false,
  };
}


