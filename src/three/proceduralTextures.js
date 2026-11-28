// Procedural Canvas PBR Textures for Shelter B-04 (Zero external URLs / Zero 404s)
import * as THREE from 'three';

function finalizeTexture(canvas, renderer, repeatX = 1, repeatY = 1, isColor = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  if (renderer) {
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  tex.needsUpdate = true;
  return tex;
}

// Peeling Soviet mint-green oil paint over damp brutalist concrete wall
export function createMintConcreteTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Upper damp off-white concrete
  ctx.fillStyle = '#38423d';
  ctx.fillRect(0, 0, 512, 230);

  // Lower peeling mint-green Soviet enamel wainscot
  ctx.fillStyle = '#2d453b';
  ctx.fillRect(0, 230, 512, 282);

  // Dark trim stripe between upper concrete and mint wainscot
  ctx.fillStyle = '#1b2621';
  ctx.fillRect(0, 224, 512, 10);

  // Grime, damp streaks, and concrete mottling
  for (let i = 0; i < 650; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 4 + Math.random() * 22;
    ctx.fillStyle =
      Math.random() > 0.5
        ? `rgba(14, 20, 17, ${0.04 + Math.random() * 0.08})`
        : `rgba(116, 148, 131, ${0.03 + Math.random() * 0.06})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Peeling paint chips revealing raw gray concrete beneath
  for (let i = 0; i < 42; i++) {
    const x = Math.random() * 512;
    const y = 240 + Math.random() * 260;
    const w = 10 + Math.random() * 34;
    const h = 6 + Math.random() * 20;
    ctx.fillStyle = 'rgba(42, 46, 44, 0.72)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(130, 168, 148, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  // Vertical water seepage stains
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * 512;
    const grad = ctx.createLinearGradient(x, 0, x, 512);
    grad.addColorStop(0, 'rgba(12, 16, 14, 0.25)');
    grad.addColorStop(0.5, 'rgba(18, 22, 19, 0.1)');
    grad.addColorStop(1, 'rgba(10, 12, 11, 0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 5 + Math.random() * 14, 512);
  }

  return finalizeTexture(c, renderer, 2, 1, true);
}

// Cold speckled concrete bunker floor tiles with oil stains & grime
export function createBunkerFloorTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#262b28';
  ctx.fillRect(0, 0, 512, 512);

  // Tile seams
  ctx.strokeStyle = 'rgba(10, 13, 11, 0.65)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Concrete aggregate speckle & grease
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const s = 1 + Math.random() * 4;
    ctx.fillStyle =
      Math.random() > 0.5
        ? 'rgba(14, 17, 15, 0.26)'
        : 'rgba(92, 104, 96, 0.14)';
    ctx.fillRect(x, y, s, s);
  }

  // Subtle diesel puddle smudge
  ctx.fillStyle = 'rgba(14, 18, 16, 0.32)';
  ctx.beginPath();
  ctx.ellipse(340, 290, 75, 42, 0.3, 0, Math.PI * 2);
  ctx.fill();

  return finalizeTexture(c, renderer, 3, 3, true);
}

// Riveted oxidized steel bulkhead plating with subtle Soviet stencil warning stripes
export function createBulkheadSteelTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#252e2a';
  ctx.fillRect(0, 0, 512, 512);

  // Welded seam panels
  ctx.strokeStyle = '#141a17';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 496, 496);
  ctx.beginPath();
  ctx.moveTo(256, 8);
  ctx.lineTo(256, 504);
  ctx.moveTo(8, 256);
  ctx.lineTo(504, 256);
  ctx.stroke();

  // Rivets along seams
  ctx.fillStyle = '#3c4a43';
  for (let p = 24; p < 500; p += 32) {
    [18, 246, 266, 494].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, p, 3.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Rust & brushed scratches
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle =
      Math.random() > 0.72
        ? 'rgba(110, 62, 34, 0.14)'
        : 'rgba(160, 186, 172, 0.05)';
    ctx.fillRect(x, y, 2 + Math.random() * 18, 1 + Math.random() * 3);
  }

  // Industrial hazard stripe along bottom edge
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 456, 512, 56);
  ctx.clip();
  ctx.fillStyle = '#8f6120';
  ctx.fillRect(0, 456, 512, 56);
  ctx.fillStyle = '#1b1d1b';
  for (let x = -64; x < 576; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 456);
    ctx.lineTo(x + 22, 456);
    ctx.lineTo(x - 10, 512);
    ctx.lineTo(x - 32, 512);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  return finalizeTexture(c, renderer, 1, 1, true);
}

// Scratched condensation-rimmed reinforced airlock glass texture
export function createAirlockGlassTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.clearRect(0, 0, 512, 512);

  // Subtle frost rim around glass perimeter
  const grad = ctx.createRadialGradient(256, 256, 150, 256, 256, 290);
  grad.addColorStop(0, 'rgba(180, 212, 198, 0.04)');
  grad.addColorStop(0.72, 'rgba(160, 196, 180, 0.14)');
  grad.addColorStop(1, 'rgba(170, 210, 194, 0.48)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Fine scratches and wire-mesh reinforcement lines
  ctx.strokeStyle = 'rgba(205, 228, 216, 0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const x1 = Math.random() * 512;
    const y1 = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + (Math.random() - 0.5) * 90, y1 + (Math.random() - 0.5) * 70);
    ctx.stroke();
  }

  return finalizeTexture(c, renderer, 1, 1, true);
}

// Soviet Shortwave Radio Illuminated Analog Dial Texture
export function createRadioDialTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#1b160e';
  ctx.fillRect(0, 0, 512, 160);

  // Warm amber phosphor glow strip
  const grad = ctx.createLinearGradient(0, 20, 0, 140);
  grad.addColorStop(0, '#593b14');
  grad.addColorStop(0.5, '#8c5d1d');
  grad.addColorStop(1, '#3d280e');
  ctx.fillStyle = grad;
  ctx.fillRect(14, 18, 484, 124);

  // Frequency graduation marks
  ctx.strokeStyle = '#f5d28c';
  ctx.fillStyle = '#fae1ab';
  ctx.font = 'bold 18px monospace';
  for (let i = 0; i <= 24; i++) {
    const x = 32 + i * 18.6;
    const h = i % 4 === 0 ? 28 : 14;
    ctx.lineWidth = i % 4 === 0 ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(x, 78);
    ctx.lineTo(x, 78 - h);
    ctx.stroke();
  }

  const freqs = ['3.5', '4.62', '5.3', '6.88', '7.14', '8.2', '9.5'];
  freqs.forEach((f, idx) => {
    ctx.fillText(f, 26 + idx * 72, 118);
  });

  // Red tuning needle
  ctx.strokeStyle = '#e6392e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(228, 18);
  ctx.lineTo(228, 142);
  ctx.stroke();

  return finalizeTexture(c, renderer, 1, 1, true);
}

// Wall-mounted Civil Defense Sign / Stencil Placard Texture
export function createPlacardTexture(renderer, title, subtitle, accent = '#d9822b') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#19221e';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, 488, 232);

  ctx.fillStyle = accent;
  ctx.font = 'bold 52px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, 256, 118);

  ctx.fillStyle = '#cfdcd4';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(subtitle, 256, 178);

  return finalizeTexture(c, renderer, 1, 1, true);
}

// Dynamic Protocol Memo Board Texture (updates each day!)
export function createProtocolBoardTexture(renderer, day, ruleText) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const ctx = c.getContext('2d');

  // Aged paper pinned on clipboard
  ctx.fillStyle = '#d8d0ba';
  ctx.fillRect(0, 0, 512, 384);

  // Subtle horizontal notebook lines
  ctx.strokeStyle = 'rgba(55, 65, 58, 0.2)';
  ctx.lineWidth = 2;
  for (let y = 64; y < 370; y += 30) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(488, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#8c2222';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`SHELTER B-04 · DAY ${day} DIRECTIVE`, 28, 50);

  ctx.fillStyle = '#1b211c';
  ctx.font = '20px monospace';
  // Word wrap
  const words = String(ruleText || '').split(' ');
  let line = '';
  let y = 104;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > 450) {
      ctx.fillText(line, 28, y);
      line = w;
      y += 30;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 28, y);

  return finalizeTexture(c, renderer, 1, 1, true);
}
