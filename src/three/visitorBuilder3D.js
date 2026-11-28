// Composite 3D Procedural Visitor Builder for all 46 SHELTER B-04 Characters
// Builds a multi-part THREE.Group (10-16 distinct meshes) reflecting each character's
// build, clothing, hair/headgear, eyewear, facial hair, scars, and held 3D prop,
// PLUS dynamic UV Penlight, FLIR Thermal, and Optical Zoom horror tells!

import * as THREE from 'three';

function hexColor(str, fallback = 0x888888) {
  try {
    return new THREE.Color(str);
  } catch {
    return new THREE.Color(fallback);
  }
}

export function buildVisitor3D(character, inspectionData) {
  const root = new THREE.Group();
  root.name = `visitor_${character.id}`;

  const app = character.appearance;
  const uvFlag = inspectionData?.tools?.uv?.visualFlag || 'normal';
  const zoomFlag = inspectionData?.zoomFlag || null;
  const thermalTemp = inspectionData?.tools?.thermal?.tempC ?? 36.6;
  const isCold = thermalTemp < 28;
  const neverBlinks =
    uvFlag === 'no_blink' || app.scar === 'vitiligo_heterochromia';

  // Proportions driven by build & gender
  const isBroad = ['broad', 'sturdy', 'massive', 'stocky', 'bulky', 'hunched_giant'].includes(app.build);
  const isGaunt = ['gaunt', 'frail', 'slim', 'elongated', 'hunched_small'].includes(app.build);
  const isGiant = app.build === 'hunched_giant' || app.build === 'massive';
  const isSmall = app.build === 'hunched_small';
  const isTall = app.build === 'tall';

  const bodyScaleY = isGiant ? 1.12 : isTall ? 1.07 : isSmall ? 0.86 : 1.0;
  const shoulderW = isBroad ? 0.56 : isGaunt ? 0.40 : 0.47;
  const neckH = app.build === 'elongated' ? 0.16 : 0.10;
  const headY = 1.48 * bodyScaleY;

  // Track materials so we can cleanly swap Thermal / UV / Normal states & dispose later
  const thermalTracked = [];
  const uvRevealNodes = [];
  const zoomRevealNodes = [];
  const eyelidNodes = [];
  const pupilNodes = [];
  const scleraNodes = [];

  const registerMat = (mat, thermalRole = 'body') => {
    thermalTracked.push({
      mat,
      origColor: mat.color.clone(),
      origEmissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
      origEmissiveIntensity: mat.emissiveIntensity ?? 0,
      origRoughness: mat.roughness ?? 0.7,
      thermalRole, // 'skin' | 'coat' | 'hair' | 'hotProp' | 'coldProp'
    });
    return mat;
  };

  const skinMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: hexColor(app.skinTone, 0xd9bfa8),
      roughness: 0.78,
      metalness: 0.02,
    }),
    'skin'
  );

  const coatMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: hexColor(app.coatColor, 0x3f4739),
      roughness: 0.9,
      metalness: 0.06,
    }),
    'coat'
  );

  const hairMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: hexColor(app.hairColor, 0x2c231e),
      roughness: 0.88,
      metalness: 0.04,
    }),
    'hair'
  );

  const darkTrimMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x1a1d1b,
      roughness: 0.72,
      metalness: 0.25,
    }),
    'coat'
  );

  // ==================== 1. TORSO, SHOULDERS & ARMS ====================
  const torsoGroup = new THREE.Group();
  root.add(torsoGroup);

  // Main winter coat / jacket torso (tapered cylinder + rounded shoulders)
  const torsoH = 0.76 * bodyScaleY;
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(shoulderW * 0.44, shoulderW * 0.56, torsoH, 14),
    coatMat
  );
  torso.position.y = headY - 0.18 - torsoH * 0.5;
  torso.castShadow = true;
  torso.receiveShadow = true;
  torsoGroup.add(torso);

  // Sculpted shoulder yoke
  const shoulders = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.11, shoulderW * 0.68, 6, 12),
    coatMat
  );
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.y = headY - 0.22;
  shoulders.castShadow = true;
  torsoGroup.add(shoulders);

  // Coat lapel / collar detail
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.125, 0.036, 8, 16),
    app.outfit === 'fur_coat'
      ? registerMat(new THREE.MeshStandardMaterial({ color: 0x6e574c, roughness: 0.98 }), 'coat')
      : coatMat
  );
  collar.rotation.x = Math.PI / 2 + 0.16;
  collar.position.set(0, headY - 0.15, 0.02);
  torsoGroup.add(collar);

  // Outfit-specific secondary details
  if (app.outfit === 'officer_greatcoat' || app.outfit === 'kgb_overcoat' || app.outfit === 'greatcoat') {
    const boardMat = registerMat(new THREE.MeshStandardMaterial({ color: 0x856f3b, roughness: 0.5, metalness: 0.45 }), 'coat');
    [-1, 1].forEach((side) => {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.06), boardMat);
      ep.position.set(side * (shoulderW * 0.38), headY - 0.12, 0.01);
      torsoGroup.add(ep);
    });
  } else if (app.outfit === 'butcher_apron' || app.outfit === 'apron_coat' || app.outfit === 'waxed_apron') {
    const apronMat = registerMat(
      new THREE.MeshStandardMaterial({
        color: app.outfit === 'butcher_apron' ? 0x692626 : 0x7d7668,
        roughness: 0.55,
      }),
      'coat'
    );
    const apron = new THREE.Mesh(new THREE.BoxGeometry(shoulderW * 0.66, 0.52, 0.04), apronMat);
    apron.position.set(0, headY - 0.48, 0.16);
    torsoGroup.add(apron);
  } else if (app.outfit === 'tracksuit') {
    const stripeMat = registerMat(new THREE.MeshStandardMaterial({ color: 0xd6dcd6, roughness: 0.8 }), 'coat');
    [-1, 1].forEach((side) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.45, 0.04), stripeMat);
      s.position.set(side * (shoulderW * 0.46), headY - 0.42, 0.02);
      torsoGroup.add(s);
    });
  }

  // Arms hanging / raised slightly toward the airlock glass
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.42, 6, 10), coatMat);
    arm.position.set(side * (shoulderW * 0.52), headY - 0.46, 0.05);
    arm.rotation.z = side * 0.09;
    arm.rotation.x = -0.18;
    torsoGroup.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), skinMat);
    hand.position.set(side * (shoulderW * 0.54), headY - 0.72, 0.12);
    torsoGroup.add(hand);
  });

  // Lower legs (grounded to floor y = 0)
  const legH = Math.max(0.55, headY - 0.18 - torsoH);
  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.068, legH, 10), darkTrimMat);
    leg.position.set(side * 0.11, legH * 0.5, 0);
    torsoGroup.add(leg);
  });

  // ==================== 2. NECK & HEAD GROUP ====================
  const headGroup = new THREE.Group();
  headGroup.position.set(0, headY, app.build === 'hunched_giant' || isSmall ? 0.08 : 0.02);
  root.add(headGroup);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.068, neckH + 0.06, 12), skinMat);
  neck.position.set(0, -0.13, -0.01);
  headGroup.add(neck);

  // Sculpted Head (slightly elongated oval)
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 18), skinMat);
  headMesh.scale.set(isGaunt ? 0.88 : isBroad ? 1.04 : 0.94, 1.14, 0.96);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.058, 8), skinMat);
  nose.rotation.x = Math.PI * 0.42;
  nose.position.set(0, -0.005, 0.142);
  headGroup.add(nose);

  // Ears
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), skinMat);
    ear.scale.set(0.45, 1.15, 0.75);
    ear.position.set(side * 0.138, 0.005, -0.005);
    headGroup.add(ear);
  });

  // Vitiligo patches for Lazar
  if (app.scar === 'vitiligo_heterochromia') {
    const patchMat = registerMat(new THREE.MeshStandardMaterial({ color: 0xf0e8e0, roughness: 0.78 }), 'skin');
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), patchMat);
    p1.scale.set(1, 0.8, 0.25);
    p1.position.set(-0.055, -0.04, 0.125);
    headGroup.add(p1);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), patchMat);
    p2.scale.set(1, 0.8, 0.25);
    p2.position.set(0.062, 0.03, 0.118);
    headGroup.add(p2);
  }

  // Chemical burn scar for Oleg
  if (app.scar === 'chemical_burn') {
    const burnMat = registerMat(new THREE.MeshStandardMaterial({ color: 0x9e605b, roughness: 0.35 }), 'skin');
    const scar = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), burnMat);
    scar.scale.set(0.75, 1.15, 0.32);
    scar.position.set(0.068, -0.02, 0.112);
    headGroup.add(scar);
  }

  // ==================== 3. EYES, PUPILS & EYELIDS ====================
  const eyeY = 0.025;
  const eyeZ = 0.124;
  const irisColorHex = hexColor(app.eyeColor, 0x486058);

  [-1, 1].forEach((side, idx) => {
    const ex = side * 0.048;
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(ex, eyeY, eyeZ);
    headGroup.add(eyeSocket);

    const scleraMat = new THREE.MeshStandardMaterial({
      color: 0xeee9e0,
      roughness: 0.25,
      metalness: 0.05,
    });
    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(app.scar === 'bug_eyes' ? 0.026 : 0.021, 12, 10),
      scleraMat
    );
    sclera.scale.set(1.15, 0.82, 0.6);
    eyeSocket.add(sclera);
    scleraNodes.push(sclera);

    const irisMat = new THREE.MeshStandardMaterial({
      color: idx === 1 && app.scar === 'vitiligo_heterochromia' ? 0x8c693a : irisColorHex,
      roughness: 0.2,
    });
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0115, 14), irisMat);
    iris.position.set(idx === 0 && app.scar === 'lazy_eye' ? -0.005 : 0, 0, 0.0135);
    eyeSocket.add(iris);

    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0062, 12), pupilMat);
    pupil.position.set(idx === 0 && app.scar === 'lazy_eye' ? -0.005 : 0, 0, 0.0145);
    eyeSocket.add(pupil);
    pupilNodes.push(pupil);

    // Eyelid cap (scales down during blink)
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.0235, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
      skinMat
    );
    lid.scale.set(1.18, 0.05, 0.68);
    lid.position.set(0, 0.006, 0.002);
    eyeSocket.add(lid);
    eyelidNodes.push(lid);

    // Eyebrows
    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.009, 0.012),
      app.scar === 'painted_brows' ? darkTrimMat : hairMat
    );
    brow.position.set(0, 0.028, 0.008);
    brow.rotation.z = side * -0.08;
    eyeSocket.add(brow);
  });

  // ==================== 4. MOUTH & FACIAL HAIR ====================
  const mouthColor =
    app.scar === 'red_lipstick'
      ? 0xa82030
      : app.scar === 'rictus_grin'
      ? 0xe8e0d0
      : 0x5c3632;
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(app.scar === 'rictus_grin' ? 0.075 : 0.052, app.scar === 'rictus_grin' ? 0.018 : 0.011, 0.016),
    registerMat(new THREE.MeshStandardMaterial({ color: mouthColor, roughness: 0.6 }), 'skin')
  );
  mouth.position.set(0, -0.062, 0.132);
  headGroup.add(mouth);

  if (app.facialHair && app.facialHair !== 'none') {
    if (['long_beard', 'thick_beard', 'messy_beard', 'gray_beard', 'short_beard'].includes(app.facialHair)) {
      const bH = app.facialHair === 'long_beard' ? 0.19 : 0.11;
      const beard = new THREE.Mesh(new THREE.ConeGeometry(0.088, bH, 10), hairMat);
      beard.rotation.x = Math.PI;
      beard.position.set(0, -0.085 - bH * 0.25, 0.082);
      headGroup.add(beard);
    } else if (['walrus_mustache', 'white_mustache', 'mustache', 'thin_mustache'].includes(app.facialHair)) {
      const stache = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.018, 0.024), hairMat);
      stache.position.set(0, -0.044, 0.136);
      headGroup.add(stache);
    } else if (app.facialHair === 'goatee') {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.045, 0.025), hairMat);
      g.position.set(0, -0.088, 0.125);
      headGroup.add(g);
    }
  }

  // ==================== 5. HAIR & HEADWEAR ====================
  if (app.hair === 'floral_headscarf') {
    const scarfMat = registerMat(new THREE.MeshStandardMaterial({ color: 0x7a303b, roughness: 0.92 }), 'coat');
    const scarf = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 14), scarfMat);
    scarf.scale.set(1.04, 1.12, 1.05);
    scarf.position.set(0, 0.01, -0.032);
    headGroup.add(scarf);
  } else if (app.hair === 'foil_beanie') {
    const foilMat = registerMat(new THREE.MeshStandardMaterial({ color: 0xd0d8de, roughness: 0.25, metalness: 0.85 }), 'coldProp');
    const foilRim = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.016, 8, 16), foilMat);
    foilRim.rotation.x = Math.PI / 2;
    foilRim.position.set(0, 0.072, 0);
    headGroup.add(foilRim);

    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.148, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), coatMat);
    beanie.position.set(0, 0.068, -0.005);
    headGroup.add(beanie);
  } else if (app.hair === 'gray_officer_cap' || app.hair === 'rail_cap') {
    const capMat = registerMat(
      new THREE.MeshStandardMaterial({ color: app.hair === 'rail_cap' ? 0x2a3136 : 0x3b4734, roughness: 0.8 }),
      'coat'
    );
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.138, 0.09, 14), capMat);
    crown.position.set(0, 0.145, -0.005);
    headGroup.add(crown);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.11), darkTrimMat);
    visor.position.set(0, 0.095, 0.12);
    visor.rotation.x = 0.18;
    headGroup.add(visor);
    if (app.hair === 'gray_officer_cap') {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.018), new THREE.MeshStandardMaterial({ color: 0xb83227, metalness: 0.5 }));
      star.position.set(0, 0.138, 0.148);
      headGroup.add(star);
    }
  } else if (app.hair !== 'bald_smooth') {
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.154, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hairMat
    );
    hairCap.scale.set(0.96, 1.08, 1.02);
    hairCap.position.set(0, 0.018, -0.012);
    headGroup.add(hairCap);

    // Bun / Updo
    if (['bun', 'elegant_updo', 'tight_gray_bun', 'silver_bun', 'sharp_dark_chignon'].includes(app.hair)) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), hairMat);
      bun.position.set(0, 0.16, -0.075);
      headGroup.add(bun);
    }
    // Long flowing back hair
    if (['shoulder_straight', 'messy_auburn', 'tangled_dark', 'wavy_chestnut', 'glamour_waves', 'sleek_blonde', 'dark_braid', 'warm_braid', 'soft_auburn', 'long_gray', 'greasy_long', 'styled_brunette', 'dyed_choppy'].includes(app.hair)) {
      const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.30, 0.13), hairMat);
      backHair.position.set(0, -0.07, -0.085);
      headGroup.add(backHair);
    }
  }

  // ==================== 6. EYEWEAR & GOGGLES ====================
  if (app.eyewear && app.eyewear !== 'none') {
    if (app.eyewear === 'welding_goggles') {
      const gogFrame = new THREE.MeshStandardMaterial({ color: 0x695c48, roughness: 0.45, metalness: 0.65 });
      const gogLens = new THREE.MeshStandardMaterial({ color: 0x101814, roughness: 0.15, metalness: 0.7 });
      [-1, 1].forEach((side) => {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.032, 14), gogFrame);
        cup.rotation.x = Math.PI / 2;
        cup.position.set(side * 0.052, eyeY, eyeZ + 0.025);
        headGroup.add(cup);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), gogLens);
        lens.position.set(side * 0.052, eyeY, eyeZ + 0.042);
        headGroup.add(lens);
      });
    } else if (app.eyewear === 'eyepatch') {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), darkTrimMat);
      patch.position.set(-0.048, eyeY, eyeZ + 0.022);
      headGroup.add(patch);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.01, 0.01), darkTrimMat);
      strap.position.set(0, eyeY + 0.02, eyeZ + 0.01);
      strap.rotation.z = -0.25;
      headGroup.add(strap);
    } else {
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x24211e, roughness: 0.3, metalness: 0.75 });
      [-1, 1].forEach((side) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.004, 8, 16), rimMat);
        ring.position.set(side * 0.05, eyeY, eyeZ + 0.026);
        headGroup.add(ring);
      });
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.005, 0.005), rimMat);
      bridge.position.set(0, eyeY + 0.004, eyeZ + 0.026);
      headGroup.add(bridge);
    }
  }

  // ==================== 7. DISTINCT HELD 3D PROP ====================
  const propGroup = new THREE.Group();
  propGroup.position.set(0.22, headY - 0.52, 0.24);
  root.add(propGroup);

  const metalPropMat = registerMat(new THREE.MeshStandardMaterial({ color: 0x626b66, roughness: 0.35, metalness: 0.75 }), 'coldProp');
  const woodPropMat = registerMat(new THREE.MeshStandardMaterial({ color: 0x5c432b, roughness: 0.85 }), 'coldProp');

  if (app.prop === 'leica_camera') {
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.06), darkTrimMat);
    cam.position.set(-0.22, 0.06, -0.02);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 12), metalPropMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(-0.22, 0.06, 0.02);
    propGroup.add(cam, lens);
  } else if (app.prop === 'fern_jar' || app.prop === 'pickle_basket') {
    const isAshJar = zoomFlag === 'black_ash';
    const contentMat = registerMat(
      new THREE.MeshStandardMaterial({
        color: isAshJar ? 0x161418 : app.prop === 'fern_jar' ? 0x3b8a4e : 0x5c7a3b,
        roughness: 0.65,
      }),
      isAshJar ? 'hotProp' : 'coldProp'
    );
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.19, 12),
      new THREE.MeshStandardMaterial({ color: 0xb8d4c8, transparent: true, opacity: 0.38, roughness: 0.15 })
    );
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 10), contentMat);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.025, 12), woodPropMat);
    lid.position.y = 0.105;
    propGroup.add(jar, core, lid);
  } else if (app.prop === 'sax_case') {
    const cMat = registerMat(
      new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.85 }),
      zoomFlag === 'black_ash' ? 'hotProp' : 'coldProp'
    );
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.14), cMat);
    propGroup.add(box);
  } else if (app.prop === 'brass_lantern') {
    const brass = new THREE.MeshStandardMaterial({ color: 0x997932, roughness: 0.35, metalness: 0.8 });
    const lampGlow = new THREE.MeshStandardMaterial({
      color: zoomFlag === 'black_ash' ? 0x1a1a1c : 0xf2b046,
      emissive: zoomFlag === 'black_ash' ? 0x000000 : 0xd9822b,
      emissiveIntensity: zoomFlag === 'black_ash' ? 0 : 1.1,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 10), lampGlow);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.06, 10), brass);
    top.position.y = 0.11;
    propGroup.add(body, top);
  } else if (app.prop === 'iron_cross') {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.02), metalPropMat);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.02), metalPropMat);
    h.position.y = 0.04;
    propGroup.position.set(0, headY - 0.38, 0.22);
    propGroup.add(v, h);
  } else if (app.prop === 'crowbar' || app.prop === 'fire_axe' || app.prop === 'cleaver' || app.prop === 'wrench' || app.prop === 'pipe_wrench') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.42, 0.025), metalPropMat);
    bar.rotation.z = 0.25;
    propGroup.add(bar);
  } else if (app.prop === 'sat_phone' || app.prop === 'transistor_radio' || app.prop === 'dosimeter') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.045), darkTrimMat);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 6), metalPropMat);
    ant.position.set(0.025, 0.17, 0);
    propGroup.add(box, ant);
  } else if (app.prop === 'stuffed_crow') {
    const birdMat = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), birdMat);
    body.scale.set(0.8, 1.3, 0.9);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), birdMat);
    head.position.set(0, 0.11, 0.02);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.06, 6), woodPropMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.11, 0.075);
    propGroup.add(body, head, beak);
  } else {
    // Generic Soviet field bag / crate / notebook prop
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.08), woodPropMat);
    propGroup.add(pack);
  }

  // ==================== 8. UV & ZOOM HORROR TELL OVERLAYS (HIDDEN BY DEFAULT) ====================
  // A) Black Ash-Veins or Neon Violet Veins climbing neck & jaw (visible under UV!)
  if (uvFlag === 'ash_veins' || uvFlag === 'violet_veins' || zoomFlag === 'ash_veins' || zoomFlag === 'violet_veins') {
    const isViolet = uvFlag === 'violet_veins' || zoomFlag === 'violet_veins';
    const veinMat = new THREE.MeshStandardMaterial({
      color: isViolet ? 0xc084fc : 0x09060d,
      emissive: isViolet ? 0x9333ea : 0x1e0b2e,
      emissiveIntensity: isViolet ? 1.8 : 0.7,
      roughness: 0.4,
    });
    const veinGroup = new THREE.Group();
    const coords = [
      [-0.035, -0.15, 0.064, 0.25],
      [0.032, -0.145, 0.064, -0.22],
      [-0.068, -0.07, 0.115, 0.45],
      [0.064, -0.075, 0.115, -0.45],
      [0.0, -0.14, 0.068, 0.05],
    ];
    coords.forEach(([x, y, z, rz]) => {
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.007, 0.11, 6), veinMat);
      v.position.set(x, y, z);
      v.rotation.z = rz;
      veinGroup.add(v);
    });
    veinGroup.visible = false;
    headGroup.add(veinGroup);
    uvRevealNodes.push(veinGroup);
  }

  // B) Concealed hot weapon glow under Thermal / Zoom
  if (zoomFlag === 'weapon') {
    const weapMat = registerMat(
      new THREE.MeshStandardMaterial({ color: 0x3b3f42, roughness: 0.35, metalness: 0.85 }),
      'hotProp'
    );
    const pistol = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.03), weapMat);
    pistol.position.set(-0.18, headY - 0.52, 0.20);
    pistol.rotation.z = -0.35;
    pistol.visible = false;
    root.add(pistol);
    zoomRevealNodes.push(pistol);
  }

  // C) Extra multi-limbed spider shadow on the concrete back wall (for Katya / Goran mimics)
  if (zoomFlag === 'multi_shadow') {
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x050605, transparent: true, opacity: 0.82 });
    const shadowGroup = new THREE.Group();
    shadowGroup.position.set(0.15, headY - 0.1, -0.82);
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 3; i++) {
        const limb = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.055, 0.01), shadowMat);
        limb.position.set(side * 0.38, 0.12 - i * 0.22, 0);
        limb.rotation.z = side * (0.45 - i * 0.38);
        shadowGroup.add(limb);
      }
    });
    shadowGroup.visible = false;
    root.add(shadowGroup);
    zoomRevealNodes.push(shadowGroup);
    uvRevealNodes.push(shadowGroup);
  }

  // D) Backward extra teeth / Unhinged jaw reveal under Zoom & UV
  if (uvFlag === 'extra_teeth' || zoomFlag === 'extra_teeth' || uvFlag === 'unhinged_jaw' || zoomFlag === 'unhinged_jaw') {
    const mawGroup = new THREE.Group();
    const cavity = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x120608 })
    );
    cavity.scale.set(1.25, 0.9, 0.4);
    cavity.position.set(0, -0.068, 0.134);
    mawGroup.add(cavity);
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xe6decb, roughness: 0.3 });
    for (let i = -3; i <= 3; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.022, 5), toothMat);
      tooth.position.set(i * 0.013, -0.052, 0.146);
      tooth.rotation.x = Math.PI;
      mawGroup.add(tooth);
    }
    mawGroup.visible = false;
    headGroup.add(mawGroup);
    zoomRevealNodes.push(mawGroup);
    uvRevealNodes.push(mawGroup);
  }

  // E) Chitin claws pressed up near glass (Marfa / Zinaida / Tamara mimics)
  if (uvFlag === 'chitin_nails' || zoomFlag === 'chitin_nails') {
    const clawGroup = new THREE.Group();
    const clawMat = new THREE.MeshStandardMaterial({
      color: 0x0c0912,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.65,
      roughness: 0.2,
    });
    for (let i = 0; i < 4; i++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.095, 6), clawMat);
      claw.position.set(-0.24 + i * 0.026, headY - 0.34, 0.34);
      claw.rotation.x = 0.25;
      clawGroup.add(claw);
    }
    clawGroup.visible = false;
    root.add(clawGroup);
    uvRevealNodes.push(clawGroup);
    zoomRevealNodes.push(clawGroup);
  }

  // Store controller metadata for animation & tool transitions
  root.userData = {
    characterId: character.id,
    headGroup,
    headBaseY: headY,
    neverBlinks,
    eyelidNodes,
    pupilNodes,
    scleraNodes,
    thermalTracked,
    uvRevealNodes,
    zoomRevealNodes,
    uvFlag,
    zoomFlag,
    isCold,
    thermalTemp,
    blinkTimer: 2.2 + Math.random() * 2.5,
    blinkDuration: 0,
  };

  return root;
}

