import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { calculateWarbandRating } from '../utils/gameMath';
import {
  Trophy,
  Users,
  Plus,
  KeyRound,
  Swords,
  ScrollText,
  Crown,
} from 'lucide-react';

export const CampaignHubView: React.FC = () => {
  const {
    campaigns,
    matches,
    warbands,
    activeWarband,
    rules,
    createCampaign,
    joinCampaignByCode,
    logCampaignMatch,
  } = useApp();

  const [newCampName, setNewCampName] = useState('');
  const [newCampDesc, setNewCampDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Match Log State
  const [selectedCampaignId, setSelectedCampaignId] = useState(
    campaigns[0]?.id || ''
  );
  const [scenario, setScenario] = useState('Borderland Skirmish');
  const [opponentName, setOpponentName] = useState('');
  const [didWin, setDidWin] = useState<'win' | 'loss' | 'draw'>('win');
  const [summaryNotes, setSummaryNotes] = useState('');

  const activeCampaign =
    campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0];

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampName.trim()) return;
    const created = await createCampaign(newCampName.trim(), newCampDesc.trim());
    setSelectedCampaignId(created.id);
    setNewCampName('');
    setNewCampDesc('');
  };

  const handleJoinCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWarband || !joinCode.trim()) return;
    const ok = await joinCampaignByCode(joinCode, activeWarband.id);
    if (ok) {
      alert(`${activeWarband.name} has joined the campaign!`);
      setJoinCode('');
    } else {
      alert('No campaign found with that invite code.');
    }
  };

  const handleLogBattle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCampaign || !activeWarband || !opponentName.trim()) return;

    await logCampaignMatch({
      campaignId: activeCampaign.id,
      scenario: scenario.trim() || 'Skirmish',
      warbandAId: activeWarband.id,
      warbandAName: activeWarband.name,
      warbandBId: 'opponent',
      warbandBName: opponentName.trim(),
      winnerWarbandId:
        didWin === 'win'
          ? activeWarband.id
          : didWin === 'loss'
          ? 'opponent'
          : null,
      summaryNotes: summaryNotes.trim(),
    });
    setOpponentName('');
    setSummaryNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Top Row: Create or Join Campaign */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form
          onSubmit={handleCreateCampaign}
          className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3"
        >
          <h3 className="text-base font-bold text-amber-400 font-serif flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create a New Gaming Group Campaign
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={newCampName}
              onChange={(e) => setNewCampName(e.target.value)}
              placeholder="Campaign Name (e.g. Shires of Northymbra)"
              className="bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
              required
            />
            <input
              value={newCampDesc}
              onChange={(e) => setNewCampDesc(e.target.value)}
              placeholder="Short campaign description..."
              className="bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer"
            >
              Create Campaign & Generate Code
            </button>
          </div>
        </form>

        <form
          onSubmit={handleJoinCampaign}
          className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3"
        >
          <h3 className="text-base font-bold text-emerald-400 font-serif flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Enlist {activeWarband?.name || 'Warband'} via Invite Code
          </h3>
          <p className="text-xs text-stone-400">
            Enter a 6-character campaign code shared by your Campaign Master to link your active warband.
          </p>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="e.g. OAK202"
              className="flex-1 bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs font-mono uppercase text-stone-100"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs cursor-pointer"
            >
              Join Campaign
            </button>
          </div>
        </form>
      </div>

      {/* Campaign Selector & Standings */}
      {activeCampaign && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-800 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-amber-400" />
                <select
                  value={activeCampaign.id}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="bg-stone-950 border border-stone-700 rounded-xl px-3 py-1.5 text-base font-bold text-amber-400 font-serif"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-stone-400 mt-1">{activeCampaign.description}</p>
            </div>
            <div className="bg-stone-950 border border-stone-800 px-4 py-2 rounded-xl text-xs">
              Invite Code:{' '}
              <strong className="font-mono text-amber-400 text-sm ml-1">
                {activeCampaign.inviteCode}
              </strong>
            </div>
          </div>

          {/* Participating Warbands Standings */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-400" />
              Campaign Warband Standings
            </h4>
            <div className="overflow-x-auto bg-stone-950 border border-stone-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400">
                    <th className="p-3">Warband</th>
                    <th className="p-3">Commander</th>
                    <th className="p-3">Allegiance & Den</th>
                    <th className="p-3">Beasts</th>
                    <th className="p-3">Treasury</th>
                    <th className="p-3">Warband Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/70">
                  {warbands.map((wb) => {
                    const al = rules.allegiances.find((a) => a.id === wb.allegianceId);
                    const rating = calculateWarbandRating(wb, rules);
                    return (
                      <tr key={wb.id} className="hover:bg-stone-900/60">
                        <td className="p-3 font-bold text-stone-100 flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                          {wb.name}
                        </td>
                        <td className="p-3 text-stone-300">{wb.ownerName}</td>
                        <td className="p-3 text-stone-300">
                          {al?.name} — <span className="text-stone-500">{wb.denName}</span>
                        </td>
                        <td className="p-3">{wb.fighters.length}</td>
                        <td className="p-3 text-amber-400 font-semibold">
                          {wb.treasuryPennies}p
                        </td>
                        <td className="p-3 font-bold text-emerald-400">{rating}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Battle Chronicle & Match Logger */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
            <form
              onSubmit={handleLogBattle}
              className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3"
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Swords className="w-4 h-4" />
                Record Campaign Battle Result
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">
                    Scenario Played
                  </label>
                  <input
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">
                    Opposing Warband
                  </label>
                  <input
                    value={opponentName}
                    onChange={(e) => setOpponentName(e.target.value)}
                    placeholder="e.g. Captain Vane's Royalists"
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Outcome</label>
                  <select
                    value={didWin}
                    onChange={(e) =>
                      setDidWin(e.target.value as 'win' | 'loss' | 'draw')
                    }
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1.5 text-xs"
                  >
                    <option value="win">{activeWarband?.name} Victory</option>
                    <option value="loss">Opponent Victory</option>
                    <option value="draw">Honourable Draw</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-stone-400 mb-1">
                    Battle Chronicle Notes
                  </label>
                  <input
                    value={summaryNotes}
                    onChange={(e) => setSummaryNotes(e.target.value)}
                    placeholder="Key moments, objectives seized, heroic deeds..."
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer"
                >
                  Log Battle Report
                </button>
              </div>
            </form>

            {/* Recent Battles */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <ScrollText className="w-4 h-4 text-emerald-400" />
                Recent Campaign Chronicles
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {matches
                  .filter((m) => m.campaignId === activeCampaign.id)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300">{m.scenario}</span>
                        <span className="text-[10px] text-stone-500">
                          {m.playedAt.slice(0, 10)}
                        </span>
                      </div>
                      <div className="text-stone-200 font-medium">
                        {m.warbandAName} vs. {m.warbandBName}
                      </div>
                      {m.summaryNotes && (
                        <p className="text-stone-400 text-[11px] italic">
                          &ldquo;{m.summaryNotes}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
