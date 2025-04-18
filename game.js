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

// Game Over Overlay Elements (Thêm vào HTML nếu chưa có)
// <div id="game-over-overlay">
//     <div id="game-over-message"></div>
//     <div id="restart-message">Nhấn F5 hoặc Refresh để chơi lại</div>
// </div>
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverMessageElement = document.getElementById('game-over-message');


// --- Game Constants ---
const GRAVITY = 0.1;
const TANK_WIDTH = 50; // Kích thước ảnh tank player
const TANK_HEIGHT = 30;
const ENEMY_TANK_WIDTH = 50; // Kích thước ảnh tank enemy (có thể khác)
const ENEMY_TANK_HEIGHT = 30;
const BARREL_LENGTH = 35; // Chiều dài nòng từ tâm xoay
const BARREL_THICKNESS = 6;
const MOVE_SPEED = 1.5;
const MIN_ANGLE = 1;
const MAX_ANGLE = 179;
const MIN_POWER = 10;
const MAX_POWER = 100;
const POWER_STEP = 2; // Bước chỉnh nhỏ hơn
const ANGLE_STEP = 1; // Bước chỉnh nhỏ hơn
const TERRAIN_RESOLUTION = 5; // Độ chi tiết địa hình (vẽ 1 điểm mỗi 5px)
const MAX_WIND_SPEED = 5; // Tốc độ gió tối đa
const EXPLOSION_FRAMES = 16; // Số frame trong spritesheet vụ nổ
const EXPLOSION_FRAME_WIDTH = 64; // Chiều rộng 1 frame vụ nổ
const EXPLOSION_FRAME_HEIGHT = 64;
const EXPLOSION_DURATION = 500; // ms - Thời gian tồn tại của hiệu ứng nổ

// --- Ammo Types ---
const AMMO_TYPES = {
    'normal': { name: 'Thường', damage: 30, radius: 30, cost: 0 },
    'heavy': { name: 'Nặng', damage: 50, radius: 45, cost: 10 }, // Ví dụ: tốn điểm để dùng
    'scatter': { name: 'Chùm', damage: 15, radius: 20, count: 3, spread: 15, cost: 20 } // Đạn chùm (phức tạp hơn)
};
const AMMO_ORDER = ['normal', 'heavy']; // Thứ tự để duyệt qua, 'scatter' sẽ làm sau

// --- Game State Variables ---
let playerTank;
let enemyTank;
let projectiles = [];
let explosions = []; // Mảng chứa các hiệu ứng nổ đang hoạt động
let terrain = []; // Mảng các điểm {x, y} của địa hình
let obstacles = []; // Tạm thời không dùng, tích hợp vào địa hình hoặc thêm sau
let currentPlayer = 'player';
let score = 0;
let currentLevel = 1;
let highScore = 0;
let wind = 0;
let isFiring = false;
let gameIsOver = false;
let currentAmmoIndex = 0; // Index của loại đạn đang chọn
let levelConfigs = []; // Mảng chứa cấu hình các level

// --- Asset Loading ---
let assets = {
    playerTankImg: new Image(),
    enemyTankImg: new Image(),
    backgroundImg: new Image(),
    explosionSpritesheet: new Image(), // Spritesheet
    projectileImg: null, // Tùy chọn: ảnh viên đạn
    fireSound: new Audio(),
    explosionSound: new Audio(),
    backgroundMusic: new Audio(),
    hitSound: new Audio(), // Âm thanh khi trúng đích
};
let assetsLoaded = 0;
let totalAssets = 7; // Đếm số lượng assets cần load (3 ảnh, 4 âm thanh)

function loadAssets(callback) {
    console.log("Loading assets...");
    let loadedCount = 0;

    function assetLoaded() {
        loadedCount++;
        console.log(`Loaded ${loadedCount}/${totalAssets}`);
        if (loadedCount === totalAssets) {
            console.log("All assets loaded!");
            assets.backgroundMusic.loop = true; // Lặp lại nhạc nền
            // assets.backgroundMusic.volume = 0.3; // Giảm âm lượng nhạc nền
            // assets.backgroundMusic.play().catch(e => console.warn("BG Music play failed:", e));
            callback();
        }
    }

    function assetError(e) {
        console.error("Error loading asset:", e.target.src || e.target);
        assetLoaded(); // Vẫn tính là đã load (dù lỗi) để game bắt đầu
    }

    assets.playerTankImg.src = 'assets/images/tank_player.png';
    assets.playerTankImg.onload = assetLoaded;
    assets.playerTankImg.onerror = assetError;

    assets.enemyTankImg.src = 'assets/images/tank_enemy.png';
    assets.enemyTankImg.onload = assetLoaded;
    assets.enemyTankImg.onerror = assetError;

    assets.backgroundImg.src = 'assets/images/background.png'; // Nên là ảnh nền phù hợp kích thước
    assets.backgroundImg.onload = assetLoaded;
    assets.backgroundImg.onerror = assetError;

    assets.explosionSpritesheet.src = 'assets/images/explosion_sheet.png'; // Đổi tên file đúng
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

    // assets.backgroundMusic.src = 'assets/sounds/background_music.mp3';
    // assets.backgroundMusic.oncanplaythrough = assetLoaded;
    // assets.backgroundMusic.onerror = assetError;
    // assets.backgroundMusic.load();
    // Tạm thời bỏ nhạc nền để giảm số asset, thay bằng hitSound
    assets.hitSound.src = 'assets/sounds/hit.wav'; // Âm thanh khi đạn trúng xe
    assets.hitSound.oncanplaythrough = assetLoaded;
    assets.hitSound.onerror = assetError;
    assets.hitSound.load();
    totalAssets = 6; // Cập nhật lại nếu bỏ bớt asset


    console.log("Asset loading initiated...");
}


// --- Game Object Classes ---

