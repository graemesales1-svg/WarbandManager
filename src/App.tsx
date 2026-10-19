import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { WarbandRosterView } from './components/WarbandRosterView';
import { DenAndStashView } from './components/DenAndStashView';
import { ActiveGameTrackerView } from './components/ActiveGameTrackerView';
import { PrintableRosterView } from './components/PrintableRosterView';
import { CampaignHubView } from './components/CampaignHubView';
import { RulesDataManager } from './components/RulesDataManager';
import { CreateWarbandModal } from './components/CreateWarbandModal';
import { CloudAndAuthModal } from './components/CloudAndAuthModal';
import {
  Shield,
  Home,
  Swords,
  Trophy,
  BookOpen,
  Printer,
  Plus,
  Cloud,
  Trash2,
} from 'lucide-react';

type MainTab =
  | 'roster'
  | 'den'
  | 'match'
  | 'campaign'
  | 'print'
  | 'rules';

const WarbandManagerShell: React.FC = () => {
  const {
    user,
    isCloudConfigured,
    warbands,
    activeWarband,
    setActiveWarbandId,
    deleteWarband,
  } = useApp();

  const [activeTab, setActiveTab] = useState<MainTab>('roster');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const navItems: { id: MainTab; label: string; icon: React.ElementType }[] = [
    { id: 'roster', label: 'Warband & Gear', icon: Shield },
    { id: 'den', label: 'Den & Stash', icon: Home },
    { id: 'match', label: 'Active Game (Mobile)', icon: Swords },
    { id: 'campaign', label: 'Campaign Hub', icon: Trophy },
    { id: 'print', label: 'Print / PDF Sheet', icon: Printer },
    { id: 'rules', label: '2.0 Rules Data', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      {/* Top Header Bar (Hidden when printing) */}
      <header className="print:hidden border-b border-stone-800 bg-stone-900/95 backdrop-blur-xs sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-stone-950 flex items-center justify-center font-serif font-extrabold text-lg shadow">
                B&amp;B
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-extrabold tracking-wide text-amber-400 font-serif leading-tight">
                  Northymbra Warband Chronicler
                </h1>
                <p className="text-[11px] text-stone-400">
                  Burrows &amp; Badgers — 2nd Edition Roster, Den &amp; Campaign Manager
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAuthModal(true)}
              className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-800 text-xs text-amber-300 border border-stone-700 cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              {user.isCloudAuthenticated ? 'Synced' : 'Account'}
            </button>
          </div>

          {/* Warband Switcher & Account Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {warbands.length > 0 && (
              <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-1">
                <span className="text-[11px] text-stone-400">Warband:</span>
                <select
                  value={activeWarband?.id || ''}
                  onChange={(e) => setActiveWarbandId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-amber-300 focus:outline-none cursor-pointer"
                >
                  {warbands.map((wb) => (
                    <option
                      key={wb.id}
                      value={wb.id}
                      className="bg-stone-900 text-stone-100"
                    >
                      {wb.name} ({wb.treasuryPennies}p)
                    </option>
                  ))}
                </select>
                {warbands.length > 1 && activeWarband && (
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Delete warband "${activeWarband.name}" permanently?`
                        )
                      ) {
                        void deleteWarband(activeWarband.id);
                      }
                    }}
                    className="text-stone-500 hover:text-red-400 pl-1 cursor-pointer"
                    title="Delete Warband"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Warband
            </button>

            <button
              onClick={() => setShowAuthModal(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium border border-stone-700 cursor-pointer"
            >
              <Cloud
                className={`w-3.5 h-3.5 ${
                  user.isCloudAuthenticated
                    ? 'text-emerald-400'
                    : isCloudConfigured
                    ? 'text-amber-400'
                    : 'text-stone-400'
                }`}
              />
              <span>
                {user.isCloudAuthenticated
                  ? user.name
                  : 'Cloud Sync / Backups'}
              </span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto no-scrollbar border-t border-stone-800/70">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition cursor-pointer ${
                  active
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 print:p-0 print:max-w-none">
        {activeTab === 'roster' && <WarbandRosterView />}
        {activeTab === 'den' && <DenAndStashView />}
        {activeTab === 'match' && <ActiveGameTrackerView />}
        {activeTab === 'campaign' && <CampaignHubView />}
        {activeTab === 'print' && <PrintableRosterView />}
        {activeTab === 'rules' && <RulesDataManager />}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateWarbandModal onClose={() => setShowCreateModal(false)} />
      )}
      {showAuthModal && (
        <CloudAndAuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <WarbandManagerShell />
    </AppProvider>
  );
}

export default App;
