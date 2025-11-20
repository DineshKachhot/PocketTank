
// --- Constants ---
const CONSTANTS = {
  GRAVITY: 0.4,
  CANVAS_WIDTH: window.innerWidth,
  CANVAS_HEIGHT: window.innerHeight,
  TERRAIN_POINTS: window.innerWidth, // 1 point per pixel width for simplicity
  EXPLOSION_RADIUS: 70,
  TANK_WIDTH: 30,
  TANK_HEIGHT: 15,
  TURRET_LENGTH: 20,
  MAX_FUEL: 200,
  MOVE_SPEED: 2,
  PROJECTILE_SIZE: 4,
  MAX_POWER: 100,
};

const WEAPONS = [
  { id: 'standard', name: 'Standard Shell', damage: 30, radius: 40, color: '#fff' },
  { id: 'big_shot', name: 'Big Shot', damage: 40, radius: 80, color: '#ffaa00', heavy: true },
  { id: 'sniper', name: 'Sniper', damage: 50, radius: 20, color: '#ff0000', fast: true },
  { id: 'dirt_mover', name: 'Dirt Mover', damage: 10, radius: 120, color: '#8B4513', terrainOnly: true },
  { id: 'nuke', name: 'Nuke', damage: 60, radius: 150, color: '#00ff00' },
  { id: 'heal', name: 'Repair Kit', damage: -30, radius: 40, color: '#00ffff' },
  { id: 'cluster', name: 'Cluster Bomb', damage: 10, radius: 30, color: '#ff00ff', cluster: true },
  { id: 'bouncer', name: 'Leap Frog', damage: 35, radius: 40, color: '#88ff88', bounces: 1 },
  { id: 'digger', name: 'Digger', damage: 30, radius: 30, color: '#aaaaaa', digs: true },
  { id: 'volcano', name: 'Volcano', damage: 15, radius: 30, color: '#ff5500', volcano: true }
];

// --- State Management ---
const state = {
  turn: 0, // 0 = P1, 1 = P2
  phase: 'AIMING', // AIMING, MOVING, FIRING, GAMEOVER
  projectiles: [],
  particles: [],
  terrain: [], // Array of Y values
  wind: 0,
  winner: null,
  turnCount: 0,
  firstScorer: null,
  players: [
    {
      id: 0,
      name: "Player 1",
      color: "#ff4444",
      x: 100,
      y: 0,
      angle: 45,
      power: 50,
      health: 100,
      fuel: CONSTANTS.MAX_FUEL,
      width: CONSTANTS.TANK_WIDTH,
      height: CONSTANTS.TANK_HEIGHT,
      weaponIndex: 0,
      score: 0
    },
    {
      id: 1,
      name: "Player 2",
      color: "#4444ff",
      x: CONSTANTS.CANVAS_WIDTH - 100,
      y: 0,
      angle: 135,
      power: 50,
      health: 100,
      fuel: CONSTANTS.MAX_FUEL,
      width: CONSTANTS.TANK_WIDTH,
      height: CONSTANTS.TANK_HEIGHT,
      weaponIndex: 0,
      score: 0
    }
  ]
};

// --- Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const ui = {
  p1HealthBar: document.getElementById('p1-health-bar'),
  p1HealthText: document.getElementById('p1-health-text'),
  p2HealthBar: document.getElementById('p2-health-bar'),
  p2HealthText: document.getElementById('p2-health-text'),
  turnIndicator: document.getElementById('turn-indicator'),
  angleInput: document.getElementById('angle-input'),
  powerInput: document.getElementById('power-input'),
  weaponSelect: document.getElementById('weapon-select'),
  fuelDisplay: document.getElementById('fuel-display'),
  fireBtn: document.getElementById('fire-btn'),
  moveLeftBtn: document.getElementById('move-left'),
  moveRightBtn: document.getElementById('move-right'),
  gameOverModal: document.getElementById('game-over-modal'),
  winnerText: document.getElementById('winner-text'),
  restartBtn: document.getElementById('restart-btn'),

  // Adjust buttons
  anglePlus: document.getElementById('angle-plus'),
  angleMinus: document.getElementById('angle-minus'),
  powerPlus: document.getElementById('power-plus'),
  powerMinus: document.getElementById('power-minus'),
};

// --- Initialization ---
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  generateTerrain();
  resetPlayers();
  setupInput();
  initWeapons();

  requestAnimationFrame(loop);
}

