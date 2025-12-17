import * as THREE from 'three';

// --- Constants ---
const LANE_WIDTH = 14;
const SPAWN_Z = -100;
const PLAYER_Z = 0;
const WORLD_SPEED = 8;
const BULLET_RANGE = 45;

// Theme Colors
const COLORS = {
    sky: 0x87CEEB,
    water: 0x1E90FF,
    bridge: 0x888888,
    player: 0x0066ff,
    playerSkin: 0xffccaa,
    enemy: 0xff3333,
    boss: 0x8b0000,
    proj: 0x00ffff
};

// BALANCED WEAPONS
const WEAPONS = {
    DEFAULT: { id: 0, color: 0x00ffff, rate: 0.35, speed: 50, damage: 1.5 },
    SHOTGUN: { id: 1, color: 0xff0000, rate: 0.8, speed: 45, damage: 3.5 }, // Buffed Damage
    MACHINE: { id: 2, color: 0x00ff00, rate: 0.15, speed: 60, damage: 0.6 } // Nerfed Rate & Damage
};

const Mats = {
    solBlue: new THREE.MeshStandardMaterial({ color: 0x0055ff }),
    solSkin: new THREE.MeshStandardMaterial({ color: COLORS.playerSkin }),
    solAcc: new THREE.MeshStandardMaterial({ color: 0x222222 }),

    tankBody: new THREE.MeshStandardMaterial({ color: 0x0055dd }),
    tankTurret: new THREE.MeshStandardMaterial({ color: 0x0033aa }),
    tankTrack: new THREE.MeshStandardMaterial({ color: 0x222222 }),

    zombieShirt: new THREE.MeshStandardMaterial({ color: COLORS.enemy }),
    zombieSkin: new THREE.MeshStandardMaterial({ color: 0xffaaaa }),
    zombieBoss: new THREE.MeshStandardMaterial({ color: COLORS.boss }),

    bridge: new THREE.MeshStandardMaterial({ color: COLORS.bridge }),
    water: new THREE.MeshBasicMaterial({ color: COLORS.water, transparent: true, opacity: 0.8 }),

    gateUnit: new THREE.MeshStandardMaterial({ color: 0x0088ff, transparent: true, opacity: 0.8, emissive: 0x0044ff }),
    gateWeap: new THREE.MeshStandardMaterial({ color: 0xff0088, transparent: true, opacity: 0.8, emissive: 0xff0044 }),

    bulletDefault: new THREE.MeshBasicMaterial({ color: 0x00ffff }),
    bulletRed: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    bulletGreen: new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
    bulletTank: new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
    white: new THREE.MeshBasicMaterial({ color: 0xffffff })
};

