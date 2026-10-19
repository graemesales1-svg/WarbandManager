import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  calculateWarbandRating,
  computeFighterStats,
  computeFighterCombatBreakdown,
  formatItemDisplayName,
  formatSigned,
  getFighterFatePoints,
  getStartingFatePointsForRole,
  MAX_FIGHTER_FATE_POINTS,
  StatKey,
} from '../utils/gameMath';
import { Printer, FileText, CreditCard } from 'lucide-react';

export const PrintableRosterView: React.FC = () => {
  const { activeWarband, rules } = useApp();
  const [printMode, setPrintMode] = useState<'roster' | 'cards'>('roster');

  if (!activeWarband) return null;

  const allegiance = rules.allegiances.find((a) => a.id === activeWarband.allegianceId);
  const warbandRating = calculateWarbandRating(activeWarband, rules);
  const stashedItems = activeWarband.inventory.filter((i) => i.assignedFighterId === null);

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
    <div className="space-y-6">
      {/* Screen-Only Controls */}
      <div className="print:hidden bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrintMode('roster')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              printMode === 'roster'
                ? 'bg-amber-600 text-stone-950'
                : 'bg-stone-800 text-stone-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Full Warband Roster Sheet
          </button>
          <button
            onClick={() => setPrintMode('cards')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              printMode === 'cards'
                ? 'bg-amber-600 text-stone-950'
                : 'bg-stone-800 text-stone-300'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Tabletop Fighter Reference Cards
          </button>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print / Save as PDF
        </button>
      </div>

      {/* Printable Surface */}
      <div className="bg-stone-100 text-stone-950 rounded-2xl p-6 sm:p-8 shadow-xl print:shadow-none print:p-0 print:rounded-none">
        {/* Header */}
        <div className="border-b-2 border-stone-900 pb-4 mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-stone-600">
              Burrows & Badgers — 2nd Edition Official Warband Record
            </div>
            <h1 className="text-3xl font-extrabold font-serif text-stone-950 mt-0.5">
              {activeWarband.name}
            </h1>
            {activeWarband.motto && (
              <div className="text-xs italic text-stone-700">&ldquo;{activeWarband.motto}&rdquo;</div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs border border-stone-900 p-2.5 rounded">
            <div>
              <span className="text-stone-600 block text-[10px] uppercase">Allegiance</span>
              <strong>{allegiance?.name}</strong>
            </div>
            <div>
              <span className="text-stone-600 block text-[10px] uppercase">Den</span>
              <strong>
                {activeWarband.denName} ({activeWarband.denType})
              </strong>
            </div>
            <div>
              <span className="text-stone-600 block text-[10px] uppercase">Treasury / Pensions</span>
              <strong>
                {activeWarband.treasuryPennies}p / {activeWarband.pensions ?? 0}p Pension
              </strong>
            </div>
            <div>
              <span className="text-stone-600 block text-[10px] uppercase">Labour / Materials</span>
              <strong>
                {activeWarband.labour ?? 0} Lab / {activeWarband.materials ?? 0} Mat
              </strong>
            </div>
            <div>
              <span className="text-stone-600 block text-[10px] uppercase">Band Rating (Lvl)</span>
              <strong>{warbandRating}</strong>
            </div>
          </div>
        </div>

        {printMode === 'roster' ? (
          <div className="space-y-6">
            {/* Fighters Table */}
            <table className="w-full border-collapse border border-stone-900 text-xs">
              <thead>
                <tr className="bg-stone-200 border-b border-stone-900 text-left">
                  <th className="p-2 border-r border-stone-900">Beast & Role</th>
                  <th className="p-1.5 border-r border-stone-900 text-center">LVL</th>
                  <th className="p-1.5 border-r border-stone-900 text-center">M</th>
                  <th className="p-1.5 border-r border-stone-900 text-center">S</th>
                  <th className="p-1.5 border-r border-stone-900 text-center">B</th>
                  <th className="p-1.5 border-r border-stone-900 text-center">R</th>
                  <th className="p-1.5 border-r border-stone-900 text-center">N</th>
                  <th className="p-1.5 border-r border-stone-900 text-center">C</th>
                  <th className="p-1.5 border-r border-stone-900 text-center">A</th>
                  <th className="p-1.5 border-r border-stone-900 text-center">F</th>
                  <th className="p-1.5 border-r border-stone-900 text-center">P</th>
                  <th className="p-1.5 border-r border-stone-900 text-center">XP</th>
                  <th className="p-2">Strong / Tough, Gear, Skills & Injuries</th>
                </tr>
              </thead>
              <tbody>
                {activeWarband.fighters.map((fighter) => {
                  const species = rules.species.find((s) => s.id === fighter.speciesId);
                  const { level } = computeFighterStats(
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
                  const equipped = activeWarband.inventory.filter(
                    (i) => i.assignedFighterId === fighter.id
                  );
                  const skills = [
                    ...(species?.innateSkillIds ?? []),
                    ...fighter.learnedSkillIds,
                    ...fighter.learnedSpellIds,
                  ]
                    .map((id) => rules.skillsAndSpells.find((s) => s.id === id)?.name)
                    .filter(Boolean);
                  const injuries = fighter.injuryIds
                    .map((id) => rules.injuries.find((i) => i.id === id)?.name)
                    .filter(Boolean);

                  return (
                    <tr key={fighter.id} className="border-b border-stone-400 align-top">
                      <td className="p-2 border-r border-stone-900">
                        <div className="font-bold text-sm">{fighter.name}</div>
                        <div className="text-[11px] text-stone-700">
                          {fighter.role} • {species?.name} ({species?.size})
                        </div>
                        {fighter.status !== 'Active' && (
                          <div className="text-[10px] font-bold uppercase text-red-800">
                            [{fighter.status}]
                          </div>
                        )}
                      </td>
                      <td className="p-1.5 border-r border-stone-900 text-center font-mono font-bold">
                        {level}
                      </td>
                      {STAT_KEYS.map((sKey) => {
                        const st = combat.stats[sKey];
                        const mod = st.permanentRollMod;
                        return (
                          <td
                            key={sKey}
                            className="p-1.5 border-r border-stone-900 text-center font-mono font-bold"
                          >
                            <div>{st.effectiveDie}</div>
                            {mod !== 0 && (
                              <div className="text-[9px] text-stone-700">
                                ({formatSigned(mod)})
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-1.5 border-r border-stone-900 text-center font-mono">
                        {fighter.xp}
                      </td>
                      <td className="p-2 space-y-0.5 text-[11px]">
                        <div>
                          <strong>Combat Totals:</strong> Melee {combat.strong.primaryMeleeLabel}{' '}
                          (Base {combat.strong.baseLabel}) • {combat.tough.label}
                        </div>
                        <div>
                          <strong>Gear:</strong>{' '}
                          {equipped
                            .map((i) => {
                              const eq = rules.equipment.find(
                                (e) => e.id === i.equipmentId
                              );
                              return `${formatItemDisplayName(i, eq)} (${i.slot})`;
                            })
                            .join(', ') || 'None'}
                        </div>
                        <div>
                          <strong>Skills/Spells:</strong> {skills.join(', ') || 'None'}
                        </div>
                        {injuries.length > 0 && (
                          <div className="text-red-900">
                            <strong>Injuries:</strong> {injuries.join(', ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Den Upgrades & Stash Footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="border border-stone-900 p-3 rounded">
                <h3 className="font-bold uppercase tracking-wider border-b border-stone-400 pb-1 mb-2">
                  Den Upgrades ({activeWarband.denUpgrades.length} / 12)
                </h3>
                <ul className="space-y-1">
                  {activeWarband.denUpgrades.map((du, i) => {
                    const ref = rules.denUpgrades.find((r) => r.id === du.upgradeId);
                    return (
                      <li key={du.id}>
                        <strong>
                          {i + 1}. {ref?.name}:
                        </strong>{' '}
                        {ref?.postGameBenefit}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="border border-stone-900 p-3 rounded">
                <h3 className="font-bold uppercase tracking-wider border-b border-stone-400 pb-1 mb-2">
                  Den Stash (Unequipped Gear)
                </h3>
                <p>
                  {stashedItems
                    .map((i) => {
                      const eq = rules.equipment.find((e) => e.id === i.equipmentId);
                      return `${formatItemDisplayName(i, eq)} (${i.purchaseCost}p)`;
                    })
                    .join(', ') || 'Empty'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Fighter Tabletop Reference Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeWarband.fighters.map((fighter) => {
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
                false
              );
              const equipped = activeWarband.inventory.filter(
                (i) => i.assignedFighterId === fighter.id
              );

              return (
                <div
                  key={fighter.id}
                  className="border-2 border-stone-900 rounded-xl p-4 space-y-2.5 break-inside-avoid"
                >
                  <div className="flex justify-between items-start border-b border-stone-400 pb-1.5">
                    <div>
                      <div className="font-bold text-base font-serif">{fighter.name}</div>
                      <div className="text-xs text-stone-700">
                        {fighter.role} • {species?.name} ({species?.size} •{' '}
                        {species?.baseSizeMm || '30mm'})
                      </div>
                    </div>
                    <div className="text-right text-xs font-bold">
                      <div>
                        Level {level} • XP: {fighter.xp}
                      </div>
                      <div className="text-[11px] text-stone-800">
                        Melee: {combat.strong.primaryMeleeLabel} • {combat.tough.label}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-9 text-center border border-stone-900 rounded overflow-hidden text-xs">
                    {STAT_KEYS.map((sKey) => {
                      const st = combat.stats[sKey];
                      const mod = st.permanentRollMod;
                      return (
                        <div
                          key={sKey}
                          className="border-r last:border-r-0 border-stone-900 p-1"
                        >
                          <div className="text-[9px] font-bold bg-stone-200">
                            {st.shortLabel}
                          </div>
                          <div className="font-mono font-bold pt-0.5">
                            {st.effectiveDie}
                            {mod !== 0 ? ` (${formatSigned(mod)})` : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-xs space-y-1">
                    <div>
                      <strong>Weapons & Armour:</strong>{' '}
                      {equipped
                        .map((i) => {
                          const eq = rules.equipment.find(
                            (e) => e.id === i.equipmentId
                          );
                          return `${formatItemDisplayName(i, eq)}${
                            eq?.weaponModifiers ? ` [${eq.weaponModifiers}]` : ''
                          }`;
                        })
                        .join(' • ') || 'Unarmed'}
                    </div>
                    <div>
                      <strong>Skills & Spells:</strong>{' '}
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

                  {/* Official 17-Box Wound Track & 5-Box Fate Track (Page 36 & Page 38) */}
                  <div className="pt-1 text-xs space-y-2">
                    <div>
                      <div className="font-bold mb-1">
                        Wounds (Shaded boxes 4, 7, 10, 13 = -1 Roll-off each; 17 = OoA):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: effective.wounds }).map((_, idx) => {
                          const boxNum = idx + 1;
                          const isShaded = [4, 7, 10, 13].includes(boxNum);
                          const isOoaBox = boxNum === effective.wounds;
                          return (
                            <span
                              key={idx}
                              className={`w-5 h-5 inline-flex items-center justify-center border border-stone-900 rounded-xs text-[9px] font-mono ${
                                isShaded ? 'bg-stone-300 font-bold' : 'bg-white'
                              }`}
                            >
                              {isOoaBox ? 'OoA' : boxNum}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-300">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">
                          Fate Points (Start {getStartingFatePointsForRole(fighter.role)} / Max{' '}
                          {MAX_FIGHTER_FATE_POINTS}):
                        </span>
                        <div className="inline-flex gap-1">
                          {Array.from({ length: MAX_FIGHTER_FATE_POINTS }).map((_, idx) => {
                            const boxNum = idx + 1;
                            const isStartBox =
                              boxNum <= getFighterFatePoints(fighter);
                            return (
                              <span
                                key={idx}
                                className={`w-5 h-5 inline-flex items-center justify-center border border-stone-900 rounded-xs text-[9px] font-mono ${
                                  isStartBox ? 'bg-stone-200 font-bold' : 'bg-white'
                                }`}
                              >
                                {boxNum}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
