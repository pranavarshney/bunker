// Pure JS State Machine for SHELTER B-04: THE CHITIN FALL
import { CHARACTERS, CHARACTER_MAP } from '../data/characters.js';
import { BROADCASTS } from '../data/broadcasts.js';

export const SAVE_KEY = 'shelter_b04_save_v1';
export const MAX_RESIDENTS = 6;
export const MAX_DAYS = 10;

export const TOOL_BATTERY_COST = {
  geiger: 10,
  uv: 15,
  thermal: 15,
  ledger: 0,
  zoom: 5,
};

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Initialize a brand-new 10-day run with randomized alignments (70% standard / 30% inverted)
export function createNewGameState() {
  const runSeed = Math.floor(Math.random() * 1000000);
  const alignments = {};

  CHARACTERS.forEach((char) => {
    const roll = Math.random();
    const useStandard = roll < 0.7;
    alignments[char.id] = useStandard
      ? char.standardAlignment
      : char.standardAlignment === 'friendly'
      ? 'hostile'
      : 'friendly';
  });

  // Guarantee at least 1 friendly on Day 1 so the opening isn't unwinnable
  const scriptedByDay = {};
  const nonScriptedIds = [];

  CHARACTERS.forEach((char) => {
    if (char.scriptedDay) {
      if (!scriptedByDay[char.scriptedDay]) scriptedByDay[char.scriptedDay] = [];
      scriptedByDay[char.scriptedDay].push(char.id);
    } else {
      nonScriptedIds.push(char.id);
    }
  });

  // Split pool to keep pacing tense: Days 1-3 slightly more humans, Days 4-10 escalating mimics
  const friendlyPool = shuffle(nonScriptedIds.filter((id) => alignments[id] === 'friendly'));
  const hostilePool = shuffle(nonScriptedIds.filter((id) => alignments[id] === 'hostile'));

  const pullFromPool = (preferFriendly) => {
    if (preferFriendly && friendlyPool.length > 0) return friendlyPool.pop();
    if (!preferFriendly && hostilePool.length > 0) return hostilePool.pop();
    if (friendlyPool.length > 0) return friendlyPool.pop();
    if (hostilePool.length > 0) return hostilePool.pop();
    return null;
  };

  const schedule = {};
  for (let day = 1; day <= MAX_DAYS; day++) {
    const count = BROADCASTS[day - 1].visitorsCount;
    const dayIds = [...(scriptedByDay[day] || [])];
    const friendlyRatio = day <= 2 ? 0.72 : day <= 5 ? 0.58 : 0.48;

    while (dayIds.length < count) {
      const pickFriendly = Math.random() < friendlyRatio;
      const nextId = pullFromPool(pickFriendly);
      if (!nextId) break;
      dayIds.push(nextId);
    }
    schedule[day] = shuffle(dayIds);
  }

  return {
    version: 1,
    runSeed,
    phase: 'MORNING_RADIO', // TITLE | MORNING_RADIO | AIRLOCK_SHIFT | NIGHT_MANAGEMENT | NIGHT_SUMMARY | EXTRACTION_SCAN | ENDING
    day: 1,
    visitorIndex: 0,
    food: 20,
    water: 20,
    fuel: 15,
    sanity: 90,
    zeroFuelStreak: 0,
    shiftBattery: 100,
    rationMode: 'NORMAL',
    alignments,
    schedule,
    residents: [],
    quarantinedId: null,
    expelledIds: [],
    encounterHistory: [],
    nightLogs: [],
    lastNightReport: null,
    dailySupplyBanner: null,
    stats: {
      admitted: 0,
      denied: 0,
      purged: 0,
      correctDecisions: 0,
      wrongDecisions: 0,
      nightsSurvived: 0,
      casualties: 0,
    },
    ending: null,
  };
}

export function getCurrentBroadcast(state) {
  return BROADCASTS[clamp(state.day - 1, 0, BROADCASTS.length - 1)];
}

export function getCurrentVisitorId(state) {
  const list = state.schedule[state.day] || [];
  return list[state.visitorIndex] || null;
}

