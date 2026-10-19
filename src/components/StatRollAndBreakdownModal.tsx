import React, { useState, useEffect } from 'react';
import { Fighter, RulesDataset, EquippedOrStashedItem, DiceValue } from '../types/game';
import { useApp } from '../context/AppContext';
import {
  computeFighterCombatBreakdown,
  computeFighterStats,
  formatItemDisplayName,
  formatSigned,
  getFighterFatePoints,
  getItemQuantity,
  isEquipmentConsumable,
  MAX_FIGHTER_FATE_POINTS,
  StatKey,
} from '../utils/gameMath';
import {
  X,
  Dices,
  Shield,
  Sword,
  Sparkles,
  AlertTriangle,
  Plus,
  Minus,
  CheckSquare,
  Square,
  RotateCcw,
  Package,
} from 'lucide-react';

export type ModalInspectTab = StatKey | 'strong' | 'tough';

interface StatRollAndBreakdownModalProps {
  fighter: Fighter;
  rules: RulesDataset;
  warbandInventory: EquippedOrStashedItem[];
  initialTab: ModalInspectTab;
  includeMatchState?: boolean;
  onClose: () => void;
}

function getDieMaxSides(die: DiceValue | 'D3'): number {
  switch (die) {
    case 'D3':
      return 3;
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
      return 0;
  }
}

