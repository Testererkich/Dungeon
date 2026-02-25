const TILE_SIZE = 36;
const GRID_WIDTH = 24;
const GRID_HEIGHT = 20;
const MAX_FLOOR = 20;
const BOSS_LEVELS = new Set([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);

const CLASSES = {
  Warrior: { hp: 50, atk: 8, def: 5, crit: 0.1 },
  Rogue: { hp: 38, atk: 11, def: 3, crit: 0.2 },
  Mage: { hp: 34, atk: 13, def: 2, crit: 0.18 },
};

const TIME_DIFFICULTIES = {
  Let: 16 * 60,
  Normal: 11 * 60,
  Svær: 8 * 60,
};

const WORLD_THEMES = [
  { name: "Ruins", floor: "#141b2e", wall: "#2a3558" },
  { name: "Forest Catacombs", floor: "#15221a", wall: "#2b4a35" },
  { name: "Ember Depths", floor: "#2a1a14", wall: "#5a3324" },
  { name: "Void Sanctum", floor: "#1d1531", wall: "#3d2e5a" },
];

const RELIC_GATES = [
  { afterFloor: 5, relic: "Forest Emblem", bossFloor: 4 },
  { afterFloor: 10, relic: "Molten Core", bossFloor: 8 },
  { afterFloor: 15, relic: "Eclipse Sigil", bossFloor: 12 },
];

const LOOT_TABLE = [
  { name: "Jagged Blade", rarity: "Common", slot: "weapon", atk: 2, def: 0, hp: 0, color: "#d95050" },
  { name: "Oak Staff", rarity: "Rare", slot: "weapon", atk: 4, def: 0, hp: 1, color: "#e39f4a" },
  { name: "Moon Dagger", rarity: "Epic", slot: "weapon", atk: 6, def: 1, hp: 0, color: "#f279df" },
  { name: "Scout Vest", rarity: "Common", slot: "armor", atk: 0, def: 2, hp: 2, color: "#59a8ff" },
  { name: "Bulwark Plate", rarity: "Rare", slot: "armor", atk: 0, def: 4, hp: 4, color: "#67d8ff" },
  { name: "Astral Mail", rarity: "Epic", slot: "armor", atk: 1, def: 5, hp: 6, color: "#91eaff" },
  { name: "Lucky Fang", rarity: "Common", slot: "trinket", atk: 1, def: 1, hp: 1, color: "#ffd86e" },
  { name: "Rune Charm", rarity: "Rare", slot: "trinket", atk: 2, def: 1, hp: 3, color: "#ffe88f" },
  { name: "Phoenix Crest", rarity: "Epic", slot: "trinket", atk: 3, def: 2, hp: 5, color: "#fff2b7" },
];

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const classSelect = document.getElementById("classSelect");
const difficultySelect = document.getElementById("difficultySelect");
const newGameBtn = document.getElementById("newGameBtn");
const statsContainer = document.getElementById("playerStats");
const inventoryContainer = document.getElementById("inventory");
const eventLog = document.getElementById("eventLog");

let state = null;
let nextItemId = 1;

for (const className of Object.keys(CLASSES)) {
  const option = document.createElement("option");
  option.value = className;
  option.textContent = className;
  classSelect.appendChild(option);
}

for (const difficulty of Object.keys(TIME_DIFFICULTIES)) {
  const option = document.createElement("option");
  option.value = difficulty;
  option.textContent = difficulty;
  difficultySelect.appendChild(option);
}

difficultySelect.value = "Normal";

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const m = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const s = String(safeSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function worldIndexForFloor(floor) {
  return Math.min(WORLD_THEMES.length - 1, Math.floor((floor - 1) / 5));
}

function getRequiredRelic(nextFloor) {
  return RELIC_GATES.find((gate) => nextFloor > gate.afterFloor);
}

function chooseLoot() {
  const roll = Math.random();
  const rarity = roll > 0.93 ? "Epic" : roll > 0.65 ? "Rare" : "Common";
  const pool = LOOT_TABLE.filter((item) => item.rarity === rarity);
  const selected = pool[randInt(0, pool.length - 1)];
  return { ...selected, id: nextItemId++ };
}

function newEnemy(level) {
  const hp = 14 + level * 2 + randInt(0, 5);
  const atk = 4 + Math.floor(level * 0.9) + randInt(0, 2);
  const def = 1 + Math.floor(level * 0.4);
  const namePool = ["Goblin", "Skeleton", "Cultist", "Ghoul", "Bandit"];
  return {
    type: "enemy",
    name: namePool[randInt(0, namePool.length - 1)],
    hp,
    maxHp: hp,
    atk,
    def,
  };
}

function newBoss(level) {
  const tier = level / 2;
  const hp = 80 + tier * 28;
  const atk = 10 + tier * 3;
  const def = 3 + tier;
  return {
    type: "boss",
    name: `Overseer ${tier}`,
    hp,
    maxHp: hp,
    atk,
    def,
    moveInterval: 3,
    turnsSinceMove: 0,
    moveChance: 0.45,
  };
}

function makeGrid() {
  const grid = Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill("wall"));
  const spawn = { x: Math.floor(GRID_WIDTH / 2), y: GRID_HEIGHT - 2 };
  const gate = { x: Math.floor(GRID_WIDTH / 2), y: 1 };

  for (let y = spawn.y - 1; y <= spawn.y + 1; y++) {
    for (let x = spawn.x - 1; x <= spawn.x + 1; x++) {
      if (y > 0 && y < GRID_HEIGHT - 1 && x > 0 && x < GRID_WIDTH - 1) {
        grid[y][x] = "floor";
      }
    }
  }

  let cx = spawn.x;
  let cy = spawn.y;
  grid[cy][cx] = "floor";

  while (cy > gate.y) {
    if (Math.random() < 0.23) {
      cx += randInt(-1, 1);
      cx = Math.max(1, Math.min(GRID_WIDTH - 2, cx));
    }
    cy -= 1;
    grid[cy][cx] = "floor";
    if (Math.random() < 0.5) {
      grid[cy][Math.max(1, cx - 1)] = "floor";
      grid[cy][Math.min(GRID_WIDTH - 2, cx + 1)] = "floor";
    }
  }

  grid[gate.y][gate.x] = "gate";

  const randomCarves = 320;
  for (let i = 0; i < randomCarves; i++) {
    const x = randInt(1, GRID_WIDTH - 2);
    const y = randInt(1, GRID_HEIGHT - 2);
    if (Math.random() < 0.7) grid[y][x] = "floor";
  }

  // always keep spawn area clear (cannot get trapped)
  for (let y = spawn.y - 1; y <= spawn.y + 1; y++) {
    for (let x = spawn.x - 1; x <= spawn.x + 1; x++) {
      if (y > 0 && y < GRID_HEIGHT - 1 && x > 0 && x < GRID_WIDTH - 1) {
        grid[y][x] = "floor";
      }
    }
  }

  return { grid, spawn, gate };
}

function computeReachable(grid, start) {
  const queue = [start];
  const visited = new Set([`${start.x},${start.y}`]);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (queue.length > 0) {
    const node = queue.shift();
    for (const [dx, dy] of dirs) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      if (nx < 1 || ny < 1 || nx >= GRID_WIDTH - 1 || ny >= GRID_HEIGHT - 1) continue;
      if (grid[ny][nx] === "wall") continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }

  return visited;
}

function randomReachableTile(reachable, occupied, avoidBottomRows = 0) {
  const cells = Array.from(reachable)
    .map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    })
    .filter((cell) => cell.y < GRID_HEIGHT - avoidBottomRows && !occupied.has(`${cell.x},${cell.y}`));

  return cells[randInt(0, cells.length - 1)];
}

