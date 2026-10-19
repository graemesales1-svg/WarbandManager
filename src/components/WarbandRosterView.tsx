import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  DiceValue,
  EquipmentRef,
  EquipmentSlot,
  EquippedOrStashedItem,
  Fighter,
  FighterRole,
  FighterStatus,
  MagicalArchetype,
  SkillOrSpellRef,
  StatDieKey,
  StatNumericModifiers,
} from '../types/game';
import {
  calculateWarbandPennyValue,
  calculateWarbandRating,
  computeFighterStats,
  computeFighterCombatBreakdown,
  findAvailableSlotForEquipment,
  formatItemDisplayName,
  formatSigned,
  getAllegianceStartingRareEquipment,
  getEarnedAdvancesCount,
  getEffectiveSlotsRequired,
  getEquipmentCostForAllegiance,
  getFighterFatePoints,
  getFighterSlotOccupancy,
  getItemQuantity,
  getNextXpThreshold,
  getSpeciesRecruitCostForAllegiance,
  getStartingFatePointsForRole,
  getSkillOrSpellPageReference,
  getValidSlotsForEquipment,
  isEquipmentStackable,
  MAX_FIGHTER_FATE_POINTS,
  StatKey,
  stepDie,
  validateEquipmentForFighter,
} from '../utils/gameMath';
import {
  StatRollAndBreakdownModal,
  ModalInspectTab,
} from './StatRollAndBreakdownModal';
import { SkillOrSpellDetailModal } from './SkillOrSpellDetailModal';
import {
  UserPlus,
  Coins,
  Sword,
  Shield,
  Dices,
  Sparkles,
  TrendingUp,
  Skull,
  Package,
  Trash2,
  Plus,
  Minus,
  Award,
  X,
} from 'lucide-react';

const ALL_MAGICAL_ARCHETYPES: MagicalArchetype[] = [
  'Channelling',
  'Dark',
  'Divine',
  'Elementalism',
  'Fate-weaving',
  'Illusionism',
  'Light',
  'Natural',
  'Necromancy',
  'Noble',
  'Unbound',
  'Wild',
];

const STAT_LABELS: Record<StatDieKey, string> = {
  move: 'Move (M)',
  strike: 'Strike (S)',
  block: 'Block (B)',
  ranged: 'Ranged (R)',
  nimbleness: 'Nimbleness (N)',
  concealment: 'Concealment (C)',
  awareness: 'Awareness (A)',
  fortitude: 'Fortitude (F)',
  presence: 'Presence (P)',
};

const ALL_STAT_KEYS: StatDieKey[] = [
  'move',
  'strike',
  'block',
  'ranged',
  'nimbleness',
  'concealment',
  'awareness',
  'fortitude',
  'presence',
];

const START_DIE_ORDER: DiceValue[] = ['D4', 'D6', 'D8', 'D10', 'D12', 'D20'];

function canIncreaseStartingDie(baseDie: DiceValue, currentBonusSteps: number): boolean {
  if (baseDie === '-') return false;
  const currentDie = stepDie(baseDie, currentBonusSteps);
  const idx = START_DIE_ORDER.indexOf(currentDie);
  const d12Idx = START_DIE_ORDER.indexOf('D12');
  return idx !== -1 && idx < d12Idx;
}

const STRONG_LADDER = ['sk-strong-1', 'sk-strong-2', 'sk-strong-3', 'sk-strong-4'];
const TOUGH_LADDER = ['sk-tough-1', 'sk-tough-2', 'sk-tough-3', 'sk-tough-4', 'sk-tough-5'];

function hasSkillOrHigherInLadder(
  ownedSkillIds: string[],
  reqId: string
): boolean {
  if (ownedSkillIds.includes(reqId)) return true;
  const strongIdx = STRONG_LADDER.indexOf(reqId);
  if (strongIdx !== -1) {
    return STRONG_LADDER.slice(strongIdx).some((id) => ownedSkillIds.includes(id));
  }
  const toughIdx = TOUGH_LADDER.indexOf(reqId);
  if (toughIdx !== -1) {
    return TOUGH_LADDER.slice(toughIdx).some((id) => ownedSkillIds.includes(id));
  }
  return false;
}

export function getFighterMagicalArchetypes(
  fighter: Fighter,
  allSkillsAndSpells: SkillOrSpellRef[]
): MagicalArchetype[] {
  const set = new Set<MagicalArchetype>();
  if (fighter.magicalArchetypes) {
    fighter.magicalArchetypes.forEach((a) => set.add(a));
  }
  if (fighter.magicalArchetype) {
    set.add(fighter.magicalArchetype);
  }
  for (const spId of fighter.learnedSpellIds) {
    const sp = allSkillsAndSpells.find((s) => s.id === spId);
    if (sp?.magicalArchetype) {
      set.add(sp.magicalArchetype);
    }
  }
  return Array.from(set);
}

function checkSkillQualification(
  entry: SkillOrSpellRef,
  speciesId: string,
  ownedSkillIds: string[],
  ownedSpellIds: string[],
  allSkillsAndSpells: SkillOrSpellRef[],
  fighterMagicArchetypes?: MagicalArchetype[],
  isFighterMagicUser?: boolean
): { qualified: boolean; reason?: string } {
  const hasAnyMagic =
    Boolean(isFighterMagicUser) ||
    ownedSpellIds.length > 0 ||
    Boolean(fighterMagicArchetypes && fighterMagicArchetypes.length > 0);

  if (entry.category === 'Magic Spell') {
    if (ownedSpellIds.includes(entry.id)) {
      return { qualified: false, reason: 'Already known' };
    }
    if (!hasAnyMagic) {
      return { qualified: false, reason: 'Not a Magic-user' };
    }
    if (
      fighterMagicArchetypes &&
      fighterMagicArchetypes.length > 0 &&
      entry.magicalArchetype &&
      !fighterMagicArchetypes.includes(entry.magicalArchetype)
    ) {
      return {
        qualified: false,
        reason: `Requires ${entry.magicalArchetype} Magic (unlocked: ${fighterMagicArchetypes.join(', ')})`,
      };
    }
    return { qualified: true };
  }

  // Already owns this exact skill (or higher tier of Strong/Tough)
  if (entry.id !== 'sk-gifted' && hasSkillOrHigherInLadder(ownedSkillIds, entry.id)) {
    return { qualified: false, reason: 'Already known' };
  }

  // Innate skills cannot normally be learned
  if (entry.category === 'Innate Skill') {
    return { qualified: false, reason: 'Innate Species Skill only' };
  }

  // Negative skills (Weak / Delicate) are from Magic / Injuries, not normal skill advances
  if (entry.id.startsWith('sk-weak-') || entry.id.startsWith('sk-delicate-')) {
    return { qualified: false, reason: 'Negative Skill (Magic/Injury)' };
  }

  // Requires at least 1 Spell (e.g. Gifted, Fae Blooded)
  if (
    (entry.requiresSpell || entry.id === 'sk-gifted' || entry.id === 'sk-fae-blooded') &&
    ownedSpellIds.length === 0 &&
    !hasAnyMagic
  ) {
    return {
      qualified: false,
      reason: 'Requires at least 1 Spell',
    };
  }

  // Species restriction (e.g. Lance Strike requires Shrew Knight Errant)
  if (
    entry.requiredSpeciesIds &&
    entry.requiredSpeciesIds.length > 0 &&
    !entry.requiredSpeciesIds.includes(speciesId)
  ) {
    return {
      qualified: false,
      reason: entry.requirementsText || 'Species requirement not met',
    };
  }

  // Prerequisite skills (e.g. Tough 4 requires Tough 3, Crippling Shot requires Wounding Shot)
  if (entry.prerequisiteSkillIds && entry.prerequisiteSkillIds.length > 0) {
    for (const reqId of entry.prerequisiteSkillIds) {
      if (!hasSkillOrHigherInLadder(ownedSkillIds, reqId)) {
        const reqSkill = allSkillsAndSpells.find((s) => s.id === reqId);
        return {
          qualified: false,
          reason: `Requires ${reqSkill?.name || reqId}`,
        };
      }
    }
  }

  return { qualified: true };
}