// Compute active bunker perks from non-quarantined friendly residents
export function getBunkerCapabilities(state) {
  const caps = {
    geigerCalibrated: false,
    mimicDetector: false,
    radioDecoded: false,
    extractionBoost: false,
    defenseCount: 0,
    healerCount: 0,
    batteryBonus: 0,
    activePerkOwners: [],
  };

  state.residents.forEach((res) => {
    if (res.id === state.quarantinedId) return;
    if (res.alignment !== 'friendly') return;
    const char = CHARACTER_MAP[res.id];
    if (!char) return;
    const eff = char.friendlyData.nightEffect || {};
    if (eff.geigerCalibrate) caps.geigerCalibrated = true;
    if (eff.mimicDetect) caps.mimicDetector = true;
    if (eff.radioDecode) caps.radioDecoded = true;
    if (eff.extractionBoost) caps.extractionBoost = true;
    if (eff.defense) caps.defenseCount += 1;
    if (eff.heal) caps.healerCount += 1;
    if (eff.batteryBonus) caps.batteryBonus += eff.batteryBonus;
    caps.activePerkOwners.push(char.name);
  });

  return caps;
}

// Retrieve active visitor data with optional low-sanity hallucination drift & resident perk hints
export function getVisitorInspectionData(state, charId) {
  const char = CHARACTER_MAP[charId];
  if (!char) return null;

  const actualAlignment = state.alignments[charId] || char.standardAlignment;
  const raw = actualAlignment === 'friendly' ? char.friendlyData : char.hostileData;
  const caps = getBunkerCapabilities(state);

  // Clone tools so we can safely annotate perk assists or low-sanity hallucinations
  const tools = {
    geiger: { ...raw.tools.geiger },
    uv: { ...raw.tools.uv },
    thermal: { ...raw.tools.thermal },
    ledger: { ...raw.tools.ledger },
  };

  let perkAlert = null;
  if (caps.geigerCalibrated && actualAlignment === 'hostile' && raw.threatKind === 'hollow') {
    tools.geiger.note += ' [CALIBRATED PROBE: CONFIRMED CHITIN BETA-ABSORPTION]';
    perkAlert = 'Dr. Chernysheva’s calibrated Geiger probe detects unmistakable Hollow signature.';
  } else if (caps.geigerCalibrated && actualAlignment === 'friendly') {
    tools.geiger.note += ' [CALIBRATED PROBE: CLEAN HUMAN SIGNATURE]';
  }

  if (caps.mimicDetector && actualAlignment === 'hostile') {
    perkAlert =
      perkAlert ||
      (raw.threatKind === 'hollow'
        ? 'Bunker Bio-Alert: Resident sensors (fern / 19kHz coil / log check) flag a Hollow anomaly!'
        : 'Bunker Alert: Resident cross-check warns this visitor’s story does not hold up.');
  }

  if (caps.radioDecoded && !tools.ledger.valid) {
    tools.ledger.note += ' [DECODED RELAY CONFIRMS FORGERY]';
  }

  // Self-Doubt Mechanic: When sanity < 35, 28% chance of hallucinating a false flaw on a friendly human
  let hallucinatedTool = null;
  if (state.sanity < 35 && actualAlignment === 'friendly') {
    const seed = hashSeed(`${state.runSeed}-${state.day}-${charId}`);
    if (seed % 100 < 28) {
      const mode = seed % 2;
      if (mode === 0) {
        hallucinatedTool = 'thermal';
        tools.thermal = {
          tempC: 23.4,
          status: 'GLITCH / COLD?',
          note: 'Display flickers cold—your eyes are watering from fatigue. Cross-check another instrument!',
          glitched: true,
        };
      } else {
        hallucinatedTool = 'uv';
        tools.uv = {
          visualFlag: 'ash_veins',
          note: 'Shadows shift under the glass like black veins... or is it condensation playing tricks on you?',
          glitched: true,
        };
      }
    }
  }

  return {
    character: char,
    actualAlignment,
    threatKind: actualAlignment === 'hostile' ? raw.threatKind : 'human',
    dialogue: raw.dialogue,
    tools,
    zoomTell: raw.zoomTell,
    zoomFlag: actualAlignment === 'hostile' ? raw.zoomFlag : null,
    perkAlert,
    hallucinatedTool,
    admitSupply: actualAlignment === 'friendly' ? raw.admitSupply : null,
  };
}

