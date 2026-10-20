import React, { useState } from 'react';
import {
  AllegianceRef,
  BeastSize,
  DenUpgradeRef,
  DiceValue,
  EquipmentCategory,
  EquipmentRef,
  EquipmentSlot,
  InjuryRef,
  SkillOrSpellCategory,
  SkillOrSpellRef,
  SpeciesRef,
} from '../types/game';
import { useApp } from '../context/AppContext';
import {
  BookOpen,
  Download,
  Upload,
  Plus,
  Trash2,
  RotateCcw,
  Shield,
  Sword,
  Sparkles,
  Home,
  Skull,
  PawPrint,
} from 'lucide-react';

type RulesSubTab =
  | 'species'
  | 'allegiances'
  | 'equipment'
  | 'skills'
  | 'denUpgrades'
  | 'injuries';

const DICE_OPTIONS: DiceValue[] = ['D4', 'D6', 'D8', 'D10', 'D12', 'D20', '-'];

export const RulesDataManager: React.FC = () => {
  const { rules, updateRules, resetRulesToDefault } = useApp();
  const [subTab, setSubTab] = useState<RulesSubTab>('species');
  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  // Quick Add Species State
  const [spName, setSpName] = useState('');
  const [spSize, setSpSize] = useState<BeastSize>('Medium');
  const [spCost, setSpCost] = useState(35);
  const [spMove, setSpMove] = useState<DiceValue>('D8');
  const [spStrike, setSpStrike] = useState<DiceValue>('D6');
  const [spBlock, setSpBlock] = useState<DiceValue>('D6');
  const [spRanged, setSpRanged] = useState<DiceValue>('D6');
  const [spNimble, setSpNimble] = useState<DiceValue>('D8');
  const [spConceal, setSpConceal] = useState<DiceValue>('D6');
  const [spAware, setSpAware] = useState<DiceValue>('D6');
  const [spFort, setSpFort] = useState<DiceValue>('D6');
  const [spPresence, setSpPresence] = useState<DiceValue>('D6');
  const [spWounds, setSpWounds] = useState(17);
  const [spRules, setSpRules] = useState('');

  // Quick Add Equipment State
  const [eqName, setEqName] = useState('');
  const [eqCategory, setEqCategory] = useState<EquipmentCategory>('One-Handed Weapon');
  const [eqSlot, setEqSlot] = useState<EquipmentSlot>('Weapon 1');
  const [eqCost, setEqCost] = useState(10);
  const [eqRarity, setEqRarity] = useState<EquipmentRef['rarity']>('Common');
  const [eqMods, setEqMods] = useState('');
  const [eqDesc, setEqDesc] = useState('');

  // Quick Add Skill/Spell State
  const [skName, setSkName] = useState('');
  const [skCat, setSkCat] = useState<SkillOrSpellCategory>('Fighting Skill');
  const [skLore, setSkLore] = useState('');
  const [skDesc, setSkDesc] = useState('');

  // Quick Add Den Upgrade State
  const [duName, setDuName] = useState('');
  const [duCost, setDuCost] = useState(15);
  const [duSummary, setDuSummary] = useState('');
  const [duBenefit, setDuBenefit] = useState('');

  // Quick Add Allegiance State
  const [alName, setAlName] = useState('');
  const [alDenType, setAlDenType] = useState('');
  const [alStartUpgradeId, setAlStartUpgradeId] = useState(
    rules.denUpgrades[0]?.id || 'den-pells-training-ground'
  );
  const [alRules, setAlRules] = useState('');

  // Quick Add Injury State
  const [injRoll, setInjRoll] = useState('Major D20: 18');
  const [injName, setInjName] = useState('');
  const [injEffect, setInjEffect] = useState('');
  const [injMiss, setInjMiss] = useState(false);

  const handleAddSpecies = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spName.trim()) return;
    const newSp: SpeciesRef = {
      id: `sp-${Date.now()}`,
      name: spName.trim(),
      size: spSize,
      cost: Number(spCost),
      stats: {
        move: spMove,
        strike: spStrike,
        block: spBlock,
        ranged: spRanged,
        nimbleness: spNimble,
        concealment: spConceal,
        awareness: spAware,
        fortitude: spFort,
        presence: spPresence,
        wounds: Number(spWounds),
      },
      innateSkillIds: [],
      specialRules: spRules.trim(),
    };
    updateRules({ ...rules, species: [...rules.species, newSp] });
    setSpName('');
    setSpRules('');
  };

  const handleAddEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqName.trim()) return;
    const newEq: EquipmentRef = {
      id: `eq-${Date.now()}`,
      name: eqName.trim(),
      category: eqCategory,
      defaultSlot: eqSlot,
      cost: Number(eqCost),
      rarity: eqRarity,
      weaponModifiers: eqMods.trim() || undefined,
      description: eqDesc.trim() || 'Custom equipment entry.',
    };
    updateRules({ ...rules, equipment: [...rules.equipment, newEq] });
    setEqName('');
    setEqMods('');
    setEqDesc('');
  };

  const handleAddSkillOrSpell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skName.trim()) return;
    const newSk: SkillOrSpellRef = {
      id: `sk-${Date.now()}`,
      name: skName.trim(),
      category: skCat,
      difficultyOrLore: skLore.trim() || undefined,
      description: skDesc.trim(),
    };
    updateRules({ ...rules, skillsAndSpells: [...rules.skillsAndSpells, newSk] });
    setSkName('');
    setSkLore('');
    setSkDesc('');
  };

  const handleAddDenUpgrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!duName.trim()) return;
    const newDu: DenUpgradeRef = {
      id: `den-${Date.now()}`,
      name: duName.trim(),
      cost: Number(duCost),
      effectSummary: duSummary.trim(),
      postGameBenefit: duBenefit.trim(),
    };
    updateRules({ ...rules, denUpgrades: [...rules.denUpgrades, newDu] });
    setDuName('');
    setDuSummary('');
    setDuBenefit('');
  };

  const handleAddAllegiance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alName.trim()) return;
    const newAl: AllegianceRef = {
      id: `al-${Date.now()}`,
      name: alName.trim(),
      theme: alRules.trim(),
      startingDenType: alDenType.trim() || 'Woodland Hold',
      startingDenUpgradeId: alStartUpgradeId,
      allowedSpeciesNote: 'Any allowed by campaign rules',
      specialRules: alRules.trim(),
    };
    updateRules({ ...rules, allegiances: [...rules.allegiances, newAl] });
    setAlName('');
    setAlDenType('');
    setAlRules('');
  };

  const handleAddInjury = (e: React.FormEvent) => {
    e.preventDefault();
    if (!injName.trim()) return;
    const newInj: InjuryRef = {
      id: `inj-${Date.now()}`,
      rollRange: injRoll.trim(),
      name: injName.trim(),
      effect: injEffect.trim(),
      causesMissNextGame: injMiss,
    };
    updateRules({ ...rules, injuries: [...rules.injuries, newInj] });
    setInjName('');
    setInjEffect('');
    setInjMiss(false);
  };

  const handleExportRules = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `burrows-and-badgers-2e-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportRules = () => {
    try {
      const parsed = JSON.parse(importText);
      if (parsed.species && parsed.equipment && parsed.allegiances) {
        updateRules(parsed);
        setShowImportModal(false);
        setImportText('');
      } else {
        alert('Invalid rules JSON format. Must contain species, allegiances, and equipment arrays.');
      }
    } catch {
      alert('Failed to parse JSON.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900/90 border border-stone-800 rounded-xl p-5">
        <div>
          <h2 className="text-xl font-bold text-amber-400 font-serif flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Burrows & Badgers 2.0 Rules & Reference Compendium
          </h2>
          <p className="text-sm text-stone-400 mt-1">
            Add, customize, or import your exact 2nd Edition rulebook tables (Species, Allegiances, Trading Post Gear, Skills, Spells, Den Upgrades & Injuries).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportRules}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium border border-stone-700 cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            Export Rules JSON
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium border border-stone-700 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            Import Rules JSON
          </button>
          <button
            onClick={() => {
              if (confirm('Reset all rules tables back to the built-in 2.0 starter dataset?')) {
                resetRulesToDefault();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-900 hover:bg-red-950/50 text-stone-400 hover:text-red-300 text-xs font-medium border border-stone-800 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Category Switcher */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'species', label: `Species (${rules.species.length})`, icon: PawPrint },
          { id: 'allegiances', label: `Allegiances (${rules.allegiances.length})`, icon: Shield },
          { id: 'equipment', label: `Equipment (${rules.equipment.length})`, icon: Sword },
          { id: 'skills', label: `Skills & Spells (${rules.skillsAndSpells.length})`, icon: Sparkles },
          { id: 'denUpgrades', label: `Den Upgrades (${rules.denUpgrades.length})`, icon: Home },
          { id: 'injuries', label: `Injuries (${rules.injuries.length})`, icon: Skull },
        ].map((item) => {
          const Icon = item.icon;
          const active = subTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSubTab(item.id as RulesSubTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                active
                  ? 'bg-amber-600 text-stone-950 shadow-sm'
                  : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* SPECIES TAB */}
      {subTab === 'species' && (
        <div className="space-y-6">
          <div className="overflow-x-auto bg-stone-900 border border-stone-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-800 text-stone-400 bg-stone-950/60">
                  <th className="p-3">Species</th>
                  <th className="p-3">Size / Base</th>
                  <th className="p-3">Fee</th>
                  <th className="p-3">M</th>
                  <th className="p-3">S</th>
                  <th className="p-3">B</th>
                  <th className="p-3">R</th>
                  <th className="p-3">N</th>
                  <th className="p-3">C</th>
                  <th className="p-3">A</th>
                  <th className="p-3">F</th>
                  <th className="p-3">P</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/70">
                {[...rules.species]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => (
                  <tr key={s.id} className="hover:bg-stone-800/40">
                    <td className="p-3 font-semibold text-stone-100">
                      {s.name}
                      {s.specialRules && (
                        <div className="text-[11px] text-stone-400 font-normal">{s.specialRules}</div>
                      )}
                    </td>
                    <td className="p-3 text-stone-300">
                      {s.size} ({s.baseSizeMm || '30mm'})
                    </td>
                    <td className="p-3 font-semibold text-amber-400">{s.cost}p</td>
                    <td className="p-3 font-mono">{s.stats.move}</td>
                    <td className="p-3 font-mono">{s.stats.strike}</td>
                    <td className="p-3 font-mono">{s.stats.block}</td>
                    <td className="p-3 font-mono">{s.stats.ranged}</td>
                    <td className="p-3 font-mono">{s.stats.nimbleness}</td>
                    <td className="p-3 font-mono">{s.stats.concealment}</td>
                    <td className="p-3 font-mono">{s.stats.awareness}</td>
                    <td className="p-3 font-mono">{s.stats.fortitude}</td>
                    <td className="p-3 font-mono">{s.stats.presence}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() =>
                          updateRules({
                            ...rules,
                            species: rules.species.filter((item) => item.id !== s.id),
                          })
                        }
                        className="text-stone-500 hover:text-red-400 p-1 cursor-pointer"
                        title="Delete species"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form
            onSubmit={handleAddSpecies}
            className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-4"
          >
            <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Custom Beast Species (Local to Your Device)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-stone-400 mb-1">Species Name</label>
                <input
                  value={spName}
                  onChange={(e) => setSpName(e.target.value)}
                  placeholder="e.g. Pine Marten, Stoat, Mole"
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-100"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Size</label>
                <select
                  value={spSize}
                  onChange={(e) => setSpSize(e.target.value as BeastSize)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2 py-1.5 text-sm text-stone-100"
                >
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                  <option value="Massive">Massive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Signing-on Fee (p)</label>
                <input
                  type="number"
                  value={spCost}
                  onChange={(e) => setSpCost(Number(e.target.value))}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Wound Boxes</label>
                <input
                  type="number"
                  value={spWounds}
                  onChange={(e) => setSpWounds(Number(e.target.value))}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-100"
                />
              </div>
              {[
                { label: 'Move (M)', val: spMove, set: setSpMove },
                { label: 'Strike (S)', val: spStrike, set: setSpStrike },
                { label: 'Block (B)', val: spBlock, set: setSpBlock },
                { label: 'Ranged (R)', val: spRanged, set: setSpRanged },
                { label: 'Nimble (N)', val: spNimble, set: setSpNimble },
                { label: 'Conceal (C)', val: spConceal, set: setSpConceal },
                { label: 'Aware (A)', val: spAware, set: setSpAware },
                { label: 'Fortitude (F)', val: spFort, set: setSpFort },
                { label: 'Presence (P)', val: spPresence, set: setSpPresence },
              ].map((stat) => (
                <div key={stat.label}>
                  <label className="block text-xs text-stone-400 mb-1">{stat.label}</label>
                  <select
                    value={stat.val}
                    onChange={(e) => stat.set(e.target.value as DiceValue)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2 py-1.5 text-sm text-stone-100"
                  >
                    {DICE_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs text-stone-400 mb-1">Notes / Innate Traits</label>
                <input
                  value={spRules}
                  onChange={(e) => setSpRules(e.target.value)}
                  placeholder="Optional species notes..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-100"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs cursor-pointer shrink-0"
              >
                + Save Species
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ALLEGIANCES TAB */}
      {subTab === 'allegiances' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...rules.allegiances]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((al) => {
              const startUp = rules.denUpgrades.find((d) => d.id === al.startingDenUpgradeId);
              return (
                <div
                  key={al.id}
                  className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-amber-400 text-base">{al.name}</h4>
                      <button
                        onClick={() =>
                          updateRules({
                            ...rules,
                            allegiances: rules.allegiances.filter((x) => x.id !== al.id),
                          })
                        }
                        className="text-stone-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-stone-400 mt-1">{al.theme}</p>
                    <div className="mt-3 text-xs space-y-1 bg-stone-950/70 p-3 rounded-lg border border-stone-800">
                      <div>
                        <span className="text-stone-400">Starting Den Upgrade:</span>{' '}
                        <span className="text-emerald-400 font-medium">
                          {startUp?.name || al.startingDenUpgradeId}
                        </span>
                      </div>
                      {al.allegianceArchetype && (
                        <div>
                          <span className="text-stone-400">Allegiance Archetype:</span>{' '}
                          <span className="text-amber-300 font-medium">
                            {al.allegianceArchetype}
                          </span>
                        </div>
                      )}
                      {al.allowedMagicArchetypes && (
                        <div>
                          <span className="text-stone-400">Allowed Magic:</span>{' '}
                          <span className="text-indigo-300">
                            {al.allowedMagicArchetypes.join(', ')}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-stone-400">Rules:</span>{' '}
                        <span className="text-stone-300">{al.specialRules}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={handleAddAllegiance}
            className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Custom 2.0 Warband Allegiance (Local to Your Device)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Allegiance Name</label>
                <input
                  value={alName}
                  onChange={(e) => setAlName(e.target.value)}
                  placeholder="e.g. Wildbeast Kin"
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Starting Den Type</label>
                <input
                  value={alDenType}
                  onChange={(e) => setAlDenType(e.target.value)}
                  placeholder="e.g. Deep Briar Cairn"
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Automatic Starting Den Upgrade</label>
                <select
                  value={alStartUpgradeId}
                  onChange={(e) => setAlStartUpgradeId(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                >
                  {[...rules.denUpgrades]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((du) => (
                      <option key={du.id} value={du.id}>
                        {du.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs text-stone-400 mb-1">Special Rules & Restrictions</label>
                <input
                  value={alRules}
                  onChange={(e) => setAlRules(e.target.value)}
                  placeholder="Allegiance bonuses and species notes..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs cursor-pointer"
              >
                + Save Allegiance
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EQUIPMENT TAB */}
      {subTab === 'equipment' && (
        <div className="space-y-6">
          <div className="overflow-x-auto bg-stone-900 border border-stone-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-800 text-stone-400 bg-stone-950/60">
                  <th className="p-3">Item</th>
                  <th className="p-3">Category / Slot</th>
                  <th className="p-3">Cost</th>
                  <th className="p-3">Rarity</th>
                  <th className="p-3">Rules / Modifiers</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/70">
                {[...rules.equipment]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((eq) => (
                  <tr key={eq.id} className="hover:bg-stone-800/40">
                    <td className="p-3 font-semibold text-stone-100">
                      {eq.name}
                      <div className="text-[11px] text-stone-400 font-normal">{eq.description}</div>
                    </td>
                    <td className="p-3 text-stone-300">
                      {eq.category} <span className="text-stone-500">({eq.defaultSlot})</span>
                    </td>
                    <td className="p-3 font-semibold text-amber-400">
                      {eq.cost}p
                      {eq.postBattlePriceNote && (
                        <div className="text-[10px] text-stone-400 font-normal">
                          {eq.postBattlePriceNote}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          eq.rarity === 'Common'
                            ? 'bg-stone-800 text-stone-300'
                            : 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
                        }`}
                      >
                        {eq.rarity}
                      </span>
                    </td>
                    <td className="p-3 text-stone-300">{eq.weaponModifiers || '-'}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() =>
                          updateRules({
                            ...rules,
                            equipment: rules.equipment.filter((x) => x.id !== eq.id),
                          })
                        }
                        className="text-stone-500 hover:text-red-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form
            onSubmit={handleAddEquipment}
            className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Custom Weapon, Armour, or Rare Item (Local to Your Device)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-stone-400 mb-1">Item Name</label>
                <input
                  value={eqName}
                  onChange={(e) => setEqName(e.target.value)}
                  placeholder="e.g. Throwing Knives, Badger Greatsword"
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Category</label>
                <select
                  value={eqCategory}
                  onChange={(e) => setEqCategory(e.target.value as EquipmentCategory)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="One-Handed Weapon">One-Handed Weapon</option>
                  <option value="Double-Handed Weapon">Double-Handed Weapon</option>
                  <option value="Ranged Weapon">Ranged Weapon</option>
                  <option value="Armour">Armour</option>
                  <option value="Shield">Shield</option>
                  <option value="Accessory">Accessory</option>
                  <option value="Potion & Consumable">Potion & Consumable</option>
                  <option value="Magical Ingredient">Magical Ingredient</option>
                  <option value="Bonded Critter / Grub">Bonded Critter / Grub</option>
                  <option value="Rare & Relic">Rare & Relic</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Default Slot</label>
                <select
                  value={eqSlot}
                  onChange={(e) => setEqSlot(e.target.value as EquipmentSlot)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="Weapon 1">Weapon 1</option>
                  <option value="Weapon 2">Weapon 2</option>
                  <option value="Armour 1">Armour 1</option>
                  <option value="Armour 2">Armour 2</option>
                  <option value="Item">Item</option>
                  <option value="Special">Special</option>
                  <option value="Mage's Pouch">Mage&apos;s Pouch (Ingredient)</option>
                  <option value="Weapon Upgrade">Weapon Upgrade</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Cost (Pennies)</label>
                <input
                  type="number"
                  value={eqCost}
                  onChange={(e) => setEqCost(Number(e.target.value))}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Modifiers / Range</label>
                <input
                  value={eqMods}
                  onChange={(e) => setEqMods(e.target.value)}
                  placeholder="e.g. +1 Strike, Strong (1)"
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Rarity</label>
                <select
                  value={eqRarity}
                  onChange={(e) => setEqRarity(e.target.value as EquipmentRef['rarity'])}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="Common">Common</option>
                  <option value="Rare (6+)">Rare (6+)</option>
                  <option value="Rare (7+)">Rare (7+)</option>
                  <option value="Rare (8+)">Rare (8+)</option>
                  <option value="Rare (9+)">Rare (9+)</option>
                  <option value="Rare (10+)">Rare (10+)</option>
                  <option value="Relic">Relic</option>
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs cursor-pointer"
              >
                + Save Equipment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SKILLS & SPELLS TAB */}
      {subTab === 'skills' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...rules.skillsAndSpells]
              .sort((a, b) => {
                const order: Record<SkillOrSpellCategory, number> = {
                  'Fighting Skill': 1,
                  'Shooting Skill': 2,
                  'Cunning Skill': 3,
                  'Strength Skill': 4,
                  'Movement Skill': 5,
                  'Magic Spell': 6,
                  'Innate Skill': 7,
                };
                const catDiff = (order[a.category] ?? 99) - (order[b.category] ?? 99);
                if (catDiff !== 0) return catDiff;
                if (a.category === 'Magic Spell' && b.category === 'Magic Spell') {
                  const archCmp = (a.magicalArchetype || 'ZZZ').localeCompare(
                    b.magicalArchetype || 'ZZZ',
                    undefined,
                    { numeric: true }
                  );
                  if (archCmp !== 0) return archCmp;
                }
                return a.name.localeCompare(b.name, undefined, { numeric: true });
              })
              .map((sk) => (
              <div
                key={sk.id}
                className="bg-stone-900 border border-stone-800 rounded-xl p-3.5 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-100 text-sm">{sk.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-amber-300 font-medium">
                      {sk.category}
                    </span>
                    {sk.difficultyOrLore && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300">
                        {sk.difficultyOrLore}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-1">{sk.description}</p>
                </div>
                <button
                  onClick={() =>
                    updateRules({
                      ...rules,
                      skillsAndSpells: rules.skillsAndSpells.filter((x) => x.id !== sk.id),
                    })
                  }
                  className="text-stone-500 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddSkillOrSpell}
            className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Custom Skill or Magic Spell (Local to Your Device)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Name</label>
                <input
                  value={skName}
                  onChange={(e) => setSkName(e.target.value)}
                  placeholder="e.g. Parry, Cloud of Midges"
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Skill Category / Spell</label>
                <select
                  value={skCat}
                  onChange={(e) => setSkCat(e.target.value as SkillOrSpellCategory)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="Fighting Skill">Fighting Skill</option>
                  <option value="Shooting Skill">Shooting Skill</option>
                  <option value="Cunning Skill">Cunning Skill</option>
                  <option value="Strength Skill">Strength Skill</option>
                  <option value="Movement Skill">Movement Skill</option>
                  <option value="Innate Skill">Innate Skill</option>
                  <option value="Magic Spell">Magic Spell</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Magical Archetype & Diff (if Spell)</label>
                <input
                  value={skLore}
                  onChange={(e) => setSkLore(e.target.value)}
                  placeholder="e.g. Natural Magic • Diff 7 • Range 8&quot;"
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs text-stone-400 mb-1">Rule Effect Description</label>
                <input
                  value={skDesc}
                  onChange={(e) => setSkDesc(e.target.value)}
                  placeholder="Describe game mechanics..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs cursor-pointer"
              >
                + Save Skill / Spell
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DEN UPGRADES TAB */}
      {subTab === 'denUpgrades' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...rules.denUpgrades]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((du) => (
              <div
                key={du.id}
                className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-100 text-sm">{du.name}</span>
                    <span className="text-xs font-semibold text-amber-400">
                      {du.isStartingOnly ? 'Starting Allegiance Grant' : `${du.cost} Pennies`}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">{du.effectSummary}</p>
                  <p className="text-xs text-emerald-300/90 mt-1.5 bg-stone-950/70 px-2.5 py-1.5 rounded border border-stone-800">
                    {du.postGameBenefit}
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateRules({
                      ...rules,
                      denUpgrades: rules.denUpgrades.filter((x) => x.id !== du.id),
                    })
                  }
                  className="text-stone-500 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddDenUpgrade}
            className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Custom Den Upgrade (Local to Your Device)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Upgrade Name</label>
                <input
                  value={duName}
                  onChange={(e) => setDuName(e.target.value)}
                  placeholder="e.g. Smuggler's Tunnel, Infirmary"
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Cost (Pennies)</label>
                <input
                  type="number"
                  value={duCost}
                  onChange={(e) => setDuCost(Number(e.target.value))}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Summary</label>
                <input
                  value={duSummary}
                  onChange={(e) => setDuSummary(e.target.value)}
                  placeholder="Short description..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs text-stone-400 mb-1">
                  Post-Battle Step 9 Benefit / Rule Effect
                </label>
                <input
                  value={duBenefit}
                  onChange={(e) => setDuBenefit(e.target.value)}
                  placeholder="e.g. Generates D6 Pennies or re-rolls 1 injury roll..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs cursor-pointer"
              >
                + Save Den Upgrade
              </button>
            </div>
          </form>
        </div>
      )}

      {/* INJURIES TAB */}
      {subTab === 'injuries' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rules.injuries.map((inj) => (
              <div
                key={inj.id}
                className="bg-stone-900 border border-stone-800 rounded-xl p-3.5 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-stone-800 text-amber-400 font-bold">
                      {inj.rollRange}
                    </span>
                    <span className="font-bold text-stone-100 text-sm">{inj.name}</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">{inj.effect}</p>
                </div>
                <button
                  onClick={() =>
                    updateRules({
                      ...rules,
                      injuries: rules.injuries.filter((x) => x.id !== inj.id),
                    })
                  }
                  className="text-stone-500 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddInjury}
            className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Custom Post-Battle Injury Table Entry (Local to Your Device)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs text-stone-400 mb-1">D100 Roll Range</label>
                <input
                  value={injRoll}
                  onChange={(e) => setInjRoll(e.target.value)}
                  placeholder="e.g. 41-50"
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Injury Name</label>
                <input
                  value={injName}
                  onChange={(e) => setInjName(e.target.value)}
                  placeholder="e.g. Torn Ear"
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-stone-400 mb-1">Effect Description</label>
                <input
                  value={injEffect}
                  onChange={(e) => setInjEffect(e.target.value)}
                  placeholder="Describe stat penalty or recovery rule..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={injMiss}
                  onChange={(e) => setInjMiss(e.target.checked)}
                  className="rounded border-stone-700"
                />
                Causes Fighter to Miss Next Game
              </label>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs cursor-pointer"
              >
                + Save Injury
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-lg w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-amber-400">Import 2.0 Rules JSON</h3>
            <p className="text-xs text-stone-400">
              Paste a previously exported Burrows & Badgers 2.0 Rules Dataset JSON below to update all tables.
            </p>
            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"version": "2.0", "species": [...], ...}'
              className="w-full bg-stone-950 border border-stone-700 rounded-lg p-3 text-xs font-mono text-stone-200"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-lg bg-stone-800 text-stone-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImportRules}
                className="px-4 py-2 rounded-lg bg-amber-600 text-stone-950 text-xs font-semibold cursor-pointer"
              >
                Import Dataset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
