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
const ammoTypeElement = document.getElementById('ammo-type'); // Hiển thị loại đạn trên info
const ammoDisplayElement = document.getElementById('ammo-display'); // Hiển thị loại đạn ở control
const highScoreElement = document.getElementById('high-score-value');
const debugInfo = document.getElementById('debug-info'); // Tùy chọn

// Game Over Overlay Elements
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverMessageElement = document.getElementById('game-over-message');


// --- Game Constants ---
const GRAVITY = 0.1;
const TANK_WIDTH = 50;
const TANK_HEIGHT = 30;
const ENEMY_TANK_WIDTH = 50;
const ENEMY_TANK_HEIGHT = 30;
const BARREL_LENGTH = 35;
const BARREL_THICKNESS = 6;
const MOVE_SPEED = 1.5;
const MIN_ANGLE = 1;
const MAX_ANGLE = 179;
const MIN_POWER = 10;
const MAX_POWER = 100;
const POWER_STEP = 2;
const ANGLE_STEP = 1;
const TERRAIN_RESOLUTION = 5;
const MAX_WIND_SPEED = 5;
const EXPLOSION_FRAMES = 16;
const EXPLOSION_FRAME_WIDTH = 64;
const EXPLOSION_FRAME_HEIGHT = 64;
const EXPLOSION_DURATION = 500;
const TERRAIN_MAX_HEIGHT_VARIATION = 0.08; // Giảm độ nhấp nhô tối đa (8% chiều cao màn hình)
const TERRAIN_SMOOTHNESS = 0.6;       // Tăng độ mượt (0 -> 1, càng cao càng ít bị ảnh hưởng bởi random)
const HOLD_INTERVAL = 50;             // ms - Tốc độ lặp lại khi giữ nút

// --- Ammo Types ---
const AMMO_TYPES = {
    'normal': { name: 'Thường', damage: 30, radius: 30, cost: 0 },
    'heavy': { name: 'Nặng', damage: 50, radius: 45, cost: 10 },
    // 'scatter': { name: 'Chùm', damage: 15, radius: 20, count: 3, spread: 15, cost: 20, type: 'scatter' } // Uncomment nếu muốn dùng đạn chùm
};
const AMMO_ORDER = ['normal', 'heavy']; // Thứ tự để duyệt qua

// --- Game State Variables ---
let playerTank;
let enemyTank;
let projectiles = [];
let explosions = [];
let terrain = [];
let obstacles = []; // Không dùng trực tiếp, tích hợp vào địa hình
let currentPlayer = 'player';
let score = 0;
let currentLevel = 1;
let highScore = 0;
let wind = 0;
let isFiring = false; // True khi đạn đang bay hoặc AI đang chuẩn bị bắn (sau khi tính toán)
let gameIsOver = false;
let currentAmmoIndex = 0;
let levelConfigs = [];
let angleInterval = null; // ID cho interval chỉnh góc
let powerInterval = null; // ID cho interval chỉnh lực

// --- Asset Loading ---
let assets = {
    playerTankImg: new Image(),
    enemyTankImg: new Image(),
    backgroundImg: new Image(),
    explosionSpritesheet: new Image(),
    projectileImg: null,
    fireSound: new Audio(),
    explosionSound: new Audio(),
    backgroundMusic: new Audio(),
    hitSound: new Audio(),
};
let assetsLoaded = 0;
let totalAssets = 7; // 3 ảnh, 4 âm thanh (nếu có đủ file)

function loadAssets(callback) {
    console.log("Loading assets...");
    let loadedCount = 0;
    // Cập nhật totalAssets dựa trên số lượng bạn thực sự có
    totalAssets = 6; // Ví dụ: 3 ảnh (tank P, tank E, explode) + 3 âm thanh (fire, explode, hit)

    function assetLoaded() {
        loadedCount++;
        console.log(`Loaded ${loadedCount}/${totalAssets}`);
        if (loadedCount === totalAssets) {
            console.log("All assets loaded!");
            // assets.backgroundMusic.loop = true;
            // assets.backgroundMusic.volume = 0.3;
            // assets.backgroundMusic.play().catch(e => console.warn("BG Music play failed:", e));
            callback();
        }
    }

    function assetError(e) {
        console.error("Error loading asset:", e.target.src || e.target);
        assetLoaded(); // Vẫn tăng count để game bắt đầu dù lỗi
    }

    assets.playerTankImg.src = 'assets/images/tank_player.png';
    assets.playerTankImg.onload = assetLoaded;
    assets.playerTankImg.onerror = assetError;

    assets.enemyTankImg.src = 'assets/images/tank_enemy.png';
    assets.enemyTankImg.onload = assetLoaded;
    assets.enemyTankImg.onerror = assetError;

    // Bỏ ảnh nền để tập trung vào game chính, bạn có thể thêm lại nếu muốn
    // assets.backgroundImg.src = 'assets/images/background.png';
    // assets.backgroundImg.onload = assetLoaded;
    // assets.backgroundImg.onerror = assetError;
    // totalAssets = 7; // Nếu dùng ảnh nền

    assets.explosionSpritesheet.src = 'assets/images/explosion_sheet.png';
    assets.explosionSpritesheet.onload = assetLoaded;
    assets.explosionSpritesheet.onerror = assetError;

    assets.fireSound.src = 'assets/sounds/fire.wav';
    assets.fireSound.oncanplaythrough = assetLoaded;
    assets.fireSound.onerror = assetError;
    assets.fireSound.load();

    assets.explosionSound.src = 'assets/sounds/explosion.wav';
    assets.explosionSound.oncanplaythrough = assetLoaded;
    assets.explosionSound.onerror = assetError;
    assets.explosionSound.load();

    assets.hitSound.src = 'assets/sounds/hit.wav';
    assets.hitSound.oncanplaythrough = assetLoaded;
    assets.hitSound.onerror = assetError;
    assets.hitSound.load();

    // assets.backgroundMusic.src = 'assets/sounds/background_music.mp3';
    // assets.backgroundMusic.oncanplaythrough = assetLoaded;
    // assets.backgroundMusic.onerror = assetError;
    // assets.backgroundMusic.load();

    console.log("Asset loading initiated...");
}


// --- Game Object Classes ---

