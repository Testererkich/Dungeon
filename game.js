const TILE_SIZE = 40;
const GRID_SIZE = 16;
const BOSS_LEVELS = new Set([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);

const CLASSES = {
  Warrior: { hp: 42, atk: 8, def: 4, crit: 0.1 },
  Rogue: { hp: 32, atk: 10, def: 2, crit: 0.22 },
  Mage: { hp: 28, atk: 12, def: 1, crit: 0.18 },
};

const TIME_DIFFICULTIES = {
  Let: 14 * 60,
  Normal: 10 * 60,
  Svær: 7 * 60,
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
const difficultySelect = document.getElementById("difficultySelect");
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

for (const difficulty of Object.keys(TIME_DIFFICULTIES)) {
  const option = document.createElement("option");
  option.value = difficulty;
  option.textContent = difficulty;
  difficultySelect.appendChild(option);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
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
    type: "enemy",
    name: ["Goblin", "Skeleton", "Cultist", "Ghoul"][randInt(0, 3)],
    hp,
    maxHp: hp,
    atk,
    def,
  };
}

function newBoss(level) {
  const bossTier = level / 2;
  const hp = 60 + bossTier * 24;
  const atk = 9 + bossTier * 3;
  const def = 2 + bossTier;

  return {
    type: "boss",
    name: `Dungeon Boss ${bossTier}`,
    hp,
    maxHp: hp,
    atk,
    def,
    moveInterval: 2,
    turnsSinceMove: 0,
    moveChance: 0.65,
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
  let boss = null;

  const bossFloor = BOSS_LEVELS.has(level);
  const enemyCount = bossFloor ? 1 + Math.floor(level / 5) : 4 + Math.min(level, 5);
  const lootCount = 3 + Math.floor(level / 2);

  for (let i = 0; i < enemyCount; i++) {
    const pos = randomFreeTile(grid, occupied);
    occupied.add(`${pos.x},${pos.y}`);
    enemies.push({ ...pos, ...newEnemy(level) });
  }

  if (bossFloor) {
    const bossPos = randomFreeTile(grid, occupied);
    occupied.add(`${bossPos.x},${bossPos.y}`);
    boss = { ...bossPos, ...newBoss(level) };
  }

  for (let i = 0; i < lootCount; i++) {
    const pos = randomFreeTile(grid, occupied);
    occupied.add(`${pos.x},${pos.y}`);
    loot.push({ ...pos, item: chooseLoot() });
  }

  const stairs = randomFreeTile(grid, occupied);
  return { enemies, loot, stairs, boss };
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

function canUsePortal() {
  const noEnemies = state.enemies.length === 0;
  const bossDefeated = !state.boss || state.boss.hp <= 0;
  return noEnemies && bossDefeated;
}

function renderStats() {
  const player = state.player;
  const gear = calculateGearBonus(player);
  const totalMaxHp = player.maxHp + gear.hp;
  const bossInfo =
    state.boss && state.boss.hp > 0
      ? `<strong>Boss:</strong> ${state.boss.name} (${state.boss.hp}/${state.boss.maxHp} HP)<br>`
      : "";

  statsContainer.innerHTML = `
    <strong>Klasse:</strong> ${player.className}<br>
    <strong>Tid (${state.difficultyName}):</strong> ${formatTime(state.remainingTime)}<br>
    <strong>Dungeon Level:</strong> ${state.floor}/20<br>
    <strong>Karakter Level:</strong> ${player.level}<br>
    ${bossInfo}
    <strong>HP:</strong> ${player.hp}/${totalMaxHp}<br>
    <strong>ATK:</strong> ${player.atk + gear.atk}<br>
    <strong>DEF:</strong> ${player.def + gear.def}<br>
    <strong>XP:</strong> ${player.xp}/${player.xpToNext}<br>
    <strong>Portal:</strong> ${canUsePortal() ? "Åben" : "Låst - ryd etagen"}
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

  drawTile(state.stairs.x, state.stairs.y, canUsePortal() ? "#6ec7ff" : "#35506a");
  state.loot.forEach((drop) => drawTile(drop.x, drop.y, "#ffd86e"));
  state.enemies.forEach((enemy) => drawTile(enemy.x, enemy.y, "#ff7a7a"));

  if (state.boss && state.boss.hp > 0) {
    drawTile(state.boss.x, state.boss.y, "#d08fff");
  }

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
    player.hp = Math.min(player.maxHp, player.hp + 10);
    log(`Level up! Du er nu level ${player.level}.`, "log-good");
  }
}

function dealDamageToPlayer(amount, sourceName) {
  state.player.hp -= amount;
  log(`${sourceName} rammer dig for ${amount}.`, "log-bad");
  if (state.player.hp <= 0) {
    endGame("Du døde i dungeonen. Start et nyt spil!", "log-bad");
  }
}

function combatTarget(target, rewardXp) {
  const player = state.player;
  const gear = calculateGearBonus(player);

  const crit = Math.random() < player.crit ? 2 : 1;
  const playerDamage = Math.max(1, player.atk + gear.atk - target.def) * crit;
  target.hp -= playerDamage;

  const critText = crit > 1 ? " (crit)" : "";
  const css = target.type === "boss" ? "log-boss" : "";
  log(`Du rammer ${target.name} for ${playerDamage} skade${critText}.`, css);

  if (target.hp <= 0) {
    log(`${target.name} blev besejret!`, target.type === "boss" ? "log-boss" : "log-good");
    addXp(rewardXp);
    return true;
  }

  const enemyDamage = Math.max(1, target.atk - (player.def + gear.def));
  dealDamageToPlayer(enemyDamage, target.name);
  return false;
}

function pickupLoot(index) {
  const drop = state.loot[index];
  state.player.inventory.push(drop.item);
  log(`Loot fundet: ${drop.item.name} (${drop.item.rarity})`, "log-loot");
  state.loot.splice(index, 1);
}

function advanceToNextFloor() {
  if (state.floor >= 20) {
    endGame("Du har gennemført dungeon level 20 og vundet spillet!", "log-good");
    return;
  }

  state.floor += 1;
  const grid = makeGrid();
  const entities = spawnEntities(grid, state.floor);

  state.grid = grid;
  state.enemies = entities.enemies;
  state.loot = entities.loot;
  state.stairs = entities.stairs;
  state.boss = entities.boss;
  state.player.x = 1;
  state.player.y = 1;

  state.remainingTime += 20;
  log(`Du går ned til dungeon level ${state.floor}. +20 sekunder.`, "log-good");

  if (state.boss) {
    log(`${state.boss.name} er vågnet!`, "log-boss");
  }
}

function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return false;
  return state.grid[y][x] !== "wall";
}

function bossTakeTurn() {
  const boss = state.boss;
  if (!boss || boss.hp <= 0 || state.gameOver) return;

  boss.turnsSinceMove += 1;
  if (boss.turnsSinceMove < boss.moveInterval) return;
  boss.turnsSinceMove = 0;

  const dx = state.player.x - boss.x;
  const dy = state.player.y - boss.y;
  const distance = Math.abs(dx) + Math.abs(dy);

  if (distance === 1) {
    const dmg = Math.max(1, boss.atk - (state.player.def + calculateGearBonus(state.player).def));
    dealDamageToPlayer(dmg, boss.name);
    return;
  }

  if (Math.random() > boss.moveChance) return;

  const preferred = Math.abs(dx) >= Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];

  for (const [mx, my] of preferred) {
    const tx = boss.x + mx;
    const ty = boss.y + my;
    const occupiedByEnemy = state.enemies.some((enemy) => enemy.x === tx && enemy.y === ty);
    const occupiedByPlayer = state.player.x === tx && state.player.y === ty;

    if (occupiedByPlayer || occupiedByEnemy) continue;
    if (!isWalkable(tx, ty)) continue;

    boss.x = tx;
    boss.y = ty;
    break;
  }
}

function handleMove(dx, dy) {
  if (!state || state.gameOver) return;

  const player = state.player;
  const nx = player.x + dx;
  const ny = player.y + dy;

  if (!isWalkable(nx, ny)) return;

  const enemyIndex = state.enemies.findIndex((enemy) => enemy.x === nx && enemy.y === ny);
  if (enemyIndex >= 0) {
    const dead = combatTarget(state.enemies[enemyIndex], 12 + state.floor * 3);
    if (dead) {
      state.enemies.splice(enemyIndex, 1);
      player.x = nx;
      player.y = ny;
    }
  } else if (state.boss && state.boss.hp > 0 && state.boss.x === nx && state.boss.y === ny) {
    const dead = combatTarget(state.boss, 40 + state.floor * 8);
    if (dead) {
      if (state.floor === 20) {
        endGame("Du besejrede slutbossen på level 20! Spillet er gennemført!", "log-good");
      }
      state.boss.hp = 0;
      player.x = nx;
      player.y = ny;
    }
  } else {
    player.x = nx;
    player.y = ny;

    const lootIndex = state.loot.findIndex((l) => l.x === nx && l.y === ny);
    if (lootIndex >= 0) {
      pickupLoot(lootIndex);
    }

    if (nx === state.stairs.x && ny === state.stairs.y) {
      if (canUsePortal()) {
        advanceToNextFloor();
      } else {
        log("Portalen er låst. Besejr alle fjender (og boss) først.", "log-warn");
      }
    }
  }

  bossTakeTurn();
  renderStats();
  draw();
}

function startTimer() {
  if (state.timerId) clearInterval(state.timerId);

  state.timerId = setInterval(() => {
    if (!state || state.gameOver) return;
    state.remainingTime -= 1;
    if (state.remainingTime <= 0) {
      state.remainingTime = 0;
      endGame("Tiden er udløbet! Vælg sværhedsgrad og prøv igen.", "log-bad");
    }
    renderStats();
  }, 1000);
}

function startGame() {
  eventLog.innerHTML = "";

  const difficultyName = difficultySelect.value;
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
    boss: entities.boss,
    gameOver: false,
    difficultyName,
    remainingTime: TIME_DIFFICULTIES[difficultyName],
    timerId: null,
  };

  log(`Velkommen ${player.className}! Du spiller på ${difficultyName} (${formatTime(state.remainingTime)}).`, "log-good");
  log("Mål: nå level 20 og besejr bossen.", "log-good");

  renderStats();
  draw();
  startTimer();
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
