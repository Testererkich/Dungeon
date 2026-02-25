const TILE_SIZE = 40;
const GRID_SIZE = 16;

const CLASSES = {
  Warrior: { hp: 42, atk: 8, def: 4, crit: 0.1 },
  Rogue: { hp: 32, atk: 10, def: 2, crit: 0.22 },
  Mage: { hp: 28, atk: 12, def: 1, crit: 0.18 },
};

const LOOT_TABLE = [
  { name: "Rustent Sværd", atk: 2, def: 0, hp: 0, rarity: "Common" },
  { name: "Læderrustning", atk: 0, def: 2, hp: 0, rarity: "Common" },
  { name: "Runebog", atk: 3, def: 0, hp: 1, rarity: "Rare" },
  { name: "Skyggedolk", atk: 4, def: 1, hp: 0, rarity: "Rare" },
  { name: "Dragonskjold", atk: 0, def: 4, hp: 3, rarity: "Epic" },
  { name: "Phoenix-Amulet", atk: 2, def: 2, hp: 6, rarity: "Epic" },
];

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const classSelect = document.getElementById("classSelect");
const newGameBtn = document.getElementById("newGameBtn");
const statsContainer = document.getElementById("playerStats");
const inventoryContainer = document.getElementById("inventory");
const eventLog = document.getElementById("eventLog");

let state = null;

for (const className of Object.keys(CLASSES)) {
  const option = document.createElement("option");
  option.value = className;
  option.textContent = className;
  classSelect.appendChild(option);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chooseLoot() {
  const roll = Math.random();
  if (roll > 0.92) return LOOT_TABLE.find((l) => l.rarity === "Epic");
  if (roll > 0.65) {
    const rares = LOOT_TABLE.filter((l) => l.rarity === "Rare");
    return rares[randInt(0, rares.length - 1)];
  }
  const commons = LOOT_TABLE.filter((l) => l.rarity === "Common");
  return commons[randInt(0, commons.length - 1)];
}

function newEnemy(level) {
  const hp = 10 + level * 3 + randInt(0, 4);
  const atk = 3 + level + randInt(0, 2);
  const def = Math.floor(level / 2);
  return {
    name: ["Goblin", "Skeleton", "Cultist", "Ghoul"][randInt(0, 3)],
    hp,
    maxHp: hp,
    atk,
    def,
  };
}

function makeGrid() {
  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill("floor"));

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const border = x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1;
      if (border || Math.random() < 0.14) {
        grid[y][x] = "wall";
      }
    }
  }

  grid[1][1] = "floor";
  return grid;
}

function randomFreeTile(grid, occupied) {
  while (true) {
    const x = randInt(1, GRID_SIZE - 2);
    const y = randInt(1, GRID_SIZE - 2);
    const key = `${x},${y}`;
    if (grid[y][x] === "floor" && !occupied.has(key)) {
      return { x, y };
    }
  }
}

function spawnEntities(grid, level) {
  const occupied = new Set(["1,1"]);
  const enemies = [];
  const loot = [];

  const enemyCount = 4 + Math.min(level, 5);
  const lootCount = 3 + Math.floor(level / 2);

  for (let i = 0; i < enemyCount; i++) {
    const pos = randomFreeTile(grid, occupied);
    occupied.add(`${pos.x},${pos.y}`);
    enemies.push({ ...pos, ...newEnemy(level) });
  }

  for (let i = 0; i < lootCount; i++) {
    const pos = randomFreeTile(grid, occupied);
    occupied.add(`${pos.x},${pos.y}`);
    loot.push({ ...pos, item: chooseLoot() });
  }

  const stairs = randomFreeTile(grid, occupied);
  return { enemies, loot, stairs };
}

function createPlayer(className) {
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
    x: 1,
    y: 1,
    inventory: [],
  };
}

