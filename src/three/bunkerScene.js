// Full Walkable 3D Post-Soviet Bunker Interior & Interactive Props for SHELTER B-04
import * as THREE from 'three';
import {
  createAirlockGlassTexture,
  createBulkheadSteelTexture,
  createBunkerFloorTexture,
  createMintConcreteTexture,
  createPlacardTexture,
  createProtocolBoardTexture,
  createRadioDialTexture,
} from './proceduralTextures.js';

// Collision boxes (minX, maxX, minZ, maxZ) for first-person movement inside the room
export const BUNKER_BOUNDS = {
  minX: -3.05,
  maxX: 3.05,
  minZ: -1.48,
  maxZ: 3.62,
  obstacles: [
    // West shortwave radio desk
    { minX: -3.5, maxX: -2.25, minZ: -1.35, maxZ: 0.72 },
    // East diesel generator + supply crates
    { minX: 2.15, maxX: 3.5, minZ: -2.5, maxZ: 0.12 },
    // Warden's iron cot (SE corner)
    { minX: 1.72, maxX: 3.5, minZ: 1.98, maxZ: 3.85 },
  ],
};

// Smooth quick-walk camera presets for the collapsible bottom dock
export const CAMERA_PRESETS = {
  airlock: { pos: [0, 1.62, -0.55], yaw: 0, pitch: -0.04 },
  radio: { pos: [-1.45, 1.62, -0.25], yaw: Math.PI / 2, pitch: -0.14 },
  dorm: { pos: [1.55, 1.62, 0.95], yaw: -Math.PI / 2, pitch: -0.05 },
  cot: { pos: [1.15, 1.62, 2.55], yaw: -Math.PI * 0.62, pitch: -0.22 },
  hatch: { pos: [0, 1.62, 2.35], yaw: Math.PI, pitch: 0.08 },
};

