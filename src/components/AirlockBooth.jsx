import React, { useEffect, useState } from 'react';
import {
  Activity,
  Flashlight,
  Thermometer,
  BookOpen,
  ZoomIn,
  Radio,
  Check,
  X,
  Flame,
  BatteryCharging,
  AlertTriangle,
  Phone,
  Users,
} from 'lucide-react';
import {
  MAX_RESIDENTS,
  TOOL_BATTERY_COST,
  getCurrentBroadcast,
  getCurrentVisitorId,
  getVisitorInspectionData,
} from '../engine/gameEngine.js';
import { GROUP_LABELS } from '../data/characters.js';
import PortraitCanvas from './PortraitCanvas.jsx';
import { soundEngine } from '../utils/soundEngine.js';

export default function AirlockBooth({
  state,
  onSpendBattery,
  onDecision,
  onOpenRoster,
}) {
  const charId = getCurrentVisitorId(state);
  const broadcast = getCurrentBroadcast(state);
  const inspection = getVisitorInspectionData(state, charId);
  const todayList = state.schedule[state.day] || [];

  const [activeTool, setActiveTool] = useState('none');
  const [scannedTools, setScannedTools] = useState({});
  const [askedQuestions, setAskedQuestions] = useState({});
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [knockFlash, setKnockFlash] = useState(true);
  const [showMemo, setShowMemo] = useState(true);

  // Reset per-visitor state & play steel airlock knock when a new visitor steps up
  useEffect(() => {
    setActiveTool('none');
    setScannedTools({});
    setAskedQuestions({});
    setConfirmPurge(false);
    setKnockFlash(true);
    soundEngine.stopGeigerLoop();
    soundEngine.playDoorKnock(3);

    const t = window.setTimeout(() => setKnockFlash(false), 650);
    return () => {
      window.clearTimeout(t);
      soundEngine.stopGeigerLoop();
    };
  }, [charId, state.day]);

  if (!inspection) return null;

  const { character, tools, dialogue, zoomTell, perkAlert } = inspection;
  const bunkerFull = state.residents.length >= MAX_RESIDENTS;
  const lowSanity = state.sanity < 35;

  const handleSelectTool = (toolKey) => {
    if (activeTool === toolKey) {
      setActiveTool('none');
      soundEngine.stopGeigerLoop();
      soundEngine.playButtonClick();
      return;
    }

    const alreadyScanned = Boolean(scannedTools[toolKey]);
    const cost = alreadyScanned ? 0 : TOOL_BATTERY_COST[toolKey] || 0;

    if (cost > state.shiftBattery) {
      soundEngine.playButtonClick();
      return;
    }

    if (cost > 0) {
      onSpendBattery(cost);
    }

    setScannedTools((prev) => ({ ...prev, [toolKey]: true }));
    setActiveTool(toolKey);

    if (toolKey === 'geiger') {
      soundEngine.playGeigerBurst(tools.geiger.cpm);
    } else if (toolKey === 'uv') {
      soundEngine.stopGeigerLoop();
      soundEngine.playUvBuzz();
    } else if (toolKey === 'thermal') {
      soundEngine.stopGeigerLoop();
      soundEngine.playThermalScan();
    } else if (toolKey === 'ledger') {
      soundEngine.stopGeigerLoop();
      soundEngine.playPaperFlip();
    } else {
      soundEngine.stopGeigerLoop();
      soundEngine.playButtonClick();
    }
  };

  const handleAskQuestion = (idx) => {
    const isEerie =
      inspection.actualAlignment === 'hostile' && inspection.threatKind === 'hollow';
    soundEngine.playIntercomClick(isEerie);
    setAskedQuestions((prev) => ({ ...prev, [idx]: true }));
  };

  const handleAction = (decision) => {
    soundEngine.stopGeigerLoop();
    if (decision === 'ADMIT') {
      soundEngine.playAdmitDoor();
    } else if (decision === 'DENY') {
      soundEngine.playDenySlam();
    } else if (decision === 'PURGE') {
      soundEngine.playPurgeAlarm();
    }
    onDecision(decision);
  };

  const geigerPct = Math.min(100, Math.round((tools.geiger.cpm / 260) * 100));

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Feedback strip from previous visitor or morning supply shift */}
      {(state.lastDecisionFeedback || state.dailySupplyBanner) && (
        <div className="px-4 py-2 bg-[#111915] border border-[#2a3b32] flex flex-wrap items-center justify-between gap-2 text-xs font-tech text-[#9db4a6]">
          <span>
            {state.lastDecisionFeedback || `Morning Bulletin: ${state.dailySupplyBanner}`}
          </span>
          <span className="tabular-nums text-[#7e9688]">
            Airlock Queue: Visitor {state.visitorIndex + 1} of {todayList.length}
          </span>
        </div>
      )}

      {/* Main 2-Column Airlock Booth Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ================= LEFT COLUMN: AIRLOCK VIEWPORT & INSTRUMENT OUTPUT (7 COLS) ================= */}
        <div className="lg:col-span-7 space-y-4">
          <div className="steel-panel rounded-sm p-4 sm:p-5">
            {/* Visitor Identity Header */}
            <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 mb-3 border-b border-[#283830]">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-[#e6efe9] uppercase leading-tight">
                  {character.name}
                </h2>
                <p className="text-xs font-tech text-[#90a699] mt-1">
                  Age {character.age} · {character.archetype} · {GROUP_LABELS[character.group]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSelectTool('zoom')}
                disabled={!scannedTools.zoom && state.shiftBattery < TOOL_BATTERY_COST.zoom}
                className={`px-3 py-1.5 text-xs font-tech border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeTool === 'zoom'
                    ? 'bg-[#2a3f34] border-[#6ee787] text-[#e6f7ea]'
                    : 'bg-[#121a16] hover:bg-[#1d2a23] border-[#33473d] text-[#c4d6cb]'
                }`}
              >
                <ZoomIn className="w-3.5 h-3.5" />
                Optical Zoom ({scannedTools.zoom ? 'FREE' : `-${TOOL_BATTERY_COST.zoom}%`})
              </button>
            </div>

            {/* Reinforced Airlock Window Canvas */}
            <div className="relative">
              <PortraitCanvas
                character={character}
                inspectionData={inspection}
                activeTool={activeTool}
                lowSanity={lowSanity}
              />
              {knockFlash && (
                <div className="pointer-events-none absolute inset-0 bg-[#d9822b]/12 flex items-end justify-center pb-5 transition-opacity">
                  <span className="px-3 py-1 bg-[#0a0f0c]/90 border border-[#d9822b]/70 font-tech text-xs tracking-widest text-[#f3be7a] uppercase">
                    Heavy Knocking At Airlock Glass...
                  </span>
                </div>
              )}
            </div>

            {/* Resident Bio-Sensor / Perk Alert if applicable */}
            {perkAlert && (
              <div className="mt-3 px-3.5 py-2.5 bg-[#241b11] border border-[#b57b2a] text-xs font-tech text-[#f2c885] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#e69a32]" />
                <span>{perkAlert}</span>
              </div>
            )}

            {/* Low Sanity Self-Doubt Warning */}
            {lowSanity && (
              <div className="mt-3 px-3.5 py-2 bg-[#231416] border border-[#8c3239] text-xs font-tech text-[#ebb0b5]">
                Exhaustion Warning: Warden sanity is critically low ({state.sanity}%). Visual or sensor glitches possible—cross-check multiple tools.
              </div>
            )}

            {/* Active Instrument Readout Panel */}
            <div className="mt-4 p-4 bg-[#0d1310] border border-[#283830] min-h-[138px]">
              {activeTool === 'none' && (
                <div className="h-full flex flex-col justify-center">
                  <p className="font-tech text-xs uppercase tracking-wider text-[#7f9789]">
                    Airlock Sensor Standby
                  </p>
                  <p className="text-sm text-[#b9cbc0] mt-1.5 leading-relaxed">
                    Select an inspection instrument on the right console—or toggle Optical Zoom—to examine {character.name} behind the fogged glass. Re-checking an already-scanned tool on this visitor costs zero battery.
                  </p>
                </div>
              )}

              {activeTool === 'geiger' && (
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-tech text-xs uppercase tracking-wider text-[#8fa899]">
                      DP-5V Geiger-Müller Counter
                    </span>
                    <span
                      className={`font-tech text-sm tabular-nums ${
                        tools.geiger.cpm === 0 || tools.geiger.cpm > 120
                          ? 'text-[#f27979]'
                          : 'text-[#7ae096]'
                      }`}
                    >
                      {tools.geiger.cpm} CPM · {tools.geiger.status}
                    </span>
                  </div>
                  {/* Analog needle bar */}
                  <div className="w-full h-3 bg-[#17211c] border border-[#304239] relative overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${Math.max(2, geigerPct)}%`,
                        backgroundColor:
                          tools.geiger.cpm === 0
                            ? '#566473'
                            : tools.geiger.cpm > 120
                            ? '#dc2626'
                            : '#5bbd78',
                      }}
                    />
                  </div>
                  <p className="text-sm text-[#d4e2d9] leading-relaxed">{tools.geiger.note}</p>
                </div>
              )}

              {activeTool === 'uv' && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-tech text-xs uppercase tracking-wider text-[#c49cf2]">
                      UV-365nm Penlight Examination
                    </span>
                    <span className="font-tech text-xs text-[#b58ee6]">
                      {tools.uv.glitched
                        ? 'SIGNAL UNSTABLE'
                        : tools.uv.visualFlag === 'normal' || tools.uv.visualFlag === 'goggles_ok'
                        ? 'PUPIL RESPONSE NORMAL'
                        : 'ANOMALY OBSERVED'}
                    </span>
                  </div>
                  <p className="text-sm text-[#dfd7eb] leading-relaxed">{tools.uv.note}</p>
                </div>
              )}

              {activeTool === 'thermal' && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-tech text-xs uppercase tracking-wider text-[#e8a354]">
                      Soviet FLIR Thermal Scan
                    </span>
                    <span
                      className={`font-tech text-sm tabular-nums ${
                        tools.thermal.tempC < 28 ? 'text-[#6db2f2]' : 'text-[#f0a24a]'
                      }`}
                    >
                      {tools.thermal.tempC.toFixed(1)}°C · {tools.thermal.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#e0d8cc] leading-relaxed">{tools.thermal.note}</p>
                </div>
              )}

              {activeTool === 'zoom' && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-tech text-xs uppercase tracking-wider text-[#8fa899]">
                      1.4x Optical Viewport Inspection
                    </span>
                    <span className="font-tech text-xs text-[#9fb8a9]">CLOSE OBSERVATION</span>
                  </div>
                  <p className="text-sm text-[#d9e5dd] leading-relaxed">{zoomTell}</p>
                </div>
              )}

              {activeTool === 'ledger' && (
                <div className="paper-ledger p-3.5 rounded-[2px] border border-[#9e967e] text-[#1c211b]">
                  <div className="flex items-baseline justify-between gap-2 border-b border-[#877f6a] pb-1.5 mb-2">
                    <span className="font-tech text-xs uppercase tracking-wider font-bold">
                      Sector 44 Civil Registry Ledger
                    </span>
                    <span
                      className={`font-tech text-xs font-bold ${
                        tools.ledger.valid ? 'text-[#1c5c2e]' : 'text-[#8c1d1d]'
                      }`}
                    >
                      {tools.ledger.valid ? 'RECORD VERIFIED' : 'DISCREPANCY FLAGGED'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-tech mb-2">
                    <div>
                      <span className="text-[#565e53] block text-[10px]">ID TAG</span>
                      <span className="font-bold">{tools.ledger.idTag}</span>
                    </div>
                    <div>
                      <span className="text-[#565e53] block text-[10px]">STATION</span>
                      <span className="font-bold">{tools.ledger.station}</span>
                    </div>
                    <div>
                      <span className="text-[#565e53] block text-[10px]">CODE</span>
                      <span className="font-bold">{tools.ledger.code}</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed font-typewriter">{tools.ledger.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: TOOLS, INTERCOM & DECISIONS (5 COLS) ================= */}
        <div className="lg:col-span-5 space-y-4">
          {/* Inspection Instruments + Shift Battery Panel */}
          <div className="steel-panel rounded-sm p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-tech text-xs uppercase tracking-wider text-[#9db4a6] flex items-center gap-1.5">
                <BatteryCharging className="w-4 h-4 text-[#d9822b]" />
                Shift Battery Bank
              </span>
              <span
                className={`font-tech text-sm tabular-nums ${
                  state.shiftBattery <= 20 ? 'text-[#f27979]' : 'text-[#d8e6dd]'
                }`}
              >
                {state.shiftBattery}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#0c120f] border border-[#2a3b32] overflow-hidden">
              <div
                className="h-full transition-all duration-200"
                style={{
                  width: `${state.shiftBattery}%`,
                  backgroundColor:
                    state.shiftBattery <= 20
                      ? '#dc2626'
                      : state.shiftBattery <= 45
                      ? '#d9822b'
                      : '#5bbd78',
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {[
                { key: 'geiger', label: 'Geiger Counter', icon: Activity, accent: 'border-[#5bbd78]' },
                { key: 'uv', label: 'UV Penlight', icon: Flashlight, accent: 'border-[#a855f7]' },
                { key: 'thermal', label: 'Thermal Scanner', icon: Thermometer, accent: 'border-[#d9822b]' },
                { key: 'ledger', label: 'Paper Ledger', icon: BookOpen, accent: 'border-[#c4ba9b]' },
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = activeTool === t.key;
                const scanned = Boolean(scannedTools[t.key]);
                const cost = scanned ? 0 : TOOL_BATTERY_COST[t.key];
                const disabled = !scanned && cost > state.shiftBattery;

                return (
                  <button
                    key={t.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelectTool(t.key)}
                    className={`px-3 py-2.5 text-left border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isSelected
                        ? `bg-[#1f2e26] ${t.accent} text-[#edf5f0]`
                        : 'bg-[#101714] hover:bg-[#19241e] border-[#2d3f36] text-[#c2d3c8]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-tech text-xs flex items-center gap-1.5 whitespace-nowrap">
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {t.label}
                      </span>
                      <span className="font-tech text-[11px] text-[#849c8e] tabular-nums whitespace-nowrap">
                        {scanned ? 'READY' : cost === 0 ? 'FREE' : `-${cost}%`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bakelite Intercom Interrogation Console */}
          <div className="steel-panel rounded-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-[#27382f] pb-2">
              <span className="font-tech text-xs uppercase tracking-wider text-[#9db4a6] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#d9822b]" />
                Bakelite Airlock Intercom
              </span>
              <span className="font-tech text-[11px] text-[#7c9486] tabular-nums">
                {Object.keys(askedQuestions).length} / {dialogue.length} Asked
              </span>
            </div>

            <div className="space-y-2.5">
              {dialogue.map((item, idx) => {
                const asked = Boolean(askedQuestions[idx]);
                return (
                  <div key={idx} className="border border-[#26362e] bg-[#0e1411]">
                    <button
                      type="button"
                      onClick={() => handleAskQuestion(idx)}
                      className={`w-full px-3 py-2 text-left text-xs font-tech transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                        asked
                          ? 'bg-[#18241e] text-[#cfe0d5]'
                          : 'hover:bg-[#17221c] text-[#b4c7bc]'
                      }`}
                    >
                      <span>{idx + 1}. {item.q}</span>
                      <span className="text-[10px] text-[#7b9485] whitespace-nowrap shrink-0 mt-0.5">
                        {asked ? 'LOGGED' : 'ASK'}
                      </span>
                    </button>
                    {asked && (
                      <div className="px-3 py-2.5 border-t border-[#223029] space-y-1.5">
                        <p className="text-sm text-[#e6efe9] leading-relaxed">
                          “{item.a}”
                        </p>
                        <p className="text-[11px] font-tech text-[#d9a25f]">
                          Audio Observation: {item.audioTell}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today's Shortwave Diagnostic Protocol Memo */}
          <div className="steel-panel rounded-sm px-4 py-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.playButtonClick();
                setShowMemo((v) => !v);
              }}
              className="w-full flex items-center justify-between gap-2 text-xs font-tech text-[#c79a5b] cursor-pointer"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5" />
                Day {state.day} Radio Protocol Memo
              </span>
              <span className="text-[#8a9e91]">{showMemo ? 'Hide' : 'Show'}</span>
            </button>
            {showMemo && (
              <p className="mt-2 text-xs text-[#c2d2c8] leading-relaxed">
                {broadcast.diagnosticRule}
              </p>
            )}
          </div>

          {/* Bulkhead Decision Controls: ADMIT / DENY / PURGE */}
          <div className="steel-panel rounded-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs font-tech">
              <span className="text-[#95ab9d] uppercase tracking-wider">Airlock Verdict</span>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playButtonClick();
                  onOpenRoster();
                }}
                className="text-[#a5c9b3] hover:text-white underline underline-offset-2 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5" />
                Bunker Roster ({state.residents.length}/{MAX_RESIDENTS})
              </button>
            </div>

            {!confirmPurge ? (
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  disabled={bunkerFull}
                  onClick={() => handleAction('ADMIT')}
                  className="py-3 px-2 bg-[#234a34] hover:bg-[#2c5e42] disabled:bg-[#1a241e] disabled:text-[#63756a] disabled:cursor-not-allowed border border-[#4b8f67] disabled:border-[#2a3830] text-[#eaf7ee] font-display text-base tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Check className="w-4 h-4 shrink-0" />
                  {bunkerFull ? 'FULL' : 'ADMIT'}
                </button>
                <button
                  type="button"
                  onClick={() => handleAction('DENY')}
                  className="py-3 px-2 bg-[#3d311a] hover:bg-[#524122] border border-[#a87e34] text-[#fae7c3] font-display text-base tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <X className="w-4 h-4 shrink-0" />
                  DENY
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playButtonClick();
                    setConfirmPurge(true);
                  }}
                  className="py-3 px-2 bg-[#4a1b1b] hover:bg-[#632323] border border-[#b83b3b] text-[#fde3e3] font-display text-base tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Flame className="w-4 h-4 shrink-0" />
                  PURGE
                </button>
              </div>
            ) : (
              <div className="p-3 bg-[#291212] border border-[#b83b3b] space-y-2.5">
                <p className="text-xs font-tech text-[#f2b8b8]">
                  Confirm airlock thermal purge on {character.name}? Eliminates threats permanently, but purging an innocent human inflicts severe guilt (-13 Sanity).
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction('PURGE')}
                    className="flex-1 py-2 px-3 bg-[#a82424] hover:bg-[#c22b2b] text-white font-tech text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Trigger Purge
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmPurge(false)}
                    className="py-2 px-4 bg-[#1c2420] hover:bg-[#27332d] text-[#c8d6cd] font-tech text-xs uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
