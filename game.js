// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const playerTurnElement = document.getElementById('player-turn');
const angleDisplay = document.getElementById('angle-display');
const powerDisplay = document.getElementById('power-display');
const windSpeedElement = document.getElementById('wind-speed');
const windDirectionElement = document.getElementById('wind-direction');
const ammoTypeElement = document.getElementById('ammo-type');
const ammoDisplayElement = document.getElementById('ammo-display');
const highScoreElement = document.getElementById('high-score-value');
const debugInfo = document.getElementById('debug-info');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverMessageElement = document.getElementById('game-over-message');

// --- Game Constants ---
const GRAVITY = 0.1;
const TANK_WIDTH = 45; // Hơi nhỏ hơn
const TANK_HEIGHT = 25;
const ENEMY_TANK_WIDTH = 45;
const ENEMY_TANK_HEIGHT = 25;
const BARREL_LENGTH = 30;
const BARREL_THICKNESS = 5;
const MOVE_SPEED = 1.5;
const MIN_ANGLE = 1;
const MAX_ANGLE = 179;
const MIN_POWER = 10;
const MAX_POWER = 100;
const POWER_STEP = 2;
const ANGLE_STEP = 1;
const TERRAIN_RESOLUTION = 8; // Tăng khoảng cách giữa các điểm địa hình -> mượt hơn
const MAX_WIND_SPEED = 5;
const EXPLOSION_FRAMES = 16;
const EXPLOSION_FRAME_WIDTH = 64;
const EXPLOSION_FRAME_HEIGHT = 64;
const EXPLOSION_DURATION = 500;
const TERRAIN_MAX_HEIGHT_VARIATION = 0.03; // *** GIẢM ĐÁNG KỂ độ nhấp nhô (3%) ***
const TERRAIN_SMOOTHNESS = 0.85;      // *** TĂNG MẠNH độ mượt ***
const HOLD_INTERVAL = 50;
const WALL_COLOR = '#696969'; // Màu tường xám

// --- Ammo Types ---
const AMMO_TYPES = {
    'normal': { name: 'Thường', damage: 30, radius: 30, cost: 0 },
    'heavy': { name: 'Nặng', damage: 50, radius: 45, cost: 10 },
};
const AMMO_ORDER = ['normal', 'heavy'];

// --- Game State Variables ---
let playerTank;
let enemyTank;
let projectiles = [];
let explosions = [];
let terrain = [];
let walls = []; // *** Mảng chứa các bức tường ***
let currentPlayer = 'player';
let score = 0;
let currentLevel = 1;
let highScore = 0;
let wind = 0;
let isFiring = false; // Chỉ true khi đạn đang bay
let gameIsOver = false;
let currentAmmoIndex = 0;
let levelConfigs = [];
let angleInterval = null;
let powerInterval = null;
let turnSwitchTimeout = null; // ID cho timeout đổi lượt
let aiIsThinking = false; // Cờ cho biết AI đang tính toán

// --- Asset Loading ---
let assets = {
    playerTankImg: new Image(),
    enemyTankImg: new Image(),
    // backgroundImg: new Image(), // Bỏ nền
    explosionSpritesheet: new Image(),
    projectileImg: null,
    fireSound: new Audio(),
    explosionSound: new Audio(),
    // backgroundMusic: new Audio(),
    hitSound: new Audio(),
};
let assetsLoaded = 0;
// Cập nhật totalAssets nếu cần (ví dụ: 3 ảnh + 3 âm thanh = 6)
let totalAssets = 6;

function loadAssets(callback) {
    console.log("Loading assets...");
    let loadedCount = 0;

    function assetLoaded() {
        loadedCount++;
        console.log(`Loaded ${loadedCount}/${totalAssets}`);
        if (loadedCount === totalAssets) {
            console.log("All assets loaded!");
            callback();
        }
    }
    function assetError(e) { console.error("Error loading asset:", e.target.src || e.target); assetLoaded(); }

    assets.playerTankImg.src = 'assets/images/tank_player.png'; assets.playerTankImg.onload = assetLoaded; assets.playerTankImg.onerror = assetError;
    assets.enemyTankImg.src = 'assets/images/tank_enemy.png'; assets.enemyTankImg.onload = assetLoaded; assets.enemyTankImg.onerror = assetError;
    assets.explosionSpritesheet.src = 'assets/images/explosion_sheet.png'; assets.explosionSpritesheet.onload = assetLoaded; assets.explosionSpritesheet.onerror = assetError;
    assets.fireSound.src = 'assets/sounds/fire.wav'; assets.fireSound.oncanplaythrough = assetLoaded; assets.fireSound.onerror = assetError; assets.fireSound.load();
    assets.explosionSound.src = 'assets/sounds/explosion.wav'; assets.explosionSound.oncanplaythrough = assetLoaded; assets.explosionSound.onerror = assetError; assets.explosionSound.load();
    assets.hitSound.src = 'assets/sounds/hit.wav'; assets.hitSound.oncanplaythrough = assetLoaded; assets.hitSound.onerror = assetError; assets.hitSound.load();
    console.log("Asset loading initiated...");
}


// --- Game Object Classes ---