const Geos = {
    sHead: new THREE.BoxGeometry(0.3, 0.3, 0.3),
    sHelmet: new THREE.SphereGeometry(0.25, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    sBody: new THREE.BoxGeometry(0.35, 0.45, 0.25),
    sGun: new THREE.BoxGeometry(0.1, 0.15, 0.4),
    sBack: new THREE.BoxGeometry(0.25, 0.3, 0.15),

    proj: new THREE.BoxGeometry(0.2, 0.2, 3),
    projBall: new THREE.SphereGeometry(0.3, 8, 8),
    box: new THREE.BoxGeometry(1, 1, 1),

    gatePanel: new THREE.BoxGeometry(4.5, 5, 0.3),

    zBody: new THREE.BoxGeometry(0.7, 1.2, 0.5),
    zHead: new THREE.BoxGeometry(0.5, 0.5, 0.5),
    zArm: new THREE.BoxGeometry(0.25, 0.8, 0.25),
    tBody: new THREE.BoxGeometry(2.2, 1.2, 3),
    tTurret: new THREE.BoxGeometry(1.4, 0.7, 1.8),
    tBarrel: new THREE.CylinderGeometry(0.25, 0.25, 3)
};

// --- State ---
let scene, camera, renderer;
let clock;
let isPlaying = false;
let score = 0;
let wave = 1;

let playerUnits = [];
let visualUnits = [];
let visualTanks = [];
let isTankMode = false;
let currentWeapon = WEAPONS.DEFAULT;

let zombies = [];
let shootableGates = [];
let projectiles = [];
let waterMesh;

let targetPlayerX = 0;
let currentGroupX = 0;
let shotTimer = 0;

// Wave Logic
let waveState = 'spawn';
let zombiesToSpawn = 0;
let spawnDelay = 0;

function init() {
    try {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(COLORS.sky);
        scene.fog = new THREE.Fog(COLORS.sky, 50, 110);

        camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
        camera.position.set(0, 20, 15);
        camera.lookAt(0, 0, -25);

        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(20, 50, 20);
        scene.add(sun);

        const platform = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 300), Mats.bridge);
        platform.position.set(0, -5, -50);
        scene.add(platform);

        const waterGeo = new THREE.PlaneGeometry(500, 500);
        waterMesh = new THREE.Mesh(waterGeo, Mats.water);
        waterMesh.rotation.x = -Math.PI / 2;
        waterMesh.position.y = -2;
        scene.add(waterMesh);

        for (let i = 0; i < 5; i++) {
            const t = createTankVisual();
            scene.add(t); t.visible = false;
            visualTanks.push(t);
        }

        window.addEventListener('resize', onWindowResize);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('touchmove', onTouchMove, { passive: false });

        const startBtn = document.getElementById('start-btn');
        if (startBtn) startBtn.addEventListener('click', startGame);

        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) restartBtn.addEventListener('click', startGame);

        clock = new THREE.Clock();
        animate();
    } catch (e) { console.error(e); }
}

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    if (isPlaying) {
        try {
            updateGame(dt);
        } catch (e) {
            console.error(e);
            isPlaying = false;
        }
    }
    renderer.render(scene, camera);
}

function updateGame(dt) {
    if (playerUnits.length === 0) return;

    currentGroupX = THREE.MathUtils.lerp(currentGroupX || 0, targetPlayerX, dt * 10);

    if (playerUnits.length >= 40 && !isTankMode) setTankMode(true);
    else if (playerUnits.length < 40 && isTankMode) setTankMode(false);

    updateFormation(dt);
    manageShooting(dt);
    const moveZ = WORLD_SPEED * dt;

    // --- PROJ ---
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if (!p || !p.mesh) { projectiles.splice(i, 1); continue; }

        p.mesh.position.z -= p.speed * dt;
        if (p.drift) p.mesh.position.x += p.drift * dt;

        const dist = Math.abs(p.mesh.position.z - (PLAYER_Z + 1.5));
        if (dist > BULLET_RANGE || p.mesh.position.z < SPAWN_Z - 20) {
            scene.remove(p.mesh); projectiles.splice(i, 1); continue;
        }

        let hit = false;

        // HIT GATES
        for (let k = shootableGates.length - 1; k >= 0; k--) {
            const g = shootableGates[k];
            if (!g || !g.mesh) continue;
            if (Math.abs(g.mesh.position.z - p.mesh.position.z) < 2.0) {
                if (Math.abs(g.mesh.position.x - p.mesh.position.x) < 2.2) {
                    hitGate(k, p.damage);
                    if (!p.penetrate) hit = true;
                    break;
                }
            }
        }

        if (!hit) {
            // HIT ZOMBIES
            for (let j = zombies.length - 1; j >= 0; j--) {
                const z = zombies[j];
                if (!z || !z.mesh) continue;
                const zW = z.isBoss ? 2.5 : 1.2;
                const zD = z.isBoss ? 2.5 : 1.5;
                if (Math.abs(z.mesh.position.z - p.mesh.position.z) < zD) {
                    if (Math.abs(z.mesh.position.x - p.mesh.position.x) < zW) {
                        z.hp -= p.damage;
                        if (z.hp <= 0) killZombie(j);
                        else flashEntity(z.mesh);
                        if (!p.penetrate) hit = true;
                        break;
                    }
                }
            }
        }

        if (hit) { scene.remove(p.mesh); projectiles.splice(i, 1); }
    }

    // --- ZOMBIES ---
    for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i];
        if (!z || !z.mesh) { zombies.splice(i, 1); continue; }
        z.mesh.position.z += moveZ;
        z.mesh.lookAt(currentGroupX, 0, 100);
        if (z.mesh.position.z > PLAYER_Z - (z.isBoss ? 3 : 1.5)) {
            let damage = false;
            if (Math.abs(z.mesh.position.x - currentGroupX) < (isTankMode ? 3.5 : 2.0)) {
                removeUnits(z.isBoss ? 10 : 2); damage = true;
            }
            if (damage || z.mesh.position.z > PLAYER_Z + 5) killZombie(i);
        }
    }

    // --- SHOOTABLE GATES ---
    for (let i = shootableGates.length - 1; i >= 0; i--) {
        const g = shootableGates[i];
        if (!g || !g.mesh) { shootableGates.splice(i, 1); continue; }
        g.mesh.position.z += moveZ;

        if (g.mesh.position.z > PLAYER_Z - 1.5 && g.mesh.position.z < PLAYER_Z + 1.5) {
            if (Math.abs(g.mesh.position.x - currentGroupX) < 2.5) {
                // Determine crash
                removeUnits(1);
                scene.remove(g.mesh); shootableGates.splice(i, 1);
            }
        }
        if (g.mesh.position.z > 20) { scene.remove(g.mesh); shootableGates.splice(i, 1); }
    }

    processWaveLogic(dt);
}