class Tank {
    constructor(x, y, width, height, color, image, isPlayer = true) {
        this.x = x;
        this.y = y; // Y là tọa độ đáy xe tăng trên địa hình
        this.width = width;
        this.height = height;
        this.color = color;
        this.image = image;
        this.isPlayer = isPlayer;
        this.angle = isPlayer ? 45 : 135;
        this.power = 50;
        // Gốc nòng súng (tương đối so với tâm X, Y của hình ảnh tank)
        // Giả sử tâm ảnh là giữa đáy
        this.barrelPivotX = 0; // Ngay giữa xe theo chiều ngang
        this.barrelPivotY = -this.height * 0.6; // Hơi cao hơn đáy một chút
        this.health = 100;
        this.currentTerrainY = y; // Lưu lại độ cao địa hình tại vị trí tank
    }

    draw(ctx) {
        const drawX = this.x - this.width / 2;
        const drawY = this.currentTerrainY - this.height; // Vẽ từ vị trí y trên địa hình trừ đi chiều cao

        // Draw Barrel
        ctx.save();
        ctx.translate(this.x + this.barrelPivotX, drawY - this.barrelPivotY); // Di chuyển tới gốc nòng (tọa độ canvas)
        // Góc cần điều chỉnh theo hướng xe tăng (nếu AI quay đầu)
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
        const healthBarY = drawY - healthBarHeight - 4; // Trên nóc xe
        ctx.fillStyle = '#ff4d4d'; // Màu nền đỏ
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        ctx.fillStyle = '#4dff4d'; // Màu máu xanh
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth * (this.health / 100), healthBarHeight);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight); // Viền thanh máu

    }

    // Cập nhật vị trí Y dựa trên địa hình
    updatePositionOnTerrain(terrainPoints) {
         this.currentTerrainY = getTerrainHeightAt(this.x, terrainPoints);
         // Ngăn tank rơi xuống vực nếu địa hình bị phá hủy quá sâu
         this.currentTerrainY = Math.min(this.currentTerrainY, canvas.height);
    }

    move(direction, terrainPoints) {
        if (isFiring || gameIsOver) return;

        const nextX = this.x + direction * MOVE_SPEED;
        const tankHalfWidth = this.width / 2;

        // Kiểm tra biên trái/phải
        if (nextX - tankHalfWidth < 0 || nextX + tankHalfWidth > canvas.width) {
            return;
        }

        // Kiểm tra độ dốc địa hình (ngăn leo tường quá dốc)
        const currentY = this.currentTerrainY;
        const nextTerrainY = getTerrainHeightAt(nextX, terrainPoints);
        const slope = Math.abs(nextTerrainY - currentY) / Math.abs(nextX - this.x);

        if (slope < 1.5) { // Cho phép leo dốc vừa phải (điều chỉnh ngưỡng này)
             this.x = nextX;
             this.updatePositionOnTerrain(terrainPoints); // Cập nhật lại Y sau khi di chuyển
        } else {
            console.log("Slope too steep!");
        }
    }

    adjustAngle(amount) {
        if (isFiring || gameIsOver) return;
        let newAngle = this.angle + amount;
        // Giới hạn góc tùy thuộc là người chơi hay AI (AI cần góc > 90)
        if (this.isPlayer) {
            this.angle = Math.max(MIN_ANGLE, Math.min(90, newAngle)); // Player: 1-90
        } else {
             this.angle = Math.max(91, Math.min(MAX_ANGLE, newAngle)); // AI: 91-179
        }
        updateUI();
    }

    adjustPower(amount) {
        if (isFiring || gameIsOver) return;
        this.power += amount;
        this.power = Math.max(MIN_POWER, Math.min(MAX_POWER, this.power));
        updateUI();
    }

    getBarrelEnd() {
        const drawX = this.x - this.width / 2;
        const drawY = this.currentTerrainY - this.height;
        const barrelStartX = this.x + this.barrelPivotX;
        const barrelStartY = drawY - this.barrelPivotY;

        let fireAngle = this.isPlayer ? this.angle : (180 - this.angle);
        const angleRad = -fireAngle * Math.PI / 180;

        const barrelEndX = barrelStartX + Math.cos(angleRad) * BARREL_LENGTH;
        const barrelEndY = barrelStartY + Math.sin(angleRad) * BARREL_LENGTH;
        return { x: barrelEndX, y: barrelEndY };
    }

    takeDamage(amount) {
        this.health -= amount;
        this.health = Math.max(0, this.health);
        playSound(assets.hitSound);
        if (this.health <= 0) {
             // Tank is destroyed - handle game over logic elsewhere
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
        this.radius = 5; // Kích thước hình ảnh/vẽ đạn
        this.trail = [];
        this.trailLength = 15;
        this.ammoData = ammoData; // Lưu thông tin loại đạn
        this.owner = (currentPlayer === 'player') ? playerTank : enemyTank; // Xác định chủ sở hữu
    }

    update(wind, terrainPoints) {
        this.x += this.vx;
        this.y += this.vy;
        this.vx += wind / 60; // Gió ảnh hưởng ít hơn
        this.vy += GRAVITY;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailLength) {
            this.trail.shift();
        }

        // Kiểm tra va chạm sau khi cập nhật vị trí
        return this.checkCollisions(terrainPoints);
    }

     checkCollisions(terrainPoints) {
         // 1. Va chạm địa hình
         const terrainY = getTerrainHeightAt(this.x, terrainPoints);
         if (this.y >= terrainY) {
             return { hit: true, target: 'terrain', point: {x: this.x, y: terrainY} };
         }

         // 2. Va chạm xe tăng địch
         const targetTank = (this.owner === playerTank) ? enemyTank : playerTank;
         if (checkCollisionCircleRect(this, targetTank)) {
             return { hit: true, target: targetTank, point: {x: this.x, y: this.y} };
         }

         // 3. Ra khỏi màn hình
         if (this.x < -this.radius || this.x > canvas.width + this.radius || this.y > canvas.height + this.radius) {
              return { hit: true, target: 'outofbounds', point: {x: this.x, y: this.y} };
         }
          if (this.y < -canvas.height) { // Bay quá cao
             return { hit: true, target: 'outofbounds', point: {x: this.x, y: this.y} };
         }

         return { hit: false }; // Chưa va chạm
     }

    draw(ctx) {
        // Draw trail
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                 // Tạo hiệu ứng mờ dần cho vệt
                const alpha = (i / this.trail.length) * 0.5; // Alpha từ 0 đến 0.5
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.lineWidth = 3; // Vệt dày hơn chút
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
        this.radius = radius; // Bán kính ảnh hưởng sát thương và phá hủy đất
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
        // Tính frame hiện tại dựa trên thời gian
        this.currentFrame = Math.floor((elapsedTime / this.duration) * this.totalFrames);
        this.currentFrame = Math.min(this.currentFrame, this.totalFrames - 1); // Đảm bảo không vượt quá frame cuối
    }

    draw(ctx) {
        if (!this.active || !this.spriteSheet || !this.spriteSheet.complete || this.spriteSheet.naturalHeight === 0) return;

        const frameX = (this.currentFrame % this.totalFrames) * this.frameWidth; // Tính tọa độ X của frame trên spritesheet
        const frameY = 0; // Giả sử spritesheet chỉ có 1 hàng

        // Vẽ frame hiện tại của vụ nổ, căn giữa vào điểm nổ
        ctx.drawImage(
            this.spriteSheet,
            frameX, frameY, // Tọa độ frame nguồn (sx, sy)
            this.frameWidth, this.frameHeight, // Kích thước frame nguồn (sw, sh)
            this.x - this.frameWidth / 2, this.y - this.frameHeight / 2, // Tọa độ vẽ trên canvas (dx, dy)
            this.frameWidth, this.frameHeight // Kích thước vẽ trên canvas (dw, dh)
        );
    }
}