function spawnEntities(level, mapData) {
  const occupied = new Set([`${mapData.spawn.x},${mapData.spawn.y}`, `${mapData.gate.x},${mapData.gate.y}`]);
  const reachable = computeReachable(mapData.grid, mapData.spawn);

  const enemies = [];
  const loot = [];
  let boss = null;

  const bossFloor = BOSS_LEVELS.has(level);
  const enemyCount = bossFloor ? 3 + Math.floor(level / 6) : 6 + Math.floor(level / 3);
  const lootCount = 4 + Math.floor(level / 2);

  for (let i = 0; i < enemyCount; i++) {
    const pos = randomReachableTile(reachable, occupied, 2);
    occupied.add(`${pos.x},${pos.y}`);
    enemies.push({ ...pos, ...newEnemy(level) });
  }

  if (bossFloor) {
    const pos = randomReachableTile(reachable, occupied, 2);
    occupied.add(`${pos.x},${pos.y}`);
    boss = { ...pos, ...newBoss(level) };
  }

  for (let i = 0; i < lootCount; i++) {
    const pos = randomReachableTile(reachable, occupied, 2);
    occupied.add(`${pos.x},${pos.y}`);
    loot.push({ ...pos, item: chooseLoot() });
  }

  return { enemies, loot, boss };
}

