import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  EquippedOrStashedItem,
  WarbandDenUpgradeInstance,
} from '../types/game';
import {
  applyWeaponUpgradeToItem,
  formatItemDisplayName,
  getAllegianceStartingRareEquipment,
  getEquipmentCostForAllegiance,
  getEquipmentPageReference,
  getItemQuantity,
  isEligibleWeaponForUpgrade,
  isEquipmentStackable,
  isWeaponUpgradeEquipment,
  validateEquipmentForFighter,
} from '../utils/gameMath';
import { EquipmentDetailModal } from './EquipmentDetailModal';
import {
  Home,
  Package,
  Coins,
  Plus,
  Trash2,
  ArrowRightLeft,
  Sparkles,
  CheckCircle2,
  ShoppingBag,
  History,
  Pencil,
  Check,
  X,
} from 'lucide-react';

export const DenAndStashView: React.FC = () => {
  const { activeWarband, rules, saveWarband } = useApp();

  const sortedDenUpgrades = [...rules.denUpgrades].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const sortedEquipment = [...rules.equipment].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const [selectedUpgradeId, setSelectedUpgradeId] = useState(
    sortedDenUpgrades.find((d) => !d.isStartingOnly)?.id || sortedDenUpgrades[0]?.id || ''
  );
  const [freeUpgrade, setFreeUpgrade] = useState(false);

  // Stash purchase state
  const [stashEqId, setStashEqId] = useState(sortedEquipment[0]?.id || '');
  const [stashTargetWeaponId, setStashTargetWeaponId] = useState<string>('');
  const [stashQuantity, setStashQuantity] = useState(1);
  const [stashCustomName, setStashCustomName] = useState('');
  const [stashFree, setStashFree] = useState(false);

  // Manual Treasury adjustment state
  const [pennyDelta, setPennyDelta] = useState(25);
  const [pennyReason, setPennyReason] = useState('Post-Battle Spoils & Foraging');

  // Den Name Editing State
  const [isEditingDenName, setIsEditingDenName] = useState(false);
  const [denNameInput, setDenNameInput] = useState('');

  // Stash Sale Price Override State
  const [overrideStashSellPrice, setOverrideStashSellPrice] = useState(false);
  const [stashSellOverrideMode, setStashSellOverrideMode] = useState<'full' | 'custom'>(
    'full'
  );
  const [customStashSellAmount, setCustomStashSellAmount] = useState<number>(10);
  const [selectedStashItemId, setSelectedStashItemId] = useState<string | null>(null);

  if (!activeWarband) return null;

  const handleSaveItemCustomName = async (
    instanceId: string,
    customName: string
  ) => {
    const trimmed = customName.trim();
    const updatedInventory = activeWarband.inventory.map((item) =>
      item.instanceId === instanceId
        ? { ...item, customName: trimmed || undefined }
        : item
    );
    await saveWarband({
      ...activeWarband,
      inventory: updatedInventory,
    });
  };

  const allegiance = rules.allegiances.find((a) => a.id === activeWarband.allegianceId);
  const allegianceRareOptions = getAllegianceStartingRareEquipment(allegiance);
  const allegianceRareIds = new Set(allegianceRareOptions.map((o) => o.equipmentId));
  const allegianceRareEquipmentList = allegianceRareOptions
    .map((o) => rules.equipment.find((e) => e.id === o.equipmentId))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  const stashedItems = activeWarband.inventory.filter((i) => i.assignedFighterId === null);
  const ownedUpgradeIds = new Set(activeWarband.denUpgrades.map((d) => d.upgradeId));

  // Build Den Upgrade (up to 12 slots per 2.0 Roster)
  const handleConstructUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeWarband.denUpgrades.length >= 12) {
      alert('Your Den has reached the maximum of 12 Upgrade Slots on the 2.0 Warband Roster.');
      return;
    }
    if (ownedUpgradeIds.has(selectedUpgradeId)) {
      alert(
        'In Burrows & Badgers 2.0, a warband may only construct one of each specific Den Upgrade.'
      );
      return;
    }
    const ref = rules.denUpgrades.find((d) => d.id === selectedUpgradeId);
    if (!ref) return;

    const cost = freeUpgrade ? 0 : ref.cost;
    if (cost > activeWarband.treasuryPennies) {
      alert(`Not enough Pennies (${activeWarband.treasuryPennies}p available, ${cost}p needed).`);
      return;
    }

    const newEntry: WarbandDenUpgradeInstance = {
      id: crypto.randomUUID(),
      upgradeId: ref.id,
      purchasedAfterMatchNumber: activeWarband.matchesPlayed,
      isNewThisCycle: true,
    };

    const newBalance = activeWarband.treasuryPennies - cost;
    await saveWarband({
      ...activeWarband,
      treasuryPennies: newBalance,
      denUpgrades: [...activeWarband.denUpgrades, newEntry],
      treasuryLog:
        cost > 0
          ? [
              {
                id: crypto.randomUUID(),
                date: new Date().toISOString().slice(0, 10),
                deltaPennies: -cost,
                reason: `Constructed Den Upgrade: ${ref.name}`,
                balanceAfter: newBalance,
              },
              ...activeWarband.treasuryLog,
            ]
          : activeWarband.treasuryLog,
    });
  };

  const handleToggleUpgradeActive = async (id: string) => {
    const updated = activeWarband.denUpgrades.map((d) =>
      d.id === id ? { ...d, isNewThisCycle: !d.isNewThisCycle } : d
    );
    await saveWarband({ ...activeWarband, denUpgrades: updated });
  };

  const handleRemoveDenUpgrade = async (id: string) => {
    if (!confirm('Demolish this Den Upgrade?')) return;
    await saveWarband({
      ...activeWarband,
      denUpgrades: activeWarband.denUpgrades.filter((d) => d.id !== id),
    });
  };

  // Buy directly to Den Stash
  const handleBuyToStash = async (e: React.FormEvent) => {
    e.preventDefault();
    const eq = rules.equipment.find((x) => x.id === stashEqId);
    if (!eq) return;

    if (isWeaponUpgradeEquipment(eq)) {
      const eligibleWarbandWeapons = activeWarband.inventory.filter((item) => {
        const wEq = rules.equipment.find((x) => x.id === item.equipmentId);
        return isEligibleWeaponForUpgrade(item, wEq, eq.id);
      });
      const targetWeapon =
        eligibleWarbandWeapons.find((w) => w.instanceId === stashTargetWeaponId) ||
        eligibleWarbandWeapons[0];
      if (!targetWeapon) {
        alert(
          `Your warband has no eligible weapons (in Stash or equipped on fighters) to apply ${eq.name} to. Purchase a weapon first!`
        );
        return;
      }
      const unitCost = getEquipmentCostForAllegiance(eq, allegiance).cost;
      const cost = stashFree ? 0 : unitCost;
      if (cost > activeWarband.treasuryPennies) {
        alert(`Insufficient Pennies (${activeWarband.treasuryPennies}p in Treasury).`);
        return;
      }
      const targetWeaponEq = rules.equipment.find(
        (x) => x.id === targetWeapon.equipmentId
      );
      const targetWeaponLabel = formatItemDisplayName(targetWeapon, targetWeaponEq);
      const upgradedWeapon = applyWeaponUpgradeToItem(
        targetWeapon,
        eq.id,
        unitCost
      );
      if (stashCustomName.trim()) {
        upgradedWeapon.customName = stashCustomName.trim();
      }
      const nextInventory = activeWarband.inventory.map((i) =>
        i.instanceId === targetWeapon.instanceId ? upgradedWeapon : i
      );
      const newBalance = activeWarband.treasuryPennies - cost;
      await saveWarband({
        ...activeWarband,
        treasuryPennies: newBalance,
        inventory: nextInventory,
        treasuryLog:
          cost > 0
            ? [
                {
                  id: crypto.randomUUID(),
                  date: new Date().toISOString().slice(0, 10),
                  deltaPennies: -cost,
                  reason: `Purchased ${eq.name} and applied to ${targetWeaponLabel}`,
                  balanceAfter: newBalance,
                },
                ...activeWarband.treasuryLog,
              ]
            : activeWarband.treasuryLog,
      });
      setStashCustomName('');
      return;
    }

    const stackable = isEquipmentStackable(eq);
    const qty = stackable ? Math.max(1, Math.min(99, stashQuantity || 1)) : 1;
    const unitCost = getEquipmentCostForAllegiance(eq, allegiance).cost;
    const totalValueCost = unitCost * qty;
    const cost = stashFree ? 0 : totalValueCost;
    if (cost > activeWarband.treasuryPennies) {
      alert(`Insufficient Pennies (${activeWarband.treasuryPennies}p in Treasury).`);
      return;
    }

    const existingInStash =
      stackable && !stashCustomName.trim()
        ? activeWarband.inventory.find(
            (i) =>
              i.assignedFighterId === null &&
              i.equipmentId === eq.id &&
              !i.isConsumed &&
              !i.customName
          )
        : undefined;

    let nextInventory: EquippedOrStashedItem[];
    if (existingInStash) {
      const mergedQty = getItemQuantity(existingInStash) + qty;
      nextInventory = activeWarband.inventory.map((i) =>
        i.instanceId === existingInStash.instanceId
          ? {
              ...i,
              quantity: mergedQty,
              purchaseCost: i.purchaseCost + totalValueCost,
            }
          : i
      );
    } else {
      const newItem: EquippedOrStashedItem = {
        instanceId: crypto.randomUUID(),
        equipmentId: eq.id,
        assignedFighterId: null,
        slot: eq.defaultSlot,
        purchaseCost: totalValueCost,
        quantity: stackable ? qty : undefined,
        customName: stashCustomName.trim() || undefined,
      };
      nextInventory = [...activeWarband.inventory, newItem];
    }

    const newBalance = activeWarband.treasuryPennies - cost;
    await saveWarband({
      ...activeWarband,
      treasuryPennies: newBalance,
      inventory: nextInventory,
      treasuryLog:
        cost > 0
          ? [
              {
                id: crypto.randomUUID(),
                date: new Date().toISOString().slice(0, 10),
                deltaPennies: -cost,
                reason: `Bought ${qty > 1 ? `${qty}x ` : ''}${eq.name} into Den Stash`,
                balanceAfter: newBalance,
              },
              ...activeWarband.treasuryLog,
            ]
          : activeWarband.treasuryLog,
    });
    setStashCustomName('');
    setStashQuantity(1);
  };

  const handleEquipFromStash = async (instanceId: string, fighterId: string) => {
    if (!fighterId) return;
    const itemToMove = activeWarband.inventory.find((i) => i.instanceId === instanceId);
    const targetFighter = activeWarband.fighters.find((f) => f.id === fighterId);
    if (!itemToMove || !targetFighter) return;

    const eq = rules.equipment.find((e) => e.id === itemToMove.equipmentId);
    let nextSlot = itemToMove.slot;
    if (eq) {
      const validation = validateEquipmentForFighter(
        eq,
        targetFighter,
        activeWarband,
        rules
      );
      if (!validation.valid) {
        alert(
          `Cannot equip ${formatItemDisplayName(itemToMove, eq)} on ${targetFighter.name}: ${validation.reason}\n\n(Use the "Outfit Gear" modal on the Warband Roster tab if you wish to override equipment restrictions.)`
        );
        return;
      }
      if (validation.suggestedSlot) {
        nextSlot = validation.suggestedSlot;
      }

      if (isEquipmentStackable(eq)) {
        const existingOnFighter = activeWarband.inventory.find(
          (i) =>
            i.instanceId !== instanceId &&
            i.assignedFighterId === fighterId &&
            i.equipmentId === eq.id &&
            !i.isConsumed
        );
        if (existingOnFighter) {
          const mergedQty =
            getItemQuantity(existingOnFighter) + getItemQuantity(itemToMove);
          const mergedCost = existingOnFighter.purchaseCost + itemToMove.purchaseCost;
          const updatedInv = activeWarband.inventory
            .filter((i) => i.instanceId !== instanceId)
            .map((i) =>
              i.instanceId === existingOnFighter.instanceId
                ? { ...i, quantity: mergedQty, purchaseCost: mergedCost }
                : i
            );
          await saveWarband({ ...activeWarband, inventory: updatedInv });
          return;
        }
      }
    }

    const updated = activeWarband.inventory.map((i) =>
      i.instanceId === instanceId
        ? { ...i, assignedFighterId: fighterId, slot: nextSlot }
        : i
    );
    await saveWarband({ ...activeWarband, inventory: updated });
  };

  const handleStartEditDenName = () => {
    setDenNameInput(activeWarband.denName);
    setIsEditingDenName(true);
  };

  const handleSaveDenName = async () => {
    const trimmed = denNameInput.trim();
    if (trimmed) {
      await saveWarband({
        ...activeWarband,
        denName: trimmed,
      });
    }
    setIsEditingDenName(false);
  };

  const getStashedItemSellPrice = (item: EquippedOrStashedItem): number => {
    const hasFence = activeWarband.denUpgrades.some(
      (d) => d.upgradeId === 'den-fences-contact'
    );
    if (!overrideStashSellPrice) {
      return Math.max(1, Math.floor(item.purchaseCost * (hasFence ? 0.75 : 0.5)));
    }
    if (stashSellOverrideMode === 'full') {
      return item.purchaseCost;
    }
    return Math.max(0, Math.floor(Number(customStashSellAmount) || 0));
  };

  const handleSellStashedItem = async (item: EquippedOrStashedItem) => {
    const eq = rules.equipment.find((e) => e.id === item.equipmentId);
    const sellPrice = getStashedItemSellPrice(item);
    const displayName = formatItemDisplayName(item, eq);
    const priceLabel = !overrideStashSellPrice
      ? `${sellPrice} Pennies`
      : stashSellOverrideMode === 'full'
      ? `${sellPrice} Pennies (Full Price Refund)`
      : `${sellPrice} Pennies (Custom Override Price)`;

    if (
      !confirm(
        `Sell ${displayName} from your Den Stash for ${priceLabel}?`
      )
    ) {
      return;
    }

    const newBalance = activeWarband.treasuryPennies + sellPrice;
    await saveWarband({
      ...activeWarband,
      treasuryPennies: newBalance,
      inventory: activeWarband.inventory.filter((i) => i.instanceId !== item.instanceId),
      treasuryLog: [
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          deltaPennies: sellPrice,
          reason: !overrideStashSellPrice
            ? `Sold ${displayName} from Den Stash`
            : stashSellOverrideMode === 'full'
            ? `Sold ${displayName} from Den Stash (Full Value Refund)`
            : `Sold ${displayName} from Den Stash (Custom Price Override)`,
          balanceAfter: newBalance,
        },
        ...activeWarband.treasuryLog,
      ],
    });
  };

  const handleAdjustTreasury = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pennyDelta) return;
    const newBalance = Math.max(0, activeWarband.treasuryPennies + Number(pennyDelta));
    await saveWarband({
      ...activeWarband,
      treasuryPennies: newBalance,
      treasuryLog: [
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          deltaPennies: Number(pennyDelta),
          reason: pennyReason.trim() || 'Treasury Adjustment',
          balanceAfter: newBalance,
        },
        ...activeWarband.treasuryLog,
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Den Header & 12-Slot Upgrade Grid */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-amber-400 font-serif flex flex-wrap items-center gap-2">
              <Home className="w-5 h-5 shrink-0" />
              {isEditingDenName ? (
                <span className="inline-flex items-center gap-1.5 font-sans">
                  <input
                    type="text"
                    value={denNameInput}
                    onChange={(e) => setDenNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveDenName();
                      if (e.key === 'Escape') setIsEditingDenName(false);
                    }}
                    placeholder="Den Name..."
                    autoFocus
                    className="bg-stone-950 border border-amber-500/70 rounded-lg px-2.5 py-1 text-sm text-stone-100 w-56"
                  />
                  <button
                    type="button"
                    onClick={handleSaveDenName}
                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Save Den Name"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingDenName(false)}
                    className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span>{activeWarband.denName}</span>
                  <button
                    type="button"
                    onClick={handleStartEditDenName}
                    className="px-2 py-0.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-300 text-xs font-sans font-normal flex items-center gap-1 cursor-pointer"
                    title="Rename Starting Den"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Rename</span>
                  </button>
                </span>
              )}
              <span className="text-stone-400 font-normal">— {activeWarband.denType}</span>
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              In Burrows & Badgers 2.0, Den Upgrades are built using Labour & Materials (1 Material = 5p at the General Store) and resolved in Step 9 of the Post-Battle Sequence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl text-xs">
              Slots:{' '}
              <strong className="text-amber-400">
                {activeWarband.denUpgrades.length}/12
              </strong>
            </div>
            <div className="bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
              <span className="text-stone-400">Labour:</span>
              <button
                onClick={() =>
                  saveWarband({
                    ...activeWarband,
                    labour: Math.max(0, (activeWarband.labour ?? 0) - 1),
                  })
                }
                className="px-1 rounded bg-stone-800 text-stone-200 cursor-pointer"
              >
                -
              </button>
              <strong className="text-emerald-400">{activeWarband.labour ?? 0}</strong>
              <button
                onClick={() =>
                  saveWarband({
                    ...activeWarband,
                    labour: (activeWarband.labour ?? 0) + 1,
                  })
                }
                className="px-1 rounded bg-stone-800 text-stone-200 cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
              <span className="text-stone-400">Materials:</span>
              <button
                onClick={() =>
                  saveWarband({
                    ...activeWarband,
                    materials: Math.max(0, (activeWarband.materials ?? 0) - 1),
                  })
                }
                className="px-1 rounded bg-stone-800 text-stone-200 cursor-pointer"
              >
                -
              </button>
              <strong className="text-amber-300">{activeWarband.materials ?? 0}</strong>
              <button
                onClick={() =>
                  saveWarband({
                    ...activeWarband,
                    materials: (activeWarband.materials ?? 0) + 1,
                  })
                }
                className="px-1 rounded bg-stone-800 text-stone-200 cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
              <span className="text-stone-400">Pensions:</span>
              <button
                onClick={() =>
                  saveWarband({
                    ...activeWarband,
                    pensions: Math.max(0, (activeWarband.pensions ?? 0) - 1),
                  })
                }
                className="px-1 rounded bg-stone-800 text-stone-200 cursor-pointer"
              >
                -
              </button>
              <strong className="text-red-400">{activeWarband.pensions ?? 0}p</strong>
              <button
                onClick={() =>
                  saveWarband({
                    ...activeWarband,
                    pensions: (activeWarband.pensions ?? 0) + 1,
                  })
                }
                className="px-1 rounded bg-stone-800 text-stone-200 cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-xl text-xs">
              Treasury:{' '}
              <strong className="text-amber-400">{activeWarband.treasuryPennies}p</strong>
            </div>
          </div>
        </div>

        {/* Construct New Den Upgrade Form */}
        <form
          onSubmit={handleConstructUpgrade}
          className="bg-stone-950 border border-stone-800 rounded-xl p-4 flex flex-col md:flex-row md:items-end gap-3"
        >
          <div className="flex-1">
            <label className="block text-xs font-semibold text-amber-300 mb-1">
              Construct New Den Upgrade (Step 9 Post-Battle)
            </label>
            <select
              value={selectedUpgradeId}
              onChange={(e) => setSelectedUpgradeId(e.target.value)}
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
            >
              {sortedDenUpgrades.map((du) => (
                <option key={du.id} value={du.id}>
                  {du.name} ({du.labourCost ?? 8} Labour, {du.materialsCost ?? 2} Materials /{' '}
                  {du.cost}p) — {du.postGameBenefit}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-300 pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={freeUpgrade}
              onChange={(e) => setFreeUpgrade(e.target.checked)}
            />
            Paid via Labour & Materials Pool (0p from Treasury)
          </label>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer shrink-0"
          >
            + Build Den Upgrade
          </button>
        </form>

        {/* Active Den Upgrades (12 Slots Visualization) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeWarband.denUpgrades.map((inst, index) => {
            const ref = rules.denUpgrades.find((d) => d.id === inst.upgradeId);
            return (
              <div
                key={inst.id}
                className="bg-stone-950 border border-stone-800 rounded-xl p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-stone-800 text-stone-400">
                      Slot #{index + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleUpgradeActive(inst.id)}
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold cursor-pointer ${
                          inst.isNewThisCycle
                            ? 'bg-amber-950 text-amber-300 border border-amber-700'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                        title="Click to toggle whether this upgrade was just bought this post-game sequence"
                      >
                        {inst.isNewThisCycle ? 'Newly Built (Activates Next Game)' : 'Active (Step 9 Ready)'}
                      </button>
                      <button
                        onClick={() => handleRemoveDenUpgrade(inst.id)}
                        className="text-stone-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-stone-100 text-sm mt-2">
                    {ref?.name || inst.upgradeId}
                  </h4>
                  <p className="text-xs text-stone-400 mt-1">{ref?.effectSummary}</p>
                </div>
                <div className="bg-stone-900/90 border border-stone-800/80 rounded-lg p-2.5 text-xs text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                  {ref?.postGameBenefit}
                </div>
              </div>
            );
          })}

          {/* Empty Slot Placeholders up to 12 */}
          {Array.from({
            length: Math.max(0, 12 - activeWarband.denUpgrades.length),
          }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="border border-dashed border-stone-800/70 rounded-xl p-4 flex items-center justify-center text-xs text-stone-600"
            >
              Empty Den Slot #{activeWarband.denUpgrades.length + idx + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Den Stash & Trading Post + Treasury Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Den Stash */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-amber-400 font-serif flex items-center gap-2">
              <Package className="w-5 h-5" />
              Den Stash & Trading Post ({stashedItems.length} Stashed)
            </h3>
          </div>

          <form
            onSubmit={handleBuyToStash}
            className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 space-y-3"
          >
            <div className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
              Buy Equipment or Rare Loot into Den Stash
            </div>
            <select
              value={stashEqId}
              onChange={(e) => {
                setStashEqId(e.target.value);
                setStashQuantity(1);
              }}
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
            >
              {allegianceRareEquipmentList.length > 0 && (
                <optgroup
                  label={`★ ${allegiance?.name || 'Allegiance'} Starting Rare Equipment`}
                >
                  {allegianceRareEquipmentList.map((eq) => {
                    const priceInfo = getEquipmentCostForAllegiance(eq, allegiance);
                    return (
                      <option key={`stash-alg-${eq.id}`} value={eq.id}>
                        ★ {eq.name} — {priceInfo.cost}p ({eq.category} / {allegiance?.name} Rare)
                      </option>
                    );
                  })}
                </optgroup>
              )}
              <optgroup label="Common Equipment (General Store)">
                {sortedEquipment
                  .filter((eq) => eq.rarity === 'Common')
                  .map((eq) => {
                    const priceInfo = getEquipmentCostForAllegiance(eq, allegiance);
                    return (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} — {priceInfo.cost}p ({eq.category} / Common)
                      </option>
                    );
                  })}
              </optgroup>
              <optgroup label="Campaign Rare & Relic Equipment">
                {sortedEquipment
                  .filter((eq) => eq.rarity !== 'Common' && !allegianceRareIds.has(eq.id))
                  .map((eq) => {
                    const priceInfo = getEquipmentCostForAllegiance(eq, allegiance);
                    return (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} — {priceInfo.cost}p ({eq.category} / {eq.rarity})
                      </option>
                    );
                  })}
              </optgroup>
            </select>
            {(() => {
              const selectedStashEq = rules.equipment.find((e) => e.id === stashEqId);
              if (!selectedStashEq) return null;

              if (isWeaponUpgradeEquipment(selectedStashEq)) {
                const eligibleWarbandWeapons = activeWarband.inventory.filter((item) => {
                  const wEq = rules.equipment.find((x) => x.id === item.equipmentId);
                  return isEligibleWeaponForUpgrade(item, wEq, selectedStashEq.id);
                });
                const effectiveTargetId =
                  eligibleWarbandWeapons.find(
                    (w) => w.instanceId === stashTargetWeaponId
                  )?.instanceId ||
                  eligibleWarbandWeapons[0]?.instanceId ||
                  '';
                return (
                  <div className="bg-amber-950/30 border border-amber-700/60 rounded-lg px-3 py-2 space-y-1.5 text-xs">
                    <label className="block font-semibold text-amber-300">
                      Select Weapon to Apply {selectedStashEq.name} To:
                    </label>
                    <select
                      value={effectiveTargetId}
                      onChange={(e) => setStashTargetWeaponId(e.target.value)}
                      disabled={eligibleWarbandWeapons.length === 0}
                      className="w-full bg-stone-900 border border-amber-600/70 rounded-lg px-2.5 py-1.5 text-xs text-amber-200"
                    >
                      {eligibleWarbandWeapons.length === 0 ? (
                        <option value="">
                          No eligible weapons in Warband or Stash...
                        </option>
                      ) : (
                        eligibleWarbandWeapons.map((wItem) => {
                          const wEq = rules.equipment.find(
                            (x) => x.id === wItem.equipmentId
                          );
                          const owner = wItem.assignedFighterId
                            ? activeWarband.fighters.find(
                                (f) => f.id === wItem.assignedFighterId
                              )
                            : null;
                          return (
                            <option key={wItem.instanceId} value={wItem.instanceId}>
                              {formatItemDisplayName(wItem, wEq)} —{' '}
                              {owner ? `Equipped on ${owner.name}` : 'In Den Stash'}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                );
              }

              if (!isEquipmentStackable(selectedStashEq)) return null;
              const unitCost = getEquipmentCostForAllegiance(selectedStashEq, allegiance).cost;
              return (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-950/30 border border-emerald-800/50 rounded-lg px-3 py-2 text-xs">
                  <span className="text-emerald-300 font-semibold">
                    Stackable Consumable (Total:{' '}
                    {stashFree ? 0 : unitCost * stashQuantity}p)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-400">Qty:</span>
                    <button
                      type="button"
                      onClick={() => setStashQuantity((q) => Math.max(1, q - 1))}
                      className="px-2 py-0.5 rounded bg-stone-800 text-stone-200 font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={stashQuantity}
                      onChange={(e) =>
                        setStashQuantity(
                          Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1))
                        )
                      }
                      className="w-12 bg-stone-900 border border-stone-700 rounded px-1.5 py-0.5 text-center font-mono font-bold text-amber-300"
                    />
                    <button
                      type="button"
                      onClick={() => setStashQuantity((q) => Math.min(99, q + 1))}
                      className="px-2 py-0.5 rounded bg-stone-800 text-stone-200 font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={stashCustomName}
                onChange={(e) => setStashCustomName(e.target.value)}
                placeholder="Optional custom label (e.g. Looted Longbow)"
                className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
              />
              <label className="flex items-center gap-1.5 text-xs text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stashFree}
                  onChange={(e) => setStashFree(e.target.checked)}
                />
                Looted / 0p
              </label>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer"
              >
                {isWeaponUpgradeEquipment(
                  rules.equipment.find((e) => e.id === stashEqId)
                )
                  ? '+ Apply Upgrade to Weapon'
                  : '+ Add to Stash'}
              </button>
            </div>
          </form>

          {stashedItems.length === 0 ? (
            <p className="text-xs text-stone-500 italic py-4 text-center">
              Your Den Stash is currently empty. Unequipped weapons, armour, and potions are stored here safely between battles.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Sale Price Override Controls */}
              <div className="bg-stone-950/90 border border-stone-800 rounded-xl p-3 space-y-2 text-xs">
                <label className="flex items-center gap-2 text-amber-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideStashSellPrice}
                    onChange={(e) => setOverrideStashSellPrice(e.target.checked)}
                  />
                  <span>
                    Override sale price when selling from Stash (Full Price or Custom Amount)
                  </span>
                </label>

                {overrideStashSellPrice && (
                  <div className="flex flex-wrap items-center gap-3 pl-5 pt-1 text-[11px] text-stone-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="stashSellOverrideMode"
                        checked={stashSellOverrideMode === 'full'}
                        onChange={() => setStashSellOverrideMode('full')}
                      />
                      <span className="font-semibold text-emerald-300">
                        Full Price (100% Refund)
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="stashSellOverrideMode"
                        checked={stashSellOverrideMode === 'custom'}
                        onChange={() => setStashSellOverrideMode('custom')}
                      />
                      <span className="font-semibold text-amber-300">Custom Price:</span>
                    </label>
                    {stashSellOverrideMode === 'custom' && (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          value={customStashSellAmount}
                          onChange={(e) =>
                            setCustomStashSellAmount(Math.max(0, Number(e.target.value) || 0))
                          }
                          className="w-16 bg-stone-900 border border-amber-600/60 rounded px-2 py-0.5 text-center font-mono font-bold text-amber-300"
                        />
                        <span className="text-stone-400">Pennies</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {stashedItems.map((item) => {
                  const eq = rules.equipment.find((e) => e.id === item.equipmentId);
                  const sellPrice = getStashedItemSellPrice(item);
                  const pageRef = getEquipmentPageReference(eq).replace('Page ', 'p.');
                  return (
                    <div
                      key={item.instanceId}
                      className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <button
                          type="button"
                          onClick={() => setSelectedStashItemId(item.instanceId)}
                          title="Tap to view rules, upgrades & edit custom name"
                          className="font-bold text-amber-200 hover:text-amber-300 hover:underline text-left cursor-pointer"
                        >
                          {formatItemDisplayName(item, eq)}{' '}
                          <span className="text-[10px] font-normal text-stone-400">
                            ({pageRef})
                          </span>
                        </button>{' '}
                        <span className="text-stone-400">
                          ({eq?.category} • Value {item.purchaseCost}p)
                        </span>
                        {eq?.weaponModifiers && (
                          <div className="text-[11px] text-stone-400">{eq.weaponModifiers}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          defaultValue=""
                          onChange={(e) =>
                            handleEquipFromStash(item.instanceId, e.target.value)
                          }
                          className="bg-stone-900 border border-stone-700 rounded-lg px-2 py-1 text-xs text-stone-200"
                        >
                          <option value="" disabled>
                            Give to Fighter...
                          </option>
                          {activeWarband.fighters
                            .filter((f) => f.status !== 'Dead')
                            .map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name} ({f.role})
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => handleSellStashedItem(item)}
                          className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                            overrideStashSellPrice
                              ? 'bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-300 border border-emerald-700/50'
                              : 'bg-stone-800 hover:bg-amber-900/50 text-amber-300'
                          }`}
                        >
                          Sell ({sellPrice}p)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Treasury & Pennies Ledger */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-bold text-amber-400 font-serif flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Warband Treasury & Post-Game Pennies Ledger
          </h3>

          <form
            onSubmit={handleAdjustTreasury}
            className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 space-y-3"
          >
            <div className="text-xs font-semibold text-stone-300">
              Record Scenario Income, Den Earnings, or Upkeep Expense
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-stone-400 mb-1">
                  Pennies (+/-)
                </label>
                <input
                  type="number"
                  value={pennyDelta}
                  onChange={(e) => setPennyDelta(Number(e.target.value))}
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-stone-400 mb-1">Reason</label>
                <input
                  value={pennyReason}
                  onChange={(e) => setPennyReason(e.target.value)}
                  placeholder="e.g. Scenario Spoils + Gambling Den 2D6"
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs cursor-pointer"
              >
                Record Treasury Entry
              </button>
            </div>
          </form>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {activeWarband.treasuryLog.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between bg-stone-950 border border-stone-800/80 rounded-xl px-3.5 py-2 text-xs"
              >
                <div>
                  <div className="font-medium text-stone-200">{tx.reason}</div>
                  <div className="text-[10px] text-stone-500">{tx.date}</div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-bold ${
                      tx.deltaPennies >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {tx.deltaPennies >= 0 ? `+${tx.deltaPennies}p` : `${tx.deltaPennies}p`}
                  </div>
                  <div className="text-[10px] text-stone-500">Bal: {tx.balanceAfter}p</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Equipment Detail & Custom Name Modal for Stashed Items */}
      {selectedStashItemId && (
        <EquipmentDetailModal
          initialItemInstanceId={selectedStashItemId}
          inventory={activeWarband.inventory}
          fighter={null}
          rules={rules}
          onClose={() => setSelectedStashItemId(null)}
          onSaveCustomName={handleSaveItemCustomName}
        />
      )}
    </div>
  );
};