// Switch 3D visitor materials & horror overlays live when player equips UV / Thermal / Zoom!
export function applyVisitorInspectionMode(visitorGroup, activeTool) {
  if (!visitorGroup || !visitorGroup.userData) return;
  const ud = visitorGroup.userData;
  const isThermal = activeTool === 'thermal';
  const isUv = activeTool === 'uv';
  const isZoom = activeTool === 'zoom';

  // 1. Update Thermal / Normal / UV material overrides
  ud.thermalTracked.forEach((entry) => {
    const { mat, origColor, origEmissive, origEmissiveIntensity, origRoughness, thermalRole } = entry;
    if (isThermal) {
      mat.roughness = 0.9;
      if (thermalRole === 'hotProp') {
        mat.color.setHex(0xfff2a1);
        mat.emissive.setHex(0xff5a1f);
        mat.emissiveIntensity = 1.6;
      } else if (thermalRole === 'skin') {
        if (ud.isCold) {
          mat.color.setHex(0x1b3a73);
          mat.emissive.setHex(0x0d214f);
          mat.emissiveIntensity = 0.9;
        } else if (ud.thermalTemp >= 38.5) {
          mat.color.setHex(0xfff5ad);
          mat.emissive.setHex(0xff841f);
          mat.emissiveIntensity = 1.45;
        } else {
          mat.color.setHex(0xf28d29);
          mat.emissive.setHex(0xc93b14);
          mat.emissiveIntensity = 1.15;
        }
      } else if (thermalRole === 'coat' || thermalRole === 'hair') {
        if (ud.isCold) {
          mat.color.setHex(0x0c1836);
          mat.emissive.setHex(0x061029);
          mat.emissiveIntensity = 0.55;
        } else {
          mat.color.setHex(0x472366);
          mat.emissive.setHex(0x2a1045);
          mat.emissiveIntensity = 0.7;
        }
      } else {
        mat.color.setHex(0x162445);
        mat.emissive.setHex(0x091124);
        mat.emissiveIntensity = 0.45;
      }
    } else {
      mat.color.copy(origColor);
      mat.emissive.copy(origEmissive);
      mat.emissiveIntensity = origEmissiveIntensity;
      mat.roughness = origRoughness;
    }
  });

  // 2. Pupil constriction / vertical split / glassy sclera under UV
  ud.pupilNodes.forEach((p) => {
    if ((isUv || isZoom) && ud.uvFlag === 'split_pupils') {
      p.scale.set(0.32, 1.55, 1);
    } else if (isUv && (ud.uvFlag === 'normal' || ud.uvFlag === 'goggles_ok')) {
      p.scale.set(0.62, 0.62, 1); // Healthy constriction
    } else if (isUv && (ud.uvFlag === 'no_blink' || ud.uvFlag === 'glassy_sclera')) {
      p.scale.set(1.45, 1.45, 1); // Dead dilated
    } else {
      p.scale.set(1, 1, 1);
    }
  });

  ud.scleraNodes.forEach((s) => {
    if (isUv && (ud.uvFlag === 'glassy_sclera' || ud.uvFlag === 'no_blink')) {
      s.material.color.setHex(0xbcc9d9);
      s.material.emissive.setHex(0x3a2b59);
      s.material.emissiveIntensity = 0.65;
    } else {
      s.material.color.setHex(0xeee9e0);
      s.material.emissive.setHex(0x000000);
      s.material.emissiveIntensity = 0;
    }
  });

  // 3. Toggle horror tell geometry layers
  ud.uvRevealNodes.forEach((n) => {
    n.visible = isUv || (isZoom && ud.zoomRevealNodes.includes(n));
  });
  ud.zoomRevealNodes.forEach((n) => {
    if (isZoom || (isThermal && ud.zoomFlag === 'weapon')) {
      n.visible = true;
    } else if (!ud.uvRevealNodes.includes(n)) {
      n.visible = false;
    }
  });
}