function createPlayer(className, spawn) {
  const base = CLASSES[className];
  return {
    className,
    level: 1,
    xp: 0,
    xpToNext: 30,
    hp: base.hp,
    maxHp: base.hp,
    atk: base.atk,
    def: base.def,
    crit: base.crit,
    x: spawn.x,
    y: spawn.y,
    inventory: [],
    equipment: { weapon: null, armor: null, trinket: null },
    relics: new Set(),
  };
}

function equippedBonus(player) {
  const equipped = Object.values(player.equipment).filter(Boolean);
  return equipped.reduce(
    (acc, item) => {
      acc.atk += item.atk;
      acc.def += item.def;
      acc.hp += item.hp;
      return acc;
    },
    { atk: 0, def: 0, hp: 0 }
  );
}

function log(message, type = "") {
  const p = document.createElement("p");
  p.textContent = message;
  if (type) p.className = type;
  eventLog.prepend(p);
}

function portalUnlocked() {
  const enemiesGone = state.enemies.length === 0;
  const bossGone = !state.boss || state.boss.hp <= 0;
  const nextFloor = state.floor + 1;
  const relicGate = getRequiredRelic(nextFloor);
  const hasRelic = !relicGate || state.player.relics.has(relicGate.relic);
  return enemiesGone && bossGone && hasRelic;
}

function renderStats() {
  const player = state.player;
  const bonus = equippedBonus(player);
  const hpCap = player.maxHp + bonus.hp;
  const theme = WORLD_THEMES[worldIndexForFloor(state.floor)].name;

  const equippedText = Object.entries(player.equipment)
    .map(([slot, item]) => `${slot}: ${item ? item.name : "-"}`)
    .join("<br>");

  const relicText = player.relics.size > 0 ? Array.from(player.relics).join(", ") : "Ingen";

  statsContainer.innerHTML = `
    <strong>World:</strong> ${theme}<br>
    <strong>Floor:</strong> ${state.floor}/${MAX_FLOOR}<br>
    <strong>Tid (${state.difficultyName}):</strong> ${formatTime(state.remainingTime)}<br>
    <strong>Klasse:</strong> ${player.className}<br>
    <strong>Char Level:</strong> ${player.level}<br>
    <strong>HP:</strong> ${player.hp}/${hpCap}<br>
    <strong>ATK:</strong> ${player.atk + bonus.atk}<br>
    <strong>DEF:</strong> ${player.def + bonus.def}<br>
    <strong>XP:</strong> ${player.xp}/${player.xpToNext}<br>
    <strong>Relics:</strong> ${relicText}<br>
    <strong>Portal:</strong> ${portalUnlocked() ? "Åben" : "Låst"}<br><br>
    <strong>Equipped:</strong><br>${equippedText}
  `;

  renderInventory();
}