class Tank {
    constructor(x, y, width, height, color, image, isPlayer = true) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.image = image;
        this.isPlayer = isPlayer;
        this.angle = isPlayer ? 45 : 135;
        this.power = 50;
        this.barrelPivotX = 0;
        this.barrelPivotY = -this.height * 0.6;
        this.health = 100;
        this.currentTerrainY = y;
    }

    draw(ctx) {
        const drawX = this.x - this.width / 2;
        const drawY = this.currentTerrainY - this.height;

        // Draw Barrel
        ctx.save();
        // Tính toán vị trí gốc nòng súng trên canvas
        const barrelRootCanvasX = this.x + this.barrelPivotX;
        // Tọa độ Y của điểm pivot trên thân xe tăng (tính từ đỉnh xe tăng)
        const pivotCanvasY = drawY - this.barrelPivotY;

        ctx.translate(barrelRootCanvasX, pivotCanvasY);

        let displayAngle = this.isPlayer ? this.angle : (180 - this.angle);
        ctx.rotate(-displayAngle * Math.PI / 180);
        ctx.fillStyle = '#555';
        ctx.fillRect(0, -BARREL_THICKNESS / 2, BARREL_LENGTH, BARREL_THICKNESS);
        ctx.restore();

        // Draw Tank Body
        if (this.image && this.image.complete && this.image.naturalHeight !== 0) {
            ctx.drawImage(this.image, drawX, drawY, this.width, this.height);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(drawX, drawY, this.width, this.height);
        }

        // Draw Health Bar
        const healthBarWidth = this.width * 0.8;
        const healthBarHeight = 6;
        const healthBarX = this.x - healthBarWidth / 2;
        const healthBarY = drawY - healthBarHeight - 4;
        ctx.fillStyle = '#ff4d4d';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        ctx.fillStyle = '#4dff4d';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth * Math.max(0, this.health / 100), healthBarHeight);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    }

    updatePositionOnTerrain(terrainPoints) {
         this.currentTerrainY = getTerrainHeightAt(this.x, terrainPoints);
         this.currentTerrainY = Math.min(this.currentTerrainY, canvas.height);
    }

    move(direction, terrainPoints) {
        if (isFiring || gameIsOver) return;
        const nextX = this.x + direction * MOVE_SPEED;
        const tankHalfWidth = this.width / 2;
        if (nextX - tankHalfWidth < 0 || nextX + tankHalfWidth > canvas.width) return;

        const currentY = this.currentTerrainY;
        const nextTerrainY = getTerrainHeightAt(nextX, terrainPoints);
        const slope = Math.abs(nextTerrainY - currentY) / Math.abs(nextX - this.x);

        if (slope < 1.5) {
             this.x = nextX;
             this.updatePositionOnTerrain(terrainPoints);
        } else {
            console.log("Slope too steep!");
        }
    }

    adjustAngle(amount) {
        if (isFiring || gameIsOver) return;
        let newAngle = this.angle + amount;
        if (this.isPlayer) {
            this.angle = Math.max(MIN_ANGLE, Math.min(90, newAngle));
        } else {
             this.angle = Math.max(91, Math.min(MAX_ANGLE, newAngle));
        }
        updateUI(); // Cập nhật hiển thị ngay lập tức
    }

    adjustPower(amount) {
        if (isFiring || gameIsOver) return;
        this.power += amount;
        this.power = Math.max(MIN_POWER, Math.min(MAX_POWER, this.power));
        updateUI(); // Cập nhật hiển thị ngay lập tức
    }

    getBarrelEnd() {
         const drawX = this.x - this.width / 2;
         const drawY = this.currentTerrainY - this.height;
         const barrelRootCanvasX = this.x + this.barrelPivotX;
         const pivotCanvasY = drawY - this.barrelPivotY;

        let fireAngle = this.isPlayer ? this.angle : (180 - this.angle);
        const angleRad = -fireAngle * Math.PI / 180;

        const barrelEndX = barrelRootCanvasX + Math.cos(angleRad) * BARREL_LENGTH;
        const barrelEndY = pivotCanvasY + Math.sin(angleRad) * BARREL_LENGTH;
        return { x: barrelEndX, y: barrelEndY };
    }

    takeDamage(amount) {
        this.health -= amount;
        this.health = Math.max(0, this.health);
        playSound(assets.hitSound);
        if (this.health <= 0) {
             console.log(`${this.isPlayer ? 'Player' : 'Enemy'} tank destroyed!`);
        }
    }
}

class Projectile {
    constructor(x, y, vx, vy, ammoData) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 5;
        this.trail = [];
        this.trailLength = 15;
        this.ammoData = ammoData;
        this.owner = (currentPlayer === 'player') ? playerTank : enemyTank;
    }

    update(wind, terrainPoints) {
        this.x += this.vx;
        this.y += this.vy;
        this.vx += wind / 60;
        this.vy += GRAVITY;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailLength) {
            this.trail.shift();
        }
        return this.checkCollisions(terrainPoints);
    }

     checkCollisions(terrainPoints) {
         const terrainY = getTerrainHeightAt(this.x, terrainPoints);
         if (this.y >= terrainY) {
             return { hit: true, target: 'terrain', point: {x: this.x, y: terrainY} };
         }
         const targetTank = (this.owner === playerTank) ? enemyTank : playerTank;
         if (checkCollisionCircleRect(this, targetTank)) {
             return { hit: true, target: targetTank, point: {x: this.x, y: this.y} };
         }
         if (this.x < -this.radius || this.x > canvas.width + this.radius || this.y > canvas.height + this.radius || this.y < -canvas.height * 2) { // Tăng giới hạn trên
              return { hit: true, target: 'outofbounds', point: {x: this.x, y: this.y} };
         }
         return { hit: false };
     }

    draw(ctx) {
        // Draw trail
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                const alpha = (i / this.trail.length) * 0.5;
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                // Vẽ bằng lineTo thay vì quadraticCurveTo để đơn giản
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
             ctx.lineWidth = 3;
             ctx.stroke();
        }

        // Draw projectile
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Explosion {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.startTime = Date.now();
        this.duration = EXPLOSION_DURATION;
        this.currentFrame = 0;
        this.frameWidth = EXPLOSION_FRAME_WIDTH;
        this.frameHeight = EXPLOSION_FRAME_HEIGHT;
        this.totalFrames = EXPLOSION_FRAMES;
        this.spriteSheet = assets.explosionSpritesheet;
        this.active = true;
    }

    update() {
        const elapsedTime = Date.now() - this.startTime;
        if (elapsedTime >= this.duration) {
            this.active = false;
            return;
        }
        this.currentFrame = Math.floor((elapsedTime / this.duration) * this.totalFrames);
        this.currentFrame = Math.min(this.currentFrame, this.totalFrames - 1);
    }

    draw(ctx) {
        if (!this.active || !this.spriteSheet || !this.spriteSheet.complete || this.spriteSheet.naturalHeight === 0) return;
        const frameX = (this.currentFrame % this.totalFrames) * this.frameWidth;
        const frameY = 0; // Giả sử spritesheet chỉ có 1 hàng
        ctx.drawImage(
            this.spriteSheet,
            frameX, frameY, this.frameWidth, this.frameHeight,
            this.x - this.frameWidth / 2, this.y - this.frameHeight / 2,
            this.frameWidth, this.frameHeight
        );
    }
}

