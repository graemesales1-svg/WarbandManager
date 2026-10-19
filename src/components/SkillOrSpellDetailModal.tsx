import React, { useState } from 'react';
import { Fighter, RulesDataset, SkillOrSpellRef } from '../types/game';
import {
  getFighterFatePoints,
  getSkillOrSpellPageReference,
  MAX_FIGHTER_FATE_POINTS,
  StatKey,
} from '../utils/gameMath';
import {
  X,
  BookOpen,
  Sparkles,
  Dices,
  CheckCircle2,
} from 'lucide-react';

interface SkillOrSpellDetailModalProps {
  fighter: Fighter;
  rules: RulesDataset;
  initialSkillOrSpellId: string;
  onClose: () => void;
  onSpendFatePoint?: (fighter: Fighter) => Promise<void> | void;
  onOpenStatRoller?: (fighter: Fighter, statKey: StatKey) => void;
}

export const SkillOrSpellDetailModal: React.FC<SkillOrSpellDetailModalProps> = ({
  fighter,
  rules,
  initialSkillOrSpellId,
  onClose,
  onSpendFatePoint,
  onOpenStatRoller,
}) => {
  const [selectedId, setSelectedId] = useState<string>(initialSkillOrSpellId);
  const [spentFateForId, setSpentFateForId] = useState<string | null>(null);

  const species = rules.species.find((s) => s.id === fighter.speciesId);
  const innateIds = species?.innateSkillIds ?? [];
  const allFighterSkillIds = [...innateIds, ...fighter.learnedSkillIds];
  const allFighterSpellIds = [...fighter.learnedSpellIds];

  const entry: SkillOrSpellRef | undefined = rules.skillsAndSpells.find(
    (s) => s.id === selectedId
  );

  if (!entry) return null;

  const isSpell = entry.category === 'Magic Spell';
  const isInnate =
    !isSpell &&
    (innateIds.includes(entry.id) || entry.category === 'Innate Skill');
  const isNegativeSkill =
    entry.id.startsWith('sk-weak-') ||
    entry.id.startsWith('sk-delicate-') ||
    entry.id === 'sk-slow' ||
    entry.id === 'sk-short-sighted' ||
    entry.id === 'sk-unreliable' ||
    entry.id === 'sk-armless' ||
    entry.id === 'sk-otherworldly';

  const pageRef = getSkillOrSpellPageReference(entry);
  const fighterFate = getFighterFatePoints(fighter);
  const costsFateToUse = Boolean(
    entry.requirementsText?.toLowerCase().includes('fate') ||
      entry.description.toLowerCase().includes('fate point')
  );

  const castingStatKey: StatKey | null = isSpell
    ? entry.castingStat === 'Presence'
      ? 'presence'
      : 'fortitude'
    : null;

  const handleUseFatePoint = async () => {
    if (!onSpendFatePoint || fighterFate <= 0) return;
    await onSpendFatePoint(fighter);
    setSpentFateForId(entry.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-stone-900 border border-stone-700 rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                  isSpell
                    ? 'bg-indigo-950/90 text-indigo-300 border-indigo-700/60'
                    : isNegativeSkill
                    ? 'bg-orange-950/80 text-orange-300 border-orange-700/60'
                    : isInnate
                    ? 'bg-stone-800 text-stone-200 border-stone-700'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                }`}
              >
                {isSpell
                  ? `✦ Magic Spell (${entry.magicalArchetype || 'Arcane'})`
                  : isInnate
                  ? `Innate Skill (${species?.name || 'Species'})`
                  : entry.category}
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <BookOpen className="w-3 h-3 text-amber-400" />
                Rulebook {pageRef}
              </span>
            </div>

            <h3 className="text-lg font-bold text-stone-100 font-serif">
              {entry.name}
            </h3>
            <p className="text-xs text-stone-400">
              Possessed by <strong className="text-stone-200">{fighter.name}</strong> (
              {fighter.role} • {species?.name || 'Beast'})
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metadata Bar (Casting Stat / Difficulty / Range for Spells, or Requirements for Skills) */}
        {isSpell ? (
          <div className="grid grid-cols-3 gap-2 text-center bg-indigo-950/25 border border-indigo-800/50 rounded-xl p-2.5 text-xs">
            <div className="bg-stone-950/80 rounded-lg p-2 border border-stone-800">
              <div className="text-[10px] uppercase tracking-wider text-stone-400">
                Casting Stat
              </div>
              <div className="font-bold text-indigo-300 mt-0.5">
                {entry.castingStat || 'Fortitude / Presence'}
              </div>
            </div>
            <div className="bg-stone-950/80 rounded-lg p-2 border border-stone-800">
              <div className="text-[10px] uppercase tracking-wider text-stone-400">
                Difficulty
              </div>
              <div className="font-mono font-bold text-amber-300 mt-0.5">
                {entry.spellDifficulty === 0
                  ? '0 (Opposed)'
                  : `Diff ${entry.spellDifficulty ?? 4}`}
              </div>
            </div>
            <div className="bg-stone-950/80 rounded-lg p-2 border border-stone-800">
              <div className="text-[10px] uppercase tracking-wider text-stone-400">
                Spell Range
              </div>
              <div className="font-bold text-emerald-300 mt-0.5">
                {entry.spellRange || 'Self'}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-stone-400 font-semibold">Requirements / Cost: </span>
              <span
                className={`font-bold ${
                  costsFateToUse ? 'text-purple-300' : 'text-stone-200'
                }`}
              >
                {entry.requirementsText || 'None (Passive / Always Active)'}
              </span>
            </div>
            {isInnate && (
              <span className="text-[11px] text-stone-400 italic">
                Innate to {species?.name}
              </span>
            )}
          </div>
        )}

        {/* Full Rulebook Effect Description */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-stone-400 uppercase tracking-wider font-bold">
            <span>Official 2nd Edition Rule Effect</span>
            <span className="text-amber-400/90 font-mono">{pageRef}</span>
          </div>
          <p className="text-sm text-stone-100 leading-relaxed whitespace-pre-line">
            {entry.description}
          </p>
        </div>

        {/* Interactive Actions (Roll Casting Check OR Spend 1 Fate Point) */}
        {(isSpell && castingStatKey && onOpenStatRoller) ||
        (costsFateToUse && onSpendFatePoint) ? (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-950/80 border border-stone-800 rounded-xl p-3">
            {isSpell && castingStatKey && onOpenStatRoller && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStatRoller(fighter, castingStatKey);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition shadow"
              >
                <Dices className="w-4 h-4" />
                Roll {entry.castingStat || 'Cast'} Check
              </button>
            )}

            {costsFateToUse && onSpendFatePoint && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleUseFatePoint}
                  disabled={fighterFate <= 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    fighterFate > 0
                      ? 'bg-purple-600 hover:bg-purple-500 border-purple-400 text-white shadow'
                      : 'bg-stone-800 border-stone-700 text-stone-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Spend 1 Fate Point ({fighterFate}/{MAX_FIGHTER_FATE_POINTS} left)
                </button>
                {spentFateForId === entry.id && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Spent 1 Fate!
                  </span>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Quick Switcher for All Skills & Spells on this Fighter */}
        {(allFighterSkillIds.length + allFighterSpellIds.length > 1) && (
          <div className="pt-2 border-t border-stone-800 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              All Skills &amp; Spells on {fighter.name} (Tap to Switch)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allFighterSkillIds.map((skId, idx) => {
                const sk = rules.skillsAndSpells.find((s) => s.id === skId);
                if (!sk) return null;
                const isThisInnate = idx < innateIds.length;
                const active = sk.id === selectedId;
                return (
                  <button
                    key={`${skId}-${idx}`}
                    type="button"
                    onClick={() => {
                      setSelectedId(sk.id);
                      setSpentFateForId(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-stone-950 border-amber-300 font-bold'
                        : isThisInnate
                        ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                        : 'bg-emerald-950/80 hover:bg-emerald-900/70 text-emerald-300 border-emerald-800/60'
                    }`}
                  >
                    {sk.name}
                  </button>
                );
              })}

              {allFighterSpellIds.map((spId) => {
                const sp = rules.skillsAndSpells.find((s) => s.id === spId);
                if (!sp) return null;
                const active = sp.id === selectedId;
                return (
                  <button
                    key={spId}
                    type="button"
                    onClick={() => {
                      setSelectedId(sp.id);
                      setSpentFateForId(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-stone-950 border-amber-300 font-bold'
                        : 'bg-indigo-950/90 hover:bg-indigo-900/70 text-indigo-300 border-indigo-700/60'
                    }`}
                  >
                    ✦ {sp.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
