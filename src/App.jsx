import React, { useCallback, useEffect, useState } from 'react';
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
  Activity,
  Flashlight,
  Thermometer,
  BookOpen,
  ZoomIn,
  Phone,
  ChevronDown,
  ChevronUp,
  X,
  Flame,
  Footprints,
  MousePointerClick,
} from 'lucide-react';
import {
  MAX_DAYS,
  MAX_RESIDENTS,
  TOOL_BATTERY_COST,
  clearGameState,
  createNewGameState,
  expelResident,
  getBunkerCapabilities,
  getCurrentBroadcast,
  getCurrentVisitorId,
  getVisitorInspectionData,
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
import { CHARACTER_MAP, GROUP_LABELS } from './data/characters.js';
import Bunker3DViewport from './components/Bunker3DViewport.jsx';
import BunkerRoster from './components/BunkerRoster.jsx';
import PortraitCanvas from './components/PortraitCanvas.jsx';
import { soundEngine } from './utils/soundEngine.js';

export default function App() {
  const [gameState, setGameState] = useState(null); // null => TITLE screen
  const [hasSavedGame, setHasSavedGame] = useState(() => Boolean(loadGameState()));
  const [muted, setMuted] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // 3D First-Person Interactive State
  const [activeTool, setActiveTool] = useState('none'); // 'none' | 'geiger' | 'uv' | 'thermal' | 'zoom'
  const [scannedTools, setScannedTools] = useState({});
  const [askedQuestions, setAskedQuestions] = useState({});
  const [activeModal, setActiveModal] = useState(null); // null | 'radio' | 'intercom' | 'ledger' | 'protocol' | 'roster' | 'purge_confirm' | 'hatch'
  const [hoveredInteract, setHoveredInteract] = useState(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [cameraPresetReq, setCameraPresetReq] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = useCallback((text) => {
    setToastMsg(text);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 4200);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  // Auto-save active run to localStorage
  useEffect(() => {
    if (gameState) {
      saveGameState(gameState);
      setHasSavedGame(true);
    }
  }, [gameState]);

  const currentCharId =
    gameState && gameState.phase === 'AIRLOCK_SHIFT'
      ? getCurrentVisitorId(gameState)
      : null;

  const currentInspection =
    gameState && currentCharId
      ? getVisitorInspectionData(gameState, currentCharId)
      : null;

  // Reset per-visitor tool scans & knock when a new visitor steps behind the 3D window
  useEffect(() => {
    if (!gameState || gameState.phase !== 'AIRLOCK_SHIFT' || !currentCharId) {
      setActiveTool('none');
      return;
    }
    setActiveTool('none');
    setScannedTools({});
    setAskedQuestions({});
    soundEngine.stopGeigerLoop();
    soundEngine.playDoorKnock(3);
  }, [currentCharId, gameState?.day, gameState?.phase]);

  // Guide camera smoothly toward relevant station on major phase transitions
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase === 'MORNING_RADIO') {
      setCameraPresetReq({ key: 'radio', seq: Date.now() });
    } else if (gameState.phase === 'AIRLOCK_SHIFT' && gameState.visitorIndex === 0) {
      setCameraPresetReq({ key: 'airlock', seq: Date.now() });
    } else if (gameState.phase === 'NIGHT_MANAGEMENT') {
      setCameraPresetReq({ key: 'cot', seq: Date.now() });
    } else if (gameState.phase === 'EXTRACTION_SCAN') {
      setCameraPresetReq({ key: 'hatch', seq: Date.now() });
    }
  }, [gameState?.phase, gameState?.day]);

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
    setActiveModal(null);
    setActiveTool('none');
    showToast('Walk to the Shortwave Radio (West Desk) and press [E] or Click to hear Day 1 Broadcast.');
  };

  const handleContinueGame = () => {
    const saved = loadGameState();
    if (!saved) return;
    soundEngine.startAmbientDrone();
    soundEngine.playButtonClick();
    setGameState(saved);
    setActiveModal(null);
    setActiveTool('none');
  };

  const handleReturnToTitle = () => {
    soundEngine.stopGeigerLoop();
    soundEngine.playButtonClick();
    setActiveModal(null);
    setActiveTool('none');
    setGameState(null);
  };

  // Equip or toggle a 3D airlock inspection tool
  const activateInspectionTool = useCallback(
    (toolKey) => {
      if (!gameState || gameState.phase !== 'AIRLOCK_SHIFT' || !currentInspection) {
        showToast('No visitor at the airlock window right now.');
        return;
      }

      if (toolKey === 'ledger') {
        soundEngine.stopGeigerLoop();
        soundEngine.playPaperFlip();
        setActiveModal('ledger');
        return;
      }

      if (activeTool === toolKey) {
        setActiveTool('none');
        soundEngine.stopGeigerLoop();
        soundEngine.playButtonClick();
        return;
      }

      const alreadyScanned = Boolean(scannedTools[toolKey]);
      const cost = alreadyScanned ? 0 : TOOL_BATTERY_COST[toolKey] || 0;
      if (cost > gameState.shiftBattery) {
        soundEngine.playButtonClick();
        showToast(`Shift Battery too low (${gameState.shiftBattery}%) for ${toolKey.toUpperCase()}!`);
        return;
      }

      if (cost > 0) {
        setGameState((prev) => spendShiftBattery(prev, cost));
      }
      setScannedTools((prev) => ({ ...prev, [toolKey]: true }));
      setActiveTool(toolKey);

      if (toolKey === 'geiger') {
        soundEngine.playGeigerBurst(currentInspection.tools.geiger.cpm);
      } else if (toolKey === 'uv') {
        soundEngine.stopGeigerLoop();
        soundEngine.playUvBuzz();
      } else if (toolKey === 'thermal') {
        soundEngine.stopGeigerLoop();
        soundEngine.playThermalScan();
      } else {
        soundEngine.stopGeigerLoop();
        soundEngine.playButtonClick();
      }
    },
    [gameState, currentInspection, activeTool, scannedTools, showToast]
  );

  // Execute ADMIT / DENY / PURGE decision from physical 3D bulkhead levers or intercom
  const executeAirlockDecision = useCallback(
    (decision) => {
      if (!gameState || gameState.phase !== 'AIRLOCK_SHIFT' || !currentInspection) return;
      if (decision === 'ADMIT' && gameState.residents.length >= MAX_RESIDENTS) {
        soundEngine.playButtonClick();
        showToast('Shelter B-04 is at 6/6 capacity! Deny, Purge, or Expel someone tonight.');
        return;
      }

      soundEngine.stopGeigerLoop();
      soundEngine.playLeverPull();
      if (decision === 'ADMIT') soundEngine.playAdmitDoor();
      else if (decision === 'DENY') soundEngine.playDenySlam();
      else if (decision === 'PURGE') soundEngine.playPurgeAlarm();

      setActiveModal(null);
      setActiveTool('none');
      setGameState((prev) => {
        const next = resolveAirlockDecision(prev, decision);
        if (next.lastDecisionFeedback) {
          showToast(next.lastDecisionFeedback);
        }
        return next;
      });
    },
    [gameState, currentInspection, showToast]
  );

  // Handle interacting with ANY 3D object inside Shelter B-04
  const handleWorldInteract = useCallback(
    (interactId) => {
      if (!gameState) return;

      switch (interactId) {
        case 'radio':
          soundEngine.playRadioStatic(0.45);
          setActiveModal('radio');
          break;
        case 'protocol':
          soundEngine.playPaperFlip();
          setActiveModal('protocol');
          break;
        case 'window':
          if (gameState.phase === 'AIRLOCK_SHIFT') {
            activateInspectionTool('zoom');
          } else {
            soundEngine.playButtonClick();
            showToast('Steel blast shutter is closed. Tune the Shortwave Radio to begin the shift.');
          }
          break;
        case 'geiger':
        case 'uv':
        case 'thermal':
        case 'ledger':
          activateInspectionTool(interactId);
          break;
        case 'intercom':
          if (gameState.phase === 'AIRLOCK_SHIFT' && currentInspection) {
            soundEngine.playIntercomClick(false);
            setActiveModal('intercom');
          } else {
            soundEngine.playButtonClick();
            showToast('Intercom line is quiet—no visitor at the airlock.');
          }
          break;
        case 'admit':
          if (gameState.phase === 'AIRLOCK_SHIFT') {
            executeAirlockDecision('ADMIT');
          } else {
            showToast('No visitor waiting at the airlock.');
          }
          break;
        case 'deny':
          if (gameState.phase === 'AIRLOCK_SHIFT') {
            executeAirlockDecision('DENY');
          } else {
            showToast('No visitor waiting at the airlock.');
          }
          break;
        case 'purge':
          if (gameState.phase === 'AIRLOCK_SHIFT' && currentInspection) {
            soundEngine.playButtonClick();
            setActiveModal('purge_confirm');
          } else {
            showToast('Airlock vestibule is empty.');
          }
          break;
        case 'roster':
        case 'cot':
          soundEngine.playButtonClick();
          setActiveModal('roster');
          break;
        case 'hatch':
          soundEngine.playButtonClick();
          if (gameState.phase === 'EXTRACTION_SCAN') {
            setActiveModal('hatch');
          } else {
            showToast(
              `Surface Blast Hatch sealed until Day 10 Extraction Convoy arrives (Currently Day ${gameState.day}).`
            );
          }
          break;
        default:
          break;
      }
    },
    [gameState, currentInspection, activateInspectionTool, executeAirlockDecision, showToast]
  );

  // Global keyboard shortcuts (1-4 tools, Z zoom, T intercom, R roster, H hide dock, ESC close modal)
  useEffect(() => {
    if (!gameState || gameState.phase === 'ENDING') return;
    const onKey = (e) => {
      if (e.code === 'Escape' && activeModal) {
        setActiveModal(null);
        return;
      }
      if (activeModal || gameState.phase === 'NIGHT_SUMMARY') return;

      if (e.code === 'KeyH') setDockCollapsed((v) => !v);
      if (e.code === 'Digit1') activateInspectionTool('geiger');
      if (e.code === 'Digit2') activateInspectionTool('uv');
      if (e.code === 'Digit3') activateInspectionTool('thermal');
      if (e.code === 'Digit4') activateInspectionTool('ledger');
      if (e.code === 'KeyZ') activateInspectionTool('zoom');
      if (e.code === 'KeyT') handleWorldInteract('intercom');
      if (e.code === 'KeyR') handleWorldInteract('roster');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, activeModal, activateInspectionTool, handleWorldInteract]);

  const handleBeginShiftFromRadio = () => {
    soundEngine.playAdmitDoor();
    setActiveModal(null);
    setGameState((prev) => startAirlockShift(prev));
    showToast('Blast shutter rising! Walk to the Airlock Window (North Wall) to screen visitors.');
  };

  const handleConfirmSleep = () => {
    setActiveModal(null);
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
    showToast('New morning broadcast incoming on the Shortwave Radio (West Desk).');
  };

  const handleTriggerExtractionScan = () => {
    soundEngine.playThermalScan();
    setActiveModal(null);
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
  // 1. TITLE SCREEN
  // =========================================================================
  if (!gameState) {
    return (
      <div className="min-h-screen bunker-wall text-[#dde7df] flex flex-col">
        <header className="w-full border-b border-[#25352d] bg-[#0e1411]">
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
                3D Controls & Manual
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
              Enter 3D Bunker
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center py-10 px-6">
          <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 steel-panel rounded-sm p-7 sm:p-10 flex flex-col justify-between fluorescent-flicker">
              <div>
                <p className="font-tech text-xs uppercase tracking-[0.2em] text-[#d98e3b]">
                  First-Person 3D Bunker Survival · Krasnograd-9 · 1998
                </p>
                <h1 className="font-display text-4xl sm:text-6xl uppercase tracking-tight text-[#e8f0ea] mt-3 leading-[1.04] [text-wrap:balance]">
                  Shelter B-04: The Chitin Fall
                </h1>
                <p className="text-base text-[#b8cabf] mt-5 leading-relaxed max-w-xl">
                  Walk freely inside your crumbling post-Soviet nuclear bunker. Tune the reel-to-reel shortwave radio, step up to the fogged airlock glass, pick up your Geiger counter, UV penlight, thermal scanner, and civil ledger, interrogate forty-six distinct 3D visitors through the Bakelite intercom, and pull the bulkhead levers before night falls.
                </p>

                <div className="mt-6 pt-5 border-t border-[#293a31] grid grid-cols-3 gap-4 font-tech text-xs">
                  <div>
                    <span className="text-[#7c9486] block">PERSPECTIVE</span>
                    <span className="text-lg text-[#e5efe8]">3D First-Person</span>
                  </div>
                  <div>
                    <span className="text-[#7c9486] block">EXTRACTION ETA</span>
                    <span className="text-lg text-[#e5efe8] tabular-nums">10 Days</span>
                  </div>
                  <div>
                    <span className="text-[#7c9486] block">3D VISITORS</span>
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
                  New 3D Deployment
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
                  {showManual ? 'Hide Manual' : 'Controls & Manual'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 steel-panel rounded-sm p-6 sm:p-7 flex flex-col justify-between">
              {showManual ? (
                <div className="space-y-3.5 text-xs leading-relaxed text-[#bdd0c4]">
                  <h2 className="font-display text-xl uppercase tracking-wide text-[#e3ede6] border-b border-[#293a31] pb-2">
                    3D Inspection Instruments
                  </h2>
                  <p>
                    <strong className="font-tech text-[#7ae096]">Geiger Counter [1] (-10%):</strong>{' '}
                    Surface humans read 25–65 CPM. Hollow mimics read Dead Zero (0 CPM) or spike past 160 CPM.
                  </p>
                  <p>
                    <strong className="font-tech text-[#c49cf2]">UV Penlight [2] (-15%):</strong>{' '}
                    Fires an ultraviolet spotlight through the glass—revealing black ash-veins, violet veins, split vertical pupils, glassy unreactive eyes, and chitin claws directly on the 3D visitor.
                  </p>
                  <p>
                    <strong className="font-tech text-[#f0a24a]">FLIR Thermal [3] (-15%):</strong>{' '}
                    Switches the 3D visitor to false-color heat vision. Living humans glow warm amber/orange (36–39°C); Hollows freeze cold blue (14–22°C).
                  </p>
                  <p>
                    <strong className="font-tech text-[#d9d1b6]">Paper Ledger [4] & Optical Zoom [Z]:</strong>{' '}
                    Cross-reference civil tags and station codes. Click the Airlock Window or press [Z] to zoom 1.4x into extra teeth, multi-limbed shadows, and concealed weapons.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#293a31] pb-2.5">
                    <h2 className="font-display text-xl uppercase tracking-wide text-[#e3ede6]">
                      How To Move & Interact
                    </h2>
                    <span className="font-tech text-xs text-[#8da396]">INDIE FPS</span>
                  </div>

                  <div className="space-y-3.5 text-sm text-[#c0d1c6]">
                    <div className="flex gap-3 items-start">
                      <Footprints className="w-4 h-4 text-[#d98e3b] shrink-0 mt-1" />
                      <p>
                        <strong className="font-tech text-[#e6efe9]">W A S D / Arrow Keys:</strong>{' '}
                        Walk around the bunker room between the Shortwave Radio, Airlock Desk, Dormitory Door, Warden’s Cot, and Surface Hatch.
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <MousePointerClick className="w-4 h-4 text-[#d98e3b] shrink-0 mt-1" />
                      <p>
                        <strong className="font-tech text-[#e6efe9]">Look & Interact [E / Click]:</strong>{' '}
                        Click-drag to look around (or click empty wall to lock mouse for full FPS look, ESC to unlock). Aim at any 3D tool, radio, intercom, door, or lever and press <strong className="font-tech text-[#f3be7a]">E</strong> or <strong className="font-tech text-[#f3be7a]">Click</strong>.
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <Radio className="w-4 h-4 text-[#d98e3b] shrink-0 mt-1" />
                      <p>
                        <strong className="font-tech text-[#e6efe9]">Daily Cycle:</strong>{' '}
                        Tune the glowing West Radio → Screen 3–4 visitors at the North Airlock → Walk to the East Dormitory / Cot to Quarantine & Sleep → Survive to Day 10 Extraction!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-[#26362e] flex items-center justify-between text-xs font-tech text-[#7f9688]">
                <span>Synthesized 3D Footsteps & Bunker Audio</span>
                <span>Auto-Save Enabled</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // 2. ENDING SCREEN & POST-MORTEM TRUTH LEDGER
  // =========================================================================
  if (gameState.phase === 'ENDING' && gameState.ending) {
    return (
      <div className="min-h-screen bunker-wall text-[#dde7df] flex flex-col">
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
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
      </div>
    );
  }

  // =========================================================================
  // 3. LIVE WALKABLE 3D BUNKER GAMEPLAY WORLD
  // =========================================================================
  const broadcast = getCurrentBroadcast(gameState);
  const caps = getBunkerCapabilities(gameState);
  const todayList = gameState.schedule[gameState.day] || [];
  const modalOpen = Boolean(activeModal) || gameState.phase === 'NIGHT_SUMMARY';

  const objectiveText =
    gameState.phase === 'MORNING_RADIO'
      ? `DAY ${gameState.day} OBJECTIVE: Walk to the glowing Shortwave Radio (West Desk) and press [E] or Click to tune morning broadcast.`
      : gameState.phase === 'AIRLOCK_SHIFT' && currentInspection
      ? `AIRLOCK VISITOR ${gameState.visitorIndex + 1}/${todayList.length}: ${currentInspection.character.name} (${currentInspection.character.archetype}) — Inspect via 3D Desk Tools & Intercom, then pull a Bulkhead Lever.`
      : gameState.phase === 'NIGHT_MANAGEMENT'
      ? `SHIFT COMPLETE: Walk to the Dormitory Door or Warden Cot (East Wall) to Quarantine / Expel & Sleep.`
      : gameState.phase === 'EXTRACTION_SCAN'
      ? `DAY 10 EXTRACTION: Convoy Iron-4 is overhead! Walk to the Surface Blast Hatch (South Wall) to unseal & run bio-scan.`
      : '';

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#0b0f0d] select-none">
      {/* FULL-SCREEN 3D WALKABLE BUNKER VIEWPORT */}
      <Bunker3DViewport
        gameState={gameState}
        broadcast={broadcast}
        inspectionData={currentInspection}
        activeTool={activeTool}
        modalOpen={modalOpen}
        cameraPresetRequest={cameraPresetReq}
        onInteract={handleWorldInteract}
        onHoveredChange={setHoveredInteract}
        onPointerLockChange={setPointerLocked}
      />

      {/* ================= MINIMAL TOP BUNKER HUD (NO BACKDROP-BLUR OVER WEBGL) ================= */}
      <header className="pointer-events-auto fixed top-0 inset-x-0 z-20 bg-[#0c120f]/92 border-b border-[#283a31]">
        <div className="max-w-[1440px] mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-display text-base uppercase tracking-wider text-[#e5efe8] whitespace-nowrap">
              Shelter B-04
            </span>
            <span className="font-tech text-xs text-[#d99543] tabular-nums whitespace-nowrap">
              DAY {gameState.day}/{MAX_DAYS}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-tech text-xs tabular-nums">
            <span className={gameState.food <= 3 ? 'text-[#f27979]' : 'text-[#cad9cf]'}>
              FOOD {gameState.food}
            </span>
            <span className="text-[#384c41]" aria-hidden="true">·</span>
            <span className={gameState.water <= 3 ? 'text-[#f27979]' : 'text-[#cad9cf]'}>
              WATER {gameState.water}
            </span>
            <span className="text-[#384c41]" aria-hidden="true">·</span>
            <span className={gameState.fuel <= 2 ? 'text-[#f27979]' : 'text-[#cad9cf]'}>
              DIESEL {gameState.fuel}
            </span>
            <span className="text-[#384c41]" aria-hidden="true">·</span>
            <span className={gameState.sanity < 35 ? 'text-[#f27979]' : 'text-[#9bd4ae]'}>
              SANITY {gameState.sanity}%
            </span>
            <span className="text-[#384c41]" aria-hidden="true">·</span>
            <span className="text-[#cad9cf]">
              BUNKS {gameState.residents.length}/{MAX_RESIDENTS}
            </span>
            <span className="text-[#384c41]" aria-hidden="true">·</span>
            <span className={gameState.shiftBattery <= 20 ? 'text-[#f27979]' : 'text-[#e8b45a]'}>
              BAT {gameState.shiftBattery}%
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleAudio}
              className="px-2.5 py-1 bg-[#141e19] hover:bg-[#1f2e26] border border-[#304339] text-xs font-tech text-[#c2d4c9] flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{muted ? 'Muted' : 'Audio'}</span>
            </button>
            <button
              type="button"
              onClick={handleReturnToTitle}
              className="px-2.5 py-1 bg-[#141e19] hover:bg-[#1f2e26] border border-[#304339] text-xs font-tech text-[#c2d4c9] flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= QUIET TOP-CENTER DIEGETIC OBJECTIVE STRIP ================= */}
      {!modalOpen && objectiveText && (
        <div className="pointer-events-none fixed top-12 left-1/2 -translate-x-1/2 z-10 max-w-[92vw] px-4 py-1.5 bg-[#0c120f]/88 border border-[#2c3f35] text-center">
          <p className="font-tech text-xs text-[#d6e3da] tracking-wide">{objectiveText}</p>
        </div>
      )}

      {/* ================= ACTIVE SENSOR READOUT HUD (ONLY WHEN TOOL ACTIVE) ================= */}
      {!modalOpen &&
        gameState.phase === 'AIRLOCK_SHIFT' &&
        currentInspection &&
        (activeTool !== 'none' || currentInspection.perkAlert || gameState.sanity < 35) && (
          <div className="pointer-events-none fixed top-24 left-1/2 -translate-x-1/2 z-10 w-[min(640px,92vw)] space-y-2">
            {activeTool !== 'none' && (
              <div className="px-4 py-2.5 bg-[#0b110e]/92 border border-[#3a5245] font-tech text-xs space-y-1">
                {activeTool === 'geiger' && (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#87a896] uppercase">DP-5V Geiger-Müller Counter</span>
                      <span
                        className={`tabular-nums ${
                          currentInspection.tools.geiger.cpm === 0 ||
                          currentInspection.tools.geiger.cpm > 120
                            ? 'text-[#f27979]'
                            : 'text-[#7ae096]'
                        }`}
                      >
                        {currentInspection.tools.geiger.cpm} CPM · {currentInspection.tools.geiger.status}
                      </span>
                    </div>
                    <p className="text-[#dce7df] font-typewriter text-xs">
                      {currentInspection.tools.geiger.note}
                    </p>
                  </>
                )}
                {activeTool === 'uv' && (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#c49cf2] uppercase">UV-365nm Penlight Beam</span>
                      <span className="text-[#b58ee6]">
                        {currentInspection.tools.uv.visualFlag === 'normal' ||
                        currentInspection.tools.uv.visualFlag === 'goggles_ok'
                          ? 'PUPIL RESPONSE NORMAL'
                          : 'ANOMALY VISIBLE'}
                      </span>
                    </div>
                    <p className="text-[#e3daf0] font-typewriter text-xs">
                      {currentInspection.tools.uv.note}
                    </p>
                  </>
                )}
                {activeTool === 'thermal' && (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#e8a354] uppercase">FLIR Thermal Scanner</span>
                      <span
                        className={`tabular-nums ${
                          currentInspection.tools.thermal.tempC < 28
                            ? 'text-[#6db2f2]'
                            : 'text-[#f0a24a]'
                        }`}
                      >
                        {currentInspection.tools.thermal.tempC.toFixed(1)}°C ·{' '}
                        {currentInspection.tools.thermal.status}
                      </span>
                    </div>
                    <p className="text-[#ebe1d3] font-typewriter text-xs">
                      {currentInspection.tools.thermal.note}
                    </p>
                  </>
                )}
                {activeTool === 'zoom' && (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#9bb8a8] uppercase">Optical Viewport Magnifier (1.4x)</span>
                      <span className="text-[#7e9688]">PRESS [Z] TO EXIT ZOOM</span>
                    </div>
                    <p className="text-[#dce7df] font-typewriter text-xs">
                      {currentInspection.zoomTell}
                    </p>
                  </>
                )}
              </div>
            )}

            {currentInspection.perkAlert && (
              <div className="px-3.5 py-2 bg-[#241b10]/94 border border-[#b57b2a] text-xs font-tech text-[#f2c885]">
                {currentInspection.perkAlert}
              </div>
            )}

            {gameState.sanity < 35 && (
              <div className="px-3.5 py-1.5 bg-[#261214]/92 border border-[#8c3239] text-xs font-tech text-[#f2aeb3]">
                Low Sanity ({gameState.sanity}%): Sensory hallucinations possible — cross-check tools!
              </div>
            )}
          </div>
        )}

      {/* ================= CENTER FPS CROSSHAIR & 3D INTERACT PROMPT ================= */}
      {!modalOpen && (
        <div className="pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-center">
          <div
            className={`rounded-full transition-transform duration-150 ${
              hoveredInteract
                ? 'w-3 h-3 border-2 border-[#f0b35a] bg-[#f0b35a]/30 scale-125'
                : 'w-1.5 h-1.5 bg-[#dce8e0]/80'
            }`}
          />
          {hoveredInteract && (
            <div className="mt-4 px-3.5 py-1.5 bg-[#0b110e]/92 border border-[#d98e3b] font-tech text-xs text-[#f7dfb8] tracking-wide whitespace-nowrap">
              [E / CLICK] {hoveredInteract.label}
            </div>
          )}
        </div>
      )}

      {/* ================= STATUS TOAST ================= */}
      {toastMsg && !modalOpen && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-[#101814]/95 border border-[#4c6b5a] font-tech text-xs text-[#e0ede4] max-w-[90vw] text-center">
          {toastMsg}
        </div>
      )}

      {/* ================= COLLAPSIBLE BOTTOM CONTROL DOCK (ZERO VIEWPORT OCCLUSION) ================= */}
      {!modalOpen && (
        <div
          className="pointer-events-auto fixed bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transition-transform duration-200"
          style={{
            maxWidth: 'min(960px, 95vw)',
            transform: dockCollapsed ? 'translate(-50%, calc(100% - 30px))' : 'translate(-50%, 0)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              soundEngine.playButtonClick();
              setDockCollapsed((v) => !v);
            }}
            className="px-3.5 py-1 bg-[#0e1512]/94 border border-b-0 border-[#304439] font-tech text-[11px] text-[#9eb5a7] hover:text-[#e6f0e9] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {dockCollapsed ? 'Show Controls [H]' : 'Hide Controls [H]'} · WASD Walk ·{' '}
            {pointerLocked ? 'ESC Unlock Mouse' : 'Drag Look / Click Wall FPS'}
          </button>

          <div className="w-full px-3 py-2 bg-[#0d1411]/95 border border-[#304439] flex flex-wrap items-center justify-center gap-2">
            {/* Walk-To Room Station Presets */}
            <div className="flex items-center gap-1 pr-2 border-r border-[#26362e]">
              {[
                { key: 'radio', label: 'Radio' },
                { key: 'airlock', label: 'Airlock' },
                { key: 'dorm', label: 'Dorm' },
                { key: 'cot', label: 'Cot' },
                { key: 'hatch', label: 'Hatch' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => {
                    soundEngine.playButtonClick();
                    setCameraPresetReq({ key: st.key, seq: Date.now() });
                  }}
                  className="px-2.5 py-1.5 bg-[#15201b] hover:bg-[#203028] border border-[#2d4036] font-tech text-[11px] text-[#c3d5ca] whitespace-nowrap cursor-pointer"
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Quick Tool & Action Triggers */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => activateInspectionTool('geiger')}
                className={`px-2.5 py-1.5 border font-tech text-[11px] flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeTool === 'geiger'
                    ? 'bg-[#1d3627] border-[#5bbd78] text-[#e6f7eb]'
                    : 'bg-[#121a16] hover:bg-[#1a2620] border-[#2e4036] text-[#bfd1c6]'
                }`}
              >
                <Activity className="w-3 h-3" />
                [1] Geiger
              </button>
              <button
                type="button"
                onClick={() => activateInspectionTool('uv')}
                className={`px-2.5 py-1.5 border font-tech text-[11px] flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeTool === 'uv'
                    ? 'bg-[#2a1c3d] border-[#a855f7] text-[#efe3fc]'
                    : 'bg-[#121a16] hover:bg-[#1a2620] border-[#2e4036] text-[#bfd1c6]'
                }`}
              >
                <Flashlight className="w-3 h-3" />
                [2] UV
              </button>
              <button
                type="button"
                onClick={() => activateInspectionTool('thermal')}
                className={`px-2.5 py-1.5 border font-tech text-[11px] flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeTool === 'thermal'
                    ? 'bg-[#3b2614] border-[#d9822b] text-[#fae6cc]'
                    : 'bg-[#121a16] hover:bg-[#1a2620] border-[#2e4036] text-[#bfd1c6]'
                }`}
              >
                <Thermometer className="w-3 h-3" />
                [3] Thermal
              </button>
              <button
                type="button"
                onClick={() => activateInspectionTool('ledger')}
                className="px-2.5 py-1.5 bg-[#121a16] hover:bg-[#1a2620] border border-[#2e4036] font-tech text-[11px] text-[#bfd1c6] flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <BookOpen className="w-3 h-3" />
                [4] Ledger
              </button>
              <button
                type="button"
                onClick={() => activateInspectionTool('zoom')}
                className={`px-2.5 py-1.5 border font-tech text-[11px] flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeTool === 'zoom'
                    ? 'bg-[#1f3329] border-[#7ae096] text-[#e6f7eb]'
                    : 'bg-[#121a16] hover:bg-[#1a2620] border-[#2e4036] text-[#bfd1c6]'
                }`}
              >
                <ZoomIn className="w-3 h-3" />
                [Z] Zoom
              </button>
              <button
                type="button"
                onClick={() => handleWorldInteract('intercom')}
                className="px-2.5 py-1.5 bg-[#121a16] hover:bg-[#1a2620] border border-[#2e4036] font-tech text-[11px] text-[#bfd1c6] flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Phone className="w-3 h-3" />
                [T] Talk
              </button>
              <button
                type="button"
                onClick={() => handleWorldInteract('roster')}
                className="px-2.5 py-1.5 bg-[#121a16] hover:bg-[#1a2620] border border-[#2e4036] font-tech text-[11px] text-[#bfd1c6] flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Users className="w-3 h-3" />
                [R] Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CONTEXTUAL 3D OBJECT INTERACTION MODALS                               */}
      {/* ===================================================================== */}

      {/* A) SHORTWAVE RADIO TRANSCRIPT MODAL */}
      {activeModal === 'radio' && (
        <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="steel-panel rounded-sm max-w-3xl w-full p-6 sm:p-8 space-y-5 my-auto">
            <div className="flex items-start justify-between gap-4 border-b border-[#293b32] pb-4">
              <div>
                <p className="font-tech text-xs uppercase tracking-widest text-[#d98e3b] flex items-center gap-2">
                  <Radio className="w-4 h-4" />
                  {broadcast.frequency}
                </p>
                <h2 className="font-display text-3xl uppercase tracking-wide text-[#e8f0ea] mt-1.5">
                  Day {broadcast.day}: {broadcast.headline}
                </h2>
                <p className="font-tech text-xs text-[#8da396] mt-1">
                  {broadcast.date} · Source: {broadcast.source}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 bg-[#15201b] hover:bg-[#203028] border border-[#33473d] font-tech text-xs text-[#cad9cf] flex items-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </div>

            <div className="p-4 bg-[#0c110f] border border-[#24342c] space-y-3 text-sm text-[#d2dfd6] leading-relaxed">
              {broadcast.transcript.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            <div className="p-4 bg-[#1c1a12] border border-[#8c692b] space-y-1">
              <p className="font-tech text-xs uppercase tracking-wider text-[#e8b054]">
                Updated Screening Directive
              </p>
              <p className="text-sm text-[#f0e3c7]">{broadcast.diagnosticRule}</p>
            </div>

            {caps.radioDecoded && (
              <div className="p-3 bg-[#122119] border border-[#3c7352] text-xs font-tech text-[#9be0b3]">
                Decoded Shortwave Assist Active: Your radio/archive specialist cross-checked municipal tables—forged IDs in today’s Paper Ledger will display explicit forgery confirmation.
              </div>
            )}

            <div className="pt-3 border-t border-[#293b32] flex flex-wrap items-center justify-between gap-3">
              <span className="font-tech text-xs text-[#95ab9d]">
                {broadcast.supplyEvent.label} · Scheduled Visitors: {broadcast.visitorsCount}
              </span>
              {gameState.phase === 'MORNING_RADIO' ? (
                <button
                  type="button"
                  onClick={handleBeginShiftFromRadio}
                  className="px-6 py-3 bg-[#c77424] hover:bg-[#dc832c] text-[#0e120f] font-display text-lg uppercase tracking-wider font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  Open Airlock Shutter
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 bg-[#1c2b23] hover:bg-[#263a2f] border border-[#3e594b] font-tech text-xs uppercase text-[#e0ede4] cursor-pointer"
                >
                  Step Back From Radio
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* B) DAILY PROTOCOL CLIPBOARD MODAL */}
      {activeModal === 'protocol' && (
        <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
          <div className="paper-ledger max-w-lg w-full p-6 border-2 border-[#7d755e] space-y-4">
            <div className="flex items-center justify-between border-b border-[#8c846d] pb-2">
              <h2 className="font-display text-2xl uppercase tracking-wide text-[#7a1e1e]">
                Day {broadcast.day} Screening Protocol
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-2.5 py-1 bg-[#cfc7b0] hover:bg-[#bfb79f] font-tech text-xs text-[#1c211b] cursor-pointer"
              >
                Close [ESC]
              </button>
            </div>
            <p className="text-sm leading-relaxed font-typewriter font-bold">
              {broadcast.diagnosticRule}
            </p>
            <p className="text-xs text-[#4a5248] font-tech">
              Remember: Cross-reference multiple 3D tools on the Airlock Desk (Geiger, UV Penlight, FLIR Thermal, Paper Ledger) and listen closely on the Bakelite Intercom.
            </p>
          </div>
        </div>
      )}

      {/* C) BAKELITE INTERCOM INTERROGATION MODAL */}
      {activeModal === 'intercom' && currentInspection && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="steel-panel rounded-sm max-w-2xl w-full p-5 sm:p-6 space-y-4 my-auto">
            <div className="flex items-start justify-between gap-3 border-b border-[#293b32] pb-3">
              <div>
                <p className="font-tech text-xs uppercase tracking-wider text-[#d98e3b] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Bakelite Airlock Intercom — Live Line
                </p>
                <h2 className="font-display text-2xl uppercase tracking-wide text-[#e8f0ea] mt-1">
                  {currentInspection.character.name}
                </h2>
                <p className="font-tech text-xs text-[#90a699]">
                  Age {currentInspection.character.age} · {currentInspection.character.archetype} ·{' '}
                  {GROUP_LABELS[currentInspection.character.group]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 bg-[#15201b] hover:bg-[#203028] border border-[#33473d] font-tech text-xs text-[#cad9cf] flex items-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
                Hang Up
              </button>
            </div>

            <div className="space-y-2.5">
              {currentInspection.dialogue.map((item, idx) => {
                const asked = Boolean(askedQuestions[idx]);
                return (
                  <div key={idx} className="border border-[#26362e] bg-[#0e1411]">
                    <button
                      type="button"
                      onClick={() => {
                        const eerie =
                          currentInspection.actualAlignment === 'hostile' &&
                          currentInspection.threatKind === 'hollow';
                        soundEngine.playIntercomClick(eerie);
                        setAskedQuestions((prev) => ({ ...prev, [idx]: true }));
                      }}
                      className={`w-full px-3.5 py-2.5 text-left text-xs font-tech flex items-start justify-between gap-2 cursor-pointer ${
                        asked ? 'bg-[#18241e] text-[#cfe0d5]' : 'hover:bg-[#17221c] text-[#b4c7bc]'
                      }`}
                    >
                      <span>
                        {idx + 1}. {item.q}
                      </span>
                      <span className="text-[10px] text-[#7b9485] whitespace-nowrap shrink-0 mt-0.5">
                        {asked ? 'LOGGED' : 'ASK'}
                      </span>
                    </button>
                    {asked && (
                      <div className="px-3.5 py-2.5 border-t border-[#223029] space-y-1.5">
                        <p className="text-sm text-[#e6efe9] leading-relaxed">“{item.a}”</p>
                        <p className="text-[11px] font-tech text-[#d9a25f]">
                          Audio Observation: {item.audioTell}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#293b32] flex flex-wrap items-center justify-between gap-2">
              <span className="font-tech text-xs text-[#8ea597]">
                Hang up to inspect 3D tells or pull the wall levers:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={gameState.residents.length >= MAX_RESIDENTS}
                  onClick={() => executeAirlockDecision('ADMIT')}
                  className="px-3.5 py-2 bg-[#234a34] hover:bg-[#2c5e42] disabled:opacity-40 border border-[#4b8f67] text-[#eaf7ee] font-display text-sm uppercase tracking-wider cursor-pointer"
                >
                  Admit
                </button>
                <button
                  type="button"
                  onClick={() => executeAirlockDecision('DENY')}
                  className="px-3.5 py-2 bg-[#3d311a] hover:bg-[#524122] border border-[#a87e34] text-[#fae7c3] font-display text-sm uppercase tracking-wider cursor-pointer"
                >
                  Deny
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('purge_confirm')}
                  className="px-3.5 py-2 bg-[#4a1b1b] hover:bg-[#632323] border border-[#b83b3b] text-[#fde3e3] font-display text-sm uppercase tracking-wider cursor-pointer"
                >
                  Purge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* D) PAPER CIVIL REGISTRY LEDGER MODAL */}
      {activeModal === 'ledger' && currentInspection && (
        <div className="fixed inset-0 z-40 bg-black/72 flex items-center justify-center p-4">
          <div className="paper-ledger max-w-xl w-full p-6 border-2 border-[#7d755e] space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#877f6a] pb-3">
              <div>
                <p className="font-tech text-[11px] uppercase tracking-wider text-[#52594f]">
                  Sector 44 Civil Defense Archive · Krasnograd-9
                </p>
                <h2 className="font-display text-2xl uppercase tracking-wide text-[#1c211b] mt-0.5">
                  {currentInspection.character.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1 bg-[#cfc7b0] hover:bg-[#bfb79f] font-tech text-xs text-[#1c211b] cursor-pointer"
              >
                Close Book
              </button>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-24 h-24 shrink-0 border-2 border-[#6e6754] overflow-hidden">
                <PortraitCanvas character={currentInspection.character} compact />
              </div>
              <div className="flex-1 space-y-2.5 font-tech text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[#565e53] block text-[10px]">ID TAG</span>
                    <span className="font-bold text-sm">{currentInspection.tools.ledger.idTag}</span>
                  </div>
                  <div>
                    <span className="text-[#565e53] block text-[10px]">STATION</span>
                    <span className="font-bold text-sm">{currentInspection.tools.ledger.station}</span>
                  </div>
                  <div>
                    <span className="text-[#565e53] block text-[10px]">CODE</span>
                    <span className="font-bold text-sm">{currentInspection.tools.ledger.code}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#9e967e]">
                  <span className="text-[#565e53] block text-[10px]">REGISTRY STATUS</span>
                  <span
                    className={`font-bold text-sm ${
                      currentInspection.tools.ledger.valid ? 'text-[#1c5c2e]' : 'text-[#8c1d1d]'
                    }`}
                  >
                    {currentInspection.tools.ledger.valid
                      ? 'VERIFIED CIVIL RECORD'
                      : 'DISCREPANCY / ALERT FLAGGED'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#dbd3be] border border-[#9e967e] text-xs leading-relaxed font-typewriter">
              {currentInspection.tools.ledger.note}
            </div>
          </div>
        </div>
      )}

      {/* E) RED PURGE SWITCH CONFIRMATION MODAL */}
      {activeModal === 'purge_confirm' && currentInspection && (
        <div className="fixed inset-0 z-40 bg-black/78 flex items-center justify-center p-4">
          <div className="steel-panel max-w-md w-full p-6 border-2 border-[#b83b3b] space-y-4">
            <h2 className="font-display text-2xl uppercase tracking-wide text-[#f7c8cb] flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#ef4444]" />
              Confirm Thermal Airlock Purge
            </h2>
            <p className="text-sm text-[#e3c5c7] leading-relaxed">
              Activate decontamination incinerators on <strong>{currentInspection.character.name}</strong>? This permanently neutralizes Hollows or armed raiders, but purging an innocent human inflicts severe Warden guilt (-13 Sanity).
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-[#1a241e] hover:bg-[#24332b] font-tech text-xs uppercase text-[#c8d6cd] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeAirlockDecision('PURGE')}
                className="px-5 py-2 bg-[#a82424] hover:bg-[#c22b2b] font-tech text-xs uppercase text-white cursor-pointer"
              >
                Trigger Purge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F) DORMITORY ROSTER / NIGHT LOCKDOWN MODAL */}
      {activeModal === 'roster' && (
        <div className="fixed inset-0 z-40 bg-black/75 overflow-y-auto flex items-start justify-center py-6">
          <div className="w-full max-w-6xl px-4 relative">
            {gameState.phase === 'NIGHT_MANAGEMENT' ? (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-3.5 py-1.5 bg-[#15201b] hover:bg-[#203028] border border-[#33473d] font-tech text-xs text-[#cad9cf] flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Back To 3D Bunker
                  </button>
                </div>
                <BunkerRoster
                  state={gameState}
                  mode="night"
                  onToggleQuarantine={(id) => setGameState((p) => setQuarantineResident(p, id))}
                  onExpel={(id) => setGameState((p) => expelResident(p, id))}
                  onChangeRationMode={(m) => setGameState((p) => setRationMode(p, m))}
                  onConfirmSleep={handleConfirmSleep}
                />
              </div>
            ) : (
              <BunkerRoster
                state={gameState}
                mode="drawer"
                onCloseDrawer={() => setActiveModal(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* G) NIGHT SUMMARY INCIDENT LOG MODAL */}
      {gameState.phase === 'NIGHT_SUMMARY' && gameState.lastNightReport && (
        <div className="fixed inset-0 z-40 bg-black/82 flex items-center justify-center p-4 overflow-y-auto">
          <div className="steel-panel rounded-sm max-w-3xl w-full p-6 sm:p-8 space-y-5 my-auto">
            <div className="border-b border-[#293b32] pb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="font-tech text-xs uppercase tracking-widest text-[#8ea597]">
                  Overnight Bunker Log · 00:00 – 06:00
                </p>
                <h2 className="font-display text-3xl uppercase tracking-wide text-[#e8f0ea] mt-1">
                  Night {gameState.lastNightReport.day} Summary
                </h2>
              </div>
              <span className="font-tech text-xs text-[#9cb4a6] tabular-nums">
                Surviving Occupants: {gameState.lastNightReport.residentCount} / {MAX_RESIDENTS}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
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
                Dawn Stock: Food {gameState.food} · Water {gameState.water} · Diesel {gameState.fuel} · Sanity {gameState.sanity}%
              </p>
              <button
                type="button"
                onClick={handleProceedMorning}
                className="px-6 py-3 bg-[#c77424] hover:bg-[#dc832c] text-[#0e120f] font-display text-lg uppercase tracking-wider font-semibold flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                Wake Up — Day {gameState.day + 1}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* H) DAY 10 SURFACE HATCH EXTRACTION MODAL */}
      {activeModal === 'hatch' && gameState.phase === 'EXTRACTION_SCAN' && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="steel-panel rounded-sm max-w-3xl w-full p-6 sm:p-8 space-y-6 my-auto">
            <div className="flex items-start justify-between gap-4 border-b border-[#293b32] pb-4">
              <div>
                <p className="font-tech text-xs uppercase tracking-widest text-[#d98e3b] flex items-center gap-2">
                  <ScanLine className="w-4 h-4" />
                  DAY 10 · SURFACE HATCH · CONVOY IRON-4
                </p>
                <h2 className="font-display text-3xl uppercase tracking-wide text-[#e8f0ea] mt-1.5">
                  Final Biological Clearance Scan
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 bg-[#15201b] hover:bg-[#203028] border border-[#33473d] font-tech text-xs text-[#cad9cf] cursor-pointer"
              >
                Step Back
              </button>
            </div>

            <p className="text-sm text-[#bacbc0] leading-relaxed">
              Armored personnel carriers are idling directly overhead. Convoy Iron-4 will scan every occupant inside Shelter B-04 the moment you spin the blast wheel. If even one Hollow mimic stands inside, the hatch will be purged.
            </p>

            <div>
              <p className="font-tech text-xs uppercase tracking-wider text-[#8fa698] mb-3">
                Occupants At Surface Hatch ({gameState.residents.length} / {MAX_RESIDENTS})
              </p>
              {gameState.residents.length === 0 ? (
                <div className="p-4 bg-[#121916] border border-[#3a4a41] text-sm text-[#c7b38b]">
                  You stand completely alone beneath the hatch.
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
                        <div className="w-11 h-11 shrink-0 border border-[#364a3f]">
                          <PortraitCanvas character={char} compact />
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-sm uppercase text-[#e5efe8] truncate">
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
                className="px-7 py-3.5 bg-[#c77424] hover:bg-[#dc832c] text-[#0e120f] font-display text-lg uppercase tracking-wider font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <ScanLine className="w-5 h-5" />
                Unseal Blast Hatch & Run Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