class Tank {
    constructor(x, y, width, height, color, image, isPlayer = true) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.color = color; this.image = image; this.isPlayer = isPlayer;
        this.angle = isPlayer ? 45 : 135; this.power = 50;
        this.barrelPivotX = 0; this.barrelPivotY = -this.height * 0.6;
        this.health = 100; this.currentTerrainY = y;
    }
    draw(ctx) {
        const drawX = this.x - this.width / 2; const drawY = this.currentTerrainY - this.height;
        ctx.save();
        const barrelRootCanvasX = this.x + this.barrelPivotX; const pivotCanvasY = drawY - this.barrelPivotY;
        ctx.translate(barrelRootCanvasX, pivotCanvasY);
        let displayAngle = this.isPlayer ? this.angle : (180 - this.angle); ctx.rotate(-displayAngle * Math.PI / 180);
        ctx.fillStyle = '#555'; ctx.fillRect(0, -BARREL_THICKNESS / 2, BARREL_LENGTH, BARREL_THICKNESS); ctx.restore();
        if (this.image && this.image.complete && this.image.naturalHeight !== 0) { ctx.drawImage(this.image, drawX, drawY, this.width, this.height); }
        else { ctx.fillStyle = this.color; ctx.fillRect(drawX, drawY, this.width, this.height); }
        const healthBarWidth = this.width * 0.8; const healthBarHeight = 6; const healthBarX = this.x - healthBarWidth / 2; const healthBarY = drawY - healthBarHeight - 4;
        ctx.fillStyle = '#ff4d4d'; ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        ctx.fillStyle = '#4dff4d'; ctx.fillRect(healthBarX, healthBarY, healthBarWidth * Math.max(0, this.health / 100), healthBarHeight);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    }
    updatePositionOnTerrain(terrainPoints) { this.currentTerrainY = getTerrainHeightAt(this.x, terrainPoints); this.currentTerrainY = Math.min(this.currentTerrainY, canvas.height); }
    move(direction, terrainPoints) {
        if (isFiring || gameIsOver) return; const nextX = this.x + direction * MOVE_SPEED; const tankHalfWidth = this.width / 2;
        if (nextX - tankHalfWidth < 0 || nextX + tankHalfWidth > canvas.width) return;
        const currentY = this.currentTerrainY; const nextTerrainY = getTerrainHeightAt(nextX, terrainPoints);
        if (Math.abs(nextX - this.x) < 0.1) return;
        const slope = Math.abs(nextTerrainY - currentY) / Math.abs(nextX - this.x);
        if (slope < 1.5) { this.x = nextX; this.updatePositionOnTerrain(terrainPoints); } else { console.log("Slope too steep!"); }
     }
    adjustAngle(amount) { if (isFiring || gameIsOver) return; let newAngle = this.angle + amount; if (this.isPlayer) { this.angle = Math.max(MIN_ANGLE, Math.min(90, newAngle)); } else { this.angle = Math.max(91, Math.min(MAX_ANGLE, newAngle)); } updateUI(); }
    adjustPower(amount) { if (isFiring || gameIsOver) return; this.power += amount; this.power = Math.max(MIN_POWER, Math.min(MAX_POWER, this.power)); updateUI(); }
    getBarrelEnd() { const drawY = this.currentTerrainY - this.height; const barrelRootCanvasX = this.x + this.barrelPivotX; const pivotCanvasY = drawY - this.barrelPivotY; let fireAngle = this.isPlayer ? this.angle : (180 - this.angle); const angleRad = -fireAngle * Math.PI / 180; const barrelEndX = barrelRootCanvasX + Math.cos(angleRad) * BARREL_LENGTH; const barrelEndY = pivotCanvasY + Math.sin(angleRad) * BARREL_LENGTH; return { x: barrelEndX, y: barrelEndY }; }
    takeDamage(amount) { this.health -= amount; this.health = Math.max(0, this.health); playSound(assets.hitSound); if (this.health <= 0) { console.log(`${this.isPlayer ? 'Player' : 'Enemy'} tank destroyed!`); } }
}

class Projectile {
    constructor(x, y, vx, vy, ammoData) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.radius = 5; this.trail = []; this.trailLength = 15;
        this.ammoData = ammoData; this.owner = (currentPlayer === 'player') ? playerTank : enemyTank;
    }

    update(wind, terrainPoints, wallObjects) { // *** Thêm wallObjects vào tham số ***
        this.x += this.vx; this.y += this.vy;
        this.vx += wind / 60; this.vy += GRAVITY;
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailLength) { this.trail.shift(); }
        return this.checkCollisions(terrainPoints, wallObjects); // *** Truyền wallObjects vào ***
    }

     checkCollisions(terrainPoints, wallObjects) { // *** Thêm wallObjects vào tham số ***
         // 1. *** Kiểm tra va chạm với tường TRƯỚC ***
         for (const wall of wallObjects) {
             if (this.x + this.radius > wall.x && this.x - this.radius < wall.x + wall.width &&
                 this.y + this.radius > wall.y && this.y - this.radius < wall.y + wall.height) {
                 console.log("Projectile hit wall");
                 const impactX = Math.max(wall.x, Math.min(this.x, wall.x + wall.width));
                 const impactY = Math.max(wall.y, Math.min(this.y, wall.y + wall.height));
                 return { hit: true, target: 'wall', point: { x: impactX, y: impactY } };
             }
         }

         // 2. Va chạm địa hình
         const terrainY = getTerrainHeightAt(this.x, terrainPoints);
         if (this.y >= terrainY) {
            console.log("Projectile hit terrain");
             return { hit: true, target: 'terrain', point: {x: this.x, y: terrainY} };
         }

         // 3. Va chạm xe tăng địch
         const targetTank = (this.owner === playerTank) ? enemyTank : playerTank;
         if (targetTank && checkCollisionCircleRect(this, targetTank)) { // Kiểm tra targetTank tồn tại
             console.log("Projectile hit tank");
             return { hit: true, target: targetTank, point: {x: this.x, y: this.y} };
         }

         // 4. Ra khỏi màn hình
         if (this.x < -this.radius || this.x > canvas.width + this.radius || this.y > canvas.height + this.radius || this.y < -canvas.height * 2) {
              console.log("Projectile out of bounds");
              return { hit: true, target: 'outofbounds', point: {x: this.x, y: this.y} };
         }

         return { hit: false };
     }
    draw(ctx) { if (this.trail.length > 1) { ctx.beginPath(); ctx.moveTo(this.trail[0].x, this.trail[0].y); for (let i = 1; i < this.trail.length; i++) { const alpha = (i / this.trail.length) * 0.5; ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; ctx.lineTo(this.trail[i].x, this.trail[i].y); } ctx.lineWidth = 3; ctx.stroke(); } ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); }
}