// --- Helper Functions ---

function playSound(sound) {
    if (sound && sound.readyState >= 3) {
        sound.currentTime = 0;
        sound.play().catch(e => console.warn("Sound play interrupted:", e));
    }
}

function checkCollisionCircleRect(circle, rectTank) {
    if (!rectTank) return false; // Kiểm tra nếu tank không tồn tại
    const rectX = rectTank.x - rectTank.width / 2;
    const rectY = rectTank.currentTerrainY - rectTank.height;
    const rectWidth = rectTank.width;
    const rectHeight = rectTank.height;

    const closestX = Math.max(rectX, Math.min(circle.x, rectX + rectWidth));
    const closestY = Math.max(rectY, Math.min(circle.y, rectY + rectHeight));

    const distX = circle.x - closestX;
    const distY = circle.y - closestY;
    const distanceSquared = (distX * distX) + (distY * distY);

    return distanceSquared < (circle.radius * circle.radius);
}

function getTerrainHeightAt(x, terrainPoints) {
    if (terrainPoints.length < 2) return canvas.height; // Mặc định nếu địa hình chưa có

    let p1 = null, p2 = null;
    for (let i = 0; i < terrainPoints.length - 1; i++) {
        if (x >= terrainPoints[i].x && x <= terrainPoints[i+1].x) {
            p1 = terrainPoints[i];
            p2 = terrainPoints[i+1];
            break;
        }
    }

    if (x < terrainPoints[0].x) return terrainPoints[0].y;
    if (x > terrainPoints[terrainPoints.length - 1].x) return terrainPoints[terrainPoints.length - 1].y;
    if (!p1 || !p2) return canvas.height; // Fallback

    if (p2.x === p1.x) return p1.y;
    const ratio = (x - p1.x) / (p2.x - p1.x);
    return p1.y + ratio * (p2.y - p1.y);
}

// Tạo địa hình ngẫu nhiên nhấp nhô (ĐÃ ĐIỀU CHỈNH ĐỂ MƯỢT HƠN)
function generateTerrain(width, height) {
    console.log("Generating smoother terrain...");
    const points = [];
    const segments = Math.ceil(width / TERRAIN_RESOLUTION);
    let currentY = height * (0.75 + Math.random() * 0.15);
    const maxStepVariation = height * TERRAIN_MAX_HEIGHT_VARIATION / 5;

    points.push({ x: 0, y: currentY });
    let trend = (Math.random() - 0.5) * 0.1;

    for (let i = 1; i <= segments; i++) {
        const x = i * TERRAIN_RESOLUTION;
        trend += (Math.random() - 0.5) * 0.05;
        trend = Math.max(-0.8, Math.min(0.8, trend));
        let yVariation = trend * maxStepVariation + (Math.random() - 0.5) * maxStepVariation * 0.5;
        let nextY = currentY + yVariation;
        nextY = Math.max(height * 0.35, Math.min(height * 0.95, nextY));
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
    console.log(`Destroying terrain at (${centerX.toFixed(0)}, ${centerY.toFixed(0)}) with radius ${radius}`);
    const radiusSq = radius * radius;
    let changed = false;

    for (let i = 0; i < terrainPoints.length; i++) {
        const p = terrainPoints[i];
        const dx = p.x - centerX;
        // Chỉ phá hủy đất bên dưới điểm nổ Y một chút, không phá hủy quá cao
        if (p.y < centerY - radius * 0.5) continue;

        const dy = p.y - centerY;
        const distSq = dx * dx + dy * dy;

        if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq);
            // Hạ thấp điểm địa hình, hiệu ứng mạnh hơn ở gần tâm và giảm dần ra xa
            // Sử dụng hàm cos để tạo miệng hố tròn hơn
             const destructionFactor = Math.cos((dist / radius) * (Math.PI / 2)); // 1 tại tâm, 0 tại rìa
             const depth = radius * 0.7 * destructionFactor; // Độ sâu tối đa ở tâm
             const newY = p.y + depth; // Hạ điểm xuống

            // Giới hạn độ sâu tối đa để tránh vực thẳm
             p.y = Math.min(newY, canvas.height + 50);
            changed = true;
        }
    }
     if (changed) console.log("Terrain modified.");
}


// --- Game Logic Functions ---

function defineLevels() {
    levelConfigs = [
        { windRange: 2, terrainVariation: 0.1, enemyHealth: 100, enemyAimAccuracy: 0.6, playerStartX: 0.15, enemyStartX: 0.85 },
        { windRange: 4, terrainVariation: 0.15, enemyHealth: 120, enemyAimAccuracy: 0.75, playerStartX: 0.1, enemyStartX: 0.9 },
        { windRange: MAX_WIND_SPEED, terrainVariation: 0.2, enemyHealth: 150, enemyAimAccuracy: 0.85, playerStartX: 0.2, enemyStartX: 0.8 },
        { windRange: 3, terrainVariation: 0.25, enemyHealth: 130, enemyAimAccuracy: 0.80, playerStartX: 0.15, enemyStartX: 0.8 },
    ];
}

function initGame() {
    console.log("Initializing game...");
    defineLevels();
    loadSavedData();
    resizeCanvas(); // Resize trước khi setup level

    score = 0;
    gameIsOver = false;
    isFiring = false;
    projectiles = [];
    explosions = [];
    currentAmmoIndex = 0;

    if (gameOverOverlay) gameOverOverlay.style.display = 'none';

    setupLevel(currentLevel); // Setup level sau khi resize
    setupControls(); // Setup controls sau khi có tank

    // if (assets.backgroundMusic && assets.backgroundMusic.paused) {
    //     assets.backgroundMusic.play().catch(e => console.warn("BG Music play failed on init:", e));
    // }

    lastTime = performance.now(); // Khởi tạo lastTime cho gameLoop
    gameLoop(lastTime); // Bắt đầu vòng lặp game
    console.log("Game initialized and loop started.");
}

function loadSavedData() {
    highScore = parseInt(localStorage.getItem('tankGameHighScore') || '0');
    currentLevel = parseInt(localStorage.getItem('tankGameLevel') || '1');
    currentLevel = Math.min(currentLevel, levelConfigs.length);
    currentLevel = Math.max(1, currentLevel);
    if (highScoreElement) highScoreElement.textContent = highScore;
    console.log(`Loaded High Score: ${highScore}, Starting Level: ${currentLevel}`);
}

function saveGameData() {
    localStorage.setItem('tankGameHighScore', highScore);
    localStorage.setItem('tankGameLevel', currentLevel);
    console.log(`Saved High Score: ${highScore}, Level: ${currentLevel}`);
}