function initWeapons() {
  ui.weaponSelect.innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.innerText = w.name;
    ui.weaponSelect.appendChild(opt);
  });

  ui.weaponSelect.addEventListener('change', (e) => {
    getCurrentPlayer().weaponIndex = parseInt(e.target.value);
  });
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  CONSTANTS.CANVAS_WIDTH = canvas.width;
  CONSTANTS.CANVAS_HEIGHT = canvas.height;
  CONSTANTS.TERRAIN_POINTS = canvas.width;

  // Regenerate terrain if resized significantly? 
  // For now, just regenerate to keep it simple, though it resets game state visually
  if (state.terrain.length === 0) generateTerrain();
}

function generateTerrain() {
  state.terrain = new Float32Array(CONSTANTS.TERRAIN_POINTS);

  // Midpoint displacement or perlin noise
  // Simple sine wave sum for smooth hills
  const baseY = CONSTANTS.CANVAS_HEIGHT * 0.5;

  let y = baseY;
  const period1 = 0.003;
  const period2 = 0.01;
  const amp1 = 100;
  const amp2 = 50;

  for (let i = 0; i < CONSTANTS.TERRAIN_POINTS; i++) {
    state.terrain[i] = baseY +
      Math.sin(i * period1) * amp1 +
      Math.sin(i * period2) * amp2 +
      (Math.random() * 5); // Noise
  }

  // Smooth it
  smoothTerrain();
}

function smoothTerrain() {
  // Simple box blur
  const temp = new Float32Array(state.terrain.length);
  const range = 2;
  for (let i = 0; i < state.terrain.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - range; j <= i + range; j++) {
      if (j >= 0 && j < state.terrain.length) {
        sum += state.terrain[j];
        count++;
      }
    }
    temp[i] = sum / count;
  }
  state.terrain = temp;
}

function resetPlayers() {
  state.turn = 0;
  state.phase = 'AIMING';
  state.winner = null;
  state.turnCount = 0;
  state.firstScorer = null;
  state.projectiles = [];
  state.particles = [];

  // P1
  state.players[0].x = 100;
  state.players[0].health = 100;
  state.players[0].fuel = CONSTANTS.MAX_FUEL;
  state.players[0].angle = 45;
  state.players[0].score = 0;

  // P2
  state.players[1].x = CONSTANTS.CANVAS_WIDTH - 100;
  state.players[1].health = 100;
  state.players[1].fuel = CONSTANTS.MAX_FUEL;
  state.players[1].angle = 135;
  state.players[1].score = 0;

  updatePlayerY(state.players[0]);
  updatePlayerY(state.players[1]);

  updateUI();
}

function updatePlayerY(player) {
  // Find ground height at player x
  const x = Math.floor(Math.max(0, Math.min(CONSTANTS.CANVAS_WIDTH - 1, player.x)));
  player.y = state.terrain[x];
}

function setupInput() {
  // Values
  ui.angleInput.addEventListener('input', (e) => {
    getCurrentPlayer().angle = parseInt(e.target.value);
  });
  ui.powerInput.addEventListener('input', (e) => {
    getCurrentPlayer().power = parseInt(e.target.value);
  });

  // Buttons
  let adjustInterval;
  const adjust = (prop, val) => {
    const p = getCurrentPlayer();
    p[prop] = Math.max(0, Math.min(prop === 'angle' ? 180 : 100, p[prop] + val));
    updateUI();
  };

  const startAdjust = (prop, val) => {
    if (adjustInterval) clearInterval(adjustInterval);
    adjust(prop, val);
    adjustInterval = setInterval(() => adjust(prop, val), 50);
  };

  const stopAdjust = () => {
    if (adjustInterval) clearInterval(adjustInterval);
  };

  ui.angleMinus.addEventListener('mousedown', () => startAdjust('angle', -1));
  ui.angleMinus.addEventListener('mouseup', stopAdjust);
  ui.angleMinus.addEventListener('mouseleave', stopAdjust);

  ui.anglePlus.addEventListener('mousedown', () => startAdjust('angle', 1));
  ui.anglePlus.addEventListener('mouseup', stopAdjust);
  ui.anglePlus.addEventListener('mouseleave', stopAdjust);

  ui.powerMinus.addEventListener('mousedown', () => startAdjust('power', -1));
  ui.powerMinus.addEventListener('mouseup', stopAdjust);
  ui.powerMinus.addEventListener('mouseleave', stopAdjust);

  ui.powerPlus.addEventListener('mousedown', () => startAdjust('power', 1));
  ui.powerPlus.addEventListener('mouseup', stopAdjust);
  ui.powerPlus.addEventListener('mouseleave', stopAdjust);

  // Move
  let moveInterval;
  const startMove = (dir) => {
    if (state.phase !== 'AIMING') return;
    if (moveInterval) clearInterval(moveInterval);
    moveInterval = setInterval(() => movePlayer(dir), 16);
  };
  const stopMove = () => {
    if (moveInterval) clearInterval(moveInterval);
  };

  ui.moveLeftBtn.addEventListener('mousedown', () => startMove(-1));
  ui.moveLeftBtn.addEventListener('mouseup', stopMove);
  ui.moveLeftBtn.addEventListener('mouseleave', stopMove);

  ui.moveRightBtn.addEventListener('mousedown', () => startMove(1));
  ui.moveRightBtn.addEventListener('mouseup', stopMove);
  ui.moveRightBtn.addEventListener('mouseleave', stopMove);

  // Fire
  ui.fireBtn.addEventListener('click', fireProjectile);

  // Restart
  ui.restartBtn.addEventListener('click', () => {
    ui.gameOverModal.classList.add('hidden');
    generateTerrain();
    resetPlayers();
  });

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (state.phase !== 'AIMING') return;
    switch (e.key) {
      case 'ArrowLeft': movePlayer(-1); break;
      case 'ArrowRight': movePlayer(1); break;
      case 'Enter': fireProjectile(); break;
    }
  });
}

