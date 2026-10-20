import React, { useEffect, useState } from 'react';
import {
  EquipmentRef,
  EquippedOrStashedItem,
  Fighter,
  RulesDataset,
} from '../types/game';
import {
  formatItemDisplayName,
  getEffectiveEquipmentType,
  getEffectiveSlotsRequired,
  getEquipmentPageReference,
  getItemQuantity,
  isEquipmentConsumable,
  isEquipmentStackable,
  StatKey,
} from '../utils/gameMath';
import {
  X,
  BookOpen,
  Sword,
  Shield,
  Package,
  Sparkles,
  Dices,
  Pencil,
  Check,
  RotateCcw,
} from 'lucide-react';

interface EquipmentDetailModalProps {
  initialItemInstanceId: string;
  inventory: EquippedOrStashedItem[];
  fighter?: Fighter | null;
  rules: RulesDataset;
  onClose: () => void;
  onSaveCustomName?: (instanceId: string, customName: string) => Promise<void> | void;
  onMoveToStash?: (instanceId: string) => Promise<void> | void;
  onAdjustQuantity?: (item: EquippedOrStashedItem, delta: number) => Promise<void> | void;
  onOpenStatRoller?: (fighter: Fighter, statKey: StatKey) => void;
}

export const EquipmentDetailModal: React.FC<EquipmentDetailModalProps> = ({
  initialItemInstanceId,
  inventory,
  fighter,
  rules,
  onClose,
  onSaveCustomName,
  onMoveToStash,
  onAdjustQuantity,
  onOpenStatRoller,
}) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(
    initialItemInstanceId
  );
  const [customNameInput, setCustomNameInput] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const item = inventory.find((i) => i.instanceId === selectedInstanceId);
  const eq: EquipmentRef | undefined = item
    ? rules.equipment.find((e) => e.id === item.equipmentId)
    : undefined;

  useEffect(() => {
    setCustomNameInput(item?.customName || '');
    setSavedNotice(false);
  }, [selectedInstanceId, item?.customName]);

  if (!item || !eq) return null;

  const species = fighter
    ? rules.species.find((s) => s.id === fighter.speciesId)
    : undefined;
  const eqType = getEffectiveEquipmentType(eq);
  const isMeleeWeapon =
    eq.category === 'One-Handed Weapon' || eq.category === 'Double-Handed Weapon';
  const isRangedWeapon = eq.category === 'Ranged Weapon';
  const isShield = Boolean(eq.isShield || eq.category === 'Shield');
  const isArmour = eqType === 'Armour';
  const stackable = isEquipmentStackable(eq);
  const consumable = isEquipmentConsumable(eq);
  const qty = getItemQuantity(item);
  const slotsRequired = fighter
    ? getEffectiveSlotsRequired(eq, fighter, rules)
    : eq.slotsRequired ?? 1;
  const pageRef = getEquipmentPageReference(eq);

  const fighterEquippedItems = fighter
    ? inventory.filter((i) => i.assignedFighterId === fighter.id && !i.isConsumed)
    : [];

  const hasUpgrades = Boolean(item.isMasterSmithed || item.isMalleusMaleficarum);

  const handleSaveNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveCustomName) return;
    await onSaveCustomName(item.instanceId, customNameInput.trim());
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleClearName = async () => {
    if (!onSaveCustomName) return;
    setCustomNameInput('');
    await onSaveCustomName(item.instanceId, '');
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
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
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                  eqType === 'Weapon'
                    ? 'bg-amber-950/90 text-amber-300 border-amber-700/60'
                    : isArmour
                    ? 'bg-sky-950/90 text-sky-300 border-sky-700/60'
                    : eqType === 'Ingredient'
                    ? 'bg-indigo-950/90 text-indigo-300 border-indigo-700/60'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                }`}
              >
                {eq.category}
              </span>

              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                {eq.rarity}
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <BookOpen className="w-3 h-3 text-amber-400" />
                Rulebook {pageRef}
              </span>
            </div>

            <h3 className="text-lg font-bold text-stone-100 font-serif break-words">
              {formatItemDisplayName(item, eq)}
            </h3>
            {item.customName && (
              <div className="text-xs text-amber-300/90 font-medium">
                Base Type: <span className="text-stone-300">{eq.name}</span>
              </div>
            )}
            <p className="text-xs text-stone-400">
              {fighter ? (
                <>
                  Equipped on{' '}
                  <strong className="text-stone-200">{fighter.name}</strong> (
                  {fighter.role} • {species?.name || 'Beast'}) in{' '}
                  <strong className="text-amber-300">
                    {item.slot}
                    {slotsRequired > 1 ? ' (2 Armour Slots)' : ''}
                  </strong>
                </>
              ) : (
                <>
                  Stored in <strong className="text-emerald-300">Den Stash</strong> (Default
                  Slot: {eq.defaultSlot})
                </>
              )}
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

        {/* Metadata Grid */}
        <div className="grid grid-cols-3 gap-2 text-center bg-stone-950/90 border border-stone-800 rounded-xl p-2.5 text-xs">
          <div className="bg-stone-900/80 rounded-lg p-2 border border-stone-800">
            <div className="text-[10px] uppercase tracking-wider text-stone-400">
              Equipment Slot
            </div>
            <div className="font-bold text-stone-200 mt-0.5">
              {item.slot}
              {slotsRequired > 1 ? ' (2 Slots)' : ''}
            </div>
          </div>

          <div className="bg-stone-900/80 rounded-lg p-2 border border-stone-800">
            <div className="text-[10px] uppercase tracking-wider text-stone-400">
              {isRangedWeapon
                ? 'Weapon Range'
                : eq.armourValue
                ? 'Armour Tough'
                : stackable
                ? 'Stack Carried'
                : 'Equipment Type'}
            </div>
            <div className="font-bold text-amber-300 mt-0.5">
              {isRangedWeapon
                ? eq.range || 'Ranged'
                : eq.armourValue
                ? `Tough (${eq.armourValue})`
                : stackable
                ? `×${qty} in 1 Slot`
                : eqType}
            </div>
          </div>

          <div className="bg-stone-900/80 rounded-lg p-2 border border-stone-800">
            <div className="text-[10px] uppercase tracking-wider text-stone-400">
              Accumulated Value
            </div>
            <div className="font-mono font-bold text-emerald-300 mt-0.5">
              {item.purchaseCost}p
              {hasUpgrades && (
                <span className="text-[10px] text-amber-300 block font-normal">
                  (Incl. Upgrades)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Applied Weapon Upgrades Section */}
        {(eqType === 'Weapon' || hasUpgrades) && (
          <div className="bg-amber-950/25 border border-amber-700/50 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Attached Weapon Upgrades
              </span>
              <span className="text-[10px] font-mono text-amber-400/90">
                Rulebook Page 103
              </span>
            </div>

            {hasUpgrades ? (
              <div className="space-y-2">
                {item.isMasterSmithed && (
                  <div className="bg-stone-950/90 border border-amber-600/50 rounded-lg p-2.5 space-y-0.5">
                    <div className="font-bold text-amber-300 flex items-center justify-between">
                      <span>★ Master-smithed Weapon Upgrade</span>
                      <span className="text-[10px] font-mono text-emerald-300">
                        {isRangedWeapon ? '+1 Ranged Rolls' : '+1 Strike Rolls'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300">
                      Expertly crafted by a master weapon-smith (Page 103): adds{' '}
                      <strong>
                        {isRangedWeapon
                          ? '+1 to Ranged rolls made with this missile weapon'
                          : '+1 to Strike rolls made with this melee weapon'}
                      </strong>
                      .
                    </p>
                  </div>
                )}

                {item.isMalleusMaleficarum && (
                  <div className="bg-stone-950/90 border border-amber-600/50 rounded-lg p-2.5 space-y-0.5">
                    <div className="font-bold text-amber-300 flex items-center justify-between">
                      <span>★ Malleus Maleficarum Weapon Upgrade</span>
                      <span className="text-[10px] font-mono text-emerald-300">
                        Strong (2) vs Mages/Uncanny
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300">
                      Blessed Witch Hunter weapon upgrade (Page 103): grants{' '}
                      <strong>
                        Strong (2) when used against Magic-users or any model with the
                        Uncanny Skill
                      </strong>
                      , in addition to the weapon&apos;s normal rules.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-stone-400 italic">
                No weapon upgrades attached to this weapon yet. (Can be upgraded with{' '}
                <strong className="text-stone-300">Master-smithed</strong> or{' '}
                <strong className="text-stone-300">Malleus Maleficarum</strong> via the Gear
                store.)
              </p>
            )}
          </div>
        )}

        {/* Combat Summary & Official Rulebook Description */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-stone-400 uppercase tracking-wider font-bold">
            <span>Official 2nd Edition Equipment Rules</span>
            <span className="text-amber-400/90 font-mono">{pageRef}</span>
          </div>

          {eq.weaponModifiers && (
            <div className="bg-stone-900 border border-stone-700/80 rounded-lg px-3 py-2 text-xs font-semibold text-amber-300">
              {eq.weaponModifiers}
            </div>
          )}

          <p className="text-sm text-stone-100 leading-relaxed whitespace-pre-line">
            {eq.description}
          </p>

          {eq.postBattlePriceNote && (
            <div className="pt-1 text-[11px] text-stone-400 border-t border-stone-800/80">
              <strong>Post-Battle Trading Post / Rarity:</strong> {eq.postBattlePriceNote}
            </div>
          )}
        </div>

        {/* Custom Equipment / Heirloom Name Editor */}
        {onSaveCustomName && (
          <form
            onSubmit={handleSaveNameSubmit}
            className="bg-stone-950/90 border border-stone-800 rounded-xl p-3.5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-amber-400" />
                Custom Equipment / Heirloom Name
              </label>
              {savedNotice && (
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Saved!
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={customNameInput}
                onChange={(e) => setCustomNameInput(e.target.value)}
                placeholder={`Custom name for ${eq.name}...`}
                className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                Save Name
              </button>
              {item.customName && (
                <button
                  type="button"
                  onClick={handleClearName}
                  className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-red-950/70 text-red-300 text-xs flex items-center gap-1 cursor-pointer shrink-0"
                  title="Reset to default equipment name"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          </form>
        )}

        {/* Interactive Actions Bar (Roll Combat Dice, Consume Stack, or Stash) */}
        {(fighter &&
          onOpenStatRoller &&
          (isMeleeWeapon || isRangedWeapon || isShield)) ||
        (consumable && onAdjustQuantity) ||
        (fighter && onMoveToStash) ? (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-950/80 border border-stone-800 rounded-xl p-3">
            <div className="flex flex-wrap items-center gap-2">
              {fighter && isMeleeWeapon && onOpenStatRoller && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenStatRoller(fighter, 'strike');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer transition shadow"
                  >
                    <Dices className="w-4 h-4" />
                    Roll Strike
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenStatRoller(fighter, 'block');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-700 font-bold text-xs cursor-pointer transition"
                  >
                    <Shield className="w-3.5 h-3.5 text-sky-400" />
                    Roll Block
                  </button>
                </>
              )}

              {fighter && isRangedWeapon && onOpenStatRoller && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenStatRoller(fighter, 'ranged');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer transition shadow"
                >
                  <Dices className="w-4 h-4" />
                  Roll Ranged ({eq.range || 'Shoot'})
                </button>
              )}

              {fighter && isShield && onOpenStatRoller && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenStatRoller(fighter, 'block');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-stone-950 font-bold text-xs cursor-pointer transition shadow"
                >
                  <Dices className="w-4 h-4" />
                  Roll Block
                </button>
              )}

              {consumable && onAdjustQuantity && (
                <div className="flex items-center gap-1.5 bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-1 text-xs">
                  <span className="text-stone-400">
                    {stackable ? `Stack (×${qty}):` : 'Consumable:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAdjustQuantity(item, -1)}
                    className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-[11px] cursor-pointer"
                  >
                    {qty > 1 ? 'Use 1 (-1)' : 'Consume'}
                  </button>
                  {stackable && (
                    <button
                      type="button"
                      onClick={() => onAdjustQuantity(item, 1)}
                      className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-emerald-300 font-bold text-[11px] cursor-pointer"
                    >
                      +1
                    </button>
                  )}
                </div>
              )}
            </div>

            {fighter && onMoveToStash && (
              <button
                type="button"
                onClick={async () => {
                  await onMoveToStash(item.instanceId);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold cursor-pointer"
              >
                Send to Den Stash
              </button>
            )}
          </div>
        ) : null}

        {/* Quick Switcher for All Equipped Gear on this Fighter */}
        {fighter && fighterEquippedItems.length > 1 && (
          <div className="pt-2 border-t border-stone-800 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
              <Sword className="w-3.5 h-3.5 text-amber-400" />
              All Equipped Gear on {fighter.name} (Tap to Switch)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {fighterEquippedItems.map((eqItem) => {
                const ref = rules.equipment.find((e) => e.id === eqItem.equipmentId);
                if (!ref) return null;
                const active = eqItem.instanceId === selectedInstanceId;
                return (
                  <button
                    key={eqItem.instanceId}
                    type="button"
                    onClick={() => setSelectedInstanceId(eqItem.instanceId)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-stone-950 border-amber-300 font-bold'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                    }`}
                  >
                    {formatItemDisplayName(eqItem, ref)}
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
