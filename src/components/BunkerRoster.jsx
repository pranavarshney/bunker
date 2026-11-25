import React, { useState } from 'react';
import { Shield, Lock, DoorOpen, AlertTriangle, Moon, X, HeartPulse, Radio } from 'lucide-react';
import { CHARACTER_MAP } from '../data/characters.js';
import { MAX_RESIDENTS, getBunkerCapabilities } from '../engine/gameEngine.js';
import PortraitCanvas from './PortraitCanvas.jsx';
import { soundEngine } from '../utils/soundEngine.js';

export default function BunkerRoster({
  state,
  mode = 'night', // 'night' | 'drawer'
  onToggleQuarantine,
  onExpel,
  onChangeRationMode,
  onConfirmSleep,
  onCloseDrawer,
}) {
  const [confirmExpelId, setConfirmExpelId] = useState(null);
  const caps = getBunkerCapabilities(state);
  const half = state.rationMode === 'HALF';
  const foodNeed =
    1 + (half ? Math.floor(state.residents.length * 0.3) : Math.ceil(state.residents.length * 0.4));
  const waterNeed =
    1 + (half ? Math.floor(state.residents.length * 0.3) : Math.ceil(state.residents.length * 0.4));
  const fuelNeed = state.residents.length >= 4 ? 2 : 1;

  const isDrawer = mode === 'drawer';

  return (
    <div
      className={
        isDrawer
          ? 'fixed inset-0 z-50 bg-black/75 flex justify-end'
          : 'w-full max-w-6xl mx-auto px-4 sm:px-6 py-6'
      }
    >
      <div
        className={
          isDrawer
            ? 'w-full max-w-xl h-full bg-[#121916] border-l border-[#2f4238] flex flex-col overflow-hidden'
            : 'steel-panel rounded-sm p-5 sm:p-6'
        }
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between gap-4 pb-4 border-b border-[#2b3c33] ${
            isDrawer ? 'px-5 pt-5' : ''
          }`}
        >
          <div>
            <h2 className="font-display text-2xl tracking-wide text-[#e2ece5] uppercase">
              {isDrawer ? 'Bunker Dormitory Roster' : `Day ${state.day} — Night Lockdown & Dormitory`}
            </h2>
            <p className="text-xs font-tech text-[#8ea597] mt-1 tabular-nums">
              Occupants: {state.residents.length} / {MAX_RESIDENTS} · Active Guards: {caps.defenseCount} · Medics: {caps.healerCount}
            </p>
          </div>
          {isDrawer && onCloseDrawer && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playButtonClick();
                onCloseDrawer();
              }}
              className="px-3 py-2 text-xs font-tech bg-[#1c2822] hover:bg-[#26362e] border border-[#3a4f44] text-[#d6e3da] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          )}
        </div>

        {/* Active Bunker Systems Summary */}
        <div
          className={`py-3 border-b border-[#24332b] flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-tech text-[#9fb5a7] ${
            isDrawer ? 'px-5' : ''
          }`}
        >
          <span>
            Geiger Probe: {caps.geigerCalibrated ? 'CALIBRATED (Dr. Chernysheva)' : 'Standard Analog'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Bio/Comms Alert: {caps.mimicDetector ? 'ACTIVE' : 'None'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Extraction Beacon: {caps.extractionBoost ? 'ENHANCED' : 'Standard Hatch'}
          </span>
        </div>

        {/* Resident List */}
        <div className={`flex-1 overflow-y-auto py-5 ${isDrawer ? 'px-5' : ''}`}>
          {state.residents.length === 0 ? (
            <div className="py-12 px-6 text-center border border-dashed border-[#2f4238] bg-[#0e1411]">
              <p className="font-display text-lg uppercase tracking-wide text-[#b5c7bc]">
                All Six Bunks Are Empty
              </p>
              <p className="text-sm text-[#8a9e91] mt-2 max-w-md mx-auto">
                Shelter B-04 is completely silent. Remember: Convoy Iron-4 will not extract a single isolated survivor on Day 10 without living occupants or an override beacon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {state.residents.map((res) => {
                const char = CHARACTER_MAP[res.id];
                if (!char) return null;
                const isQuarantined = state.quarantinedId === res.id;
                const isSuspicious = res.health === 'SUSPICIOUS' || res.health === 'RAD_SICK';
                const confirmingExpel = confirmExpelId === res.id;

                return (
                  <div
                    key={res.id}
                    className={`p-4 border transition-colors ${
                      isQuarantined
                        ? 'bg-[#1f1c14] border-[#b07b2e]'
                        : isSuspicious
                        ? 'bg-[#211414] border-[#9e3333]'
                        : 'bg-[#121a16] border-[#2c3d34]'
                    }`}
                  >
                    <div className="flex gap-3.5 items-start">
                      <div className="w-16 h-16 shrink-0 border border-[#364a3f] overflow-hidden">
                        <PortraitCanvas character={char} compact />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-display text-base tracking-wide text-[#e6efe9] truncate">
                            {char.name}
                          </h3>
                          <span className="font-tech text-[11px] text-[#8da396] whitespace-nowrap shrink-0 tabular-nums">
                            Day {res.dayAdmitted}
                          </span>
                        </div>
                        <p className="text-xs font-tech text-[#90a699] mt-0.5">
                          Age {char.age} · {char.archetype}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs font-tech">
                          <HeartPulse className="w-3.5 h-3.5 text-[#7ba88d] shrink-0" />
                          <span
                            className={
                              isSuspicious
                                ? 'text-[#f28585]'
                                : isQuarantined
                                ? 'text-[#e8b45a]'
                                : 'text-[#9bd4ae]'
                            }
                          >
                            {isQuarantined
                              ? 'QUARANTINED IN ALCOVE'
                              : res.health === 'SUSPICIOUS'
                              ? 'ANOMALY DETECTED'
                              : res.health === 'RAD_SICK'
                              ? 'SEVERE FEVER / COUGHING ASH'
                              : res.health === 'WOUNDED'
                              ? 'WOUNDED — STABILIZED'
                              : 'STABLE'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Claimed Role & Overnight Observation */}
                    <div className="mt-3 pt-3 border-t border-[#24332b] space-y-1.5 text-xs">
                      <p className="text-[#b8cabe]">
                        <span className="font-tech text-[#7d9486]">Role: </span>
                        {char.friendlyData.perkText}
                      </p>
                      {res.observedNote && (
                        <p className="text-[#f0b367] flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{res.observedNote}</span>
                        </p>
                      )}
                    </div>

                    {/* Actions (Available in Night Mode or Emergency Expel) */}
                    {!isDrawer && (
                      <div className="mt-3.5 pt-3 border-t border-[#24332b] flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playButtonClick();
                            onToggleQuarantine(res.id);
                          }}
                          className={`px-3 py-1.5 text-xs font-tech border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            isQuarantined
                              ? 'bg-[#3d2e14] border-[#d99b38] text-[#fae0b0]'
                              : 'bg-[#19241e] hover:bg-[#223129] border-[#384d42] text-[#cedcd3]'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          {isQuarantined ? 'Release Alcove' : 'Quarantine Tonight'}
                        </button>

                        {!confirmingExpel ? (
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playButtonClick();
                              setConfirmExpelId(res.id);
                            }}
                            className="px-3 py-1.5 text-xs font-tech bg-[#261616] hover:bg-[#381d1d] border border-[#6e3232] text-[#eba8a8] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <DoorOpen className="w-3.5 h-3.5" />
                            Expel
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playDenySlam();
                                onExpel(res.id);
                                setConfirmExpelId(null);
                              }}
                              className="px-3 py-1.5 text-xs font-tech bg-[#8f2424] hover:bg-[#a82b2b] text-white whitespace-nowrap cursor-pointer"
                            >
                              Confirm Expel
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmExpelId(null)}
                              className="px-2.5 py-1.5 text-xs font-tech bg-[#1c2621] text-[#b4c4ba] whitespace-nowrap cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Night Lockdown Footer Controls */}
        {!isDrawer && (
          <div className="pt-5 border-t border-[#2b3c33] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-tech text-xs text-[#91a89a] mr-1">Rationing Policy:</span>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playButtonClick();
                    onChangeRationMode('NORMAL');
                  }}
                  className={`px-3 py-1.5 text-xs font-tech border cursor-pointer whitespace-nowrap ${
                    !half
                      ? 'bg-[#263d30] border-[#64a87e] text-[#e5f5ea]'
                      : 'bg-[#141d19] border-[#2e4036] text-[#90a699]'
                  }`}
                >
                  Standard Rations
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playButtonClick();
                    onChangeRationMode('HALF');
                  }}
                  className={`px-3 py-1.5 text-xs font-tech border cursor-pointer whitespace-nowrap ${
                    half
                      ? 'bg-[#3d2d16] border-[#d99536] text-[#fae1b8]'
                      : 'bg-[#141d19] border-[#2e4036] text-[#90a699]'
                  }`}
                >
                  Half Rations (-6 Sanity)
                </button>
              </div>
              <p className="text-xs font-tech text-[#8fa698] tabular-nums">
                Projected Overnight Use: -{foodNeed} Food · -{waterNeed} Water · -{fuelNeed} Diesel
                {state.quarantinedId ? ' · Quarantine Alcove Active (-3 Sanity, blocks target attack & tests subject)' : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playAdmitDoor();
                onConfirmSleep();
              }}
              className="px-6 py-3 bg-[#c77424] hover:bg-[#db822c] text-[#0e120f] font-display text-base uppercase tracking-wider font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Moon className="w-4 h-4" />
              Seal Bulkhead & End Day {state.day}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