function calculateGearBonus(player) {
  return player.inventory.reduce(
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

function renderStats() {
  const player = state.player;
  const gear = calculateGearBonus(player);
  statsContainer.innerHTML = `
    <strong>Klasse:</strong> ${player.className}<br>
    <strong>Dungeon Level:</strong> ${state.floor}<br>
    <strong>Karakter Level:</strong> ${player.level}<br>
    <strong>HP:</strong> ${player.hp}/${player.maxHp + gear.hp}<br>
    <strong>ATK:</strong> ${player.atk + gear.atk}<br>
    <strong>DEF:</strong> ${player.def + gear.def}<br>
    <strong>XP:</strong> ${player.xp}/${player.xpToNext}
  `;

  inventoryContainer.innerHTML = "";
  if (player.inventory.length === 0) {
    inventoryContainer.innerHTML = "<p>Ingen loot endnu.</p>";
  } else {
    player.inventory.forEach((item, idx) => {
      const el = document.createElement("div");
      el.className = "loot-item";
      el.innerHTML = `<span>#${idx + 1} ${item.name}</span><br>ATK +${item.atk} | DEF +${item.def} | HP +${item.hp}`;
      inventoryContainer.appendChild(el);
    });
  }
}

function drawTile(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      drawTile(x, y, state.grid[y][x] === "wall" ? "#25304c" : "#111927");
    }
  }

  drawTile(state.stairs.x, state.stairs.y, "#6ec7ff");

  state.loot.forEach((drop) => drawTile(drop.x, drop.y, "#ffd86e"));
  state.enemies.forEach((enemy) => drawTile(enemy.x, enemy.y, "#ff7a7a"));

  drawTile(state.player.x, state.player.y, "#8cff9d");

  ctx.strokeStyle = "#2f3f62";
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE_SIZE, 0);
    ctx.lineTo(i * TILE_SIZE, GRID_SIZE * TILE_SIZE);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * TILE_SIZE);
    ctx.lineTo(GRID_SIZE * TILE_SIZE, i * TILE_SIZE);
    ctx.stroke();
  }
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
    player.hp = Math.min(player.maxHp, player.hp + 10);
    log(`Level up! Du er nu level ${player.level}.`, "log-good");
  }
}

function combat(enemy) {
  const player = state.player;
  const gear = calculateGearBonus(player);

  const crit = Math.random() < player.crit ? 2 : 1;
  const playerDamage = Math.max(1, player.atk + gear.atk - enemy.def) * crit;
  enemy.hp -= playerDamage;
  log(`Du rammer ${enemy.name} for ${playerDamage} skade${crit > 1 ? " (crit)" : ""}.`);

  if (enemy.hp <= 0) {
    log(`${enemy.name} blev besejret!`, "log-good");
    addXp(12 + state.floor * 3);
    return true;
  }

  const enemyDamage = Math.max(1, enemy.atk - (player.def + gear.def));
  player.hp -= enemyDamage;
  log(`${enemy.name} rammer dig for ${enemyDamage}.`, "log-bad");

  if (player.hp <= 0) {
    log("Du døde i dungeonen. Start et nyt spil!", "log-bad");
    state.gameOver = true;
  }

  return false;
}

function pickupLoot(index) {
  const drop = state.loot[index];
  state.player.inventory.push(drop.item);
  log(`Loot fundet: ${drop.item.name} (${drop.item.rarity})`, "log-loot");
  state.loot.splice(index, 1);
}

function nextFloor() {
  state.floor += 1;
  const grid = makeGrid();
  const entities = spawnEntities(grid, state.floor);

  state.grid = grid;
  state.enemies = entities.enemies;
  state.loot = entities.loot;
  state.stairs = entities.stairs;
  state.player.x = 1;
  state.player.y = 1;

  log(`Du går ned til dungeon level ${state.floor}.`, "log-good");
}

function handleMove(dx, dy) {
  if (!state || state.gameOver) return;

  const player = state.player;
  const nx = player.x + dx;
  const ny = player.y + dy;

  if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) return;
  if (state.grid[ny][nx] === "wall") return;

  const enemyIndex = state.enemies.findIndex((e) => e.x === nx && e.y === ny);
  if (enemyIndex >= 0) {
    const dead = combat(state.enemies[enemyIndex]);
    if (dead) {
      state.enemies.splice(enemyIndex, 1);
      player.x = nx;
      player.y = ny;
    }
    renderStats();
    draw();
    return;
  }

  player.x = nx;
  player.y = ny;

  const lootIndex = state.loot.findIndex((l) => l.x === nx && l.y === ny);
  if (lootIndex >= 0) {
    pickupLoot(lootIndex);
  }

  if (nx === state.stairs.x && ny === state.stairs.y) {
    nextFloor();
  }

  renderStats();
  draw();
}

function startGame() {
  eventLog.innerHTML = "";

  const player = createPlayer(classSelect.value);
  const grid = makeGrid();
  const entities = spawnEntities(grid, 1);

  state = {
    player,
    floor: 1,
    grid,
    enemies: entities.enemies,
    loot: entities.loot,
    stairs: entities.stairs,
    gameOver: false,
  };

  log(`Velkommen ${player.className}! Find loot og overlev så længe som muligt.`, "log-good");
  renderStats();
  draw();
}

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
