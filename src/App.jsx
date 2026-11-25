import React, { useEffect, useState } from 'react';
import {
  Radio,
  Volume2,
  VolumeX,
  Users,
  RotateCcw,
  Play,
  FileText,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Skull,
  ArrowRight,
  LogOut,
  ScanLine,
} from 'lucide-react';
import {
  MAX_DAYS,
  MAX_RESIDENTS,
  clearGameState,
  createNewGameState,
  expelResident,
  getBunkerCapabilities,
  getCurrentBroadcast,
  loadGameState,
  proceedToNextMorning,
  resolveAirlockDecision,
  resolveDay10Extraction,
  resolveNightPhase,
  saveGameState,
  setQuarantineResident,
  setRationMode,
  spendShiftBattery,
  startAirlockShift,
} from './engine/gameEngine.js';
import { CHARACTER_MAP } from './data/characters.js';
import AirlockBooth from './components/AirlockBooth.jsx';
import BunkerRoster from './components/BunkerRoster.jsx';
import PortraitCanvas from './components/PortraitCanvas.jsx';
import { soundEngine } from './utils/soundEngine.js';

export default function App() {
  const [gameState, setGameState] = useState(null); // null => TITLE screen
  const [hasSavedGame, setHasSavedGame] = useState(() => Boolean(loadGameState()));
  const [muted, setMuted] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Auto-save whenever gameState updates during an active run
  useEffect(() => {
    if (gameState) {
      saveGameState(gameState);
      setHasSavedGame(true);
    }
  }, [gameState]);

  const toggleAudio = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
    if (!next) {
      soundEngine.startAmbientDrone();
      soundEngine.playButtonClick();
    }
  };

  const handleStartNewGame = () => {
    soundEngine.startAmbientDrone();
    soundEngine.playRadioStatic(0.5);
    const fresh = createNewGameState();
    setGameState(fresh);
    setRosterOpen(false);
  };

  const handleContinueGame = () => {
    const saved = loadGameState();
    if (!saved) return;
    soundEngine.startAmbientDrone();
    soundEngine.playButtonClick();
    setGameState(saved);
    setRosterOpen(false);
  };

  const handleReturnToTitle = () => {
    soundEngine.stopGeigerLoop();
    soundEngine.playButtonClick();
    setRosterOpen(false);
    setGameState(null);
  };

  const handleBeginShift = () => {
    soundEngine.playAdmitDoor();
    setGameState((prev) => startAirlockShift(prev));
  };

  const handleSpendBattery = (cost) => {
    setGameState((prev) => spendShiftBattery(prev, cost));
  };

  const handleDecision = (decision) => {
    setGameState((prev) => resolveAirlockDecision(prev, decision));
  };

  const handleToggleQuarantine = (charId) => {
    setGameState((prev) => setQuarantineResident(prev, charId));
  };

  const handleExpel = (charId) => {
    setGameState((prev) => expelResident(prev, charId));
  };

  const handleRationMode = (mode) => {
    setGameState((prev) => setRationMode(prev, mode));
  };

  const handleConfirmSleep = () => {
    setGameState((prev) => {
      const next = resolveNightPhase(prev);
      if (next.lastNightReport?.hadHorror || next.ending) {
        soundEngine.playNightHorror();
      }
      return next;
    });
  };

  const handleProceedMorning = () => {
    soundEngine.playRadioStatic(0.55);
    setGameState((prev) => proceedToNextMorning(prev));
  };

  const handleTriggerExtractionScan = () => {
    soundEngine.playThermalScan();
    setGameState((prev) => {
      const next = resolveDay10Extraction(prev);
      if (next.ending?.code === 'CLEAN_EXTRACTION') {
        soundEngine.playAdmitDoor();
      } else {
        soundEngine.playNightHorror();
      }
      return next;
    });
  };

  const handleRestartAfterEnding = () => {
    clearGameState();
    handleStartNewGame();
  };

  // =========================================================================
  // TITLE SCREEN
  // =========================================================================
  if (!gameState) {
    return (
      <div className="min-h-screen bunker-wall text-[#dde7df] flex flex-col">
        {/* Top Bar (Clean 3-Zone Contract) */}
        <header className="w-full border-b border-[#25352d] bg-[#0e1411]/90">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
            <span className="font-display text-lg tracking-wider uppercase text-[#dce8e0] whitespace-nowrap shrink-0">
              Shelter B-04
            </span>
            <nav className="hidden md:flex items-center gap-6 text-xs font-tech text-[#95ab9d]">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playButtonClick();
                  setShowManual(false);
                }}
                className="hover:text-[#e6f0e9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Deployment
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playButtonClick();
                  setShowManual(true);
                }}
                className="hover:text-[#e6f0e9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Field Manual
              </button>
              <button
                type="button"
                onClick={toggleAudio}
                className="hover:text-[#e6f0e9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {muted ? 'Audio Muted' : 'Audio Ready'}
              </button>
            </nav>
            <button
              type="button"
              onClick={handleStartNewGame}
              className="px-4 py-2 bg-[#c77424] hover:bg-[#dc832c] text-[#0e120f] font-tech text-xs uppercase tracking-wider font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Start Shift
            </button>
          </div>
        </header>

        {/* Main Hero & Operational Briefing */}
        <main className="flex-1 flex items-center py-10 px-6">
          <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Primary Focal Anchor */}
            <div className="lg:col-span-7 steel-panel rounded-sm p-7 sm:p-10 flex flex-col justify-between fluorescent-flicker">
              <div>
                <p className="font-tech text-xs uppercase tracking-[0.2em] text-[#d98e3b]">
                  Sector 44 · Krasnograd-9 · November 1998
                </p>
                <h1 className="font-display text-4xl sm:text-6xl uppercase tracking-tight text-[#e8f0ea] mt-3 leading-[1.04] [text-wrap:balance]">
                  Shelter B-04: The Chitin Fall
                </h1>
                <p className="text-base text-[#b8cabf] mt-5 leading-relaxed max-w-xl">
                  Three weeks ago the northern sky burned and black ash began falling through the metro tunnels. You are the Airlock Warden of a Cold War bunker rated for six survivors. Behind the fogged reinforced glass wait forty-six desperate faces—some carrying medicine and fuel, others hollowed out by what fell inside the fallout snow.
                </p>

                <div className="mt-6 pt-5 border-t border-[#293a31] grid grid-cols-3 gap-4 font-tech text-xs">
                  <div>
                    <span className="text-[#7c9486] block">EXTRACTION ETA</span>
                    <span className="text-lg text-[#e5efe8] tabular-nums">10 Days</span>
                  </div>
                  <div>
                    <span className="text-[#7c9486] block">MAX OCCUPANTS</span>
                    <span className="text-lg text-[#e5efe8] tabular-nums">6 Bunks</span>
                  </div>
                  <div>
                    <span className="text-[#7c9486] block">VISITOR ROSTER</span>
                    <span className="text-lg text-[#e5efe8] tabular-nums">46 Profiles</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleStartNewGame}
                  className="px-6 py-3.5 bg-[#c77424] hover:bg-[#dc832c] text-[#0e120f] font-display text-lg uppercase tracking-wider font-semibold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  New Deployment
                </button>

                {hasSavedGame && (
                  <button
                    type="button"
                    onClick={handleContinueGame}
                    className="px-5 py-3.5 bg-[#1d3026] hover:bg-[#274033] border border-[#4a735b] text-[#e3f2e8] font-display text-lg uppercase tracking-wider flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Continue Saved Shift
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playButtonClick();
                    setShowManual((v) => !v);
                  }}
                  className="px-4 py-3.5 bg-[#121a16] hover:bg-[#1a2620] border border-[#32463c] text-[#bdd0c4] font-tech text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  {showManual ? 'Hide Manual' : 'Field Manual'}
                </button>
              </div>
            </div>

            {/* Right Briefing / Manual Panel */}
            <div className="lg:col-span-5 steel-panel rounded-sm p-6 sm:p-7 flex flex-col justify-between">
              {showManual ? (
                <div className="space-y-4">
                  <h2 className="font-display text-xl uppercase tracking-wide text-[#e3ede6] border-b border-[#293a31] pb-2">
                    Warden Inspection Manual
                  </h2>
                  <div className="space-y-3 text-xs leading-relaxed text-[#bdd0c4]">
                    <p>
                      <strong className="font-tech text-[#7ae096]">Geiger Counter (-10% Battery):</strong>{' '}
                      Living surface humans carry normal background ash (25–65 CPM). Hollow mimics often read Dead Zero (0 CPM) or spike wildly past 160 CPM.
                    </p>
                    <p>
                      <strong className="font-tech text-[#c49cf2]">UV Penlight (-15% Battery):</strong>{' '}
                      Healthy eyes constrict and blink. Exposes glassy unreactive pupils, vertical slits, black ash-veins beneath the collar, violet veins, and forged documents.
                    </p>
                    <p>
                      <strong className="font-tech text-[#f0a24a]">Thermal Scanner (-15% Battery):</strong>{' '}
                      Living humans radiate 36–39°C core warmth. Hollows read freezing cold (14–22°C). Also reveals concealed hot weapons or living creatures in pockets.
                    </p>
                    <p>
                      <strong className="font-tech text-[#d9d1b6]">Paper Ledger (Free) & Optical Zoom (-5%):</strong>{' '}
                      Cross-reference municipal ID tags, collapsed stations, and radio alerts. Zoom uncovers extra teeth, multi-limbed shadows, chitin claws, and weapons.
                    </p>
                    <p>
                      <strong className="font-tech text-[#eb8a8a]">Dynamic Runs & Night Lockdown:</strong>{' '}
                      Every new game randomizes hidden visitor alignments (70% standard / 30% inverted). Quarantine suspicious residents at night or expel threats before Convoy Iron-4’s Day 10 biological scan!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-[#293a31] pb-2.5">
                    <h2 className="font-display text-xl uppercase tracking-wide text-[#e3ede6]">
                      Airlock Standing Orders
                    </h2>
                    <span className="font-tech text-xs text-[#8da396]">DIRECTIVE B-04</span>
                  </div>

                  <ol className="space-y-4 text-sm text-[#c0d1c6]">
                    <li className="flex gap-3">
                      <span className="font-tech text-[#d98e3b] shrink-0">01.</span>
                      <span>
                        Monitor the morning reel-to-reel shortwave broadcast. Hollow mimics adapt every few days—follow updated diagnostic protocols.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-tech text-[#d98e3b] shrink-0">02.</span>
                      <span>
                        Ration your Shift Battery across 3–4 visitors daily. Radiation sickness, frostbite, and withdrawal look horrifying—cross-check multiple tools before denying or purging.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-tech text-[#d98e3b] shrink-0">03.</span>
                      <span>
                        Manage Food, Water, Diesel Fuel, and Warden Sanity inside the dormitory. Friendly specialists repair generators, heal wounds, and calibrate your instruments.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-tech text-[#d98e3b] shrink-0">04.</span>
                      <span>
                        Survive to Day 10 with living humans inside—and zero Hollows behind your blast doors—to pass Convoy Iron-4’s lethal bio-scan.
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-[#26362e] flex items-center justify-between text-xs font-tech text-[#7f9688]">
                <span>Synthesized Web Audio Active On Start</span>
                <span>Auto-Save Enabled</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // IN-GAME PERSISTENT BUNKER HUD + PHASE ROUTER
  // =========================================================================
  const broadcast = getCurrentBroadcast(gameState);
  const caps = getBunkerCapabilities(gameState);

  return (
    <div className="min-h-screen bunker-wall text-[#dde7df] flex flex-col">
      {/* Compact Industrial Top Status Bar */}
      <header className="sticky top-0 z-40 w-full bg-[#0d1310]/95 border-b border-[#293b32]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
          {/* Left: Shelter & Day */}
          <div className="flex items-center gap-4 shrink-0">
            <span className="font-display text-lg uppercase tracking-wider text-[#e5efe8] whitespace-nowrap">
              Shelter B-04
            </span>
            <span className="font-tech text-xs text-[#d99543] tabular-nums whitespace-nowrap">
              DAY {gameState.day} / {MAX_DAYS}
            </span>
          </div>

          {/* Center: Clean Tabular Resource Strip (No Pill Clutter) */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-tech text-xs tabular-nums">
            <span className={gameState.food <= 3 ? 'text-[#f27979]' : 'text-[#cad9cf]'}>
              FOOD: {gameState.food}
            </span>
            <span className="text-[#3b4f44]" aria-hidden="true">·</span>
            <span className={gameState.water <= 3 ? 'text-[#f27979]' : 'text-[#cad9cf]'}>
              WATER: {gameState.water}
            </span>
            <span className="text-[#3b4f44]" aria-hidden="true">·</span>
            <span className={gameState.fuel <= 2 ? 'text-[#f27979]' : 'text-[#cad9cf]'}>
              DIESEL: {gameState.fuel}
            </span>
            <span className="text-[#3b4f44]" aria-hidden="true">·</span>
            <span className={gameState.sanity < 35 ? 'text-[#f27979]' : 'text-[#a5d9b5]'}>
              SANITY: {gameState.sanity}%
            </span>
            <span className="text-[#3b4f44]" aria-hidden="true">·</span>
            <span className="text-[#cad9cf]">
              BUNKS: {gameState.residents.length}/{MAX_RESIDENTS}
            </span>
          </div>

          {/* Right: Real Functional Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {gameState.phase === 'AIRLOCK_SHIFT' && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playButtonClick();
                  setRosterOpen(true);
                }}
                className="px-3 py-1.5 bg-[#16211c] hover:bg-[#203028] border border-[#33473d] text-xs font-tech text-[#d2e0d7] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                Roster
              </button>
            )}
            <button
              type="button"
              onClick={toggleAudio}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="px-2.5 py-1.5 bg-[#16211c] hover:bg-[#203028] border border-[#33473d] text-xs font-tech text-[#c2d4c9] flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{muted ? 'Muted' : 'Audio'}</span>
            </button>
            <button
              type="button"
              onClick={handleReturnToTitle}
              className="px-2.5 py-1.5 bg-[#16211c] hover:bg-[#203028] border border-[#33473d] text-xs font-tech text-[#c2d4c9] flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area by Phase */}
      <main className="flex-1">
        {/* ================= MORNING SHORTWAVE RADIO ================= */}
        {gameState.phase === 'MORNING_RADIO' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
            <div className="steel-panel rounded-sm p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#293b32] pb-4">
                <div>
                  <p className="font-tech text-xs uppercase tracking-widest text-[#d98e3b] flex items-center gap-2">
                    <Radio className="w-4 h-4" />
                    {broadcast.frequency}
                  </p>
                  <h1 className="font-display text-3xl sm:text-4xl uppercase tracking-wide text-[#e8f0ea] mt-2">
                    Day {broadcast.day}: {broadcast.headline}
                  </h1>
                  <p className="font-tech text-xs text-[#8da396] mt-1">
                    {broadcast.date} · Source: {broadcast.source}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => soundEngine.playRadioStatic(0.65)}
                  className="px-3 py-1.5 bg-[#121a16] hover:bg-[#1b2721] border border-[#32453b] font-tech text-xs text-[#a9bfb2] whitespace-nowrap cursor-pointer"
                >
                  Replay Static
                </button>
              </div>

              {/* Reel-to-Reel Transcript */}
              <div className="p-5 bg-[#0c110f] border border-[#24342c] space-y-3.5 text-sm sm:text-base text-[#d2dfd6] leading-relaxed">
                {broadcast.transcript.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              {/* Evolving Daily Diagnostic Protocol */}
              <div className="p-4 bg-[#1c1a12] border border-[#8c692b] space-y-1.5">
                <p className="font-tech text-xs uppercase tracking-wider text-[#e8b054]">
                  Updated Screening Directive
                </p>
                <p className="text-sm text-[#f0e3c7] leading-relaxed">
                  {broadcast.diagnosticRule}
                </p>
              </div>

              {/* Decoded Bonus Intel if Mila or Artyom is inside */}
              {caps.radioDecoded && (
                <div className="p-3.5 bg-[#122119] border border-[#3c7352] text-xs font-tech text-[#9be0b3]">
                  Decoded Shortwave Assist Active: Your radio/archive specialist cross-checked municipal tables—forged IDs in today’s Paper Ledger will display explicit forgery confirmation.
                </div>
              )}

              {/* Daily Supply Event & Shift Launch */}
              <div className="pt-4 border-t border-[#293b32] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs font-tech text-[#95ab9d] space-y-1">
                  <p>Morning Status: {broadcast.supplyEvent.label}</p>
                  <p className="tabular-nums">
                    Scheduled Airlock Visitors Today: {broadcast.visitorsCount} · Shift Battery Ready:{' '}
                    {gameState.fuel > 0 ? Math.min(100, 100) : 50}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBeginShift}
                  className="px-6 py-3 bg-[#c77424] hover:bg-[#dc832c] text-[#0e120f] font-display text-lg uppercase tracking-wider font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Airlock Shutter
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= AIRLOCK SHIFT ================= */}
        {gameState.phase === 'AIRLOCK_SHIFT' && (
          <>
            <AirlockBooth
              state={gameState}
              onSpendBattery={handleSpendBattery}
              onDecision={handleDecision}
              onOpenRoster={() => setRosterOpen(true)}
            />
            {rosterOpen && (
              <BunkerRoster
                state={gameState}
                mode="drawer"
                onCloseDrawer={() => setRosterOpen(false)}
              />
            )}
          </>
        )}

        {/* ================= NIGHT MANAGEMENT (ROSTER / QUARANTINE / RATIONS) ================= */}
        {gameState.phase === 'NIGHT_MANAGEMENT' && (
          <BunkerRoster
            state={gameState}
            mode="night"
            onToggleQuarantine={handleToggleQuarantine}
            onExpel={handleExpel}
            onChangeRationMode={handleRationMode}
            onConfirmSleep={handleConfirmSleep}
          />
        )}

        {/* ================= NIGHT SUMMARY REPORT ================= */}
        {gameState.phase === 'NIGHT_SUMMARY' && gameState.lastNightReport && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
            <div className="steel-panel rounded-sm p-6 sm:p-8 space-y-6">
              <div className="border-b border-[#293b32] pb-4 flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="font-tech text-xs uppercase tracking-widest text-[#8ea597]">
                    Overnight Bunker Log · 00:00 – 06:00
                  </p>
                  <h1 className="font-display text-3xl uppercase tracking-wide text-[#e8f0ea] mt-1">
                    Night {gameState.lastNightReport.day} Summary
                  </h1>
                </div>
                <span className="font-tech text-xs text-[#9cb4a6] tabular-nums">
                  Surviving Occupants: {gameState.lastNightReport.residentCount} / {MAX_RESIDENTS}
                </span>
              </div>

              <div className="space-y-3">
                {gameState.lastNightReport.events.map((ev, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 border text-sm leading-relaxed flex items-start gap-3 ${
                      ev.kind === 'horror'
                        ? 'bg-[#261214] border-[#9c2f35] text-[#f7c8cb]'
                        : ev.kind === 'warning'
                        ? 'bg-[#241c11] border-[#9e7028] text-[#f2d6a7]'
                        : ev.kind === 'defense'
                        ? 'bg-[#192329] border-[#42728f] text-[#cae4f2]'
                        : ev.kind === 'perk'
                        ? 'bg-[#122118] border-[#386b4c] text-[#c8ebd4]'
                        : 'bg-[#101714] border-[#293a31] text-[#c2d2c8]'
                    }`}
                  >
                    {ev.kind === 'horror' && <Skull className="w-4 h-4 shrink-0 mt-0.5 text-[#eb6a70]" />}
                    {ev.kind === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#e6a445]" />}
                    {ev.kind === 'defense' && <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#6db5e0]" />}
                    {ev.kind === 'perk' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#69c989]" />}
                    <span>{ev.text}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#293b32] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="font-tech text-xs text-[#93aa9c] tabular-nums">
                  Dawn Inventory: Food {gameState.food} · Water {gameState.water} · Diesel {gameState.fuel} · Sanity {gameState.sanity}%
                </p>
                <button
                  type="button"
                  onClick={handleProceedMorning}
                  className="px-6 py-3 bg-[#c77424] hover:bg-[#dc832c] text-[#0e120f] font-display text-lg uppercase tracking-wider font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Tune Day {gameState.day + 1} Radio
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= DAY 10 CONVOY EXTRACTION BIO-SCAN ================= */}
        {gameState.phase === 'EXTRACTION_SCAN' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
            <div className="steel-panel rounded-sm p-6 sm:p-8 space-y-6">
              <div className="border-b border-[#293b32] pb-4">
                <p className="font-tech text-xs uppercase tracking-widest text-[#d98e3b] flex items-center gap-2">
                  <ScanLine className="w-4 h-4" />
                  DAY 10 · SURFACE HATCH · CONVOY IRON-4
                </p>
                <h1 className="font-display text-3xl sm:text-4xl uppercase tracking-wide text-[#e8f0ea] mt-2">
                  Final Biological Clearance Scan
                </h1>
                <p className="text-sm text-[#bacbc0] mt-2 leading-relaxed">
                  Armored personnel carriers are idling directly overhead. Before unsealing the main blast doors, Convoy Iron-4 will scan every life-sign inside Shelter B-04. If even one Hollow mimic stands among your occupants, the hatch will be purged.
                </p>
              </div>

              <div>
                <p className="font-tech text-xs uppercase tracking-wider text-[#8fa698] mb-3">
                  Occupants Assembled At Main Bulkhead ({gameState.residents.length} / {MAX_RESIDENTS})
                </p>
                {gameState.residents.length === 0 ? (
                  <div className="p-5 bg-[#121916] border border-[#3a4a41] text-sm text-[#c7b38b]">
                    You stand completely alone beneath the surface hatch. Only a verified extraction beacon can convince Convoy Iron-4 to open for a single life-sign.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {gameState.residents.map((res) => {
                      const char = CHARACTER_MAP[res.id];
                      if (!char) return null;
                      return (
                        <div
                          key={res.id}
                          className="p-3 bg-[#101714] border border-[#2c3e35] flex items-center gap-3"
                        >
                          <div className="w-12 h-12 shrink-0 border border-[#364a3f]">
                            <PortraitCanvas character={char} compact />
                          </div>
                          <div className="min-w-0">
                            <p className="font-display text-sm uppercase tracking-wide text-[#e5efe8] truncate">
                              {char.name}
                            </p>
                            <p className="font-tech text-[11px] text-[#8da396] truncate">
                              {char.archetype}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#293b32] flex justify-end">
                <button
                  type="button"
                  onClick={handleTriggerExtractionScan}
                  className="px-7 py-3.5 bg-[#c77424] hover:bg-[#dc832c] text-[#0e120f] font-display text-lg uppercase tracking-wider font-semibold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ScanLine className="w-5 h-5" />
                  Unseal Blast Doors & Run Scan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= ENDING SCREEN & POST-MORTEM TRUTH LEDGER ================= */}
        {gameState.phase === 'ENDING' && gameState.ending && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div
              className={`steel-panel rounded-sm p-6 sm:p-9 space-y-6 border-2 ${
                gameState.ending.code === 'CLEAN_EXTRACTION'
                  ? 'border-[#4f9e6b]'
                  : gameState.ending.code === 'THE_NEST'
                  ? 'border-[#b83232]'
                  : 'border-[#a87c32]'
              }`}
            >
              <div>
                <p
                  className={`font-tech text-xs uppercase tracking-[0.2em] ${
                    gameState.ending.code === 'CLEAN_EXTRACTION'
                      ? 'text-[#7ae096]'
                      : gameState.ending.code === 'THE_NEST'
                      ? 'text-[#f27979]'
                      : 'text-[#e8b054]'
                  }`}
                >
                  {gameState.ending.subtitle}
                </p>
                <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-wide text-[#edf5f0] mt-2">
                  Ending: {gameState.ending.title}
                </h1>
                <p className="text-base text-[#cad8cf] mt-4 leading-relaxed max-w-3xl">
                  {gameState.ending.summary}
                </p>
              </div>

              {/* Run Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-[#293b32] font-tech">
                <div>
                  <span className="text-[11px] text-[#7f9789] block">DAYS REACHED</span>
                  <span className="text-xl text-[#e6f0e9] tabular-nums">
                    {gameState.day} / {MAX_DAYS}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#7f9789] block">ACCURATE CALLS</span>
                  <span className="text-xl text-[#7ae096] tabular-nums">
                    {gameState.stats.correctDecisions} /{' '}
                    {gameState.stats.correctDecisions + gameState.stats.wrongDecisions}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#7f9789] block">NIGHT CASUALTIES</span>
                  <span className="text-xl text-[#f28585] tabular-nums">
                    {gameState.stats.casualties}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#7f9789] block">FINAL OCCUPANTS</span>
                  <span className="text-xl text-[#e6f0e9] tabular-nums">
                    {gameState.residents.length}
                  </span>
                </div>
              </div>

              {/* Post-Mortem Truth Ledger */}
              <div>
                <h2 className="font-display text-xl uppercase tracking-wide text-[#e2ece5] mb-3">
                  Post-Mortem Truth Ledger — Encountered Visitors
                </h2>
                <div className="max-h-72 overflow-y-auto border border-[#26362e] divide-y divide-[#202e27]">
                  {gameState.encounterHistory.map((entry, i) => {
                    const char = CHARACTER_MAP[entry.charId];
                    const wasHostile = entry.actualAlignment === 'hostile';
                    return (
                      <div
                        key={`${entry.charId}-${i}`}
                        className="px-3.5 py-2.5 bg-[#0f1512] flex flex-wrap items-center justify-between gap-2 text-xs font-tech"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[#7c9486] tabular-nums shrink-0">D{entry.day}</span>
                          <span className="text-[#e3ede6] font-bold truncate">{entry.name}</span>
                          <span className="text-[#889e90] hidden sm:inline">
                            · {char?.archetype}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[#a8bdb0]">Verdict: {entry.decision}</span>
                          <span aria-hidden="true" className="text-[#394d42]">·</span>
                          <span className={wasHostile ? 'text-[#f27979]' : 'text-[#7ae096]'}>
                            Truth: {wasHostile ? `HOSTILE (${entry.threatKind.toUpperCase()})` : 'HUMAN'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRestartAfterEnding}
                  className="px-6 py-3 bg-[#c77424] hover:bg-[#dc832c] text-[#0e120f] font-display text-lg uppercase tracking-wider font-semibold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  New Deployment (Re-Roll Alignments)
                </button>
                <button
                  type="button"
                  onClick={handleReturnToTitle}
                  className="px-5 py-3 bg-[#15201b] hover:bg-[#1e2e27] border border-[#33473d] text-[#d0dfd5] font-tech text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap"
                >
                  Return to Title
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
