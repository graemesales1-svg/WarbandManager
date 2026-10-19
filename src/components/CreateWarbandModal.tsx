import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Warband } from '../types/game';
import { Shield, Home, Coins, CheckCircle2, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const CreateWarbandModal: React.FC<Props> = ({ onClose }) => {
  const { rules, user, createWarband } = useApp();

  const sortedAllegiances = [...rules.allegiances].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const [name, setName] = useState('');
  const [motto, setMotto] = useState('');
  const [allegianceId, setAllegianceId] = useState(
    sortedAllegiances[0]?.id || 'al-freebeasts'
  );
  const [denName, setDenName] = useState('');
  const [startingPennies, setStartingPennies] = useState(350);
  const [backstory, setBackstory] = useState('');

  const selectedAllegiance = rules.allegiances.find((a) => a.id === allegianceId);
  const startingUpgrade = rules.denUpgrades.find(
    (d) => d.id === selectedAllegiance?.startingDenUpgradeId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedAllegiance) return;

    const now = new Date().toISOString();
    const newWarband: Warband = {
      id: crypto.randomUUID(),
      userId: user.id,
      ownerName: user.name,
      campaignId: null,
      name: name.trim(),
      motto: motto.trim() || undefined,
      allegianceId: selectedAllegiance.id,
      denName: denName.trim() || `${name.trim()} Hold`,
      denType: selectedAllegiance.startingDenType,
      treasuryPennies: Number(startingPennies),
      pensions: 0,
      labour: 0,
      materials: 0,
      matchesPlayed: 0,
      wins: 0,
      fighters: [],
      inventory: [],
      denUpgrades: startingUpgrade
        ? [
            {
              id: crypto.randomUUID(),
              upgradeId: startingUpgrade.id,
              purchasedAfterMatchNumber: 0,
              isNewThisCycle: false,
              notes: `Granted automatically at Warband Creation by ${selectedAllegiance.name} Allegiance.`,
            },
          ]
        : [],
      treasuryLog: [
        {
          id: crypto.randomUUID(),
          date: now.slice(0, 10),
          deltaPennies: Number(startingPennies),
          reason: 'Initial Warband Creation Grant (B&B 2.0 Rules)',
          balanceAfter: Number(startingPennies),
        },
      ],
      backstory: backstory.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await createWarband(newWarband);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 my-auto shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div>
            <h2 className="text-xl font-bold text-amber-400 font-serif">
              Muster a New Warband (2.0 Rules)
            </h2>
            <p className="text-xs text-stone-400">
              In Burrows & Badgers 2nd Edition, your chosen Allegiance determines your starting Den & automatic Den Upgrade.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Warband Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The Redwillow Rangers"
                className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Warband Motto / Battlecry
              </label>
              <input
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                placeholder="e.g. No Crown Above the Oak"
                className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100"
              />
            </div>
          </div>

          {/* Allegiance Selection */}
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-400" />
              Select Warband Allegiance (2.0)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {sortedAllegiances.map((al) => {
                const isSelected = al.id === allegianceId;
                const upg = rules.denUpgrades.find((d) => d.id === al.startingDenUpgradeId);
                return (
                  <button
                    type="button"
                    key={al.id}
                    onClick={() => {
                      setAllegianceId(al.id);
                      setStartingPennies(al.startingPenniesOverride ?? 350);
                    }}
                    className={`text-left p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-950/35 border-amber-500 ring-1 ring-amber-500/40'
                        : 'bg-stone-950/80 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-100">{al.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1 line-clamp-2">{al.theme}</p>
                    <div className="mt-2 pt-2 border-t border-stone-800/80 text-[11px] text-emerald-400 font-medium">
                      Den: {al.startingDenType} ({upg?.name || 'Starting Upgrade'})
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Automatic Starting Den Preview */}
          {selectedAllegiance && (
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <Home className="w-4 h-4" />
                Automatic 2.0 Starting Den & Upgrade
              </div>
              <p className="text-xs text-stone-300">
                <span className="text-stone-400">Den Type:</span>{' '}
                <strong>{selectedAllegiance.startingDenType}</strong> — Grants{' '}
                <span className="text-emerald-400 font-semibold">
                  {startingUpgrade?.name || 'Allegiance Upgrade'}
                </span>
              </p>
              {startingUpgrade && (
                <p className="text-[11px] text-stone-400">{startingUpgrade.postGameBenefit}</p>
              )}
              <p className="text-[11px] text-stone-400 italic">
                Allowed Beasts: {selectedAllegiance.allowedSpeciesNote}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Custom Den Name
              </label>
              <input
                value={denName}
                onChange={(e) => setDenName(e.target.value)}
                placeholder={`e.g. Old Mill Cellar (${selectedAllegiance?.startingDenType || 'Hold'})`}
                className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                Starting Treasury (Standard 2.0 = 350 Pennies)
              </label>
              <input
                type="number"
                value={startingPennies}
                onChange={(e) => setStartingPennies(Number(e.target.value))}
                className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Warband Lore & Notes
            </label>
            <textarea
              rows={2}
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              placeholder="Write a brief chronicle of your beasts..."
              className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold cursor-pointer"
            >
              Create Warband & Open Roster
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
