import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  Campaign,
  CampaignMatch,
  RulesDataset,
  Warband,
} from '../types/game';
import { DEFAULT_RULES_DATASET, SAMPLE_WARBAND } from '../data/defaultRulesData';
import { getSupabaseClient } from '../lib/supabase';
import { calculateWarbandRating } from '../utils/gameMath';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isCloudAuthenticated: boolean;
}

interface AppContextValue {
  user: UserProfile;
  isCloudConfigured: boolean;
  isSyncing: boolean;
  rules: RulesDataset;
  warbands: Warband[];
  activeWarbandId: string;
  activeWarband: Warband | null;
  campaigns: Campaign[];
  matches: CampaignMatch[];
  setActiveWarbandId: (id: string) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  sendMagicLink: (email: string) => Promise<{ error?: string }>;
  syncLocalWarbandsToCloud: () => Promise<{ syncedCount: number; error?: string }>;
  signOut: () => Promise<void>;
  updateLocalUserName: (name: string) => void;
  saveWarband: (updated: Warband) => Promise<void>;
  createWarband: (newWarband: Warband) => Promise<void>;
  deleteWarband: (id: string) => Promise<void>;
  updateRules: (newRules: RulesDataset) => void;
  resetRulesToDefault: () => void;
  createCampaign: (name: string, description: string) => Promise<Campaign>;
  joinCampaignByCode: (inviteCode: string, warbandId: string) => Promise<boolean>;
  logCampaignMatch: (match: Omit<CampaignMatch, 'id' | 'playedAt'>) => Promise<void>;
  exportAllDataJson: () => string;
  importAllDataJson: (rawJson: string) => boolean;
}

const STORAGE_KEYS = {
  RULES: 'bb2_rules_dataset_v2',
  WARBANDS: 'bb2_warbands_v2',
  ACTIVE_WARBAND: 'bb2_active_warband_id_v2',
  CAMPAIGNS: 'bb2_campaigns_v2',
  MATCHES: 'bb2_matches_v2',
  LOCAL_USER: 'bb2_local_user_v2',
};

const DEFAULT_CAMPAIGN: Campaign = {
  id: 'camp-northymbra-autumn',
  name: 'The Autumn Mustering of Northymbra',
  description:
    'A 6-player narrative skirmish campaign across the borderlands of Bramblehollow and King’s Watch.',
  inviteCode: 'OAK202',
  createdBy: 'local-commander',
  createdAt: '2026-10-08T18:00:00Z',
};