function resizeCanvas() {
    const wrapper = document.getElementById('game-wrapper');
    const controlsElement = document.getElementById('controls');
    const infoElement = document.getElementById('game-info');

    // Lấy chiều cao thực tế của controls và info nếu chúng tồn tại
    const controlsHeight = controlsElement ? controlsElement.offsetHeight : 0;
    const infoHeight = infoElement ? infoElement.offsetHeight : 0;

    const availableWidth = wrapper.clientWidth;
    const availableHeight = window.innerHeight - controlsHeight - infoHeight - 40;

    let canvasWidth = availableWidth;
    let canvasHeight = canvasWidth * (3 / 4); // Giữ tỷ lệ 4:3

    if (canvasHeight > availableHeight) {
        canvasHeight = availableHeight;
        canvasWidth = canvasHeight * (4 / 3);
    }
    canvasWidth = Math.min(canvasWidth, availableWidth);

    canvas.width = Math.max(320, Math.floor(canvasWidth)); // Kích thước tối thiểu
    canvas.height = Math.max(240, Math.floor(canvasHeight));

    console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);

    // Nếu game đang chạy, setup lại level để điều chỉnh vị trí
    if (playerTank && !gameIsOver) {
        console.log("Re-setting up level due to resize...");
        // Lưu lại trạng thái hiện tại (máu, điểm?) trước khi setup lại nếu cần
        const pHealth = playerTank.health;
        const eHealth = enemyTank.health;
        setupLevel(currentLevel);
        playerTank.health = pHealth; // Khôi phục máu
        enemyTank.health = eHealth;
        updateUI(); // Cập nhật lại UI
        if(currentPlayer === 'player') toggleControls(true); // Bật lại control nếu là lượt player
    } else {
         drawBackground(); // Chỉ vẽ nền nếu game chưa bắt đầu hoặc đã kết thúc
    }
}

function drawBackground() {
    // Vẽ nền màu đơn giản thay vì ảnh
    ctx.fillStyle = '#87CEEB'; // Màu trời
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Bạn có thể thêm gradient hoặc các yếu tố nền khác ở đây
}

function setupLevel(levelNumber) {
    console.log(`Setting up level ${levelNumber}`);
    const config = levelConfigs[levelNumber - 1] || levelConfigs[0];

    terrain = generateTerrain(canvas.width, canvas.height);

    const placeTank = (startXRatio, tankWidth, tankHeight, color, image, isPlayer) => {
        let tankX = canvas.width * startXRatio;
        let tankY = getTerrainHeightAt(tankX, terrain);
        let attempts = 0;
        const maxAttempts = 15; // Tăng số lần thử

        while (attempts < maxAttempts) {
            const checkXLeft = Math.max(0, tankX - tankWidth / 2);
            const checkXRight = Math.min(canvas.width, tankX + tankWidth / 2);
            const yLeft = getTerrainHeightAt(checkXLeft, terrain);
            const yRight = getTerrainHeightAt(checkXRight, terrain);
            const slope = Math.abs(yRight - yLeft) / (checkXRight - checkXLeft + 1); // Tránh chia 0

            if (slope < 0.8) { // Yêu cầu độ dốc thấp hơn
                break;
            }
            // Dịch chuyển nhiều hơn nếu dốc
            tankX += (Math.random() < 0.5 ? -1 : 1) * tankWidth * (0.6 + Math.random()*0.4) ;
            tankX = Math.max(tankWidth / 2 + 5, Math.min(canvas.width - tankWidth / 2 - 5, tankX)); // Thêm padding biên
            tankY = getTerrainHeightAt(tankX, terrain);
            attempts++;
        }
         if (attempts >= maxAttempts) {
             console.warn(`Could not find a suitable flat spot. Placing anyway.`);
             tankX = canvas.width * startXRatio;
             tankY = getTerrainHeightAt(tankX, terrain);
         }

        const newTank = new Tank(tankX, tankY, tankWidth, tankHeight, color, image, isPlayer);
        newTank.updatePositionOnTerrain(terrain);
        return newTank;
    };

    playerTank = placeTank(config.playerStartX, TANK_WIDTH, TANK_HEIGHT, 'blue', assets.playerTankImg, true);
    enemyTank = placeTank(config.enemyStartX, ENEMY_TANK_WIDTH, ENEMY_TANK_HEIGHT, 'red', assets.enemyTankImg, false);

    enemyTank.health = config.enemyHealth;
    wind = (Math.random() - 0.5) * 2 * config.windRange;
    currentPlayer = 'player';
    isFiring = false;
    projectiles = [];
    explosions = [];
    gameIsOver = false;

    updateUI();
    toggleControls(true);
    console.log("Level setup complete.");
}

// Hàm dừng các interval đang chạy (khi nhả nút hoặc đổi lượt)
function stopIntervals() {
    if (angleInterval) {
        clearInterval(angleInterval);
        angleInterval = null;
    }
    if (powerInterval) {
        clearInterval(powerInterval);
        powerInterval = null;
    }
}

// Quản lý listener để tránh thêm nhiều lần
const controlListeners = {};
function removeAllControlListeners() {
    for (const id in controlListeners) {
        const el = document.getElementById(id);
        if (el && controlListeners[id]) {
            controlListeners[id].forEach(({ event, handler, options }) => {
                el.removeEventListener(event, handler, options);
            });
        }
    }
    // Reset object
    for (const key in controlListeners) {
        delete controlListeners[key];
    }
     // Remove keydown listener
     window.onkeydown = null;
     console.log("Removed existing control listeners.");
}

function addControlListener(id, event, handler, options = { passive: false }) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, handler, options);
        if (!controlListeners[id]) {
            controlListeners[id] = [];
        }
        controlListeners[id].push({ event, handler, options });
    } else {
         console.warn(`Element with ID ${id} not found for listener.`);
    }
}