class Explosion {
    constructor(x, y, radius) { this.x = x; this.y = y; this.radius = radius; this.startTime = Date.now(); this.duration = EXPLOSION_DURATION; this.currentFrame = 0; this.frameWidth = EXPLOSION_FRAME_WIDTH; this.frameHeight = EXPLOSION_FRAME_HEIGHT; this.totalFrames = EXPLOSION_FRAMES; this.spriteSheet = assets.explosionSpritesheet; this.active = true; }
    update() { const elapsedTime = Date.now() - this.startTime; if (elapsedTime >= this.duration) { this.active = false; return; } this.currentFrame = Math.floor((elapsedTime / this.duration) * this.totalFrames); this.currentFrame = Math.min(this.currentFrame, this.totalFrames - 1); }
    draw(ctx) { if (!this.active || !this.spriteSheet || !this.spriteSheet.complete || this.spriteSheet.naturalHeight === 0) return; const frameX = (this.currentFrame % this.totalFrames) * this.frameWidth; const frameY = 0; ctx.drawImage( this.spriteSheet, frameX, frameY, this.frameWidth, this.frameHeight, this.x - this.frameWidth / 2, this.y - this.frameHeight / 2, this.frameWidth, this.frameHeight ); }
}

// --- Helper Functions ---
function playSound(sound) { if (sound && sound.readyState >= 3) { sound.currentTime = 0; sound.play().catch(e => console.warn("Sound play interrupted:", e)); } }
function checkCollisionCircleRect(circle, rectTank) { if (!rectTank) return false; const rectX = rectTank.x - rectTank.width / 2; const rectY = rectTank.currentTerrainY - rectTank.height; const rectWidth = rectTank.width; const rectHeight = rectTank.height; const closestX = Math.max(rectX, Math.min(circle.x, rectX + rectWidth)); const closestY = Math.max(rectY, Math.min(circle.y, rectY + rectHeight)); const distX = circle.x - closestX; const distY = circle.y - closestY; const distanceSquared = (distX * distX) + (distY * distY); return distanceSquared < (circle.radius * circle.radius); }
function getTerrainHeightAt(x, terrainPoints) { if (terrainPoints.length < 2) return canvas.height; let p1 = null, p2 = null; for (let i = 0; i < terrainPoints.length - 1; i++) { if (x >= terrainPoints[i].x && x <= terrainPoints[i+1].x) { p1 = terrainPoints[i]; p2 = terrainPoints[i+1]; break; } } if (x < terrainPoints[0].x) return terrainPoints[0].y; if (x > terrainPoints[terrainPoints.length - 1].x) return terrainPoints[terrainPoints.length - 1].y; if (!p1 || !p2) return canvas.height; if (p2.x === p1.x) return p1.y; const ratio = (x - p1.x) / (p2.x - p1.x); return p1.y + ratio * (p2.y - p1.y); }

// Tạo địa hình (ĐÃ ĐIỀU CHỈNH MẠNH TAY HƠN)
function generateTerrain(width, height) {
    console.log("Generating VERY smooth terrain...");
    const points = [];
    const segments = Math.ceil(width / TERRAIN_RESOLUTION);
    let currentY = height * (0.8 + Math.random() * 0.1); // Bắt đầu cao hơn và ít biến động hơn
    const maxTotalVariation = height * TERRAIN_MAX_HEIGHT_VARIATION; // Tổng biến thiên rất nhỏ

    points.push({ x: 0, y: currentY });

    for (let i = 1; i <= segments; i++) {
        const x = i * TERRAIN_RESOLUTION;
        // Biến thiên rất nhỏ mỗi bước, không dùng trend
        let yVariation = (Math.random() - 0.5) * (maxTotalVariation / segments) * 5; // Ngẫu nhiên nhỏ

        let nextY = currentY + yVariation;
        // Giới hạn trong khoảng hẹp hơn
        nextY = Math.max(height * 0.6, Math.min(height * 0.95, nextY));

        // Làm mượt RẤT MẠNH
        currentY = currentY * TERRAIN_SMOOTHNESS + nextY * (1 - TERRAIN_SMOOTHNESS);

        points.push({ x: Math.min(x, width), y: currentY });
    }

    if (points[points.length - 1].x < width) {
        points.push({ x: width, y: currentY });
    }
    console.log(`Generated ${points.length} terrain points.`);
    return points;
}

function destroyTerrain(centerX, centerY, radius, terrainPoints) {
    console.log(`Destroying terrain at (${centerX.toFixed(0)}, ${centerY.toFixed(0)}) with radius ${radius}`); const radiusSq = radius * radius; let changed = false;
    for (let i = 0; i < terrainPoints.length; i++) { const p = terrainPoints[i]; if (p.y < centerY - radius * 0.5) continue; const dx = p.x - centerX; const dy = p.y - centerY; const distSq = dx * dx + dy * dy;
        if (distSq < radiusSq) { const dist = Math.sqrt(distSq); const destructionFactor = Math.cos((dist / radius) * (Math.PI / 2)); const depth = radius * 0.7 * destructionFactor; const newY = p.y + depth; p.y = Math.min(newY, canvas.height + 50); changed = true; } }
    if (changed) console.log("Terrain modified.");
}

// --- Game Logic Functions ---
function defineLevels() {
    levelConfigs = [
        { windRange: 1, enemyHealth: 100, enemyAimAccuracy: 0.65, playerStartX: 0.15, enemyStartX: 0.85, wallCount: 0 }, // Level 1 dễ, không tường
        { windRange: 2, enemyHealth: 120, enemyAimAccuracy: 0.75, playerStartX: 0.1, enemyStartX: 0.9, wallCount: 1 },  // Level 2 có 1 tường
        { windRange: 3, enemyHealth: 150, enemyAimAccuracy: 0.85, playerStartX: 0.2, enemyStartX: 0.8, wallCount: 1 },  // Level 3 khó hơn, 1 tường
        { windRange: 4, enemyHealth: 140, enemyAimAccuracy: 0.80, playerStartX: 0.15, enemyStartX: 0.85, wallCount: 2 } // Level 4 có 2 tường
    ];
}