export const StatRollAndBreakdownModal: React.FC<StatRollAndBreakdownModalProps> = ({
  fighter,
  rules,
  warbandInventory,
  initialTab,
  includeMatchState = true,
  onClose,
}) => {
  const { activeWarband, saveWarband } = useApp();
  const [activeTab, setActiveTab] = useState<ModalInspectTab>(initialTab);
  const [useMatchWoundsAndConditions, setUseMatchWoundsAndConditions] =
    useState<boolean>(includeMatchState);
  const [situationalCounts, setSituationalCounts] = useState<Record<string, number>>({});
  const [customMod, setCustomMod] = useState<number>(0);
  const [rollState, setRollState] = useState<{
    rawDie: number;
    secondRawDie?: number;
    dieSides: number;
    timestamp: number;
    fateAwarded?: boolean;
    wasFateReroll?: boolean;
  } | null>(null);

  const species = rules.species.find((s) => s.id === fighter.speciesId);
  const { level } = computeFighterStats(fighter, rules, warbandInventory);
  const breakdown = computeFighterCombatBreakdown(
    fighter,
    rules,
    warbandInventory,
    useMatchWoundsAndConditions
  );
  const fighterFate = getFighterFatePoints(fighter);

  // Reset situational checkboxes/steppers & roll when switching tabs
  useEffect(() => {
    if (activeTab !== 'strong' && activeTab !== 'tough') {
      const statInfo = breakdown.stats[activeTab];
      const defaults: Record<string, number> = {};
      for (const e of statInfo.situationalEntries) {
        if (e.defaultChecked) {
          defaults[e.id] = 1;
        }
      }
      setSituationalCounts(defaults);
    } else {
      setSituationalCounts({});
    }
    setCustomMod(0);
    setRollState(null);
  }, [activeTab, fighter.id]);

  const toggleSituational = (id: string) => {
    setSituationalCounts((prev) => ({
      ...prev,
      [id]: (prev[id] ?? 0) > 0 ? 0 : 1,
    }));
  };

  const adjustSituationalCount = (id: string, delta: number) => {
    setSituationalCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));
  };

  const STAT_TABS: StatKey[] = [
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

  const isStatTab = activeTab !== 'strong' && activeTab !== 'tough';
  const currentStat = isStatTab ? breakdown.stats[activeTab] : null;

  const situationalRollBonus = currentStat
    ? currentStat.situationalEntries
        .filter((e) => (situationalCounts[e.id] ?? 0) > 0 && e.unit === 'roll')
        .reduce((acc, e) => acc + e.value * (situationalCounts[e.id] ?? 0), 0)
    : 0;

  const situationalInchesBonus = currentStat
    ? currentStat.situationalEntries
        .filter((e) => (situationalCounts[e.id] ?? 0) > 0 && e.unit === 'inches')
        .reduce((acc, e) => acc + e.value * (situationalCounts[e.id] ?? 0), 0)
    : 0;

  const totalRollModifier = currentStat
    ? currentStat.activeMatchRollMod + situationalRollBonus + customMod
    : 0;

  const handleRollStat = (rollTwoPickHighest = false, wasFateReroll = false) => {
    if (!currentStat) return;
    const sides = getDieMaxSides(currentStat.effectiveDie);
    if (sides <= 0) return;
    const r1 = Math.floor(Math.random() * sides) + 1;
    const r2 = rollTwoPickHighest ? Math.floor(Math.random() * sides) + 1 : undefined;
    setRollState({
      rawDie: r2 !== undefined ? Math.max(r1, r2) : r1,
      secondRawDie: r2 !== undefined ? Math.min(r1, r2) : undefined,
      dieSides: sides,
      timestamp: Date.now(),
      fateAwarded: false,
      wasFateReroll,
    });
  };

  const handleFighterFateDelta = async (delta: number) => {
    if (!activeWarband) return;
    const nextFate = Math.max(
      0,
      Math.min(MAX_FIGHTER_FATE_POINTS, fighterFate + delta)
    );
    const updatedFighters = activeWarband.fighters.map((f) =>
      f.id === fighter.id ? { ...f, fatePoints: nextFate } : f
    );
    await saveWarband({
      ...activeWarband,
      fighters: updatedFighters,
    });
  };

  const handleAwardDisastrousFate = async () => {
    if (!activeWarband || !rollState || rollState.fateAwarded) return;
    await handleFighterFateDelta(1);
    setRollState((prev) => (prev ? { ...prev, fateAwarded: true } : null));
  };

  const handleSpendFateToReroll = async () => {
    if (!activeWarband || fighterFate <= 0 || !currentStat) return;
    await handleFighterFateDelta(-1);
    handleRollStat(false, true);
  };

  const handleConsumeEquippedItem = async (item: EquippedOrStashedItem) => {
    if (!activeWarband) return;
    const currentQty = getItemQuantity(item);
    const nextQty = currentQty - 1;
    if (nextQty <= 0) {
      const updatedInv = activeWarband.inventory.filter(
        (i) => i.instanceId !== item.instanceId
      );
      await saveWarband({ ...activeWarband, inventory: updatedInv });
      return;
    }
    const nextPurchaseCost = Math.max(
      0,
      Math.round((item.purchaseCost * nextQty) / currentQty)
    );
    const updatedInv = activeWarband.inventory.map((i) =>
      i.instanceId === item.instanceId
        ? { ...i, quantity: nextQty, purchaseCost: nextPurchaseCost }
        : i
    );
    await saveWarband({ ...activeWarband, inventory: updatedInv });
  };

  // Check if fighter has Natural Hunter (no Perfect +7 or Disastrous +1 Fate on Ranged rolls)
  const allSkillIds = [
    ...(species?.innateSkillIds ?? []),
    ...fighter.learnedSkillIds,
  ];
  const ignoresPerfectDisastrousOnRanged =
    activeTab === 'ranged' && allSkillIds.includes('sk-natural-hunter');
  // Rulebook Page 18: Perfect & Disastrous rolls apply to Roll-offs (not Move distance)
  const appliesPerfectDisastrousRules =
    activeTab !== 'move' && !ignoresPerfectDisastrousOnRanged;

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'Equipment':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'Skill':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'Wounds':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'Condition':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-stone-900 border border-stone-700 rounded-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                {fighter.role} • Lvl {level}
              </span>
              <h3 className="text-lg font-bold text-stone-100 font-serif">
                {fighter.name}
              </h3>
              <span className="text-xs text-stone-400">
                ({species?.name || 'Beast'})
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Tap any Stat, Strong, or Tough tab below to inspect modifiers & roll dice
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeWarband && (
              <div
                className="flex items-center gap-1 bg-stone-950 border border-purple-500/30 px-2.5 py-1 rounded-xl text-xs"
                title="Model Fate Points (Page 36: Max 5 per model)"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] font-bold uppercase text-purple-300">
                  Fate
                </span>
                <button
                  onClick={() => handleFighterFateDelta(-1)}
                  disabled={fighterFate <= 0}
                  className="px-1 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 cursor-pointer"
                >
                  -
                </button>
                <strong className="text-purple-300 font-mono">
                  {fighterFate}/{MAX_FIGHTER_FATE_POINTS}
                </strong>
                <button
                  onClick={() => handleFighterFateDelta(1)}
                  disabled={fighterFate >= MAX_FIGHTER_FATE_POINTS}
                  className="px-1 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 cursor-pointer"
                >
                  +
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Navigation Bar: 9 Stats + Strong + Tough */}
        <div className="space-y-2">
          <div className="grid grid-cols-9 gap-1">
            {STAT_TABS.map((sKey) => {
              const st = breakdown.stats[sKey];
              const isSelected = activeTab === sKey;
              const mod = st.activeMatchRollMod;
              return (
                <button
                  key={sKey}
                  onClick={() => setActiveTab(sKey)}
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border text-center transition cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                      : 'bg-stone-950 border-stone-800 hover:border-stone-700 text-stone-300'
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase text-stone-400">
                    {st.shortLabel}
                  </span>
                  <span className="text-xs font-mono font-bold text-stone-100">
                    {st.effectiveDie}
                  </span>
                  <span
                    className={`text-[9px] font-mono font-extrabold ${
                      mod > 0
                        ? 'text-emerald-400'
                        : mod < 0
                        ? 'text-red-400'
                        : 'text-stone-500'
                    }`}
                  >
                    {mod === 0 ? '+0' : formatSigned(mod)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Strong & Tough Tabs + Match State Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('strong')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  activeTab === 'strong'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                    : 'bg-stone-950 border-stone-800 hover:border-stone-700 text-stone-300'
                }`}
              >
                <Sword className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Melee: {breakdown.strong.primaryMeleeLabel}
                  {breakdown.strong.netBaseStrong !==
                    breakdown.strong.primaryMeleeNetStrong && (
                    <span className="text-[10px] text-stone-400 ml-1">
                      (Base {breakdown.strong.baseLabel})
                    </span>
                  )}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('tough')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  activeTab === 'tough'
                    ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                    : 'bg-stone-950 border-stone-800 hover:border-stone-700 text-stone-300'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span>{breakdown.tough.label}</span>
              </button>
            </div>

            {(fighter.currentWounds < breakdown.maxWounds ||
              fighter.conditions.length > 0) && (
              <button
                onClick={() => setUseMatchWoundsAndConditions((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-stone-300 bg-stone-950 border border-stone-800 px-2.5 py-1 rounded-lg cursor-pointer hover:border-stone-700"
              >
                {useMatchWoundsAndConditions ? (
                  <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-stone-500" />
                )}
                Include Match Wounds/Conditions
              </button>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* VIEW 1: SINGLE STAT BREAKDOWN & INTERACTIVE ROLLER                */}
        {/* ================================================================= */}
        {isStatTab && currentStat && (
          <div className="space-y-4">
            {/* Stat Profile Summary Banner */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-amber-300 font-serif">
                    {currentStat.label} ({currentStat.shortLabel})
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-stone-800 text-stone-200 font-mono font-bold">
                    Die: {currentStat.effectiveDie}
                  </span>
                  {currentStat.effectiveDie !== currentStat.baseDie && (
                    <span className="text-[11px] text-stone-400">
                      (Base {currentStat.baseDie}
                      {currentStat.advanceSteps !== 0
                        ? ` • ${formatSigned(currentStat.advanceSteps)} Adv`
                        : ''}
                      {currentStat.injurySteps !== 0
                        ? ` • ${formatSigned(currentStat.injurySteps)} Inj`
                        : ''}
                      )
                    </span>
                  )}
                </div>
                {currentStat.dieOverriddenBy && (
                  <p className="text-[11px] text-orange-300 mt-1">
                    ⚠ {currentStat.dieOverriddenBy}
                  </p>
                )}
                {activeTab === 'move' && currentStat.moveInchesBase !== undefined && (
                  <p className="text-xs text-emerald-300 font-semibold mt-1">
                    Move Distance: {currentStat.moveInchesBase}&Prime; base
                    {currentStat.moveInchesMod || situationalInchesBonus
                      ? ` + ${
                          (currentStat.moveInchesMod ?? 0) + situationalInchesBonus
                        }" bonus = ${
                          currentStat.moveInchesBase +
                          (currentStat.moveInchesMod ?? 0) +
                          situationalInchesBonus
                        }" total`
                      : ''}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 bg-stone-900 border border-stone-800 px-3.5 py-2 rounded-xl shrink-0">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-stone-400">
                    Roll Formula
                  </div>
                  <div className="text-base font-mono font-extrabold text-stone-100">
                    {currentStat.effectiveDie}{' '}
                    <span
                      className={
                        totalRollModifier > 0
                          ? 'text-emerald-400'
                          : totalRollModifier < 0
                          ? 'text-red-400'
                          : 'text-stone-400'
                      }
                    >
                      {totalRollModifier === 0
                        ? '+ 0'
                        : totalRollModifier > 0
                        ? `+ ${totalRollModifier}`
                        : `- ${Math.abs(totalRollModifier)}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning if Cannot Roll (Paralysed / Berserk Defend) */}
            {currentStat.cannotRollReason && (
              <div className="bg-red-950/50 border border-red-700/70 rounded-xl p-3 flex items-center gap-2.5 text-xs text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <div>
                  <strong>Cannot Roll {currentStat.label}:</strong>{' '}
                  {currentStat.cannotRollReason}
                </div>
              </div>
            )}

            {/* Interactive Dice Roller Card */}
            <div className="bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/20 border border-amber-500/30 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Dices className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-bold text-stone-100">
                    Roll {currentStat.label} Check
                  </span>
                </div>

                {/* Ad-hoc Custom Modifier Stepper */}
                <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 px-2.5 py-1 rounded-lg text-xs">
                  <span className="text-stone-400">Custom Mod:</span>
                  <button
                    onClick={() => setCustomMod((m) => m - 1)}
                    className="p-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span
                    className={`font-mono font-bold min-w-[24px] text-center ${
                      customMod > 0
                        ? 'text-emerald-400'
                        : customMod < 0
                        ? 'text-red-400'
                        : 'text-stone-300'
                    }`}
                  >
                    {customMod === 0 ? '+0' : formatSigned(customMod)}
                  </span>
                  <button
                    onClick={() => setCustomMod((m) => m + 1)}
                    className="p-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleRollStat(false)}
                  disabled={currentStat.effectiveDie === '-'}
                  className="flex-1 min-w-[180px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-extrabold text-sm shadow-lg transition cursor-pointer"
                >
                  <Dices className="w-4 h-4" />
                  Roll {currentStat.effectiveDie}
                  {totalRollModifier !== 0
                    ? ` (${formatSigned(totalRollModifier)})`
                    : ''}
                </button>

                {activeTab === 'strike' && allSkillIds.includes('sk-feint') && (
                  <button
                    onClick={() => handleRollStat(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs cursor-pointer"
                    title="Feint Skill: Roll two Strike dice and pick highest when fighting 1-on-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Roll Feint (2 Dice)
                  </button>
                )}
              </div>

              {/* Roll Result Display */}
              {rollState && (() => {
                const isNaturalOne = rollState.rawDie === 1;
                const isMaxFace =
                  rollState.dieSides > 0 && rollState.rawDie === rollState.dieSides;

                // Rulebook Page 18:
                // - Perfect Roll (highest number on the die): Adds +7 to the Roll-off Total.
                // - Disastrous Roll (natural 1 on the die): No numeric penalty (-0), model receives +1 Fate point.
                const perfectBonus =
                  appliesPerfectDisastrousRules && isMaxFace ? 7 : 0;

                const rawFinalTotal =
                  rollState.rawDie + totalRollModifier + perfectBonus;
                // Rulebook Page 12: "Note that no dice roll can be taken below 0 by modifiers."
                const finalTotal = Math.max(0, rawFinalTotal);

                return (
                  <div
                    className={`rounded-xl p-3.5 border transition ${
                      isNaturalOne && appliesPerfectDisastrousRules
                        ? 'bg-red-950/40 border-red-600/70'
                        : isMaxFace && appliesPerfectDisastrousRules
                        ? 'bg-emerald-950/40 border-emerald-500/70'
                        : 'bg-stone-950 border-stone-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-stone-400">Natural Roll:</span>
                          <span
                            className={`text-base font-mono font-extrabold px-2 py-0.5 rounded ${
                              isNaturalOne && appliesPerfectDisastrousRules
                                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                : isMaxFace && appliesPerfectDisastrousRules
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-stone-800 text-stone-100'
                            }`}
                          >
                            {rollState.rawDie} / {rollState.dieSides}
                          </span>
                          {rollState.secondRawDie !== undefined && (
                            <span className="text-xs text-stone-400">
                              (Feint discarded: {rollState.secondRawDie})
                            </span>
                          )}
                          {isMaxFace && appliesPerfectDisastrousRules && (
                            <span className="text-xs font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700">
                              ★ Perfect Roll! (+7 Bonus to Total)
                            </span>
                          )}
                          {isNaturalOne && appliesPerfectDisastrousRules && (
                            <span className="text-xs font-bold text-red-300 bg-red-950/80 px-2 py-0.5 rounded border border-red-700">
                              ⚠ Disastrous Roll! (Natural 1: +1 Fate Point)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400 font-mono">
                          Calculation: {rollState.rawDie} (die){' '}
                          {totalRollModifier !== 0
                            ? `${
                                totalRollModifier > 0
                                  ? `+ ${totalRollModifier}`
                                  : `- ${Math.abs(totalRollModifier)}`
                              } (mods) `
                            : ''}
                          {perfectBonus > 0 ? `+ 7 (Perfect Roll) ` : ''}
                          = <strong className="text-stone-200">{finalTotal}</strong>
                          {rawFinalTotal < 0 ? ' (min 0)' : ''}
                        </div>

                        {/* Per-Model Fate Point Actions (Page 18 & Page 36) */}
                        {activeWarband && (
                          <div className="pt-1 flex flex-wrap items-center gap-2">
                            {isNaturalOne && appliesPerfectDisastrousRules && (
                              <button
                                onClick={handleAwardDisastrousFate}
                                disabled={
                                  Boolean(rollState.fateAwarded) ||
                                  fighterFate >= MAX_FIGHTER_FATE_POINTS
                                }
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                  rollState.fateAwarded ||
                                  fighterFate >= MAX_FIGHTER_FATE_POINTS
                                    ? 'bg-purple-950/40 border-purple-700/50 text-purple-300 opacity-80 cursor-default'
                                    : 'bg-purple-600 hover:bg-purple-500 border-purple-400 text-white shadow'
                                }`}
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                {rollState.fateAwarded
                                  ? `Awarded +1 Fate to ${fighter.name} (${fighterFate}/${MAX_FIGHTER_FATE_POINTS})`
                                  : fighterFate >= MAX_FIGHTER_FATE_POINTS
                                  ? `${fighter.name} is at Max Fate (${MAX_FIGHTER_FATE_POINTS}/${MAX_FIGHTER_FATE_POINTS})`
                                  : `Award +1 Fate to ${fighter.name} (${fighterFate}/${MAX_FIGHTER_FATE_POINTS})`}
                              </button>
                            )}

                            {fighterFate > 0 && !rollState.fateAwarded && (
                              <button
                                onClick={handleSpendFateToReroll}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-800 hover:bg-purple-900/60 border border-purple-500/40 text-purple-200 transition cursor-pointer"
                                title="Rulebook Page 36: Spend 1 of this model's Fate points to immediately re-roll the die (if a natural 1 is re-rolled, it does not grant +1 Fate)"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-purple-300" />
                                Spend 1 Fate to Re-roll ({fighterFate} left)
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-left sm:text-right bg-stone-900/90 border border-stone-700 px-4 py-2 rounded-xl shrink-0">
                        <div className="text-[10px] uppercase tracking-wider text-stone-400">
                          Roll-off Total
                        </div>
                        <div className="text-2xl font-mono font-extrabold text-amber-300">
                          {finalTotal}
                        </div>
                      </div>
                    </div>

                    {/* Helpful Combat Context Footer on Strike / Ranged Rolls */}
                    {activeTab === 'strike' && (
                      <div className="mt-2 pt-2 border-t border-stone-800/80 text-[11px] text-stone-300 flex flex-wrap items-center gap-3">
                        <span>
                          <strong className="text-amber-300">Melee Damage Mod:</strong>{' '}
                          {breakdown.strong.primaryMeleeLabel} (
                          {breakdown.strong.primaryMeleeWeaponName})
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-sky-300">Defender Tough:</strong>{' '}
                          Subtract target&apos;s Tough from Wounds caused
                        </span>
                      </div>
                    )}
                    {activeTab === 'ranged' && (
                      <div className="mt-2 pt-2 border-t border-stone-800/80 text-[11px] text-stone-300 flex flex-wrap items-center gap-3">
                        {breakdown.strong.weapons
                          .filter((w) => w.weaponType === 'Ranged')
                          .map((rw, idx) => (
                            <span key={idx}>
                              <strong className="text-amber-300">{rw.weaponName}:</strong>{' '}
                              {rw.label}
                              {rw.note ? ` (${rw.note})` : ''}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Equipped Ammunition & Consumables Quick-Spend Bar */}
              {activeWarband &&
                (() => {
                  const fighterConsumables = warbandInventory.filter((i) => {
                    if (i.assignedFighterId !== fighter.id || i.isConsumed) return false;
                    const eq = rules.equipment.find((e) => e.id === i.equipmentId);
                    return isEquipmentConsumable(eq);
                  });
                  if (fighterConsumables.length === 0) return null;

                  return (
                    <div className="pt-2 border-t border-stone-800/80 space-y-1.5">
                      <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-amber-400" />
                        Equipped Ammunition &amp; Consumables (Tap to Spend 1):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {fighterConsumables.map((cItem) => {
                          const eq = rules.equipment.find(
                            (e) => e.id === cItem.equipmentId
                          );
                          const qty = getItemQuantity(cItem);
                          return (
                            <button
                              key={cItem.instanceId}
                              type="button"
                              onClick={() => handleConsumeEquippedItem(cItem)}
                              title={
                                qty > 1
                                  ? `Spend 1 (${qty - 1} will remain in stack) — ${eq?.description || ''}`
                                  : `Use & expend this consumable — ${eq?.description || ''}`
                              }
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-950 hover:bg-amber-950/60 border border-amber-600/40 text-[11px] text-amber-200 font-semibold cursor-pointer transition"
                            >
                              <span>Spend 1: {formatItemDisplayName(cItem, eq)}</span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px]">
                                -1
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
            </div>

            {/* Active Modifiers Breakdown (Equipment, Skills, Wounds, Conditions) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Active Modifiers (Equipment, Skills, Wounds & Conditions)
                </h4>
                <span className="text-xs font-mono font-bold text-stone-300">
                  Net Active:{' '}
                  <span
                    className={
                      currentStat.activeMatchRollMod > 0
                        ? 'text-emerald-400'
                        : currentStat.activeMatchRollMod < 0
                        ? 'text-red-400'
                        : 'text-stone-400'
                    }
                  >
                    {currentStat.activeMatchRollMod === 0
                      ? '+0'
                      : formatSigned(currentStat.activeMatchRollMod)}
                  </span>
                </span>
              </div>

              {currentStat.activeEntries.length === 0 ? (
                <div className="bg-stone-950/70 border border-stone-800/80 rounded-xl p-3 text-xs text-stone-500 italic">
                  No active equipment, skill, wound, or status condition modifiers on{' '}
                  {currentStat.label}.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {currentStat.activeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 bg-stone-950 border border-stone-800/90 rounded-xl px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getCategoryBadgeClass(
                            entry.category
                          )}`}
                        >
                          {entry.category}
                        </span>
                        <span className="text-stone-200 font-medium">
                          {entry.source}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold text-sm ${
                          entry.value > 0
                            ? 'text-emerald-400'
                            : entry.value < 0
                            ? 'text-red-400'
                            : 'text-stone-400'
                        }`}
                      >
                        {formatSigned(entry.value)}
                        {entry.unit === 'inches' ? '"' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Situational Modifiers (Tap to Toggle or Step Count) */}
            {currentStat.situationalEntries.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Situational Modifiers (Tap to Apply to Roll)
                </h4>
                <div className="space-y-1.5">
                  {currentStat.situationalEntries.map((sit) => {
                    const count = situationalCounts[sit.id] ?? 0;
                    const checked = count > 0;
                    const totalSitVal = sit.value * count;

                    if (sit.isStackable) {
                      return (
                        <div
                          key={sit.id}
                          className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs border transition ${
                            checked
                              ? 'bg-sky-950/40 border-sky-500/60 text-stone-100'
                              : 'bg-stone-950/60 border-stone-800/80 text-stone-400'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => adjustSituationalCount(sit.id, 1)}
                            className="flex items-center gap-2 text-left flex-1 cursor-pointer"
                          >
                            {checked ? (
                              <CheckSquare className="w-4 h-4 text-sky-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-stone-600 shrink-0" />
                            )}
                            <span>{sit.source}</span>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => adjustSituationalCount(sit.id, -1)}
                              disabled={count === 0}
                              className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 cursor-pointer"
                              aria-label="Decrease count"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span
                              className={`font-mono font-bold min-w-[44px] text-center ${
                                totalSitVal > 0
                                  ? 'text-emerald-400'
                                  : totalSitVal < 0
                                  ? 'text-red-400'
                                  : 'text-stone-400'
                              }`}
                            >
                              {count > 0
                                ? `${formatSigned(totalSitVal)}${
                                    sit.unit === 'inches' ? '"' : ''
                                  } (${count}x)`
                                : '+0'}
                            </span>
                            <button
                              type="button"
                              onClick={() => adjustSituationalCount(sit.id, 1)}
                              className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer"
                              aria-label="Increase count"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={sit.id}
                        type="button"
                        onClick={() => toggleSituational(sit.id)}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs border text-left transition cursor-pointer ${
                          checked
                            ? 'bg-sky-950/40 border-sky-500/60 text-stone-100'
                            : 'bg-stone-950/60 border-stone-800/80 text-stone-400 hover:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-sky-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-stone-600 shrink-0" />
                          )}
                          <span>{sit.source}</span>
                        </div>
                        <span
                          className={`font-mono font-bold ${
                            sit.value > 0
                              ? 'text-emerald-400'
                              : sit.value < 0
                              ? 'text-red-400'
                              : 'text-stone-400'
                          }`}
                        >
                          {formatSigned(sit.value)}
                          {sit.unit === 'inches' ? '"' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special Re-roll & Rule Notes */}
            {currentStat.rerollNotes.length > 0 && (
              <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Special Rules & Re-rolls
                </div>
                {currentStat.rerollNotes.map((note, idx) => (
                  <p key={idx} className="text-xs text-stone-300">
                    • {note}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* VIEW 2: STRONG & WEAK TOTALS BREAKDOWN                            */}
        {/* ================================================================= */}
        {activeTab === 'strong' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Base Model Strong / Weak
                </div>
                <div
                  className={`text-xl font-extrabold mt-0.5 ${
                    breakdown.strong.netBaseStrong > 0
                      ? 'text-emerald-400'
                      : breakdown.strong.netBaseStrong < 0
                      ? 'text-orange-400'
                      : 'text-stone-200'
                  }`}
                >
                  {breakdown.strong.baseLabel}{' '}
                  <span className="text-xs font-mono text-stone-400">
                    ({formatSigned(breakdown.strong.netBaseStrong) || '+0'} Wounds)
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  Applies to Unarmed, 1H Weapons, Bows, War Bows, Slings & Thrown weapons
                </p>
              </div>

              <div className="bg-stone-950 border border-amber-500/30 rounded-xl p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Primary Melee ({breakdown.strong.primaryMeleeWeaponName})
                </div>
                <div
                  className={`text-xl font-extrabold mt-0.5 ${
                    breakdown.strong.primaryMeleeNetStrong > 0
                      ? 'text-emerald-400'
                      : breakdown.strong.primaryMeleeNetStrong < 0
                      ? 'text-orange-400'
                      : 'text-stone-200'
                  }`}
                >
                  {breakdown.strong.primaryMeleeLabel}{' '}
                  <span className="text-xs font-mono text-stone-400">
                    ({formatSigned(breakdown.strong.primaryMeleeNetStrong) || '+0'} Wounds)
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  Combines model Strong/Weak with weapon Strong bonus
                </p>
              </div>
            </div>

            {/* Weapon-by-Weapon Effective Strong */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Effective Strong / Weak by Weapon
              </h4>
              <div className="space-y-1.5">
                {breakdown.strong.weapons.map((w, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-stone-800 text-stone-300">
                          {w.weaponType}
                        </span>
                        <strong className="text-stone-100">{w.weaponName}</strong>
                      </div>
                      {w.note && (
                        <p className="text-[11px] text-stone-400 mt-0.5">{w.note}</p>
                      )}
                    </div>
                    <div
                      className={`font-mono font-extrabold text-sm shrink-0 ${
                        w.netStrong > 0
                          ? 'text-emerald-400'
                          : w.netStrong < 0
                          ? 'text-orange-400'
                          : 'text-stone-300'
                      }`}
                    >
                      {w.label}{' '}
                      <span className="text-xs text-stone-400">
                        ({formatSigned(w.netStrong) || '+0'} Wounds)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Itemized Strong & Weak Sources */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                All Strong & Weak Modifiers (Skills, Spells, Gear & Conditions)
              </h4>
              {breakdown.strong.entries.length === 0 ? (
                <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-3 text-xs text-stone-500 italic">
                  No Strong or Weak modifiers from skills, spells, or equipment (Net 0).
                </div>
              ) : (
                <div className="space-y-1.5">
                  {breakdown.strong.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getCategoryBadgeClass(
                            entry.category
                          )}`}
                        >
                          {entry.category}
                        </span>
                        <span className="text-stone-200">{entry.source}</span>
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          entry.value > 0 ? 'text-emerald-400' : 'text-orange-400'
                        }`}
                      >
                        {formatSigned(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* VIEW 3: TOUGH & DELICATE TOTALS BREAKDOWN                         */}
        {/* ================================================================= */}
        {activeTab === 'tough' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-stone-950 border border-sky-500/30 rounded-xl p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  Net Total Tough / Delicate (With Armour)
                </div>
                <div
                  className={`text-xl font-extrabold mt-0.5 ${
                    breakdown.tough.netTough > 0
                      ? 'text-sky-300'
                      : breakdown.tough.netTough < 0
                      ? 'text-orange-400'
                      : 'text-stone-200'
                  }`}
                >
                  {breakdown.tough.label}{' '}
                  <span className="text-xs font-mono text-stone-400">
                    ({breakdown.tough.netTough >= 0
                      ? `-${breakdown.tough.netTough}`
                      : `+${Math.abs(breakdown.tough.netTough)}`}{' '}
                    Wounds taken)
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  Skill Tough ({breakdown.tough.skillTough}) + Armour (
                  {breakdown.tough.armourTough}) &minus; Delicate (
                  {breakdown.tough.skillDelicate})
                </p>
              </div>

              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Unarmoured / Ignore-Armour Tough
                </div>
                <div
                  className={`text-xl font-extrabold mt-0.5 ${
                    breakdown.tough.netUnarmouredTough > 0
                      ? 'text-emerald-400'
                      : breakdown.tough.netUnarmouredTough < 0
                      ? 'text-orange-400'
                      : 'text-stone-200'
                  }`}
                >
                  {breakdown.tough.netUnarmouredTough > 0
                    ? `Tough (${breakdown.tough.netUnarmouredTough})`
                    : breakdown.tough.netUnarmouredTough < 0
                    ? `Delicate (${Math.abs(breakdown.tough.netUnarmouredTough)})`
                    : 'Tough (0)'}{' '}
                  <span className="text-xs font-mono text-stone-400">
                    ({breakdown.tough.netUnarmouredTough >= 0
                      ? `-${breakdown.tough.netUnarmouredTough}`
                      : `+${Math.abs(breakdown.tough.netUnarmouredTough)}`}{' '}
                    Wounds taken)
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  Used when hit by Armour-ignoring attacks (Focused Strike, Spot the Weak Point)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                All Tough & Delicate Modifiers (Skills, Spells & Armour)
              </h4>
              {breakdown.tough.entries.length === 0 ? (
                <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-3 text-xs text-stone-500 italic">
                  No Tough or Delicate modifiers from skills, spells, or armour (Net 0).
                </div>
              ) : (
                <div className="space-y-1.5">
                  {breakdown.tough.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getCategoryBadgeClass(
                            entry.category
                          )}`}
                        >
                          {entry.category}
                        </span>
                        <span className="text-stone-200">{entry.source}</span>
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          entry.value > 0 ? 'text-sky-300' : 'text-orange-400'
                        }`}
                      >
                        {formatSigned(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