// Start the airlock shift after reading the morning radio broadcast
export function startAirlockShift(state) {
  const broadcast = getCurrentBroadcast(state);
  const ev = broadcast.supplyEvent || { food: 0, water: 0, fuel: 0, sanity: 0 };
  const caps = getBunkerCapabilities(state);
  const baseBattery = state.fuel > 0 ? 100 : 50;

  return {
    ...state,
    phase: 'AIRLOCK_SHIFT',
    visitorIndex: 0,
    food: Math.max(0, state.food + (ev.food || 0)),
    water: Math.max(0, state.water + (ev.water || 0)),
    fuel: Math.max(0, state.fuel + (ev.fuel || 0)),
    sanity: clamp(state.sanity + (ev.sanity || 0), 0, 100),
    shiftBattery: clamp(baseBattery + caps.batteryBonus, 35, 100),
    dailySupplyBanner: ev.label,
  };
}

export function spendShiftBattery(state, amount) {
  return {
    ...state,
    shiftBattery: Math.max(0, state.shiftBattery - amount),
  };
}

// Process ADMIT, DENY, or PURGE for current visitor
export function resolveAirlockDecision(state, decision) {
  const charId = getCurrentVisitorId(state);
  if (!charId) return state;

  const char = CHARACTER_MAP[charId];
  const actualAlignment = state.alignments[charId] || char.standardAlignment;
  const isHostile = actualAlignment === 'hostile';
  const threatKind = isHostile ? char.hostileData.threatKind : 'human';

  let { food, water, fuel, sanity } = state;
  const residents = [...state.residents];
  const stats = { ...state.stats };
  let decisionFeedback = '';

  if (decision === 'ADMIT') {
    if (residents.length >= MAX_RESIDENTS) {
      return state; // Bunker full safeguard
    }
    stats.admitted += 1;
    if (!isHostile) {
      stats.correctDecisions += 1;
      const sup = char.friendlyData.admitSupply || { food: 0, water: 0, fuel: 0 };
      food += sup.food || 0;
      water += sup.water || 0;
      fuel += sup.fuel || 0;
      sanity = clamp(sanity + 2, 0, 100);
      decisionFeedback = `${char.name} entered Shelter B-04.${
        sup.food || sup.water || sup.fuel
          ? ` Shared supplies (+${sup.food}F / +${sup.water}W / +${sup.fuel}D).`
          : ''
      }`;
    } else {
      stats.wrongDecisions += 1;
      // Hostiles still look normal on entry! Don't spoil immediately
      decisionFeedback = `${char.name} stepped through the decontamination hatch and claimed an empty bunk.`;
    }

    const turnsInDays =
      isHostile && char.hostileData.nightThreat?.turnsInDays
        ? char.hostileData.nightThreat.turnsInDays
        : null;

    residents.push({
      id: charId,
      dayAdmitted: state.day,
      alignment: actualAlignment,
      threatKind,
      health: 'STABLE',
      turnsRemaining: turnsInDays,
      observedNote: null,
    });
  } else if (decision === 'DENY') {
    stats.denied += 1;
    if (!isHostile) {
      stats.wrongDecisions += 1;
      const guilt = char.group === 5 || char.group === 1 ? 3 : 2;
      sanity = clamp(sanity - guilt, 0, 100);
      decisionFeedback = `Outer shutter slammed shut. ${char.name} vanished back into the sodium-lit ash.`;
    } else {
      stats.correctDecisions += 1;
      sanity = clamp(sanity + 2, 0, 100);
      decisionFeedback = `Deadbolt locked. ${char.name} lingered by the fogged glass before retreating down the tunnel.`;
    }
  } else if (decision === 'PURGE') {
    stats.purged += 1;
    if (isHostile) {
      stats.correctDecisions += 1;
      sanity = clamp(sanity + 3, 0, 100);
      // Salvage 1 unit of fuel or food from neutralized threat occasionally
      if (threatKind === 'raider' || threatKind === 'saboteur') {
        fuel += 1;
        decisionFeedback = `Airlock purge triggered. Threat neutralized — salvaged 1 diesel canister from the vestibule.`;
      } else {
        decisionFeedback = `Thermal purge cycle complete. Black chitin ash washed down the airlock floor drain.`;
      }
    } else {
      stats.wrongDecisions += 1;
      sanity = clamp(sanity - 13, 0, 100);
      decisionFeedback = `Thermal purge cycle complete. Only ordinary wool and human bone remained in the vestibule...`;
    }
  }

  const encounterHistory = [
    ...state.encounterHistory,
    {
      day: state.day,
      charId,
      name: char.name,
      decision,
      actualAlignment,
      threatKind,
    },
  ];

  const todayList = state.schedule[state.day] || [];
  const nextIndex = state.visitorIndex + 1;
  const shiftFinished = nextIndex >= todayList.length;

  let nextPhase = 'AIRLOCK_SHIFT';
  if (shiftFinished) {
    nextPhase = state.day >= MAX_DAYS ? 'EXTRACTION_SCAN' : 'NIGHT_MANAGEMENT';
  }

  return {
    ...state,
    food,
    water,
    fuel,
    sanity,
    residents,
    stats,
    encounterHistory,
    visitorIndex: shiftFinished ? state.visitorIndex : nextIndex,
    phase: nextPhase,
    lastDecisionFeedback: decisionFeedback,
  };
}