// --- Helper Functions ---

function playSound(sound) {
    if (sound && sound.readyState >= 3) { // Check if ready to play
        sound.currentTime = 0;
        sound.play().catch(e => console.warn("Sound play interrupted:", e));
    }
}

// Kiểm tra va chạm giữa hình tròn (projectile) và hình chữ nhật (tank)
function checkCollisionCircleRect(circle, rectTank) {
    const rectX = rectTank.x - rectTank.width / 2;
    const rectY = rectTank.currentTerrainY - rectTank.height; // Y của đỉnh tank
    const rectWidth = rectTank.width;
    const rectHeight = rectTank.height;

    // Tìm điểm gần nhất trên hình chữ nhật so với tâm hình tròn
    const closestX = Math.max(rectX, Math.min(circle.x, rectX + rectWidth));
    const closestY = Math.max(rectY, Math.min(circle.y, rectY + rectHeight));

    // Tính khoảng cách giữa tâm hình tròn và điểm gần nhất này
    const distX = circle.x - closestX;
    const distY = circle.y - closestY;
    const distanceSquared = (distX * distX) + (distY * distY);

    // Nếu khoảng cách nhỏ hơn bán kính bình phương, có va chạm
    return distanceSquared < (circle.radius * circle.radius);
}


// Lấy độ cao địa hình tại điểm x
function getTerrainHeightAt(x, terrainPoints) {
    // Tìm 2 điểm địa hình bao quanh x
    let p1 = null, p2 = null;
    for (let i = 0; i < terrainPoints.length - 1; i++) {
        if (x >= terrainPoints[i].x && x <= terrainPoints[i+1].x) {
            p1 = terrainPoints[i];
            p2 = terrainPoints[i+1];
            break;
        }
    }

    if (!p1 || !p2) {
         // Nếu x nằm ngoài phạm vi địa hình đã biết, trả về y của điểm gần nhất
         if (x < terrainPoints[0].x) return terrainPoints[0].y;
         return terrainPoints[terrainPoints.length - 1].y;
    }

    // Nội suy tuyến tính giữa 2 điểm
    if (p2.x === p1.x) return p1.y; // Tránh chia cho 0 nếu 2 điểm trùng x
    const ratio = (x - p1.x) / (p2.x - p1.x);
    return p1.y + ratio * (p2.y - p1.y);
}

// Tạo địa hình ngẫu nhiên nhấp nhô
function generateTerrain(width, height) {
    console.log("Generating terrain...");
    const points = [];
    const segments = Math.ceil(width / TERRAIN_RESOLUTION);
    let currentY = height * (0.7 + Math.random() * 0.2); // Bắt đầu từ 70-90% chiều cao
    const maxHeightVariation = height * 0.15; // Độ nhấp nhô tối đa

    points.push({ x: 0, y: currentY });

    for (let i = 1; i <= segments; i++) {
        const x = i * TERRAIN_RESOLUTION;
        let yVariation = (Math.random() - 0.5) * maxHeightVariation;
        // Giảm dần độ nhấp nhô ở 2 đầu
        const edgeFactor = Math.sin((i / segments) * Math.PI); // Gần 0 ở đầu, 1 ở giữa
        yVariation *= edgeFactor;

        let nextY = currentY + yVariation;
        nextY = Math.max(height * 0.4, Math.min(height * 0.95, nextY)); // Giới hạn độ cao

        // Làm mượt địa hình một chút (trung bình với điểm trước)
        // nextY = (currentY + nextY) / 2;

        points.push({ x: Math.min(x, width), y: nextY }); // Đảm bảo không vượt quá width
        currentY = nextY;
    }
     // Đảm bảo điểm cuối cùng là ở cạnh phải canvas
     if (points[points.length - 1].x < width) {
          points.push({ x: width, y: currentY });
     }
     console.log(`Generated ${points.length} terrain points.`);
    return points;
}

// Phá hủy địa hình tại điểm nổ
function destroyTerrain(centerX, centerY, radius, terrainPoints) {
    console.log(`Destroying terrain at (${centerX}, ${centerY}) with radius ${radius}`);
    const radiusSq = radius * radius;
    let changed = false;

    for (let i = 0; i < terrainPoints.length; i++) {
        const p = terrainPoints[i];
        const dx = p.x - centerX;
        const dy = p.y - centerY;
        const distSq = dx * dx + dy * dy;

        if (distSq < radiusSq) {
            // Điểm nằm trong bán kính nổ
            const destructionAmount = (1 - Math.sqrt(distSq) / radius) * radius * 0.8; // Phá hủy mạnh hơn ở gần tâm
            // Hạ thấp điểm địa hình, nhưng không sâu hơn điểm nổ Y quá nhiều
            // và không cao hơn điểm nổ Y
             const currentTerrainY = getTerrainHeightAt(p.x, terrainPoints); // Lấy y hiện tại trước khi sửa đổi

             // Điểm bị hạ thấp xuống, mô phỏng miệng hố
             const craterDepthFactor = Math.cos((Math.sqrt(distSq) / radius) * (Math.PI / 2)); // Cong hình cos
             let newY = currentTerrainY + destructionAmount * craterDepthFactor;

            // Giới hạn không cho đất bay lên trời hoặc xuống quá sâu
            newY = Math.min(newY, canvas.height + 20); // Không sâu hơn đáy canvas nhiều
             newY = Math.max(newY, centerY - radius * 0.2); // Ngăn tạo thành cột đất nhọn hoắt

             if (newY > p.y) { // Chỉ hạ thấp, không nâng lên
                  p.y = newY;
                  changed = true;
             }

        }
    }
     if (!changed) console.log("No terrain points affected by explosion.");
     else console.log("Terrain modified.");
}