// Cập nhật setupControls để xử lý giữ nút và quản lý listener
function setupControls() {
    console.log("Setting up controls with hold functionality...");
    removeAllControlListeners(); // Xóa listener cũ trước khi thêm mới
    stopIntervals();

    const setupHoldableButton = (buttonId, action) => {
        const button = document.getElementById(buttonId);
        if (!button) return;

        let intervalId = null;
        const startAction = (e) => {
             // Chỉ bắt đầu nếu là nút chính (tránh chuột phải), không bị disable, là lượt player và không đang bắn
            if (e.button !== 0 || intervalId || button.disabled || currentPlayer !== 'player' || isFiring) return;
            e.preventDefault();
            e.stopPropagation();
            action();
            // Clear interval cũ nếu có (phòng trường hợp hiếm)
            if(intervalId) clearInterval(intervalId);
            intervalId = setInterval(action, HOLD_INTERVAL);
            // Lưu intervalId để có thể clear từ bên ngoài nếu cần
            if (buttonId.includes('angle')) angleInterval = intervalId;
            else if (buttonId.includes('power')) powerInterval = intervalId;
        };

        const stopAction = (e) => {
             // Chỉ dừng nếu interval đang chạy
            if (intervalId) {
                 // Không cần preventDefault ở đây vì không có hành vi mặc định cần chặn khi nhả nút
                 // e.preventDefault();
                 // e.stopPropagation(); // Có thể cần nếu có listener khác bên ngoài
                clearInterval(intervalId);
                intervalId = null;
                if (buttonId.includes('angle')) angleInterval = null;
                else if (buttonId.includes('power')) powerInterval = null;
            }
        };

        addControlListener(buttonId, 'pointerdown', startAction);
        addControlListener(buttonId, 'pointerup', stopAction);
        addControlListener(buttonId, 'pointerleave', stopAction); // Dừng khi rời nút
         addControlListener(buttonId, 'contextmenu', e => {e.preventDefault(); stopAction(e);}); // Chặn menu chuột phải và dừng interval
    };

    setupHoldableButton('btn-angle-down', () => playerTank.adjustAngle(-ANGLE_STEP));
    setupHoldableButton('btn-angle-up', () => playerTank.adjustAngle(ANGLE_STEP));
    setupHoldableButton('btn-power-down', () => playerTank.adjustPower(-POWER_STEP));
    setupHoldableButton('btn-power-up', () => playerTank.adjustPower(POWER_STEP));

    // Các nút không cần giữ (ấn 1 lần)
    const addSingleActionListener = (buttonId, action) => {
        addControlListener(buttonId, 'pointerdown', (e) => {
             if (e.button !== 0 || document.getElementById(buttonId).disabled || isFiring) return; // Nút chính, ko disable, ko đang bắn
             e.preventDefault();
             e.stopPropagation();
             action();
         });
    };

    addSingleActionListener('btn-move-left', () => playerTank.move(-1, terrain));
    addSingleActionListener('btn-move-right', () => playerTank.move(1, terrain));
    addSingleActionListener('btn-fire', handleFire);
    addSingleActionListener('btn-ammo-prev', selectPrevAmmo);
    addSingleActionListener('btn-ammo-next', selectNextAmmo);

    // Bàn phím
    window.onkeydown = (e) => {
        if (currentPlayer !== 'player' || gameIsOver) return; // Cho phép chỉnh khi đang bắn, nhưng không cho bắn/di chuyển

         // Các hành động cho phép lặp lại khi giữ phím
         if (e.key === 'ArrowUp') { if(!isFiring) playerTank.adjustAngle(ANGLE_STEP); e.preventDefault(); return; }
         if (e.key === 'ArrowDown') { if(!isFiring) playerTank.adjustAngle(-ANGLE_STEP); e.preventDefault(); return; }
         if (e.key === 'PageUp') { if(!isFiring) playerTank.adjustPower(POWER_STEP); e.preventDefault(); return; }
         if (e.key === 'PageDown') { if(!isFiring) playerTank.adjustPower(-POWER_STEP); e.preventDefault(); return; }

         // Các hành động chỉ thực hiện 1 lần mỗi lần nhấn (ngăn lặp)
         if (e.repeat) return; // Thoát nếu phím đang được giữ và đã xử lý lần đầu

        let handled = true;
        switch (e.key) {
            case 'ArrowLeft': if(!isFiring) playerTank.move(-1, terrain); break;
            case 'ArrowRight': if(!isFiring) playerTank.move(1, terrain); break;
            case 'q': case 'Q': if(!isFiring) selectPrevAmmo(); break;
            case 'e': case 'E': if(!isFiring) selectNextAmmo(); break;
            case ' ': case 'Enter': if(!isFiring) handleFire(); break; // Chỉ bắn khi không đang bắn
            default: handled = false;
        }
        if (handled) e.preventDefault();
    };

    // Listener resize giữ nguyên cách thêm cũ vì nó không cần xóa/thêm lại thường xuyên
    window.addEventListener('resize', resizeCanvas);
    console.log("Controls setup complete.");
}


function selectPrevAmmo() {
    if (isFiring || gameIsOver || currentPlayer !== 'player') return;
    currentAmmoIndex--;
    if (currentAmmoIndex < 0) currentAmmoIndex = AMMO_ORDER.length - 1;
    updateUI();
}

function selectNextAmmo() {
     if (isFiring || gameIsOver || currentPlayer !== 'player') return;
    currentAmmoIndex++;
    if (currentAmmoIndex >= AMMO_ORDER.length) currentAmmoIndex = 0;
    updateUI();
}

function updateUI() {
    if (!playerTank || !enemyTank) return;
    const currentAmmoKey = AMMO_ORDER[currentAmmoIndex];
    const ammoData = AMMO_TYPES[currentAmmoKey];

    if (scoreElement) scoreElement.textContent = score;
    if (levelElement) levelElement.textContent = currentLevel;
    if (playerTurnElement) playerTurnElement.textContent = `Lượt của: ${currentPlayer === 'player' ? 'Bạn' : 'Đối thủ'}`;
    if (angleDisplay) angleDisplay.textContent = playerTank.angle.toFixed(0);
    if (powerDisplay) powerDisplay.textContent = playerTank.power.toFixed(0);
    if (ammoTypeElement) ammoTypeElement.textContent = ammoData.name;
    if (ammoDisplayElement) ammoDisplayElement.textContent = ammoData.name;
    if (windSpeedElement) windSpeedElement.textContent = Math.abs(wind).toFixed(1);
    if (windDirectionElement) windDirectionElement.textContent = wind === 0 ? '-' : (wind > 0 ? '->' : '<-');
    if (highScoreElement) highScoreElement.textContent = highScore;
}

function handleFire() {
    if (isFiring || gameIsOver || currentPlayer !== 'player') return; // Kiểm tra lại

    const ammoKey = AMMO_ORDER[currentAmmoIndex];
    const ammoData = AMMO_TYPES[ammoKey];
    if (ammoData.cost > score) {
         console.log("Không đủ điểm!"); // Thêm phản hồi rõ hơn
         // Có thể hiển thị thông báo ngắn trên màn hình
         return;
    }
    score -= ammoData.cost;
    fire(playerTank, ammoData);
    updateUI();
}