// Night Management Actions: Quarantine or Expel a resident, toggle rations
export function setQuarantineResident(state, charId) {
  return {
    ...state,
    quarantinedId: state.quarantinedId === charId ? null : charId,
  };
}

export function setRationMode(state, mode) {
  return {
    ...state,
    rationMode: mode,
  };
}

export function expelResident(state, charId) {
  const target = state.residents.find((r) => r.id === charId);
  if (!target) return state;

  const char = CHARACTER_MAP[charId];
  const remaining = state.residents.filter((r) => r.id !== charId);
  const sanityDelta = target.alignment === 'friendly' ? -9 : 4;

  return {
    ...state,
    residents: remaining,
    quarantinedId: state.quarantinedId === charId ? null : state.quarantinedId,
    expelledIds: [...state.expelledIds, charId],
    sanity: clamp(state.sanity + sanityDelta, 0, 100),
    encounterHistory: [
      ...state.encounterHistory,
      {
        day: state.day,
        charId,
        name: char?.name || charId,
        decision: 'EXPELLED',
        actualAlignment: target.alignment,
        threatKind: target.threatKind,
      },
    ],
  };
}

// Resolve Overnight Cycle
export function resolveNightPhase(state) {
  let { food, water, fuel, sanity, zeroFuelStreak } = state;
  let residents = state.residents.map((r) => ({ ...r }));
  const stats = { ...state.stats, nightsSurvived: state.stats.nightsSurvived + 1 };
  const events = [];
  let hadHorror = false;

  const caps = getBunkerCapabilities(state);
  let remainingDefenses = caps.defenseCount;

  // 1. Resource Consumption
  const half = state.rationMode === 'HALF';
  const foodNeed = 1 + (half ? Math.floor(residents.length * 0.3) : Math.ceil(residents.length * 0.4));
  const waterNeed = 1 + (half ? Math.floor(residents.length * 0.3) : Math.ceil(residents.length * 0.4));
  const fuelNeed = residents.length >= 4 ? 2 : 1;

  food -= foodNeed;
  water -= waterNeed;
  fuel -= fuelNeed;

  events.push({
    kind: 'resource',
    text: `Nightly upkeep consumed ${foodNeed} Food, ${waterNeed} Water, and ${fuelNeed} Diesel (${
      half ? 'Half Rations active: -6 Sanity' : 'Standard Rations'
    }).`,
  });

  if (half) {
    sanity = clamp(sanity - 6, 0, 100);
  }

  // Quarantine morale cost + observation result
  if (state.quarantinedId) {
    const qRes = residents.find((r) => r.id === state.quarantinedId);
    if (qRes) {
      const qChar = CHARACTER_MAP[qRes.id];
      sanity = clamp(sanity - 3, 0, 100);
      if (qRes.alignment === 'hostile') {
        qRes.health = 'SUSPICIOUS';
        qRes.observedNote =
          qRes.threatKind === 'hollow'
            ? 'Quarantine log: Glass frosted inward; black ash residue left on the alcove drain!'
            : 'Quarantine log: Caught attempting to tamper with the alcove lock at 03:00!';
        events.push({
          kind: 'warning',
          text: `QUARANTINE RESULT — ${qChar.name}: ${qRes.observedNote}`,
        });
      } else {
        qRes.observedNote = 'Quarantine log: Slept shivering in the cold alcove. Confirmed warm human breath.';
        events.push({
          kind: 'info',
          text: `QUARANTINE RESULT — ${qChar.name}: ${qRes.observedNote}`,
        });
      }
    }
  }

  // 2. Friendly Resident Perks
  residents.forEach((res) => {
    if (res.id === state.quarantinedId) return;
    if (res.alignment !== 'friendly') return;
    const char = CHARACTER_MAP[res.id];
    const eff = char.friendlyData.nightEffect || {};
    if (eff.food) food += eff.food;
    if (eff.water) water += eff.water;
    if (eff.fuel) fuel += eff.fuel;
    if (eff.sanity) sanity = clamp(sanity + eff.sanity, 0, 100);
    if (eff.message) {
      events.push({ kind: 'perk', text: eff.message });
    }
  });

  // 3. Hostile Resident Threats (Hollows, Raiders, Saboteurs, Infected, Cultists)
  const hostiles = residents.filter(
    (r) => r.alignment === 'hostile' && r.id !== state.quarantinedId
  );

  for (const hostile of hostiles) {
    const hChar = CHARACTER_MAP[hostile.id];
    const threat = hChar.hostileData.nightThreat;

    // Delayed infection turn (e.g., Dr. Bogdan or Emil)
    if (hostile.turnsRemaining !== null && hostile.turnsRemaining > 1) {
      hostile.turnsRemaining -= 1;
      hostile.health = 'RAD_SICK';
      hostile.observedNote = 'Severe black-vein fever worsening overnight. Urgent quarantine advised!';
      events.push({
        kind: 'warning',
        text: `${hChar.name} coughed black dust all night. Dark veins are spreading above their collar.`,
      });
      continue;
    }

    // Check if an active friendly guard intercepts the threat
    if (remainingDefenses > 0) {
      remainingDefenses -= 1;
      hostile.health = 'SUSPICIOUS';
      hostile.observedNote = 'Caught red-handed during the night by bunker security!';
      sanity = clamp(sanity - 5, 0, 100);
      hadHorror = true;
      events.push({
        kind: 'defense',
        text: `SECURITY INTERCEPT: Bunker guards caught ${hChar.name} prowling the dark corridor and drove them back before anyone was killed! Expel them immediately!`,
      });
      continue;
    }

    // Threat lands!
    hadHorror = true;
    if (threat.foodLoss) food -= threat.foodLoss;
    if (threat.waterLoss) water -= threat.waterLoss;
    if (threat.fuelLoss) fuel -= threat.fuelLoss;
    if (threat.sanityLoss) sanity = clamp(sanity - threat.sanityLoss, 0, 100);

    if (threat.kills && threat.kills > 0) {
      let killsLeft = threat.kills;
      while (killsLeft > 0) {
        const victim = residents.find(
          (r) => r.id !== hostile.id && r.alignment === 'friendly'
        );
        if (victim) {
          const vChar = CHARACTER_MAP[victim.id];
          if (caps.healerCount > 0 && threat.type !== 'hollow_kill' && killsLeft === 1) {
            victim.health = 'WOUNDED';
            events.push({
              kind: 'horror',
              text: `${threat.message} Medical staff barely stabilized ${vChar.name} before sunrise!`,
            });
          } else {
            residents = residents.filter((r) => r.id !== victim.id);
            stats.casualties += 1;
            events.push({
              kind: 'horror',
              text: `${threat.message} (${vChar.name} did not survive the night.)`,
            });
          }
        } else {
          // No friendly victims left — hostile directly damages Warden sanity & supplies
          sanity = clamp(sanity - 18, 0, 100);
          events.push({
            kind: 'horror',
            text: `${threat.message} Something scratched relentlessly at your locked control booth door until dawn.`,
          });
        }
        killsLeft -= 1;
      }
    } else {
      events.push({ kind: 'horror', text: threat.message });
    }

    // Raider/saboteur escapes after robbing/sabotaging
    if (threat.type === 'raider_rob' || threat.type === 'gang_raid' || threat.type === 'raider_slaughter') {
      residents = residents.filter((r) => r.id !== hostile.id);
    } else {
      hostile.health = 'SUSPICIOUS';
      hostile.observedNote = 'Strong evidence links this occupant to last night’s incident!';
    }
  }

  // 4. Shortages & Generator Fuel Check
  if (food < 0) {
    food = 0;
    sanity = clamp(sanity - 14, 0, 100);
    events.push({ kind: 'warning', text: 'STARVATION: Canned rations ran dry overnight. Desperation grips the bunkroom (-14 Sanity).' });
  }
  if (water < 0) {
    water = 0;
    sanity = clamp(sanity - 16, 0, 100);
    events.push({ kind: 'warning', text: 'DEHYDRATION: Clean water cistern ran dry. Lips cracked and tempers flared (-16 Sanity).' });
  }
  if (fuel <= 0) {
    fuel = 0;
    zeroFuelStreak += 1;
    sanity = clamp(sanity - 10, 0, 100);
    events.push({
      kind: 'warning',
      text: 'GENERATOR BLACKOUT: Diesel tanks hit empty. Emergency batteries barely held the air scrubbers (-10 Sanity).',
    });
  } else {
    zeroFuelStreak = 0;
  }

  // If bunker is completely empty and quiet, add isolation dread
  if (residents.length === 0) {
    sanity = clamp(sanity - 4, 0, 100);
    events.push({
      kind: 'info',
      text: 'The six empty cots echo in the hum of the fluorescent tubes. Total isolation weighs on your mind (-4 Sanity).',
    });
  }

  // 5. Check Early Fail-State Endings
  const remainingHollows = residents.filter(
    (r) => r.alignment === 'hostile' && (r.threatKind === 'hollow' || r.threatKind === 'infected')
  );
  const remainingHumans = residents.filter((r) => r.alignment === 'friendly');

  let ending = null;

  if (remainingHollows.length >= 2 && remainingHollows.length >= remainingHumans.length) {
    ending = {
      code: 'THE_NEST',
      title: 'THE NEST',
      subtitle: 'SHELTER B-04 COMPROMISED — INTERNAL TAKEOVER',
      tone: 'horror',
      summary: `On the night of Day ${state.day}, the Hollows inside Shelter B-04 outnumbered the living. They sealed you inside the airlock booth from the outside, pressed cold palms against the fogged glass, and tuned your shortwave radio to broadcast your voice down the metro tunnels—luring the next wave of warm refugees straight into the dark.`,
    };
  } else if (
    (sanity <= 0 && residents.length > 0) ||
    (food === 0 && water === 0 && residents.length >= 2)
  ) {
    ending = {
      code: 'MUTINY',
      title: 'MUTINY IN SECTOR 44',
      subtitle: 'COMMAND COLLAPSE — INTERNAL UPRISING',
      tone: 'danger',
      summary:
        sanity <= 0
          ? `By Day ${state.day}, paranoia and sleeplessness shattered your grip on Shelter B-04. Seeing chitin shadows in every reflection, you triggered the lockdown sirens until the terrified survivors pried open the control booth door and relieved you of command.`
          : `Starving and dehydrated behind sealed steel, the occupants of Shelter B-04 broke into the Airlock Control Booth before sunrise. In the chaos, the outer hatch was cranked open to the freezing ash.`,
    };
  } else if (zeroFuelStreak >= 3 || (food === 0 && water === 0 && residents.length === 0)) {
    ending = {
      code: 'THE_TOMB',
      title: 'THE TOMB',
      subtitle: 'LIFE SUPPORT EXHAUSTED — FROZEN SILENCE',
      tone: 'bleak',
      summary: `Without diesel to spin the oxygen scrubbers or rations to outlast the black winter, Shelter B-04 fell silent on Day ${state.day}. Frost crept inward over the analog dials until the concrete bunker became just another sealed crypt beneath Krasnograd-9.`,
    };
  }

  const report = {
    day: state.day,
    events,
    hadHorror,
    foodAfter: food,
    waterAfter: water,
    fuelAfter: fuel,
    sanityAfter: sanity,
    residentCount: residents.length,
  };

  if (ending) {
    return {
      ...state,
      food,
      water,
      fuel,
      sanity,
      zeroFuelStreak,
      residents,
      quarantinedId: null,
      stats,
      lastNightReport: report,
      nightLogs: [...state.nightLogs, report],
      phase: 'ENDING',
      ending,
    };
  }

  return {
    ...state,
    food,
    water,
    fuel,
    sanity,
    zeroFuelStreak,
    residents,
    quarantinedId: null,
    stats,
    lastNightReport: report,
    nightLogs: [...state.nightLogs, report],
    phase: 'NIGHT_SUMMARY',
  };
}