// --- Game Logic Functions ---

function defineLevels() {
    levelConfigs = [
        // Level 1: Đơn giản
        {
            windRange: 2, // Gió nhẹ
            terrainVariation: 0.1, // Địa hình ít nhấp nhô
            enemyHealth: 100,
            enemyAimAccuracy: 0.6, // AI bắn chưa chuẩn lắm
            playerStartX: 0.15, // Vị trí bắt đầu (tỷ lệ theo chiều rộng canvas)
            enemyStartX: 0.85
        },
        // Level 2: Gió mạnh hơn, địa hình khó hơn
        {
            windRange: 4,
            terrainVariation: 0.2,
            enemyHealth: 120,
            enemyAimAccuracy: 0.75,
            playerStartX: 0.1,
            enemyStartX: 0.9
        },
         // Level 3: Gió mạnh, địa hình phức tạp, AI khó
        {
            windRange: MAX_WIND_SPEED,
            terrainVariation: 0.25,
            enemyHealth: 150,
            enemyAimAccuracy: 0.85, // AI ngắm tốt hơn
            playerStartX: 0.2, // Có thể gần nhau hơn
            enemyStartX: 0.8
        }
        // Thêm các level khác ở đây
    ];
}

function initGame() {
    console.log("Initializing game...");
    defineLevels(); // Định nghĩa các level
    loadSavedData(); // Tải điểm cao và level đã lưu
    resizeCanvas();

    score = 0; // Reset điểm khi bắt đầu game mới
    // currentLevel được load từ save hoặc mặc định là 1
    gameIsOver = false;
    isFiring = false;
    projectiles = [];
    explosions = [];
    currentAmmoIndex = 0; // Bắt đầu với đạn thường

    if (gameOverOverlay) gameOverOverlay.style.display = 'none'; // Ẩn thông báo gameover

    setupLevel(currentLevel);
    setupControls();

    // Bắt đầu nhạc nền nếu có và chưa chạy
     if (assets.backgroundMusic && assets.backgroundMusic.paused) {
         assets.backgroundMusic.play().catch(e => console.warn("BG Music play failed on init:", e));
     }

    gameLoop();
    console.log("Game initialized and loop started.");
}

function loadSavedData() {
    highScore = parseInt(localStorage.getItem('tankGameHighScore') || '0');
    currentLevel = parseInt(localStorage.getItem('tankGameLevel') || '1');
    // Đảm bảo level không vượt quá số level đã định nghĩa
    currentLevel = Math.min(currentLevel, levelConfigs.length);
    currentLevel = Math.max(1, currentLevel); // Ít nhất là level 1
    highScoreElement.textContent = highScore;
    console.log(`Loaded High Score: ${highScore}, Starting Level: ${currentLevel}`);
}

function saveGameData() {
    localStorage.setItem('tankGameHighScore', highScore);
    localStorage.setItem('tankGameLevel', currentLevel);
    console.log(`Saved High Score: ${highScore}, Level: ${currentLevel}`);
}


function resizeCanvas() {
    const wrapper = document.getElementById('game-wrapper');
    const controlsHeight = document.getElementById('controls').offsetHeight;
    const infoHeight = document.getElementById('game-info').offsetHeight;
    // Chiều rộng tối đa là của wrapper
    const availableWidth = wrapper.clientWidth;
    // Chiều cao tối đa là chiều cao cửa sổ trừ đi controls, info và một chút padding
    const availableHeight = window.innerHeight - controlsHeight - infoHeight - 40; // 40px padding tổng

    // Tính toán kích thước canvas giữ tỷ lệ 4:3 nhưng không vượt quá giới hạn
    let canvasWidth = availableWidth;
    let canvasHeight = canvasWidth * (3 / 4);

    if (canvasHeight > availableHeight) {
        canvasHeight = availableHeight;
        canvasWidth = canvasHeight * (4 / 3);
    }
    // Đảm bảo không rộng hơn wrapper
    canvasWidth = Math.min(canvasWidth, availableWidth);

    canvas.width = Math.floor(canvasWidth); // Dùng floor để tránh số lẻ
    canvas.height = Math.floor(canvasHeight);

    console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);

    // Quan trọng: Sau khi resize, cần tạo lại địa hình và đặt lại vị trí tank
    // nếu không các đối tượng sẽ ở sai vị trí tương đối.
    // Gọi lại setupLevel sẽ làm việc này.
    if (playerTank) { // Chỉ gọi nếu game đã bắt đầu
        console.log("Re-setting up level due to resize...");
        setupLevel(currentLevel); // Setup lại level hiện tại với kích thước mới
    } else {
        // Nếu game chưa bắt đầu, chỉ cần vẽ nền chờ
        drawBackground();
    }
}