function fire(tank, ammoData) {
    if (isFiring || gameIsOver) {
        console.warn("Attempted to fire while already firing or game over.");
        return;
    }
    console.log(`${tank.isPlayer ? 'Player' : 'AI'} firing ${ammoData.name}! Angle: ${tank.angle.toFixed(1)}, Power: ${tank.power.toFixed(1)}`);
    isFiring = true; // ****** Quan trọng: Đặt isFiring = true NGAY LẬP TỨC ******

    const barrelEnd = tank.getBarrelEnd();
    let fireAngle = tank.isPlayer ? tank.angle : (180 - tank.angle);
    const angleRad = -fireAngle * Math.PI / 180;
    const initialVelocity = tank.power / 6 + 2;
    const vx = Math.cos(angleRad) * initialVelocity;
    const vy = Math.sin(angleRad) * initialVelocity;

    // Xử lý đạn chùm (nếu có type: 'scatter')
    if (ammoData.type === 'scatter' && ammoData.count > 1) {
         const spreadAngle = ammoData.spread * Math.PI / 180;
         for (let i = 0; i < ammoData.count; i++) {
             const angleOffset = (Math.random() - 0.5) * spreadAngle;
             const currentAngleRad = angleRad + angleOffset;
             const currentVx = Math.cos(currentAngleRad) * initialVelocity * (0.9 + Math.random() * 0.2); // Vận tốc hơi khác
             const currentVy = Math.sin(currentAngleRad) * initialVelocity * (0.9 + Math.random() * 0.2);
             projectiles.push(new Projectile(barrelEnd.x, barrelEnd.y, currentVx, currentVy, ammoData));
         }
    } else {
         projectiles.push(new Projectile(barrelEnd.x, barrelEnd.y, vx, vy, ammoData));
    }

    playSound(assets.fireSound);
    toggleControls(false); // Tắt điều khiển ngay khi bắn
}

function toggleControls(enabled) {
    const buttons = document.querySelectorAll('#controls button');
    buttons.forEach(button => {
        if(button) button.disabled = !enabled;
    });
    // Nếu disable, dừng các interval đang chạy (phòng trường hợp)
     if (!enabled) {
         stopIntervals();
     }
}

let turnSwitchTimeout = null; // ID cho timeout đổi lượt
function update(deltaTime) {
    if (gameIsOver) return;

    // Cập nhật vị trí tank (quan trọng nếu địa hình thay đổi)
    if (playerTank) playerTank.updatePositionOnTerrain(terrain);
    if (enemyTank) enemyTank.updatePositionOnTerrain(terrain);

    // --- Cập nhật đạn và xử lý va chạm ---
    let projectilesStillFlying = false;
    if (projectiles.length > 0) {
         projectilesStillFlying = true; // Ban đầu giả định còn đạn
         for (let i = projectiles.length - 1; i >= 0; i--) {
             const p = projectiles[i];
             if (!p) continue; // Kiểm tra nếu đạn bị null/undefined (hiếm)

             const collisionResult = p.update(wind, terrain);

             if (collisionResult.hit) {
                 const hitPoint = collisionResult.point;
                 const ammoData = p.ammoData;
                 const explosionRadius = ammoData.radius;

                 // Xóa đạn khỏi mảng NGAY LẬP TỨC
                 projectiles.splice(i, 1);
                 console.log(`Projectile hit: ${collisionResult.target}. Remaining: ${projectiles.length}`);

                 // Xử lý nổ và sát thương
                 createExplosion(hitPoint.x, hitPoint.y, explosionRadius);
                 playSound(assets.explosionSound);
                 destroyTerrain(hitPoint.x, hitPoint.y, explosionRadius, terrain);

                 if (collisionResult.target instanceof Tank) {
                      const targetTank = collisionResult.target;
                      const damage = ammoData.damage + (Math.random() - 0.5) * 10;
                      targetTank.takeDamage(damage);

                      if (p.owner === playerTank && targetTank === enemyTank) {
                           score += Math.round(damage);
                           if (enemyTank.health <= 0) {
                                score += 100; // Thưởng hạ gục
                                updateUI();
                                // Dừng update và chuyển level/kết thúc
                                console.log("Enemy destroyed! Scheduling next level.");
                                setTimeout(() => nextLevelOrEndGame(true), 1200); // Thời gian chờ ngắn hơn chút
                                return;
                           }
                            updateUI(); // Cập nhật điểm ngay
                      } else if (p.owner === enemyTank && targetTank === playerTank) {
                           if (playerTank.health <= 0) {
                                console.log("Player destroyed! Scheduling game over.");
                                setTimeout(() => gameOver(false), 1200);
                                return;
                           }
                      }
                 } // Kết thúc xử lý trúng tank

                 // Quan trọng: sau khi xóa đạn, chỉ cần break hoặc tiếp tục vòng lặp từ i-- (đã làm do for ngược)
                 // Không cần làm gì thêm trong lần lặp này cho viên đạn đã va chạm

             } // Kết thúc xử lý nếu hit = true
         } // Kết thúc vòng lặp for projectiles

        // Kiểm tra lại xem còn đạn không SAU vòng lặp
         if (projectiles.length === 0) {
              projectilesStillFlying = false;
         }

    } // Kết thúc if (projectiles.length > 0)

    // --- Quyết định chuyển lượt ---
    // Nếu TRƯỚC ĐÓ đang bắn (isFiring=true) VÀ BÂY GIỜ không còn đạn bay (!projectilesStillFlying)
    // thì mới lên lịch chuyển lượt.
    if (isFiring && !projectilesStillFlying) {
        // Hủy timeout cũ nếu có (tránh gọi switchTurn nhiều lần)
        if (turnSwitchTimeout) clearTimeout(turnSwitchTimeout);

        console.log("Last projectile finished, scheduling turn switch...");
        // ****** Đặt isFiring = false NGAY KHI lên lịch chuyển lượt ******
        // Điều này cho phép AI bắt đầu tính toán ngay lập tức nếu đến lượt nó
        // Hoặc cho phép người chơi chỉnh góc/lực ngay sau khi đạn nổ
        isFiring = false;
        turnSwitchTimeout = setTimeout(switchTurn, 800); // Chờ 0.8s sau vụ nổ cuối
    }


    // --- Logic cho lượt AI ---
    // Gọi aiTurn nếu đến lượt AI VÀ game không kết thúc VÀ không đang trong quá trình bắn/chuyển lượt (isFiring = false)
    if (currentPlayer === 'ai' && !isFiring && !gameIsOver) {
        aiTurn(); // AI sẽ tự đặt isFiring = true khi nó bắt đầu bắn
    }


    // Cập nhật hiệu ứng nổ
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].update();
        if (!explosions[i].active) {
            explosions.splice(i, 1);
        }
    }
}


function nextLevelOrEndGame(playerWon) {
    if (gameIsOver) return; // Tránh xử lý nếu game đã kết thúc rồi

    if (!playerWon) {
        gameOver(false);
        return;
    }

    console.log(`Level ${currentLevel} cleared! Score: ${score}`);
    currentLevel++;
    if (currentLevel > levelConfigs.length) {
        gameOver(true, `Tất cả Level Hoàn Thành! Điểm: ${score}`);
    } else {
        saveGameData(); // Lưu level mới và điểm cao (nếu có)
        console.log(`Moving to level ${currentLevel}`);
        // Hiển thị thông báo chuyển level (tùy chọn)
        // showBriefMessage(`Level ${currentLevel}`);
        setupLevel(currentLevel);
    }
}