const DEFAULT_MATCHES: CampaignMatch[] = [
  {
    id: 'm-1',
    campaignId: 'camp-northymbra-autumn',
    scenario: 'The Coaching Inn Ambush',
    warbandAId: 'wb-sample-thornwatch',
    warbandAName: 'The Thornwatch Companions',
    warbandBId: 'wb-rival-1',
    warbandBName: 'Captain Vane’s King’s Watch',
    winnerWarbandId: 'wb-sample-thornwatch',
    summaryNotes:
      'Sir Sorrel intercepted the Royalist pay-chest wagon before it crossed the old stone bridge.',
    playedAt: '2026-10-10T20:30:00Z',
  },
  {
    id: 'm-2',
    campaignId: 'camp-northymbra-autumn',
    scenario: 'Relics of the Ruined Abbey',
    warbandAId: 'wb-sample-thornwatch',
    warbandAName: 'The Thornwatch Companions',
    warbandBId: 'wb-rival-2',
    warbandBName: 'Coven of the Hollow Yew',
    winnerWarbandId: 'wb-sample-thornwatch',
    summaryNotes:
      'Brokk Ironback held the chapel steps against two conjured bramble snares while Hazel claimed the Northymbran relic.',
    playedAt: '2026-10-15T21:15:00Z',
  },
];

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rules, setRules] = useState<RulesDataset>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RULES);
      if (saved) {
        const parsed = JSON.parse(saved) as RulesDataset;
        if (parsed.version === DEFAULT_RULES_DATASET.version) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_RULES_DATASET;
  });

  const [warbands, setWarbands] = useState<Warband[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WARBANDS);
      if (saved) {
        const parsed = JSON.parse(saved) as Warband[];
        if (parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return [SAMPLE_WARBAND];
  });

  const [activeWarbandId, setActiveWarbandIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_WARBAND) || SAMPLE_WARBAND.id;
  });

  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CAMPAIGNS);
      if (saved) return JSON.parse(saved) as Campaign[];
    } catch {
      // fallback
    }
    return [DEFAULT_CAMPAIGN];
  });

  const [matches, setMatches] = useState<CampaignMatch[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MATCHES);
      if (saved) return JSON.parse(saved) as CampaignMatch[];
    } catch {
      // fallback
    }
    return DEFAULT_MATCHES;
  });

  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOCAL_USER);
      if (saved) return JSON.parse(saved) as UserProfile;
    } catch {
      // fallback
    }
    return {
      id: 'local-commander',
      name: 'Local Commander',
      email: 'Offline / Local Browser Mode',
      isCloudAuthenticated: false,
    };
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const supabase = getSupabaseClient();
  const isCloudConfigured = Boolean(supabase);

  // Persist local state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WARBANDS, JSON.stringify(warbands));
  }, [warbands]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_WARBAND, activeWarbandId);
  }, [activeWarbandId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(matches));
  }, [matches]);

  // Listen for Supabase Auth session if configured
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name:
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'Commander',
          email: session.user.email || '',
          avatarUrl: session.user.user_metadata?.avatar_url,
          isCloudAuthenticated: true,
        });
        void fetchCloudData(supabase);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name:
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'Commander',
          email: session.user.email || '',
          avatarUrl: session.user.user_metadata?.avatar_url,
          isCloudAuthenticated: true,
        });
        void fetchCloudData(supabase);
      } else {
        setUser({
          id: 'local-commander',
          name: 'Local Commander',
          email: 'Offline / Local Browser Mode',
          isCloudAuthenticated: false,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function fetchCloudData(client: NonNullable<typeof supabase>) {
    setIsSyncing(true);
    try {
      const { data: wbRows } = await client
        .from('warbands')
        .select('payload')
        .order('updated_at', { ascending: false });

      if (wbRows && wbRows.length > 0) {
        const cloudWarbands = wbRows.map((r: { payload: Warband }) => r.payload);
        setWarbands((prevLocal) => {
          const cloudIds = new Set(cloudWarbands.map((w) => w.id));
          // Keep any local warbands that haven't been synced yet (excluding default sample if cloud has data)
          const unsyncedLocal = prevLocal.filter(
            (w) => !cloudIds.has(w.id) && w.id !== SAMPLE_WARBAND.id
          );
          const merged = [...cloudWarbands, ...unsyncedLocal];
          return merged.length > 0 ? merged : cloudWarbands;
        });
      }

      const { data: campRows } = await client.from('campaigns').select('*');
      if (campRows && campRows.length > 0) {
        setCampaigns(
          campRows.map((c: Record<string, string>) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            inviteCode: c.invite_code,
            createdBy: c.created_by,
            createdAt: c.created_at,
          }))
        );
      }

      const { data: matchRows } = await client
        .from('campaign_matches')
        .select('*')
        .order('played_at', { ascending: false });
      if (matchRows && matchRows.length > 0) {
        setMatches(
          matchRows.map((m: Record<string, string>) => ({
            id: m.id,
            campaignId: m.campaign_id,
            scenario: m.scenario,
            warbandAId: m.warband_a_id,
            warbandAName: m.warband_a_name,
            warbandBId: m.warband_b_id,
            warbandBName: m.warband_b_name,
            winnerWarbandId: m.winner_warband_id,
            summaryNotes: m.summary_notes || '',
            playedAt: m.played_at,
          }))
        );
      }
    } finally {
      setIsSyncing(false);
    }
  }

  const setActiveWarbandId = (id: string) => {
    setActiveWarbandIdState(id);
  };

  const signInWithGoogle = async () => {
    const client = getSupabaseClient();
    if (!client) {
      alert(
        'To use Cloud Sign-In, click "Cloud & Auth Setup" in the top bar and paste your free Supabase Project URL & Anon Key (or set them in .env).'
      );
      return;
    }
    await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ error?: string }> => {
    const client = getSupabaseClient();
    if (!client) {
      return { error: 'Supabase Cloud is not configured yet. Add your URL and Anon Key below first.' };
    }
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { error: error.message };
    return {};
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ error?: string; needsEmailConfirmation?: boolean }> => {
    const client = getSupabaseClient();
    if (!client) {
      return { error: 'Supabase Cloud is not configured yet. Add your URL and Anon Key below first.' };
    }
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: displayName?.trim() || email.split('@')[0],
        },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    const needsEmailConfirmation = Boolean(data.user && !data.session);
    return { needsEmailConfirmation };
  };

  const sendMagicLink = async (email: string): Promise<{ error?: string }> => {
    const client = getSupabaseClient();
    if (!client) {
      return { error: 'Supabase Cloud is not configured yet. Add your URL and Anon Key below first.' };
    }
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    return {};
  };

  const syncLocalWarbandsToCloud = async (): Promise<{ syncedCount: number; error?: string }> => {
    if (!supabase || !user.isCloudAuthenticated) {
      return { syncedCount: 0, error: 'Please sign in first to sync warbands to the cloud.' };
    }
    setIsSyncing(true);
    try {
      let count = 0;
      for (const wb of warbands) {
        const stamped: Warband = {
          ...wb,
          ownerName: user.name,
          updatedAt: new Date().toISOString(),
        };
        const { error } = await supabase.from('warbands').upsert({
          id: stamped.id,
          user_id: user.id,
          owner_name: user.name,
          campaign_id: stamped.campaignId || null,
          name: stamped.name,
          allegiance_id: stamped.allegianceId,
          den_name: stamped.denName,
          treasury_pennies: stamped.treasuryPennies,
          fate_points: stamped.fatePoints ?? 0,
          warband_rating: calculateWarbandRating(stamped, rules),
          payload: stamped,
          updated_at: stamped.updatedAt,
        });
        if (!error) count++;
      }
      await fetchCloudData(supabase);
      return { syncedCount: count };
    } catch (err) {
      return {
        syncedCount: 0,
        error: err instanceof Error ? err.message : 'Failed to sync warbands',
      };
    } finally {
      setIsSyncing(false);
    }
  };

  const signOut = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    const fallback: UserProfile = {
      id: 'local-commander',
      name: 'Local Commander',
      email: 'Offline / Local Browser Mode',
      isCloudAuthenticated: false,
    };
    setUser(fallback);
    localStorage.setItem(STORAGE_KEYS.LOCAL_USER, JSON.stringify(fallback));
  };

  const updateLocalUserName = (name: string) => {
    const updated = { ...user, name };
    setUser(updated);
    localStorage.setItem(STORAGE_KEYS.LOCAL_USER, JSON.stringify(updated));
  };

  const saveWarband = async (updated: Warband) => {
    const stamped: Warband = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    setWarbands((prev) => prev.map((w) => (w.id === stamped.id ? stamped : w)));

    if (supabase && user.isCloudAuthenticated) {
      setIsSyncing(true);
      try {
        await supabase.from('warbands').upsert({
          id: stamped.id,
          user_id: user.id,
          owner_name: user.name,
          campaign_id: stamped.campaignId || null,
          name: stamped.name,
          allegiance_id: stamped.allegianceId,
          den_name: stamped.denName,
          treasury_pennies: stamped.treasuryPennies,
          fate_points: stamped.fatePoints ?? 0,
          warband_rating: calculateWarbandRating(stamped, rules),
          payload: stamped,
          updated_at: stamped.updatedAt,
        });
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const createWarband = async (newWarband: Warband) => {
    setWarbands((prev) => [newWarband, ...prev]);
    setActiveWarbandIdState(newWarband.id);
    if (supabase && user.isCloudAuthenticated) {
      await saveWarband(newWarband);
    }
  };

  const deleteWarband = async (id: string) => {
    setWarbands((prev) => {
      const remaining = prev.filter((w) => w.id !== id);
      if (activeWarbandId === id && remaining.length > 0) {
        setActiveWarbandIdState(remaining[0].id);
      }
      return remaining;
    });
    if (supabase && user.isCloudAuthenticated) {
      await supabase.from('warbands').delete().eq('id', id);
    }
  };

  const updateRules = (newRules: RulesDataset) => {
    setRules(newRules);
  };

  const resetRulesToDefault = () => {
    setRules(DEFAULT_RULES_DATASET);
  };

  const createCampaign = async (name: string, description: string): Promise<Campaign> => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newCamp: Campaign = {
      id: crypto.randomUUID(),
      name,
      description,
      inviteCode: code,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    setCampaigns((prev) => [newCamp, ...prev]);
    if (supabase && user.isCloudAuthenticated) {
      await supabase.from('campaigns').insert({
        id: newCamp.id,
        name: newCamp.name,
        description: newCamp.description,
        invite_code: newCamp.inviteCode,
        created_by: user.id,
      });
    }
    return newCamp;
  };

  const joinCampaignByCode = async (inviteCode: string, warbandId: string): Promise<boolean> => {
    const normalized = inviteCode.trim().toUpperCase();
    let found = campaigns.find((c) => c.inviteCode.toUpperCase() === normalized);
    if (!found && supabase && user.isCloudAuthenticated) {
      const { data: campRow } = await supabase
        .from('campaigns')
        .select('*')
        .ilike('invite_code', normalized)
        .maybeSingle();
      if (campRow) {
        found = {
          id: campRow.id,
          name: campRow.name,
          description: campRow.description,
          inviteCode: campRow.invite_code,
          createdBy: campRow.created_by,
          createdAt: campRow.created_at,
        };
        setCampaigns((prev) => (prev.some((c) => c.id === found!.id) ? prev : [found!, ...prev]));
      }
    }
    if (!found) return false;
    const wb = warbands.find((w) => w.id === warbandId);
    if (!wb) return false;
    await saveWarband({ ...wb, campaignId: found.id });
    if (supabase && user.isCloudAuthenticated) {
      await fetchCloudData(supabase);
    }
    return true;
  };

  const logCampaignMatch = async (matchInput: Omit<CampaignMatch, 'id' | 'playedAt'>) => {
    const newMatch: CampaignMatch = {
      ...matchInput,
      id: crypto.randomUUID(),
      playedAt: new Date().toISOString(),
    };
    setMatches((prev) => [newMatch, ...prev]);
    if (supabase && user.isCloudAuthenticated) {
      await supabase.from('campaign_matches').insert({
        id: newMatch.id,
        campaign_id: newMatch.campaignId,
        scenario: newMatch.scenario,
        warband_a_id: newMatch.warbandAId,
        warband_a_name: newMatch.warbandAName,
        warband_b_id: newMatch.warbandBId,
        warband_b_name: newMatch.warbandBName,
        winner_warband_id: newMatch.winnerWarbandId,
        summary_notes: newMatch.summaryNotes,
        played_at: newMatch.playedAt,
        created_by: user.id,
      });
    }
  };

  const exportAllDataJson = (): string => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        rules,
        warbands,
        campaigns,
        matches,
      },
      null,
      2
    );
  };

  const importAllDataJson = (rawJson: string): boolean => {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.rules) setRules(parsed.rules);
      if (Array.isArray(parsed.warbands) && parsed.warbands.length > 0) {
        setWarbands(parsed.warbands);
        setActiveWarbandIdState(parsed.warbands[0].id);
      }
      if (Array.isArray(parsed.campaigns)) setCampaigns(parsed.campaigns);
      if (Array.isArray(parsed.matches)) setMatches(parsed.matches);
      return true;
    } catch {
      return false;
    }
  };

  const activeWarband = warbands.find((w) => w.id === activeWarbandId) ?? warbands[0] ?? null;

  return (
    <AppContext.Provider
      value={{
        user,
        isCloudConfigured,
        isSyncing,
        rules,
        warbands,
        activeWarbandId,
        activeWarband,
        campaigns,
        matches,
        setActiveWarbandId,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendMagicLink,
        syncLocalWarbandsToCloud,
        signOut,
        updateLocalUserName,
        saveWarband,
        createWarband,
        deleteWarband,
        updateRules,
        resetRulesToDefault,
        createCampaign,
        joinCampaignByCode,
        logCampaignMatch,
        exportAllDataJson,
        importAllDataJson,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