function renderInventory() {
  inventoryContainer.innerHTML = "";
  if (state.player.inventory.length === 0) {
    inventoryContainer.innerHTML = "<p>Ingen loot endnu.</p>";
    return;
  }

  state.player.inventory.forEach((item) => {
    const slotItem = state.player.equipment[item.slot];
    const equipped = slotItem && slotItem.id === item.id;

    const card = document.createElement("div");
    card.className = "loot-item";
    card.innerHTML = `
      <span>${item.name}</span> (${item.rarity})<br>
      Slot: ${item.slot}<br>
      ATK +${item.atk} | DEF +${item.def} | HP +${item.hp}<br>
      ${equipped ? '<span class="equipped-tag">EQUIPPED</span>' : ""}
      <button class="equip-btn" data-item-id="${item.id}">Equip</button>
    `;
    inventoryContainer.appendChild(card);
  });
}

function drawPixelLoot(drop) {
  const px = drop.x * TILE_SIZE;
  const py = drop.y * TILE_SIZE;
  const c = drop.item.color;

  ctx.fillStyle = c;
  ctx.fillRect(px + 12, py + 8, 12, 4);
  ctx.fillRect(px + 8, py + 12, 20, 8);
  ctx.fillRect(px + 12, py + 20, 12, 8);
}

function drawPlayer() {
  const player = state.player;
  const px = player.x * TILE_SIZE;
  const py = player.y * TILE_SIZE;

  ctx.fillStyle = "#8cff9d";
  ctx.fillRect(px + 8, py + 8, 20, 20);

  const { weapon, armor, trinket } = player.equipment;
  if (armor) {
    ctx.strokeStyle = armor.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 6, py + 6, 24, 24);
  }
  if (weapon) {
    ctx.fillStyle = weapon.color;
    ctx.fillRect(px + 30, py + 10, 4, 16);
  }
  if (trinket) {
    ctx.fillStyle = trinket.color;
    ctx.fillRect(px + 2, py + 2, 4, 4);
    ctx.fillRect(px + 30, py + 2, 4, 4);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const theme = WORLD_THEMES[worldIndexForFloor(state.floor)];

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = state.grid[y][x];
      if (tile === "wall") {
        ctx.fillStyle = theme.wall;
      } else if (tile === "gate") {
        ctx.fillStyle = portalUnlocked() ? "#61d1ff" : "#2a4f62";
      } else {
        ctx.fillStyle = theme.floor;
      }
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  state.loot.forEach(drawPixelLoot);

  state.enemies.forEach((enemy) => {
    ctx.fillStyle = "#ff7878";
    ctx.fillRect(enemy.x * TILE_SIZE + 8, enemy.y * TILE_SIZE + 8, 20, 20);
  });

  if (state.boss && state.boss.hp > 0) {
    ctx.fillStyle = "#d08fff";
    ctx.fillRect(state.boss.x * TILE_SIZE + 4, state.boss.y * TILE_SIZE + 4, 28, 28);
  }

  drawPlayer();

  ctx.strokeStyle = "#243456";
  for (let i = 0; i <= GRID_WIDTH; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE_SIZE, 0);
    ctx.lineTo(i * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
    ctx.stroke();
  }
  for (let i = 0; i <= GRID_HEIGHT; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * TILE_SIZE);
    ctx.lineTo(GRID_WIDTH * TILE_SIZE, i * TILE_SIZE);
    ctx.stroke();
  }
}

function endGame(message, type = "log-bad") {
  if (!state || state.gameOver) return;
  state.gameOver = true;
  clearInterval(state.timerId);
  log(message, type);
  renderStats();
}

function addXp(amount) {
  const player = state.player;
  player.xp += amount;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = Math.floor(player.xpToNext * 1.35);
    player.maxHp += 7;
    player.atk += 2;
    player.def += 1;
    player.hp = Math.min(player.maxHp, player.hp + 8);
    log(`Level up! Du er nu level ${player.level}.`, "log-good");
  }
}