function initGame() {
    console.log("Initializing game..."); defineLevels(); loadSavedData(); resizeCanvas(); score = 0; gameIsOver = false; isFiring = false; aiIsThinking = false; projectiles = []; explosions = []; currentAmmoIndex = 0; if (gameOverOverlay) gameOverOverlay.style.display = 'none'; setupLevel(currentLevel); setupControls(); lastTime = performance.now(); gameLoop(lastTime); console.log("Game initialized and loop started.");
}
function loadSavedData() { highScore = parseInt(localStorage.getItem('tankGameHighScore') || '0'); currentLevel = parseInt(localStorage.getItem('tankGameLevel') || '1'); currentLevel = Math.min(currentLevel, levelConfigs.length); currentLevel = Math.max(1, currentLevel); if (highScoreElement) highScoreElement.textContent = highScore; console.log(`Loaded High Score: ${highScore}, Starting Level: ${currentLevel}`); }
function saveGameData() { localStorage.setItem('tankGameHighScore', highScore); localStorage.setItem('tankGameLevel', currentLevel); console.log(`Saved High Score: ${highScore}, Level: ${currentLevel}`); }
function resizeCanvas() {
    const wrapper = document.getElementById('game-wrapper'); const controlsElement = document.getElementById('controls'); const infoElement = document.getElementById('game-info');
    const controlsHeight = controlsElement ? controlsElement.offsetHeight : 0; const infoHeight = infoElement ? infoElement.offsetHeight : 0;
    const availableWidth = wrapper.clientWidth; const availableHeight = window.innerHeight - controlsHeight - infoHeight - 40;
    let canvasWidth = availableWidth; let canvasHeight = canvasWidth * (3 / 4);
    if (canvasHeight > availableHeight) { canvasHeight = availableHeight; canvasWidth = canvasHeight * (4 / 3); } canvasWidth = Math.min(canvasWidth, availableWidth);
    canvas.width = Math.max(320, Math.floor(canvasWidth)); canvas.height = Math.max(240, Math.floor(canvasHeight));
    console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
    if (playerTank && !gameIsOver) { console.log("Re-setting up level due to resize..."); const pHealth = playerTank.health; const eHealth = enemyTank.health; const currentTurn = currentPlayer; const firingState = isFiring; const thinkingState = aiIsThinking; setupLevel(currentLevel); playerTank.health = pHealth; enemyTank.health = eHealth; currentPlayer = currentTurn; isFiring = firingState; aiIsThinking = thinkingState; updateUI(); if(currentPlayer === 'player' && !isFiring) toggleControls(true); else toggleControls(false); }
    else { drawBackground(); }
}
function drawBackground() { ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

// *** Cập nhật setupLevel để thêm tường ***
function setupLevel(levelNumber) {
    console.log(`Setting up level ${levelNumber}`);
    const config = levelConfigs[levelNumber - 1] || levelConfigs[0];

    terrain = generateTerrain(canvas.width, canvas.height);
    walls = []; // *** Xóa tường cũ ***

    // --- Đặt tank (logic giữ nguyên) ---
    const placeTank = (startXRatio, tankWidth, tankHeight, color, image, isPlayer) => {
        let tankX = canvas.width * startXRatio; let tankY = getTerrainHeightAt(tankX, terrain); let attempts = 0; const maxAttempts = 15;
        while (attempts < maxAttempts) { const checkXLeft = Math.max(0, tankX - tankWidth / 2); const checkXRight = Math.min(canvas.width, tankX + tankWidth / 2); const yLeft = getTerrainHeightAt(checkXLeft, terrain); const yRight = getTerrainHeightAt(checkXRight, terrain); if (checkXRight - checkXLeft < 1) break; const slope = Math.abs(yRight - yLeft) / (checkXRight - checkXLeft); if (slope < 0.8) break; tankX += (Math.random() < 0.5 ? -1 : 1) * tankWidth * (0.6 + Math.random()*0.4); tankX = Math.max(tankWidth / 2 + 5, Math.min(canvas.width - tankWidth / 2 - 5, tankX)); tankY = getTerrainHeightAt(tankX, terrain); attempts++; }
        if (attempts >= maxAttempts) { console.warn(`Could not find flat spot. Placing anyway.`); tankX = canvas.width * startXRatio; tankY = getTerrainHeightAt(tankX, terrain); }
        const newTank = new Tank(tankX, tankY, tankWidth, tankHeight, color, image, isPlayer); newTank.updatePositionOnTerrain(terrain); return newTank;
    };
    playerTank = placeTank(config.playerStartX, TANK_WIDTH, TANK_HEIGHT, 'blue', assets.playerTankImg, true);
    enemyTank = placeTank(config.enemyStartX, ENEMY_TANK_WIDTH, ENEMY_TANK_HEIGHT, 'red', assets.enemyTankImg, false);

    // --- *** Đặt tường *** ---
    const wallCount = config.wallCount || 0;
    const minWallHeight = 50;
    const maxWallHeight = canvas.height * 0.3;
    const wallWidth = 20;
    const safeZone = canvas.width * 0.25; // Không đặt tường quá gần 2 bên

    for (let i = 0; i < wallCount; i++) {
        let wallX, wallY, wallHeight, validPosition = false, attempt = 0;
        while (!validPosition && attempt < 20) { // Thử tìm vị trí hợp lệ
            wallX = safeZone + Math.random() * (canvas.width - safeZone * 2 - wallWidth);
            wallHeight = minWallHeight + Math.random() * (maxWallHeight - minWallHeight);
            wallY = getTerrainHeightAt(wallX + wallWidth / 2, terrain) - wallHeight; // Đặt chân tường trên địa hình
            const distToPlayer = Math.abs(wallX + wallWidth / 2 - playerTank.x);
            const distToEnemy = Math.abs(wallX + wallWidth / 2 - enemyTank.x);
            if (distToPlayer > TANK_WIDTH * 1.5 && distToEnemy > ENEMY_TANK_WIDTH * 1.5 && wallY > canvas.height * 0.1) { validPosition = true; } attempt++;
        }
        if (validPosition) { walls.push({ x: wallX, y: wallY, width: wallWidth, height: wallHeight }); console.log(`Placed wall ${i+1} at X: ${wallX.toFixed(0)} Y: ${wallY.toFixed(0)} H: ${wallHeight.toFixed(0)}`); }
        else { console.warn(`Could not find valid position for wall ${i+1}`); }
    }

    // --- Reset trạng thái game ---
    enemyTank.health = config.enemyHealth;
    wind = (Math.random() - 0.5) * 2 * config.windRange;
    currentPlayer = 'player';
    isFiring = false;
    aiIsThinking = false; // Reset cờ AI
    projectiles = [];
    explosions = [];
    gameIsOver = false;
    if (turnSwitchTimeout) clearTimeout(turnSwitchTimeout);
    turnSwitchTimeout = null;

    updateUI();
    toggleControls(true); // Bật control cho player
    console.log("Level setup complete.");
}

// --- Quản lý Controls ---
function stopIntervals() { if (angleInterval) clearInterval(angleInterval); angleInterval = null; if (powerInterval) clearInterval(powerInterval); powerInterval = null; }
const controlListeners = {};
function removeAllControlListeners() { for (const id in controlListeners) { const el = document.getElementById(id); if (el && controlListeners[id]) { controlListeners[id].forEach(({ event, handler, options }) => el.removeEventListener(event, handler, options)); } } for (const key in controlListeners) delete controlListeners[key]; window.onkeydown = null; console.log("Removed existing control listeners."); }
function addControlListener(id, event, handler, options = { passive: false }) { const el = document.getElementById(id); if (el) { el.addEventListener(event, handler, options); if (!controlListeners[id]) controlListeners[id] = []; controlListeners[id].push({ event, handler, options }); } else { console.warn(`Element ID ${id} not found.`); } }
function setupControls() {
    console.log("Setting up controls..."); removeAllControlListeners(); stopIntervals();
    const setupHoldableButton = (buttonId, action) => { const button = document.getElementById(buttonId); if (!button) return; let intervalId = null; const startAction = (e) => { if (e.button !== 0 || intervalId || button.disabled || currentPlayer !== 'player' || isFiring) return; e.preventDefault(); e.stopPropagation(); action(); if(intervalId) clearInterval(intervalId); intervalId = setInterval(action, HOLD_INTERVAL); if (buttonId.includes('angle')) angleInterval = intervalId; else if (buttonId.includes('power')) powerInterval = intervalId; }; const stopAction = (e) => { if (intervalId) { clearInterval(intervalId); intervalId = null; if (buttonId.includes('angle')) angleInterval = null; else if (buttonId.includes('power')) powerInterval = null; } }; addControlListener(buttonId, 'pointerdown', startAction); addControlListener(buttonId, 'pointerup', stopAction); addControlListener(buttonId, 'pointerleave', stopAction); addControlListener(buttonId, 'contextmenu', e => {e.preventDefault(); stopAction(e);}); };
    setupHoldableButton('btn-angle-down', () => playerTank.adjustAngle(-ANGLE_STEP)); setupHoldableButton('btn-angle-up', () => playerTank.adjustAngle(ANGLE_STEP)); setupHoldableButton('btn-power-down', () => playerTank.adjustPower(-POWER_STEP)); setupHoldableButton('btn-power-up', () => playerTank.adjustPower(POWER_STEP));
    const addSingleActionListener = (buttonId, action) => { addControlListener(buttonId, 'pointerdown', (e) => { if (e.button !== 0 || document.getElementById(buttonId).disabled || isFiring) return; e.preventDefault(); e.stopPropagation(); action(); }); };
    addSingleActionListener('btn-move-left', () => playerTank.move(-1, terrain)); addSingleActionListener('btn-move-right', () => playerTank.move(1, terrain)); addSingleActionListener('btn-fire', handleFire); addSingleActionListener('btn-ammo-prev', selectPrevAmmo); addSingleActionListener('btn-ammo-next', selectNextAmmo);
    window.onkeydown = (e) => { if (currentPlayer !== 'player' || gameIsOver) return; if (e.key === 'ArrowUp') { if(!isFiring) playerTank.adjustAngle(ANGLE_STEP); e.preventDefault(); return; } if (e.key === 'ArrowDown') { if(!isFiring) playerTank.adjustAngle(-ANGLE_STEP); e.preventDefault(); return; } if (e.key === 'PageUp') { if(!isFiring) playerTank.adjustPower(POWER_STEP); e.preventDefault(); return; } if (e.key === 'PageDown') { if(!isFiring) playerTank.adjustPower(-POWER_STEP); e.preventDefault(); return; } if (e.repeat) return; let handled = true; switch (e.key) { case 'ArrowLeft': if(!isFiring) playerTank.move(-1, terrain); break; case 'ArrowRight': if(!isFiring) playerTank.move(1, terrain); break; case 'q': case 'Q': if(!isFiring) selectPrevAmmo(); break; case 'e': case 'E': if(!isFiring) selectNextAmmo(); break; case ' ': case 'Enter': if(!isFiring) handleFire(); break; default: handled = false; } if (handled) e.preventDefault(); };
    window.addEventListener('resize', resizeCanvas); console.log("Controls setup complete.");
}

function selectPrevAmmo() { if (isFiring || gameIsOver || currentPlayer !== 'player') return; currentAmmoIndex--; if (currentAmmoIndex < 0) currentAmmoIndex = AMMO_ORDER.length - 1; updateUI(); }
function selectNextAmmo() { if (isFiring || gameIsOver || currentPlayer !== 'player') return; currentAmmoIndex++; if (currentAmmoIndex >= AMMO_ORDER.length) currentAmmoIndex = 0; updateUI(); }
function updateUI() { if (!playerTank || !enemyTank) return; const currentAmmoKey = AMMO_ORDER[currentAmmoIndex]; const ammoData = AMMO_TYPES[currentAmmoKey]; if (scoreElement) scoreElement.textContent = score; if (levelElement) levelElement.textContent = currentLevel; if (playerTurnElement) playerTurnElement.textContent = `Lượt của: ${currentPlayer === 'player' ? 'Bạn' : 'Đối thủ'}`; if (angleDisplay) angleDisplay.textContent = playerTank.angle.toFixed(0); if (powerDisplay) powerDisplay.textContent = playerTank.power.toFixed(0); if (ammoTypeElement) ammoTypeElement.textContent = ammoData.name; if (ammoDisplayElement) ammoDisplayElement.textContent = ammoData.name; if (windSpeedElement) windSpeedElement.textContent = Math.abs(wind).toFixed(1); if (windDirectionElement) windDirectionElement.textContent = wind === 0 ? '-' : (wind > 0 ? '->' : '<-'); if (highScoreElement) highScoreElement.textContent = highScore; }
function handleFire() { if (isFiring || gameIsOver || currentPlayer !== 'player') return; const ammoKey = AMMO_ORDER[currentAmmoIndex]; const ammoData = AMMO_TYPES[ammoKey]; if (ammoData.cost > score) { console.log("Không đủ điểm!"); return; } score -= ammoData.cost; fire(playerTank, ammoData); updateUI(); }

function fire(tank, ammoData) {
    if (isFiring || gameIsOver) { console.warn("Attempted fire while firing/over."); return; }
    console.log(`${tank.isPlayer ? 'Player' : 'AI'} firing ${ammoData.name}!`);
    isFiring = true; // *** Đặt isFiring = true NGAY LẬP TỨC ***
    const barrelEnd = tank.getBarrelEnd(); let fireAngle = tank.isPlayer ? tank.angle : (180 - tank.angle); const angleRad = -fireAngle * Math.PI / 180; const initialVelocity = tank.power / 6 + 2; const vx = Math.cos(angleRad) * initialVelocity; const vy = Math.sin(angleRad) * initialVelocity;
    projectiles.push(new Projectile(barrelEnd.x, barrelEnd.y, vx, vy, ammoData));
    playSound(assets.fireSound);
    toggleControls(false); // Tắt điều khiển ngay khi bắn
}

function toggleControls(enabled) { const buttons = document.querySelectorAll('#controls button'); buttons.forEach(button => { if(button) button.disabled = !enabled; }); if (!enabled) stopIntervals(); }

// *** Cập nhật hàm update để xử lý va chạm tường và logic isFiring/switchTurn ***
function update(deltaTime) {
    if (gameIsOver) return;

    if (playerTank) playerTank.updatePositionOnTerrain(terrain);
    if (enemyTank) enemyTank.updatePositionOnTerrain(terrain);

    let projectilesStillFlying = (projectiles.length > 0);

    if (projectilesStillFlying) {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            if (!p) { projectiles.splice(i, 1); continue; } // Xóa đạn lỗi nếu có

            const collisionResult = p.update(wind, terrain, walls); // *** Truyền walls vào ***

            if (collisionResult.hit) {
                const hitPoint = collisionResult.point;
                const ammoData = p.ammoData;
                const explosionRadius = ammoData.radius;

                projectiles.splice(i, 1); // Xóa đạn
                console.log(`Projectile hit ${collisionResult.target}. Remaining: ${projectiles.length}`);

                 // Chỉ tạo hiệu ứng nổ và phá hủy nếu không phải outofbounds
                 if (collisionResult.target !== 'outofbounds') {
                     if (collisionResult.target !== 'wall') {
                         createExplosion(hitPoint.x, hitPoint.y, explosionRadius);
                         playSound(assets.explosionSound);
                          if (collisionResult.target === 'terrain' || collisionResult.target instanceof Tank) {
                              destroyTerrain(hitPoint.x, hitPoint.y, explosionRadius, terrain);
                          }
                     } else { // Hit Wall
                         createExplosion(hitPoint.x, hitPoint.y, 5); // Nổ nhỏ
                         playSound(assets.hitSound); // Dùng tiếng hit
                     }
                 }

                // Xử lý sát thương nếu trúng tank
                if (collisionResult.target instanceof Tank) {
                    const targetTank = collisionResult.target;
                    const damage = ammoData.damage + (Math.random() - 0.5) * 10;
                    targetTank.takeDamage(damage);
                    if (p.owner === playerTank && targetTank === enemyTank) {
                        score += Math.round(damage);
                        if (enemyTank.health <= 0) { score += 100; updateUI(); console.log("Enemy destroyed!"); setTimeout(() => nextLevelOrEndGame(true), 1200); return; }
                        updateUI();
                    } else if (p.owner === enemyTank && targetTank === playerTank) {
                        if (playerTank.health <= 0) { console.log("Player destroyed!"); setTimeout(() => gameOver(false), 1200); return; }
                    }
                }

                // Kiểm tra lại số đạn sau khi xóa
                projectilesStillFlying = (projectiles.length > 0);
                if (!projectilesStillFlying) {
                    console.log("Last projectile hit. No more projectiles flying.");
                    break; // Thoát vòng lặp nếu hết đạn
                }

            } // Kết thúc xử lý nếu hit = true
        } // Kết thúc vòng lặp for projectiles
    } // Kết thúc if (projectiles.length > 0)

    // --- Quyết định chuyển lượt ---
    // Nếu TRẠNG THÁI ĐANG LÀ BẮN (isFiring=true) và BÂY GIỜ không còn đạn bay (!projectilesStillFlying)
    if (isFiring && !projectilesStillFlying) {
        console.log("Update: Last projectile finished while in firing state. Scheduling turn switch.");
        if (turnSwitchTimeout) clearTimeout(turnSwitchTimeout);
        // Lên lịch gọi switchTurn, hàm này sẽ đặt isFiring=false
        // *** Quan trọng: Không đặt isFiring = false ở đây ***
        turnSwitchTimeout = setTimeout(switchTurn, 800);
    }

    // --- Logic cho lượt AI ---
    // Gọi aiTurn nếu đến lượt AI, game chưa kết thúc, KHÔNG đang bắn (isFiring=false), và AI chưa đang "nghĩ"
    if (currentPlayer === 'ai' && !isFiring && !gameIsOver && !aiIsThinking) {
        aiTurn();
    }

    // Cập nhật hiệu ứng nổ
    explosions.forEach((exp, index) => {
        exp.update();
        if (!exp.active) explosions.splice(index, 1);
    });
}

