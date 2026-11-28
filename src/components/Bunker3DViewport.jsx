import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BUNKER_BOUNDS,
  CAMERA_PRESETS,
  createBunkerScene,
} from '../three/bunkerScene.js';
import {
  animateVisitor3D,
  applyVisitorInspectionMode,
  buildVisitor3D,
  disposeVisitor3D,
} from '../three/visitorBuilder3D.js';
import { soundEngine } from '../utils/soundEngine.js';

// Pre-allocated math helpers outside the per-frame loop (Zero GC)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _rayNdc = new THREE.Vector2(0, 0);

function clampPlayerPosition(pos) {
  pos.x = THREE.MathUtils.clamp(pos.x, BUNKER_BOUNDS.minX, BUNKER_BOUNDS.maxX);
  pos.z = THREE.MathUtils.clamp(pos.z, BUNKER_BOUNDS.minZ, BUNKER_BOUNDS.maxZ);

  for (let i = 0; i < BUNKER_BOUNDS.obstacles.length; i++) {
    const ob = BUNKER_BOUNDS.obstacles[i];
    if (pos.x > ob.minX && pos.x < ob.maxX && pos.z > ob.minZ && pos.z < ob.maxZ) {
      const dLeft = Math.abs(pos.x - ob.minX);
      const dRight = Math.abs(ob.maxX - pos.x);
      const dFront = Math.abs(pos.z - ob.minZ);
      const dBack = Math.abs(ob.maxZ - pos.z);
      const minD = Math.min(dLeft, dRight, dFront, dBack);
      if (minD === dLeft) pos.x = ob.minX;
      else if (minD === dRight) pos.x = ob.maxX;
      else if (minD === dFront) pos.z = ob.minZ;
      else pos.z = ob.maxZ;
    }
  }
}