function processWaveLogic(dt) {
    if (waveState === 'spawn') {
        spawnDelay -= dt;
        if (spawnDelay <= 0) {
            if (zombiesToSpawn > 0) {
                const x = (Math.random() * 8) - 4;
                if (zombiesToSpawn === 1 && wave % 5 === 0) {
                    // BUFFED BOSS: 30 + 8*wave
                    createZombie(x, SPAWN_Z, 30 + wave * 8, true);
                } else {
                    // BUFFED ZOMBIE: 3 + wave*0.5
                    createZombie(x, SPAWN_Z, 3 + Math.floor(wave * 0.5), false);
                }
                zombiesToSpawn--;
                spawnDelay = 0.5 - (wave * 0.02);
                if (spawnDelay < 0.1) spawnDelay = 0.1;

                if (Math.random() < 0.2) spawnShootableGate();
            } else {
                waveState = 'wait';
            }
        }
    } else {
        if (zombies.length === 0 && zombiesToSpawn <= 0) {
            startNextWave();
        }
    }
}

function startNextWave() {
    wave++;
    const waveNumEl = document.getElementById('wave-num');
    if (waveNumEl) waveNumEl.innerText = wave;

    waveState = 'spawn';
    zombiesToSpawn = Math.floor(5 * Math.pow(1.4, wave - 1));
    spawnDelay = 1.0;

    spawnShootableGate();
    if (wave > 3) spawnShootableGate();
}

function spawnShootableGate() {
    const isWep = Math.random() < 0.2;
    const x = (Math.random() > 0.5 ? 1 : -1) * 3.5;
    const g = new THREE.Group();
    g.position.set(x, 0, SPAWN_Z - (Math.random() * 20));

    const panel = new THREE.Mesh(Geos.gatePanel, isWep ? Mats.gateWeap : Mats.gateUnit);
    panel.position.y = 2.5; g.add(panel);

    if (isWep) {
        const box = new THREE.Mesh(Geos.box, Mats.white);
        box.position.set(0, 2.5, 0.5); box.rotation.z = Math.PI / 4; g.add(box);
    } else {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 0.5), Mats.white);
        bar.position.set(0, 2.5, 0.5); g.add(bar);
    }

    const gateData = {
        mesh: g,
        // BALANCED HP: 20 for Weapon (Was 25->12->20), 4 for Unit (Was 8->3->4)
        hp: isWep ? 20 : 4,
        maxHp: isWep ? 20 : 4,
        isWeapon: isWep,
        weaponType: Math.random() > 0.5 ? WEAPONS.SHOTGUN : WEAPONS.MACHINE,
        value: Math.random() < 0.2 ? 5 : 2 // Mostly +2, rarely +5
    };

    scene.add(g);
    shootableGates.push(gateData);
}

function hitGate(idx, dmg) {
    const g = shootableGates[idx];
    g.hp -= dmg;
    flashEntity(g.mesh);
    if (g.hp <= 0) {
        collectGate(g);
        scene.remove(g.mesh);
        shootableGates.splice(idx, 1);
    }
}