function nextLevelOrEndGame(playerWon) { if (gameIsOver) return; if (!playerWon) { gameOver(false); return; } console.log(`Level ${currentLevel} cleared! Score: ${score}`); currentLevel++; if (currentLevel > levelConfigs.length) { gameOver(true, `Tất cả Level Hoàn Thành! Điểm: ${score}`); } else { saveGameData(); console.log(`Moving to level ${currentLevel}`); setupLevel(currentLevel); } }
function createExplosion(x, y, radius) { console.log(`Creating explosion at ${x.toFixed(1)}, ${y.toFixed(1)} r:${radius}`); explosions.push(new Explosion(x, y, radius)); }

// *** Cập nhật switchTurn để quản lý isFiring ***
function switchTurn() {
    if (gameIsOver) { console.log("Switch turn aborted: Game Over"); return; }
    // Kiểm tra lại phòng trường hợp bị gọi khi còn đạn (do lỗi logic khác?)
    if (projectiles.length > 0) { console.warn("Switch turn called while projectiles still flying - Aborting."); return; }

    console.log("Executing switchTurn...");
    turnSwitchTimeout = null;

    // *** Đặt isFiring = false LÀM VIỆC ĐẦU TIÊN ***
    isFiring = false;
    aiIsThinking = false; // Reset cờ AI thinking

    stopIntervals();

    currentPlayer = (currentPlayer === 'player') ? 'ai' : 'player';
    updateUI();

    if (currentPlayer === 'player') {
        toggleControls(true);
        console.log("Switched to Player's turn. Controls enabled.");
    } else {
        toggleControls(false);
        console.log("Switched to AI's turn. Controls disabled.");
        // AI sẽ được gọi trong vòng lặp update tiếp theo nếu isFiring = false và !aiIsThinking
    }
}