function drawBackground() {
     if (assets.backgroundImg && assets.backgroundImg.complete) {
        ctx.drawImage(assets.backgroundImg, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function setupLevel(levelNumber) {
    console.log(`Setting up level ${levelNumber}`);
    const config = levelConfigs[levelNumber - 1] || levelConfigs[0]; // Lấy config hoặc dùng level 1 nếu lỗi

    // 1. Tạo địa hình
    terrain = generateTerrain(canvas.width, canvas.height);

    // 2. Đặt vị trí xe tăng
    const playerX = canvas.width * config.playerStartX;
    const enemyX = canvas.width * config.enemyStartX;

    playerTank = new Tank(
        playerX,
        getTerrainHeightAt(playerX, terrain),
        TANK_WIDTH, TANK_HEIGHT,
        'blue', assets.playerTankImg, true
    );
    enemyTank = new Tank(
        enemyX,
        getTerrainHeightAt(enemyX, terrain),
        ENEMY_TANK_WIDTH, ENEMY_TANK_HEIGHT,
        'red', assets.enemyTankImg, false
    );

     // Cập nhật Y ban đầu cho tank
     playerTank.updatePositionOnTerrain(terrain);
     enemyTank.updatePositionOnTerrain(terrain);

    // Đặt máu cho AI theo level
    enemyTank.health = config.enemyHealth;

    // Reset góc/lực ban đầu (có thể giữ nguyên từ level trước?)
    // playerTank.angle = 45; playerTank.power = 50;
    // enemyTank.angle = 135; enemyTank.power = 50;

    // 3. Tạo gió ngẫu nhiên theo config level
    wind = (Math.random() - 0.5) * 2 * config.windRange;

    // 4. Reset trạng thái lượt chơi, đạn, nổ
    currentPlayer = 'player';
    isFiring = false;
    projectiles = [];
    explosions = [];
    gameIsOver = false;

    updateUI();
    toggleControls(true); // Bật điều khiển cho người chơi
    console.log("Level setup complete.");
}

function setupControls() {
    console.log("Setting up controls...");
    // Sử dụng sự kiện capturing để xử lý nhanh hơn trên mobile
    // và ngăn chặn hành vi mặc định như double-tap zoom
    const addSafeEventListener = (element, event, handler) => {
        if (element) {
            element.addEventListener(event, (e) => {
                e.preventDefault(); // Ngăn hành vi mặc định
                if (!element.disabled) { // Chỉ chạy nếu nút không bị disable
                     handler(e);
                }
            }, { passive: false, capture: true }); // capture=true, passive=false
        } else {
            console.warn(`Element for event ${event} not found.`);
        }
    };


    addSafeEventListener(document.getElementById('btn-move-left'), 'pointerdown', () => playerTank.move(-1, terrain));
    addSafeEventListener(document.getElementById('btn-move-right'), 'pointerdown', () => playerTank.move(1, terrain));
    addSafeEventListener(document.getElementById('btn-angle-down'), 'pointerdown', () => playerTank.adjustAngle(-ANGLE_STEP));
    addSafeEventListener(document.getElementById('btn-angle-up'), 'pointerdown', () => playerTank.adjustAngle(ANGLE_STEP));
    addSafeEventListener(document.getElementById('btn-power-down'), 'pointerdown', () => playerTank.adjustPower(-POWER_STEP));
    addSafeEventListener(document.getElementById('btn-power-up'), 'pointerdown', () => playerTank.adjustPower(POWER_STEP));
    addSafeEventListener(document.getElementById('btn-fire'), 'pointerdown', handleFire);
    addSafeEventListener(document.getElementById('btn-ammo-prev'), 'pointerdown', selectPrevAmmo);
    addSafeEventListener(document.getElementById('btn-ammo-next'), 'pointerdown', selectNextAmmo);


    // Bàn phím (giữ nguyên như cũ)
    window.onkeydown = (e) => { // Ghi đè listener cũ nếu có
        if (currentPlayer !== 'player' || isFiring || gameIsOver) return;

        let handled = true; // Đánh dấu để preventDefault
        switch (e.key) {
            case 'ArrowLeft': playerTank.move(-1, terrain); break;
            case 'ArrowRight': playerTank.move(1, terrain); break;
            case 'ArrowUp': playerTank.adjustAngle(ANGLE_STEP); break;
            case 'ArrowDown': playerTank.adjustAngle(-ANGLE_STEP); break;
            case 'PageUp': playerTank.adjustPower(POWER_STEP); break;
            case 'PageDown': playerTank.adjustPower(-POWER_STEP); break;
             case 'q': case 'Q': selectPrevAmmo(); break; // Ví dụ phím Q/E đổi đạn
             case 'e': case 'E': selectNextAmmo(); break;
            case ' ': case 'Enter': handleFire(); break;
            default: handled = false; // Không xử lý phím này
        }
        if (handled) e.preventDefault();
    };

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

    scoreElement.textContent = score;
    levelElement.textContent = currentLevel;
    playerTurnElement.textContent = `Lượt của: ${currentPlayer === 'player' ? 'Bạn' : 'Đối thủ'}`;
    angleDisplay.textContent = playerTank.angle.toFixed(0);
    powerDisplay.textContent = playerTank.power.toFixed(0);
    ammoTypeElement.textContent = ammoData.name; // Cập nhật tên đạn trên info
    ammoDisplayElement.textContent = ammoData.name; // Cập nhật tên đạn ở control

    windSpeedElement.textContent = Math.abs(wind).toFixed(1);
    windDirectionElement.textContent = wind === 0 ? '-' : (wind > 0 ? '->' : '<-');
    highScoreElement.textContent = highScore; // Cập nhật điểm cao nhất

    // Cập nhật thanh máu (đã vẽ trong tank.draw)
}

function handleFire() {
    if (isFiring || gameIsOver) return;
    if (currentPlayer === 'player') {
        const ammoKey = AMMO_ORDER[currentAmmoIndex];
        const ammoData = AMMO_TYPES[ammoKey];
        // Kiểm tra xem có đủ "điểm" để bắn loại đạn này không (nếu có cost)
        if (ammoData.cost > score) {
             console.log("Không đủ điểm để bắn loại đạn này!");
             // Có thể thêm thông báo cho người dùng
             return;
        }
        score -= ammoData.cost; // Trừ điểm nếu có cost
        fire(playerTank, ammoData);
        updateUI(); // Cập nhật điểm sau khi trừ
    }
}

function fire(tank, ammoData) {
    if (isFiring || gameIsOver) return;

    console.log(`${tank.isPlayer ? 'Player' : 'AI'} firing ${ammoData.name}! Angle: ${tank.angle}, Power: ${tank.power}`);
    isFiring = true;

    const barrelEnd = tank.getBarrelEnd();
    let fireAngle = tank.isPlayer ? tank.angle : (180 - tank.angle);
    const angleRad = -fireAngle * Math.PI / 180;
    const initialVelocity = tank.power / 6 + 2; // Điều chỉnh hệ số này

    const vx = Math.cos(angleRad) * initialVelocity;
    const vy = Math.sin(angleRad) * initialVelocity;

    // Xử lý đạn chùm (nếu là loại scatter)
    if (ammoData.type === 'scatter' && ammoData.count > 1) { // Ví dụ kiểm tra loại đạn
         const spreadAngle = ammoData.spread * Math.PI / 180; // Góc tỏa ra (radian)
         for (let i = 0; i < ammoData.count; i++) {
             // Tạo góc lệch ngẫu nhiên nhỏ cho mỗi viên đạn con
             const angleOffset = (Math.random() - 0.5) * spreadAngle;
             const currentAngleRad = angleRad + angleOffset;
             const currentVx = Math.cos(currentAngleRad) * initialVelocity * (0.8 + Math.random() * 0.4); // Tốc độ hơi khác nhau
             const currentVy = Math.sin(currentAngleRad) * initialVelocity * (0.8 + Math.random() * 0.4);
             projectiles.push(new Projectile(barrelEnd.x, barrelEnd.y, currentVx, currentVy, ammoData));
         }
    } else {
         // Đạn thường hoặc các loại khác không phải chùm
         projectiles.push(new Projectile(barrelEnd.x, barrelEnd.y, vx, vy, ammoData));
    }


    playSound(assets.fireSound);
    toggleControls(false); // Vô hiệu hóa điều khiển khi đạn bay
}

function toggleControls(enabled) {
    const buttons = document.querySelectorAll('#controls button');
    buttons.forEach(button => button.disabled = !enabled);
}


function update(deltaTime) { // Thêm deltaTime để xử lý mượt hơn (tùy chọn)
    if (gameIsOver) return;

    // Cập nhật vị trí tank trên địa hình (quan trọng sau khi địa hình thay đổi)
    if (playerTank) playerTank.updatePositionOnTerrain(terrain);
    if (enemyTank) enemyTank.updatePositionOnTerrain(terrain);

    // Cập nhật đạn
    if (isFiring) {
        let projectilesStillFlying = false;
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            const collisionResult = p.update(wind, terrain); // update trả về kết quả va chạm

            if (collisionResult.hit) {
                console.log(`Projectile hit: ${collisionResult.target}`);
                projectiles.splice(i, 1); // Xóa đạn

                const ammoData = p.ammoData; // Lấy thông tin đạn để biết sát thương/bán kính nổ
                const explosionRadius = ammoData.radius;

                // Tạo hiệu ứng nổ
                createExplosion(collisionResult.point.x, collisionResult.point.y, explosionRadius);
                playSound(assets.explosionSound);

                // Phá hủy địa hình
                destroyTerrain(collisionResult.point.x, collisionResult.point.y, explosionRadius, terrain);

                // Xử lý sát thương nếu trúng tank
                if (collisionResult.target instanceof Tank) {
                     const targetTank = collisionResult.target;
                     const damage = ammoData.damage + (Math.random() - 0.5) * 10; // Sát thương + chút ngẫu nhiên
                     targetTank.takeDamage(damage);

                     // Cộng điểm cho người chơi nếu bắn trúng AI
                     if (p.owner === playerTank && targetTank === enemyTank) {
                         score += Math.round(damage); // Cộng điểm bằng sát thương gây ra
                         updateUI();
                         // Kiểm tra xem AI đã chết chưa
                         if (enemyTank.health <= 0) {
                             score += 100; // Thưởng thêm điểm khi hạ gục
                             updateUI();
                             // Chuyển level hoặc kết thúc game
                             setTimeout(() => nextLevelOrEndGame(true), 1500); // Chờ chút rồi chuyển level
                             return; // Dừng update ngay lập tức
                         }
                     } else if (p.owner === enemyTank && targetTank === playerTank) {
                         // Người chơi bị bắn trúng
                         if (playerTank.health <= 0) {
                             setTimeout(() => gameOver(false), 1500); // Chờ chút rồi game over
                             return; // Dừng update
                         }
                     }
                }

                // Sau khi xử lý va chạm, kiểm tra xem còn đạn nào bay không
                if (projectiles.length === 0) {
                     // Nếu không còn đạn nào bay và game chưa kết thúc -> chuyển lượt
                     setTimeout(switchTurn, 500); // Chờ chút sau vụ nổ cuối cùng rồi mới đổi lượt
                }

            } else {
                projectilesStillFlying = true; // Vẫn còn đạn đang bay
            }
        }
        // Nếu không còn đạn bay (projectiles.length === 0) và isFiring vẫn là true
        // thì phải đợi switchTurn được gọi bởi setTimeout ở trên
        // Không nên set isFiring = false ở đây ngay

    } else {
        // Nếu không có đạn đang bay và là lượt AI, AI thực hiện lượt
        if (currentPlayer === 'ai' && !gameIsOver) {
            aiTurn();
        }
    }

     // Cập nhật hiệu ứng nổ
     for (let i = explosions.length - 1; i >= 0; i--) {
         explosions[i].update();
         if (!explosions[i].active) {
             explosions.splice(i, 1); // Xóa vụ nổ đã hoàn thành
         }
     }
}

// Chuyển sang level tiếp theo hoặc kết thúc game nếu hết level
function nextLevelOrEndGame(playerWon) {
    if (!playerWon) {
        gameOver(false); // Nếu người chơi thua thì game over luôn
        return;
    }

    console.log(`Level ${currentLevel} cleared!`);
    currentLevel++;
    if (currentLevel > levelConfigs.length) {
        // Hoàn thành tất cả các level
        gameOver(true, "Bạn đã chiến thắng vẻ vang!"); // Thắng toàn bộ game
    } else {
        // Chuyển sang level tiếp theo
        saveGameData(); // Lưu tiến trình (level mới)
        console.log(`Moving to level ${currentLevel}`);
        setupLevel(currentLevel); // Setup level mới
         // Thông báo cho người chơi (tùy chọn)
         // showLevelStartMessage(`Level ${currentLevel}`);
    }
}

function createExplosion(x, y, radius) {
    console.log(`Creating explosion at ${x.toFixed(1)}, ${y.toFixed(1)} with radius ${radius}`);
    explosions.push(new Explosion(x, y, radius));
}

function switchTurn() {
    if (gameIsOver || projectiles.length > 0) return; // Không đổi lượt nếu còn đạn bay hoặc game kết thúc

    console.log("Switching turn...");
    currentPlayer = (currentPlayer === 'player') ? 'ai' : 'player';
    isFiring = false; // Đảm bảo reset trạng thái bắn
    updateUI();

    if (currentPlayer === 'player') {
        toggleControls(true); // Bật điều khiển cho người chơi
    } else {
        toggleControls(false); // Tắt điều khiển
        // AI sẽ tự động chơi trong hàm update() khi isFiring = false
    }
    console.log(`Current turn: ${currentPlayer}`);
}

function aiTurn() {
    if (isFiring || gameIsOver || currentPlayer !== 'ai') return;

    console.log("AI's turn...");
    isFiring = true; // Đánh dấu AI đang "suy nghĩ" và chuẩn bị bắn, ngăn việc gọi aiTurn liên tục

    const config = levelConfigs[currentLevel - 1] || levelConfigs[0];
    const accuracy = config.enemyAimAccuracy; // Độ chính xác của AI level này

    // --- Logic AI Tính Toán (Cải thiện) ---
    // Mục tiêu: Tính góc và lực để bắn trúng playerTank

    // 1. Tính toán quỹ đạo lý tưởng (bỏ qua gió tạm thời để đơn giản)
    const dx = playerTank.x - enemyTank.x;
    const dy = playerTank.y - enemyTank.y; // Y hướng xuống, nên dy âm là player cao hơn
    const g = GRAVITY;

    let bestAngle = 135; // Góc mặc định
    let bestPower = 60; // Lực mặc định
    let minError = Infinity; // Sai số nhỏ nhất tìm được

    // Thử các cặp góc/lực khác nhau để tìm phát bắn tốt nhất (Iterative approach)
    // Vòng lặp này có thể tốn hiệu năng, cần tối ưu hoặc giới hạn số lần thử
    const powerIterations = 10; // Số lần thử lực
    const angleIterations = 15; // Số lần thử góc

    for (let p = MIN_POWER; p <= MAX_POWER; p += (MAX_POWER - MIN_POWER) / powerIterations) {
         for (let angle = 91; angle < MAX_ANGLE; angle += (MAX_ANGLE - 91) / angleIterations) {
             const angleRad = -(180 - angle) * Math.PI / 180; // Góc bắn của AI (radian)
             const v = p / 6 + 2; // Vận tốc ban đầu tương ứng
             const vx = Math.cos(angleRad) * v;
             const vy = Math.sin(angleRad) * v;

             // Ước tính thời gian bay (đến vị trí x của player) - Rất đơn giản hóa, bỏ qua gió
             const t = dx / vx;
             // Ước tính vị trí y tại thời điểm đó
             const predictedY = enemyTank.getBarrelEnd().y + vy * t + 0.5 * g * t * t;

             // Tính sai số so với vị trí thực của player
             const error = Math.abs(predictedY - playerTank.currentTerrainY); // So sánh với Y của player trên địa hình

              // Ước tính va chạm với địa hình giữa đường (đơn giản hóa)
              let hitsTerrainEarly = false;
              for(let timeStep=0.1; timeStep < t; timeStep += 0.5) {
                   const currentX = enemyTank.getBarrelEnd().x + vx * timeStep;
                   const currentY = enemyTank.getBarrelEnd().y + vy * timeStep + 0.5 * g * timeStep * timeStep;
                   if (currentY >= getTerrainHeightAt(currentX, terrain)) {
                       hitsTerrainEarly = true;
                       break;
                   }
              }


             if (!hitsTerrainEarly && error < minError) {
                 minError = error;
                 bestAngle = angle;
                 bestPower = p;
             }
         }
    }

    // 2. Thêm sai số dựa trên độ chính xác (accuracy)
    const angleErrorRange = (1 - accuracy) * 30; // Sai số góc tối đa (vd: 30 độ khi accuracy=0)
    const powerErrorRange = (1 - accuracy) * 40; // Sai số lực tối đa

    const finalAngle = bestAngle + (Math.random() - 0.5) * angleErrorRange;
    const finalPower = bestPower + (Math.random() - 0.5) * powerErrorRange;

    // Gán giá trị cuối cùng cho AI tank (có giới hạn min/max)
    enemyTank.angle = Math.max(91, Math.min(MAX_ANGLE, finalAngle));
    enemyTank.power = Math.max(MIN_POWER, Math.min(MAX_POWER, finalPower));

    console.log(`AI Calculated Aim - Angle: ${enemyTank.angle.toFixed(1)}, Power: ${enemyTank.power.toFixed(1)} (Error: ${minError.toFixed(1)})`);

    // 3. Quyết định di chuyển (đơn giản)
     // Ví dụ: Nếu bị bắn trúng lượt trước, hoặc nếu không tìm thấy đường bắn tốt, AI có thể di chuyển một chút
     // if (minError > 50 || enemyTank.health < 70) {
     //     const moveDir = Math.random() < 0.5 ? -1 : 1;
     //     enemyTank.move(moveDir, terrain);
     //     console.log("AI decided to move.");
     //     // Cần tính lại phát bắn sau khi di chuyển, hoặc bỏ qua bắn lượt này
     // }


    // Bắn sau một khoảng trễ
    setTimeout(() => {
        // Kiểm tra lại trước khi bắn, phòng trường hợp game over trong lúc chờ
        if (currentPlayer === 'ai' && !gameIsOver) {
            // AI dùng đạn thường
            fire(enemyTank, AMMO_TYPES['normal']);
        } else {
             isFiring = false; // Reset nếu không bắn được nữa
        }
    }, 1000 + Math.random() * 1000); // Trễ 1-2 giây
}


function draw() {
    // Xóa canvas
    // ctx.clearRect(0, 0, canvas.width, canvas.height); // Không cần nếu vẽ nền đè lên

    // Vẽ nền
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

    // Vẽ thông tin gió (trên cùng)
    drawWindIndicator(ctx);

     // Vẽ thông tin debug (tùy chọn)
     if (debugInfo && playerTank && enemyTank) {
         debugInfo.textContent = `P:(${playerTank.x.toFixed(0)},${playerTank.currentTerrainY.toFixed(0)}) H:${playerTank.health.toFixed(0)} | E:(${enemyTank.x.toFixed(0)},${enemyTank.currentTerrainY.toFixed(0)}) H:${enemyTank.health.toFixed(0)} | Proj:${projectiles.length} Exp:${explosions.length}`;
     }
}

// Vẽ địa hình chi tiết hơn
function drawTerrain(ctx, terrainPoints) {
    if (terrainPoints.length < 2) return;

    ctx.fillStyle = '#228B22'; // Màu đất chính
    ctx.beginPath();
    ctx.moveTo(terrainPoints[0].x, terrainPoints[0].y);
    for (let i = 1; i < terrainPoints.length; i++) {
        ctx.lineTo(terrainPoints[i].x, terrainPoints[i].y);
    }
    // Đi xuống đáy canvas rồi vòng lại điểm đầu để tô màu
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();

    // Tùy chọn: Thêm lớp màu nâu bên dưới để đẹp hơn
    ctx.fillStyle = '#8B4513'; // Màu nâu đất
     ctx.beginPath();
     ctx.moveTo(terrainPoints[0].x, terrainPoints[0].y+5); // Bắt đầu thấp hơn 1 chút
     for (let i = 1; i < terrainPoints.length; i++) {
         ctx.lineTo(terrainPoints[i].x, terrainPoints[i].y+5);
     }
     ctx.lineTo(canvas.width, canvas.height);
     ctx.lineTo(0, canvas.height);
     ctx.closePath();
     ctx.fill();

     // Vẽ đường viền địa hình (tùy chọn)
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
    const indicatorY = 30;
    const arrowLength = 30;
    const maxWindArrow = 50; // Chiều dài tối đa của mũi tên thể hiện gió mạnh nhất

    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(`Gió: ${Math.abs(wind).toFixed(1)}`, indicatorX, indicatorY - 10);

    if (wind === 0) return;

    const arrowWidth = Math.abs(wind / MAX_WIND_SPEED) * maxWindArrow;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    if (wind > 0) { // Gió sang phải
        ctx.moveTo(indicatorX - arrowWidth / 2, indicatorY);
        ctx.lineTo(indicatorX + arrowWidth / 2, indicatorY);
        // Đầu mũi tên
        ctx.lineTo(indicatorX + arrowWidth / 2 - 8, indicatorY - 5);
        ctx.moveTo(indicatorX + arrowWidth / 2, indicatorY);
        ctx.lineTo(indicatorX + arrowWidth / 2 - 8, indicatorY + 5);
    } else { // Gió sang trái
        ctx.moveTo(indicatorX + arrowWidth / 2, indicatorY);
        ctx.lineTo(indicatorX - arrowWidth / 2, indicatorY);
        // Đầu mũi tên
        ctx.lineTo(indicatorX - arrowWidth / 2 + 8, indicatorY - 5);
        ctx.moveTo(indicatorX - arrowWidth / 2, indicatorY);
        ctx.lineTo(indicatorX - arrowWidth / 2 + 8, indicatorY + 5);
    }
    ctx.stroke();
}


function gameOver(playerWon, customMessage = "") {
    if (gameIsOver) return; // Tránh gọi nhiều lần

    console.log(`Game Over. Player ${playerWon ? 'Won' : 'Lost'}`);
    gameIsOver = true;
    isFiring = false;
    toggleControls(false);

    // Cập nhật điểm cao nếu người chơi thắng và đạt điểm cao mới
    if (playerWon && score > highScore) {
        highScore = score;
        saveGameData(); // Lưu điểm cao mới và level hiện tại (đã hoàn thành)
    } else if (!playerWon) {
         // Nếu thua, có thể reset level về 1 hoặc giữ nguyên tùy thiết kế
         // localStorage.setItem('tankGameLevel', 1); // Reset về level 1 khi thua?
    }

    // Dừng nhạc nền, phát âm thanh kết thúc (tùy chọn)
    if (assets.backgroundMusic) assets.backgroundMusic.pause();
    // playSound(playerWon ? assets.winSound : assets.loseSound);

    // Hiển thị thông báo
    const message = customMessage || (playerWon ? `Chiến thắng! Điểm: ${score}` : "Thất bại!");
    if (gameOverOverlay && gameOverMessageElement) {
        gameOverMessageElement.textContent = message;
        gameOverOverlay.style.display = 'flex'; // Hiển thị overlay
    } else {
        // Fallback nếu không có overlay: Vẽ trực tiếp lên canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '40px sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '20px sans-serif';
        ctx.fillText("Nhấn F5 hoặc Refresh để chơi lại", canvas.width / 2, canvas.height / 2 + 30);
    }
}

let lastTime = 0;
function gameLoop(timestamp) {
    if (gameIsOver && gameOverOverlay && gameOverOverlay.style.display === 'flex') {
       // Nếu game over và overlay đang hiển thị, không cần vẽ lại game nữa
       // Có thể dừng hẳn requestAnimationFrame nếu muốn tiết kiệm tài nguyên
       // return;
    }

    const deltaTime = timestamp - lastTime; // Thời gian giữa các frame (ms)
    lastTime = timestamp;

    // Chỉ update nếu game không bị dừng (ví dụ: khi tab không active)
    // và delta time hợp lệ (tránh delta quá lớn khi tab active trở lại)
    if (!gameIsOver && deltaTime > 0 && deltaTime < 500) { // Giới hạn delta time tối đa
        update(deltaTime / 16.67); // Chuẩn hóa deltaTime (chia cho ~60fps) nếu logic vật lý phụ thuộc vào nó
        // Hoặc đơn giản là update(); nếu vật lý không cần delta time chính xác
    }

    draw(); // Luôn vẽ để hiển thị trạng thái mới nhất (kể cả màn hình game over)

    requestAnimationFrame(gameLoop);
}

// --- Start the game ---
loadAssets(initGame); // Tải assets xong thì mới init game
