"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface AgentState {
  stance: string;
  active: boolean;
  hasSpoken: boolean;
}

interface Props {
  agentStates: Record<string, AgentState>;
}

const AGENT_COLOR: Record<string, number> = {
  CEO:  0x7c9ee8,
  CFO:  0x2dd4a0,
  CMO:  0xe87c4a,
  Risk: 0xc47ce8,
};

const AGENT_LABEL: Record<string, string> = {
  CEO:  "CEO",
  CFO:  "CFO",
  CMO:  "CMO",
  Risk: "Risk",
};

const STANCE_COLOR: Record<string, number> = {
  approve:     0x2dd4a0,
  conditional: 0xe8a830,
  reject:      0xe85555,
  idle:        0x2a3040,
};

function voxel(
  scene: THREE.Scene,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  color: number,
  emissive = 0x000000,
  emissiveIntensity = 0,
) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Draw text onto a canvas and return as a texture
function makeTextTexture(text: string, color: string, fontSize = 48, bold = false): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 64);
  // Background pill
  ctx.fillStyle = "rgba(8,12,20,0.82)";
  const rx = 12;
  const w = 256, h = 64;
  ctx.beginPath();
  ctx.moveTo(rx, 0); ctx.lineTo(w - rx, 0);
  ctx.quadraticCurveTo(w, 0, w, rx);
  ctx.lineTo(w, h - rx); ctx.quadraticCurveTo(w, h, w - rx, h);
  ctx.lineTo(rx, h); ctx.quadraticCurveTo(0, h, 0, h - rx);
  ctx.lineTo(0, rx); ctx.quadraticCurveTo(0, 0, rx, 0);
  ctx.closePath();
  ctx.fill();
  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  // Text
  ctx.fillStyle = color;
  ctx.font = `${bold ? "bold " : ""}${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 34);
  return new THREE.CanvasTexture(canvas);
}

// Thinking bubble texture (animated dots are handled by swapping textures)
function makeThinkTexture(dots: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 80;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 160, 80);
  // Cloud shape
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.ellipse(80, 44, 60, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tail bubbles
  ctx.beginPath(); ctx.ellipse(38, 64, 10, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(25, 74, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
  // Dots
  const dotColors = ["#333", "#555", "#333"];
  const positions = [58, 80, 102];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < dots ? "#1a1a2e" : "#aaa";
    ctx.beginPath();
    ctx.arc(positions[i], 44, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

function buildCabin(
  scene: THREE.Scene,
  cx: number, cz: number,
  agentColor: number,
  agentKey: string,
): {
  character: THREE.Group;
  monitor: THREE.Mesh;
  stancePlane: THREE.Mesh;
  nameSprite: THREE.Sprite;
  thinkSprite: THREE.Sprite;
  glowLight: THREE.PointLight;
} {
  const floorColor = 0x1a2235;
  const wallColor  = 0x151c2a;
  const deskColor  = 0x5c3d1e;
  const deskTop    = 0x7a5230;
  const chairColor = 0x2a2a3a;
  const chairSeat  = 0x3a3a5a;

  voxel(scene, 7, 0.2, 7, cx, 0, cz, floorColor);
  voxel(scene, 7, 3, 0.2, cx, 1.6, cz - 3.4, wallColor);
  voxel(scene, 0.2, 3, 7, cx - 3.4, 1.6, cz, wallColor);
  voxel(scene, 0.2, 3, 7, cx + 3.4, 1.6, cz, wallColor);
  voxel(scene, 3, 0.1, 0.5, cx, 3, cz, 0xffffee);

  voxel(scene, 3.5, 0.3, 1.4, cx - 0.5, 1.2, cz - 1.5, deskTop);
  voxel(scene, 3.4, 1.0, 1.3, cx - 0.5, 0.7, cz - 1.5, deskColor);

  voxel(scene, 0.1, 0.4, 0.3, cx - 0.5, 1.55, cz - 2.0, 0x222233);
  const monitor = voxel(scene, 1.4, 1.0, 0.1, cx - 0.5, 2.1, cz - 2.1, 0x111122);
  monitor.castShadow = false;

  voxel(scene, 1.2, 0.08, 0.5, cx - 0.5, 1.38, cz - 1.3, 0x333344);

  voxel(scene, 1.0, 0.15, 1.0, cx - 0.5, 0.9, cz + 0.4, chairSeat);
  voxel(scene, 1.0, 1.0, 0.15, cx - 0.5, 1.4, cz + 0.9, chairColor);
  voxel(scene, 0.1, 0.6, 0.1, cx - 1.0, 0.6, cz + 0.4, chairColor);
  voxel(scene, 0.1, 0.6, 0.1, cx + 0.0, 0.6, cz + 0.4, chairColor);

  // Character
  const charGroup = new THREE.Group();
  scene.add(charGroup);
  charGroup.position.set(cx - 0.5, 0, cz + 0.3);

  const bodyMat = new THREE.MeshLambertMaterial({ color: agentColor, emissive: agentColor, emissiveIntensity: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), bodyMat);
  body.position.set(0, 1.55, 0);
  charGroup.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45),
    new THREE.MeshLambertMaterial({ color: 0xf5c8a0 }));
  head.position.set(0, 2.1, 0);
  charGroup.add(head);

  const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.01);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.1, 2.12, 0.23);
  charGroup.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.1, 2.12, 0.23);
  charGroup.add(eyeR);

  const armMat = new THREE.MeshLambertMaterial({ color: agentColor, emissive: agentColor, emissiveIntensity: 0.05 });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.2), armMat);
  armL.position.set(-0.42, 1.52, 0); armL.rotation.x = -0.4;
  charGroup.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.2), armMat);
  armR.position.set(0.42, 1.52, 0); armR.rotation.x = -0.4;
  charGroup.add(armR);

  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a4a });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), legMat);
  legL.position.set(-0.16, 1.05, 0.15); legL.rotation.x = -1.0;
  charGroup.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), legMat);
  legR.position.set(0.16, 1.05, 0.15); legR.rotation.x = -1.0;
  charGroup.add(legR);

  // Stance bar
  const stancePlane = voxel(scene, 1.0, 0.25, 0.05, cx - 0.5, 2.7, cz + 0.3, 0x2a3040, 0x2a3040, 0.3);

  // ── Name sprite (always visible) ──
  const nameTex = makeTextTexture(agentKey, "#" + agentColor.toString(16).padStart(6, "0"), 44, true);
  const nameMat = new THREE.SpriteMaterial({ map: nameTex, transparent: true, depthTest: false });
  const nameSprite = new THREE.Sprite(nameMat);
  nameSprite.scale.set(2.2, 0.55, 1);
  nameSprite.position.set(cx - 0.5, 3.1, cz + 0.3);
  scene.add(nameSprite);

  // ── Thinking sprite (hidden by default) ──
  const thinkTex = makeThinkTexture(1);
  const thinkMat = new THREE.SpriteMaterial({ map: thinkTex, transparent: true, depthTest: false });
  const thinkSprite = new THREE.Sprite(thinkMat);
  thinkSprite.scale.set(1.6, 0.8, 1);
  thinkSprite.position.set(cx + 0.6, 3.7, cz + 0.3);
  thinkSprite.visible = false;
  scene.add(thinkSprite);

  // Glow light
  const light = new THREE.PointLight(agentColor, 0.2, 5);
  light.position.set(cx, 3, cz);
  scene.add(light);

  return { character: charGroup, monitor, stancePlane, nameSprite, thinkSprite, glowLight: light };
}

export default function Office3D({ agentStates }: Props) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const refsRef   = useRef<Record<string, {
    character:   THREE.Group;
    monitor:     THREE.Mesh;
    stancePlane: THREE.Mesh;
    nameSprite:  THREE.Sprite;
    thinkSprite: THREE.Sprite;
    glowLight:   THREE.PointLight;
  }>>({});
  const stateRef  = useRef(agentStates);

  // Keep stateRef current without rebuilding the scene
  useEffect(() => { stateRef.current = agentStates; }, [agentStates]);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth, H = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1117);
    scene.fog = new THREE.Fog(0x0e1117, 28, 45);

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(0, 18, 18);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x8899bb, 0.6));
    const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    scene.add(sun);

    // Office floor + corridors
    voxel(scene, 18, 0.3, 18, 0, -0.15, 0, 0x0d1520);
    voxel(scene, 2, 0.32, 18, 0, -0.05, 0, 0x111d2e);
    voxel(scene, 18, 0.32, 2, 0, -0.05, 0, 0x111d2e);

    // Central table
    voxel(scene, 3.0, 0.25, 1.8, 0, 0.42, 0, 0x8b6914);
    voxel(scene, 2.8, 0.12, 1.6, 0, 0.55, 0, 0xc9a84c);
    for (const [tx, tz] of [[-1.2,-0.6],[1.2,-0.6],[-1.2,0.6],[1.2,0.6]]) {
      voxel(scene, 0.15, 0.4, 0.15, tx as number, 0.2, tz as number, 0x5c3d1e);
    }
    for (const [cx2,,cz2] of [[-1.8,0,0],[1.8,0,0],[0,0,-1.4],[0,0,1.4]]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.1,0.6),
        new THREE.MeshLambertMaterial({color:0x2a3050}));
      s.position.set(cx2 as number, 0.5, cz2 as number);
      scene.add(s);
    }

    // Plants
    for (const [px,pz] of [[-7.5,-7.5],[7.5,-7.5],[-7.5,7.5],[7.5,7.5]] as [number,number][]) {
      voxel(scene, 0.4,0.5,0.4, px,0.25,pz, 0x3d2a1a);
      voxel(scene, 0.8,0.8,0.8, px,0.9,pz,  0x1a4a1a);
      voxel(scene, 0.5,0.5,0.5, px,1.4,pz,  0x2a6a2a);
    }

    // Cabins
    const cabinDefs: [number, number, string][] = [
      [-4.5, -4.5, "Risk"],
      [ 4.5, -4.5, "CFO"],
      [-4.5,  4.5, "CMO"],
      [ 4.5,  4.5, "CEO"],
    ];
    for (const [cx, cz, agent] of cabinDefs) {
      const color = AGENT_COLOR[agent] || 0x7c9ee8;
      const refs = buildCabin(scene, cx, cz, color, agent);
      refsRef.current[agent] = { ...refs, glowLight: refs.glowLight };
    }

    // Animation
    let frame = 0;
    let thinkDots = 1;
    let animId: number;
    const thinkTexCache: THREE.CanvasTexture[] = [1,2,3].map(makeThinkTexture);

    function animate() {
      animId = requestAnimationFrame(animate);
      frame++;

      // Subtle camera sway
      camera.position.x = Math.sin(frame * 0.002) * 1.5;
      camera.lookAt(0, 0, 0);

      // Animate thinking dots every 18 frames (~3 steps/sec at 60fps)
      if (frame % 18 === 0) thinkDots = (thinkDots % 3) + 1;

      for (const [agent, refs] of Object.entries(refsRef.current)) {
        const state = stateRef.current[agent];
        if (!state) continue;

        const isActive  = state.active;
        const hasSpoken = state.hasSpoken;
        const stanceCol = STANCE_COLOR[state.stance] ?? STANCE_COLOR.idle;

        // Bob character when thinking
        refs.character.position.y = isActive ? Math.sin(frame * 0.12) * 0.06 : 0;

        // Head slight turn
        const head = refs.character.children[1] as THREE.Mesh;
        if (head) head.rotation.y = isActive ? Math.sin(frame * 0.06) * 0.2 : 0;

        // Monitor glow
        const monMat = refs.monitor.material as THREE.MeshLambertMaterial;
        monMat.emissive.setHex(isActive ? 0x3366ff : hasSpoken ? 0x112244 : 0x000000);
        monMat.emissiveIntensity = isActive ? 0.5 + Math.sin(frame * 0.1) * 0.2 : hasSpoken ? 0.12 : 0;

        // Stance bar
        const spMat = refs.stancePlane.material as THREE.MeshLambertMaterial;
        spMat.color.setHex(stanceCol);
        spMat.emissive.setHex(stanceCol);
        spMat.emissiveIntensity = isActive ? 0.6 : hasSpoken ? 0.3 : 0.05;

        // Point light
        refs.glowLight.intensity = isActive ? 0.9 + Math.sin(frame * 0.1) * 0.3 : hasSpoken ? 0.3 : 0.1;

        // ── Thinking bubble ──
        if (isActive) {
          refs.thinkSprite.visible = true;
          // Swap texture to animate dots
          const oldMap = (refs.thinkSprite.material as THREE.SpriteMaterial).map;
          if (oldMap) oldMap.dispose();
          (refs.thinkSprite.material as THREE.SpriteMaterial).map = thinkTexCache[thinkDots - 1];
          (refs.thinkSprite.material as THREE.SpriteMaterial).needsUpdate = true;
          // Float gently
          refs.thinkSprite.position.y = 3.7 + Math.sin(frame * 0.08) * 0.1;
        } else {
          refs.thinkSprite.visible = false;
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}