// *** Cập nhật aiTurn để quản lý aiIsThinking ***
function aiTurn() {
    // Chỉ bắt đầu tính toán nếu đúng lượt, không đang bắn, game chưa xong, và CHƯA đang nghĩ
    if (currentPlayer !== 'ai' || isFiring || gameIsOver || aiIsThinking) return;

    console.log("AI's turn: Starting calculation...");
    aiIsThinking = true; // *** Đặt cờ AI đang nghĩ ***
    toggleControls(false);

    // --- Logic tính toán của AI ---
    const config = levelConfigs[currentLevel - 1] || levelConfigs[0];
    const accuracy = config.enemyAimAccuracy;
    const startX = enemyTank.getBarrelEnd().x;
    const startY = enemyTank.getBarrelEnd().y;
    const targetX = playerTank.x;
    const targetCenterY = playerTank.currentTerrainY - playerTank.height / 2;
    const dx = targetX - startX;
    const dy = targetCenterY - startY; // Y hướng xuống -> dy âm là target cao hơn
    const g = GRAVITY;
    let bestAngle = 135, bestPower = 60, minError = Infinity;
    const powerIterations = 15, angleIterations = 20; // Tăng độ chính xác

    // Thử nghiệm góc/lực
    for (let p = MIN_POWER; p <= MAX_POWER; p += (MAX_POWER - MIN_POWER) / powerIterations) {
        for (let angle = 91; angle < MAX_ANGLE; angle += (MAX_ANGLE - 91) / angleIterations) {
            const angleRad = -(180 - angle) * Math.PI / 180;
            const v = p / 6 + 2;
            const vx = Math.cos(angleRad) * v;
            const vy = Math.sin(angleRad) * v;
            if (Math.abs(vx) < 0.01) continue;

            // Ước tính thời gian bay (bỏ qua gió trong tính toán ban đầu cho đơn giản)
            // t = dx / vx; // Cách cũ
            // Cách mới: giải phương trình bậc 2 theo Y
            const discriminant = vy * vy + 2 * g * dy;
            if (discriminant < 0) continue;
            const t1 = (-vy + Math.sqrt(discriminant)) / g;
            const t2 = (-vy - Math.sqrt(discriminant)) / g;
            const t = (t1 > 0 && t2 > 0) ? Math.min(t1, t2) : Math.max(t1, t2); // Lấy thời gian dương nhỏ hơn nếu có (đạn đang đi lên)
            // const t = Math.max(t1, t2); // Lấy thời gian dương lớn hơn (khi đạn rơi xuống) - Thử cái này nếu nhắm cao quá
            if (t <= 0) continue;

            // Vị trí X dự đoán tại thời điểm t (có gió)
            const predictedX = startX + vx * t + 0.5 * (wind / 60) * t * t;
            const error = Math.abs(predictedX - targetX); // Sai số theo trục X

            // Kiểm tra va chạm sớm
            let hitsObstacleEarly = false;
            const checkSteps = 15;
            for (let step = 1; step <= checkSteps; step++) {
                const timeStep = t * (step / checkSteps);
                const currentX = startX + vx * timeStep + 0.5 * (wind / 60) * timeStep * timeStep;
                if (currentX < 0 || currentX > canvas.width) { hitsObstacleEarly = true; break; }
                const currentY = startY + vy * timeStep + 0.5 * g * timeStep * timeStep;
                for (const wall of walls) { if (currentX > wall.x && currentX < wall.x + wall.width && currentY > wall.y && currentY < wall.y + wall.height) { hitsObstacleEarly = true; break; } } if (hitsObstacleEarly) break;
                if (currentY >= getTerrainHeightAt(currentX, terrain)) { hitsObstacleEarly = true; break; }
            }

            if (!hitsObstacleEarly && error < minError) {
                minError = error;
                bestAngle = angle;
                bestPower = p;
            }
        }
    }

    // Thêm sai số
    const angleErrorRange = (1 - accuracy) * 15;
    const powerErrorRange = (1 - accuracy) * 25;
    const finalAngle = bestAngle + (Math.random() - 0.5) * angleErrorRange;
    const finalPower = bestPower + (Math.random() - 0.5) * powerErrorRange;

    enemyTank.angle = Math.max(91, Math.min(MAX_ANGLE, finalAngle));
    enemyTank.power = Math.max(MIN_POWER, Math.min(MAX_POWER, finalPower));

    console.log(`AI Aimed - Angle: ${enemyTank.angle.toFixed(1)}, Power: ${enemyTank.power.toFixed(1)} (MinErrorX: ${minError.toFixed(1)})`);

    const thinkTime = 900 + Math.random() * 800; // Tăng thời gian nghĩ chút
    console.log(`AI finished calc, will fire in ${thinkTime.toFixed(0)} ms`);

    setTimeout(() => {
        // *** Kiểm tra lại trạng thái NGAY TRƯỚC KHI BẮN ***
        if (currentPlayer === 'ai' && !isFiring && !gameIsOver) {
            console.log("AI executing fire command now.");
            fire(enemyTank, AMMO_TYPES['normal']); // AI bắn đạn thường
        } else {
            console.log(`AI fire aborted. State: turn=${currentPlayer}, firing=${isFiring}, over=${gameIsOver}, thinking=${aiIsThinking}`);
        }
        // *** Reset cờ thinking SAU KHI timeout hoàn thành ***
        aiIsThinking = false;
    }, thinkTime);
}