function createExplosion(x, y, radius) {
    console.log(`Creating explosion at ${x.toFixed(1)}, ${y.toFixed(1)} r:${radius}`);
    explosions.push(new Explosion(x, y, radius));
}

function switchTurn() {
    // Hàm này chỉ được gọi bởi setTimeout sau khi đạn cuối cùng đã nổ
    if (gameIsOver) return;
    if (projectiles.length > 0) {
        console.warn("Switch turn called while projectiles still flying - Aborting.");
        isFiring = true; // Đảm bảo isFiring đúng nếu còn đạn
        return;
    }
     if (isFiring) {
        console.warn("Switch turn called while isFiring is still true - Aborting.");
        return; // Không đổi lượt nếu isFiring vẫn true (lỗi logic ở đâu đó?)
     }

    console.log("Executing switchTurn...");
    turnSwitchTimeout = null; // Xóa ID timeout
    stopIntervals(); // Dừng chỉnh góc/lực

    currentPlayer = (currentPlayer === 'player') ? 'ai' : 'player';
    updateUI();

    if (currentPlayer === 'player') {
        toggleControls(true);
        console.log("Switched to Player's turn. Controls enabled.");
    } else {
        toggleControls(false);
        console.log("Switched to AI's turn. Controls disabled.");
        // AI sẽ tự động chơi trong hàm update()
    }
}

let aiIsThinking = false; // Cờ ngăn AI tính toán nhiều lần trong 1 lượt
function aiTurn() {
    // Chỉ bắt đầu tính toán nếu đến lượt AI, không đang bắn, game chưa kết thúc, và chưa "nghĩ" xong
    if (currentPlayer !== 'ai' || isFiring || gameIsOver || aiIsThinking) return;

    console.log("AI's turn: Starting calculation...");
    aiIsThinking = true; // Đánh dấu AI đang tính toán
    toggleControls(false); // Đảm bảo controls tắt

    // --- Logic tính toán của AI (giữ nguyên) ---
    const config = levelConfigs[currentLevel - 1] || levelConfigs[0];
    const accuracy = config.enemyAimAccuracy;
    const dx = playerTank.x - enemyTank.x;
    const dy = playerTank.y - enemyTank.y;
    const g = GRAVITY;
    let bestAngle = 135, bestPower = 60, minError = Infinity;
    const powerIterations = 12, angleIterations = 18; // Tăng độ chính xác tính toán

    for (let p = MIN_POWER; p <= MAX_POWER; p += (MAX_POWER - MIN_POWER) / powerIterations) {
        for (let angle = 91; angle < MAX_ANGLE; angle += (MAX_ANGLE - 91) / angleIterations) {
            const angleRad = -(180 - angle) * Math.PI / 180;
            const v = p / 6 + 2;
            const vx = Math.cos(angleRad) * v;
            const vy = Math.sin(angleRad) * v;
            if (Math.abs(vx) < 0.01) continue;
            const t = dx / vx;
             if (t <= 0) continue;

             // Tính thêm ảnh hưởng của gió (ước lượng)
             const estimatedWindEffectX = 0.5 * (wind / 60) * t * t;
             const effectiveDx = dx - estimatedWindEffectX;
             const correctedT = effectiveDx / vx; // Ước tính thời gian bay mới có gió
             if (correctedT <= 0) continue;

             const predictedY = enemyTank.getBarrelEnd().y + vy * correctedT + 0.5 * g * correctedT * correctedT;
             const error = Math.abs(predictedY - playerTank.currentTerrainY);

            let hitsTerrainEarly = false;
            const terrainCheckSteps = 15;
             for(let step = 1; step <= terrainCheckSteps; step++) {
                  const timeStep = correctedT * (step / terrainCheckSteps);
                  const currentX = enemyTank.getBarrelEnd().x + vx * timeStep + 0.5 * (wind / 60) * timeStep * timeStep;
                  if (currentX < 0 || currentX > canvas.width) { hitsTerrainEarly = true; break; }
                  const currentY = enemyTank.getBarrelEnd().y + vy * timeStep + 0.5 * g * timeStep * timeStep;
                  if (currentY >= getTerrainHeightAt(currentX, terrain)) { hitsTerrainEarly = true; break; }
             }

            if (!hitsTerrainEarly && error < minError) {
                minError = error;
                bestAngle = angle;
                bestPower = p;
            }
        }
    }

    const angleErrorRange = (1 - accuracy) * 20; // Sai số ít hơn khi chính xác cao
    const powerErrorRange = (1 - accuracy) * 30;
    const finalAngle = bestAngle + (Math.random() - 0.5) * angleErrorRange;
    const finalPower = bestPower + (Math.random() - 0.5) * powerErrorRange;

    enemyTank.angle = Math.max(91, Math.min(MAX_ANGLE, finalAngle));
    enemyTank.power = Math.max(MIN_POWER, Math.min(MAX_POWER, finalPower));

    console.log(`AI Aimed - Angle: ${enemyTank.angle.toFixed(1)}, Power: ${enemyTank.power.toFixed(1)} (MinError: ${minError.toFixed(1)})`);

    // Bắn sau một khoảng trễ (trong setTimeout)
    const thinkTime = 800 + Math.random() * 700;
    console.log(`AI finished calculation, will fire in ${thinkTime.toFixed(0)} ms`);

    setTimeout(() => {
        // ***** Kiểm tra lại trạng thái NGAY TRƯỚC KHI BẮN *****
        if (currentPlayer === 'ai' && !isFiring && !gameIsOver) {
            console.log("AI executing fire command.");
            fire(enemyTank, AMMO_TYPES['normal']); // AI dùng đạn thường
        } else {
             console.log("AI fire aborted (state changed during thinking time).");
        }
         // Dù bắn hay không, AI đã "nghĩ" xong lượt này
         aiIsThinking = false;
    }, thinkTime);
}


