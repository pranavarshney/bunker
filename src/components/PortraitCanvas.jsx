import React, { useEffect, useState } from 'react';

// Procedural SVG Soviet CRT & Airlock Window Portrait Renderer
// Draws all 46 characters distinctly from appearance metadata and dynamically
// renders UV Penlight, Thermal FLIR, Optical Zoom, and Low-Sanity overlays.

const ASH_PARTICLES = [
  { x: 12, delay: '0s', dur: '6.5s', size: 2.2 },
  { x: 26, delay: '1.8s', dur: '7.4s', size: 1.8 },
  { x: 41, delay: '0.6s', dur: '5.8s', size: 2.5 },
  { x: 58, delay: '2.9s', dur: '6.9s', size: 1.9 },
  { x: 74, delay: '1.1s', dur: '7.8s', size: 2.4 },
  { x: 86, delay: '3.4s', dur: '6.1s', size: 1.7 },
  { x: 19, delay: '4.1s', dur: '8.2s', size: 2.0 },
  { x: 65, delay: '0.3s', dur: '5.4s', size: 2.1 },
];

export default function PortraitCanvas({
  character,
  inspectionData = null,
  activeTool = 'none', // 'none' | 'geiger' | 'uv' | 'thermal' | 'ledger' | 'zoom'
  lowSanity = false,
  compact = false,
}) {
  const [isBlinking, setIsBlinking] = useState(false);

  const uvFlag = inspectionData?.tools?.uv?.visualFlag || 'normal';
  const thermalTemp = inspectionData?.tools?.thermal?.tempC ?? 36.6;
  const zoomFlag = inspectionData?.zoomFlag || null;
  const isCold = thermalTemp < 28;
  const neverBlinks =
    uvFlag === 'no_blink' ||
    character?.appearance?.scar === 'vitiligo_heterochromia';

  // Natural blinking rhythm unless visitor has a non-blinking tell (or Lazar's nerve damage)
  useEffect(() => {
    if (compact || neverBlinks) {
      setIsBlinking(false);
      return;
    }
    let timeoutId;
    const scheduleBlink = () => {
      const wait = 2600 + Math.random() * 3400;
      timeoutId = window.setTimeout(() => {
        setIsBlinking(true);
        window.setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 150);
      }, wait);
    };
    scheduleBlink();
    return () => window.clearTimeout(timeoutId);
  }, [character?.id, compact, neverBlinks]);

  if (!character) return null;

  const app = character.appearance;
  const isThermal = activeTool === 'thermal';
  const isUv = activeTool === 'uv';
  const isZoom = activeTool === 'zoom';

  // Derive body/face geometry from build & age
  const isBroad = ['broad', 'sturdy', 'massive', 'stocky', 'bulky', 'hunched_giant'].includes(app.build);
  const isGaunt = ['gaunt', 'frail', 'slim', 'elongated', 'hunched_small'].includes(app.build);
  const isHunched = app.build === 'hunched_giant' || app.build === 'hunched_small';
  const headYOffset = app.build === 'hunched_small' ? 14 : app.build === 'tall' ? -7 : isHunched ? 8 : 0;
  const neckHeight = app.build === 'elongated' ? 36 : 24;
  const shoulderHalf = isBroad ? 82 : isGaunt ? 58 : 70;
  const jawRx = isGaunt ? 31 : isBroad ? 39 : 35;
  const jawRy = app.gender === 'female' ? 43 : 45;

  // Color palette overrides for Thermal & UV inspection modes
  const skinFill = isThermal
    ? isCold
      ? '#1d3b6e'
      : thermalTemp >= 38.5
      ? '#fff099'
      : '#f08a24'
    : isUv
    ? '#7a6f99'
    : app.skinTone;

  const coatFill = isThermal
    ? isCold
      ? '#0d1936'
      : '#3b2459'
    : isUv
    ? '#231f38'
    : app.coatColor;

  const hairFill = isThermal
    ? isCold
      ? '#14264d'
      : '#4d2b6b'
    : isUv
    ? '#1a1529'
    : app.hairColor;

  const leftEyeX = 144;
  const rightEyeX = 176;
  const eyeY = 126 + headYOffset;
  const faceCenterY = 128 + headYOffset;

  const pupilRadius = isUv
    ? uvFlag === 'normal' || uvFlag === 'goggles_ok'
      ? 2.1 // Healthy human pupil constricts tightly in UV!
      : 4.5 // Unreactive dilated Hollow pupil
    : app.id === 'irena_babic'
    ? 4.2
    : 3.1;

  const showMultiShadow =
    (isZoom || isUv) && zoomFlag === 'multi_shadow';

  return (
    <div
      className={`relative overflow-hidden select-none ${
        compact ? 'w-full h-full bg-[#0c110e]' : 'w-full aspect-[4/3] crt-bezel rounded-sm'
      } ${lowSanity && !compact ? 'low-sanity-jitter' : ''}`}
    >
      <svg
        viewBox="0 0 320 240"
        className="w-full h-full block transition-transform duration-300 ease-out"
        style={{
          transform: isZoom && !compact ? 'scale(1.38) translateY(8%)' : 'scale(1)',
          transformOrigin: '50% 42%',
        }}
        role="img"
        aria-label={`Airlock viewport showing ${character.name}`}
      >
        <defs>
          {/* Exterior sodium-vapor orange glow through radioactive ash */}
          <radialGradient id={`bg-glow-${character.id}`} cx="50%" cy="32%" r="72%">
            <stop offset="0%" stopColor={isThermal ? '#1b1130' : isUv ? '#29174a' : '#5e3c1b'} />
            <stop offset="55%" stopColor={isThermal ? '#0c081c' : isUv ? '#140c29' : '#241b12'} />
            <stop offset="100%" stopColor="#080a09" />
          </radialGradient>

          {/* Thermal human core glow */}
          <radialGradient id={`thermal-core-${character.id}`} cx="50%" cy="48%" r="48%">
            <stop offset="0%" stopColor={isCold ? '#2e639e' : '#fff4a3'} stopOpacity="0.95" />
            <stop offset="55%" stopColor={isCold ? '#173263' : '#e85d1a'} stopOpacity="0.88" />
            <stop offset="100%" stopColor={isCold ? '#09142b' : '#4a1859'} stopOpacity="0.7" />
          </radialGradient>

          {/* UV beam spotlight */}
          <radialGradient id={`uv-beam-${character.id}`} cx="50%" cy="46%" r="42%">
            <stop offset="0%" stopColor="#c084fc" stopOpacity="0.32" />
            <stop offset="65%" stopColor="#7e22ce" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#1e1036" stopOpacity="0" />
          </radialGradient>

          {/* Condensation frost rim around glass */}
          <radialGradient id={`frost-rim-${character.id}`} cx="50%" cy="50%" r="58%">
            <stop offset="70%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#94b8a8" stopOpacity="0.24" />
          </radialGradient>
        </defs>

        {/* Backdrop concrete corridor & distant sodium streetlamp */}
        <rect x="0" y="0" width="320" height="240" fill={`url(#bg-glow-${character.id})`} />

        {/* Brutalist concrete tiles in background stairwell */}
        {!isThermal && (
          <g stroke="#2a241c" strokeWidth="1" opacity="0.45">
            <line x1="0" y1="60" x2="320" y2="60" />
            <line x1="0" y1="120" x2="320" y2="120" />
            <line x1="0" y1="180" x2="320" y2="180" />
            <line x1="65" y1="0" x2="65" y2="240" />
            <line x1="255" y1="0" x2="255" y2="240" />
          </g>
        )}

        {/* Distant sodium-vapor lamp halo outside tunnel */}
        {!isThermal && !isUv && (
          <g opacity="0.42">
            <ellipse cx="262" cy="36" rx="34" ry="18" fill="#e68a2e" opacity="0.22" />
            <rect x="252" y="30" width="20" height="5" rx="2" fill="#f5b864" />
          </g>
        )}

        {/* Shadow cast on the concrete wall behind visitor */}
        {!isThermal && (
          <g opacity="0.52" fill="#090b0a">
            <ellipse cx="186" cy={136 + headYOffset} rx={jawRx * 1.05} ry={jawRy * 1.05} />
            <path d={`M ${186 - shoulderHalf} 240 Q 186 ${165 + headYOffset} ${186 + shoulderHalf} 240 Z`} />
            {/* Horror Tell: Multi-limbed impossible shadow for Katya / Goran mimics */}
            {showMultiShadow && (
              <g stroke="#050605" strokeWidth="7" strokeLinecap="round" fill="none">
                <path d="M 190 160 L 238 124 L 268 148" />
                <path d="M 192 175 L 252 162 L 284 190" />
                <path d="M 145 162 L 96 120 L 68 144" />
                <path d="M 142 178 L 84 166 L 56 196" />
              </g>
            )}
          </g>
        )}

        {/* ===================== CHARACTER SILHOUETTE ===================== */}
        <g>
          {/* Back hair layer for long hairstyles */}
          {['shoulder_straight', 'messy_auburn', 'tangled_dark', 'wavy_chestnut', 'glamour_waves', 'sleek_blonde', 'dark_braid', 'warm_braid', 'soft_auburn', 'long_gray', 'greasy_long', 'styled_brunette', 'dyed_choppy'].includes(
            app.hair
          ) && (
            <path
              d={`M ${160 - jawRx - 8} ${faceCenterY - 12}
                  Q ${160 - jawRx - 16} ${faceCenterY + 52} ${160 - jawRx - 4} ${faceCenterY + 78}
                  L ${160 + jawRx + 4} ${faceCenterY + 78}
                  Q ${160 + jawRx + 16} ${faceCenterY + 52} ${160 + jawRx + 8} ${faceCenterY - 12} Z`}
              fill={hairFill}
            />
          )}

          {/* Shoulders & Coat Torso */}
          <path
            d={`M ${160 - shoulderHalf - 16} 244
                L ${160 - shoulderHalf} ${194 + headYOffset}
                Q ${160 - shoulderHalf * 0.45} ${174 + headYOffset} ${160 - 18} ${173 + headYOffset}
                L ${160 + 18} ${173 + headYOffset}
                Q ${160 + shoulderHalf * 0.45} ${174 + headYOffset} ${160 + shoulderHalf} ${194 + headYOffset}
                L ${160 + shoulderHalf + 16} 244 Z`}
            fill={coatFill}
            stroke="#0e1210"
            strokeWidth="1.5"
          />

          {/* Thermal torso heat map overlay */}
          {isThermal && (
            <ellipse
              cx="160"
              cy={218 + headYOffset}
              rx={shoulderHalf * 0.65}
              ry="34"
              fill={`url(#thermal-core-${character.id})`}
              opacity="0.78"
            />
          )}

          {/* Outfit-specific visual details */}
          {!isThermal && (
            <g>
              {/* Fur collar for Elena */}
              {app.outfit === 'fur_coat' && (
                <path
                  d={`M ${160 - 44} ${186 + headYOffset} Q 160 ${214 + headYOffset} ${160 + 44} ${186 + headYOffset} Q 160 ${174 + headYOffset} ${160 - 44} ${186 + headYOffset} Z`}
                  fill="#6e574c"
                  stroke="#362823"
                  strokeWidth="1.5"
                />
              )}
              {/* Tracksuit stripes for Pasha */}
              {app.outfit === 'tracksuit' && (
                <g stroke="#d4d8d2" strokeWidth="2.5" opacity="0.8">
                  <line x1="102" y1="196" x2="88" y2="242" />
                  <line x1="108" y1="196" x2="94" y2="242" />
                  <line x1="218" y1="196" x2="232" y2="242" />
                  <line x1="212" y1="196" x2="226" y2="242" />
                </g>
              )}
              {/* Officer / KGB shoulder boards */}
              {(app.outfit === 'officer_greatcoat' || app.outfit === 'kgb_overcoat' || app.outfit === 'greatcoat') && (
                <g>
                  <rect x={160 - shoulderHalf + 6} y={183 + headYOffset} width="24" height="7" rx="1" fill="#7d6738" stroke="#221e14" />
                  <rect x={160 + shoulderHalf - 30} y={183 + headYOffset} width="24" height="7" rx="1" fill="#7d6738" stroke="#221e14" />
                  <path d={`M 140 ${178 + headYOffset} L 160 ${216 + headYOffset} L 180 ${178 + headYOffset}`} fill="none" stroke="#1b211a" strokeWidth="2.5" />
                </g>
              )}
              {/* Butcher / Tavern / Waxed Apron */}
              {(app.outfit === 'butcher_apron' || app.outfit === 'apron_coat' || app.outfit === 'waxed_apron') && (
                <g>
                  <rect x="132" y={188 + headYOffset} width="56" height="56" fill={app.outfit === 'butcher_apron' ? '#632828' : '#7a7365'} stroke="#1d1b18" />
                  {app.outfit === 'butcher_apron' && (
                    <path d="M 140 202 Q 152 214 146 226 M 168 198 Q 174 216 164 230" stroke="#3b0c0c" strokeWidth="4" fill="none" opacity="0.7" />
                  )}
                </g>
              )}
              {/* Bloodstained scrubs */}
              {app.outfit === 'bloody_scrubs' && (
                <g>
                  <path d={`M 144 ${176 + headYOffset} L 160 ${202 + headYOffset} L 176 ${176 + headYOffset}`} fill="none" stroke="#2a4540" strokeWidth="3" />
                  <circle cx="144" cy="212" r="7" fill="#6b1d1d" opacity="0.65" />
                  <circle cx="173" cy="222" r="5" fill="#6b1d1d" opacity="0.55" />
                </g>
              )}
              {/* Three layered coats for Miroslav */}
              {app.outfit === 'three_coats' && (
                <g stroke="#24231e" strokeWidth="2" fill="none">
                  <path d="M 134 176 L 154 238" />
                  <path d="M 124 182 L 146 240" />
                  <path d="M 186 176 L 166 238" />
                  <path d="M 196 182 L 174 240" />
                </g>
              )}
              {/* Default lapel V */}
              {!['fur_coat', 'butcher_apron', 'bloody_scrubs'].includes(app.outfit) && (
                <path
                  d={`M 144 ${176 + headYOffset} L 160 ${212 + headYOffset} L 176 ${176 + headYOffset}`}
                  fill="none"
                  stroke="#181c1a"
                  strokeWidth="2"
                  opacity="0.75"
                />
              )}
            </g>
          )}

          {/* Neck */}
          <rect
            x="146"
            y={156 + headYOffset - (neckHeight - 24)}
            width="28"
            height={neckHeight}
            rx="8"
            fill={skinFill}
          />

          {/* Throat stoma / neck scratches / UV black ash veins */}
          {app.scar === 'throat_stoma' && !isThermal && (
            <circle cx="160" cy={168 + headYOffset} r="4.5" fill="#2b2320" stroke="#998b82" strokeWidth="1.5" />
          )}
          {app.scar === 'scratch_marks' && !isThermal && (
            <g stroke="#9e3e3e" strokeWidth="1.3" opacity="0.85">
              <line x1="150" y1={164 + headYOffset} x2="156" y2={176 + headYOffset} />
              <line x1="154" y1={163 + headYOffset} x2="160" y2={175 + headYOffset} />
              <line x1="158" y1={165 + headYOffset} x2="164" y2={176 + headYOffset} />
            </g>
          )}

          {/* UV Ash-Veins or Violet Veins Reveal! */}
          {(isUv || isZoom) && (uvFlag === 'ash_veins' || zoomFlag === 'ash_veins') && (
            <g stroke="#0e0b14" strokeWidth="1.8" fill="none" opacity={isUv ? 0.95 : 0.65}>
              <path d={`M 150 ${180 + headYOffset} Q 152 ${168 + headYOffset} 144 ${158 + headYOffset} L 138 ${150 + headYOffset}`} />
              <path d={`M 152 ${172 + headYOffset} L 160 ${164 + headYOffset} L 166 ${155 + headYOffset}`} />
              <path d={`M 170 ${180 + headYOffset} Q 168 ${168 + headYOffset} 176 ${156 + headYOffset}`} />
            </g>
          )}
          {(isUv || isZoom) && (uvFlag === 'violet_veins' || zoomFlag === 'violet_veins') && (
            <g stroke="#c084fc" strokeWidth="1.9" fill="none" opacity={isUv ? 0.95 : 0.6}>
              <path d={`M 149 ${178 + headYOffset} Q 153 ${165 + headYOffset} 142 ${154 + headYOffset}`} />
              <path d={`M 171 ${178 + headYOffset} Q 166 ${164 + headYOffset} 178 ${152 + headYOffset}`} />
              <path d={`M 134 ${118 + headYOffset} L 140 ${126 + headYOffset}`} />
              <path d={`M 186 ${118 + headYOffset} L 180 ${126 + headYOffset}`} />
            </g>
          )}

          {/* Ears */}
          <ellipse cx={160 - jawRx - 1} cy={faceCenterY + 3} rx="5.5" ry="9.5" fill={skinFill} />
          <ellipse cx={160 + jawRx + 1} cy={faceCenterY + 3} rx="5.5" ry="9.5" fill={skinFill} />

          {/* Head / Face Oval */}
          <ellipse
            cx="160"
            cy={faceCenterY}
            rx={jawRx}
            ry={jawRy}
            fill={isThermal ? `url(#thermal-core-${character.id})` : skinFill}
            stroke={isThermal ? 'none' : '#1b1a18'}
            strokeWidth="1.2"
          />

          {/* Vitiligo patches for Lazar */}
          {app.scar === 'vitiligo_heterochromia' && !isThermal && (
            <g fill="#f0e8e0" opacity="0.72">
              <ellipse cx="144" cy={faceCenterY + 14} rx="12" ry="9" />
              <ellipse cx="177" cy={faceCenterY - 8} rx="9" ry="7" />
              <ellipse cx="156" cy={faceCenterY + 31} rx="8" ry="5" />
            </g>
          )}

          {/* Chemical burn scar on Oleg */}
          {app.scar === 'chemical_burn' && !isThermal && (
            <path
              d={`M 164 ${faceCenterY - 12} Q 192 ${faceCenterY - 4} 188 ${faceCenterY + 26} Q 174 ${faceCenterY + 34} 162 ${faceCenterY + 18} Z`}
              fill="#b57a74"
              opacity="0.58"
            />
          )}

          {/* Freckles / Soot / Grease smudges */}
          {app.scar === 'freckles' && !isThermal && (
            <g fill="#8c5840" opacity="0.55">
              <circle cx="142" cy={faceCenterY + 8} r="1.1" />
              <circle cx="147" cy={faceCenterY + 10} r="1.1" />
              <circle cx="173" cy={faceCenterY + 10} r="1.1" />
              <circle cx="178" cy={faceCenterY + 8} r="1.1" />
              <circle cx="160" cy={faceCenterY + 7} r="1.0" />
            </g>
          )}
          {(app.scar === 'grease_smudge' || app.scar === 'soot_cheek' || app.scar === 'grease_cheek') && !isThermal && (
            <path
              d={`M 136 ${faceCenterY + 10} Q 146 ${faceCenterY + 14} 150 ${faceCenterY + 8}`}
              stroke="#24201c"
              strokeWidth="4.5"
              strokeLinecap="round"
              opacity="0.45"
              fill="none"
            />
          )}

          {/* Age wrinkles for elders 45+ */}
          {character.age >= 46 && !isThermal && (
            <g stroke="#5c493c" strokeWidth="1" opacity="0.38" fill="none">
              <path d={`M 144 ${faceCenterY - 22} Q 160 ${faceCenterY - 25} 176 ${faceCenterY - 22}`} />
              <path d={`M 148 ${faceCenterY - 17} Q 160 ${faceCenterY - 19} 172 ${faceCenterY - 17}`} />
              <path d={`M 138 ${faceCenterY + 14} Q 142 ${faceCenterY + 22} 146 ${faceCenterY + 26}`} />
              <path d={`M 182 ${faceCenterY + 14} Q 178 ${faceCenterY + 22} 174 ${faceCenterY + 26}`} />
            </g>
          )}

          {/* ===================== EYES & EYEBROWS ===================== */}
          {!isThermal && (
            <g>
              {/* Eyebrows */}
              {app.scar === 'painted_brows' ? (
                <g stroke="#1c1917" strokeWidth="2.4" fill="none">
                  <path d={`M 133 ${eyeY - 10} Q 144 ${eyeY - 16} 154 ${eyeY - 10}`} />
                  <path d={`M 166 ${eyeY - 11} Q 176 ${eyeY - 16} 187 ${eyeY - 9}`} />
                </g>
              ) : (
                <g stroke={hairFill} strokeWidth={app.gender === 'female' ? '2' : '2.8'} strokeLinecap="round" fill="none">
                  <path d={`M 134 ${eyeY - 9} Q 144 ${eyeY - 13} 154 ${eyeY - 9}`} />
                  <path d={`M 166 ${eyeY - 9} Q 176 ${eyeY - 13} 186 ${eyeY - 9}`} />
                </g>
              )}

              {/* Left & Right Eyes */}
              {isBlinking ? (
                <g stroke="#29211d" strokeWidth="2" fill="none">
                  <path d={`M 136 ${eyeY} Q 144 ${eyeY + 3} 152 ${eyeY}`} />
                  <path d={`M 168 ${eyeY} Q 176 ${eyeY + 3} 184 ${eyeY}`} />
                </g>
              ) : (
                <g>
                  {/* Sclera */}
                  <ellipse
                    cx={leftEyeX}
                    cy={eyeY}
                    rx={app.scar === 'bug_eyes' ? 8.5 : 7.5}
                    ry={app.scar === 'bug_eyes' ? 6.2 : 4.5}
                    fill={isUv && (uvFlag === 'glassy_sclera' || uvFlag === 'no_blink') ? '#cbd5e1' : '#f2ede6'}
                    stroke="#29211d"
                    strokeWidth="1"
                  />
                  <ellipse
                    cx={rightEyeX}
                    cy={eyeY}
                    rx={app.scar === 'bug_eyes' ? 8.5 : 7.5}
                    ry={app.scar === 'bug_eyes' ? 6.2 : 4.5}
                    fill={isUv && (uvFlag === 'glassy_sclera' || uvFlag === 'no_blink') ? '#cbd5e1' : '#f2ede6'}
                    stroke="#29211d"
                    strokeWidth="1"
                  />

                  {/* Irises (with heterochromia & lazy eye support) */}
                  <circle
                    cx={app.scar === 'lazy_eye' ? leftEyeX - 2.5 : leftEyeX}
                    cy={eyeY}
                    r="3.8"
                    fill={app.eyeColor}
                  />
                  <circle
                    cx={rightEyeX}
                    cy={eyeY}
                    r="3.8"
                    fill={app.scar === 'vitiligo_heterochromia' ? '#8c693a' : app.eyeColor}
                  />

                  {/* Pupils — split vertically if UV/Zoom detects Katarina mimic */}
                  {(isUv || isZoom) && (uvFlag === 'split_pupils' || zoomFlag === 'split_pupils') ? (
                    <g fill="#050505">
                      <ellipse cx={leftEyeX} cy={eyeY} rx="1.1" ry="4.1" />
                      <ellipse cx={rightEyeX} cy={eyeY} rx="1.1" ry="4.1" />
                    </g>
                  ) : (
                    <g fill="#0b0c0c">
                      <circle cx={app.scar === 'lazy_eye' ? leftEyeX - 2.5 : leftEyeX} cy={eyeY} r={pupilRadius} />
                      <circle cx={rightEyeX} cy={eyeY} r={pupilRadius} />
                    </g>
                  )}

                  {/* Specular catchlight (absent on dead/glassy Hollows under UV) */}
                  {!(isUv && (uvFlag === 'no_blink' || uvFlag === 'glassy_sclera')) && (
                    <g fill="#ffffff" opacity="0.75">
                      <circle cx={leftEyeX + 1.4} cy={eyeY - 1.2} r="1" />
                      <circle cx={rightEyeX + 1.4} cy={eyeY - 1.2} r="1" />
                    </g>
                  )}
                </g>
              )}
            </g>
          )}

          {/* Nose */}
          {!isThermal && (
            <path
              d={
                app.scar === 'broken_nose'
                  ? `M 160 ${eyeY + 4} L 156 ${eyeY + 15} L 163 ${eyeY + 20}`
                  : `M 160 ${eyeY + 4} L 158 ${eyeY + 18} Q 160 ${eyeY + 21} 164 ${eyeY + 18}`
              }
              fill="none"
              stroke="#6b5244"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}

          {/* ===================== MOUTH & DENTAL TELLS ===================== */}
          {!isThermal && (
            <g>
              {/* Paint-stained lips for Borya */}
              {app.scar === 'paint_lips' && (
                <ellipse cx="160" cy={faceCenterY + 25} rx="13" ry="6" fill="#a8b0b5" opacity="0.65" />
              )}

              {/* Rictus grin / extra teeth / unhinged jaw */}
              {(isZoom || isUv) && (uvFlag === 'extra_teeth' || zoomFlag === 'extra_teeth') ? (
                <g>
                  <ellipse cx="160" cy={faceCenterY + 26} rx="12" ry="7.5" fill="#1c0d0d" stroke="#361c1c" />
                  <path d={`M 150 ${faceCenterY + 23} L 153 ${faceCenterY + 27} L 156 ${faceCenterY + 23} L 160 ${faceCenterY + 28} L 164 ${faceCenterY + 23} L 167 ${faceCenterY + 27} L 170 ${faceCenterY + 23}`} fill="#e6dfd3" />
                  <path d={`M 152 ${faceCenterY + 29} L 156 ${faceCenterY + 25} L 160 ${faceCenterY + 30} L 164 ${faceCenterY + 25} L 168 ${faceCenterY + 29}`} fill="#cfc5b4" />
                </g>
              ) : (isZoom || isUv) && (uvFlag === 'unhinged_jaw' || zoomFlag === 'unhinged_jaw') ? (
                <g>
                  <path
                    d={`M 136 ${faceCenterY + 20} Q 160 ${faceCenterY + 38} 184 ${faceCenterY + 20}`}
                    stroke="#1c0f12"
                    strokeWidth="3.5"
                    fill="#261214"
                  />
                  <line x1="136" y1={faceCenterY + 20} x2="128" y2={faceCenterY + 14} stroke="#1a0b0e" strokeWidth="2" />
                  <line x1="184" y1={faceCenterY + 20} x2="192" y2={faceCenterY + 14} stroke="#1a0b0e" strokeWidth="2" />
                </g>
              ) : app.scar === 'rictus_grin' ? (
                <g>
                  <path d={`M 144 ${faceCenterY + 24} Q 160 ${faceCenterY + 31} 176 ${faceCenterY + 24} Q 160 ${faceCenterY + 21} 144 ${faceCenterY + 24} Z`} fill="#ebe4d8" stroke="#3a2822" strokeWidth="1.2" />
                  <line x1="146" y1={faceCenterY + 25} x2="174" y2={faceCenterY + 25} stroke="#59463e" strokeWidth="0.9" />
                </g>
              ) : app.scar === 'missing_teeth' ? (
                <g>
                  <ellipse cx="160" cy={faceCenterY + 25} rx="10" ry="4.2" fill="#2b1717" />
                  <rect x="155" y={faceCenterY + 22} width="3" height="3.2" fill="#dfd5c3" />
                  <rect x="160" y={faceCenterY + 22} width="3" height="3.2" fill="#dfd5c3" />
                  <rect x="165" y={faceCenterY + 22} width="2.5" height="3" fill="#dfd5c3" />
                </g>
              ) : (
                <path
                  d={
                    app.scar === 'red_lipstick'
                      ? `M 149 ${faceCenterY + 24} Q 160 ${faceCenterY + 29} 171 ${faceCenterY + 24}`
                      : `M 150 ${faceCenterY + 25} Q 160 ${faceCenterY + 27} 170 ${faceCenterY + 25}`
                  }
                  fill="none"
                  stroke={app.scar === 'red_lipstick' ? '#a82230' : '#633c36'}
                  strokeWidth={app.scar === 'red_lipstick' ? '3.4' : '2'}
                  strokeLinecap="round"
                />
              )}
            </g>
          )}

          {/* ===================== FACIAL HAIR ===================== */}
          {!isThermal && app.facialHair !== 'none' && (
            <g fill={hairFill} opacity="0.88">
              {app.facialHair === 'long_beard' && (
                <path d={`M 131 ${faceCenterY + 14} Q 134 ${faceCenterY + 62} 160 ${faceCenterY + 68} Q 186 ${faceCenterY + 62} 189 ${faceCenterY + 14} Q 174 ${faceCenterY + 34} 160 ${faceCenterY + 32} Q 146 ${faceCenterY + 34} 131 ${faceCenterY + 14} Z`} />
              )}
              {(app.facialHair === 'thick_beard' || app.facialHair === 'messy_beard' || app.facialHair === 'gray_beard' || app.facialHair === 'short_beard') && (
                <path d={`M 131 ${faceCenterY + 16} Q 136 ${faceCenterY + 48} 160 ${faceCenterY + 50} Q 184 ${faceCenterY + 48} 189 ${faceCenterY + 16} Q 172 ${faceCenterY + 32} 160 ${faceCenterY + 31} Q 148 ${faceCenterY + 32} 131 ${faceCenterY + 16} Z`} />
              )}
              {(app.facialHair === 'walrus_mustache' || app.facialHair === 'white_mustache' || app.facialHair === 'mustache') && (
                <path d={`M 144 ${faceCenterY + 22} Q 160 ${faceCenterY + 16} 176 ${faceCenterY + 22} Q 172 ${faceCenterY + 27} 160 ${faceCenterY + 23} Q 148 ${faceCenterY + 27} 144 ${faceCenterY + 22} Z`} />
              )}
              {app.facialHair === 'thin_mustache' && (
                <path d={`M 148 ${faceCenterY + 20} Q 160 ${faceCenterY + 17} 172 ${faceCenterY + 20}`} stroke={hairFill} strokeWidth="2" fill="none" />
              )}
              {app.facialHair === 'goatee' && (
                <path d={`M 152 ${faceCenterY + 30} Q 160 ${faceCenterY + 44} 168 ${faceCenterY + 30} Z`} />
              )}
              {(app.facialHair === 'stubble' || app.facialHair === 'patchy' || app.facialHair === 'gray_stubble' || app.facialHair === 'thick_stubble' || app.facialHair === 'unkempt' || app.facialHair === 'scraggly') && (
                <path
                  d={`M 134 ${faceCenterY + 20} Q 160 ${faceCenterY + 48} 186 ${faceCenterY + 20}`}
                  fill="none"
                  stroke={hairFill}
                  strokeWidth="6"
                  strokeDasharray="2 3"
                  opacity="0.4"
                />
              )}
            </g>
          )}

          {/* ===================== HAIR & HEADWEAR ===================== */}
          <g>
            {/* Babushka floral headscarf */}
            {app.hair === 'floral_headscarf' ? (
              <g>
                <path
                  d={`M 122 ${faceCenterY + 4} Q 124 ${faceCenterY - 52} 160 ${faceCenterY - 50} Q 196 ${faceCenterY - 52} 198 ${faceCenterY + 4} Q 186 ${faceCenterY + 46} 160 ${faceCenterY + 52} Q 134 ${faceCenterY + 46} 122 ${faceCenterY + 4} Z`}
                  fill="none"
                  stroke={isThermal ? '#2d3b66' : '#733039'}
                  strokeWidth="12"
                />
                {!isThermal && (
                  <g fill="#d49e52" opacity="0.75">
                    <circle cx="131" cy={faceCenterY - 24} r="2.2" />
                    <circle cx="188" cy={faceCenterY - 22} r="2.2" />
                    <circle cx="160" cy={faceCenterY - 46} r="2.4" />
                  </g>
                )}
              </g>
            ) : app.hair === 'foil_beanie' ? (
              <g>
                {/* Crinkled aluminum foil peeking out under wool beanie */}
                <path d={`M 124 ${faceCenterY - 18} L 196 ${faceCenterY - 18} L 192 ${faceCenterY - 12} L 128 ${faceCenterY - 12} Z`} fill="#cdd6db" stroke="#7d888f" />
                <path d={`M 124 ${faceCenterY - 18} Q 128 ${faceCenterY - 54} 160 ${faceCenterY - 54} Q 192 ${faceCenterY - 54} 196 ${faceCenterY - 18} Z`} fill={isThermal ? '#2a3763' : '#3d473e'} />
              </g>
            ) : app.hair === 'gray_officer_cap' || app.hair === 'rail_cap' ? (
              <g>
                <path d={`M 120 ${faceCenterY - 20} L 200 ${faceCenterY - 20} L 194 ${faceCenterY - 48} Q 160 ${faceCenterY - 56} 126 ${faceCenterY - 48} Z`} fill={app.hair === 'rail_cap' ? '#2c3338' : '#3f4b37'} stroke="#171a16" />
                <rect x="124" y={faceCenterY - 22} width="72" height="5" fill="#181a18" />
                {app.hair === 'gray_officer_cap' && !isThermal && (
                  <circle cx="160" cy={faceCenterY - 34} r="4.5" fill="#b3392e" stroke="#d4af37" strokeWidth="1.2" />
                )}
              </g>
            ) : app.hair === 'bald_smooth' ? null : app.hair === 'shaved' ? (
              <path
                d={`M ${160 - jawRx + 1} ${faceCenterY - 16} Q 160 ${faceCenterY - 52} ${160 + jawRx - 1} ${faceCenterY - 16}`}
                fill={hairFill}
                opacity="0.32"
              />
            ) : (
              <g fill={hairFill}>
                {/* Hair crown */}
                <path
                  d={`M ${160 - jawRx - 2} ${faceCenterY - 8}
                      Q ${160 - jawRx - 4} ${faceCenterY - 52} 160 ${faceCenterY - 50}
                      Q ${160 + jawRx + 4} ${faceCenterY - 52} ${160 + jawRx + 2} ${faceCenterY - 8}
                      Q ${160 + jawRx - 8} ${faceCenterY - 28} 160 ${faceCenterY - 30}
                      Q ${160 - jawRx + 8} ${faceCenterY - 28} ${160 - jawRx - 2} ${faceCenterY - 8} Z`}
                />
                {/* Top bun / updo */}
                {['bun', 'elegant_updo', 'tight_gray_bun', 'silver_bun', 'sharp_dark_chignon'].includes(app.hair) && (
                  <circle cx="160" cy={faceCenterY - 52} r="13" />
                )}
                {/* Silver streak for Dr. Valeria */}
                {app.hair === 'silver_streak_bob' && !isThermal && (
                  <path d={`M 134 ${faceCenterY - 34} Q 128 ${faceCenterY - 14} 131 ${faceCenterY + 6}`} stroke="#d8dde0" strokeWidth="4.5" fill="none" />
                )}
              </g>
            )}
          </g>

          {/* ===================== EYEWEAR & GOGGLES ===================== */}
          {!isThermal && app.eyewear !== 'none' && (
            <g>
              {app.eyewear === 'welding_goggles' ? (
                <g>
                  <line x1="124" y1={eyeY} x2="196" y2={eyeY} stroke="#2b241d" strokeWidth="5" />
                  <circle cx={leftEyeX} cy={eyeY} r="12" fill={isUv && uvFlag === 'hollow_sockets' ? '#07050a' : '#1f2924'} stroke="#695e4c" strokeWidth="3.5" />
                  <circle cx={rightEyeX} cy={eyeY} r="12" fill={isUv && uvFlag === 'hollow_sockets' ? '#07050a' : '#1f2924'} stroke="#695e4c" strokeWidth="3.5" />
                  {isUv && uvFlag === 'hollow_sockets' && (
                    <g fill="#7e22ce" opacity="0.65">
                      <circle cx={leftEyeX} cy={eyeY} r="5" />
                      <circle cx={rightEyeX} cy={eyeY} r="5" />
                    </g>
                  )}
                </g>
              ) : app.eyewear === 'eyepatch' ? (
                <g>
                  <line x1="126" y1={eyeY - 16} x2="194" y2={eyeY + 8} stroke="#1a1816" strokeWidth="2.4" />
                  <ellipse cx={leftEyeX} cy={eyeY} rx="10" ry="7.5" fill="#181716" stroke="#36322e" strokeWidth="1.2" />
                </g>
              ) : (
                <g
                  fill={app.eyewear === 'tinted_glasses' ? 'rgba(72,88,96,0.35)' : 'rgba(210,232,224,0.12)'}
                  stroke={app.eyewear === 'thick_glasses' || app.eyewear === 'thick_round_glasses' ? '#1c1a18' : '#736c62'}
                  strokeWidth={app.eyewear === 'thick_glasses' || app.eyewear === 'thick_round_glasses' ? '2.8' : '1.6'}
                >
                  <circle cx={leftEyeX} cy={eyeY} r={app.eyewear === 'round_glasses' ? 11.5 : 10} />
                  <circle cx={rightEyeX} cy={eyeY} r={app.eyewear === 'round_glasses' ? 11.5 : 10} />
                  <line x1={leftEyeX + 10} y1={eyeY} x2={rightEyeX - 10} y2={eyeY} />
                  {app.eyewear === 'bloody_glasses' && (
                    <circle cx={rightEyeX + 3} cy={eyeY + 2} r="3.5" fill="#821d1d" stroke="none" opacity="0.7" />
                  )}
                </g>
              )}
            </g>
          )}

          {/* ===================== CHARACTER PROPS & MICRO-TELLS ===================== */}
          {!compact && (
            <g>
              {/* Leica camera */}
              {app.prop === 'leica_camera' && (
                <g transform="translate(142, 198)">
                  <rect x="0" y="0" width="36" height="22" rx="2" fill="#262628" stroke="#8a8c8f" strokeWidth="1.2" />
                  <circle cx="19" cy="11" r="7" fill="#121416" stroke="#a6aab0" strokeWidth="1.5" />
                  <rect x="26" y="-4" width="6" height="4" fill="#a6aab0" />
                </g>
              )}
              {/* Radio headset */}
              {app.prop === 'headset' && (
                <g stroke="#292c2a" strokeWidth="3" fill="none">
                  <path d={`M 122 ${faceCenterY + 2} Q 124 ${faceCenterY - 56} 160 ${faceCenterY - 56} Q 196 ${faceCenterY - 56} 198 ${faceCenterY + 2}`} />
                  <rect x="116" y={faceCenterY - 4} width="9" height="18" rx="3" fill="#242926" />
                  <rect x="195" y={faceCenterY - 4} width="9" height="18" rx="3" fill="#242926" />
                </g>
              )}
              {/* Potted fern in glass jar (Yulia) */}
              {app.prop === 'fern_jar' && (
                <g transform="translate(216, 174)">
                  <rect x="0" y="10" width="34" height="46" rx="6" fill="rgba(180,215,195,0.22)" stroke="#89a899" strokeWidth="1.5" />
                  <path
                    d="M 17 50 Q 15 32 9 20 M 17 50 Q 18 28 24 18 M 17 48 Q 17 34 17 15"
                    stroke={zoomFlag === 'ash_veins' && (isZoom || isUv) ? '#1a1224' : '#4fa866'}
                    strokeWidth="2.4"
                    fill="none"
                  />
                </g>
              )}
              {/* Pickle basket (Babushka Zoya) */}
              {app.prop === 'pickle_basket' && (
                <g transform="translate(208, 184)">
                  <rect x="4" y="10" width="32" height="36" rx="4" fill={zoomFlag === 'black_ash' && (isZoom || isUv) ? '#16141a' : '#4b6b3c'} stroke="#a6b59f" strokeWidth="1.5" />
                  <rect x="2" y="6" width="36" height="6" fill="#7d6442" />
                </g>
              )}
              {/* Saxophone case */}
              {app.prop === 'sax_case' && (
                <g transform="translate(215, 165)">
                  <rect x="0" y="0" width="42" height="68" rx="7" fill={isThermal && zoomFlag === 'black_ash' ? '#ff6a1a' : '#3a2b20'} stroke="#1a140f" strokeWidth="2" />
                  <rect x="4" y="20" width="8" height="4" fill="#b59a58" />
                </g>
              )}
              {/* Stuffed crow (Ferenc) */}
              {app.prop === 'stuffed_crow' && (
                <g transform="translate(212, 174)">
                  <ellipse cx="20" cy="30" rx="15" ry="22" fill="#18191c" />
                  <circle cx="16" cy="12" r="9" fill="#18191c" />
                  <polygon points="8,11 -2,15 8,17" fill="#4f4d48" />
                  <circle cx="14" cy="11" r="2" fill="#d4b84c" />
                </g>
              )}
              {/* Electrolarynx pressed to Radek's throat */}
              {app.prop === 'electrolarynx' && (
                <g transform="translate(174, 164)">
                  <rect x="0" y="0" width="24" height="10" rx="3" fill="#545b5e" stroke="#222628" />
                  <circle cx="2" cy="5" r="3" fill="#9ca6ab" />
                </g>
              )}
              {/* Brass lantern (Jozef) */}
              {app.prop === 'brass_lantern' && (
                <g transform="translate(218, 176)">
                  <rect x="4" y="10" width="24" height="34" rx="4" fill={zoomFlag === 'black_ash' ? '#1c1c1e' : '#e6a83c'} opacity="0.85" stroke="#856b32" strokeWidth="2" />
                  <rect x="0" y="6" width="32" height="6" fill="#856b32" />
                </g>
              )}
              {/* Satellite phone (Irina) */}
              {app.prop === 'sat_phone' && (
                <g transform="translate(218, 178)">
                  <line x1="22" y1="0" x2="22" y2="-28" stroke="#7d8782" strokeWidth="2.5" />
                  <rect x="4" y="0" width="24" height="46" rx="3" fill="#232926" stroke="#5b6962" />
                  <rect x="8" y="6" width="16" height="10" fill="#3b7852" />
                </g>
              )}
              {/* Orthodox iron cross (Father Methodius) */}
              {app.prop === 'iron_cross' && (
                <g transform="translate(152, 198)" stroke="#9a9c99" strokeWidth="3">
                  <line x1="8" y1="0" x2="8" y2="30" />
                  <line x1="0" y1="9" x2="16" y2="9" />
                  <line x1="3" y1="22" x2="13" y2="25" />
                </g>
              )}
              {/* Concealed weapon highlight on Thermal or Zoom */}
              {(isThermal || isZoom) && zoomFlag === 'weapon' && (
                <g transform="translate(106, 198)">
                  <rect x="0" y="0" width="30" height="10" rx="2" fill={isThermal ? '#ff3b1f' : '#7a7e82'} stroke="#1a1a1a" />
                  <rect x="4" y="8" width="9" height="16" rx="1" fill={isThermal ? '#ff6a1a' : '#3a342e'} />
                </g>
              )}
              {/* Chitin claws on glass edge (Marfa / Zinaida / Tamara mimics) */}
              {(isUv || isZoom) && (uvFlag === 'chitin_nails' || zoomFlag === 'chitin_nails') && (
                <g transform="translate(70, 206)" fill="#0e0c14" stroke="#7e22ce" strokeWidth="0.9">
                  <path d="M 0 34 L 4 8 L 8 34 Z" />
                  <path d="M 10 34 L 15 4 L 19 34 Z" />
                  <path d="M 21 34 L 26 7 L 30 34 Z" />
                </g>
              )}
              {/* Stolen ID tags (Sonia / Danica) */}
              {isZoom && zoomFlag === 'stolen_id' && (
                <g transform="translate(132, 196)">
                  <rect x="0" y="0" width="18" height="24" fill="#d9d2c5" stroke="#5c2020" />
                  <rect x="12" y="4" width="18" height="24" fill="#cfc7b8" stroke="#5c2020" />
                  <rect x="24" y="1" width="18" height="24" fill="#e0d8cb" stroke="#5c2020" />
                </g>
              )}
            </g>
          )}
        </g>

        {/* ===================== AIRLOCK GLASS EFFECTS ===================== */}
        {/* Animated falling black ash outside the window */}
        {!isThermal && !compact && (
          <g>
            {ASH_PARTICLES.map((p, idx) => (
              <circle
                key={idx}
                cx={`${p.x}%`}
                cy="0"
                r={p.size}
                fill="#141414"
                opacity="0.72"
                className="ash-particle"
                style={{ animationDelay: p.delay, animationDuration: p.dur }}
              />
            ))}
          </g>
        )}

        {/* UV penlight cone overlay */}
        {isUv && <rect x="0" y="0" width="320" height="240" fill={`url(#uv-beam-${character.id})`} />}

        {/* Frost-rimmed scratched reinforced airlock glass */}
        {!compact && (
          <g pointerEvents="none">
            <rect x="0" y="0" width="320" height="240" fill={`url(#frost-rim-${character.id})`} />
            {/* Glass scratches */}
            <path d="M 38 42 L 74 68 M 248 164 L 286 144 M 24 196 L 62 184" stroke="#c8dfd3" strokeWidth="0.75" opacity="0.22" />
            {/* Reinforced steel corner bolts */}
            <circle cx="14" cy="14" r="3.5" fill="#2c3a33" stroke="#111714" />
            <circle cx="306" cy="14" r="3.5" fill="#2c3a33" stroke="#111714" />
            <circle cx="14" cy="226" r="3.5" fill="#2c3a33" stroke="#111714" />
            <circle cx="306" cy="226" r="3.5" fill="#2c3a33" stroke="#111714" />
          </g>
        )}

        {/* Optical Zoom targeting reticle */}
        {isZoom && !compact && (
          <g stroke="#9bb8a8" strokeWidth="0.9" opacity="0.55" fill="none" pointerEvents="none">
            <circle cx="160" cy="126" r="56" strokeDasharray="6 4" />
            <line x1="94" y1="126" x2="112" y2="126" />
            <line x1="208" y1="126" x2="226" y2="126" />
            <line x1="160" y1="60" x2="160" y2="78" />
            <line x1="160" y1="174" x2="160" y2="192" />
          </g>
        )}
      </svg>

      {/* Subtle CRT scanlines */}
      <div className="pointer-events-none absolute inset-0 crt-scanlines opacity-55" />

      {/* Active sensor overlay label inside viewport corner */}
      {!compact && activeTool !== 'none' && (
        <div className="pointer-events-none absolute top-2.5 left-2.5 px-2 py-0.5 bg-[#0a0f0c]/85 border border-[#3a4f44] font-tech text-[11px] tracking-wider text-[#cfe0d5]">
          {activeTool === 'uv' && 'UV-365NM PENLIGHT ACTIVE'}
          {activeTool === 'thermal' && `FLIR THERMAL · ${thermalTemp.toFixed(1)}°C`}
          {activeTool === 'geiger' && `GEIGER-MÜLLER · ${inspectionData?.tools?.geiger?.cpm ?? 0} CPM`}
          {activeTool === 'zoom' && 'OPTICAL MAGNIFIER · 1.4X'}
          {activeTool === 'ledger' && 'PAPER LEDGER CROSS-CHECK'}
        </div>
      )}
    </div>
  );
}