function draw() {
    drawBackground();
    drawTerrain(ctx, terrain);

    // *** Vẽ tường ***
    ctx.fillStyle = WALL_COLOR;
    ctx.strokeStyle = '#444'; // Viền tường
    ctx.lineWidth = 2;
    walls.forEach(wall => {
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
        ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
    });

    if (playerTank) playerTank.draw(ctx);
    if (enemyTank) enemyTank.draw(ctx);
    projectiles.forEach(p => p.draw(ctx));
    explosions.forEach(exp => exp.draw(ctx));
    drawWindIndicator(ctx);

    // Debug info
    if (debugInfo && playerTank && enemyTank) { try { debugInfo.textContent = `P:(${playerTank.x.toFixed(0)},${playerTank.currentTerrainY.toFixed(0)}) H:${playerTank.health.toFixed(0)} | E:(${enemyTank.x.toFixed(0)},${enemyTank.currentTerrainY.toFixed(0)}) H:${enemyTank.health.toFixed(0)} | Proj:${projectiles.length} Exp:${explosions.length} Firing:${isFiring} Turn:${currentPlayer} AIThink:${aiIsThinking}`; } catch (e) { debugInfo.textContent = "Debug error"; } }
    else if (debugInfo) { debugInfo.textContent = ''; }
}