function getCurrentPlayer() {
  return state.players[state.turn];
}

function movePlayer(dir) {
  const p = getCurrentPlayer();
  if (p.fuel <= 0) return;

  const nextX = p.x + (dir * CONSTANTS.MOVE_SPEED);

  // Bounds check
  if (nextX < 10 || nextX > CONSTANTS.CANVAS_WIDTH - 10) return;

  // Slope check (optional, simple for now)
  // just set X and update Y
  p.x = nextX;
  updatePlayerY(p);
  p.fuel -= 1;

  updateUI();
}

function fireProjectile() {
  if (state.phase !== 'AIMING') return;

  const p = getCurrentPlayer();
  state.phase = 'FIRING';
  ui.fireBtn.disabled = true;

  // Calculate vector
  const rad = (p.angle * Math.PI) / 180;
  const power = p.power * 0.3; // Scale down

  const vx = Math.cos(rad) * power * (p.angle > 90 || p.angle < 270 ? -1 : 1);
  // Wait, angle 0 is Right. 90 Down? 
  // Standard math: 0 is Right (East), 90 is Down (South) in canvas (+y is down).
  // We want 0 to be Right, 180 Left. 
  // But Up is -Y.
  // So Angle 45 means Up-Right.
  // cos(45) = +x, sin(45) = +y (Down). We want -y (Up).

  // Let's standardise: 0 = Right Horizontal. 90 = Up Vertical. 180 = Left.
  // Input is 0-180.
  // 0 -> vx+, vy0
  // 90 -> vx0, vy-
  // 180 -> vx-, vy0
  // 45 -> vx+, vy-

  const rads = (p.angle * Math.PI) / 180;
  const pvx = Math.cos(rads) * power; // if angle 135, cos is negative. Correct.
  const pvy = -Math.sin(rads) * power; // negative sin for Up

  // Start at turret tip
  const startX = p.x + Math.cos(rads) * CONSTANTS.TURRET_LENGTH;
  const startY = (p.y - CONSTANTS.TANK_HEIGHT) - Math.sin(rads) * CONSTANTS.TURRET_LENGTH;

  const weapon = WEAPONS[p.weaponIndex];

  // Cluster / Volcano logic could fire multiple, but for now 1 main projectile
  state.projectiles.push({
    x: startX,
    y: startY,
    vx: pvx,
    vy: pvy,
    active: true,
    weapon: weapon,
    // Special state
    bounces: weapon.bounces || 0,
    digging: false
  });
}