export const WarbandRosterView: React.FC = () => {
  const { activeWarband, rules, saveWarband } = useApp();

  const [showRecruitModal, setShowRecruitModal] = useState(false);
  const [selectedFighterForGear, setSelectedFighterForGear] = useState<Fighter | null>(null);
  const [selectedFighterForAdvance, setSelectedFighterForAdvance] = useState<Fighter | null>(
    null
  );

  const sortedSpecies = [...rules.species].sort((a, b) => a.name.localeCompare(b.name));
  const sortedEquipment = [...rules.equipment].sort((a, b) => a.name.localeCompare(b.name));
  const sortedSkillsAndSpells = [...rules.skillsAndSpells].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const learnableSkills = sortedSkillsAndSpells.filter(
    (s) => s.category !== 'Innate Skill' && s.category !== 'Magic Spell'
  );

  // Recruit Form State
  const [fName, setFName] = useState('');
  const [fTitle, setFTitle] = useState('');
  const [fRole, setFRole] = useState<FighterRole>('Henchbeast');
  const [fSpeciesId, setFSpeciesId] = useState(sortedSpecies[0]?.id || 'sp-adder');
  const [fNotes, setFNotes] = useState('');
  const [deductPennies, setDeductPennies] = useState(true);

  // Leader & Second Starting Bonus State
  const [leaderStatKey, setLeaderStatKey] = useState<StatDieKey>('strike');
  const [leaderSkillId, setLeaderSkillId] = useState('sk-parry');
  const [secondSkillId, setSecondSkillId] = useState('sk-parry');
  const [overrideRecruitSkillPrereqs, setOverrideRecruitSkillPrereqs] = useState(false);

  // Allegiance Starting Bonus State
  const [applyAllegianceBonus, setApplyAllegianceBonus] = useState(false);
  const [allegianceStatKey, setAllegianceStatKey] = useState<StatDieKey>('move');
  const [allegianceSkillId, setAllegianceSkillId] = useState('sk-strong-1');

  // Magic-User Recruitment State
  const [isMagicUser, setIsMagicUser] = useState(false);
  const [overrideMagicRestrictions, setOverrideMagicRestrictions] = useState(false);
  const [selectedMagicArchetype, setSelectedMagicArchetype] =
    useState<MagicalArchetype>('Natural');
  const [selectedSpellIds, setSelectedSpellIds] = useState<string[]>([]);

  // Recruit Starting Equipment State
  const [recruitItems, setRecruitItems] = useState<EquippedOrStashedItem[]>([]);
  const [recruitGearFilter, setRecruitGearFilter] = useState<
    'all' | 'allegiance_rare' | 'weapons_armour' | 'items_ammo' | 'ingredients'
  >('all');
  const [recruitEqId, setRecruitEqId] = useState<string>('eq-one-handed');
  const [recruitEqSlot, setRecruitEqSlot] = useState<EquipmentSlot>('Weapon 1');
  const [recruitEqQuantity, setRecruitEqQuantity] = useState<number>(1);
  const [recruitEqCustomName, setRecruitEqCustomName] = useState<string>('');
  const [overrideRecruitGearRestrictions, setOverrideRecruitGearRestrictions] =
    useState<boolean>(false);

  // Advance / Injury Modal State
  const [advStatKey, setAdvStatKey] = useState<keyof StatNumericModifiers>('strike');
  const [advSkillId, setAdvSkillId] = useState('sk-parry');
  const [overrideAdvSkillPrereqs, setOverrideAdvSkillPrereqs] = useState(false);
  const [giftedArchetype, setGiftedArchetype] = useState<MagicalArchetype>('Natural');
  const [postBattleArchetype, setPostBattleArchetype] =
    useState<MagicalArchetype>('Natural');
  const [postBattleArchetypeCountsAsAdvance, setPostBattleArchetypeCountsAsAdvance] =
    useState(false);
  const [overrideAdvArchetypeRestrictions, setOverrideAdvArchetypeRestrictions] =
    useState(false);
  const [advInjuryId, setAdvInjuryId] = useState(rules.injuries[0]?.id || '');

  // Gear Buy/Equip State
  const [buyEqId, setBuyEqId] = useState(sortedEquipment[0]?.id || '');
  const [buySlot, setBuySlot] = useState<EquipmentSlot>(
    sortedEquipment[0]?.defaultSlot || 'Weapon 1'
  );
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [buyCustomName, setBuyCustomName] = useState('');
  const [freeGrant, setFreeGrant] = useState(false);
  const [overrideGearRestrictions, setOverrideGearRestrictions] = useState(false);
  const [inspectTarget, setInspectTarget] = useState<{
    fighterId: string;
    tab: ModalInspectTab;
  } | null>(null);
  const [selectedSkillOrSpell, setSelectedSkillOrSpell] = useState<{
    fighterId: string;
    skillOrSpellId: string;
  } | null>(null);

  if (!activeWarband) {
    return (
      <div className="p-8 text-center text-stone-400">
        No warband selected. Create a new warband from the top bar!
      </div>
    );
  }

  const allegiance = rules.allegiances.find((a) => a.id === activeWarband.allegianceId);
  const startingBonusRule = allegiance?.startingBonus;
  const activeRosterFighters = activeWarband.fighters.filter(
    (f) => f.status !== 'Dead' && f.status !== 'Retired'
  );
  const hasActiveLeader = activeRosterFighters.some((f) => f.role === 'Leader');
  const hasActiveSecond = activeRosterFighters.some((f) => f.role === 'Second');
  const usedAllegianceBonusCount = activeRosterFighters.filter(
    (f) => f.usedAllegianceBonus
  ).length;
  const maxAllegianceBonuses = startingBonusRule?.maxModels ?? 0;
  const canUseMoreAllegianceBonuses = usedAllegianceBonusCount < maxAllegianceBonuses;

  // Magic-User Allegiance & Species Rules
  const activeMagicUsersCount = activeRosterFighters.filter(
    (f) => f.isMagicUser || f.learnedSpellIds.length > 0
  ).length;
  const maxMagicUsers = allegiance?.maxMagicUsers;
  const magicUserLimitReached =
    maxMagicUsers !== undefined && activeMagicUsersCount >= maxMagicUsers;

  const selectedSpecies = rules.species.find((s) => s.id === fSpeciesId);
  const speciesForbidsMagic = Boolean(selectedSpecies?.cannotBeMagicUser);
  const allegianceRequiresMagicUser = Boolean(
    allegiance?.allModelsMustBeMagicUsers ||
      (allegiance?.leaderAndSecondMustBeMagicUserOrStableGhast &&
        (fRole === 'Leader' || fRole === 'Second') &&
        !speciesForbidsMagic)
  );
  const allowedArchetypesForAllegiance: MagicalArchetype[] =
    allegiance?.allowedMagicArchetypes && allegiance.allowedMagicArchetypes.length > 0
      ? allegiance.allowedMagicArchetypes
      : ALL_MAGICAL_ARCHETYPES;

  const spellsForSelectedArchetype = sortedSkillsAndSpells.filter(
    (s) =>
      s.category === 'Magic Spell' && s.magicalArchetype === selectedMagicArchetype
  );

  const warbandRating = calculateWarbandRating(activeWarband, rules);
  const stashedItems = activeWarband.inventory.filter((i) => i.assignedFighterId === null);

  const allegianceRareOptions = getAllegianceStartingRareEquipment(allegiance);
  const allegianceRareIds = new Set(allegianceRareOptions.map((o) => o.equipmentId));
  const allegianceRareEquipmentList = allegianceRareOptions
    .map((o) => rules.equipment.find((e) => e.id === o.equipmentId))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  // Species recruitment cost (accounts for Stag Beetle Grub discounts for Witch Hunters, Wildlings, Hillfolk)
  const speciesCostInfo = getSpeciesRecruitCostForAllegiance(selectedSpecies, allegiance);
  const baseSpeciesRecruitCost = speciesCostInfo.cost;
  const recruitGearTotalCost = recruitItems.reduce((sum, i) => sum + i.purchaseCost, 0);
  const totalRecruitCost = baseSpeciesRecruitCost + recruitGearTotalCost;

  // Build a live preview Fighter & Warband so equipment validation (Strong requirements, Magic-user requirements, slots) works dynamically inside the Recruit modal
  const previewEffectiveIsMagicUser =
    isMagicUser || (allegianceRequiresMagicUser && !overrideMagicRestrictions);
  const previewLearnedSkills: string[] = [];
  if (fRole === 'Leader' && leaderSkillId) {
    previewLearnedSkills.push(leaderSkillId);
  } else if (fRole === 'Second' && secondSkillId) {
    previewLearnedSkills.push(secondSkillId);
  }
  if (
    applyAllegianceBonus &&
    canUseMoreAllegianceBonuses &&
    startingBonusRule?.type === 'skill' &&
    allegianceSkillId
  ) {
    previewLearnedSkills.push(allegianceSkillId);
  }
  if (previewEffectiveIsMagicUser && selectedSpellIds.length > 0) {
    const tier = Math.min(8, selectedSpellIds.length);
    previewLearnedSkills.push(`sk-weak-${tier}`, `sk-delicate-${tier}`);
  }

  const previewRecruitFighter: Fighter = {
    id: 'RECRUIT_PREVIEW',
    name: fName.trim() || selectedSpecies?.name || 'New Recruit',
    role: fRole,
    speciesId: selectedSpecies?.id || fSpeciesId,
    status: 'Active',
    recruitmentCost: baseSpeciesRecruitCost,
    xp: 0,
    advancesCount: 0,
    isMagicUser: previewEffectiveIsMagicUser,
    magicalArchetype: previewEffectiveIsMagicUser ? selectedMagicArchetype : undefined,
    magicalArchetypes: previewEffectiveIsMagicUser ? [selectedMagicArchetype] : [],
    statModifiers: {
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
    },
    learnedSkillIds: previewLearnedSkills,
    learnedSpellIds: previewEffectiveIsMagicUser ? selectedSpellIds : [],
    injuryIds: [],
    advanceHistory: [],
    notes: '',
    currentWounds: selectedSpecies?.stats.wounds || 17,
    fatePoints: getStartingFatePointsForRole(fRole),
    conditions: [],
  };

  const previewRecruitWarband = {
    ...activeWarband,
    fighters: [...activeWarband.fighters, previewRecruitFighter],
    inventory: [...activeWarband.inventory, ...recruitItems],
  };

  const openRecruitModal = () => {
    const defaultRole: FighterRole = !hasActiveLeader
      ? 'Leader'
      : !hasActiveSecond
      ? 'Second'
      : 'Henchbeast';
    setFRole(defaultRole);
    setApplyAllegianceBonus(false);
    setOverrideRecruitSkillPrereqs(false);
    setOverrideMagicRestrictions(false);
    setRecruitItems([]);
    setRecruitGearFilter('all');
    setRecruitEqId('eq-one-handed');
    setRecruitEqSlot('Weapon 1');
    setRecruitEqQuantity(1);
    setRecruitEqCustomName('');
    setOverrideRecruitGearRestrictions(false);

    const defaultArchetype: MagicalArchetype =
      allowedArchetypesForAllegiance[0] || 'Natural';
    setSelectedMagicArchetype(defaultArchetype);
    setSelectedSpellIds([]);

    const initialSpecies = rules.species.find((s) => s.id === fSpeciesId);
    const mustBeMage = Boolean(
      allegiance?.allModelsMustBeMagicUsers ||
        (allegiance?.leaderAndSecondMustBeMagicUserOrStableGhast &&
          (defaultRole === 'Leader' || defaultRole === 'Second') &&
          !initialSpecies?.cannotBeMagicUser)
    );
    setIsMagicUser(mustBeMage && !magicUserLimitReached && !initialSpecies?.cannotBeMagicUser);

    if (startingBonusRule?.type === 'stat' && startingBonusRule.allowedStats?.[0]) {
      setAllegianceStatKey(startingBonusRule.allowedStats[0]);
    } else if (startingBonusRule?.type === 'skill' && startingBonusRule.allowedSkillIds?.[0]) {
      setAllegianceSkillId(startingBonusRule.allowedSkillIds[0]);
    }
    setShowRecruitModal(true);
  };

  const handleAddRecruitGear = (eqToAdd?: EquipmentRef, customQty?: number) => {
    const eq = eqToAdd || rules.equipment.find((x) => x.id === recruitEqId);
    if (!eq) return;

    const costMeta = getEquipmentCostForAllegiance(eq, allegiance);
    if (!overrideRecruitGearRestrictions && !costMeta.isAvailableAtCreation) {
      alert(
        `${eq.name} is not available at character creation for ${
          allegiance?.name || 'this warband'
        }. Check "Override equipment & rarity restrictions" to add it anyway.`
      );
      return;
    }

    const stackable = isEquipmentStackable(eq);
    const qty = stackable
      ? Math.max(1, Math.min(99, customQty ?? recruitEqQuantity ?? 1))
      : 1;

    const validation = validateEquipmentForFighter(
      eq,
      previewRecruitFighter,
      previewRecruitWarband,
      rules,
      eqToAdd ? undefined : recruitEqSlot
    );

    if (!overrideRecruitGearRestrictions && !validation.valid) {
      alert(
        `Cannot equip ${eq.name} on ${previewRecruitFighter.name}: ${validation.reason}\n\nCheck "Override equipment & rarity restrictions" if you wish to equip this anyway.`
      );
      return;
    }

    const unitCost = costMeta.cost;
    const totalItemCost = unitCost * qty;
    const assignedSlot: EquipmentSlot =
      !overrideRecruitGearRestrictions && validation.suggestedSlot
        ? validation.suggestedSlot
        : eqToAdd
        ? validation.suggestedSlot || eq.defaultSlot
        : recruitEqSlot;

    const existingStack = stackable
      ? recruitItems.find((i) => i.equipmentId === eq.id && !i.isConsumed)
      : undefined;

    if (existingStack) {
      const nextQty = getItemQuantity(existingStack) + qty;
      setRecruitItems((prev) =>
        prev.map((i) =>
          i.instanceId === existingStack.instanceId
            ? {
                ...i,
                quantity: nextQty,
                purchaseCost: i.purchaseCost + totalItemCost,
                customName:
                  (!eqToAdd && recruitEqCustomName.trim()) || i.customName,
              }
            : i
        )
      );
    } else {
      const newItem: EquippedOrStashedItem = {
        instanceId: crypto.randomUUID(),
        equipmentId: eq.id,
        assignedFighterId: 'RECRUIT_PREVIEW',
        slot: assignedSlot,
        purchaseCost: totalItemCost,
        quantity: stackable ? qty : undefined,
        customName: !eqToAdd ? recruitEqCustomName.trim() || undefined : undefined,
      };
      setRecruitItems((prev) => [...prev, newItem]);
    }

    if (!eqToAdd) {
      setRecruitEqCustomName('');
      setRecruitEqQuantity(1);
    }
  };

  const handleAdjustRecruitGearQuantity = (instanceId: string, delta: number) => {
    setRecruitItems((prev) => {
      const target = prev.find((i) => i.instanceId === instanceId);
      if (!target) return prev;
      const eq = rules.equipment.find((e) => e.id === target.equipmentId);
      const unitCost = eq ? getEquipmentCostForAllegiance(eq, allegiance).cost : 1;
      const currentQty = getItemQuantity(target);
      const nextQty = currentQty + delta;
      if (nextQty <= 0) {
        return prev.filter((i) => i.instanceId !== instanceId);
      }
      return prev.map((i) =>
        i.instanceId === instanceId
          ? {
              ...i,
              quantity: nextQty,
              purchaseCost: Math.max(0, i.purchaseCost + unitCost * delta),
            }
          : i
      );
    });
  };

  const handleRemoveRecruitGear = (instanceId: string) => {
    setRecruitItems((prev) => prev.filter((i) => i.instanceId !== instanceId));
  };

  const handleToggleSpell = (spellId: string) => {
    setSelectedSpellIds((prev) =>
      prev.includes(spellId) ? prev.filter((id) => id !== spellId) : [...prev, spellId]
    );
  };

  const handleRecruitFighter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fName.trim() || !selectedSpecies) return;

    if (fRole === 'Leader' && hasActiveLeader) {
      alert('Your warband already has an active Leader!');
      return;
    }
    if (fRole === 'Second' && hasActiveSecond) {
      alert('Your warband already has an active Second!');
      return;
    }

    // Validate Magic-user Allegiance & Species rules (unless overridden)
    const effectiveIsMagicUser =
      isMagicUser || (allegianceRequiresMagicUser && !overrideMagicRestrictions);

    if (!overrideMagicRestrictions) {
      if (allegianceRequiresMagicUser && !effectiveIsMagicUser) {
        alert(
          `${allegiance?.name} rules require this model to be a Magic-user (${allegiance?.magicUserRuleNote}). Check "Make this beast a Magic-user" or enable "Override magic restrictions".`
        );
        return;
      }
      if (effectiveIsMagicUser && speciesForbidsMagic) {
        alert(
          `${selectedSpecies.name} cannot use Spells according to the 2.0 rulebook. Uncheck "Make this beast a Magic-user" or enable "Override magic restrictions".`
        );
        return;
      }
      if (effectiveIsMagicUser && magicUserLimitReached) {
        alert(
          `${allegiance?.name} allows a maximum of ${maxMagicUsers} Magic-user(s) in the Band (${allegiance?.magicUserRuleNote}). Uncheck "Make this beast a Magic-user" or enable "Override magic restrictions".`
        );
        return;
      }
      if (
        effectiveIsMagicUser &&
        !allowedArchetypesForAllegiance.includes(selectedMagicArchetype)
      ) {
        alert(
          `${selectedMagicArchetype} Magic is not an allowed Magical Archetype for ${allegiance?.name}. Choose an allowed archetype or enable "Override magic restrictions".`
        );
        return;
      }
    }

    if (effectiveIsMagicUser && selectedSpellIds.length === 0) {
      alert(
        'Please select at least one Spell from the chosen Magical Archetype for this Magic-user.'
      );
      return;
    }

    if (deductPennies && activeWarband.treasuryPennies < totalRecruitCost) {
      alert(
        `Not enough Pennies in the Treasury (${activeWarband.treasuryPennies}p available, ${totalRecruitCost}p required for Signing-on Fee + Starting Gear). Uncheck "Deduct from Treasury" if recruiting for free.`
      );
      return;
    }

    const statModifiers: StatNumericModifiers = {
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
    const learnedSkillIds: string[] = [];
    const learnedSpellIds: string[] = [];
    const advanceHistory: Fighter['advanceHistory'] = [];
    const today = new Date().toISOString().slice(0, 10);

    // Pre-calculate Magic-user Weak (X) & Delicate (X) so Leader/Second starting skill prerequisites can benefit (e.g. Intense or Fae Blooded)
    const recruitSpellIds =
      effectiveIsMagicUser && selectedSpellIds.length > 0 ? [...selectedSpellIds] : [];
    const recruitPenaltySkillIds: string[] = [];
    if (recruitSpellIds.length > 0) {
      const tier = Math.min(8, recruitSpellIds.length);
      recruitPenaltySkillIds.push(`sk-weak-${tier}`, `sk-delicate-${tier}`);
    }

    // 1. Apply Role Starting Bonuses
    if (fRole === 'Leader') {
      const baseDie = selectedSpecies.stats[leaderStatKey];
      if (!canIncreaseStartingDie(baseDie, 0)) {
        alert(
          `${STAT_LABELS[leaderStatKey]} (${baseDie}) cannot be increased above D12 at creation. Please choose another statistic.`
        );
        return;
      }
      const chosenSkill = rules.skillsAndSpells.find((s) => s.id === leaderSkillId);
      if (chosenSkill && !overrideRecruitSkillPrereqs) {
        const qual = checkSkillQualification(
          chosenSkill,
          selectedSpecies.id,
          [...selectedSpecies.innateSkillIds, ...recruitPenaltySkillIds],
          recruitSpellIds,
          rules.skillsAndSpells,
          effectiveIsMagicUser ? [selectedMagicArchetype] : [],
          effectiveIsMagicUser
        );
        if (!qual.qualified) {
          alert(
            `Cannot select ${chosenSkill.name} (${qual.reason}). Choose a qualifying skill or check "Override skill prerequisites".`
          );
          return;
        }
      }
      statModifiers[leaderStatKey] += 1;
      const upgradedDie = stepDie(baseDie, 1);
      if (chosenSkill) {
        learnedSkillIds.push(chosenSkill.id);
      }
      advanceHistory.push({
        id: crypto.randomUUID(),
        date: today,
        description: `Leader Starting Bonus (+2 Levels): +1 ${STAT_LABELS[leaderStatKey]} (${baseDie} → ${upgradedDie})${
          chosenSkill ? ` & Learned ${chosenSkill.name}` : ''
        }`,
      });
    } else if (fRole === 'Second') {
      const chosenSkill = rules.skillsAndSpells.find((s) => s.id === secondSkillId);
      if (chosenSkill && !overrideRecruitSkillPrereqs) {
        const qual = checkSkillQualification(
          chosenSkill,
          selectedSpecies.id,
          [...selectedSpecies.innateSkillIds, ...recruitPenaltySkillIds],
          recruitSpellIds,
          rules.skillsAndSpells,
          effectiveIsMagicUser ? [selectedMagicArchetype] : [],
          effectiveIsMagicUser
        );
        if (!qual.qualified) {
          alert(
            `Cannot select ${chosenSkill.name} (${qual.reason}). Choose a qualifying skill or check "Override skill prerequisites".`
          );
          return;
        }
      }
      if (chosenSkill) {
        learnedSkillIds.push(chosenSkill.id);
      }
      advanceHistory.push({
        id: crypto.randomUUID(),
        date: today,
        description: `Second Starting Bonus (+1 Level): Learned ${
          chosenSkill?.name || 'Starting Skill'
        }`,
      });
    }

    // 2. Apply Allegiance Starting Bonus (if checked and available)
    const willApplyAllegiance =
      applyAllegianceBonus && canUseMoreAllegianceBonuses && !!startingBonusRule;
    if (willApplyAllegiance && startingBonusRule) {
      if (startingBonusRule.type === 'stat') {
        const baseDie = selectedSpecies.stats[allegianceStatKey];
        const priorSteps = statModifiers[allegianceStatKey];
        if (!canIncreaseStartingDie(baseDie, priorSteps)) {
          alert(
            `${STAT_LABELS[allegianceStatKey]} is already at or above D12 and cannot be increased further at creation.`
          );
          return;
        }
        const beforeDie = stepDie(baseDie, priorSteps);
        statModifiers[allegianceStatKey] += 1;
        const afterDie = stepDie(baseDie, statModifiers[allegianceStatKey]);
        advanceHistory.push({
          id: crypto.randomUUID(),
          date: today,
          description: `${allegiance?.name} Bonus — ${startingBonusRule.name} (+1 Level): +1 ${STAT_LABELS[allegianceStatKey]} (${beforeDie} → ${afterDie})`,
        });
      } else if (startingBonusRule.type === 'skill') {
        const bonusSk = rules.skillsAndSpells.find((s) => s.id === allegianceSkillId);
        if (bonusSk) {
          learnedSkillIds.push(bonusSk.id);
          advanceHistory.push({
            id: crypto.randomUUID(),
            date: today,
            description: `${allegiance?.name} Bonus — ${startingBonusRule.name} (+1 Level): Gained ${bonusSk.name}`,
          });
        }
      }
    }

    // 3. Apply Magic-user Spells & Automatic Cumulative Weak (X) and Delicate (X)
    if (effectiveIsMagicUser && selectedSpellIds.length > 0) {
      const spellCount = selectedSpellIds.length;
      const tier = Math.min(8, spellCount);
      const weakSkillId = `sk-weak-${tier}`;
      const delicateSkillId = `sk-delicate-${tier}`;

      if (!learnedSkillIds.includes(weakSkillId)) {
        learnedSkillIds.push(weakSkillId);
      }
      if (!learnedSkillIds.includes(delicateSkillId)) {
        learnedSkillIds.push(delicateSkillId);
      }
      learnedSpellIds.push(...selectedSpellIds);

      const spellNames = selectedSpellIds
        .map((id) => rules.skillsAndSpells.find((s) => s.id === id)?.name || id)
        .join(', ');

      advanceHistory.push({
        id: crypto.randomUUID(),
        date: today,
        description: `Magic-user (${selectedMagicArchetype} Magic • ${spellCount} Spell${
          spellCount === 1 ? '' : 's'
        }): Learned ${spellNames} • Imposed Weak (${spellCount}) & Delicate (${spellCount})`,
      });
    }

    const roleStartingAdvances = fRole === 'Leader' ? 2 : fRole === 'Second' ? 1 : 0;
    const startingAdvances = roleStartingAdvances + (willApplyAllegiance ? 1 : 0);
    const newFighterId = crypto.randomUUID();

    const newFighter: Fighter = {
      id: newFighterId,
      name: fName.trim(),
      title: fTitle.trim() || undefined,
      role: fRole,
      speciesId: selectedSpecies.id,
      status: 'Active',
      recruitmentCost: baseSpeciesRecruitCost,
      xp: 0,
      advancesCount: startingAdvances,
      usedAllegianceBonus: willApplyAllegiance,
      isMagicUser: effectiveIsMagicUser,
      magicalArchetype: effectiveIsMagicUser ? selectedMagicArchetype : undefined,
      magicalArchetypes: effectiveIsMagicUser ? [selectedMagicArchetype] : [],
      statModifiers,
      learnedSkillIds,
      learnedSpellIds,
      injuryIds: [],
      advanceHistory,
      notes: fNotes.trim(),
      currentWounds: selectedSpecies.stats.wounds || 17,
      fatePoints: getStartingFatePointsForRole(fRole),
      conditions: [],
    };

    const assignedRecruitItems: EquippedOrStashedItem[] = recruitItems.map((item) => ({
      ...item,
      assignedFighterId: newFighterId,
    }));

    const gearSummary =
      assignedRecruitItems.length > 0
        ? ` + Starting Gear (${assignedRecruitItems
            .map((i) => {
              const eq = rules.equipment.find((e) => e.id === i.equipmentId);
              return formatItemDisplayName(i, eq);
            })
            .join(', ')} — ${recruitGearTotalCost}p)`
        : '';

    const newBalance = deductPennies
      ? activeWarband.treasuryPennies - totalRecruitCost
      : activeWarband.treasuryPennies;

    await saveWarband({
      ...activeWarband,
      treasuryPennies: newBalance,
      fighters: [...activeWarband.fighters, newFighter],
      inventory: [...activeWarband.inventory, ...assignedRecruitItems],
      treasuryLog: deductPennies
        ? [
            {
              id: crypto.randomUUID(),
              date: today,
              deltaPennies: -totalRecruitCost,
              reason: `Recruited ${newFighter.name} (${selectedSpecies.name} ${newFighter.role}, ${baseSpeciesRecruitCost}p)${gearSummary}`,
              balanceAfter: newBalance,
            },
            ...activeWarband.treasuryLog,
          ]
        : activeWarband.treasuryLog,
    });

    setFName('');
    setFTitle('');
    setFNotes('');
    setApplyAllegianceBonus(false);
    setIsMagicUser(false);
    setSelectedSpellIds([]);
    setRecruitItems([]);
    setShowRecruitModal(false);
  };

  const handleAdjustXp = async (fighter: Fighter, delta: number) => {
    const nextXp = Math.max(0, fighter.xp + delta);
    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id ? { ...f, xp: nextXp } : f
    );
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
  };

  const handleAdjustFate = async (fighter: Fighter, delta: number) => {
    const currentFate = getFighterFatePoints(fighter);
    const nextFate = Math.max(
      0,
      Math.min(MAX_FIGHTER_FATE_POINTS, currentFate + delta)
    );
    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id ? { ...f, fatePoints: nextFate } : f
    );
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
  };

  const handleStatusChange = async (fighter: Fighter, status: FighterStatus) => {
    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id ? { ...f, status } : f
    );
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
  };

  const handleDeleteFighter = async (fighter: Fighter) => {
    if (
      !confirm(
        `Remove ${fighter.name} from the roster? Any equipped items will be returned to your Den Stash.`
      )
    ) {
      return;
    }
    const updatedInventory = activeWarband.inventory.map((item) =>
      item.assignedFighterId === fighter.id ? { ...item, assignedFighterId: null } : item
    );
    const updatedFighters = activeWarband.fighters.filter((f) => f.id !== fighter.id);
    await saveWarband({
      ...activeWarband,
      fighters: updatedFighters,
      inventory: updatedInventory,
    });
  };

  // Buy & Equip Directly to Fighter
  const handleBuyGearForFighter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFighterForGear) return;
    const eq = rules.equipment.find((x) => x.id === buyEqId);
    if (!eq) return;

    const stackable = isEquipmentStackable(eq);
    const qty = stackable ? Math.max(1, Math.min(99, buyQuantity || 1)) : 1;

    const validation = validateEquipmentForFighter(
      eq,
      selectedFighterForGear,
      activeWarband,
      rules,
      buySlot
    );
    if (!overrideGearRestrictions && !validation.valid) {
      alert(
        `Cannot equip ${eq.name} on ${selectedFighterForGear.name}: ${validation.reason}\n\nCheck "Override equipment & slot restrictions" if you wish to equip this anyway.`
      );
      return;
    }

    const unitCost = getEquipmentCostForAllegiance(eq, allegiance).cost;
    const totalValueCost = unitCost * qty;
    const treasuryCost = freeGrant ? 0 : totalValueCost;
    if (treasuryCost > activeWarband.treasuryPennies) {
      alert(
        `Insufficient Pennies (${activeWarband.treasuryPennies}p in Treasury, ${treasuryCost}p needed for ${qty}x ${eq.name}).`
      );
      return;
    }

    const assignedSlot: EquipmentSlot =
      !overrideGearRestrictions && validation.suggestedSlot
        ? validation.suggestedSlot
        : buySlot;

    // Check if fighter already carries a stack of this stackable item
    const existingStack = stackable
      ? activeWarband.inventory.find(
          (i) =>
            i.assignedFighterId === selectedFighterForGear.id &&
            i.equipmentId === eq.id &&
            !i.isConsumed
        )
      : undefined;

    let nextInventory: EquippedOrStashedItem[];
    if (existingStack) {
      const nextQty = getItemQuantity(existingStack) + qty;
      nextInventory = activeWarband.inventory.map((i) =>
        i.instanceId === existingStack.instanceId
          ? {
              ...i,
              quantity: nextQty,
              purchaseCost: i.purchaseCost + totalValueCost,
              customName: buyCustomName.trim() || i.customName,
            }
          : i
      );
    } else {
      const newItem: EquippedOrStashedItem = {
        instanceId: crypto.randomUUID(),
        equipmentId: eq.id,
        assignedFighterId: selectedFighterForGear.id,
        slot: assignedSlot,
        purchaseCost: totalValueCost,
        quantity: stackable ? qty : undefined,
        customName: buyCustomName.trim() || undefined,
      };
      nextInventory = [...activeWarband.inventory, newItem];
    }

    const newBalance = activeWarband.treasuryPennies - treasuryCost;
    await saveWarband({
      ...activeWarband,
      treasuryPennies: newBalance,
      inventory: nextInventory,
      treasuryLog:
        treasuryCost > 0
          ? [
              {
                id: crypto.randomUUID(),
                date: new Date().toISOString().slice(0, 10),
                deltaPennies: -treasuryCost,
                reason: `Purchased ${qty > 1 ? `${qty}x ` : ''}${eq.name} for ${selectedFighterForGear.name}`,
                balanceAfter: newBalance,
              },
              ...activeWarband.treasuryLog,
            ]
          : activeWarband.treasuryLog,
    });
    setBuyCustomName('');
    setBuyQuantity(1);
  };

  const handleAdjustStackQuantity = async (
    item: EquippedOrStashedItem,
    delta: number,
    deductFromTreasury: boolean
  ) => {
    const eq = rules.equipment.find((e) => e.id === item.equipmentId);
    if (!eq) return;
    const currentQty = getItemQuantity(item);
    const nextQty = currentQty + delta;

    if (nextQty <= 0) {
      // Remove stack completely
      const updatedInv = activeWarband.inventory.filter(
        (i) => i.instanceId !== item.instanceId
      );
      await saveWarband({ ...activeWarband, inventory: updatedInv });
      return;
    }

    const unitCost = getEquipmentCostForAllegiance(eq, allegiance).cost;
    const treasuryCost = delta > 0 && deductFromTreasury ? unitCost * delta : 0;
    if (treasuryCost > activeWarband.treasuryPennies) {
      alert(
        `Insufficient Pennies (${activeWarband.treasuryPennies}p in Treasury, ${treasuryCost}p needed).`
      );
      return;
    }

    const nextPurchaseCost =
      delta > 0
        ? item.purchaseCost + unitCost * delta
        : Math.max(0, Math.round((item.purchaseCost * nextQty) / currentQty));

    const updatedInv = activeWarband.inventory.map((i) =>
      i.instanceId === item.instanceId
        ? { ...i, quantity: nextQty, purchaseCost: nextPurchaseCost }
        : i
    );
    const newBalance = activeWarband.treasuryPennies - treasuryCost;

    await saveWarband({
      ...activeWarband,
      treasuryPennies: newBalance,
      inventory: updatedInv,
      treasuryLog:
        treasuryCost > 0
          ? [
              {
                id: crypto.randomUUID(),
                date: new Date().toISOString().slice(0, 10),
                deltaPennies: -treasuryCost,
                reason: `Purchased +${delta} ${eq.name}`,
                balanceAfter: newBalance,
              },
              ...activeWarband.treasuryLog,
            ]
          : activeWarband.treasuryLog,
    });
  };

  const handleMoveItem = async (instanceId: string, targetFighterId: string | null) => {
    const itemToMove = activeWarband.inventory.find((i) => i.instanceId === instanceId);
    if (!itemToMove) return;

    const eq = rules.equipment.find((e) => e.id === itemToMove.equipmentId);
    const stackable = isEquipmentStackable(eq);
    let nextSlot: EquipmentSlot = itemToMove.slot;

    if (targetFighterId !== null) {
      const targetFighter = activeWarband.fighters.find((f) => f.id === targetFighterId);
      if (targetFighter && eq) {
        const validation = validateEquipmentForFighter(
          eq,
          targetFighter,
          activeWarband,
          rules
        );
        if (!overrideGearRestrictions && !validation.valid) {
          alert(
            `Cannot equip ${itemToMove.customName || eq.name} on ${targetFighter.name}: ${validation.reason}\n\nCheck "Override equipment & slot restrictions" if you wish to equip this anyway.`
          );
          return;
        }
        if (validation.suggestedSlot) {
          nextSlot = validation.suggestedSlot;
        }

        // If stackable and target fighter already has a stack of this item, merge into existing stack
        if (stackable) {
          const existingOnFighter = activeWarband.inventory.find(
            (i) =>
              i.instanceId !== instanceId &&
              i.assignedFighterId === targetFighterId &&
              i.equipmentId === eq.id &&
              !i.isConsumed
          );
          if (existingOnFighter) {
            const mergedQty =
              getItemQuantity(existingOnFighter) + getItemQuantity(itemToMove);
            const mergedCost = existingOnFighter.purchaseCost + itemToMove.purchaseCost;
            const updatedInv = activeWarband.inventory
              .filter((i) => i.instanceId !== instanceId)
              .map((i) =>
                i.instanceId === existingOnFighter.instanceId
                  ? { ...i, quantity: mergedQty, purchaseCost: mergedCost }
                  : i
              );
            await saveWarband({ ...activeWarband, inventory: updatedInv });
            return;
          }
        }
      }
    } else if (stackable && eq) {
      // Moving to Den Stash: merge with an existing stashed stack of the same item if present
      const existingInStash = activeWarband.inventory.find(
        (i) =>
          i.instanceId !== instanceId &&
          i.assignedFighterId === null &&
          i.equipmentId === eq.id &&
          !i.isConsumed &&
          !i.customName &&
          !itemToMove.customName
      );
      if (existingInStash) {
        const mergedQty =
          getItemQuantity(existingInStash) + getItemQuantity(itemToMove);
        const mergedCost = existingInStash.purchaseCost + itemToMove.purchaseCost;
        const updatedInv = activeWarband.inventory
          .filter((i) => i.instanceId !== instanceId)
          .map((i) =>
            i.instanceId === existingInStash.instanceId
              ? { ...i, quantity: mergedQty, purchaseCost: mergedCost }
              : i
          );
        await saveWarband({ ...activeWarband, inventory: updatedInv });
        return;
      }
    }

    const updatedInv = activeWarband.inventory.map((item) =>
      item.instanceId === instanceId
        ? { ...item, assignedFighterId: targetFighterId, slot: nextSlot }
        : item
    );
    await saveWarband({ ...activeWarband, inventory: updatedInv });
  };

  // Apply Stat Advance
  const handleApplyStatAdvance = async (fighter: Fighter, delta: number) => {
    const currentVal = fighter.statModifiers[advStatKey];
    const nextModifiers: StatNumericModifiers = {
      ...fighter.statModifiers,
      [advStatKey]: currentVal + delta,
    };
    const label = `${delta > 0 ? '+' : ''}${delta} ${advStatKey.toUpperCase()} Advance`;
    const updatedFighter: Fighter = {
      ...fighter,
      advancesCount: Math.max(0, fighter.advancesCount + (delta > 0 ? 1 : 0)),
      statModifiers: nextModifiers,
      advanceHistory: [
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          description: label,
        },
        ...fighter.advanceHistory,
      ],
    };

    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id ? updatedFighter : f
    );
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
    setSelectedFighterForAdvance(updatedFighter);
  };

  // Learn Skill or Spell
  const handleLearnSkillOrSpell = async (fighter: Fighter) => {
    const entry = rules.skillsAndSpells.find((s) => s.id === advSkillId);
    if (!entry) return;
    const isSpell = entry.category === 'Magic Spell';
    const unlocksArchetype = entry.id === 'sk-gifted' || entry.id === 'sk-hedge-magic';

    const sp = rules.species.find((s) => s.id === fighter.speciesId);
    const ownedSkillIds = [...(sp?.innateSkillIds ?? []), ...fighter.learnedSkillIds];
    const currentArchetypes = getFighterMagicalArchetypes(fighter, rules.skillsAndSpells);

    if (!overrideAdvSkillPrereqs) {
      const qual = checkSkillQualification(
        entry,
        fighter.speciesId,
        ownedSkillIds,
        fighter.learnedSpellIds,
        rules.skillsAndSpells,
        currentArchetypes,
        Boolean(
          fighter.isMagicUser ||
            fighter.learnedSpellIds.length > 0 ||
            currentArchetypes.length > 0
        )
      );
      if (!qual.qualified) {
        alert(
          `${fighter.name} does not qualify for ${entry.name} (${qual.reason}). Choose a qualifying skill or check "Override skill prerequisites".`
        );
        return;
      }
      if (unlocksArchetype) {
        if (currentArchetypes.includes(giftedArchetype)) {
          alert(
            `${fighter.name} already has access to ${giftedArchetype} Magic! Please choose a different Magical Archetype.`
          );
          return;
        }
        if (!allowedArchetypesForAllegiance.includes(giftedArchetype)) {
          alert(
            `${giftedArchetype} Magic is not an allowed Magical Archetype for ${allegiance?.name}. Choose an allowed archetype or check "Override skill prerequisites".`
          );
          return;
        }
      }
    } else {
      if (isSpell && fighter.learnedSpellIds.includes(entry.id)) return;
      if (!isSpell && entry.id !== 'sk-gifted' && fighter.learnedSkillIds.includes(entry.id))
        return;
    }

    const nextArchetypes = [...currentArchetypes];
    if (unlocksArchetype && !nextArchetypes.includes(giftedArchetype)) {
      nextArchetypes.push(giftedArchetype);
    } else if (
      isSpell &&
      entry.magicalArchetype &&
      !nextArchetypes.includes(entry.magicalArchetype)
    ) {
      nextArchetypes.push(entry.magicalArchetype);
    }

    const updatedFighter: Fighter = {
      ...fighter,
      advancesCount: fighter.advancesCount + 1,
      isMagicUser:
        fighter.isMagicUser ||
        isSpell ||
        unlocksArchetype ||
        nextArchetypes.length > 0,
      magicalArchetype: nextArchetypes[0] ?? fighter.magicalArchetype,
      magicalArchetypes: nextArchetypes,
      learnedSpellIds: isSpell
        ? [...fighter.learnedSpellIds, entry.id]
        : fighter.learnedSpellIds,
      learnedSkillIds: !isSpell
        ? [...fighter.learnedSkillIds, entry.id]
        : fighter.learnedSkillIds,
      advanceHistory: [
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          description: unlocksArchetype
            ? `Learned Skill: ${entry.name} (Unlocked ${giftedArchetype} Magic Archetype)`
            : `Learned ${isSpell ? 'Spell' : 'Skill'}: ${entry.name}`,
        },
        ...fighter.advanceHistory,
      ],
    };

    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id ? updatedFighter : f
    );
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
    setSelectedFighterForAdvance(updatedFighter);
  };

  // Unlock an additional Magical Archetype via Post-Battle Effect, Exploration, or Advancement
  const handleUnlockAdditionalArchetype = async (fighter: Fighter) => {
    const sp = rules.species.find((s) => s.id === fighter.speciesId);
    const currentArchetypes = getFighterMagicalArchetypes(fighter, rules.skillsAndSpells);

    if (currentArchetypes.includes(postBattleArchetype)) {
      alert(`${fighter.name} already has access to ${postBattleArchetype} Magic!`);
      return;
    }

    if (!overrideAdvArchetypeRestrictions) {
      if (sp?.cannotBeMagicUser) {
        alert(
          `${sp.name} cannot use Spells according to the 2.0 rulebook. Check "Override archetype restrictions" to bypass.`
        );
        return;
      }
      if (!allowedArchetypesForAllegiance.includes(postBattleArchetype)) {
        alert(
          `${postBattleArchetype} Magic is not in ${allegiance?.name}'s allowed Magical Archetypes (${allowedArchetypesForAllegiance.join(
            ', '
          )}). Choose an allowed archetype or check "Override archetype restrictions".`
        );
        return;
      }
    }

    const nextArchetypes: MagicalArchetype[] = [...currentArchetypes, postBattleArchetype];
    const today = new Date().toISOString().slice(0, 10);

    const updatedFighter: Fighter = {
      ...fighter,
      isMagicUser: true,
      magicalArchetype: nextArchetypes[0],
      magicalArchetypes: nextArchetypes,
      advancesCount: postBattleArchetypeCountsAsAdvance
        ? fighter.advancesCount + 1
        : fighter.advancesCount,
      advanceHistory: [
        {
          id: crypto.randomUUID(),
          date: today,
          description: postBattleArchetypeCountsAsAdvance
            ? `Advancement (+1 Level): Unlocked ${postBattleArchetype} Magic Archetype`
            : `Post-Battle / Special Effect: Unlocked ${postBattleArchetype} Magic Archetype`,
        },
        ...fighter.advanceHistory,
      ],
    };

    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id ? updatedFighter : f
    );
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
    setSelectedFighterForAdvance(updatedFighter);
  };

  const handleRemoveMagicalArchetype = async (
    fighter: Fighter,
    archToRemove: MagicalArchetype
  ) => {
    const currentArchetypes = getFighterMagicalArchetypes(fighter, rules.skillsAndSpells);
    const nextArchetypes = currentArchetypes.filter((a) => a !== archToRemove);
    const updatedFighter: Fighter = {
      ...fighter,
      isMagicUser: nextArchetypes.length > 0 || fighter.learnedSpellIds.length > 0,
      magicalArchetype: nextArchetypes[0],
      magicalArchetypes: nextArchetypes,
    };
    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id ? updatedFighter : f
    );
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
    setSelectedFighterForAdvance(updatedFighter);
  };

  // Add Injury
  const handleAddInjuryToFighter = async (fighter: Fighter) => {
    const inj = rules.injuries.find((i) => i.id === advInjuryId);
    if (!inj) return;

    const nextStatus: FighterStatus = inj.causesDeath
      ? 'Dead'
      : inj.causesMissNextGame
      ? 'Miss Next Game'
      : fighter.status;

    const updatedFighter: Fighter = {
      ...fighter,
      status: nextStatus,
      injuryIds: [...fighter.injuryIds, inj.id],
      advanceHistory: [
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          description: `Suffered Injury: ${inj.name} (${inj.effect})`,
        },
        ...fighter.advanceHistory,
      ],
    };

    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id ? updatedFighter : f
    );
    const nextPensions = (activeWarband.pensions ?? 0) + (inj.pensionPennies ?? 0);
    await saveWarband({
      ...activeWarband,
      pensions: nextPensions,
      fighters: updatedFighters,
    });
    setSelectedFighterForAdvance(updatedFighter);
  };

  // Apply Allegiance Starting Bonus to an already-recruited fighter (if slots remain)
  const handleApplyAllegianceBonusToExistingFighter = async (fighter: Fighter) => {
    if (!startingBonusRule || fighter.usedAllegianceBonus || !canUseMoreAllegianceBonuses) {
      return;
    }
    const species = rules.species.find((s) => s.id === fighter.speciesId);
    if (!species) return;

    const today = new Date().toISOString().slice(0, 10);
    let updatedFighter: Fighter = { ...fighter };

    if (startingBonusRule.type === 'stat') {
      const baseDie = species.stats[allegianceStatKey];
      const priorSteps = fighter.statModifiers[allegianceStatKey] ?? 0;
      if (!canIncreaseStartingDie(baseDie, priorSteps)) {
        alert(
          `${STAT_LABELS[allegianceStatKey]} is already at or above D12 and cannot be increased with a starting bonus.`
        );
        return;
      }
      const beforeDie = stepDie(baseDie, priorSteps);
      const nextModifiers: StatNumericModifiers = {
        ...fighter.statModifiers,
        [allegianceStatKey]: priorSteps + 1,
      };
      const afterDie = stepDie(baseDie, priorSteps + 1);
      updatedFighter = {
        ...fighter,
        usedAllegianceBonus: true,
        advancesCount: fighter.advancesCount + 1,
        statModifiers: nextModifiers,
        advanceHistory: [
          {
            id: crypto.randomUUID(),
            date: today,
            description: `${allegiance?.name} Bonus — ${startingBonusRule.name} (+1 Level): +1 ${STAT_LABELS[allegianceStatKey]} (${beforeDie} → ${afterDie})`,
          },
          ...fighter.advanceHistory,
        ],
      };
    } else if (startingBonusRule.type === 'skill') {
      const bonusSk = rules.skillsAndSpells.find((s) => s.id === allegianceSkillId);
      if (!bonusSk) return;
      updatedFighter = {
        ...fighter,
        usedAllegianceBonus: true,
        advancesCount: fighter.advancesCount + 1,
        learnedSkillIds: [...fighter.learnedSkillIds, bonusSk.id],
        advanceHistory: [
          {
            id: crypto.randomUUID(),
            date: today,
            description: `${allegiance?.name} Bonus — ${startingBonusRule.name} (+1 Level): Gained ${bonusSk.name}`,
          },
          ...fighter.advanceHistory,
        ],
      };
    }

    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id ? updatedFighter : f
    );
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
    setSelectedFighterForAdvance(updatedFighter);
  };

  return (
    <div className="space-y-6">
      {/* Warband Banner Summary */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/30 border border-stone-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold text-amber-400 font-serif">
                {activeWarband.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {allegiance?.name || 'Independent Warband'}
              </span>
              {allegiance?.allegianceArchetype && (
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-stone-800 text-stone-300">
                  Archetype: {allegiance.allegianceArchetype}
                </span>
              )}
              {startingBonusRule && (
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                  {startingBonusRule.name}: {usedAllegianceBonusCount}/{maxAllegianceBonuses} used
                </span>
              )}
              {(activeMagicUsersCount > 0 ||
                maxMagicUsers !== undefined ||
                allegiance?.allModelsMustBeMagicUsers ||
                allegiance?.leaderAndSecondMustBeMagicUserOrStableGhast) && (
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                  ✦ Magic-users: {activeMagicUsersCount}
                  {maxMagicUsers !== undefined ? `/${maxMagicUsers} max` : ''}
                </span>
              )}
            </div>
            {activeWarband.motto && (
              <p className="text-xs italic text-stone-400 mt-0.5">
                &ldquo;{activeWarband.motto}&rdquo;
              </p>
            )}
            <p className="text-xs text-stone-300 mt-2 max-w-2xl">
              <strong className="text-stone-400">Starting Den:</strong> {activeWarband.denName} (
              {activeWarband.denType}) •{' '}
              <strong className="text-stone-400">2.0 Allegiance Rules:</strong>{' '}
              {allegiance?.specialRules}
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="bg-stone-950/80 border border-stone-800 rounded-xl px-3.5 py-2.5 text-center">
              <div className="text-[11px] text-stone-400 uppercase tracking-wider">Treasury</div>
              <div className="text-lg font-bold text-amber-400 flex items-center justify-center gap-1">
                <Coins className="w-4 h-4" />
                {activeWarband.treasuryPennies}p
              </div>
            </div>
            <div className="bg-stone-950/80 border border-stone-800 rounded-xl px-3.5 py-2.5 text-center">
              <div className="text-[11px] text-stone-400 uppercase tracking-wider">
                Band Rating (Lvl)
              </div>
              <div className="text-lg font-bold text-emerald-400">{warbandRating}</div>
            </div>
            <div className="bg-stone-950/80 border border-stone-800 rounded-xl px-3.5 py-2.5 text-center">
              <div className="text-[11px] text-stone-400 uppercase tracking-wider">
                Band Value
              </div>
              <div className="text-lg font-bold text-stone-200">
                {calculateWarbandPennyValue(activeWarband)}p
              </div>
            </div>
            <div className="bg-stone-950/80 border border-stone-800 rounded-xl px-3.5 py-2.5 text-center">
              <div className="text-[11px] text-stone-400 uppercase tracking-wider">
                Active Beasts
              </div>
              <div className="text-lg font-bold text-stone-100">
                {activeWarband.fighters.filter((f) => f.status === 'Active').length} /{' '}
                {activeWarband.fighters.length}
              </div>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-stone-800/80">
          <div className="text-xs text-stone-400 flex flex-wrap items-center gap-3">
            <span>
              Den Stash: <strong className="text-amber-300">{stashedItems.length} items</strong>
            </span>
            <span>•</span>
            <span>
              Labour: <strong className="text-emerald-300">{activeWarband.labour ?? 0}</strong>
            </span>
            <span>•</span>
            <span>
              Materials: <strong className="text-amber-300">{activeWarband.materials ?? 0}</strong>
            </span>
            <span>•</span>
            <span>
              Pensions Owed: <strong className="text-red-300">{activeWarband.pensions ?? 0}p</strong>
            </span>
          </div>
          <button
            onClick={openRecruitModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Recruit Beast to Warband
          </button>
        </div>
      </div>

      {/* Fighters List */}
      <div className="grid grid-cols-1 gap-4">
        {activeWarband.fighters.map((fighter) => {
          const species = rules.species.find((s) => s.id === fighter.speciesId);
          const { base, effective, level } = computeFighterStats(
            fighter,
            rules,
            activeWarband.inventory
          );
          const combat = computeFighterCombatBreakdown(
            fighter,
            rules,
            activeWarband.inventory,
            false
          );
          const rangedWeaponSummary = combat.strong.weapons.find(
            (w) => w.weaponType === 'Ranged'
          );
          const equipped = activeWarband.inventory.filter(
            (i) => i.assignedFighterId === fighter.id
          );
          const slotOcc = getFighterSlotOccupancy(
            fighter,
            activeWarband.inventory,
            rules
          );
          const gearValue = equipped.reduce((acc, i) => acc + i.purchaseCost, 0);
          const totalValue = fighter.recruitmentCost + gearValue;

          const roleStartingAdvances =
            fighter.role === 'Leader' ? 2 : fighter.role === 'Second' ? 1 : 0;
          const allegianceStartingAdvance = fighter.usedAllegianceBonus ? 1 : 0;
          const earnedAdvances =
            getEarnedAdvancesCount(fighter.xp) +
            roleStartingAdvances +
            allegianceStartingAdvance;
          const nextThreshold = getNextXpThreshold(fighter.xp);
          const hasUnspentAdvance = earnedAdvances > fighter.advancesCount;

          const innateCount = species?.innateSkillIds.length ?? 0;
          const allSkillIds = [
            ...(species?.innateSkillIds ?? []),
            ...fighter.learnedSkillIds,
          ];

          return (
            <div
              key={fighter.id}
              className={`bg-stone-900 border rounded-2xl p-5 transition ${
                fighter.status === 'Miss Next Game'
                  ? 'border-amber-700/60 bg-amber-950/10'
                  : fighter.status === 'Dead'
                  ? 'border-red-900/60 opacity-65'
                  : 'border-stone-800 hover:border-stone-700'
              }`}
            >
              {/* Fighter Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-stone-800">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase ${
                      fighter.role === 'Leader'
                        ? 'bg-amber-500 text-stone-950'
                        : fighter.role === 'Second'
                        ? 'bg-amber-800/60 text-amber-200 border border-amber-600/40'
                        : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    {fighter.role}
                  </span>
                  <h3 className="text-lg font-bold text-stone-100 font-serif">
                    {fighter.name}
                  </h3>
                  {fighter.title && (
                    <span className="text-xs text-stone-400 italic">
                      — {fighter.title}
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded bg-stone-800 text-stone-300">
                    {species?.name || 'Beast'} ({species?.size || 'Medium'} •{' '}
                    {species?.baseSizeMm || '30mm'})
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-bold">
                    Level {level}
                  </span>

                  {/* Net Strong / Weak Pill (Tap to Inspect) */}
                  <button
                    onClick={() =>
                      setInspectTarget({ fighterId: fighter.id, tab: 'strong' })
                    }
                    className={`text-[11px] px-2.5 py-0.5 rounded border font-semibold flex items-center gap-1 transition cursor-pointer ${
                      combat.strong.primaryMeleeNetStrong > 0
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 hover:border-emerald-500'
                        : combat.strong.primaryMeleeNetStrong < 0
                        ? 'bg-orange-950/80 text-orange-300 border-orange-700/60 hover:border-orange-500'
                        : 'bg-stone-800/90 text-stone-300 border-stone-700 hover:border-stone-500'
                    }`}
                    title="Tap for full Strong / Weak breakdown"
                  >
                    <Sword className="w-3 h-3 text-amber-400" />
                    <span>
                      Melee: {combat.strong.primaryMeleeLabel}
                      {combat.strong.netBaseStrong !==
                        combat.strong.primaryMeleeNetStrong && (
                        <span className="text-[10px] opacity-80 ml-1">
                          (Base {combat.strong.baseLabel})
                        </span>
                      )}
                      {rangedWeaponSummary && (
                        <span className="text-[10px] text-amber-300 ml-1.5">
                          • Ranged: {rangedWeaponSummary.label}
                        </span>
                      )}
                    </span>
                  </button>

                  {/* Net Tough / Delicate Pill (Tap to Inspect) */}
                  <button
                    onClick={() =>
                      setInspectTarget({ fighterId: fighter.id, tab: 'tough' })
                    }
                    className={`text-[11px] px-2.5 py-0.5 rounded border font-semibold flex items-center gap-1 transition cursor-pointer ${
                      combat.tough.netTough > 0
                        ? 'bg-sky-950/80 text-sky-300 border-sky-700/60 hover:border-sky-500'
                        : combat.tough.netTough < 0
                        ? 'bg-orange-950/80 text-orange-300 border-orange-700/60 hover:border-orange-500'
                        : 'bg-stone-800/90 text-stone-300 border-stone-700 hover:border-stone-500'
                    }`}
                    title="Tap for full Tough / Delicate breakdown"
                  >
                    <Shield className="w-3 h-3 text-sky-400" />
                    <span>
                      {combat.tough.label}
                      {combat.tough.armourTough > 0 && (
                        <span className="text-[10px] opacity-80 ml-1">
                          (Skill {combat.tough.skillTough - combat.tough.skillDelicate} + Armour{' '}
                          {combat.tough.armourTough})
                        </span>
                      )}
                    </span>
                  </button>

                  {(() => {
                    const fArchs = getFighterMagicalArchetypes(
                      fighter,
                      rules.skillsAndSpells
                    );
                    if (
                      !fighter.isMagicUser &&
                      fighter.learnedSpellIds.length === 0 &&
                      fArchs.length === 0
                    ) {
                      return null;
                    }
                    return (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-700/60 font-medium">
                        ✦ {fArchs.length > 0 ? `${fArchs.join(' / ')} ` : ''}Magic-user
                      </span>
                    );
                  })()}
                  {fighter.usedAllegianceBonus && startingBonusRule && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/50 font-medium">
                      ★ {startingBonusRule.name}
                    </span>
                  )}
                  <select
                    value={fighter.status}
                    onChange={(e) =>
                      handleStatusChange(fighter, e.target.value as FighterStatus)
                    }
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer ${
                      fighter.status === 'Active'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                        : fighter.status === 'Miss Next Game'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                        : 'bg-red-950/80 text-red-300 border-red-800'
                    }`}
                  >
                    <option value="Active">Active Ready</option>
                    <option value="Miss Next Game">Miss Next Game (Recovering)</option>
                    <option value="Retired">Retired</option>
                    <option value="Dead">Slain (Dead)</option>
                  </select>
                </div>

                {/* XP, Fate & Value Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div
                    className="flex items-center gap-1.5 bg-stone-950 border border-purple-500/30 px-2.5 py-1.5 rounded-xl"
                    title={`Per-Model Fate Points (Page 36: Starts with ${getStartingFatePointsForRole(
                      fighter.role
                    )}, Max ${MAX_FIGHTER_FATE_POINTS})`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs text-stone-400">Fate:</span>
                    <button
                      onClick={() => handleAdjustFate(fighter, -1)}
                      disabled={getFighterFatePoints(fighter) <= 0}
                      className="p-0.5 rounded hover:bg-stone-800 disabled:opacity-40 text-stone-400 hover:text-stone-100 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-sm text-purple-300 px-0.5 font-mono">
                      {getFighterFatePoints(fighter)}/{MAX_FIGHTER_FATE_POINTS}
                    </span>
                    <button
                      onClick={() => handleAdjustFate(fighter, 1)}
                      disabled={
                        getFighterFatePoints(fighter) >= MAX_FIGHTER_FATE_POINTS
                      }
                      className="p-0.5 rounded hover:bg-stone-800 disabled:opacity-40 text-stone-400 hover:text-stone-100 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-stone-400">XP:</span>
                    <button
                      onClick={() => handleAdjustXp(fighter, -1)}
                      className="p-0.5 rounded hover:bg-stone-800 text-stone-400 hover:text-stone-100 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-sm text-amber-300 px-1">
                      {fighter.xp}
                    </span>
                    <button
                      onClick={() => handleAdjustXp(fighter, 1)}
                      className="p-0.5 rounded hover:bg-stone-800 text-stone-400 hover:text-stone-100 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {nextThreshold && (
                      <span className="text-[10px] text-stone-500 ml-1">
                        (Next: {nextThreshold})
                      </span>
                    )}
                  </div>

                  {hasUnspentAdvance && (
                    <button
                      onClick={() => setSelectedFighterForAdvance(fighter)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs animate-pulse cursor-pointer"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Advance Ready!
                    </button>
                  )}

                  <div className="text-xs text-stone-400 bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl">
                    Value: <strong className="text-stone-100">{totalValue}p</strong>
                  </div>

                  <button
                    onClick={() => setSelectedFighterForGear(fighter)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-semibold border border-stone-700 cursor-pointer"
                  >
                    <Sword className="w-3.5 h-3.5" />
                    Gear ({slotOcc.usedMainSlots}/{slotOcc.maxMainSlots}
                    {slotOcc.magesPouchCount > 0 && slotOcc.ingredientsCarried.length > 0
                      ? ` + ${slotOcc.ingredientsCarried.length}/${slotOcc.maxIngredients} Pouch`
                      : ''}
                    )
                  </button>

                  <button
                    onClick={() => setSelectedFighterForAdvance(fighter)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Advances & Injuries
                  </button>

                  <button
                    onClick={() => handleDeleteFighter(fighter)}
                    className="p-1.5 text-stone-500 hover:text-red-400 cursor-pointer"
                    title="Dismiss Beast"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 2.0 9-Stat Dice Profile Table + Wounds (Tap any Stat to Inspect Modifiers & Roll) */}
              <div className="my-4 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-stone-500 px-1">
                  <span>Stat Profile (Base &rarr; Effective Die &amp; Gear/Skill Modifiers)</span>
                  <span className="flex items-center gap-1 text-amber-400/80">
                    <Dices className="w-3.5 h-3.5" />
                    Tap any stat to view modifiers &amp; roll dice
                  </span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {(
                    [
                      { key: 'move' as StatKey, label: 'Move (M)' },
                      { key: 'strike' as StatKey, label: 'Strike (S)' },
                      { key: 'block' as StatKey, label: 'Block (B)' },
                      { key: 'ranged' as StatKey, label: 'Ranged (R)' },
                      { key: 'nimbleness' as StatKey, label: 'Nimble (N)' },
                      { key: 'concealment' as StatKey, label: 'Conceal (C)' },
                      { key: 'awareness' as StatKey, label: 'Aware (A)' },
                      { key: 'fortitude' as StatKey, label: 'Fort (F)' },
                      { key: 'presence' as StatKey, label: 'Pres (P)' },
                    ] as const
                  ).map((stMeta) => {
                    const st = combat.stats[stMeta.key];
                    const dieModified = st.effectiveDie !== st.baseDie;
                    const mod = st.permanentRollMod;
                    const moveInchMod = st.moveInchesMod ?? 0;

                    return (
                      <button
                        key={stMeta.key}
                        onClick={() =>
                          setInspectTarget({ fighterId: fighter.id, tab: stMeta.key })
                        }
                        className="bg-stone-950/90 hover:bg-stone-900 border border-stone-800 hover:border-amber-500/60 rounded-xl p-2 text-center transition cursor-pointer flex flex-col items-center justify-center"
                        title={`Tap to inspect & roll ${st.label}`}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-stone-400">
                          {stMeta.label}
                        </div>
                        <div className="flex items-baseline justify-center gap-1 mt-0.5">
                          <span
                            className={`text-sm font-bold font-mono ${
                              st.dieOverriddenBy
                                ? 'text-orange-400'
                                : dieModified
                                ? 'text-amber-400'
                                : 'text-stone-100'
                            }`}
                          >
                            {st.effectiveDie}
                          </span>
                          {(mod !== 0 || moveInchMod > 0) && (
                            <span
                              className={`text-[10px] font-mono font-extrabold ${
                                mod > 0
                                  ? 'text-emerald-400'
                                  : mod < 0
                                  ? 'text-red-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              ({mod !== 0 ? formatSigned(mod) : `+${moveInchMod}"`})
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  <div className="bg-stone-950/90 border border-stone-800 rounded-xl p-2 text-center flex flex-col items-center justify-center">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400">
                      Wounds
                    </div>
                    <div
                      className={`text-sm font-bold font-mono mt-0.5 ${
                        effective.wounds !== base.wounds
                          ? 'text-amber-400'
                          : 'text-stone-100'
                      }`}
                    >
                      {effective.wounds}
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipped Gear, Skills, Spells & Injuries */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Gear */}
                <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-3">
                  <div className="text-stone-400 font-semibold mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sword className="w-3.5 h-3.5 text-amber-400" /> Equipped Gear (
                      {slotOcc.usedMainSlots}/{slotOcc.maxMainSlots} slots)
                    </span>
                    <button
                      onClick={() => setSelectedFighterForGear(fighter)}
                      className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                    >
                      + Manage
                    </button>
                  </div>
                  {equipped.length === 0 ? (
                    <p className="text-stone-500 italic">Unarmed & Unarmoured</p>
                  ) : (
                    <ul className="space-y-1">
                      {equipped.map((item) => {
                        const eqRef = rules.equipment.find(
                          (e) => e.id === item.equipmentId
                        );
                        const slotsUsed = eqRef
                          ? getEffectiveSlotsRequired(eqRef, fighter, rules)
                          : 1;
                        return (
                          <li
                            key={item.instanceId}
                            className="flex items-center justify-between text-stone-200 gap-2"
                          >
                            <span>
                              <strong className="text-amber-200/90">
                                {formatItemDisplayName(item, eqRef)}
                              </strong>{' '}
                              <span className="text-stone-500 text-[11px]">
                                ({item.slot}
                                {slotsUsed > 1 ? ' • 2 Armour Slots' : ''})
                              </span>
                            </span>
                            <button
                              onClick={() => handleMoveItem(item.instanceId, null)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer shrink-0"
                              title="Send to Den Stash"
                            >
                              Stash
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Innate & Learned Skills + Spells */}
                <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-3">
                  <div className="text-stone-400 font-semibold mb-1.5 flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Skills &amp; Spells
                    </span>
                    <span className="text-[10px] font-normal text-stone-500 italic">
                      Tap badge for rules
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allSkillIds.map((skId, idx) => {
                      const sk = rules.skillsAndSpells.find((s) => s.id === skId);
                      if (!sk) return null;
                      const isInnate = idx < innateCount;
                      const pageRef = getSkillOrSpellPageReference(sk).replace('Page ', 'p.');
                      return (
                        <button
                          key={`${skId}-${idx}`}
                          type="button"
                          onClick={() =>
                            setSelectedSkillOrSpell({
                              fighterId: fighter.id,
                              skillOrSpellId: skId,
                            })
                          }
                          title={`${sk.name} (${getSkillOrSpellPageReference(sk)}): ${sk.description}`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                            isInnate
                              ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700/70'
                              : 'bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/50 hover:border-emerald-500/60'
                          }`}
                        >
                          <span>{sk.name}</span>
                          <span className="text-[9px] opacity-75">({pageRef})</span>
                        </button>
                      );
                    })}
                    {fighter.learnedSpellIds.map((spId) => {
                      const sp = rules.skillsAndSpells.find((s) => s.id === spId);
                      if (!sp) return null;
                      const pageRef = getSkillOrSpellPageReference(sp).replace('Page ', 'p.');
                      return (
                        <button
                          key={spId}
                          type="button"
                          onClick={() =>
                            setSelectedSkillOrSpell({
                              fighterId: fighter.id,
                              skillOrSpellId: spId,
                            })
                          }
                          title={`${sp.name} (${getSkillOrSpellPageReference(sp)}): ${sp.description}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-950/90 hover:bg-indigo-900/90 text-indigo-300 border border-indigo-700/50 hover:border-indigo-400 transition cursor-pointer"
                        >
                          <span>✦ {sp.name}</span>
                          <span className="text-[9px] opacity-75">({pageRef})</span>
                        </button>
                      );
                    })}
                    {allSkillIds.length === 0 && fighter.learnedSpellIds.length === 0 && (
                      <span className="text-stone-500 italic">None</span>
                    )}
                  </div>
                </div>

                {/* Injuries & Notes */}
                <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-3">
                  <div className="text-stone-400 font-semibold mb-1.5 flex items-center gap-1.5">
                    <Skull className="w-3.5 h-3.5 text-red-400" /> Injuries & Chronicle
                  </div>
                  {fighter.injuryIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {fighter.injuryIds.map((injId, idx) => {
                        const inj = rules.injuries.find((i) => i.id === injId);
                        return (
                          <span
                            key={`${injId}-${idx}`}
                            title={inj?.effect}
                            className="px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800/60 text-[11px]"
                          >
                            {inj?.name || injId}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-stone-500 text-[11px] mb-1">No lasting injuries</div>
                  )}
                  {fighter.notes && (
                    <p className="text-[11px] text-stone-400 italic">{fighter.notes}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* RECRUIT FIGHTER MODAL */}
      {showRecruitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-amber-400 font-serif">
                  Recruit a Beast to {activeWarband.name}
                </h3>
                <p className="text-xs text-stone-400">
                  {allegiance?.name || 'Warband'} • Treasury:{' '}
                  <strong className="text-amber-300">
                    {activeWarband.treasuryPennies} Pennies
                  </strong>{' '}
                  available
                </p>
              </div>
              <button
                onClick={() => setShowRecruitModal(false)}
                className="text-stone-400 hover:text-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecruitFighter} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Fighter Name *</label>
                  <input
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    placeholder="e.g. Barnaby Bristleback"
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Title / Epithet</label>
                  <input
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                    placeholder="e.g. Gatebreaker"
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Warband Role</label>
                  <select
                    value={fRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as FighterRole;
                      setFRole(nextRole);
                      if (!overrideMagicRestrictions) {
                        const reqMage = Boolean(
                          allegiance?.allModelsMustBeMagicUsers ||
                            (allegiance?.leaderAndSecondMustBeMagicUserOrStableGhast &&
                              (nextRole === 'Leader' || nextRole === 'Second') &&
                              !speciesForbidsMagic)
                        );
                        if (reqMage && !magicUserLimitReached && !speciesForbidsMagic) {
                          setIsMagicUser(true);
                        }
                      }
                    }}
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="Leader" disabled={hasActiveLeader}>
                      Leader (+1 Stat & +1 Skill • +2 Levels)
                      {hasActiveLeader ? ' [Already Recruited]' : ''}
                    </option>
                    <option value="Second" disabled={hasActiveSecond}>
                      Second (+1 Skill • +1 Level)
                      {hasActiveSecond ? ' [Already Recruited]' : ''}
                    </option>
                    <option value="Henchbeast">Regular Beast (+0p)</option>
                    <option value="Hired Paw / Mercenary">Freelancer / Hired Paw</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Species</label>
                  <select
                    value={fSpeciesId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setFSpeciesId(nextId);
                      const nextSp = rules.species.find((s) => s.id === nextId);
                      if (!overrideMagicRestrictions) {
                        if (nextSp?.cannotBeMagicUser) {
                          setIsMagicUser(false);
                        } else if (
                          allegiance?.allModelsMustBeMagicUsers ||
                          (allegiance?.leaderAndSecondMustBeMagicUserOrStableGhast &&
                            (fRole === 'Leader' || fRole === 'Second'))
                        ) {
                          setIsMagicUser(true);
                        }
                      }
                    }}
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-sm"
                  >
                    {sortedSpecies.map((s) => {
                      const spCost = getSpeciesRecruitCostForAllegiance(s, allegiance);
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.size} — {spCost.cost}p
                          {spCost.isDiscounted
                            ? ` ★ ${allegiance?.name} discount from ${spCost.baseCost}p`
                            : ''}
                          )
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {selectedSpecies && (
                <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex flex-wrap justify-between font-semibold text-stone-200 gap-1">
                    <span>
                      {selectedSpecies.name} ({selectedSpecies.size} • Base Level{' '}
                      {selectedSpecies.baseLevel || 1} → Starting Level{' '}
                      {(selectedSpecies.baseLevel || 1) +
                        (fRole === 'Leader' ? 2 : fRole === 'Second' ? 1 : 0) +
                        (applyAllegianceBonus && canUseMoreAllegianceBonuses ? 1 : 0)}
                      )
                    </span>
                    <span className="text-amber-400">
                      Signing-on Fee: {baseSpeciesRecruitCost} Pennies
                      {speciesCostInfo.isDiscounted && (
                        <span className="text-emerald-400 ml-1">
                          (Discounted from {speciesCostInfo.baseCost}p for {allegiance?.name})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="text-stone-400 font-mono text-[11px]">
                    M {selectedSpecies.stats.move} | S {selectedSpecies.stats.strike} | B{' '}
                    {selectedSpecies.stats.block} | R {selectedSpecies.stats.ranged} | N{' '}
                    {selectedSpecies.stats.nimbleness} | C {selectedSpecies.stats.concealment} | A{' '}
                    {selectedSpecies.stats.awareness} | F {selectedSpecies.stats.fortitude} | P{' '}
                    {selectedSpecies.stats.presence} | Wounds {selectedSpecies.stats.wounds}
                  </div>
                  {selectedSpecies.specialRules && (
                    <div className="text-[11px] text-emerald-400">
                      {selectedSpecies.specialRules}
                    </div>
                  )}
                </div>
              )}

              {/* LEADER STARTING BONUS SELECTION */}
              {fRole === 'Leader' && selectedSpecies && (
                <div className="bg-amber-950/20 border border-amber-700/50 rounded-xl p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Leader Starting Bonus (+2 Levels)
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideRecruitSkillPrereqs}
                        onChange={(e) =>
                          setOverrideRecruitSkillPrereqs(e.target.checked)
                        }
                      />
                      Override skill prerequisites
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-stone-300 mb-1">
                        Starting Stat Increase (+1 Die Step, max D12)
                      </label>
                      <select
                        value={leaderStatKey}
                        onChange={(e) => setLeaderStatKey(e.target.value as StatDieKey)}
                        className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs"
                      >
                        {ALL_STAT_KEYS.map((statKey) => {
                          const baseDie = selectedSpecies.stats[statKey];
                          const valid = canIncreaseStartingDie(baseDie, 0);
                          const nextDie = valid ? stepDie(baseDie, 1) : baseDie;
                          return (
                            <option key={statKey} value={statKey} disabled={!valid}>
                              {STAT_LABELS[statKey]}: {baseDie}
                              {valid ? ` → ${nextDie}` : ' (Max D12 / N/A)'}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-300 mb-1">
                        Starting Skill
                      </label>
                      <select
                        value={leaderSkillId}
                        onChange={(e) => setLeaderSkillId(e.target.value)}
                        className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs"
                      >
                        {learnableSkills.map((sk) => {
                          const effMage =
                            isMagicUser ||
                            (allegianceRequiresMagicUser && !overrideMagicRestrictions);
                          const spellTier =
                            effMage && selectedSpellIds.length > 0
                              ? Math.min(8, selectedSpellIds.length)
                              : 0;
                          const effOwnedSkills =
                            spellTier > 0
                              ? [
                                  ...selectedSpecies.innateSkillIds,
                                  `sk-weak-${spellTier}`,
                                  `sk-delicate-${spellTier}`,
                                ]
                              : selectedSpecies.innateSkillIds;
                          const qual = checkSkillQualification(
                            sk,
                            selectedSpecies.id,
                            effOwnedSkills,
                            effMage ? selectedSpellIds : [],
                            rules.skillsAndSpells,
                            effMage ? [selectedMagicArchetype] : [],
                            effMage
                          );
                          const isDisabled =
                            !overrideRecruitSkillPrereqs && !qual.qualified;
                          return (
                            <option key={sk.id} value={sk.id} disabled={isDisabled}>
                              {sk.name} [{sk.category}]
                              {!qual.qualified ? ` (${qual.reason})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  {(() => {
                    const chosen = rules.skillsAndSpells.find(
                      (s) => s.id === leaderSkillId
                    );
                    if (!chosen) return null;
                    return (
                      <div className="text-[11px] text-stone-400 bg-stone-950/70 border border-stone-800 rounded-lg px-2.5 py-1.5">
                        <strong className="text-amber-300">{chosen.name}:</strong>{' '}
                        {chosen.description}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SECOND STARTING BONUS SELECTION */}
              {fRole === 'Second' && selectedSpecies && (
                <div className="bg-amber-950/20 border border-amber-700/50 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Second Starting Bonus (+1 Level)
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideRecruitSkillPrereqs}
                        onChange={(e) =>
                          setOverrideRecruitSkillPrereqs(e.target.checked)
                        }
                      />
                      Override skill prerequisites
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-300 mb-1">
                      Starting Skill
                    </label>
                    <select
                      value={secondSkillId}
                      onChange={(e) => setSecondSkillId(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs"
                    >
                      {learnableSkills.map((sk) => {
                        const effMage =
                          isMagicUser ||
                          (allegianceRequiresMagicUser && !overrideMagicRestrictions);
                        const spellTier =
                          effMage && selectedSpellIds.length > 0
                            ? Math.min(8, selectedSpellIds.length)
                            : 0;
                        const effOwnedSkills =
                          spellTier > 0
                            ? [
                                ...selectedSpecies.innateSkillIds,
                                `sk-weak-${spellTier}`,
                                `sk-delicate-${spellTier}`,
                              ]
                            : selectedSpecies.innateSkillIds;
                        const qual = checkSkillQualification(
                          sk,
                          selectedSpecies.id,
                          effOwnedSkills,
                          effMage ? selectedSpellIds : [],
                          rules.skillsAndSpells,
                          effMage ? [selectedMagicArchetype] : [],
                          effMage
                        );
                        const isDisabled =
                          !overrideRecruitSkillPrereqs && !qual.qualified;
                        return (
                          <option key={sk.id} value={sk.id} disabled={isDisabled}>
                            {sk.name} [{sk.category}]
                            {!qual.qualified
                              ? ` (${qual.reason})`
                              : ` — ${sk.description.slice(0, 55)}...`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {(() => {
                    const chosen = rules.skillsAndSpells.find(
                      (s) => s.id === secondSkillId
                    );
                    if (!chosen) return null;
                    return (
                      <div className="text-[11px] text-stone-400 bg-stone-950/70 border border-stone-800 rounded-lg px-2.5 py-1.5">
                        <strong className="text-amber-300">{chosen.name}:</strong>{' '}
                        {chosen.description}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ALLEGIANCE STARTING BONUS SELECTION */}
              {startingBonusRule && selectedSpecies && (
                <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      className={`flex items-center gap-2 text-xs font-bold ${
                        canUseMoreAllegianceBonuses
                          ? 'text-emerald-300 cursor-pointer'
                          : 'text-stone-500 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={applyAllegianceBonus && canUseMoreAllegianceBonuses}
                        disabled={!canUseMoreAllegianceBonuses}
                        onChange={(e) => setApplyAllegianceBonus(e.target.checked)}
                      />
                      Apply {allegiance?.name} Starting Bonus: {startingBonusRule.name} (+1 Level)
                    </label>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                        canUseMoreAllegianceBonuses
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {usedAllegianceBonusCount} / {maxAllegianceBonuses} used
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    {startingBonusRule.description}
                  </p>

                  {!canUseMoreAllegianceBonuses && (
                    <p className="text-[11px] text-amber-400 font-medium">
                      Maximum of {maxAllegianceBonuses} beasts in this warband already have the{' '}
                      {startingBonusRule.name} bonus.
                    </p>
                  )}

                  {applyAllegianceBonus && canUseMoreAllegianceBonuses && (
                    <div className="pt-1">
                      {startingBonusRule.type === 'stat' && startingBonusRule.allowedStats && (
                        <div>
                          <label className="block text-[11px] text-stone-300 mb-1">
                            Select Statistic to Improve (+1 Die Step, max D12)
                          </label>
                          <select
                            value={allegianceStatKey}
                            onChange={(e) =>
                              setAllegianceStatKey(e.target.value as StatDieKey)
                            }
                            className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs"
                          >
                            {startingBonusRule.allowedStats.map((statKey) => {
                              const baseDie = selectedSpecies.stats[statKey];
                              const priorSteps =
                                fRole === 'Leader' && leaderStatKey === statKey ? 1 : 0;
                              const valid = canIncreaseStartingDie(baseDie, priorSteps);
                              const fromDie = stepDie(baseDie, priorSteps);
                              const toDie = valid ? stepDie(baseDie, priorSteps + 1) : fromDie;
                              return (
                                <option key={statKey} value={statKey} disabled={!valid}>
                                  {STAT_LABELS[statKey]}: {fromDie}
                                  {valid ? ` → ${toDie}` : ' (Already at D12 / N/A)'}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                      {startingBonusRule.type === 'skill' &&
                        startingBonusRule.allowedSkillIds && (
                          <div>
                            <label className="block text-[11px] text-stone-300 mb-1">
                              Select Starting Bonus Skill (Cumulative with Species skills)
                            </label>
                            <select
                              value={allegianceSkillId}
                              onChange={(e) => setAllegianceSkillId(e.target.value)}
                              className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs"
                            >
                              {startingBonusRule.allowedSkillIds.map((skId) => {
                                const sk = rules.skillsAndSpells.find((s) => s.id === skId);
                                return (
                                  <option key={skId} value={skId}>
                                    {sk?.name || skId} — {sk?.description}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}

              {/* MAGIC-USER RECRUITMENT & SPELL SELECTION */}
              {selectedSpecies && (
                <div className="bg-indigo-950/25 border border-indigo-800/50 rounded-xl p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {(() => {
                      const blockedByRule =
                        !overrideMagicRestrictions &&
                        (speciesForbidsMagic || magicUserLimitReached);
                      const lockedOnByRule =
                        !overrideMagicRestrictions && allegianceRequiresMagicUser;
                      const effectiveChecked =
                        isMagicUser || lockedOnByRule;
                      return (
                        <label
                          className={`flex items-center gap-2 text-xs font-bold ${
                            blockedByRule
                              ? 'text-stone-500 cursor-not-allowed'
                              : 'text-indigo-300 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={effectiveChecked}
                            disabled={blockedByRule || lockedOnByRule}
                            onChange={(e) => {
                              setIsMagicUser(e.target.checked);
                              if (!e.target.checked) {
                                setSelectedSpellIds([]);
                              }
                            }}
                          />
                          ✦ Make this beast a Magic-user
                          {lockedOnByRule && (
                            <span className="text-[10px] font-normal text-amber-300">
                              (Required by {allegiance?.name})
                            </span>
                          )}
                        </label>
                      );
                    })()}

                    <label className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideMagicRestrictions}
                        onChange={(e) => {
                          const nextOverride = e.target.checked;
                          setOverrideMagicRestrictions(nextOverride);
                          if (
                            !nextOverride &&
                            !allowedArchetypesForAllegiance.includes(selectedMagicArchetype)
                          ) {
                            setSelectedMagicArchetype(
                              allowedArchetypesForAllegiance[0] || 'Natural'
                            );
                            setSelectedSpellIds([]);
                          }
                        }}
                      />
                      Override magic restrictions
                    </label>
                  </div>

                  {/* Allegiance & Species Magic Rule Notes */}
                  {allegiance?.magicUserRuleNote && (
                    <p className="text-[11px] text-indigo-200/80 leading-relaxed">
                      <strong>{allegiance.name} Magic Rule:</strong> {allegiance.magicUserRuleNote}{' '}
                      {maxMagicUsers !== undefined && (
                        <span className="text-amber-300 font-semibold">
                          ({activeMagicUsersCount}/{maxMagicUsers} Magic-users in warband)
                        </span>
                      )}
                    </p>
                  )}

                  {speciesForbidsMagic && !overrideMagicRestrictions && (
                    <p className="text-[11px] text-amber-400 font-medium">
                      {selectedSpecies.name} cannot use Spells according to the 2.0 rulebook.
                      (Check &ldquo;Override magic restrictions&rdquo; for custom games.)
                    </p>
                  )}

                  {magicUserLimitReached && !overrideMagicRestrictions && (
                    <p className="text-[11px] text-amber-400 font-medium">
                      This warband already has the maximum of {maxMagicUsers} Magic-user(s) allowed
                      by {allegiance?.name}. (Check &ldquo;Override magic restrictions&rdquo; to
                      bypass.)
                    </p>
                  )}

                  {(isMagicUser ||
                    (allegianceRequiresMagicUser && !overrideMagicRestrictions)) && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-[11px] text-stone-300 mb-1">
                          Magical Archetype{' '}
                          {!overrideMagicRestrictions ? (
                            <span className="text-indigo-300">
                              (Allowed for {allegiance?.name || 'Warband'}:{' '}
                              {allowedArchetypesForAllegiance.join(', ')})
                            </span>
                          ) : (
                            <span className="text-amber-300">(All 12 Archetypes Unlocked)</span>
                          )}
                        </label>
                        <select
                          value={selectedMagicArchetype}
                          onChange={(e) => {
                            setSelectedMagicArchetype(e.target.value as MagicalArchetype);
                            setSelectedSpellIds([]);
                          }}
                          className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          {ALL_MAGICAL_ARCHETYPES.map((arch) => {
                            const isAllowed = allowedArchetypesForAllegiance.includes(arch);
                            const isDisabled = !overrideMagicRestrictions && !isAllowed;
                            return (
                              <option key={arch} value={arch} disabled={isDisabled}>
                                {arch} Magic
                                {!isAllowed
                                  ? ` (Not in ${allegiance?.name} allowed archetypes)`
                                  : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Spells Checklist for Selected Archetype */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-semibold text-stone-300">
                            Select Starting Spells ({selectedMagicArchetype} Magic —{' '}
                            {selectedSpellIds.length} selected)
                          </label>
                          <div className="flex items-center gap-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedSpellIds(spellsForSelectedArchetype.map((s) => s.id))
                              }
                              className="text-indigo-300 hover:underline cursor-pointer"
                            >
                              Select All ({spellsForSelectedArchetype.length})
                            </button>
                            <span className="text-stone-600">•</span>
                            <button
                              type="button"
                              onClick={() => setSelectedSpellIds([])}
                              className="text-stone-400 hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                          {spellsForSelectedArchetype.map((spell) => {
                            const isSelected = selectedSpellIds.includes(spell.id);
                            return (
                              <label
                                key={spell.id}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                                  isSelected
                                    ? 'bg-indigo-950/60 border-indigo-500/60 text-stone-100'
                                    : 'bg-stone-950/80 border-stone-800 text-stone-300 hover:border-stone-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSpell(spell.id)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 space-y-0.5">
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="font-bold text-indigo-300">
                                      ✦ {spell.name}
                                    </span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-900 text-amber-300 border border-stone-800">
                                      {spell.castingStat || 'Fort/Pres'}{' '}
                                      {spell.spellDifficulty ?? 7}+ • {spell.spellRange || 'Self'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-stone-400 leading-snug">
                                    {spell.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Automatic Cumulative Weak (X) & Delicate (X) Summary */}
                      <div className="bg-stone-950/90 border border-indigo-800/50 rounded-lg px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
                        <span className="text-stone-300">
                          Starting Magic-user Penalty (1 per Spell):
                        </span>
                        {selectedSpellIds.length > 0 ? (
                          <span className="font-bold text-amber-300">
                            Automatically adds Weak ({selectedSpellIds.length}) &amp; Delicate (
                            {selectedSpellIds.length})
                          </span>
                        ) : (
                          <span className="text-red-300 font-medium">
                            Select at least 1 Spell to recruit as a Magic-user
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STARTING EQUIPMENT & ALLEGIANCE RARE GEAR BUILDER */}
              {selectedSpecies &&
                (() => {
                  const previewSlotOcc = getFighterSlotOccupancy(
                    previewRecruitFighter,
                    previewRecruitWarband.inventory,
                    rules
                  );
                  const allegianceRareOpts = getAllegianceStartingRareEquipment(allegiance);
                  const allegianceRareEquipmentList = allegianceRareOpts
                    .map((opt) => {
                      const eq = rules.equipment.find((e) => e.id === opt.equipmentId);
                      return eq ? { eq, opt } : null;
                    })
                    .filter(
                      (x): x is { eq: EquipmentRef; opt: (typeof allegianceRareOpts)[0] } =>
                        Boolean(x)
                    );

                  const commonWeaponsArmour = sortedEquipment.filter((eq) => {
                    const meta = getEquipmentCostForAllegiance(eq, allegiance);
                    return (
                      meta.isCommon &&
                      (overrideRecruitGearRestrictions || meta.isAvailableAtCreation) &&
                      (eq.equipmentType === 'Weapon' || eq.equipmentType === 'Armour')
                    );
                  });

                  const commonItemsAmmo = sortedEquipment.filter((eq) => {
                    const meta = getEquipmentCostForAllegiance(eq, allegiance);
                    return (
                      meta.isCommon &&
                      (overrideRecruitGearRestrictions || meta.isAvailableAtCreation) &&
                      eq.equipmentType === 'Item'
                    );
                  });

                  const commonIngredients = sortedEquipment.filter(
                    (eq) => eq.equipmentType === 'Ingredient'
                  );

                  const otherRareRelics = sortedEquipment.filter((eq) => {
                    const meta = getEquipmentCostForAllegiance(eq, allegiance);
                    return !meta.isCommon && !meta.isAllegianceRare;
                  });

                  const selectedRecruitEq = rules.equipment.find(
                    (x) => x.id === recruitEqId
                  );
                  const selectedRecruitEqCostMeta = selectedRecruitEq
                    ? getEquipmentCostForAllegiance(selectedRecruitEq, allegiance)
                    : null;
                  const validRecruitSlots: EquipmentSlot[] = selectedRecruitEq
                    ? getValidSlotsForEquipment(
                        selectedRecruitEq,
                        previewRecruitFighter,
                        rules
                      )
                    : [
                        'Weapon 1',
                        'Weapon 2',
                        'Armour 1',
                        'Armour 2',
                        'Item',
                        'Special',
                      ];
                  const recruitSlotOptions: EquipmentSlot[] =
                    overrideRecruitGearRestrictions
                      ? [
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
                        ]
                      : validRecruitSlots;

                  const isMistGhast = selectedSpecies.id.startsWith('sp-mist-ghast');
                  const isArmless = selectedSpecies.innateSkillIds.includes('sk-armless');
                  const hasStartingGearOrSpell =
                    recruitItems.length > 0 ||
                    (previewEffectiveIsMagicUser && selectedSpellIds.length > 0) ||
                    isMistGhast ||
                    isArmless;

                  return (
                    <div className="bg-stone-950/90 border border-amber-700/40 rounded-xl p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-amber-400" />
                            Starting Equipment &amp; {allegiance?.name || 'Allegiance'} Gear
                          </div>
                          <div className="text-[11px] text-stone-400">
                            Kit out this recruit with Common General Store gear and{' '}
                            <strong className="text-amber-300">
                              {allegiance?.name} Starting Rare Equipment
                            </strong>{' '}
                            at official creation prices.
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-900 border border-stone-700 text-stone-300">
                            Slots: {previewSlotOcc.usedMainSlots}/{previewSlotOcc.maxMainSlots}
                          </span>
                          {recruitGearTotalCost > 0 && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700/60 text-amber-300">
                              +{recruitGearTotalCost}p Gear
                            </span>
                          )}
                        </div>
                      </div>

                      {isMistGhast ? (
                        <div className="text-[11px] text-stone-400 bg-stone-900/70 border border-stone-800 rounded-lg px-3 py-2">
                          Mist Ghasts always count as equipped with a One-handed Weapon and cannot
                          carry any additional Equipment (Rulebook Page 57).
                        </div>
                      ) : (
                        <>
                          {/* Allegiance Special Starting Rare Equipment Quick-Add Panel */}
                          {allegianceRareEquipmentList.length > 0 && (
                            <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-amber-300">
                                  ★ {allegiance?.name} Starting Rare Equipment (Tap to add or select):
                                </span>
                                <span className="text-[10px] text-stone-400">
                                  {allegianceRareEquipmentList.length} special options unlocked
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {allegianceRareEquipmentList.map(({ eq, opt }) => {
                                  const check = validateEquipmentForFighter(
                                    eq,
                                    previewRecruitFighter,
                                    previewRecruitWarband,
                                    rules
                                  );
                                  const canQuickAdd =
                                    overrideRecruitGearRestrictions || check.valid;
                                  const shortName = eq.name
                                    .replace(' (1 Vial / Stack)', '')
                                    .replace('Bonded Critter: ', '')
                                    .replace(' Weapon Upgrade', '');
                                  return (
                                    <button
                                      key={eq.id}
                                      type="button"
                                      onClick={() => {
                                        setRecruitEqId(eq.id);
                                        const suggested = findAvailableSlotForEquipment(
                                          eq,
                                          previewRecruitFighter,
                                          previewRecruitWarband.inventory,
                                          rules
                                        );
                                        const validS = getValidSlotsForEquipment(
                                          eq,
                                          previewRecruitFighter,
                                          rules
                                        );
                                        setRecruitEqSlot(
                                          suggested || validS[0] || eq.defaultSlot
                                        );
                                        if (canQuickAdd) {
                                          handleAddRecruitGear(eq, 1);
                                        }
                                      }}
                                      title={
                                        check.valid
                                          ? `Add ${eq.name} (${opt.cost}p${
                                              opt.note ? ` • ${opt.note}` : ''
                                            }): ${eq.description}`
                                          : `${eq.name} (${opt.cost}p) — ${check.reason}`
                                      }
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                                        canQuickAdd
                                          ? 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border-amber-700/60 hover:border-amber-400'
                                          : 'bg-stone-900/60 text-stone-500 border-stone-800 hover:border-stone-700'
                                      }`}
                                    >
                                      <span>★ {shortName}</span>
                                      <span className="text-[10px] font-mono px-1 rounded bg-stone-950/80 text-amber-300">
                                        {opt.cost}p
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Quick-Add Common Basic Loadout Buttons */}
                          <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-2.5 space-y-1.5">
                            <div className="text-[11px] font-semibold text-stone-300">
                              Quick-Add Basic Common Equipment:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { id: 'eq-one-handed', label: '1H Weapon', qty: 1 },
                                { id: 'eq-spear', label: 'Spear', qty: 1 },
                                { id: 'eq-two-handed', label: '2H Weapon', qty: 1 },
                                { id: 'eq-pole-arm', label: 'Polearm', qty: 1 },
                                { id: 'eq-rondel-dagger', label: 'Rondel Dagger', qty: 1 },
                                { id: 'eq-bow', label: 'Bow', qty: 1 },
                                { id: 'eq-light-crossbow', label: 'Light Crossbow', qty: 1 },
                                { id: 'eq-sling', label: 'Sling', qty: 1 },
                                { id: 'eq-pistol', label: 'Pistol', qty: 1 },
                                { id: 'eq-light-armour', label: 'Light Armour', qty: 1 },
                                { id: 'eq-heavy-armour', label: 'Heavy Armour', qty: 1 },
                                { id: 'eq-buckler', label: 'Buckler', qty: 1 },
                                { id: 'eq-light-shield', label: 'Light Shield', qty: 1 },
                                { id: 'eq-heavy-shield', label: 'Heavy Shield', qty: 1 },
                                { id: 'eq-broadhead-arrows', label: '5× Broadhead Arrows', qty: 5 },
                                { id: 'eq-bodkin-arrows', label: '5× Bodkin Arrows', qty: 5 },
                                { id: 'eq-lead-slingshot', label: '5× Lead Slingshot', qty: 5 },
                                { id: 'eq-focus', label: "Mage's Focus", qty: 1 },
                                { id: 'eq-mages-pouch', label: "Mage's Pouch", qty: 1 },
                              ].map((preset) => {
                                const eq = rules.equipment.find((e) => e.id === preset.id);
                                if (!eq) return null;
                                const meta = getEquipmentCostForAllegiance(eq, allegiance);
                                if (!overrideRecruitGearRestrictions && !meta.isAvailableAtCreation) {
                                  return null;
                                }
                                const check = validateEquipmentForFighter(
                                  eq,
                                  previewRecruitFighter,
                                  previewRecruitWarband,
                                  rules
                                );
                                const canQuickAdd =
                                  overrideRecruitGearRestrictions || check.valid;
                                const totalCost = meta.cost * preset.qty;
                                return (
                                  <button
                                    key={`${preset.id}-${preset.qty}`}
                                    type="button"
                                    onClick={() => {
                                      setRecruitEqId(eq.id);
                                      setRecruitEqQuantity(preset.qty);
                                      if (canQuickAdd) {
                                        handleAddRecruitGear(eq, preset.qty);
                                      }
                                    }}
                                    title={
                                      check.valid
                                        ? `Add ${preset.label} (${totalCost}p): ${
                                            eq.weaponModifiers || eq.description
                                          }`
                                        : `${preset.label} — ${check.reason}`
                                    }
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                                      canQuickAdd
                                        ? 'bg-stone-950 hover:bg-stone-800 text-stone-200 border-stone-700 hover:border-emerald-500/60'
                                        : 'bg-stone-950/40 text-stone-500 border-stone-800/70'
                                    }`}
                                  >
                                    <span>+ {preset.label}</span>
                                    <span className="text-[10px] font-mono text-amber-400">
                                      {totalCost}p
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Filter Tabs + Full Item Selector */}
                          <div className="space-y-2 pt-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap gap-1">
                                {[
                                  { key: 'all', label: 'All Starting Gear' },
                                  {
                                    key: 'allegiance_rare',
                                    label: `★ ${allegiance?.name || 'Allegiance'} Rare (${
                                      allegianceRareEquipmentList.length
                                    })`,
                                  },
                                  { key: 'weapons_armour', label: 'Common Weapons & Armour' },
                                  { key: 'items_ammo', label: 'Common Items & Ammo' },
                                  { key: 'ingredients', label: 'Ingredients' },
                                ].map((tab) => (
                                  <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() =>
                                      setRecruitGearFilter(
                                        tab.key as typeof recruitGearFilter
                                      )
                                    }
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer ${
                                      recruitGearFilter === tab.key
                                        ? 'bg-amber-500 text-stone-950 border-amber-400'
                                        : 'bg-stone-900 text-stone-400 border-stone-800 hover:border-stone-700'
                                    }`}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>

                              <label className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={overrideRecruitGearRestrictions}
                                  onChange={(e) =>
                                    setOverrideRecruitGearRestrictions(e.target.checked)
                                  }
                                />
                                Override equipment &amp; rarity restrictions
                              </label>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                              <div className="sm:col-span-7">
                                <label className="block text-[11px] text-stone-400 mb-1">
                                  Select Equipment Item
                                </label>
                                <select
                                  value={recruitEqId}
                                  onChange={(e) => {
                                    const nextId = e.target.value;
                                    setRecruitEqId(nextId);
                                    setRecruitEqQuantity(1);
                                    const found = rules.equipment.find(
                                      (x) => x.id === nextId
                                    );
                                    if (found) {
                                      const suggested = findAvailableSlotForEquipment(
                                        found,
                                        previewRecruitFighter,
                                        previewRecruitWarband.inventory,
                                        rules
                                      );
                                      const validS = getValidSlotsForEquipment(
                                        found,
                                        previewRecruitFighter,
                                        rules
                                      );
                                      setRecruitEqSlot(
                                        suggested || validS[0] || found.defaultSlot
                                      );
                                    }
                                  }}
                                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs"
                                >
                                  {(recruitGearFilter === 'all' ||
                                    recruitGearFilter === 'allegiance_rare') &&
                                    allegianceRareEquipmentList.length > 0 && (
                                      <optgroup
                                        label={`★ ${
                                          allegiance?.name || 'Allegiance'
                                        } Starting Rare Equipment`}
                                      >
                                        {allegianceRareEquipmentList.map(({ eq, opt }) => {
                                          const check = validateEquipmentForFighter(
                                            eq,
                                            previewRecruitFighter,
                                            previewRecruitWarband,
                                            rules
                                          );
                                          const disabled =
                                            !overrideRecruitGearRestrictions && !check.valid;
                                          return (
                                            <option
                                              key={eq.id}
                                              value={eq.id}
                                              disabled={disabled}
                                            >
                                              ★ {eq.name} — {opt.cost}p
                                              {opt.note ? ` (${opt.note})` : ''}
                                              {!check.valid ? ` [${check.reason}]` : ''}
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    )}

                                  {(recruitGearFilter === 'all' ||
                                    recruitGearFilter === 'weapons_armour') && (
                                    <optgroup label="Common Weapons & Armour (General Store)">
                                      {commonWeaponsArmour.map((eq) => {
                                        const check = validateEquipmentForFighter(
                                          eq,
                                          previewRecruitFighter,
                                          previewRecruitWarband,
                                          rules
                                        );
                                        const disabled =
                                          !overrideRecruitGearRestrictions && !check.valid;
                                        return (
                                          <option
                                            key={eq.id}
                                            value={eq.id}
                                            disabled={disabled}
                                          >
                                            {eq.name} — {eq.cost}p ({eq.category})
                                            {!check.valid ? ` [${check.reason}]` : ''}
                                          </option>
                                        );
                                      })}
                                    </optgroup>
                                  )}

                                  {(recruitGearFilter === 'all' ||
                                    recruitGearFilter === 'items_ammo') && (
                                    <optgroup label="Common Items, Ammunition & Consumables">
                                      {commonItemsAmmo.map((eq) => {
                                        const check = validateEquipmentForFighter(
                                          eq,
                                          previewRecruitFighter,
                                          previewRecruitWarband,
                                          rules
                                        );
                                        const disabled =
                                          !overrideRecruitGearRestrictions && !check.valid;
                                        return (
                                          <option
                                            key={eq.id}
                                            value={eq.id}
                                            disabled={disabled}
                                          >
                                            {eq.name} — {eq.cost}p ({eq.category})
                                            {!check.valid ? ` [${check.reason}]` : ''}
                                          </option>
                                        );
                                      })}
                                    </optgroup>
                                  )}

                                  {(recruitGearFilter === 'all' ||
                                    recruitGearFilter === 'ingredients') && (
                                    <optgroup label="Common Magical Ingredients (Requires Mage's Pouch)">
                                      {commonIngredients.map((eq) => {
                                        const check = validateEquipmentForFighter(
                                          eq,
                                          previewRecruitFighter,
                                          previewRecruitWarband,
                                          rules
                                        );
                                        const disabled =
                                          !overrideRecruitGearRestrictions && !check.valid;
                                        return (
                                          <option
                                            key={eq.id}
                                            value={eq.id}
                                            disabled={disabled}
                                          >
                                            {eq.name} — {eq.cost}p
                                            {!check.valid ? ` [${check.reason}]` : ''}
                                          </option>
                                        );
                                      })}
                                    </optgroup>
                                  )}

                                  {overrideRecruitGearRestrictions &&
                                    otherRareRelics.length > 0 && (
                                      <optgroup label="Other Rare & Relic Gear (Unlocked by Override)">
                                        {otherRareRelics.map((eq) => (
                                          <option key={eq.id} value={eq.id}>
                                            {eq.name} — {eq.cost}p ({eq.rarity})
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                </select>
                              </div>

                              <div className="sm:col-span-3">
                                <label className="block text-[11px] text-stone-400 mb-1">
                                  Slot
                                </label>
                                <select
                                  value={recruitEqSlot}
                                  onChange={(e) =>
                                    setRecruitEqSlot(e.target.value as EquipmentSlot)
                                  }
                                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1.5 text-xs"
                                >
                                  {recruitSlotOptions.map((slotOpt) => (
                                    <option key={slotOpt} value={slotOpt}>
                                      {slotOpt}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-2">
                                <button
                                  type="button"
                                  onClick={() => handleAddRecruitGear()}
                                  className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs cursor-pointer"
                                >
                                  + Add
                                </button>
                              </div>
                            </div>

                            {/* Stackable Consumable Quantity Bar in Recruit Modal */}
                            {selectedRecruitEq &&
                              isEquipmentStackable(selectedRecruitEq) &&
                              selectedRecruitEqCostMeta && (
                                <div className="bg-emerald-950/30 border border-emerald-700/50 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div>
                                    <span className="font-bold text-emerald-300">
                                      Stackable in 1 {recruitEqSlot} slot:
                                    </span>{' '}
                                    <span className="text-stone-300">
                                      {selectedRecruitEqCostMeta.cost}p each • Total:{' '}
                                      <strong className="text-amber-300">
                                        {selectedRecruitEqCostMeta.cost * recruitEqQuantity}p
                                      </strong>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRecruitEqQuantity((q) => Math.max(1, q - 1))
                                      }
                                      className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      max={99}
                                      value={recruitEqQuantity}
                                      onChange={(e) =>
                                        setRecruitEqQuantity(
                                          Math.max(
                                            1,
                                            Math.min(99, parseInt(e.target.value, 10) || 1)
                                          )
                                        )
                                      }
                                      className="w-12 bg-stone-900 border border-stone-700 rounded px-1.5 py-0.5 text-center font-mono font-bold text-amber-300"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRecruitEqQuantity((q) => Math.min(99, q + 1))
                                      }
                                      className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold cursor-pointer"
                                    >
                                      +
                                    </button>
                                    {[3, 5, 10].map((n) => (
                                      <button
                                        key={n}
                                        type="button"
                                        onClick={() => setRecruitEqQuantity(n)}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                                          recruitEqQuantity === n
                                            ? 'bg-emerald-600 text-stone-950'
                                            : 'bg-stone-900 text-stone-300 border border-stone-700'
                                        }`}
                                      >
                                        ×{n}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                            {/* Selected Item Details Preview */}
                            {selectedRecruitEq && selectedRecruitEqCostMeta && (
                              <div className="bg-stone-900/70 border border-stone-800 rounded-lg px-2.5 py-1.5 text-[11px] text-stone-400 flex flex-wrap items-center justify-between gap-1">
                                <span>
                                  <strong className="text-stone-200">
                                    {selectedRecruitEq.name}
                                  </strong>{' '}
                                  ({selectedRecruitEqCostMeta.cost}p
                                  {selectedRecruitEqCostMeta.isAllegianceRare
                                    ? ` ★ ${allegiance?.name} Starting Rare`
                                    : ''}
                                  ): {selectedRecruitEq.weaponModifiers || selectedRecruitEq.description}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Queued Starting Loadout List */}
                          {recruitItems.length > 0 ? (
                            <div className="space-y-1.5 pt-1">
                              <div className="text-[11px] font-bold text-emerald-300 flex items-center justify-between">
                                <span>
                                  Queued Starting Loadout ({recruitItems.length} slot entry,{' '}
                                  {recruitGearTotalCost}p total)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRecruitItems([])}
                                  className="text-[10px] text-stone-400 hover:text-red-300 underline cursor-pointer"
                                >
                                  Clear Loadout
                                </button>
                              </div>
                              <ul className="space-y-1">
                                {recruitItems.map((item) => {
                                  const eq = rules.equipment.find(
                                    (e) => e.id === item.equipmentId
                                  );
                                  const stackable = isEquipmentStackable(eq);
                                  const qty = getItemQuantity(item);
                                  const slotsUsed = eq
                                    ? getEffectiveSlotsRequired(
                                        eq,
                                        previewRecruitFighter,
                                        rules
                                      )
                                    : 1;
                                  const meta = eq
                                    ? getEquipmentCostForAllegiance(eq, allegiance)
                                    : null;
                                  return (
                                    <li
                                      key={item.instanceId}
                                      className="flex items-center justify-between gap-2 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs"
                                    >
                                      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-950 text-stone-400 border border-stone-800">
                                          {item.slot}
                                          {slotsUsed > 1 ? ' (2 Slots)' : ''}
                                        </span>
                                        <span className="font-semibold text-stone-200">
                                          {formatItemDisplayName(item, eq)}
                                        </span>
                                        {meta?.isAllegianceRare && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
                                            ★ {allegiance?.name} Rare
                                          </span>
                                        )}
                                        <span className="text-amber-400 font-mono text-[11px]">
                                          {item.purchaseCost}p
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {stackable && (
                                          <div className="flex items-center gap-1 bg-stone-950 border border-stone-700 rounded px-1 py-0.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleAdjustRecruitGearQuantity(
                                                  item.instanceId,
                                                  -1
                                                )
                                              }
                                              className="px-1 text-stone-300 hover:text-red-300 font-bold cursor-pointer"
                                            >
                                              -1
                                            </button>
                                            <span className="text-[10px] font-mono font-bold text-amber-300">
                                              ×{qty}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleAdjustRecruitGearQuantity(
                                                  item.instanceId,
                                                  1
                                                )
                                              }
                                              className="px-1 text-emerald-300 hover:text-emerald-200 font-bold cursor-pointer"
                                            >
                                              +1
                                            </button>
                                          </div>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveRecruitGear(item.instanceId)
                                          }
                                          className="px-1.5 py-0.5 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 text-[10px] cursor-pointer"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : (
                            <div
                              className={`text-[11px] rounded-lg px-2.5 py-1.5 border ${
                                hasStartingGearOrSpell
                                  ? 'bg-stone-900/50 border-stone-800 text-stone-400'
                                  : 'bg-amber-950/30 border-amber-700/50 text-amber-300'
                              }`}
                            >
                              {hasStartingGearOrSpell
                                ? 'No starting equipment added yet (model has Spells or natural weapons).'
                                : 'Rulebook Step 6 (Page 41): Every model must be given at least 1 piece of Equipment (Weapon, Armour, or Item) or at least 1 Spell.'}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

              <div>
                <label className="block text-xs text-stone-400 mb-1">Notes / Loadout Plan</label>
                <input
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  placeholder="Optional background notes..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-800">
                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deductPennies}
                    onChange={(e) => setDeductPennies(e.target.checked)}
                  />
                  <span>
                    Deduct{' '}
                    <strong className="text-amber-300">{totalRecruitCost}p</strong>{' '}
                    {recruitGearTotalCost > 0
                      ? `(${baseSpeciesRecruitCost}p Fee + ${recruitGearTotalCost}p Gear) `
                      : ''}
                    from Treasury ({activeWarband.treasuryPennies}p available)
                  </span>
                </label>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer"
                >
                  Recruit Beast ({totalRecruitCost}p)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OUTFIT GEAR MODAL */}
      {selectedFighterForGear &&
        (() => {
          const liveFighter =
            activeWarband.fighters.find((f) => f.id === selectedFighterForGear.id) ||
            selectedFighterForGear;
          const gearSlotOcc = getFighterSlotOccupancy(
            liveFighter,
            activeWarband.inventory,
            rules
          );
          const selectedBuyEq = rules.equipment.find((x) => x.id === buyEqId);
          const validSlotsForSelectedEq: EquipmentSlot[] = selectedBuyEq
            ? getValidSlotsForEquipment(selectedBuyEq, liveFighter, rules)
            : [
                'Weapon 1',
                'Weapon 2',
                'Armour 1',
                'Armour 2',
                'Item',
                'Special',
              ];
          const all2eSlotOptions: EquipmentSlot[] = overrideGearRestrictions
            ? [
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
              ]
            : validSlotsForSelectedEq;

          return (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-amber-400 font-serif">
                      Outfit {liveFighter.name}
                    </h3>
                    <p className="text-xs text-stone-400">
                      Equip items from your Den Stash or purchase from the General Store (
                      <strong className="text-amber-300">
                        {activeWarband.treasuryPennies} Pennies
                      </strong>{' '}
                      available). Official 2.0 Equipment Slots:{' '}
                      <strong>
                        {gearSlotOcc.usedMainSlots}/{gearSlotOcc.maxMainSlots}
                      </strong>{' '}
                      main slots used.
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFighterForGear(null)}
                    className="text-stone-400 hover:text-stone-100 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Override Checkbox */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-950/80 border border-stone-800 rounded-xl px-3.5 py-2">
                  <span className="text-[11px] text-stone-400">
                    Enforces 2.0 Slot Limits, Strong (X) Weapon Requirements, Two-Handed +
                    Shield Rules, and Multi-Slot Heavy Armour.
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-amber-300 font-medium cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={overrideGearRestrictions}
                      onChange={(e) => setOverrideGearRestrictions(e.target.checked)}
                    />
                    Override equipment &amp; slot restrictions (Custom)
                  </label>
                </div>

                {/* Visual 2.0 Equipment Slots Grid (Weapon 1, Weapon 2, Armour 1, Armour 2, Item, Special, + Beast of Burden) */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                    2.0 Equipment Slots ({gearSlotOcc.usedMainSlots}/{gearSlotOcc.maxMainSlots})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(gearSlotOcc.slotMap).map(([slotName, item]) => {
                      const eq = item
                        ? rules.equipment.find((e) => e.id === item.equipmentId)
                        : undefined;
                      const stackable = isEquipmentStackable(eq);
                      const qty = item ? getItemQuantity(item) : 1;
                      const isSecondarySlotOfMultiSlotItem =
                        slotName === 'Armour 2' &&
                        gearSlotOcc.twoSlotArmourItem !== null &&
                        item?.instanceId === gearSlotOcc.twoSlotArmourItem.instanceId;
                      return (
                        <div
                          key={slotName}
                          className={`rounded-xl px-3 py-2 border text-xs flex items-center justify-between gap-2 ${
                            item
                              ? 'bg-stone-950 border-amber-700/50 text-stone-100'
                              : 'bg-stone-950/40 border-dashed border-stone-800 text-stone-500'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-400">
                              {slotName}
                              {isSecondarySlotOfMultiSlotItem && (
                                <span className="ml-1 text-amber-400">
                                  (2nd Armour Slot)
                                </span>
                              )}
                              {item && stackable && (
                                <span className="ml-1.5 text-emerald-400 font-semibold">
                                  • Stack ({qty} carried)
                                </span>
                              )}
                            </div>
                            {item ? (
                              <div className="font-semibold text-amber-200 truncate">
                                {formatItemDisplayName(item, eq)}
                                {isSecondarySlotOfMultiSlotItem
                                  ? ' (Heavy/Very Heavy Armour)'
                                  : ''}
                              </div>
                            ) : (
                              <div className="italic text-[11px]">Empty Slot</div>
                            )}
                          </div>
                          {item && !isSecondarySlotOfMultiSlotItem && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {stackable && (
                                <div className="flex items-center gap-1 bg-stone-900 border border-stone-700 rounded-lg px-1.5 py-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAdjustStackQuantity(item, -1, false)
                                    }
                                    title="Remove/consume 1 from stack"
                                    className="px-1 text-stone-300 hover:text-red-300 font-bold cursor-pointer"
                                  >
                                    -1
                                  </button>
                                  <span className="text-[11px] font-mono font-bold text-amber-300 px-0.5">
                                    ×{qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAdjustStackQuantity(item, 1, !freeGrant)
                                    }
                                    title={
                                      freeGrant
                                        ? 'Add +1 to stack (Free)'
                                        : `Buy +1 for stack (${eq?.cost ?? 0}p)`
                                    }
                                    className="px-1 text-emerald-300 hover:text-emerald-200 font-bold cursor-pointer"
                                  >
                                    +1
                                  </button>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => handleMoveItem(item.instanceId, null)}
                                className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] shrink-0 cursor-pointer"
                              >
                                Unequip
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Mage's Pouch Ingredients (up to 6) & Weapon Upgrades */}
                  {(gearSlotOcc.magesPouchCount > 0 ||
                    gearSlotOcc.ingredientsCarried.length > 0 ||
                    gearSlotOcc.weaponUpgrades.length > 0) && (
                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(gearSlotOcc.magesPouchCount > 0 ||
                        gearSlotOcc.ingredientsCarried.length > 0) && (
                        <div className="bg-indigo-950/25 border border-indigo-800/50 rounded-xl p-2.5 text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-semibold text-indigo-300">
                            <span>✦ Mage&apos;s Pouch Ingredients</span>
                            <span>
                              {gearSlotOcc.ingredientsCarried.length} /{' '}
                              {gearSlotOcc.maxIngredients || 6}
                            </span>
                          </div>
                          {gearSlotOcc.ingredientsCarried.length === 0 ? (
                            <div className="text-[11px] text-stone-500 italic">
                              No Magical Ingredients stored in pouch yet.
                            </div>
                          ) : (
                            <ul className="space-y-1">
                              {gearSlotOcc.ingredientsCarried.map((pItem) => {
                                const eq = rules.equipment.find(
                                  (e) => e.id === pItem.equipmentId
                                );
                                return (
                                  <li
                                    key={pItem.instanceId}
                                    className="flex items-center justify-between text-[11px] text-stone-200"
                                  >
                                    <span>{formatItemDisplayName(pItem, eq)}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleMoveItem(pItem.instanceId, null)
                                      }
                                      className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
                                    >
                                      Stash
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}

                      {gearSlotOcc.weaponUpgrades.length > 0 && (
                        <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-2.5 text-xs space-y-1.5">
                          <div className="font-semibold text-amber-300">
                            Weapon Upgrades &amp; Extra Gear
                          </div>
                          <ul className="space-y-1">
                            {gearSlotOcc.weaponUpgrades.map((uItem) => {
                              const eq = rules.equipment.find(
                                (e) => e.id === uItem.equipmentId
                              );
                              return (
                                <li
                                  key={uItem.instanceId}
                                  className="flex items-center justify-between text-[11px] text-stone-200"
                                >
                                  <span>{formatItemDisplayName(uItem, eq)}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveItem(uItem.instanceId, null)}
                                    className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
                                  >
                                    Stash
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Equip from Den Stash */}
                {stashedItems.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                      <Package className="w-4 h-4" /> Equip from Den Stash (
                      {stashedItems.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {stashedItems.map((stashed) => {
                        const eq = rules.equipment.find(
                          (e) => e.id === stashed.equipmentId
                        );
                        const check = eq
                          ? validateEquipmentForFighter(
                              eq,
                              liveFighter,
                              activeWarband,
                              rules
                            )
                          : { valid: true, suggestedSlot: stashed.slot };
                        const canEquip = overrideGearRestrictions || check.valid;
                        return (
                          <div
                            key={stashed.instanceId}
                            className="flex items-center justify-between bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-stone-200 truncate">
                                {formatItemDisplayName(stashed, eq)}
                              </div>
                              <div className="text-[11px] text-stone-400">
                                {check.valid
                                  ? `Slot: ${check.suggestedSlot || stashed.slot}`
                                  : `Cannot equip: ${check.reason}`}
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                handleMoveItem(stashed.instanceId, liveFighter.id)
                              }
                              disabled={!canEquip}
                              className={`px-2.5 py-1 rounded font-bold shrink-0 ${
                                canEquip
                                  ? 'bg-emerald-700 hover:bg-emerald-600 text-stone-950 cursor-pointer'
                                  : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                              }`}
                            >
                              Equip
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Buy New Item */}
                <form
                  onSubmit={handleBuyGearForFighter}
                  className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Purchase &amp; Equip New Gear (Allegiance &amp; 2.0 General Store)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-stone-400 mb-1">Item</label>
                      <select
                        value={buyEqId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          setBuyEqId(nextId);
                          setBuyQuantity(1);
                          const found = rules.equipment.find((x) => x.id === nextId);
                          if (found) {
                            const suggested = findAvailableSlotForEquipment(
                              found,
                              liveFighter,
                              activeWarband.inventory,
                              rules
                            );
                            const validSlots = getValidSlotsForEquipment(
                              found,
                              liveFighter,
                              rules
                            );
                            setBuySlot(suggested || validSlots[0] || found.defaultSlot);
                          }
                        }}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                      >
                        {allegianceRareEquipmentList.length > 0 && (
                          <optgroup
                            label={`★ ${allegiance?.name || 'Allegiance'} Starting Rare Equipment`}
                          >
                            {allegianceRareEquipmentList.map((eq) => {
                              const check = validateEquipmentForFighter(
                                eq,
                                liveFighter,
                                activeWarband,
                                rules
                              );
                              const disabled = !overrideGearRestrictions && !check.valid;
                              const priceInfo = getEquipmentCostForAllegiance(eq, allegiance);
                              return (
                                <option key={`alg-buy-${eq.id}`} value={eq.id} disabled={disabled}>
                                  ★ {eq.name} — {priceInfo.cost}p ({eq.category} •{' '}
                                  {allegiance?.name} Rare)
                                  {!check.valid ? ` [${check.reason}]` : ''}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                        <optgroup label="Common Equipment (General Store)">
                          {sortedEquipment
                            .filter((eq) => eq.rarity === 'Common')
                            .map((eq) => {
                              const check = validateEquipmentForFighter(
                                eq,
                                liveFighter,
                                activeWarband,
                                rules
                              );
                              const disabled = !overrideGearRestrictions && !check.valid;
                              const priceInfo = getEquipmentCostForAllegiance(eq, allegiance);
                              return (
                                <option key={eq.id} value={eq.id} disabled={disabled}>
                                  {eq.name} — {priceInfo.cost}p ({eq.category} • Common)
                                  {!check.valid ? ` [${check.reason}]` : ''}
                                </option>
                              );
                            })}
                        </optgroup>
                        <optgroup label="Campaign Rare & Relic Equipment">
                          {sortedEquipment
                            .filter(
                              (eq) =>
                                eq.rarity !== 'Common' && !allegianceRareIds.has(eq.id)
                            )
                            .map((eq) => {
                              const check = validateEquipmentForFighter(
                                eq,
                                liveFighter,
                                activeWarband,
                                rules
                              );
                              const disabled = !overrideGearRestrictions && !check.valid;
                              const priceInfo = getEquipmentCostForAllegiance(eq, allegiance);
                              return (
                                <option key={eq.id} value={eq.id} disabled={disabled}>
                                  {eq.name} — {priceInfo.cost}p ({eq.category} • {eq.rarity})
                                  {!check.valid ? ` [${check.reason}]` : ''}
                                </option>
                              );
                            })}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-stone-400 mb-1">
                        Equip Slot
                      </label>
                      <select
                        value={buySlot}
                        onChange={(e) => setBuySlot(e.target.value as EquipmentSlot)}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1.5 text-xs"
                      >
                        {all2eSlotOptions.map((slotOpt) => (
                          <option key={slotOpt} value={slotOpt}>
                            {slotOpt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Stackable Quantity Selector (for Arrows, Slingshot, Black Powder, Poison Vials) */}
                  {selectedBuyEq && isEquipmentStackable(selectedBuyEq) && (
                    <div className="bg-emerald-950/30 border border-emerald-700/50 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs">
                        <div className="font-bold text-emerald-300">
                          Stackable Consumable — All copies share 1 {buySlot} slot
                        </div>
                        <div className="text-[11px] text-stone-400">
                          Unit cost: {getEquipmentCostForAllegiance(selectedBuyEq, allegiance).cost}p each • Total for {buyQuantity}:{' '}
                          <strong className="text-amber-300">
                            {freeGrant
                              ? 0
                              : getEquipmentCostForAllegiance(selectedBuyEq, allegiance).cost *
                                buyQuantity}
                            p
                          </strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-stone-300 mr-1">Quantity:</span>
                        <button
                          type="button"
                          onClick={() => setBuyQuantity((q) => Math.max(1, q - 1))}
                          className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={buyQuantity}
                          onChange={(e) =>
                            setBuyQuantity(
                              Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1))
                            )
                          }
                          className="w-14 bg-stone-900 border border-stone-700 rounded-lg px-2 py-1 text-center text-xs font-mono font-bold text-amber-300"
                        />
                        <button
                          type="button"
                          onClick={() => setBuyQuantity((q) => Math.min(99, q + 1))}
                          className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                        {[3, 5, 10].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setBuyQuantity(preset)}
                            className={`px-2 py-1 rounded text-[11px] font-mono font-bold cursor-pointer ${
                              buyQuantity === preset
                                ? 'bg-emerald-600 text-stone-950'
                                : 'bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-700'
                            }`}
                          >
                            ×{preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedBuyEq && (
                    <div className="bg-stone-900/80 border border-stone-800 rounded-lg px-3 py-2 text-[11px] text-stone-300 space-y-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-amber-300">
                          {selectedBuyEq.name} (
                          {getEquipmentCostForAllegiance(selectedBuyEq, allegiance).cost}p
                          {getEquipmentCostForAllegiance(selectedBuyEq, allegiance).isAllegianceRare
                            ? ` ★ ${allegiance?.name} Starting Rare`
                            : ''}
                          {selectedBuyEq.postBattlePriceNote
                            ? ` / Post-Battle: ${selectedBuyEq.postBattlePriceNote}`
                            : ''}
                          )
                        </span>
                        <span className="text-stone-400">
                          {selectedBuyEq.weaponModifiers || selectedBuyEq.category}
                        </span>
                      </div>
                      <div className="text-stone-400">{selectedBuyEq.description}</div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-end gap-3">
                    <div className="flex-1 w-full">
                      <label className="block text-xs text-stone-400 mb-1">
                        Custom Heirloom / Item Name (Optional)
                      </label>
                      <input
                        value={buyCustomName}
                        onChange={(e) => setBuyCustomName(e.target.value)}
                        placeholder="e.g. Grandfather's Broadsword"
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-stone-300 pb-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={freeGrant}
                        onChange={(e) => setFreeGrant(e.target.checked)}
                      />
                      Free (0p)
                    </label>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer shrink-0"
                    >
                      Buy &amp; Equip
                      {selectedBuyEq && isEquipmentStackable(selectedBuyEq) && buyQuantity > 1
                        ? ` (×${buyQuantity} — ${
                            freeGrant
                              ? 0
                              : getEquipmentCostForAllegiance(selectedBuyEq, allegiance).cost *
                                buyQuantity
                          }p)`
                        : ''}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

      {/* ADVANCES, SKILLS & INJURIES MODAL */}
      {selectedFighterForAdvance && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-amber-400 font-serif">
                  Progression, Skills & Injuries — {selectedFighterForAdvance.name}
                </h3>
                <p className="text-xs text-stone-400">
                  Current XP: <strong>{selectedFighterForAdvance.xp}</strong> (5 XP per Advance) •
                  Advances Taken: <strong>{selectedFighterForAdvance.advancesCount}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedFighterForAdvance(null)}
                className="text-stone-400 hover:text-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Allegiance Starting Bonus (if not yet applied to this beast) */}
            {startingBonusRule && (
              <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    {allegiance?.name} Starting Bonus — {startingBonusRule.name} (+1 Level)
                  </h4>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 font-semibold">
                    {usedAllegianceBonusCount} / {maxAllegianceBonuses} used in Warband
                  </span>
                </div>
                <p className="text-[11px] text-stone-400">{startingBonusRule.description}</p>
                {selectedFighterForAdvance.usedAllegianceBonus ? (
                  <p className="text-xs text-emerald-300 font-semibold">
                    ✓ This beast has already received the {startingBonusRule.name} starting bonus.
                  </p>
                ) : !canUseMoreAllegianceBonuses ? (
                  <p className="text-xs text-amber-400">
                    All {maxAllegianceBonuses} {startingBonusRule.name} bonuses have already been
                    assigned to beasts in this warband.
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    {startingBonusRule.type === 'stat' && startingBonusRule.allowedStats && (
                      <select
                        value={allegianceStatKey}
                        onChange={(e) =>
                          setAllegianceStatKey(e.target.value as StatDieKey)
                        }
                        className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                      >
                        {startingBonusRule.allowedStats.map((statKey) => {
                          const sp = rules.species.find(
                            (s) => s.id === selectedFighterForAdvance.speciesId
                          );
                          const baseDie = sp?.stats[statKey] ?? 'D6';
                          const priorSteps =
                            selectedFighterForAdvance.statModifiers[statKey] ?? 0;
                          const valid = canIncreaseStartingDie(baseDie, priorSteps);
                          const fromDie = stepDie(baseDie, priorSteps);
                          const toDie = valid ? stepDie(baseDie, priorSteps + 1) : fromDie;
                          return (
                            <option key={statKey} value={statKey} disabled={!valid}>
                              {STAT_LABELS[statKey]}: {fromDie}
                              {valid ? ` → ${toDie}` : ' (Max D12 / N/A)'}
                            </option>
                          );
                        })}
                      </select>
                    )}
                    {startingBonusRule.type === 'skill' &&
                      startingBonusRule.allowedSkillIds && (
                        <select
                          value={allegianceSkillId}
                          onChange={(e) => setAllegianceSkillId(e.target.value)}
                          className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                        >
                          {startingBonusRule.allowedSkillIds.map((skId) => {
                            const sk = rules.skillsAndSpells.find((s) => s.id === skId);
                            return (
                              <option key={skId} value={skId}>
                                {sk?.name || skId} — {sk?.description}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    <button
                      onClick={() =>
                        handleApplyAllegianceBonusToExistingFighter(
                          selectedFighterForAdvance
                        )
                      }
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs cursor-pointer shrink-0"
                    >
                      Apply {startingBonusRule.name} (+1 Lvl)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 1. Characteristic Advance */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                1. Record Statistic Advance (1 Die Step, max D12 / D20)
              </h4>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={advStatKey}
                  onChange={(e) =>
                    setAdvStatKey(e.target.value as keyof StatNumericModifiers)
                  }
                  className="bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                >
                  <option value="move">Move (M — Die Step)</option>
                  <option value="strike">Strike (S — Die Step)</option>
                  <option value="block">Block (B — Die Step)</option>
                  <option value="ranged">Ranged (R — Die Step)</option>
                  <option value="nimbleness">Nimbleness (N — Die Step)</option>
                  <option value="concealment">Concealment (C — Die Step)</option>
                  <option value="awareness">Awareness (A — Die Step)</option>
                  <option value="fortitude">Fortitude (F — Die Step)</option>
                  <option value="presence">Presence (P — Die Step)</option>
                  <option value="wounds">Wounds (+/- Permanent Box)</option>
                </select>
                <button
                  onClick={() => handleApplyStatAdvance(selectedFighterForAdvance, 1)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs cursor-pointer"
                >
                  +1 Die Step Advance
                </button>
                <button
                  onClick={() => handleApplyStatAdvance(selectedFighterForAdvance, -1)}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs cursor-pointer"
                >
                  -1 Die Step
                </button>
              </div>
            </div>

            {/* 2. Learn New Skill or Magic Spell */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  2. Learn New Skill or Spell
                </h4>
                <label className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideAdvSkillPrereqs}
                    onChange={(e) => setOverrideAdvSkillPrereqs(e.target.checked)}
                  />
                  Override skill prerequisites (Custom)
                </label>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={advSkillId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setAdvSkillId(nextId);
                    if (nextId === 'sk-gifted' || nextId === 'sk-hedge-magic') {
                      const currentArchs = getFighterMagicalArchetypes(
                        selectedFighterForAdvance,
                        rules.skillsAndSpells
                      );
                      const firstAvailable =
                        allowedArchetypesForAllegiance.find(
                          (a) => !currentArchs.includes(a)
                        ) ||
                        ALL_MAGICAL_ARCHETYPES.find((a) => !currentArchs.includes(a)) ||
                        'Natural';
                      setGiftedArchetype(firstAvailable);
                    }
                  }}
                  className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                >
                  {sortedSkillsAndSpells.map((s) => {
                    const sp = rules.species.find(
                      (spItem) => spItem.id === selectedFighterForAdvance.speciesId
                    );
                    const ownedSkills = [
                      ...(sp?.innateSkillIds ?? []),
                      ...selectedFighterForAdvance.learnedSkillIds,
                    ];
                    const fighterArchs = getFighterMagicalArchetypes(
                      selectedFighterForAdvance,
                      rules.skillsAndSpells
                    );
                    const qual = checkSkillQualification(
                      s,
                      selectedFighterForAdvance.speciesId,
                      ownedSkills,
                      selectedFighterForAdvance.learnedSpellIds,
                      rules.skillsAndSpells,
                      fighterArchs,
                      Boolean(
                        selectedFighterForAdvance.isMagicUser ||
                          selectedFighterForAdvance.learnedSpellIds.length > 0 ||
                          fighterArchs.length > 0
                      )
                    );
                    const isDisabled = !overrideAdvSkillPrereqs && !qual.qualified;
                    return (
                      <option key={s.id} value={s.id} disabled={isDisabled}>
                        {s.name} [{s.category}]
                        {!qual.qualified
                          ? ` (${qual.reason})`
                          : ` — ${s.description.slice(0, 60)}...`}
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={() => handleLearnSkillOrSpell(selectedFighterForAdvance)}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer shrink-0"
                >
                  Grant Skill / Spell
                </button>
              </div>

              {/* Magical Archetype selector when learning Gifted (sk-gifted) or Hedge Magic (sk-hedge-magic) */}
              {(advSkillId === 'sk-gifted' || advSkillId === 'sk-hedge-magic') && (
                <div className="bg-indigo-950/30 border border-indigo-700/50 rounded-lg p-3 space-y-1.5">
                  <label className="block text-[11px] font-semibold text-indigo-300">
                    ✦ Select Magical Archetype for{' '}
                    {advSkillId === 'sk-hedge-magic' ? 'Hedge Magic' : 'Gifted'}:
                  </label>
                  <select
                    value={giftedArchetype}
                    onChange={(e) =>
                      setGiftedArchetype(e.target.value as MagicalArchetype)
                    }
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs"
                  >
                    {ALL_MAGICAL_ARCHETYPES.map((arch) => {
                      const fighterArchs = getFighterMagicalArchetypes(
                        selectedFighterForAdvance,
                        rules.skillsAndSpells
                      );
                      const alreadyKnown = fighterArchs.includes(arch);
                      const isAllowed = allowedArchetypesForAllegiance.includes(arch);
                      const isDisabled =
                        alreadyKnown || (!overrideAdvSkillPrereqs && !isAllowed);
                      return (
                        <option key={arch} value={arch} disabled={isDisabled}>
                          {arch} Magic
                          {alreadyKnown
                            ? ' (Already Unlocked)'
                            : !isAllowed
                            ? ` (Not in ${allegiance?.name} allowed archetypes)`
                            : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {(() => {
                const chosen = rules.skillsAndSpells.find((s) => s.id === advSkillId);
                if (!chosen) return null;
                return (
                  <div className="text-[11px] text-stone-400 bg-stone-900/70 border border-stone-800 rounded-lg px-3 py-2 space-y-0.5">
                    <div>
                      <strong className="text-emerald-300">{chosen.name}</strong>{' '}
                      <span className="text-stone-500">({chosen.category})</span>
                      {chosen.requirementsText && chosen.requirementsText !== 'None' && (
                        <span className="text-amber-300 ml-2">
                          • Requirements: {chosen.requirementsText}
                        </span>
                      )}
                    </div>
                    <div>{chosen.description}</div>
                  </div>
                );
              })()}
            </div>

            {/* 2b. Magical Archetypes & Post-Battle Magic Access */}
            <div className="bg-indigo-950/20 border border-indigo-800/50 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  ✦ Magical Archetypes &amp; Post-Battle Magic Access
                </h4>
                <label className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideAdvArchetypeRestrictions}
                    onChange={(e) =>
                      setOverrideAdvArchetypeRestrictions(e.target.checked)
                    }
                  />
                  Override archetype restrictions
                </label>
              </div>

              <p className="text-[11px] text-stone-400">
                Beasts with access to a Magical Archetype can learn its Spells when taking
                Advancements. Additional Magical Archetypes can be unlocked via the{' '}
                <strong className="text-indigo-300">Gifted</strong> skill advancement or through
                Post-Battle / Exploration / Relic effects.
              </p>

              {/* Currently Unlocked Magical Archetypes */}
              {(() => {
                const fighterArchs = getFighterMagicalArchetypes(
                  selectedFighterForAdvance,
                  rules.skillsAndSpells
                );
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-stone-400 mr-1">
                      Unlocked Archetypes:
                    </span>
                    {fighterArchs.length === 0 ? (
                      <span className="text-[11px] text-stone-500 italic">
                        None (Not yet a Magic-user)
                      </span>
                    ) : (
                      fighterArchs.map((arch) => (
                        <span
                          key={arch}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-200 border border-indigo-700/60"
                        >
                          ✦ {arch} Magic
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveMagicalArchetype(
                                selectedFighterForAdvance,
                                arch
                              )
                            }
                            className="text-indigo-400 hover:text-red-300 cursor-pointer ml-0.5"
                            title={`Remove ${arch} Magic access`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                );
              })()}

              {/* Unlock Additional Archetype Controls */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <select
                  value={postBattleArchetype}
                  onChange={(e) =>
                    setPostBattleArchetype(e.target.value as MagicalArchetype)
                  }
                  className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                >
                  {ALL_MAGICAL_ARCHETYPES.map((arch) => {
                    const fighterArchs = getFighterMagicalArchetypes(
                      selectedFighterForAdvance,
                      rules.skillsAndSpells
                    );
                    const alreadyKnown = fighterArchs.includes(arch);
                    const isAllowed = allowedArchetypesForAllegiance.includes(arch);
                    const isDisabled =
                      alreadyKnown || (!overrideAdvArchetypeRestrictions && !isAllowed);
                    return (
                      <option key={arch} value={arch} disabled={isDisabled}>
                        {arch} Magic
                        {alreadyKnown
                          ? ' [Already Unlocked]'
                          : !isAllowed
                          ? ` (Not in ${allegiance?.name} allowed archetypes)`
                          : ''}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    handleUnlockAdditionalArchetype(selectedFighterForAdvance)
                  }
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-stone-950 font-bold text-xs cursor-pointer shrink-0"
                >
                  + Unlock Archetype
                </button>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={postBattleArchetypeCountsAsAdvance}
                  onChange={(e) =>
                    setPostBattleArchetypeCountsAsAdvance(e.target.checked)
                  }
                />
                Count as an XP Advancement (+1 Level / Advance) — leave unchecked for free
                Post-Battle / Exploration / Relic effects
              </label>
            </div>

            {/* 3. Record Post-Game Injury */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">
                3. Record Post-Battle Injury
              </h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={advInjuryId}
                  onChange={(e) => setAdvInjuryId(e.target.value)}
                  className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                >
                  {rules.injuries.map((i) => (
                    <option key={i.id} value={i.id}>
                      [{i.rollRange}] {i.name} — {i.effect}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleAddInjuryToFighter(selectedFighterForAdvance)}
                  className="px-4 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-stone-100 font-bold text-xs cursor-pointer shrink-0"
                >
                  Apply Injury
                </button>
              </div>
            </div>

            {/* History Log */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                Fighter Progression History
              </h4>
              {selectedFighterForAdvance.advanceHistory.length === 0 ? (
                <p className="text-xs text-stone-500 italic">No advances recorded yet.</p>
              ) : (
                <ul className="space-y-1 max-h-40 overflow-y-auto text-xs">
                  {selectedFighterForAdvance.advanceHistory.map((log) => (
                    <li
                      key={log.id}
                      className="flex items-center justify-between bg-stone-950 px-3 py-1.5 rounded border border-stone-800"
                    >
                      <span className="text-stone-200">{log.description}</span>
                      <span className="text-stone-500 text-[11px]">{log.date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stat Roll & Modifier Breakdown Modal */}
      {inspectTarget &&
        (() => {
          const targetFighter = activeWarband.fighters.find(
            (f) => f.id === inspectTarget.fighterId
          );
          if (!targetFighter) return null;
          return (
            <StatRollAndBreakdownModal
              fighter={targetFighter}
              rules={rules}
              warbandInventory={activeWarband.inventory}
              initialTab={inspectTarget.tab}
              includeMatchState={
                targetFighter.currentWounds <
                  computeFighterStats(targetFighter, rules).effective.wounds ||
                targetFighter.conditions.length > 0
              }
              onClose={() => setInspectTarget(null)}
            />
          );
        })()}

      {/* Skill or Spell Reference Modal */}
      {selectedSkillOrSpell &&
        (() => {
          const targetFighter = activeWarband.fighters.find(
            (f) => f.id === selectedSkillOrSpell.fighterId
          );
          if (!targetFighter) return null;
          return (
            <SkillOrSpellDetailModal
              fighter={targetFighter}
              rules={rules}
              initialSkillOrSpellId={selectedSkillOrSpell.skillOrSpellId}
              onClose={() => setSelectedSkillOrSpell(null)}
              onOpenStatRoller={(f, statKey) =>
                setInspectTarget({ fighterId: f.id, tab: statKey })
              }
            />
          );
        })()}
    </div>
  );
};