function draw() {
    // Xóa canvas hoặc vẽ nền đè lên
    drawBackground();

    // Vẽ địa hình
    drawTerrain(ctx, terrain);

    // Vẽ xe tăng
    if (playerTank) playerTank.draw(ctx);
    if (enemyTank) enemyTank.draw(ctx);

    // Vẽ đạn
    projectiles.forEach(p => p.draw(ctx));

    // Vẽ hiệu ứng nổ
    explosions.forEach(exp => exp.draw(ctx));

    // Vẽ chỉ báo gió
    drawWindIndicator(ctx);

    // Vẽ thông tin debug
     if (debugInfo && playerTank && enemyTank) {
        try { // Thêm try-catch để tránh lỗi khi tank chưa kịp tạo
            debugInfo.textContent = `P:(${playerTank.x.toFixed(0)},${playerTank.currentTerrainY.toFixed(0)}) H:${playerTank.health.toFixed(0)} | E:(${enemyTank.x.toFixed(0)},${enemyTank.currentTerrainY.toFixed(0)}) H:${enemyTank.health.toFixed(0)} | Proj:${projectiles.length} Exp:${explosions.length} Firing:${isFiring} Turn:${currentPlayer}`;
        } catch (e) {
            debugInfo.textContent = "Debug info error...";
        }
     } else if (debugInfo) {
         debugInfo.textContent = '';
     }
}

// Vẽ địa hình chi tiết hơn
function drawTerrain(ctx, terrainPoints) {
    if (terrainPoints.length < 2) return;

    // Lớp đất nền dưới cùng (nâu)
    ctx.fillStyle = '#654321'; // Màu nâu sẫm hơn
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(terrainPoints[0].x, terrainPoints[0].y + 10); // Bắt đầu hơi sâu hơn
     for (let i = 1; i < terrainPoints.length; i++) {
         ctx.lineTo(terrainPoints[i].x, terrainPoints[i].y + 10);
     }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();


    // Lớp đất chính (xanh lá)
    ctx.fillStyle = '#228B22'; // Màu đất xanh
    ctx.beginPath();
    ctx.moveTo(0, canvas.height); // Bắt đầu từ góc dưới trái
    ctx.lineTo(terrainPoints[0].x, terrainPoints[0].y); // Điểm đầu tiên của địa hình
    for (let i = 1; i < terrainPoints.length; i++) {
        ctx.lineTo(terrainPoints[i].x, terrainPoints[i].y);
    }
    ctx.lineTo(terrainPoints[terrainPoints.length-1].x, canvas.height); // Điểm cuối cùng xuống đáy
    ctx.closePath();
    ctx.fill();

    // Vẽ đường viền trên cùng của địa hình
     ctx.strokeStyle = '#006400'; // Xanh lá cây đậm
     ctx.lineWidth = 2;
     ctx.beginPath();
     ctx.moveTo(terrainPoints[0].x, terrainPoints[0].y);
     for (let i = 1; i < terrainPoints.length; i++) {
         ctx.lineTo(terrainPoints[i].x, terrainPoints[i].y);
     }
     ctx.stroke();
}

// Vẽ chỉ báo gió
function drawWindIndicator(ctx) {
    const indicatorX = canvas.width / 2;
    const indicatorY = 25; // Vị trí cao hơn chút
    const maxWindArrow = 40; // Chiều dài tối đa mũi tên

    ctx.font = 'bold 14px sans-serif'; // In đậm
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Màu trắng rõ hơn
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; // Đổ bóng nhẹ
    ctx.shadowBlur = 3;
    ctx.textAlign = 'center';
    ctx.fillText(`Gió: ${Math.abs(wind).toFixed(1)}`, indicatorX, indicatorY - 15);

    // Reset shadow cho mũi tên
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    if (Math.abs(wind) < 0.1) return; // Không vẽ mũi tên nếu gió quá yếu

    const arrowWidth = Math.abs(wind / MAX_WIND_SPEED) * maxWindArrow;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3; // Dày hơn
    ctx.lineCap = 'round'; // Đầu tròn

    ctx.beginPath();
    const startX = indicatorX - (wind > 0 ? arrowWidth / 2 : -arrowWidth / 2);
    const endX = indicatorX + (wind > 0 ? arrowWidth / 2 : -arrowWidth / 2);
    ctx.moveTo(startX, indicatorY);
    ctx.lineTo(endX, indicatorY);

    // Đầu mũi tên
    const arrowHeadSize = 8;
    if (wind > 0) { // Sang phải
        ctx.moveTo(endX - arrowHeadSize, indicatorY - arrowHeadSize / 2);
        ctx.lineTo(endX, indicatorY);
        ctx.lineTo(endX - arrowHeadSize, indicatorY + arrowHeadSize / 2);
    } else { // Sang trái
        ctx.moveTo(endX + arrowHeadSize, indicatorY - arrowHeadSize / 2);
        ctx.lineTo(endX, indicatorY);
        ctx.lineTo(endX + arrowHeadSize, indicatorY + arrowHeadSize / 2);
    }
    ctx.stroke();
     ctx.lineCap = 'butt'; // Reset lineCap
}


function gameOver(playerWon, customMessage = "") {
    if (gameIsOver) return;
    console.log(`Game Over. Player ${playerWon ? 'Won' : 'Lost'}`);
    gameIsOver = true;
    isFiring = false; // Đảm bảo dừng trạng thái bắn
    stopIntervals(); // Dừng các interval
    toggleControls(false); // Tắt hẳn controls

    if (playerWon && score > highScore) {
        highScore = score;
        saveGameData();
    } else if (!playerWon) {
        // localStorage.setItem('tankGameLevel', 1); // Tùy chọn: Reset level khi thua
    }

    // if (assets.backgroundMusic) assets.backgroundMusic.pause();
    // playSound(playerWon ? assets.winSound : assets.loseSound); // Cần thêm assets âm thanh thắng/thua

    const message = customMessage || (playerWon ? `Chiến thắng! Điểm: ${score}` : "Thất bại!");
    if (gameOverOverlay && gameOverMessageElement) {
        gameOverMessageElement.textContent = message;
        gameOverOverlay.style.display = 'flex';
    } else {
        // Fallback vẽ canvas (ít đẹp hơn)
        // ... (code vẽ fallback giữ nguyên) ...
    }
}

let lastTime = 0;
function gameLoop(timestamp) {
    // Luôn yêu cầu frame tiếp theo ngay cả khi game over để giữ overlay hiển thị
    requestAnimationFrame(gameLoop);

    // Tính delta time, giới hạn giá trị lớn bất thường
    const deltaTime = Math.min(50, timestamp - lastTime); // Giới hạn delta tối đa 50ms (20 FPS)
    lastTime = timestamp;

    if (!gameIsOver && deltaTime > 0) {
        // Update chỉ chạy nếu game chưa kết thúc và có delta time hợp lệ
        update(deltaTime / 16.67); // Chuẩn hóa deltaTime (nếu cần)
    }

    // Luôn vẽ để hiển thị trạng thái mới nhất
    draw();
}

// --- Start the game ---
// Đảm bảo DOM sẵn sàng trước khi truy cập element
document.addEventListener('DOMContentLoaded', () => {
     loadAssets(initGame); // Tải assets xong thì mới init game
});