// --- Logic Loop ---
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function update() {
  // Projectiles
  state.projectiles.forEach(p => {
    if (!p.active) return;

    // Physics
    let gravity = CONSTANTS.GRAVITY;
    if (p.weapon.heavy) gravity *= 1.5;
    if (p.weapon.fast) gravity *= 0.5; // Sniper flies straighter

    if (!p.digging) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
    } else {
      // Digger logic: move straight down
      p.y += 3;
      p.digDepth = (p.digDepth || 0) + 3;
      if (p.digDepth > 100) { // Dig limit
        explode(p, p.x, p.y);
        p.active = false;
        return;
      }
    }

    // Bounds
    if (p.x < 0 || p.x > CONSTANTS.CANVAS_WIDTH || p.y > CONSTANTS.CANVAS_HEIGHT) {
      p.active = false;
      nextTurn();
      return;
    }

    // Terrain Collision
    const floorY = getTerrainHeight(p.x);

    if (p.y >= floorY) {
      if (p.weapon.digs && !p.digging) {
        // Start digging
        p.digging = true;
        p.vx = 0;
        p.vy = 0;
      } else if (p.weapon.bounces && p.bounces > 0) {
        // Bounce
        p.bounces--;
        p.vy = -p.vy * 0.6; // Lose energy
        p.vx = p.vx * 0.8;
        p.y = floorY - 2; // Lift out of dirt
      } else {
        // Explode
        explode(p, p.x, p.y);
        p.active = false;
        // Don't nextTurn immediately, wait for explosion
        return;
      }
    }

    // Player Collision (Direct Hit)
    if (!p.digging) {
      state.players.forEach(pl => {
        if (Math.abs(p.x - pl.x) < CONSTANTS.TANK_WIDTH / 2 && Math.abs(p.y - (pl.y - CONSTANTS.TANK_HEIGHT / 2)) < CONSTANTS.TANK_HEIGHT) {
          explode(p, p.x, p.y);
          p.active = false;
        }
      });
    }
  });

  // Cleanup projectiles
  state.projectiles = state.projectiles.filter(p => p.active);

  // Particles
  state.particles.forEach(p => {
    p.life -= (p.decay || 0.02); // Allow custom decay
    p.x += p.vx;
    p.y += p.vy;

    // Bounce off ground?
    if (p.bounce) {
      const fy = getTerrainHeight(p.x);
      if (p.y > fy) {
        p.y = fy;
        p.vy = -p.vy * 0.5;
        p.vx *= 0.8;
      }
    }

    if (!p.antiGravity && !p.bounce) p.vy += 0.1; // standard gravity
    if (p.bounce) p.vy += 0.2;
  });
  state.particles = state.particles.filter(p => p.life > 0);

  // Gravity for tanks (if ground destroyed beneath them)
  let tanksMoving = false;
  state.players.forEach(p => {
    const targetY = getTerrainHeight(p.x);
    if (p.y < targetY) {
      p.y += 2; // Fall speed
      tanksMoving = true;
    } else {
      p.y = targetY;
    }
  });

  // Turn Management
  if (state.phase === 'FIRING' && state.projectiles.length === 0 && !tanksMoving) {
    if (!state.turnEndTimer) {
      state.turnEndTimer = setTimeout(() => {
        nextTurn();
        state.turnEndTimer = null;
      }, 1000);
    }
  } else {
    if (state.turnEndTimer && (state.projectiles.length > 0 || tanksMoving)) {
      clearTimeout(state.turnEndTimer);
      state.turnEndTimer = null;
    }
  }

  // Winner Celebration
  if (state.winner) {
    for (let i = 0; i < 5; i++) {
      state.particles.push({
        x: Math.random() * CONSTANTS.CANVAS_WIDTH,
        y: Math.random() * CONSTANTS.CANVAS_HEIGHT,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 2.0 + Math.random(),
        decay: 0.01,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        antiGravity: true,
        size: Math.random() * 5 + 2
      });
    }
  }
}

function getTerrainHeight(x) {
  const idx = Math.floor(Math.max(0, Math.min(CONSTANTS.TERRAIN_POINTS - 1, x)));
  return state.terrain[idx];
}