function drawTerrain(ctx, terrainPoints) { if (terrainPoints.length < 2) return; ctx.fillStyle = '#654321'; ctx.beginPath(); ctx.moveTo(0, canvas.height); ctx.lineTo(terrainPoints[0].x, terrainPoints[0].y + 10); for (let i = 1; i < terrainPoints.length; i++) { ctx.lineTo(terrainPoints[i].x, terrainPoints[i].y + 10); } ctx.lineTo(canvas.width, canvas.height); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#228B22'; ctx.beginPath(); ctx.moveTo(0, canvas.height); ctx.lineTo(terrainPoints[0].x, terrainPoints[0].y); for (let i = 1; i < terrainPoints.length; i++) { ctx.lineTo(terrainPoints[i].x, terrainPoints[i].y); } ctx.lineTo(terrainPoints[terrainPoints.length-1].x, canvas.height); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#006400'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(terrainPoints[0].x, terrainPoints[0].y); for (let i = 1; i < terrainPoints.length; i++) { ctx.lineTo(terrainPoints[i].x, terrainPoints[i].y); } ctx.stroke(); }
function drawWindIndicator(ctx) { const indicatorX = canvas.width / 2; const indicatorY = 25; const maxWindArrow = 40; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 3; ctx.textAlign = 'center'; ctx.fillText(`Gió: ${Math.abs(wind).toFixed(1)}`, indicatorX, indicatorY - 15); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; if (Math.abs(wind) < 0.1) return; const arrowWidth = Math.abs(wind / MAX_WIND_SPEED) * maxWindArrow; ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); const startX = indicatorX - (wind > 0 ? arrowWidth / 2 : -arrowWidth / 2); const endX = indicatorX + (wind > 0 ? arrowWidth / 2 : -arrowWidth / 2); ctx.moveTo(startX, indicatorY); ctx.lineTo(endX, indicatorY); const arrowHeadSize = 8; if (wind > 0) { ctx.moveTo(endX - arrowHeadSize, indicatorY - arrowHeadSize / 2); ctx.lineTo(endX, indicatorY); ctx.lineTo(endX - arrowHeadSize, indicatorY + arrowHeadSize / 2); } else { ctx.moveTo(endX + arrowHeadSize, indicatorY - arrowHeadSize / 2); ctx.lineTo(endX, indicatorY); ctx.lineTo(endX + arrowHeadSize, indicatorY + arrowHeadSize / 2); } ctx.stroke(); ctx.lineCap = 'butt'; }
function gameOver(playerWon, customMessage = "") { if (gameIsOver) return; console.log(`Game Over. Player ${playerWon ? 'Won' : 'Lost'}`); gameIsOver = true; isFiring = false; aiIsThinking = false; stopIntervals(); toggleControls(false); if (turnSwitchTimeout) clearTimeout(turnSwitchTimeout); turnSwitchTimeout = null; if (playerWon && score > highScore) { highScore = score; saveGameData(); } const message = customMessage || (playerWon ? `Chiến thắng! Điểm: ${score}` : "Thất bại!"); if (gameOverOverlay && gameOverMessageElement) { gameOverMessageElement.textContent = message; gameOverOverlay.style.display = 'flex'; } }

let lastTime = 0;
function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);
    const deltaTime = Math.min(50, timestamp - lastTime); lastTime = timestamp;
    if (!gameIsOver && deltaTime > 0) { update(deltaTime / 16.67); } draw();
}

// --- Start the game ---
document.addEventListener('DOMContentLoaded', () => { loadAssets(initGame); });