export default function Bunker3DViewport({
  gameState,
  broadcast,
  inspectionData,
  activeTool,
  modalOpen,
  cameraPresetRequest,
  onInteract,
  onHoveredChange,
  onPointerLockChange,
}) {
  const mountRef = useRef(null);
  const [contextLost, setContextLost] = useState(false);

  // Keep latest reactive values in refs so the Three.js scene mounts ONCE and never resets!
  const latestRef = useRef({
    gameState,
    broadcast,
    inspectionData,
    activeTool,
    modalOpen,
    onInteract,
    onHoveredChange,
    onPointerLockChange,
  });
  latestRef.current = {
    gameState,
    broadcast,
    inspectionData,
    activeTool,
    modalOpen,
    onInteract,
    onHoveredChange,
    onPointerLockChange,
  };

  // Refs to scene controllers exposed to sibling synchronization effects
  const controllerRef = useRef(null);
  const glideTargetRef = useRef(null);

  // Release pointer lock automatically whenever an interaction modal opens
  useEffect(() => {
    if (modalOpen && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }, [modalOpen]);

  // Trigger smooth damped camera walk when user clicks a preset button
  useEffect(() => {
    if (!cameraPresetRequest || !cameraPresetRequest.key) return;
    const preset = CAMERA_PRESETS[cameraPresetRequest.key];
    if (preset) {
      glideTargetRef.current = {
        x: preset.pos[0],
        y: preset.pos[1],
        z: preset.pos[2],
        yaw: preset.yaw,
        pitch: preset.pitch,
      };
    }
  }, [cameraPresetRequest]);

  // Mount Three.js renderer & walkable 3D bunker ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect software WebGL (SwiftShader / llvmpipe / WARP) cleanly
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f0d);
    scene.fog = new THREE.FogExp2(0x0b0f0d, 0.085);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(66, width / height, 0.08, 32);
    camera.rotation.order = 'YXZ';
    camera.layers.enable(0);

    // Start facing the Shortwave Radio slightly left or Airlock ahead
    const playerPos = new THREE.Vector3(0, 1.62, 0.85);
    let yaw = 0.35;
    let pitch = -0.05;
    camera.position.copy(playerPos);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.cursor = 'crosshair';
    container.innerHTML = '';
    container.appendChild(canvas);

    // Mandatory studio environment map for metallic steel, brass, and glass reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.42;
    pmremGenerator.dispose();

    // Build full walkable 3D bunker interior + interactive props
    const bunker = createBunkerScene(scene, renderer, isSoftwareGl);

    // Raycaster strictly targeting Layer 1 simplified proxy boxes
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    raycaster.far = 4.6;

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Track current 3D visitor mesh
    let currentVisitorGroup = null;
    let currentVisitorKey = null;

    const syncVisitorMesh = (inspection, activeToolNow, phase) => {
      const shouldShowVisitor = phase === 'AIRLOCK_SHIFT' && Boolean(inspection?.character);
      const nextKey = shouldShowVisitor
        ? `${inspection.character.id}_${inspection.actualAlignment}`
        : null;

      if (nextKey !== currentVisitorKey) {
        if (currentVisitorGroup) {
          bunker.visitorMount.remove(currentVisitorGroup);
          disposeVisitor3D(currentVisitorGroup);
          currentVisitorGroup = null;
        }
        currentVisitorKey = nextKey;
        if (shouldShowVisitor) {
          currentVisitorGroup = buildVisitor3D(inspection.character, inspection);
          bunker.visitorMount.add(currentVisitorGroup);
        }
      }
      if (currentVisitorGroup) {
        applyVisitorInspectionMode(currentVisitorGroup, activeToolNow);
      }
    };

    controllerRef.current = {
      bunker,
      syncVisitorMesh,
    };

    // ==================== INPUT STATE & CONTROLS ====================
    const keys = Object.create(null);
    let isPointerLocked = false;
    let isDragging = false;
    let dragMoved = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let cursorNdcX = 0;
    let cursorNdcY = 0;
    let hoveredObj = null;
    let lastRaycastTime = 0;
    let bobPhase = 0;
    let stepIndex = 0;

    const onContextLost = (e) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const onPointerLockChangeDom = () => {
      isPointerLocked = document.pointerLockElement === canvas;
      latestRef.current.onPointerLockChange?.(isPointerLocked);
      if (isPointerLocked) {
        cursorNdcX = 0;
        cursorNdcY = 0;
      }
    };
    document.addEventListener('pointerlockchange', onPointerLockChangeDom);

    const doRaycast = (ndcX, ndcY) => {
      _rayNdc.set(ndcX, ndcY);
      raycaster.setFromCamera(_rayNdc, camera);
      const hits = raycaster.intersectObjects(bunker.interactables, false);
      const hit = hits.length > 0 ? hits[0].object : null;
      const nextId = hit ? hit.userData.interactId : null;
      const prevId = hoveredObj ? hoveredObj.userData.interactId : null;

      if (nextId !== prevId) {
        hoveredObj = hit;
        bunker.setHighlightedInteractable(nextId);
        latestRef.current.onHoveredChange?.(
          hit ? { id: nextId, label: hit.userData.label } : null
        );
      }
      return hit;
    };

    const onKeyDown = (e) => {
      if (latestRef.current.modalOpen) return;
      keys[e.code] = true;

      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        glideTargetRef.current = null;
      }

      if (e.code === 'KeyE') {
        const target = doRaycast(isPointerLocked ? 0 : cursorNdcX, isPointerLocked ? 0 : cursorNdcY);
        if (target) {
          e.preventDefault();
          latestRef.current.onInteract?.(target.userData.interactId);
        }
      }
    };

    const onKeyUp = (e) => {
      keys[e.code] = false;
    };

    const onPointerDown = (e) => {
      if (latestRef.current.modalOpen) return;
      if (e.button !== 0 && e.button !== 2) return;
      isDragging = true;
      dragMoved = false;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onPointerMove = (e) => {
      if (latestRef.current.modalOpen) return;

      if (isPointerLocked) {
        glideTargetRef.current = null;
        yaw -= e.movementX * 0.0022;
        pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.002, -1.05, 1.05);
      } else {
        const rect = canvas.getBoundingClientRect();
        cursorNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        cursorNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (isDragging) {
          const dx = e.clientX - lastMouseX;
          const dy = e.clientY - lastMouseY;
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            dragMoved = true;
            glideTargetRef.current = null;
          }
          yaw -= dx * 0.0042;
          pitch = THREE.MathUtils.clamp(pitch - dy * 0.0036, -1.05, 1.05);
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
        }
      }
    };

    const onPointerUp = (e) => {
      if (latestRef.current.modalOpen) {
        isDragging = false;
        return;
      }
      if (!isDragging) return;
      isDragging = false;

      if (!dragMoved && e.button === 0) {
        // Direct click on a 3D interactive object triggers it right away!
        const hit = doRaycast(isPointerLocked ? 0 : cursorNdcX, isPointerLocked ? 0 : cursorNdcY);
        if (hit) {
          latestRef.current.onInteract?.(hit.userData.interactId);
        } else if (!isPointerLocked && canvas.requestPointerLock) {
          // Clicking empty wall/floor enters immersive FPS Pointer Lock!
          try {
            const p = canvas.requestPointerLock();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch {
            // Pointer lock may be blocked in strict sandboxes — click-drag stays active seamlessly
          }
        }
      }
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // ==================== MAIN ANIMATION LOOP (GPU + SOFTWARE WEBGL SAFE) ====================
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb) {
      const gl = renderer.getContext();
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (st === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;

      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const { gameState: gs, activeTool: tool, modalOpen: isModal } = latestRef.current;

      // 1. First-person WASD / Arrow movement OR smooth damped camera preset glide
      if (!isModal) {
        if (glideTargetRef.current) {
          const g = glideTargetRef.current;
          playerPos.x = THREE.MathUtils.damp(playerPos.x, g.x, 6, dt);
          playerPos.z = THREE.MathUtils.damp(playerPos.z, g.z, 6, dt);
          // Shortest angular delta for yaw
          let dYaw = ((g.yaw - yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
          if (dYaw < -Math.PI) dYaw += Math.PI * 2;
          yaw += dYaw * (1 - Math.exp(-6 * dt));
          pitch = THREE.MathUtils.damp(pitch, g.pitch, 6, dt);

          if (
            Math.hypot(playerPos.x - g.x, playerPos.z - g.z) < 0.04 &&
            Math.abs(dYaw) < 0.025
          ) {
            glideTargetRef.current = null;
          }
        } else {
          // Optional Q/E-free keyboard turn with Left/Right? Let ArrowLeft/Right strafe smoothly
          const moveF = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
          const moveR = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);

          if (moveF !== 0 || moveR !== 0) {
            _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
            _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
            _move.set(0, 0, 0);
            _move.addScaledVector(_forward, moveF);
            _move.addScaledVector(_right, moveR);
            if (_move.lengthSq() > 0) {
              _move.normalize();
              const walkSpeed = 2.65;
              playerPos.addScaledVector(_move, walkSpeed * dt);
              clampPlayerPosition(playerPos);

              // Organic head bob + concrete footsteps
              const prevSin = Math.sin(bobPhase);
              bobPhase += dt * 9.5;
              const currSin = Math.sin(bobPhase);
              if (prevSin > -0.75 && currSin <= -0.75) {
                stepIndex += 1;
                soundEngine.playFootstep(stepIndex);
              }
            }
          } else {
            bobPhase = THREE.MathUtils.damp(bobPhase, 0, 6, dt);
          }
        }
      }

      // 2. Smooth Optical Zoom FOV + Low-Sanity subtle camera sway
      const targetFov = tool === 'zoom' ? 30 : 66;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
        camera.updateProjectionMatrix();
      }

      const sanitySway = gs && gs.sanity < 35 ? Math.sin(elapsed * 1.9) * 0.012 : 0;
      const headBobY = Math.sin(bobPhase) * 0.026;
      camera.position.set(playerPos.x, 1.62 + headBobY, playerPos.z);
      camera.rotation.set(pitch, yaw, sanitySway, 'YXZ');

      // 3. Throttled center/cursor raycast for interactive highlight (20Hz)
      const nowMs = performance.now();
      if (!isModal && nowMs - lastRaycastTime > 50) {
        lastRaycastTime = nowMs;
        doRaycast(isPointerLocked ? 0 : cursorNdcX, isPointerLocked ? 0 : cursorNdcY);
      }

      // 4. Animate bunker machinery, shutter, ash particles & 3D visitor
      bunker.animateBunker(dt, elapsed, {
        fuel: gs?.fuel ?? 10,
        phase: gs?.phase ?? 'MORNING_RADIO',
        activeTool: tool,
      });

      if (currentVisitorGroup) {
        animateVisitor3D(currentVisitorGroup, dt, elapsed);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    // Kick off initial state sync & render loop
    const init = latestRef.current;
    if (init.broadcast) {
      bunker.updateProtocolBoard(init.broadcast.day, init.broadcast.diagnosticRule);
    }
    bunker.syncBunkerWorldState({
      phase: init.gameState.phase,
      fuel: init.gameState.fuel,
      food: init.gameState.food,
      water: init.gameState.water,
      activeTool: init.activeTool,
      geigerCpm: init.inspectionData?.tools?.geiger?.cpm ?? 0,
    });
    syncVisitorMesh(init.inspectionData, init.activeTool, init.gameState.phase);
    tick();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      document.removeEventListener('pointerlockchange', onPointerLockChangeDom);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
      }
      if (currentVisitorGroup) {
        disposeVisitor3D(currentVisitorGroup);
      }
      bunker.disposeBunker();
      envRT.dispose();
      renderer.dispose();
      controllerRef.current = null;
    };
  }, []);

  // Sync dynamic bunker state & 3D visitor without remounting WebGL
  useEffect(() => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    ctrl.bunker.syncBunkerWorldState({
      phase: gameState.phase,
      fuel: gameState.fuel,
      food: gameState.food,
      water: gameState.water,
      activeTool,
      geigerCpm: inspectionData?.tools?.geiger?.cpm ?? 0,
    });
    ctrl.syncVisitorMesh(inspectionData, activeTool, gameState.phase);
  }, [
    gameState.phase,
    gameState.fuel,
    gameState.food,
    gameState.water,
    activeTool,
    inspectionData,
  ]);

  // Update wall-mounted protocol board texture whenever day changes
  useEffect(() => {
    const ctrl = controllerRef.current;
    if (!ctrl || !broadcast) return;
    ctrl.bunker.updateProtocolBoard(broadcast.day, broadcast.diagnosticRule);
  }, [broadcast?.day]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b0f0d]">
      {/* Dedicated isolated WebGL canvas host */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Subtle scanline & inspection lens edge vignettes (NO backdrop-filter over WebGL!) */}
      {activeTool === 'thermal' && (
        <div
          className="pointer-events-none absolute inset-0 border-4 border-[#e67e22]/55"
          style={{
            boxShadow: 'inset 0 0 90px rgba(34, 18, 66, 0.65)',
          }}
        />
      )}
      {activeTool === 'uv' && (
        <div
          className="pointer-events-none absolute inset-0 border-2 border-[#a855f7]/50"
          style={{
            boxShadow: 'inset 0 0 85px rgba(88, 28, 135, 0.48)',
          }}
        />
      )}
      {activeTool === 'zoom' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 rounded-full border border-[#8fb59f]/55" />
        </div>
      )}

      {/* WebGL Context Lost Fallback */}
      {contextLost && (
        <div className="absolute inset-0 z-30 bg-[#0d1210] flex flex-col items-center justify-center p-6 text-center">
          <p className="font-display text-2xl uppercase text-[#e6efe9]">
            3D Graphics Context Interrupted
          </p>
          <p className="text-sm font-tech text-[#95ab9d] mt-2">
            Attempting to restore Shelter B-04 viewport...
          </p>
        </div>
      )}
    </div>
  );
}