function collectGate(g) {
    if (g.isWeapon) setWeapon(g.weaponType);
    else {
        const val = g.value;
        for (let i = 0; i < val; i++) playerUnits.push(1);
        updateScore();
        if (!isTankMode) updateVisualSwarm();
    }
}

function manageShooting(dt) {
    shotTimer += dt;
    const rate = isTankMode ? 0.2 : currentWeapon.rate;
    if (playerUnits.length > 0 && shotTimer > rate) {
        shotTimer = 0;
        if (isTankMode) {
            for (let t of visualTanks) if (t.visible) spawnProjectile(t.position.x, PLAYER_Z - 2, 60, 3, 0, true);
        } else {
            const count = Math.max(1, Math.ceil(playerUnits.length * 0.6));
            for (let i = 0; i < count; i++) {
                const idx = Math.floor(Math.random() * visualUnits.length);
                const u = visualUnits[idx];
                if (u && u.visible) {
                    let drift = 0;
                    if (currentWeapon.id === 1) drift = (Math.random() - 0.5);
                    spawnProjectile(u.position.x, u.position.z, currentWeapon.speed, currentWeapon.damage, drift, false);
                }
            }
        }
    }
}

function spawnProjectile(x, z, s, d, drift, big) {
    let mat = big ? Mats.bulletTank : Mats.bulletDefault;
    if (!big && currentWeapon.id === 1) mat = Mats.bulletRed;
    if (!big && currentWeapon.id === 2) mat = Mats.bulletGreen;
    const m = new THREE.Mesh(big ? Geos.projBall : Geos.proj, mat);
    m.position.set(x, 1.5, z);
    scene.add(m);
    projectiles.push({ mesh: m, speed: s, damage: d, drift: drift, penetrate: big });
}

function createZombie(x, z, hp, isBoss) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    if (isBoss) g.scale.set(3, 3, 3);
    const shirtMat = isBoss ? Mats.zombieBoss : Mats.zombieShirt;
    const b = new THREE.Mesh(Geos.zBody, shirtMat); b.position.y = 1; g.add(b);
    const h = new THREE.Mesh(Geos.zHead, Mats.zombieSkin); h.position.y = 1.85; g.add(h);
    const lA = new THREE.Mesh(Geos.zArm, Mats.zombieSkin); lA.position.set(-0.5, 1.2, 0.4); lA.rotation.x = -1.5; g.add(lA);
    const rA = new THREE.Mesh(Geos.zArm, Mats.zombieSkin); rA.position.set(0.5, 1.2, 0.4); rA.rotation.x = -1.5; g.add(rA);
    scene.add(g);
    zombies.push({ mesh: g, hp: hp, isBoss: isBoss });
}

function createSoldierVisual() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(Geos.sBody, Mats.solBlue); body.position.y = 0.5; g.add(body);
    const head = new THREE.Mesh(Geos.sHead, Mats.solSkin); head.position.y = 0.85; g.add(head);
    const helm = new THREE.Mesh(Geos.sHelmet, Mats.solBlue); helm.position.y = 0.95; helm.rotation.x = -0.2; g.add(helm);
    const pack = new THREE.Mesh(Geos.sBack, Mats.solAcc); pack.position.set(0, 0.5, -0.2); g.add(pack);
    const gun = new THREE.Mesh(Geos.sGun, Mats.solAcc); gun.position.set(0.2, 0.4, 0.25); g.add(gun);
    return g;
}

function createTankVisual() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(Geos.tBody, Mats.tankBody); b.position.set(0, 0.75, 0); g.add(b);
    const t = new THREE.Mesh(Geos.tTurret, Mats.tankTurret); t.position.set(0, 1.5, 0); g.add(t);
    const ba = new THREE.Mesh(Geos.tBarrel, new THREE.MeshStandardMaterial({ color: 0x444444 })); ba.rotation.x = Math.PI / 2; ba.position.set(0, 0, -1.5); t.add(ba);
    const tr1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 3), Mats.tankTrack); tr1.position.set(-1.4, 0.4, 0); g.add(tr1);
    const tr2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 3), Mats.tankTrack); tr2.position.set(1.4, 0.4, 0); g.add(tr2);
    return g;
}