function explode(projectile, x, y) {
  const weapon = projectile ? projectile.weapon : { radius: 60, damage: 20, color: '#fff' };

  // --- 1. Visual Effects ---
  let particleCount = 20;
  let particleSpeed = 10;
  let particleLife = 0.02; // decay rate

  if (weapon.id === 'nuke') {
    particleCount = 100;
    particleSpeed = 25;
    particleLife = 0.01;
    // Flash screen (simulated by huge particle?)
    state.particles.push({ x: x, y: y, vx: 0, vy: 0, life: 0.2, decay: 0.05, size: 500, color: 'rgba(255,255,255,0.8)' });
  } else if (weapon.id === 'sniper') {
    particleCount = 10;
    particleSpeed = 5;
  } else if (weapon.id === 'dirt_mover') {
    particleCount = 50;
    particleSpeed = 15;
  }

  for (let i = 0; i < particleCount; i++) {
    state.particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * particleSpeed,
      vy: (Math.random() - 0.5) * particleSpeed,
      life: 1.0,
      decay: particleLife + Math.random() * 0.01,
      color: weapon.color,
      antiGravity: weapon.id === 'heal',
      size: Math.random() * 4 + 2
    });
  }

  // Special: Cluster
  if (weapon.cluster) {
    for (let i = 0; i < 5; i++) {
      state.projectiles.push({
        x: x,
        y: y - 10,
        vx: (Math.random() - 0.5) * 15, // Wider spread
        vy: -(Math.random() * 10 + 5), // Higher pop
        active: true,
        weapon: { ...weapon, cluster: false, radius: 20, damage: 5, name: 'MiniBomb' },
        bounces: 0,
        digging: false
      });
    }
  }

  // Special: Volcano
  if (weapon.volcano) {
    for (let i = 0; i < 30; i++) {
      state.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 20, // Wide spread
        vy: -(Math.random() * 25 + 10), // Shoot UP high
        life: 3.0, // Long life
        decay: 0.01,
        color: i % 2 === 0 ? '#ff4400' : '#333', // Fire and ash
        bounce: true, // Particles bounce on ground
        size: Math.random() * 5 + 2
      });
    }
  }

  // --- 2. Terrain Destruction ---
  const r = weapon.radius;
  if (!weapon.terrainOnly && !weapon.heal) {
    const startX = Math.floor(Math.max(0, x - r));
    const endX = Math.floor(Math.min(CONSTANTS.TERRAIN_POINTS, x + r));

    for (let i = startX; i < endX; i++) {
      const dx = i - x;
      // Default circle crater
      let dy = Math.sqrt(Math.max(0, r * r - dx * dx));

      // Shape variations
      if (weapon.id === 'dirt_mover') {
        // Flatter, wider crater
        dy *= 1.2;
      }

      state.terrain[i] += dy;
    }
  } else if (weapon.id === 'dirt_mover') {
    // Massive dirt moving
    const startX = Math.floor(Math.max(0, x - r));
    const endX = Math.floor(Math.min(CONSTANTS.TERRAIN_POINTS, x + r));
    for (let i = startX; i < endX; i++) {
      const dx = i - x;
      const dy = Math.sqrt(Math.max(0, r * r - dx * dx));
      state.terrain[i] += dy * 1.5; // Deep hole

      // Pile up dirt on edges? (Complex, skip for now)
    }
  }

  // --- 3. Damage Calculation ---
  if (weapon.id !== 'dirt_mover') {
    state.players.forEach(p => {
      const dist = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));

      // Hitbox check
      if (dist < r + 20) {
        // Falloff
        let dmgFactor = (1 - dist / (r + 20));

        // Sniper: No falloff, full damage if hit
        if (weapon.id === 'sniper') dmgFactor = 1;

        const effect = Math.floor(dmgFactor * weapon.damage);
        if (effect !== 0) {
          p.health = Math.max(0, Math.min(100, p.health - effect));

          // Scoring Logic
          if (p !== getCurrentPlayer()) { // Only score for hitting enemy
            const points = effect;
            getCurrentPlayer().score += points;
            if (state.firstScorer === null && points > 0) {
              state.firstScorer = getCurrentPlayer().id;
            }
          }
        }
      }
    });
  }

  updateUI();
  checkWin();
}

function nextTurn() {
  if (state.phase === 'GAMEOVER') return;

  state.turnCount++;

  // Check for max turns (10 total, 5 each)
  if (state.turnCount >= 10) {
    endGameByScore();
    return;
  }

  state.turn = (state.turn + 1) % 2;
  state.phase = 'AIMING';
  ui.fireBtn.disabled = false;

  // Refill fuel?
  state.players[state.turn].fuel = CONSTANTS.MAX_FUEL;

  // Reset controls in UI to match player state
  ui.angleInput.value = getCurrentPlayer().angle;
  ui.powerInput.value = getCurrentPlayer().power;

  updateUI();
}

function checkWin() {
  let winner = null;
  if (state.players[0].health <= 0) winner = state.players[1];
  if (state.players[1].health <= 0) winner = state.players[0];

  if (winner) {
    state.phase = 'GAMEOVER';
    state.winner = winner;
    ui.winnerText.innerText = `${winner.name} Wins!`;
    ui.winnerText.style.color = winner.color;
    ui.gameOverModal.classList.remove('hidden');
  }
}

