// Cinematic 3D dental hero — Three.js (loaded via import map).
// Scroll-driven camera, mouse/touch parallax, adaptive quality for mobile networks/devices.
const root = document.documentElement;
const canvas = document.getElementById('stage');

function fail() {
  root.classList.add('no-webgl');
  if (canvas) canvas.style.display = 'none';
}

(async () => {
  if (!canvas) return;
  let THREE, RoomEnvironment;
  try {
    THREE = await import('three');
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  } catch (e) {
    return fail();
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 700;
  const weak =
    (navigator.deviceMemory && navigator.deviceMemory <= 3) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    small;
  let pixelCap = weak ? 1.25 : 1.75;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !weak,
      powerPreference: 'high-performance',
    });
  } catch (e) {
    return fail();
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelCap));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x082f49, 0.045);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 7);

  // ---------- Lights ----------
  scene.add(new THREE.AmbientLight(0x9fdcf0, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rimCyan = new THREE.PointLight(0x18bfe3, 60, 18, 2);
  rimCyan.position.set(-4, 1.5, -2);
  scene.add(rimCyan);
  const rimTeal = new THREE.PointLight(0x078b8b, 50, 18, 2);
  rimTeal.position.set(4, -2, 1);
  scene.add(rimTeal);

  // ---------- Tooth ----------
  const seg = weak ? [40, 28] : [72, 52];
  const crownGeo = new THREE.SphereGeometry(1, seg[0], seg[1]);
  const p = crownGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let { x, y, z } = v;
    const taper = 1 - 0.28 * Math.max(0, -y) ** 1.4; // narrower toward the roots
    x *= 1.32 * taper;
    z *= 1.12 * taper;
    y *= 0.95;
    if (y > 0) {
      const cusp = 0.16 * (Math.cos(2.5 * x) + Math.cos(2.9 * z)) * 0.5 * Math.min(1, y * 1.6);
      const fissure = -0.14 * Math.exp(-(x * x * 7)) * Math.min(1, y * 2) - 0.1 * Math.exp(-(z * z * 9)) * Math.min(1, y * 2);
      y += cusp + fissure;
    }
    p.setXYZ(i, x, y, z);
  }
  crownGeo.computeVertexNormals();

  const enamel = new THREE.MeshPhysicalMaterial({
    color: 0xf4fcff,
    roughness: 0.14,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    sheen: 0.6,
    sheenColor: new THREE.Color(0x4dd6f2),
    envMapIntensity: 1.35,
  });
  const tooth = new THREE.Group();
  tooth.add(new THREE.Mesh(crownGeo, enamel));
  const rootGeo = new THREE.CylinderGeometry(0.4, 0.07, 1.8, weak ? 20 : 36, 8, false);
  const rootMat = enamel.clone();
  rootMat.color = new THREE.Color(0xeaf6f8);
  [[-0.5, 0.18], [0.5, -0.18]].forEach(([x, tilt]) => {
    const r = new THREE.Mesh(rootGeo, rootMat);
    r.position.set(x, -1.45, 0);
    r.rotation.z = tilt;
    tooth.add(r);
  });
  tooth.scale.setScalar(0.001);
  const stage = new THREE.Group();
  stage.add(tooth);
  scene.add(stage);

  // ---------- Orbit rings with comets ----------
  const rings = [];
  const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  [[2.6, 0x4dd6f2, 0.55, [1.2, 0.2, 0]], [3.2, 0x18bfe3, 0.35, [0.5, -0.6, 0.4]], [3.9, 0x078b8b, 0.45, [1.9, 0.5, -0.3]]].forEach(([r, c, o, rot], i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, weak ? 120 : 220), ringMat(c, o)));
    const comet = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), ringMat(c, 0.35));
    comet.add(halo);
    g.add(comet);
    g.rotation.set(...rot);
    g.userData = { comet, r, speed: 0.5 + i * 0.22, ph: i * 2 };
    stage.add(g);
    rings.push(g);
  });

  // ---------- Floating dental mirror ----------
  const mirror = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xdfe9ee, metalness: 1, roughness: 0.18, envMapIntensity: 1.5 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 16, 48), steel);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.4, 40), new THREE.MeshStandardMaterial({ color: 0x9fe8f7, metalness: 1, roughness: 0.04, envMapIntensity: 2 }));
  glass.position.z = 0.01;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.7, 16), steel);
  handle.position.y = -1.25;
  mirror.add(rim, glass, handle);
  mirror.position.set(-3.1, 1.3, -0.6);
  mirror.rotation.set(0.3, 0.5, 0.7);
  stage.add(mirror);

  // ---------- Medical crosses + enamel pearls ----------
  const crossMat = new THREE.MeshStandardMaterial({ color: 0x18bfe3, emissive: 0x0a7f99, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.2 });
  const floaters = [];
  const addCross = (x, y, z, s) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.14), crossMat));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), crossMat));
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    g.userData = { ph: Math.random() * 6, a: 0.15 + Math.random() * 0.2, base: new THREE.Vector3(x, y, z) };
    stage.add(g);
    floaters.push(g);
  };
  addCross(2.9, 2, -1, 0.7); addCross(-2.4, -2, 0.4, 0.55); addCross(3.6, -1.4, -2, 0.9); addCross(-4, 0.2, -2.5, 0.8);
  const pearlCount = weak ? 14 : 30;
  const pearls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 20, 20), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1, envMapIntensity: 1.4 }), pearlCount);
  const pearlData = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < pearlCount; i++) {
    pearlData.push({ a: Math.random() * 6.28, r: 2 + Math.random() * 3, y: (Math.random() - 0.5) * 4, s: 0.5 + Math.random() * 1.4, sp: 0.1 + Math.random() * 0.3 });
  }
  stage.add(pearls);

  // ---------- Particles ----------
  const PCOUNT = weak ? 240 : 700;
  const pg = new THREE.BufferGeometry();
  const pos = new Float32Array(PCOUNT * 3);
  for (let i = 0; i < PCOUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 22;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2;
  }
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(120,225,250,.8)');
    g.addColorStop(1, 'rgba(24,191,227,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.12, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  scene.add(points);

  // ---------- State ----------
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  let progress = 0;
  let ready = false; // frame() depends on state declared below
  const onScroll = () => {
    progress = Math.min(1, Math.max(0, scrollY / (innerHeight * 1.5)));
    canvas.style.opacity = String(Math.max(0, 1 - Math.pow(progress, 1.4)));
    if (reduced && ready) frame(performance.now());
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const layout = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', layout);

  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const cyanC = new THREE.Color(0x18bfe3), tealC = new THREE.Color(0x078b8b), skyC = new THREE.Color(0x4dd6f2);
  const clock = new THREE.Clock();
  const fogA = new THREE.Color(0x082f49), fogB = new THREE.Color(0x04202f);
  let intro = 0, frames = 0, fpsAcc = 0, running = true, vis = true;
  ready = true;

  function frame(now) {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const sp = ease(progress);
    const mobile = innerWidth < 760;

    intro = Math.min(1, intro + dt * 0.8);
    const e = 1 - Math.pow(1 - intro, 3);
    const bounce = e + Math.sin(intro * Math.PI) * 0.06;
    const baseScale = mobile ? 0.62 : 0.95;
    tooth.scale.setScalar(Math.max(0.001, bounce * baseScale * mix(1, 1.35, sp)));

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    // stage placement: right side on desktop, lower centre on mobile; drifts with scroll
    const homeX = mobile ? 0.55 : 2.15;
    const homeY = mobile ? -1.5 : 0.1;
    stage.position.x = mix(homeX, mobile ? 0 : -1.2, sp) + mouse.x * 0.35;
    stage.position.y = mix(homeY, mobile ? -2.2 : 0.6, sp) - mouse.y * 0.25 + Math.sin(t * 0.9) * 0.12;
    tooth.rotation.y = t * 0.35 + sp * Math.PI * 2 + mouse.x * 0.6;
    tooth.rotation.x = -0.12 + mouse.y * 0.25 + sp * 0.5;
    tooth.rotation.z = Math.sin(t * 0.5) * 0.05;

    // camera journey
    camera.position.set(mix(0, -1.6, sp) + mouse.x * 0.2, mix(0, 1.1, sp), mix(7.2, 4.6, sp));
    camera.lookAt(mix(0, 0.4, sp), mix(0, -0.2, sp), 0);

    // rings expand + colour-shift with scroll
    rings.forEach((g, i) => {
      const d = g.userData;
      g.rotation.z += dt * (0.18 + i * 0.07);
      g.rotation.x += dt * 0.05;
      g.scale.setScalar(mix(1, 1.5 + i * 0.12, sp));
      const a = t * d.speed + d.ph;
      d.comet.position.set(Math.cos(a) * d.r, Math.sin(a) * d.r, 0);
    });
    mirror.rotation.y = 0.5 + Math.sin(t * 0.6) * 0.4;
    mirror.rotation.z = 0.7 + Math.sin(t * 0.4) * 0.15;
    mirror.position.y = 1.3 + Math.sin(t * 0.8) * 0.2 + sp * 1.2;
    floaters.forEach((g) => {
      const d = g.userData;
      g.rotation.y = t * 0.6 + d.ph;
      g.rotation.x = Math.sin(t * 0.5 + d.ph) * 0.5;
      g.position.y = d.base.y + Math.sin(t * 0.7 + d.ph) * d.a * 2 + sp * 1.5;
    });
    for (let i = 0; i < pearlCount; i++) {
      const d = pearlData[i];
      const a = d.a + t * d.sp;
      dummy.position.set(Math.cos(a) * d.r, d.y + Math.sin(t * d.s + i) * 0.3, Math.sin(a) * d.r * 0.6);
      dummy.scale.setScalar(0.6 + Math.sin(t * 1.3 + i) * 0.25);
      dummy.updateMatrix();
      pearls.setMatrixAt(i, dummy.matrix);
    }
    pearls.instanceMatrix.needsUpdate = true;
    points.rotation.y = t * 0.02 + sp * 0.8;
    points.position.y = sp * 2.5;

    // light shift cyan → teal across the scroll, light follows pointer
    rimCyan.color.copy(cyanC).lerp(tealC, sp);
    rimTeal.color.copy(tealC).lerp(skyC, sp);
    key.position.set(3 + mouse.x * 3, 4 - mouse.y * 2, 5);
    scene.fog.color.copy(fogA).lerp(fogB, sp);

    renderer.render(scene, camera);

    // adaptive quality: drop resolution if the device struggles
    if (frames < 120) {
      fpsAcc += dt;
      frames++;
      if (frames === 120 && fpsAcc / 120 > 1 / 38 && pixelCap > 1) {
        pixelCap = 1;
        renderer.setPixelRatio(1);
        pg.setDrawRange(0, Math.floor(PCOUNT * 0.5));
      }
    }
  }

  const loop = (now) => {
    if (!running) return;
    requestAnimationFrame(loop);
    if (!vis || progress >= 1) return; // nothing visible → no GPU work
    if (document.body.dataset.single && !document.body.classList.contains('is-home')) return;
    frame(now);
  };
  document.addEventListener('visibilitychange', () => { vis = !document.hidden; });
  root.classList.add('webgl-ready');
  if (reduced) {
    intro = 1;
    frame(0);
  } else {
    requestAnimationFrame(loop);
  }
})().catch(fail);