function flashEntity(mesh) {
    if (mesh.children[0]) {
        if (!mesh.userData.origMat) mesh.userData.origMat = mesh.children[0].material;
        mesh.children[0].material = Mats.white;
        setTimeout(() => { if (mesh && mesh.children[0]) mesh.children[0].material = mesh.userData.origMat || Mats.zombieShirt; }, 50);
    }
}

function updateScore() { document.getElementById('score-val').innerText = playerUnits.length; }
function setTankMode(active) { isTankMode = active; updateVisualSwarm(); }
function setWeapon(t) { currentWeapon = t; }
function removeUnits(n) {
    playerUnits.splice(0, n);
    if (playerUnits.length <= 0) { playerUnits = []; endGame(); }
    updateScore();
    if (!isTankMode) updateVisualSwarm();
}
function killZombie(i) {
    scene.remove(zombies[i].mesh);
    const z = zombies[i];
    zombies.splice(i, 1);
    score += z.isBoss ? 500 : 50;
    document.getElementById('score-total').innerText = score;
}

function updateVisualSwarm() {
    while (visualUnits.length < playerUnits.length) {
        const m = createSoldierVisual();
        const idx = visualUnits.length;
        const r = 0.4 + Math.sqrt(idx) * 0.3;
        const a = idx * 2.4;
        m.userData = { offsetX: Math.cos(a) * r, offsetZ: Math.sin(a) * r };
        scene.add(m);
        visualUnits.push(m);
    }
    for (let i = 0; i < visualUnits.length; i++) visualUnits[i].visible = (i < playerUnits.length) && !isTankMode;
}
function updateFormation(dt) {
    if (isTankMode) {
        const numTanks = Math.max(1, Math.min(5, Math.floor(playerUnits.length / 40)));
        for (let i = 0; i < visualTanks.length; i++) {
            if (i < numTanks) {
                visualTanks[i].visible = true;
                const offset = (i - (numTanks - 1) / 2) * 3.5;
                visualTanks[i].position.x = currentGroupX + offset;
                visualTanks[i].position.z = PLAYER_Z;
                if (visualTanks[i].children[1]) visualTanks[i].children[1].rotation.y += dt;
            } else visualTanks[i].visible = false;
        }
    } else {
        const t = clock.elapsedTime;
        for (let i = 0; i < visualTanks.length; i++) visualTanks[i].visible = false;
        for (let i = 0; i < visualUnits.length; i++) {
            const m = visualUnits[i];
            if (!m || !m.visible) continue;
            const d = m.userData;
            m.position.x += ((currentGroupX + d.offsetX) - m.position.x) * 10 * dt;
            m.position.z += ((PLAYER_Z + d.offsetZ) - m.position.z) * 10 * dt;
            m.position.y = 0.5 + Math.abs(Math.sin(t * 15 + i * 0.5)) * 0.15;
            m.rotation.x = -0.2;
        }
    }
}

function startGame() {
    console.log("Starting game...");
    isPlaying = true;
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');

    // Clear old Scene Objects
    zombies.forEach(z => scene.remove(z.mesh));
    shootableGates.forEach(c => scene.remove(c.mesh));
    projectiles.forEach(p => scene.remove(p.mesh));
    visualUnits.forEach(u => scene.remove(u));

    zombies = []; shootableGates = []; projectiles = []; playerUnits = [1]; visualUnits = [];
    score = 0; wave = 1; shotTimer = 0; currentWeapon = WEAPONS.DEFAULT; isTankMode = false;

    waveState = 'spawn';
    zombiesToSpawn = 5;
    spawnDelay = 0;
    document.getElementById('wave-num').innerText = 1;
    document.getElementById('score-val').innerText = 1;

    spawnShootableGate();
    createZombie(0, SPAWN_Z + 10, 2, false);

    updateVisualSwarm();
}
function endGame() { isPlaying = false; document.getElementById('game-over-screen').classList.remove('hidden'); document.getElementById('final-wave').innerText = wave; }
function onMouseMove(e) { targetPlayerX = ((e.clientX / window.innerWidth) * 2 - 1) * (LANE_WIDTH / 2); }
function onTouchMove(e) {
    if (e.cancelable) e.preventDefault();
    if (e.touches.length > 0) targetPlayerX = ((e.touches[0].clientX / window.innerWidth) * 2 - 1) * (LANE_WIDTH / 2);
}
function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }

init();