function damagePlayer(amount, source) {
  state.player.hp -= amount;
  log(`${source} rammer dig for ${amount}.`, "log-bad");
  if (state.player.hp <= 0) {
    endGame("Du døde i dungeonen.", "log-bad");
  }
}

function combat(target, rewardXp) {
  const player = state.player;
  const bonus = equippedBonus(player);

  const crit = Math.random() < player.crit ? 2 : 1;
  const dealt = Math.max(1, player.atk + bonus.atk - target.def) * crit;
  target.hp -= dealt;
  log(`Du rammer ${target.name} for ${dealt}${crit > 1 ? " (crit)" : ""}.`, target.type === "boss" ? "log-boss" : "");

  if (target.hp <= 0) {
    addXp(rewardXp);
    log(`${target.name} faldt.`, target.type === "boss" ? "log-boss" : "log-good");
    return true;
  }

  const incoming = Math.max(1, target.atk - (player.def + bonus.def));
  damagePlayer(incoming, target.name);
  return false;
}

function pickupLoot(index) {
  const drop = state.loot[index];
  state.player.inventory.push(drop.item);
  log(`Loot: ${drop.item.name} (${drop.item.slot})`, "log-loot");
  state.loot.splice(index, 1);
}

function maybeAwardRelic(floor) {
  const gate = RELIC_GATES.find((r) => r.bossFloor === floor);
  if (!gate) return;
  state.player.relics.add(gate.relic);
  log(`Du unlocked ${gate.relic}! Nu kan du gå højere op i worlds.`, "log-good");
}

function beginFloor(floor, keepPlayer = true) {
  const mapData = makeGrid();
  const entities = spawnEntities(floor, mapData);

  state.floor = floor;
  state.grid = mapData.grid;
  state.spawn = mapData.spawn;
  state.gate = mapData.gate;
  state.enemies = entities.enemies;
  state.loot = entities.loot;
  state.boss = entities.boss;

  if (keepPlayer) {
    state.player.x = mapData.spawn.x;
    state.player.y = mapData.spawn.y;
  }

  if (state.boss) {
    log(`${state.boss.name} styrer denne etage.`, "log-boss");
  }
}

function tryAdvanceFloor() {
  if (!portalUnlocked()) {
    const nextFloor = state.floor + 1;
    const relicGate = getRequiredRelic(nextFloor);
    if (relicGate && !state.player.relics.has(relicGate.relic)) {
      log(`Porten kræver ${relicGate.relic} (fra boss på floor ${relicGate.bossFloor}).`, "log-warn");
      return;
    }
    log("Ryd etagen først (alle enemies + boss).", "log-warn");
    return;
  }

  if (state.floor >= MAX_FLOOR) {
    endGame("Du har gennemført spillet ved world top (floor 20)!", "log-good");
    return;
  }

  state.remainingTime += 20;
  beginFloor(state.floor + 1);
  log(`Du avancerer opad til floor ${state.floor}. +20 sek.`, "log-good");
}

function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return false;
  return state.grid[y][x] !== "wall";
}

function bossTurn() {
  const boss = state.boss;
  if (!boss || boss.hp <= 0 || state.gameOver) return;

  boss.turnsSinceMove += 1;
  if (boss.turnsSinceMove < boss.moveInterval) return;
  boss.turnsSinceMove = 0;

  const dx = state.player.x - boss.x;
  const dy = state.player.y - boss.y;
  const dist = Math.abs(dx) + Math.abs(dy);

  if (dist === 1) {
    const incoming = Math.max(1, boss.atk - (state.player.def + equippedBonus(state.player).def));
    damagePlayer(incoming, boss.name);
    return;
  }

  if (Math.random() > boss.moveChance) return;

  const options = Math.abs(dx) > Math.abs(dy)
    ? [[Math.sign(dx), 0], [0, Math.sign(dy)], [0, -Math.sign(dy)]]
    : [[0, Math.sign(dy)], [Math.sign(dx), 0], [-Math.sign(dx), 0]];

  for (const [mx, my] of options) {
    const tx = boss.x + mx;
    const ty = boss.y + my;
    if (!isWalkable(tx, ty)) continue;
    if (state.player.x === tx && state.player.y === ty) continue;
    if (state.enemies.some((e) => e.x === tx && e.y === ty)) continue;
    boss.x = tx;
    boss.y = ty;
    break;
  }
}

