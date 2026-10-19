import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  getSavedSupabaseConfig,
  saveRuntimeSupabaseConfig,
} from '../lib/supabase';
import {
  Cloud,
  Download,
  Upload,
  LogIn,
  LogOut,
  X,
  CheckCircle2,
  User,
  Mail,
  KeyRound,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const CloudAndAuthModal: React.FC<Props> = ({ onClose }) => {
  const {
    user,
    isCloudConfigured,
    isSyncing,
    lastSyncedAt,
    lastSyncError,
    cloudWarbandCount,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendMagicLink,
    syncLocalWarbandsToCloud,
    signOut,
    updateLocalUserName,
    exportAllDataJson,
    importAllDataJson,
  } = useApp();

  const existingCfg = getSavedSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(existingCfg?.url || '');
  const [sbKey, setSbKey] = useState(existingCfg?.anonKey || '');
  const [localName, setLocalName] = useState(user.name);
  const [importJsonText, setImportJsonText] = useState('');

  // Email Auth State
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage(null);
    if (!email.trim()) {
      setAuthMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }

    setAuthBusy(true);
    try {
      if (authMode === 'signin') {
        const res = await signInWithEmail(email, password);
        if (res.error) {
          setAuthMessage({ type: 'error', text: res.error });
        } else {
          setAuthMessage({ type: 'success', text: 'Signed in! Your rosters are now syncing.' });
        }
      } else if (authMode === 'signup') {
        if (password.length < 6) {
          setAuthMessage({
            type: 'error',
            text: 'Password must be at least 6 characters.',
          });
          return;
        }
        const res = await signUpWithEmail(email, password, displayName || localName);
        if (res.error) {
          setAuthMessage({ type: 'error', text: res.error });
        } else if (res.needsEmailConfirmation) {
          setAuthMessage({
            type: 'success',
            text: 'Account created! Check your email inbox to confirm your address (or disable "Confirm email" in Supabase Auth → Providers → Email for instant login).',
          });
        } else {
          setAuthMessage({
            type: 'success',
            text: 'Account created and signed in!',
          });
        }
      } else {
        const res = await sendMagicLink(email);
        if (res.error) {
          setAuthMessage({ type: 'error', text: res.error });
        } else {
          setAuthMessage({
            type: 'success',
            text: 'Magic sign-in link sent! Check your email inbox.',
          });
        }
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSyncToCloud = async () => {
    setAuthMessage(null);
    const res = await syncLocalWarbandsToCloud();
    if (res.error) {
      setAuthMessage({ type: 'error', text: res.error });
    } else {
      setAuthMessage({
        type: 'success',
        text: `Synced ${res.syncedCount} warband(s) to the cloud!`,
      });
    }
  };

  const handleSaveSupabaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sbUrl.trim() || !sbKey.trim()) {
      saveRuntimeSupabaseConfig(null);
      alert('Cleared custom Supabase credentials. Reloading in Local Storage mode...');
      window.location.reload();
      return;
    }
    saveRuntimeSupabaseConfig({ url: sbUrl.trim(), anonKey: sbKey.trim() });
    alert('Supabase Cloud configuration saved! Reloading app to connect...');
    window.location.reload();
  };

  const handleDownloadFullBackup = () => {
    const raw = exportAllDataJson();
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `northymbra-warband-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = () => {
    if (!importJsonText.trim()) return;
    const ok = importAllDataJson(importJsonText);
    if (ok) {
      alert('Backup restored successfully!');
      setImportJsonText('');
      onClose();
    } else {
      alert('Invalid backup JSON file.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-xl w-full p-5 sm:p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <h3 className="text-lg font-bold text-amber-400 font-serif flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Commander Account, Cloud Sync &amp; Backups
          </h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Commander Profile & Cloud Auth Section */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <User className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-sm font-bold text-stone-100">{user.name}</div>
                <div className="text-xs text-stone-400">{user.email}</div>
              </div>
            </div>
            {user.isCloudAuthenticated && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncToCloud}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync Local Warbands
                </button>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-red-950/60 text-stone-200 text-xs font-semibold cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>

          {user.isCloudAuthenticated && (
            <div className="bg-stone-900/80 border border-stone-800 rounded-lg px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
              <span className="text-stone-300">
                Cloud Database Rows:{' '}
                <strong className="text-emerald-400">
                  {cloudWarbandCount !== null ? `${cloudWarbandCount} warband(s)` : 'Checking...'}
                </strong>
              </span>
              {lastSyncedAt && (
                <span className="text-stone-400">
                  Last Synced: {new Date(lastSyncedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}

          {lastSyncError && (
            <div className="p-2.5 rounded-lg text-xs border bg-red-950/50 border-red-700/60 text-red-200">
              Cloud Sync Error: {lastSyncError}
            </div>
          )}

          {authMessage && (
            <div
              className={`p-2.5 rounded-lg text-xs border ${
                authMessage.type === 'success'
                  ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
                  : 'bg-red-950/50 border-red-700/60 text-red-200'
              }`}
            >
              {authMessage.text}
            </div>
          )}

          {!user.isCloudAuthenticated && (
            <>
              {/* Local Commander Name */}
              <div className="pt-2 border-t border-stone-800 flex items-center gap-2">
                <input
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  placeholder="Commander Display Name"
                  className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                />
                <button
                  onClick={() => updateLocalUserName(localName)}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-200 font-semibold cursor-pointer"
                >
                  Update Local Name
                </button>
              </div>

              {/* Email + Password / Magic Link / Google Auth */}
              <div className="pt-3 border-t border-stone-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Cloud Sign-In (Cross-Device &amp; Shared Campaigns)
                  </span>
                  <div className="flex rounded-lg bg-stone-900 p-0.5 border border-stone-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setAuthMessage(null);
                      }}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        authMode === 'signin'
                          ? 'bg-amber-600 text-stone-950'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthMessage(null);
                      }}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        authMode === 'signup'
                          ? 'bg-amber-600 text-stone-950'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      Create Account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('magic');
                        setAuthMessage(null);
                      }}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        authMode === 'magic'
                          ? 'bg-amber-600 text-stone-950'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      Magic Link
                    </button>
                  </div>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-2.5">
                  {authMode === 'signup' && (
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Commander Name (shown on Campaign Leaderboard)"
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-100"
                      />
                    </div>
                  )}
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-100"
                    />
                  </div>
                  {authMode !== 'magic' && (
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password (min. 6 characters)"
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-100"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={authBusy}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {authMode === 'magic' ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Send Magic Link
                        </>
                      ) : (
                        <>
                          <LogIn className="w-3.5 h-3.5" />
                          {authMode === 'signup' ? 'Create Commander Account' : 'Sign In with Email'}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={signInWithGoogle}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
                    >
                      Sign in with Google
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>

        {/* Supabase Cloud Credentials Form */}
        <form
          onSubmit={handleSaveSupabaseConfig}
          className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Supabase Cloud Connection ($0/mo Free Tier)
            </h4>
            {isCloudConfigured && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-400">
            Run <code className="text-amber-300">supabase/migrations/001_initial_schema.sql</code> in your Supabase SQL Editor, then paste your Project URL &amp; Anon Key below (or set <code className="text-amber-300">VITE_SUPABASE_URL</code> and <code className="text-amber-300">VITE_SUPABASE_ANON_KEY</code> in <code className="text-amber-300">.env</code> when hosting so friends connect automatically).
          </p>
          <div className="space-y-2">
            <input
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs font-mono text-stone-200"
            />
            <input
              value={sbKey}
              onChange={(e) => setSbKey(e.target.value)}
              placeholder="Supabase public anon key (eyJ...)"
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs font-mono text-stone-200"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-semibold border border-stone-700 cursor-pointer"
            >
              Save Cloud Connection
            </button>
          </div>
        </form>

        {/* Full JSON Backup Export / Import */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Full Roster &amp; Rules Backup (JSON)
            </h4>
            <button
              onClick={handleDownloadFullBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              Download Backup
            </button>
          </div>
          <textarea
            rows={3}
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            placeholder="Paste backup JSON here to restore all warbands, campaigns, and custom rules..."
            className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2.5 text-xs font-mono text-stone-200"
          />
          {importJsonText.trim() && (
            <div className="flex justify-end">
              <button
                onClick={handleRestoreBackup}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-stone-950 font-bold text-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Restore from JSON
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