export function proceedToNextMorning(state) {
  const nextDay = Math.min(MAX_DAYS, state.day + 1);
  return {
    ...state,
    day: nextDay,
    visitorIndex: 0,
    phase: 'MORNING_RADIO',
  };
}

// Day 10 Final Armored Convoy Biological Scan & Ending Evaluation
export function resolveDay10Extraction(state) {
  const hollowsInside = state.residents.filter(
    (r) => r.alignment === 'hostile' && (r.threatKind === 'hollow' || r.threatKind === 'infected')
  );
  const humanHostilesInside = state.residents.filter(
    (r) => r.alignment === 'hostile' && r.threatKind !== 'hollow' && r.threatKind !== 'infected'
  );
  const friendlyHumans = state.residents.filter((r) => r.alignment === 'friendly');
  const caps = getBunkerCapabilities(state);

  let ending;

  if (hollowsInside.length > 0) {
    const culpritNames = hollowsInside
      .map((r) => CHARACTER_MAP[r.id]?.name)
      .filter(Boolean)
      .join(', ');
    ending = {
      code: 'THE_NEST',
      title: 'THE NEST — CONTAINMENT PURGE',
      subtitle: 'CONVOY IRON-4 BIOLOGICAL SCAN FAILED',
      tone: 'horror',
      summary: `When the heavy blast doors of Shelter B-04 unsealed on Day 10, Convoy Iron-4’s thermal and chitin-spore scanners screamed red. ${culpritNames} had survived inside your walls. Under Containment Protocol Zero, the armored carriers welded the surface hatch shut and purged the stairwell with incendiary rounds.`,
    };
  } else if (friendlyHumans.length === 0 && !caps.extractionBoost) {
    ending = {
      code: 'THE_TOMB',
      title: 'THE TOMB',
      subtitle: 'SINGLE LIFE-SIGN DETECTED — EXTRACTION ABORTED',
      tone: 'bleak',
      summary: `You hoarded every tin of food and slammed the steel door on every pleading face in Krasnograd-9. You survived to Day 10 completely alone—only to hear Convoy Iron-4’s diesel engines idle briefly above the hatch, register a single isolated life-sign without a priority beacon, and roll onward into the ash. The radio never crackled again.`,
    };
  } else if (humanHostilesInside.length > 0 || state.sanity <= 12) {
    const culpritNames = humanHostilesInside
      .map((r) => CHARACTER_MAP[r.id]?.name)
      .filter(Boolean)
      .join(', ');
    ending = {
      code: 'MUTINY',
      title: 'MUTINY AT THE HATCH',
      subtitle: 'BREAKDOWN DURING SURFACE EXTRACTION',
      tone: 'danger',
      summary:
        humanHostilesInside.length > 0
          ? `As the surface blast doors groaned open, ${culpritNames} drew a concealed weapon and seized the stairwell in a desperate bid to hijack the convoy transport. A chaotic firefight erupted inside the airlock, leaving Shelter B-04 in smoke.`
          : `After ten sleepless days beneath flickering tubes, your sanity broke the instant sunlight hit the ash. Convoy medics pulled you restrained from the booth while the survivors scrambled into the armored transports.`,
    };
  } else {
    const survivorNames = friendlyHumans.map((r) => CHARACTER_MAP[r.id]?.name).join(', ');
    ending = {
      code: 'CLEAN_EXTRACTION',
      title: 'CLEAN EXTRACTION',
      subtitle: 'CONVOY IRON-4 BIOLOGICAL CLEARANCE PASSED',
      tone: 'victory',
      summary: `Green lamps blinked across the armored convoy’s bio-scanners. Zero chitin spores. Zero anomalies. You led ${
        friendlyHumans.length > 0
          ? `${friendlyHumans.length} verified human survivor${friendlyHumans.length > 1 ? 's' : ''} (${survivorNames})`
          : 'yourself via verified priority beacon'
      } out of Shelter B-04 and into the heated troop carriers. Behind you, Krasnograd-9 vanished into the freezing orange ash.`,
    };
  }

  return {
    ...state,
    phase: 'ENDING',
    ending,
  };
}

// LocalStorage Persistence
export function saveGameState(state) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadGameState() {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.alignments || !parsed.schedule) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearGameState() {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore
  }
}