export function createBunkerScene(scene, renderer, isSoftwareGl) {
  const disposables = [];
  const interactables = []; // Invisible raycast proxy boxes (layer 1)
  const highlightMap = new Map(); // interactId -> array of meshes to glow on aim

  const track = (obj) => {
    disposables.push(obj);
    return obj;
  };

  // Register an interactive 3D object with a clean simplified proxy hitbox on Layer 1
  const addInteractProxy = (id, label, center, size, visualMeshes = []) => {
    const proxyGeo = track(new THREE.BoxGeometry(size[0], size[1], size[2]));
    const proxyMat = track(
      new THREE.MeshBasicMaterial({ visible: false })
    );
    const proxy = new THREE.Mesh(proxyGeo, proxyMat);
    proxy.position.set(center[0], center[1], center[2]);
    proxy.layers.set(1);
    proxy.userData = { interactId: id, label };
    scene.add(proxy);
    interactables.push(proxy);
    highlightMap.set(id, visualMeshes);
    return proxy;
  };

  // ==================== PROCEDURAL PBR TEXTURES & MATERIALS ====================
  const wallTex = track(createMintConcreteTexture(renderer));
  const floorTex = track(createBunkerFloorTexture(renderer));
  const steelTex = track(createBulkheadSteelTexture(renderer));
  const glassTex = track(createAirlockGlassTexture(renderer));
  const radioDialTex = track(createRadioDialTexture(renderer));

  const wallMat = track(
    new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.88,
      metalness: 0.04,
    })
  );
  const ceilingMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x222925,
      roughness: 0.95,
      metalness: 0.05,
    })
  );
  const floorMat = track(
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.85,
      metalness: 0.08,
    })
  );
  const steelMat = track(
    new THREE.MeshStandardMaterial({
      map: steelTex,
      roughness: 0.56,
      metalness: 0.62,
    })
  );
  const darkMetalMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x222925,
      roughness: 0.48,
      metalness: 0.72,
    })
  );
  const oliveMetalMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x3b4738,
      roughness: 0.62,
      metalness: 0.35,
    })
  );
  const woodDeskMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x453526,
      roughness: 0.82,
      metalness: 0.05,
    })
  );
  const brassMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x998045,
      roughness: 0.34,
      metalness: 0.82,
    })
  );

  // ==================== 1. ROOM SHELL (FLOOR, CEILING, WALLS) ====================
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(7.2, 7.2)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.7);
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(track(new THREE.PlaneGeometry(7.2, 7.2)), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 3.1, 0.7);
  scene.add(ceiling);

  // West Wall (x = -3.5)
  const westWall = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 3.1, 7.2)), wallMat);
  westWall.position.set(-3.55, 1.55, 0.7);
  westWall.receiveShadow = true;
  scene.add(westWall);

  // East Wall (x = +3.5)
  const eastWall = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 3.1, 7.2)), wallMat);
  eastWall.position.set(3.55, 1.55, 0.7);
  eastWall.receiveShadow = true;
  scene.add(eastWall);

  // South Wall (z = +4.25)
  const southWall = new THREE.Mesh(track(new THREE.BoxGeometry(7.2, 3.1, 0.18)), wallMat);
  southWall.position.set(0, 1.55, 4.25);
  southWall.receiveShadow = true;
  scene.add(southWall);

  // North Bulkhead Wall (z = -2.85) framed around Airlock Window (-0.95..+0.95, y: 1.02..2.22)
  const northLeft = new THREE.Mesh(track(new THREE.BoxGeometry(2.6, 3.1, 0.24)), steelMat);
  northLeft.position.set(-2.25, 1.55, -2.85);
  northLeft.receiveShadow = true;
  scene.add(northLeft);

  const northRight = new THREE.Mesh(track(new THREE.BoxGeometry(2.6, 3.1, 0.24)), steelMat);
  northRight.position.set(2.25, 1.55, -2.85);
  northRight.receiveShadow = true;
  scene.add(northRight);

  const northBottom = new THREE.Mesh(track(new THREE.BoxGeometry(1.9, 1.02, 0.24)), steelMat);
  northBottom.position.set(0, 0.51, -2.85);
  northBottom.receiveShadow = true;
  scene.add(northBottom);

  const northTop = new THREE.Mesh(track(new THREE.BoxGeometry(1.9, 0.88, 0.24)), steelMat);
  northTop.position.set(0, 2.66, -2.85);
  scene.add(northTop);

  // Thick riveted window frame molding
  const frameTop = new THREE.Mesh(track(new THREE.BoxGeometry(2.04, 0.09, 0.34)), darkMetalMat);
  frameTop.position.set(0, 2.24, -2.84);
  const frameBot = new THREE.Mesh(track(new THREE.BoxGeometry(2.04, 0.09, 0.36)), darkMetalMat);
  frameBot.position.set(0, 1.0, -2.84);
  const frameL = new THREE.Mesh(track(new THREE.BoxGeometry(0.09, 1.32, 0.34)), darkMetalMat);
  frameL.position.set(-0.98, 1.62, -2.84);
  const frameR = new THREE.Mesh(track(new THREE.BoxGeometry(0.09, 1.32, 0.34)), darkMetalMat);
  frameR.position.set(0.98, 1.62, -2.84);
  scene.add(frameTop, frameBot, frameL, frameR);

  // Reinforced Airlock Glass Pane (depthWrite: false so 3D visitor behind is always crisp!)
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xb7d4c6,
      map: glassTex,
      transparent: true,
      opacity: isSoftwareGl ? 0.24 : 0.32,
      roughness: 0.22,
      metalness: 0.05,
      transmission: 0,
      depthWrite: false,
    })
  );
  const airlockGlass = new THREE.Mesh(track(new THREE.PlaneGeometry(1.9, 1.2)), glassMat);
  airlockGlass.position.set(0, 1.62, -2.82);
  airlockGlass.renderOrder = 5;
  scene.add(airlockGlass);

  // Animated Heavy Steel Blast Shutter (slides up when shift starts, drops between phases)
  const shutterMesh = new THREE.Mesh(track(new THREE.BoxGeometry(1.92, 1.24, 0.08)), steelMat);
  shutterMesh.position.set(0, 1.62, -2.93);
  scene.add(shutterMesh);

  addInteractProxy('window', 'Airlock Viewport — Optical Zoom (1.4x)', [0, 1.62, -2.75], [1.9, 1.2, 0.3], [
    frameTop,
    frameBot,
    frameL,
    frameR,
  ]);

  // Overhead industrial ventilation pipes & flickering fluorescent light housings
  const pipeGeo = track(new THREE.CylinderGeometry(0.06, 0.06, 7.0, 10));
  [-2.1, 2.1].forEach((px) => {
    const pipe = new THREE.Mesh(pipeGeo, darkMetalMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(px, 2.94, 0.7);
    scene.add(pipe);
  });

  const tubeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd9f0e2,
      emissive: 0xb4dbc4,
      emissiveIntensity: 1.6,
      roughness: 0.2,
    })
  );
  [-0.6, 2.2].forEach((fz) => {
    const housing = new THREE.Mesh(track(new THREE.BoxGeometry(1.4, 0.07, 0.22)), darkMetalMat);
    housing.position.set(0, 3.04, fz);
    const tube = new THREE.Mesh(track(new THREE.CylinderGeometry(0.025, 0.025, 1.28, 8)), tubeMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.set(0, 2.98, fz);
    scene.add(housing, tube);
  });

  // ==================== 2. EXTERIOR DECONTAMINATION VESTIBULE & FALLING ASH ====================
  const extConcreteMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x26221e,
      roughness: 0.96,
      metalness: 0.04,
    })
  );
  const extFloor = new THREE.Mesh(track(new THREE.PlaneGeometry(4.4, 3.2)), extConcreteMat);
  extFloor.rotation.x = -Math.PI / 2;
  extFloor.position.set(0, 0, -4.45);
  extFloor.receiveShadow = true;
  scene.add(extFloor);

  const extBackWall = new THREE.Mesh(track(new THREE.BoxGeometry(4.4, 3.1, 0.2)), extConcreteMat);
  extBackWall.position.set(0, 1.55, -5.6);
  extBackWall.receiveShadow = true;
  scene.add(extBackWall);

  const extLeftWall = new THREE.Mesh(track(new THREE.BoxGeometry(0.2, 3.1, 3.0)), extConcreteMat);
  extLeftWall.position.set(-2.1, 1.55, -4.3);
  const extRightWall = new THREE.Mesh(track(new THREE.BoxGeometry(0.2, 3.1, 3.0)), extConcreteMat);
  extRightWall.position.set(2.1, 1.55, -4.3);
  const extCeil = new THREE.Mesh(track(new THREE.PlaneGeometry(4.4, 3.2)), extConcreteMat);
  extCeil.rotation.x = Math.PI / 2;
  extCeil.position.set(0, 3.1, -4.45);
  scene.add(extLeftWall, extRightWall, extCeil);

  // Exterior sodium-vapor streetlamp bulb fixture
  const sodiumBulbMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffb35c,
      emissive: 0xe68020,
      emissiveIntensity: 2.2,
    })
  );
  const sodiumLamp = new THREE.Mesh(track(new THREE.BoxGeometry(0.45, 0.08, 0.14)), sodiumBulbMat);
  sodiumLamp.position.set(0.65, 2.72, -4.2);
  scene.add(sodiumLamp);

  // Falling 3D Black Radioactive Ash Particles in exterior vestibule
  const ashCount = 180;
  const ashPositions = new Float32Array(ashCount * 3);
  const ashSpeeds = new Float32Array(ashCount);
  for (let i = 0; i < ashCount; i++) {
    ashPositions[i * 3] = (Math.random() - 0.5) * 3.4;
    ashPositions[i * 3 + 1] = Math.random() * 2.9;
    ashPositions[i * 3 + 2] = -3.1 - Math.random() * 2.2;
    ashSpeeds[i] = 0.22 + Math.random() * 0.35;
  }
  const ashGeo = track(new THREE.BufferGeometry());
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3));
  const ashMat = track(
    new THREE.PointsMaterial({
      color: 0x161412,
      size: 0.045,
      transparent: true,
      opacity: 0.82,
    })
  );
  const ashPoints = new THREE.Points(ashGeo, ashMat);
  scene.add(ashPoints);

  // Visitor Anchor Group inside exterior vestibule
  const visitorMount = new THREE.Group();
  visitorMount.position.set(0, 0, -3.55);
  scene.add(visitorMount);

  // ==================== 3. AIRLOCK CONTROL DESK & 4 INSPECTION TOOLS ====================
  const deskGroup = new THREE.Group();
  const deskTop = new THREE.Mesh(track(new THREE.BoxGeometry(2.35, 0.08, 0.78)), woodDeskMat);
  deskTop.position.set(0, 0.86, -2.26);
  deskTop.castShadow = true;
  deskTop.receiveShadow = true;
  deskGroup.add(deskTop);
  [-1.08, 1.08].forEach((lx) => {
    const leg = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.84, 0.68)), darkMetalMat);
    leg.position.set(lx, 0.42, -2.26);
    deskGroup.add(leg);
  });
  scene.add(deskGroup);

  // 3A. DP-5V Geiger Counter (composite 5-part olive Soviet meter)
  const geigerGroup = new THREE.Group();
  geigerGroup.position.set(-0.68, 0.90, -2.18);
  const gBody = new THREE.Mesh(track(new THREE.BoxGeometry(0.26, 0.12, 0.18)), oliveMetalMat);
  gBody.position.y = 0.06;
  const gFace = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.16, 0.08)),
    track(new THREE.MeshStandardMaterial({ color: 0x1b2e21, emissive: 0x2c6e42, emissiveIntensity: 0.6 }))
  );
  gFace.position.set(-0.02, 0.122, 0.01);
  gFace.rotation.x = -Math.PI / 2;
  const gNeedle = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.008, 0.005, 0.06)),
    track(new THREE.MeshBasicMaterial({ color: 0xf25c54 }))
  );
  gNeedle.position.set(-0.02, 0.126, 0.01);
  const gWand = new THREE.Mesh(track(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 10)), brassMat);
  gWand.rotation.z = Math.PI / 2;
  gWand.position.set(0.02, 0.03, 0.14);
  geigerGroup.add(gBody, gFace, gNeedle, gWand);
  scene.add(geigerGroup);
  addInteractProxy('geiger', 'DP-5V Geiger Counter (-10% Battery)', [-0.68, 0.98, -2.14], [0.36, 0.24, 0.34], [gBody, gWand]);

  // 3B. UV-365nm Penlight Torch
  const uvGroup = new THREE.Group();
  uvGroup.position.set(-0.22, 0.90, -2.12);
  const uvTube = new THREE.Mesh(track(new THREE.CylinderGeometry(0.024, 0.022, 0.24, 12)), darkMetalMat);
  uvTube.rotation.x = Math.PI / 2;
  uvTube.position.y = 0.026;
  const uvLens = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.026, 0.024, 0.03, 12)),
    track(new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x9333ea, emissiveIntensity: 0.9 }))
  );
  uvLens.rotation.x = Math.PI / 2;
  uvLens.position.set(0, 0.026, -0.13);
  const uvCollar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.027, 0.027, 0.02, 12)), brassMat);
  uvCollar.rotation.x = Math.PI / 2;
  uvCollar.position.set(0, 0.026, -0.09);
  uvGroup.add(uvTube, uvLens, uvCollar);
  scene.add(uvGroup);
  addInteractProxy('uv', 'UV-365nm Penlight (-15% Battery)', [-0.22, 0.96, -2.12], [0.22, 0.2, 0.34], [uvTube, uvLens]);

  // 3C. Soviet FLIR Thermal Scanner
  const thermGroup = new THREE.Group();
  thermGroup.position.set(0.24, 0.90, -2.14);
  const tBox = new THREE.Mesh(track(new THREE.BoxGeometry(0.20, 0.14, 0.22)), darkMetalMat);
  tBox.position.y = 0.07;
  const tLens = new THREE.Mesh(track(new THREE.CylinderGeometry(0.048, 0.052, 0.06, 14)), brassMat);
  tLens.rotation.x = Math.PI / 2;
  tLens.position.set(0, 0.075, -0.12);
  const tScreen = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.14, 0.09)),
    track(new THREE.MeshStandardMaterial({ color: 0x3b2210, emissive: 0xd9822b, emissiveIntensity: 0.7 }))
  );
  tScreen.position.set(0, 0.075, 0.112);
  const tHandle = new THREE.Mesh(track(new THREE.BoxGeometry(0.04, 0.04, 0.16)), oliveMetalMat);
  tHandle.position.set(0, 0.16, 0);
  thermGroup.add(tBox, tLens, tScreen, tHandle);
  scene.add(thermGroup);
  addInteractProxy('thermal', 'FLIR Thermal Scanner (-15% Battery)', [0.24, 1.0, -2.14], [0.3, 0.26, 0.34], [tBox, tHandle]);

  // 3D. Open Paper Civil Registry Ledger
  const ledgerGroup = new THREE.Group();
  ledgerGroup.position.set(0.76, 0.90, -2.15);
  ledgerGroup.rotation.y = -0.15;
  const lCover = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.38, 0.025, 0.28)),
    track(new THREE.MeshStandardMaterial({ color: 0x4a2920, roughness: 0.85 }))
  );
  lCover.position.y = 0.013;
  const lPages = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.35, 0.022, 0.25)),
    track(new THREE.MeshStandardMaterial({ color: 0xe0d8c0, roughness: 0.92 }))
  );
  lPages.position.y = 0.028;
  const lRibbon = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.015, 0.005, 0.27)),
    track(new THREE.MeshStandardMaterial({ color: 0xa32626, roughness: 0.7 }))
  );
  lRibbon.position.set(0, 0.042, 0.02);
  ledgerGroup.add(lCover, lPages, lRibbon);
  scene.add(ledgerGroup);
  addInteractProxy('ledger', 'Civil Registry Paper Ledger (Free)', [0.76, 0.96, -2.15], [0.44, 0.18, 0.34], [lCover, lPages]);

  // ==================== 4. BAKELITE INTERCOM & BULKHEAD DECISION LEVERS ====================
  // Left of window: Bakelite Intercom Box
  const intercomGroup = new THREE.Group();
  intercomGroup.position.set(-1.35, 1.48, -2.71);
  const icBox = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.34, 0.12)), darkMetalMat);
  const icGrill = new THREE.Mesh(track(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 14)), brassMat);
  icGrill.rotation.x = Math.PI / 2;
  icGrill.position.set(0, 0.06, 0.065);
  const icHandset = new THREE.Mesh(
    track(new THREE.CapsuleGeometry(0.028, 0.2, 6, 10)),
    track(new THREE.MeshStandardMaterial({ color: 0x161414, roughness: 0.28, metalness: 0.12 }))
  );
  icHandset.position.set(-0.15, 0, 0.04);
  intercomGroup.add(icBox, icGrill, icHandset);
  scene.add(intercomGroup);
  addInteractProxy('intercom', 'Bakelite Intercom — Interrogate Visitor', [-1.35, 1.48, -2.65], [0.46, 0.45, 0.28], [icBox, icHandset]);

  // Right of window: ADMIT / DENY / PURGE Physical Levers
  const leverPanel = new THREE.Mesh(track(new THREE.BoxGeometry(0.74, 0.44, 0.1)), darkMetalMat);
  leverPanel.position.set(1.42, 1.44, -2.71);
  scene.add(leverPanel);

  const leverDefs = [
    { id: 'admit', label: 'GREEN LEVER — ADMIT VISITOR', x: 1.18, color: 0x2f854d, emissive: 0x1c5932 },
    { id: 'deny', label: 'AMBER LEVER — DENY VISITOR', x: 1.42, color: 0xc28329, emissive: 0x6b4510 },
    { id: 'purge', label: 'RED SWITCH — PURGE AIRLOCK', x: 1.66, color: 0xb82c2c, emissive: 0x691414 },
  ];
  const leverHandles = {};
  leverDefs.forEach((ld) => {
    const base = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.24, 0.05)), steelMat);
    base.position.set(ld.x, 1.44, -2.65);
    const stem = new THREE.Mesh(track(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8)), brassMat);
    stem.position.set(ld.x, 1.48, -2.59);
    stem.rotation.x = 0.5;
    const knob = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.036, 12, 10)),
      track(new THREE.MeshStandardMaterial({ color: ld.color, emissive: ld.emissive, emissiveIntensity: 0.75, roughness: 0.35 }))
    );
    knob.position.set(ld.x, 1.54, -2.54);
    scene.add(base, stem, knob);
    leverHandles[ld.id] = knob;
    addInteractProxy(ld.id, ld.label, [ld.x, 1.46, -2.58], [0.22, 0.42, 0.26], [knob, base]);
  });

  // Airlock bulkhead placard above window
  const airlockSignTex = track(createPlacardTexture(renderer, 'SHELTER B-04', 'AIRLOCK SECTOR 44 · KRASNOGRAD-9', '#d9822b'));
  const airlockSign = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.5, 0.46)),
    track(new THREE.MeshStandardMaterial({ map: airlockSignTex, roughness: 0.65 }))
  );
  airlockSign.position.set(0, 2.62, -2.72);
  scene.add(airlockSign);

  // ==================== 5. WEST WALL: REEL-TO-REEL SHORTWAVE RADIO & PROTOCOL BOARD ====================
  const radioDesk = new THREE.Mesh(track(new THREE.BoxGeometry(0.85, 0.07, 1.75)), woodDeskMat);
  radioDesk.position.set(-2.96, 0.85, -0.25);
  radioDesk.castShadow = true;
  radioDesk.receiveShadow = true;
  scene.add(radioDesk);
  [-0.98, 0.48].forEach((rz) => {
    const leg = new THREE.Mesh(track(new THREE.BoxGeometry(0.75, 0.82, 0.07)), darkMetalMat);
    leg.position.set(-2.96, 0.41, rz);
    scene.add(leg);
  });

  // Composite Soviet Reel-to-Reel Shortwave Radio
  const radioGroup = new THREE.Group();
  radioGroup.position.set(-2.98, 0.89, -0.25);
  radioGroup.rotation.y = Math.PI / 2;

  const rChassis = new THREE.Mesh(track(new THREE.BoxGeometry(0.72, 0.42, 0.34)), oliveMetalMat);
  rChassis.position.y = 0.21;
  rChassis.castShadow = true;

  const rDial = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.56, 0.14)),
    track(new THREE.MeshStandardMaterial({ map: radioDialTex, emissive: 0x8f5919, emissiveIntensity: 0.65 }))
  );
  rDial.position.set(0, 0.16, 0.174);

  // Spinning Magnetic Tape Reels
  const reelGeo = track(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16));
  const reelHubGeo = track(new THREE.BoxGeometry(0.18, 0.036, 0.025));
  const reelL = new THREE.Group();
  reelL.position.set(-0.18, 0.48, 0.06);
  reelL.rotation.x = Math.PI / 2;
  reelL.add(new THREE.Mesh(reelGeo, darkMetalMat), new THREE.Mesh(reelHubGeo, brassMat));

  const reelR = new THREE.Group();
  reelR.position.set(0.18, 0.48, 0.06);
  reelR.rotation.x = Math.PI / 2;
  reelR.add(new THREE.Mesh(reelGeo, darkMetalMat), new THREE.Mesh(reelHubGeo, brassMat));

  // Radio active indicator beacon
  const radioLampMat = track(
    new THREE.MeshStandardMaterial({ color: 0xf5a638, emissive: 0xd9822b, emissiveIntensity: 1.4 })
  );
  const radioLamp = new THREE.Mesh(track(new THREE.SphereGeometry(0.028, 10, 10)), radioLampMat);
  radioLamp.position.set(0.28, 0.35, 0.175);

  radioGroup.add(rChassis, rDial, reelL, reelR, radioLamp);
  scene.add(radioGroup);
  addInteractProxy('radio', 'Shortwave Reel-to-Reel Radio — Listen to Broadcast', [-2.92, 1.2, -0.25], [0.65, 0.72, 0.92], [rChassis, radioLamp]);

  // Dynamic Protocol Clipboard on West Wall (updates texture daily!)
  const protocolMat = track(
    new THREE.MeshStandardMaterial({
      map: track(createProtocolBoardTexture(renderer, 1, 'Verify civil tags and Geiger readings.')),
      roughness: 0.85,
    })
  );
  const protocolBoard = new THREE.Mesh(track(new THREE.BoxGeometry(0.04, 0.68, 0.88)), protocolMat);
  protocolBoard.position.set(-3.43, 1.68, 1.25);
  scene.add(protocolBoard);
  addInteractProxy('protocol', 'Daily Screening Protocol Board', [-3.38, 1.68, 1.25], [0.22, 0.78, 0.96], [protocolBoard]);

  // ==================== 6. EAST WALL: DIESEL GENERATOR, SUPPLIES, DORMITORY DOOR & COT ====================
  // D-144 Diesel Generator
  const genGroup = new THREE.Group();
  genGroup.position.set(2.85, 0, -1.62);
  const genBlock = new THREE.Mesh(track(new THREE.BoxGeometry(0.86, 0.78, 1.15)), oliveMetalMat);
  genBlock.position.y = 0.44;
  genBlock.castShadow = true;
  const genTank = new THREE.Mesh(track(new THREE.CylinderGeometry(0.2, 0.2, 0.85, 14)), darkMetalMat);
  genTank.rotation.x = Math.PI / 2;
  genTank.position.set(0.06, 0.96, 0);
  const genPipe = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 10)), darkMetalMat);
  genPipe.position.set(0.28, 2.0, -0.35);
  const genLampMat = track(new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 1.4 }));
  const genLamp = new THREE.Mesh(track(new THREE.SphereGeometry(0.035, 10, 10)), genLampMat);
  genLamp.position.set(-0.44, 0.68, 0.25);
  genGroup.add(genBlock, genTank, genPipe, genLamp);
  scene.add(genGroup);

  // Stacked Supply Crates & Water Cistern
  const crateMat = track(new THREE.MeshStandardMaterial({ color: 0x594832, roughness: 0.9 }));
  const crate1 = new THREE.Mesh(track(new THREE.BoxGeometry(0.58, 0.42, 0.58)), crateMat);
  crate1.position.set(2.96, 0.21, -0.45);
  const crate2 = new THREE.Mesh(track(new THREE.BoxGeometry(0.46, 0.36, 0.46)), crateMat);
  crate2.position.set(2.98, 0.60, -0.48);
  crate2.rotation.y = 0.22;
  const waterTank = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.28, 0.28, 1.05, 16)),
    track(new THREE.MeshStandardMaterial({ color: 0x5c6e69, roughness: 0.45, metalness: 0.65 }))
  );
  waterTank.position.set(2.96, 0.525, 0.16);
  scene.add(crate1, crate2, waterTank);

  // Dormitory Steel Bulkhead Door + Roster Clipboard (East Wall, z = 1.15)
  const dormDoor = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 2.25, 1.08)), steelMat);
  dormDoor.position.set(3.41, 1.125, 1.15);
  const dormWheel = new THREE.Mesh(track(new THREE.TorusGeometry(0.16, 0.024, 8, 16)), brassMat);
  dormWheel.rotation.y = Math.PI / 2;
  dormWheel.position.set(3.31, 1.18, 0.92);
  const dormSignTex = track(createPlacardTexture(renderer, 'DORMITORY', 'MAX 6 OCCUPANTS · QUARANTINE', '#6ee787'));
  const dormSign = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.74, 0.32)),
    track(new THREE.MeshStandardMaterial({ map: dormSignTex, roughness: 0.65 }))
  );
  dormSign.rotation.y = -Math.PI / 2;
  dormSign.position.set(3.32, 1.78, 1.15);
  scene.add(dormDoor, dormWheel, dormSign);
  addInteractProxy('roster', 'Dormitory Door — Inspect Bunker Roster & Quarantine', [3.26, 1.25, 1.15], [0.42, 2.2, 1.16], [dormDoor, dormWheel]);

  // Warden's Iron Sleeping Cot (SE Corner)
  const cotGroup = new THREE.Group();
  cotGroup.position.set(2.58, 0, 2.98);
  const cotFrame = new THREE.Mesh(track(new THREE.BoxGeometry(1.12, 0.12, 1.88)), darkMetalMat);
  cotFrame.position.y = 0.44;
  const cotMattress = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.02, 0.18, 1.78)),
    track(new THREE.MeshStandardMaterial({ color: 0x3b4d3e, roughness: 0.95 }))
  );
  cotMattress.position.y = 0.56;
  const cotPillow = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.76, 0.12, 0.36)),
    track(new THREE.MeshStandardMaterial({ color: 0xc2bcab, roughness: 0.92 }))
  );
  cotPillow.position.set(0, 0.69, 0.65);
  const cotHeadboard = new THREE.Mesh(track(new THREE.BoxGeometry(1.12, 0.72, 0.06)), darkMetalMat);
  cotHeadboard.position.set(0, 0.62, 0.92);
  cotGroup.add(cotFrame, cotMattress, cotPillow, cotHeadboard);
  scene.add(cotGroup);
  addInteractProxy('cot', 'Warden Cot — Night Lockdown & Sleep', [2.58, 0.65, 2.98], [1.26, 0.95, 1.98], [cotMattress, cotPillow]);

  // ==================== 7. SOUTH WALL: SURFACE EXTRACTION HATCH & LADDER ====================
  const hatchGroup = new THREE.Group();
  hatchGroup.position.set(0, 0, 4.1);
  const hatchRing = new THREE.Mesh(track(new THREE.CylinderGeometry(0.68, 0.72, 0.16, 20)), steelMat);
  hatchRing.rotation.x = Math.PI / 2;
  hatchRing.position.set(0, 1.75, 0);
  const hatchWheel = new THREE.Mesh(track(new THREE.TorusGeometry(0.24, 0.03, 8, 16)), brassMat);
  hatchWheel.position.set(0, 1.75, -0.1);
  const hatchSignTex = track(createPlacardTexture(renderer, 'SURFACE HATCH', 'DAY 10 EXTRACTION CONVOY IRON-4', '#d9822b'));
  const hatchSign = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.3, 0.4)),
    track(new THREE.MeshStandardMaterial({ map: hatchSignTex, roughness: 0.65 }))
  );
  hatchSign.rotation.y = Math.PI;
  hatchSign.position.set(0, 2.66, -0.02);

  // Iron ladder rails
  [-0.24, 0.24].forEach((lx) => {
    const rail = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8)), darkMetalMat);
    rail.position.set(lx, 0.75, -0.14);
    hatchGroup.add(rail);
  });
  for (let r = 0; r < 5; r++) {
    const rung = new THREE.Mesh(track(new THREE.CylinderGeometry(0.015, 0.015, 0.48, 8)), darkMetalMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.25 + r * 0.28, -0.14);
    hatchGroup.add(rung);
  }
  const hatchBeaconMat = track(new THREE.MeshStandardMaterial({ color: 0x6b2814, emissive: 0x000000, emissiveIntensity: 0 }));
  const hatchBeacon = new THREE.Mesh(track(new THREE.SphereGeometry(0.075, 12, 10)), hatchBeaconMat);
  hatchBeacon.position.set(0, 2.38, -0.08);

  hatchGroup.add(hatchRing, hatchWheel, hatchSign, hatchBeacon);
  scene.add(hatchGroup);
  addInteractProxy('hatch', 'Surface Extraction Blast Hatch (Day 10)', [0, 1.55, 3.92], [1.45, 2.4, 0.45], [hatchRing, hatchWheel]);

  // ==================== 8. LIGHTING RIG (WARM/COOL + SODIUM EXTERIOR + UV SPOTLIGHT) ====================
  const hemiLight = new THREE.HemisphereLight(0x88b09b, 0x1c1712, 0.55);
  scene.add(hemiLight);

  // Main overhead bunker fluorescent PointLight (flickers subtly at 50Hz)
  const mainCeilingLight = new THREE.PointLight(0xd2ebd9, 4.4, 14, 1.5);
  mainCeilingLight.position.set(0, 2.75, 0.4);
  if (!isSoftwareGl) {
    mainCeilingLight.castShadow = true;
    mainCeilingLight.shadow.mapSize.set(1024, 1024);
    mainCeilingLight.shadow.bias = -0.0005;
  }
  scene.add(mainCeilingLight);

  // Warm desk lamp over airlock console
  const deskLight = new THREE.PointLight(0xffcb8a, 1.65, 5.5, 1.7);
  deskLight.position.set(0, 1.85, -1.85);
  scene.add(deskLight);

  // Eerie sickly sodium-vapor orange streetlamp inside exterior airlock vestibule
  const exteriorSodiumLight = new THREE.PointLight(0xf08c2b, 5.2, 10, 1.4);
  exteriorSodiumLight.position.set(0.35, 2.45, -3.55);
  scene.add(exteriorSodiumLight);

  // Subtle rim backlight behind visitor to silhouette hair & multi-limbed shadows
  const exteriorRimLight = new THREE.PointLight(0xd96b1f, 2.8, 7, 1.6);
  exteriorRimLight.position.set(-0.4, 1.8, -4.65);
  scene.add(exteriorRimLight);

  // Phase objective spotlight beacon (moves to Radio, Cot, or Hatch depending on game phase!)
  const beaconLight = new THREE.PointLight(0xf59e0b, 1.8, 4.2, 1.6);
  beaconLight.position.set(-2.5, 1.65, -0.25);
  scene.add(beaconLight);

  // Dynamic UV-365nm Penlight SpotLight (switched on when UV tool active!)
  const uvSpotLight = new THREE.SpotLight(0xa855f7, 0, 8, Math.PI / 5.5, 0.5, 1.4);
  uvSpotLight.position.set(0, 1.55, -1.9);
  uvSpotLight.target.position.set(0, 1.48, -3.55);
  scene.add(uvSpotLight);
  scene.add(uvSpotLight.target);

  // Helper to update the daily protocol board texture cleanly
  const updateProtocolBoard = (day, ruleText) => {
    const oldMap = protocolMat.map;
    protocolMat.map = createProtocolBoardTexture(renderer, day, ruleText);
    protocolMat.needsUpdate = true;
    if (oldMap) oldMap.dispose();
  };

  // Helper to update phase indicators, shutter target, fuel lamp, and supply props
  let shutterTargetY = 1.62;
  const syncBunkerWorldState = ({ phase, fuel, food, water, activeTool, geigerCpm }) => {
    // Shutter opens during AIRLOCK_SHIFT, closes during Radio / Night
    shutterTargetY = phase === 'AIRLOCK_SHIFT' ? 2.86 : 1.62;

    // Generator status lamp
    if (fuel > 0) {
      genLampMat.color.setHex(0x4ade80);
      genLampMat.emissive.setHex(0x22c55e);
    } else {
      genLampMat.color.setHex(0xef4444);
      genLampMat.emissive.setHex(0xdc2626);
    }

    // Crate/water visibility scales subtly with supply stocks
    crate2.visible = food >= 8;
    crate1.visible = food >= 1;
    waterTank.scale.y = Math.max(0.45, Math.min(1.05, 0.45 + (water / 20) * 0.6));

    // Phase guidance beacon light
    if (phase === 'MORNING_RADIO') {
      beaconLight.position.set(-2.5, 1.65, -0.25);
      beaconLight.color.setHex(0xf59e0b);
      beaconLight.intensity = 2.6;
      radioLampMat.emissiveIntensity = 2.2;
      hatchBeaconMat.emissive.setHex(0x000000);
      hatchBeaconMat.emissiveIntensity = 0;
    } else if (phase === 'NIGHT_MANAGEMENT') {
      beaconLight.position.set(2.4, 1.45, 2.55);
      beaconLight.color.setHex(0x60a5fa);
      beaconLight.intensity = 2.2;
      radioLampMat.emissiveIntensity = 0.4;
      hatchBeaconMat.emissive.setHex(0x000000);
      hatchBeaconMat.emissiveIntensity = 0;
    } else if (phase === 'EXTRACTION_SCAN') {
      beaconLight.position.set(0, 2.2, 3.5);
      beaconLight.color.setHex(0xf59e0b);
      beaconLight.intensity = 3.5;
      hatchBeaconMat.emissive.setHex(0xf59e0b);
      hatchBeaconMat.emissiveIntensity = 2.5;
    } else {
      beaconLight.intensity = 0;
      radioLampMat.emissiveIntensity = 0.6;
      hatchBeaconMat.emissive.setHex(0x000000);
      hatchBeaconMat.emissiveIntensity = 0;
    }

    // UV spotlight activation
    uvSpotLight.intensity = activeTool === 'uv' ? 14.0 : 0;

    // Geiger counter needle rotation
    const cpmRatio = Math.min(1, (geigerCpm || 0) / 240);
    gNeedle.rotation.y = -0.9 + cpmRatio * 1.8;
  };

  // Per-frame animations (zero GC allocations)
  const animateBunker = (dt, elapsed, { fuel, phase, activeTool }) => {
    // 1. Smooth blast shutter damping
    shutterMesh.position.y = THREE.MathUtils.damp(shutterMesh.position.y, shutterTargetY, 4.5, dt);

    // 2. Spinning shortwave tape reels
    const reelSpeed = phase === 'MORNING_RADIO' ? 2.6 : 0.45;
    reelL.rotation.y += dt * reelSpeed;
    reelR.rotation.y += dt * reelSpeed;

    // 3. Subtle diesel generator chug vibration when fuel > 0
    if (fuel > 0) {
      genBlock.position.x = Math.sin(elapsed * 42) * 0.003;
      genBlock.position.y = 0.44 + Math.cos(elapsed * 37) * 0.002;
    }

    // 4. Overhead 50Hz fluorescent tube occasional flicker
    const flickerWave = Math.sin(elapsed * 2.1) * Math.sin(elapsed * 19.3);
    const baseFluoro = fuel > 0 ? 4.3 : 1.7;
    if (flickerWave > 0.93) {
      mainCeilingLight.intensity = baseFluoro * 0.58;
      tubeMat.emissiveIntensity = 0.7;
    } else {
      mainCeilingLight.intensity = baseFluoro;
      tubeMat.emissiveIntensity = fuel > 0 ? 1.55 : 0.45;
    }

    // 5. Exterior sodium lamp pulse / thermal dim
    exteriorSodiumLight.intensity =
      activeTool === 'thermal'
        ? 0.4
        : activeTool === 'uv'
        ? 1.5
        : 5.0 + Math.sin(elapsed * 3.7) * 0.25;

    // 6. Animate falling black ash particles outside the airlock glass
    const posAttr = ashGeo.attributes.position;
    for (let i = 0; i < ashCount; i++) {
      let y = posAttr.getY(i) - ashSpeeds[i] * dt;
      let x = posAttr.getX(i) + Math.sin(elapsed * 0.7 + i) * 0.05 * dt;
      if (y < 0.05) {
        y = 2.95;
        x = (Math.random() - 0.5) * 3.4;
      }
      posAttr.setXY(i, x, y);
    }
    posAttr.needsUpdate = true;
  };

  // Highlight aimed interactable object cleanly
  let prevHighlightId = null;
  const setHighlightedInteractable = (interactId) => {
    if (prevHighlightId === interactId) return;
    if (prevHighlightId && highlightMap.has(prevHighlightId)) {
      highlightMap.get(prevHighlightId).forEach((m) => {
        if (m.userData._savedEmissiveHex !== undefined && m.material?.emissive) {
          m.material.emissive.setHex(m.userData._savedEmissiveHex);
          m.material.emissiveIntensity = m.userData._savedEmissiveInt;
        }
      });
    }
    prevHighlightId = interactId;
    if (interactId && highlightMap.has(interactId)) {
      highlightMap.get(interactId).forEach((m) => {
        if (m.material?.emissive) {
          if (m.userData._savedEmissiveHex === undefined) {
            m.userData._savedEmissiveHex = m.material.emissive.getHex();
            m.userData._savedEmissiveInt = m.material.emissiveIntensity ?? 0;
          }
          m.material.emissive.setHex(0x476956);
          m.material.emissiveIntensity = Math.max(0.55, m.userData._savedEmissiveInt + 0.35);
        }
      });
    }
  };

  const disposeBunker = () => {
    disposables.forEach((d) => {
      if (d && typeof d.dispose === 'function') d.dispose();
    });
  };

  return {
    visitorMount,
    interactables,
    leverHandles,
    updateProtocolBoard,
    syncBunkerWorldState,
    animateBunker,
    setHighlightedInteractable,
    disposeBunker,
  };
}