function endGameByScore() {
  const p1 = state.players[0];
  const p2 = state.players[1];
  let winner = null;

  if (p1.score > p2.score) {
    winner = p1;
  } else if (p2.score > p1.score) {
    winner = p2;
  } else {
    // Tie breaker: First scorer wins
    if (state.firstScorer !== null) {
      winner = state.players.find(p => p.id === state.firstScorer);
    } else {
      // 0-0 Draw or exact tie with no first scorer (impossible if scores > 0)
      // If 0-0, no winner? Or Draw?
      // Let's just say Draw for now, or P1.
      // User said "who ever score first". If no one scored, it's a draw.
    }
  }

  state.phase = 'GAMEOVER';
  state.winner = winner;

  if (winner) {
    ui.winnerText.innerText = `${winner.name} Wins! (Score)`;
    ui.winnerText.style.color = winner.color;
  } else {
    ui.winnerText.innerText = `It's a Draw!`;
    ui.winnerText.style.color = '#fff';
  }
  ui.gameOverModal.classList.remove('hidden');
}

// --- Rendering ---
function draw() {
  // Clear
  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Sky/Grid
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += 50) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
  }
  for (let i = 0; i < canvas.height; i += 50) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
  }

  // Terrain
  ctx.fillStyle = '#2a9d8f';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let i = 0; i < state.terrain.length; i++) {
    ctx.lineTo(i, state.terrain[i]);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.fill();

  // Terrain Line
  ctx.strokeStyle = '#264653';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tanks
  state.players.forEach(p => {
    if (p.health <= 0) return;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Turret
    ctx.save();
    ctx.translate(0, -p.height + 5); // Pivot point
    const angleRad = -(p.angle * Math.PI / 180); // - because canvas Y is flipped relative to unit circle
    // But wait, my input logic was: 0=Right, 90=Up.
    // Canvas rotation: + is CW. 0 is Right. -90 is Up.
    // So if input is 90, I want -90 rotation.
    ctx.rotate(-((p.angle) * Math.PI / 180));

    ctx.fillStyle = '#555';
    ctx.fillRect(0, -3, CONSTANTS.TURRET_LENGTH, 6);
    ctx.restore();

    // Body
    ctx.fillStyle = p.color;
    // Simple tank shape (Trapezoid)
    ctx.beginPath();
    ctx.moveTo(-p.width / 2, 0);
    ctx.lineTo(p.width / 2, 0);
    ctx.lineTo(p.width / 2 - 5, -p.height);
    ctx.lineTo(-p.width / 2 + 5, -p.height);
    ctx.closePath();
    ctx.fill();

    // Tracks
    ctx.fillStyle = '#111';
    ctx.fillRect(-p.width / 2, -4, p.width, 4);

    // Selection Ring
    if (p === getCurrentPlayer() && state.phase === 'AIMING') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -10, 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  });

  // Projectiles
  ctx.fillStyle = '#fff';
  state.projectiles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, CONSTANTS.PROJECTILE_SIZE, 0, Math.PI * 2);
    ctx.fill();
  });

  // Particles
  state.particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life); // Prevent negative alpha
    ctx.beginPath();
    // Size support
    const size = p.size || (2 + Math.random() * 2);
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function updateUI() {
  const p1 = state.players[0];
  const p2 = state.players[1];
  const current = getCurrentPlayer();

  ui.p1HealthBar.style.width = `${p1.health}%`;
  ui.p1HealthText.innerText = `${p1.health}% (Score: ${p1.score})`;
  ui.p2HealthBar.style.width = `${p2.health}%`;
  ui.p2HealthText.innerText = `${p2.health}% (Score: ${p2.score})`;

  ui.turnIndicator.innerText = `${current.name}'s Turn (Shot ${Math.floor(state.turnCount / 2) + 1}/5)`;
  ui.turnIndicator.style.color = current.color;
  ui.turnIndicator.style.borderColor = current.color;

  // Only update inputs if we aren't dragging them (simple check: focus)
  if (document.activeElement !== ui.angleInput) ui.angleInput.value = current.angle;
  if (document.activeElement !== ui.powerInput) ui.powerInput.value = current.power;
  if (document.activeElement !== ui.weaponSelect) ui.weaponSelect.value = current.weaponIndex;

  ui.fuelDisplay.innerText = Math.floor(current.fuel);
}

// Start
init();