// Per-frame subtle breathing, eerie sway, and blinking animation (Zero GC allocations)
export function animateVisitor3D(visitorGroup, dt, elapsed) {
  if (!visitorGroup || !visitorGroup.userData) return;
  const ud = visitorGroup.userData;

  // Breathing & slight cold shiver (Hollows stay unnaturally rigid except faint head tilt)
  if (ud.isCold) {
    ud.headGroup.rotation.z = Math.sin(elapsed * 0.45) * 0.035;
    ud.headGroup.position.y = ud.headBaseY;
  } else {
    ud.headGroup.position.y = ud.headBaseY + Math.sin(elapsed * 2.1) * 0.008;
    ud.headGroup.rotation.y = Math.sin(elapsed * 0.7) * 0.05;
    ud.headGroup.rotation.z = Math.sin(elapsed * 1.1) * 0.018;
  }

  // Blinking logic (Hollow non-blinkers freeze permanently open!)
  if (!ud.neverBlinks) {
    if (ud.blinkDuration > 0) {
      ud.blinkDuration -= dt;
      const closed = ud.blinkDuration > 0;
      for (let i = 0; i < ud.eyelidNodes.length; i++) {
        ud.eyelidNodes[i].scale.y = closed ? 1.12 : 0.05;
      }
    } else {
      ud.blinkTimer -= dt;
      if (ud.blinkTimer <= 0) {
        ud.blinkDuration = 0.14;
        ud.blinkTimer = 2.4 + Math.random() * 3.2;
      }
    }
  }
}

export function disposeVisitor3D(visitorGroup) {
  if (!visitorGroup) return;
  visitorGroup.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material?.dispose();
      }
    }
  });
}