function handleMove(dx, dy) {
  if (!state || state.gameOver) return;

  const p = state.player;
  const nx = p.x + dx;
  const ny = p.y + dy;
  if (!isWalkable(nx, ny)) return;

  const enemyIndex = state.enemies.findIndex((enemy) => enemy.x === nx && enemy.y === ny);
  if (enemyIndex >= 0) {
    const dead = combat(state.enemies[enemyIndex], 14 + state.floor * 3);
    if (dead) {
      state.enemies.splice(enemyIndex, 1);
      p.x = nx;
      p.y = ny;
    }
  } else if (state.boss && state.boss.hp > 0 && state.boss.x === nx && state.boss.y === ny) {
    const dead = combat(state.boss, 44 + state.floor * 8);
    if (dead) {
      maybeAwardRelic(state.floor);
      if (state.floor === MAX_FLOOR) {
        endGame("Du besejrede slutbossen og clear'ede floor 20!", "log-good");
      }
      state.boss.hp = 0;
      p.x = nx;
      p.y = ny;
    }
  } else {
    p.x = nx;
    p.y = ny;

    const lootIndex = state.loot.findIndex((drop) => drop.x === nx && drop.y === ny);
    if (lootIndex >= 0) pickupLoot(lootIndex);

    if (state.grid[ny][nx] === "gate") {
      tryAdvanceFloor();
    }
  }

  bossTurn();
  renderStats();
  draw();
}

function startTimer() {
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (state.gameOver) return;
    state.remainingTime -= 1;
    if (state.remainingTime <= 0) {
      state.remainingTime = 0;
      endGame("Tiden er udløbet.", "log-bad");
    }
    renderStats();
  }, 1000);
}

function startGame() {
  eventLog.innerHTML = "";

  const difficultyName = difficultySelect.value;
  const mapData = makeGrid();
  const player = createPlayer(classSelect.value, mapData.spawn);

  state = {
    player,
    floor: 1,
    grid: mapData.grid,
    spawn: mapData.spawn,
    gate: mapData.gate,
    enemies: [],
    loot: [],
    boss: null,
    gameOver: false,
    difficultyName,
    remainingTime: TIME_DIFFICULTIES[difficultyName],
    timerId: null,
  };

  const entities = spawnEntities(1, mapData);
  state.enemies = entities.enemies;
  state.loot = entities.loot;
  state.boss = entities.boss;

  log(`Velkommen ${player.className}.`, "log-good");
  log("Mål: gå op gennem floors, unlock relics, equip loot og clear floor 20.", "log-good");

  renderStats();
  draw();
  startTimer();
}

inventoryContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-item-id]");
  if (!button || !state) return;
  const id = Number(button.dataset.itemId);
  const item = state.player.inventory.find((entry) => entry.id === id);
  if (!item) return;

  state.player.equipment[item.slot] = item;
  log(`Equipped ${item.name} i slot ${item.slot}.`, "log-good");
  renderStats();
  draw();
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }

  if (key === "arrowup" || key === "w") handleMove(0, -1);
  if (key === "arrowdown" || key === "s") handleMove(0, 1);
  if (key === "arrowleft" || key === "a") handleMove(-1, 0);
  if (key === "arrowright" || key === "d") handleMove(1, 0);
});

newGameBtn.addEventListener("click", startGame);
startGame();
