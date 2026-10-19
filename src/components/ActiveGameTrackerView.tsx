import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  EquippedOrStashedItem,
  Fighter,
  TabletopCondition,
} from '../types/game';
import {
  computeFighterStats,
  computeFighterCombatBreakdown,
  formatItemDisplayName,
  formatSigned,
  getFighterFatePoints,
  getItemQuantity,
  getStartingFatePointsForRole,
  isEquipmentConsumable,
  isEquipmentStackable,
  MAX_FIGHTER_FATE_POINTS,
  StatKey,
} from '../utils/gameMath';
import {
  StatRollAndBreakdownModal,
  ModalInspectTab,
} from './StatRollAndBreakdownModal';
import {
  Heart,
  Sparkles,
  Award,
  Sword,
  Shield,
  Dices,
  RotateCcw,
  Package,
} from 'lucide-react';

const ALL_CONDITIONS: TabletopCondition[] = [
  'Activated',
  'Sneaking',
  'Berserk',
  'Stunned',
  'Paralysed',
  'Burning',
  'Bleeding',
  'Poisoned',
  'Infected',
  'Drunk',
  'Temporal Flux',
  'Out of Action',
];

export const ActiveGameTrackerView: React.FC = () => {
  const { activeWarband, rules, saveWarband } = useApp();
  const [roundNumber, setRoundNumber] = useState(1);
  const [diceResult, setDiceResult] = useState<string | null>(null);
  const [inspectTarget, setInspectTarget] = useState<{
    fighterId: string;
    tab: ModalInspectTab;
  } | null>(null);

  if (!activeWarband) return null;

  const activeMatchFighters = activeWarband.fighters.filter(
    (f) => f.status === 'Active'
  );
  const benchedFighters = activeWarband.fighters.filter(
    (f) => f.status !== 'Active'
  );

  const inspectedFighter = inspectTarget
    ? activeWarband.fighters.find((f) => f.id === inspectTarget.fighterId) ?? null
    : null;

  const handleWoundsDelta = async (fighter: Fighter, delta: number, maxWounds: number) => {
    const nextWounds = Math.max(0, Math.min(maxWounds, fighter.currentWounds + delta));
    const autoOoa: TabletopCondition[] =
      nextWounds === 0 && !fighter.conditions.includes('Out of Action')
        ? [...fighter.conditions, 'Out of Action']
        : fighter.conditions;

    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id
        ? { ...f, currentWounds: nextWounds, conditions: autoOoa }
        : f
    );
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
  };

  const handleFateDelta = async (fighter: Fighter, delta: number) => {
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

  const handleResetAllStartingFate = async () => {
    const updatedFighters = activeWarband.fighters.map((f) => ({
      ...f,
      fatePoints: getStartingFatePointsForRole(f.role),
    }));
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
  };

  const handleToggleCondition = async (fighter: Fighter, cond: TabletopCondition) => {
    const exists = fighter.conditions.includes(cond);
    const nextConditions = exists
      ? fighter.conditions.filter((c) => c !== cond)
      : [...fighter.conditions, cond];

    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id ? { ...f, conditions: nextConditions } : f
    );
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
  };

  const handleAdjustConsumable = async (
    item: EquippedOrStashedItem,
    delta: number
  ) => {
    const eq = rules.equipment.find((e) => e.id === item.equipmentId);
    const currentQty = getItemQuantity(item);
    const nextQty = currentQty + delta;

    if (nextQty <= 0) {
      const updatedInv = activeWarband.inventory.filter(
        (i) => i.instanceId !== item.instanceId
      );
      await saveWarband({ ...activeWarband, inventory: updatedInv });
      return;
    }

    const unitCost = eq?.cost ?? 0;
    const nextPurchaseCost =
      delta > 0
        ? item.purchaseCost + unitCost * delta
        : Math.max(0, Math.round((item.purchaseCost * nextQty) / currentQty));

    const updatedInv = activeWarband.inventory.map((i) =>
      i.instanceId === item.instanceId
        ? { ...i, quantity: nextQty, purchaseCost: nextPurchaseCost }
        : i
    );
    await saveWarband({ ...activeWarband, inventory: updatedInv });
  };

  const handleNextRound = async () => {
    setRoundNumber((r) => r + 1);
    // Clear 'Activated' flags at start of new round
    const updatedFighters = activeWarband.fighters.map((f) => ({
      ...f,
      conditions: f.conditions.filter((c) => c !== 'Activated'),
    }));
    await saveWarband({ ...activeWarband, fighters: updatedFighters });
  };

  const handleConcludeMatch = async () => {
    if (
      !confirm(
        'Conclude Tabletop Match? All active beasts who participated will gain +1 Survival XP, and temporary match wounds, conditions, and starting Fate points (Leader 3, Second 2, Others 1) will be reset for your next game.'
      )
    ) {
      return;
    }

    const updatedFighters = activeWarband.fighters.map((f) => {
      const { effective } = computeFighterStats(f, rules);
      const defaultFate = getStartingFatePointsForRole(f.role);
      if (f.status === 'Active') {
        return {
          ...f,
          xp: f.xp + 1,
          currentWounds: effective.wounds,
          fatePoints: defaultFate,
          conditions: [],
        };
      }
      // Recovering fighters who missed this game return to Active ready status!
      if (f.status === 'Miss Next Game') {
        return {
          ...f,
          status: 'Active' as const,
          currentWounds: effective.wounds,
          fatePoints: defaultFate,
          conditions: [],
        };
      }
      return f;
    });

    // Clear "newly built" flag on Den upgrades so they are ready
    const updatedDenUpgrades = activeWarband.denUpgrades.map((d) => ({
      ...d,
      isNewThisCycle: false,
    }));

    await saveWarband({
      ...activeWarband,
      matchesPlayed: activeWarband.matchesPlayed + 1,
      fighters: updatedFighters,
      denUpgrades: updatedDenUpgrades,
    });
    setRoundNumber(1);
  };

  const rollQuickDie = (sides: number) => {
    const roll = Math.floor(Math.random() * sides) + 1;
    setDiceResult(`D${sides}: ${roll}`);
  };

  const STAT_KEYS: StatKey[] = [
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

  return (
    <div className="space-y-5">
      {/* Mobile-Friendly Match Control Bar */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-amber-500 text-stone-950 font-extrabold px-3.5 py-1.5 rounded-xl text-sm">
            Turn {roundNumber}
          </div>
          <button
            onClick={handleNextRound}
            className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold border border-stone-700 cursor-pointer"
          >
            Next Turn (Reset Activations)
          </button>
          <button
            onClick={handleResetAllStartingFate}
            className="flex items-center gap-1.5 bg-stone-950 hover:bg-stone-800 border border-stone-800 px-3 py-1.5 rounded-xl text-xs text-purple-300 font-semibold cursor-pointer"
            title="Rulebook Page 36: Reset all models to starting Fate points (Leader: 3, Second: 2, Others: 1; Max 5 per model)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Starting Fate (3/2/1)
          </button>
          {activeWarband.allegianceId === 'al-rogues' && (
            <span className="text-[11px] bg-purple-950/60 border border-purple-700/60 text-purple-200 px-2.5 py-1 rounded-lg">
              ★ Born Lucky (Rogues): Distribute +3 extra Fate among your models!
            </span>
          )}
        </div>

        {/* Quick Polyhedral Dice Roller for Phone Play */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Dices className="w-4 h-4 text-amber-400 mr-1" />
          {[4, 6, 8, 10, 12, 20].map((sides) => (
            <button
              key={sides}
              onClick={() => rollQuickDie(sides)}
              className="px-2.5 py-1 rounded-lg bg-stone-950 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-mono font-semibold cursor-pointer"
            >
              D{sides}
            </button>
          ))}
          {diceResult && (
            <span className="ml-1 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs font-mono">
              {diceResult}
            </span>
          )}
        </div>

        <button
          onClick={handleConcludeMatch}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs cursor-pointer"
        >
          <Award className="w-4 h-4" />
          End Match (+1 XP & Recover)
        </button>
      </div>

      {/* Active Fighter Cards for Tabletop Touch Use */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeMatchFighters.map((fighter) => {
          const species = rules.species.find((s) => s.id === fighter.speciesId);
          const { effective, level } = computeFighterStats(
            fighter,
            rules,
            activeWarband.inventory
          );
          const combat = computeFighterCombatBreakdown(
            fighter,
            rules,
            activeWarband.inventory,
            true
          );
          const equipped = activeWarband.inventory.filter(
            (i) => i.assignedFighterId === fighter.id && !i.isConsumed
          );
          const isOoa =
            fighter.currentWounds === 0 ||
            fighter.conditions.includes('Out of Action');
          const isActivated = fighter.conditions.includes('Activated');

          // Calculate shaded Wound boxes crossed off (boxes 4, 7, 10, 13 suffered)
          const woundsTaken = Math.max(0, effective.wounds - fighter.currentWounds);
          const woundPenalty = [4, 7, 10, 13].filter((box) => woundsTaken >= box).length;
          const rangedWeaponSummary = combat.strong.weapons.find(
            (w) => w.weaponType === 'Ranged'
          );
          const fighterFate = getFighterFatePoints(fighter);

          return (
            <div
              key={fighter.id}
              className={`rounded-2xl border p-4 space-y-3 transition ${
                isOoa
                  ? 'bg-red-950/20 border-red-800/70 opacity-75'
                  : isActivated
                  ? 'bg-stone-900/60 border-emerald-700/60'
                  : 'bg-stone-900 border-stone-800'
              }`}
            >
              {/* Top Row: Name & Per-Model Wounds + Fate Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {fighter.role} • Lvl {level}
                    </span>
                    <h3 className="text-base font-bold text-stone-100 font-serif">
                      {fighter.name}
                    </h3>
                  </div>
                  <p className="text-xs text-stone-400">
                    {species?.name} ({species?.size} • {species?.baseSizeMm || '30mm'})
                    {woundPenalty > 0 && (
                      <span
                        className={`ml-2 font-bold ${
                          combat.woundPenaltyIgnoredBy
                            ? 'text-stone-500 line-through'
                            : 'text-red-400'
                        }`}
                      >
                        (-{woundPenalty} Wound Penalty)
                      </span>
                    )}
                    {woundPenalty > 0 && combat.woundPenaltyIgnoredBy && (
                      <span className="ml-1 text-[11px] text-emerald-400 font-semibold">
                        [Ignored: {combat.woundPenaltyIgnoredBy}]
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Per-Fighter Fate Points Control (Page 36: Start 3/2/1, Max 5) */}
                  <div
                    className="flex items-center gap-1.5 bg-stone-950 border border-purple-500/30 px-2.5 py-1.5 rounded-xl"
                    title={`Fate Points (Starts with ${getStartingFatePointsForRole(
                      fighter.role
                    )}, Max ${MAX_FIGHTER_FATE_POINTS}; +1 on natural 1 Roll-off)`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] font-bold uppercase text-purple-300">
                      Fate
                    </span>
                    <button
                      onClick={() => handleFateDelta(fighter, -1)}
                      disabled={fighterFate <= 0}
                      className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-purple-900/60 disabled:opacity-40 text-stone-100 font-bold text-sm flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <div className="text-center min-w-[32px]">
                      <span className="text-base font-extrabold text-purple-300">
                        {fighterFate}
                      </span>
                      <span className="text-[10px] text-stone-500">
                        /{MAX_FIGHTER_FATE_POINTS}
                      </span>
                    </div>
                    <button
                      onClick={() => handleFateDelta(fighter, 1)}
                      disabled={fighterFate >= MAX_FIGHTER_FATE_POINTS}
                      className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-purple-900/60 disabled:opacity-40 text-stone-100 font-bold text-sm flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {/* Large Touch-Friendly Wounds Control */}
                  <div className="flex items-center gap-2 bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl">
                    <Heart
                      className={`w-4 h-4 ${
                        fighter.currentWounds <= 4
                          ? 'text-red-500 animate-pulse'
                          : 'text-emerald-400'
                      }`}
                    />
                    <button
                      onClick={() =>
                        handleWoundsDelta(fighter, -1, effective.wounds)
                      }
                      className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-red-900/60 text-stone-100 font-bold text-base flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <div className="text-center min-w-[44px]">
                      <span className="text-lg font-extrabold text-stone-100">
                        {fighter.currentWounds}
                      </span>
                      <span className="text-xs text-stone-500">
                        /{effective.wounds}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        handleWoundsDelta(fighter, 1, effective.wounds)
                      }
                      className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-emerald-900/60 text-stone-100 font-bold text-base flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Net Strong & Net Tough Summary Badges (Tap to Inspect) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() =>
                      setInspectTarget({ fighterId: fighter.id, tab: 'strong' })
                    }
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                      combat.strong.primaryMeleeNetStrong > 0
                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60 hover:border-emerald-500'
                        : combat.strong.primaryMeleeNetStrong < 0
                        ? 'bg-orange-950/70 text-orange-300 border-orange-700/60 hover:border-orange-500'
                        : 'bg-stone-950 text-stone-300 border-stone-800 hover:border-stone-700'
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

                  <button
                    onClick={() =>
                      setInspectTarget({ fighterId: fighter.id, tab: 'tough' })
                    }
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                      combat.tough.netTough > 0
                        ? 'bg-sky-950/70 text-sky-300 border-sky-700/60 hover:border-sky-500'
                        : combat.tough.netTough < 0
                        ? 'bg-orange-950/70 text-orange-300 border-orange-700/60 hover:border-orange-500'
                        : 'bg-stone-950 text-stone-300 border-stone-800 hover:border-stone-700'
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
                </div>

                <span className="text-[10px] text-stone-500 flex items-center gap-1">
                  <Dices className="w-3 h-3 text-amber-400/80" />
                  Tap any stat to roll & view mods
                </span>
              </div>

              {/* Interactive 9-Stat Bar (M, S, B, R, N, C, A, F, P) with Live Modifiers */}
              <div className="grid grid-cols-9 gap-1 text-center bg-stone-950 border border-stone-800 rounded-xl p-1.5">
                {STAT_KEYS.map((sKey) => {
                  const st = combat.stats[sKey];
                  const mod = st.activeMatchRollMod;
                  const moveInchMod = st.moveInchesMod ?? 0;
                  return (
                    <button
                      key={sKey}
                      onClick={() =>
                        setInspectTarget({ fighterId: fighter.id, tab: sKey })
                      }
                      className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg border transition cursor-pointer ${
                        mod > 0
                          ? 'bg-emerald-950/25 border-emerald-800/50 hover:border-emerald-500'
                          : mod < 0
                          ? 'bg-red-950/25 border-red-800/50 hover:border-red-500'
                          : 'bg-stone-900/50 border-transparent hover:border-stone-700'
                      }`}
                      title={`Tap to inspect & roll ${st.label}`}
                    >
                      <div className="text-[9px] text-stone-400 font-bold">
                        {st.shortLabel}
                      </div>
                      <div
                        className={`text-xs font-mono font-bold ${
                          st.dieOverriddenBy ? 'text-orange-300' : 'text-amber-300'
                        }`}
                      >
                        {st.effectiveDie}
                      </div>
                      <div
                        className={`text-[9px] font-mono font-extrabold leading-tight ${
                          mod > 0
                            ? 'text-emerald-400'
                            : mod < 0
                            ? 'text-red-400'
                            : moveInchMod > 0
                            ? 'text-emerald-400'
                            : 'text-stone-600'
                        }`}
                      >
                        {mod !== 0
                          ? formatSigned(mod)
                          : moveInchMod > 0
                          ? `+${moveInchMod}"`
                          : '—'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Weapons & Skills Quick Reference */}
              <div className="text-xs space-y-1.5 bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/70">
                <div>
                  <Sword className="w-3.5 h-3.5 inline text-amber-400 mr-1" />
                  <strong className="text-stone-300">Gear: </strong>
                  {equipped.length === 0
                    ? 'Unarmed'
                    : equipped
                        .map((i) => {
                          const eq = rules.equipment.find(
                            (e) => e.id === i.equipmentId
                          );
                          return `${formatItemDisplayName(i, eq)}${
                            eq?.weaponModifiers ? ` (${eq.weaponModifiers})` : ''
                          }`;
                        })
                        .join(' • ')}
                </div>

                {/* Interactive Consumables & Ammunition Tracker (Arrows, Shot, Powder, Potions, Poisons, Ingredients) */}
                {(() => {
                  const equippedConsumables = equipped.filter((i) => {
                    const eq = rules.equipment.find((e) => e.id === i.equipmentId);
                    return isEquipmentConsumable(eq);
                  });
                  if (equippedConsumables.length === 0) return null;

                  return (
                    <div className="pt-1.5 mt-1 border-t border-stone-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-amber-300 flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-amber-400" />
                          Consumables &amp; Ammunition (Tap to Use / Spend)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {equippedConsumables.map((cItem) => {
                          const eq = rules.equipment.find(
                            (e) => e.id === cItem.equipmentId
                          );
                          const qty = getItemQuantity(cItem);
                          const stackable = isEquipmentStackable(eq);
                          return (
                            <div
                              key={cItem.instanceId}
                              title={eq?.description}
                              className="flex items-center gap-1.5 bg-stone-900 border border-amber-700/40 rounded-lg px-2 py-1 text-[11px]"
                            >
                              <span className="font-semibold text-amber-200">
                                {formatItemDisplayName(cItem, eq)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAdjustConsumable(cItem, -1)}
                                className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-[10px] cursor-pointer transition"
                                title={
                                  qty > 1
                                    ? `Spend 1 (${qty - 1} will remain in slot)`
                                    : 'Use & expend this consumable (removes from slot)'
                                }
                              >
                                {qty > 1 ? 'Use 1 (-1)' : 'Consume'}
                              </button>
                              {stackable && (
                                <button
                                  type="button"
                                  onClick={() => handleAdjustConsumable(cItem, 1)}
                                  className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[10px] cursor-pointer"
                                  title="Add +1 back to stack"
                                >
                                  +1
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <Sparkles className="w-3.5 h-3.5 inline text-emerald-400 mr-1" />
                  <strong className="text-stone-300">Skills/Spells: </strong>
                  {[
                    ...(species?.innateSkillIds ?? []),
                    ...fighter.learnedSkillIds,
                    ...fighter.learnedSpellIds,
                  ]
                    .map(
                      (id) =>
                        rules.skillsAndSpells.find((s) => s.id === id)?.name
                    )
                    .filter(Boolean)
                    .join(', ') || 'None'}
                </div>
              </div>

              {/* Tap-to-Toggle Status Conditions */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ALL_CONDITIONS.map((cond) => {
                  const active = fighter.conditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      onClick={() => handleToggleCondition(fighter, cond)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                        active
                          ? cond === 'Out of Action'
                            ? 'bg-red-700 text-white border-red-500'
                            : cond === 'Activated'
                            ? 'bg-emerald-600 text-stone-950 border-emerald-400'
                            : 'bg-amber-500 text-stone-950 border-amber-400'
                          : 'bg-stone-950 text-stone-400 border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      {cond}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Benched / Recovering Fighters Notice */}
      {benchedFighters.length > 0 && (
        <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-4 text-xs text-stone-400">
          <strong className="text-amber-300">Benched / Recovering this Match: </strong>
          {benchedFighters.map((f) => `${f.name} (${f.status})`).join(', ')}. Clicking{' '}
          <strong>End Match</strong> will automatically restore &ldquo;Miss Next Game&rdquo; fighters to Active duty.
        </div>
      )}

      {/* Stat Roll & Modifier Breakdown Modal */}
      {inspectedFighter && inspectTarget && (
        <StatRollAndBreakdownModal
          fighter={inspectedFighter}
          rules={rules}
          warbandInventory={activeWarband.inventory}
          initialTab={inspectTarget.tab}
          includeMatchState={true}
          onClose={() => setInspectTarget(null)}
        />
      )}
    </div>
  );
};

