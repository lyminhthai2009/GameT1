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
const debugInfo = document.getElementById('debug-info'); // Tùy chọn

// --- Game Constants ---
const GRAVITY = 0.1; // Gia tốc trọng trường (điều chỉnh cho phù hợp)
const TANK_WIDTH = 50;
const TANK_HEIGHT = 30;
const BARREL_LENGTH = 40;
const BARREL_THICKNESS = 8;
const MOVE_SPEED = 2;
const MIN_ANGLE = 0;   // Góc thấp nhất (so với phương ngang)
const MAX_ANGLE = 90;  // Góc cao nhất
const MIN_POWER = 10;
const MAX_POWER = 100;
const POWER_STEP = 5;
const ANGLE_STEP = 2;

// --- Game State Variables ---
let playerTank;
let enemyTank;
let projectiles = []; // Mảng chứa các viên đạn đang bay
let obstacles = []; // Mảng chứa các vật cản
let terrain = []; // Mảng mô tả địa hình (sẽ phức tạp hơn nếu nhấp nhô)
let currentPlayer = 'player'; // 'player' or 'ai'
let score = 0;
let level = 1;
let wind = 0; // Âm là gió thổi sang trái, dương là sang phải
let isFiring = false; // Cờ đánh dấu đạn đang bay
let gameIsOver = false;

// --- Asset Loading (Images & Sounds) ---
let assets = {
    playerTankImg: null,
    enemyTankImg: null,
    backgroundImg: null,
    explosionSpritesheet: null, // Hoặc ảnh GIF
    fireSound: null,
    explosionSound: null,
    // Thêm các assets khác nếu cần
};
let assetsLoaded = 0;
let totalAssets = 5; // Cập nhật số lượng assets cần load

function loadAssets(callback) {
    console.log("Loading assets...");

    function assetLoaded() {
        assetsLoaded++;
        console.log(`Loaded ${assetsLoaded}/${totalAssets}`);
        if (assetsLoaded === totalAssets) {
            console.log("All assets loaded!");
            callback(); // Gọi hàm khởi tạo game khi load xong
        }
    }

    // Load Images
    assets.playerTankImg = new Image();
    assets.playerTankImg.src = 'assets/images/tank_player.png'; // Thay bằng đường dẫn thật
    assets.playerTankImg.onload = assetLoaded;
    assets.playerTankImg.onerror = () => { console.error("Error loading player tank image"); assetLoaded(); }; // Xử lý lỗi

    assets.enemyTankImg = new Image();
    assets.enemyTankImg.src = 'assets/images/tank_enemy.png';
    assets.enemyTankImg.onload = assetLoaded;
    assets.enemyTankImg.onerror = () => { console.error("Error loading enemy tank image"); assetLoaded(); };

    assets.backgroundImg = new Image();
    assets.backgroundImg.src = 'assets/images/background.png';
    assets.backgroundImg.onload = assetLoaded;
    assets.backgroundImg.onerror = () => { console.error("Error loading background image"); assetLoaded(); };

     // Load Explosion (ví dụ spritesheet - cần code thêm để xử lý animation)
    assets.explosionSpritesheet = new Image();
    assets.explosionSpritesheet.src = 'assets/images/explosion.png'; // Giả sử đây là spritesheet
    assets.explosionSpritesheet.onload = assetLoaded;
    assets.explosionSpritesheet.onerror = () => { console.error("Error loading explosion image"); assetLoaded(); };

    // Load Sounds
    assets.fireSound = new Audio('assets/sounds/fire.wav'); // Dùng Audio object
    assets.fireSound.oncanplaythrough = assetLoaded; // Event cho audio/video
    assets.fireSound.onerror = () => { console.error("Error loading fire sound"); assetLoaded(); };
    assets.fireSound.load(); // Cần gọi load() cho audio

    // Tương tự cho explosionSound và backgroundMusic...
    // assets.explosionSound = new Audio(...);
    // assets.explosionSound.oncanplaythrough = assetLoaded;
    // assets.explosionSound.onerror = ... ;
    // assets.explosionSound.load();

    // Tạm thời comment out sound để đủ totalAssets=5
    totalAssets = 4; // Chỉ load 4 image ví dụ
    // Sau khi thêm sound thì sửa totalAssets = 5 hoặc hơn

    console.log("Asset loading initiated...");
}


// --- Game Objects (Classes or Factory Functions) ---

class Tank {
    constructor(x, y, color, image) {
        this.x = x;
        this.y = y; // Tọa độ tâm đáy xe tăng
        this.width = TANK_WIDTH;
        this.height = TANK_HEIGHT;
        this.color = color; // Màu dự phòng nếu ảnh lỗi
        this.image = image;
        this.angle = 45; // Góc nòng súng (độ)
        this.power = 50;
        this.barrelOffsetX = this.width / 2; // Vị trí gốc nòng súng so với tâm x
        this.barrelOffsetY = -this.height / 2; // Vị trí gốc nòng súng so với tâm y
        this.health = 100; // Máu
    }

    draw(ctx) {
        // Tọa độ tâm đáy là (this.x, this.y)
        // Tọa độ vẽ ảnh sẽ là (this.x - this.width/2, this.y - this.height)

        // Draw Barrel first (behind tank body)
        ctx.save(); // Lưu trạng thái vẽ hiện tại
        ctx.translate(this.x + this.barrelOffsetX, this.y + this.barrelOffsetY); // Di chuyển gốc tọa độ đến gốc nòng súng
        ctx.rotate(-this.angle * Math.PI / 180); // Xoay canvas (góc âm vì trục Y hướng xuống)
        ctx.fillStyle = '#666'; // Màu nòng súng
        ctx.fillRect(0, -BARREL_THICKNESS / 2, BARREL_LENGTH, BARREL_THICKNESS); // Vẽ nòng súng
        ctx.restore(); // Khôi phục trạng thái vẽ

        // Draw Tank Body
        if (this.image && this.image.complete && this.image.naturalHeight !== 0) {
            ctx.drawImage(this.image, this.x - this.width / 2, this.y - this.height, this.width, this.height);
        } else {
            // Vẽ hình chữ nhật nếu ảnh chưa load xong hoặc lỗi
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.width / 2, this.y - this.height, this.width, this.height);
        }

        // Tùy chọn: Vẽ thanh máu
        if (this.health > 0) {
           const healthBarWidth = this.width;
           const healthBarHeight = 5;
           const healthBarX = this.x - healthBarWidth / 2;
           const healthBarY = this.y - this.height - healthBarHeight - 5; // Phía trên xe tăng
           ctx.fillStyle = 'red';
           ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
           ctx.fillStyle = 'green';
           ctx.fillRect(healthBarX, healthBarY, healthBarWidth * (this.health / 100), healthBarHeight);
        }
    }

    move(direction) {
        if (isFiring || gameIsOver) return; // Không di chuyển khi đang bắn hoặc game kết thúc

        const nextX = this.x + direction * MOVE_SPEED;
        const tankLeft = nextX - this.width / 2;
        const tankRight = nextX + this.width / 2;

        // Giới hạn di chuyển trong canvas và tránh vật cản (cần thêm logic kiểm tra va chạm vật cản)
        if (tankLeft > 0 && tankRight < canvas.width) {
             // Kiểm tra va chạm với địa hình/vật cản tại vị trí mới (chưa làm)
             // if (!checkCollisionWithTerrain(nextX, this.y) && !checkCollisionWithObstacles(nextX, this.y)) {
                 this.x = nextX;
             // }
        }
    }

    adjustAngle(amount) {
        if (isFiring || gameIsOver) return;
        this.angle += amount;
        this.angle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, this.angle)); // Giới hạn góc
        updateUI(); // Cập nhật hiển thị góc
    }

    adjustPower(amount) {
        if (isFiring || gameIsOver) return;
        this.power += amount;
        this.power = Math.max(MIN_POWER, Math.min(MAX_POWER, this.power)); // Giới hạn lực
        updateUI(); // Cập nhật hiển thị lực
    }

    getBarrelEnd() {
        // Tính toán đầu nòng súng để biết vị trí bắt đầu của viên đạn
        const angleRad = -this.angle * Math.PI / 180; // Góc radian (âm vì trục Y hướng xuống)
        const barrelEndX = this.x + this.barrelOffsetX + Math.cos(angleRad) * BARREL_LENGTH;
        const barrelEndY = this.y + this.barrelOffsetY + Math.sin(angleRad) * BARREL_LENGTH;
        return { x: barrelEndX, y: barrelEndY };
    }
}

class Projectile {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx; // Vận tốc theo trục X
        this.vy = vy; // Vận tốc theo trục Y
        this.radius = 5; // Kích thước viên đạn
        this.trail = []; // Lưu vị trí cũ để vẽ vệt
        this.trailLength = 20; // Độ dài vệt
    }

    update() {
        // Cập nhật vị trí dựa trên vận tốc
        this.x += this.vx;
        this.y += this.vy;

        // Thêm hiệu ứng gió
        this.vx += wind / 50; // Chia cho một hệ số để gió không quá mạnh

        // Thêm gia tốc trọng trường
        this.vy += GRAVITY;

        // Lưu vị trí vào vệt
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailLength) {
            this.trail.shift(); // Xóa điểm cũ nhất
        }
    }

    draw(ctx) {
        // Vẽ vệt đạn
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Màu trắng mờ
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Vẽ viên đạn
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- Game Logic Functions ---

function initGame() {
    console.log("Initializing game...");
    // Thiết lập kích thước Canvas phù hợp với wrapper
    resizeCanvas();

    score = 0;
    level = 1;
    gameIsOver = false;
    isFiring = false;
    projectiles = []; // Reset đạn

    // Khởi tạo level đầu tiên
    setupLevel(level);

    // Gán sự kiện cho các nút điều khiển
    setupControls();

    // Bắt đầu vòng lặp game
    gameLoop();
    console.log("Game initialized and loop started.");
}

function resizeCanvas() {
     const wrapper = document.getElementById('game-wrapper');
     // Lấy kích thước của container, trừ đi padding nếu có
     const availableWidth = wrapper.clientWidth - 20; // Trừ padding L+R
     // Tính chiều cao dựa trên tỷ lệ aspect-ratio đã đặt trong CSS
     const aspectRatio = 4 / 3;
     canvas.width = availableWidth;
     canvas.height = availableWidth / aspectRatio;

     // Cập nhật lại vị trí các đối tượng nếu cần sau khi resize
     // (ví dụ: đặt lại xe tăng vào vị trí tương đối)
     // Nếu đang chơi dở mà resize thì phức tạp hơn
     console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
     // Vẽ lại ngay lập tức để tránh màn hình trống
     if (playerTank && enemyTank) { // Chỉ vẽ lại nếu game đã init
        draw();
     }
}


function setupLevel(levelNumber) {
    console.log(`Setting up level ${levelNumber}`);
    // Đặt vị trí xe tăng, vật cản, địa hình dựa trên level
    // Ví dụ đơn giản:
    const padding = 80; // Khoảng cách từ mép
    const groundY = canvas.height - 20; // Mặt đất phẳng đơn giản

    playerTank = new Tank(
        padding,
        groundY,
        'blue',
        assets.playerTankImg
    );

    enemyTank = new Tank(
        canvas.width - padding,
        groundY,
        'red',
        assets.enemyTankImg
    );

    // Reset góc/lực ban đầu (tùy chọn)
    playerTank.angle = 45;
    playerTank.power = 50;
    enemyTank.angle = 135; // Hướng về người chơi
    enemyTank.power = 50;

    // Tạo địa hình phẳng đơn giản
    terrain = [
        { x: 0, y: groundY },
        { x: canvas.width, y: groundY }
    ];

    // Tạo vật cản (ví dụ)
    obstacles = [];
    if (levelNumber > 1) {
        obstacles.push({
            x: canvas.width / 2 - 25,
            y: groundY - 100, // Nhô lên từ mặt đất
            width: 50,
            height: 100
        });
    }

    // Tạo gió ngẫu nhiên
    wind = (Math.random() - 0.5) * 10; // Gió từ -5 đến +5 (điều chỉnh)
    windSpeedElement.textContent = Math.abs(wind).toFixed(1);
    windDirectionElement.textContent = wind > 0 ? '->' : (wind < 0 ? '<-' : '-');


    // Reset trạng thái lượt chơi
    currentPlayer = 'player';
    isFiring = false;
    projectiles = [];
    gameIsOver = false;

    updateUI();
    console.log("Level setup complete.");
}

function setupControls() {
    console.log("Setting up controls...");
    document.getElementById('btn-move-left').onclick = () => playerTank.move(-1);
    document.getElementById('btn-move-right').onclick = () => playerTank.move(1);
    document.getElementById('btn-angle-down').onclick = () => playerTank.adjustAngle(-ANGLE_STEP);
    document.getElementById('btn-angle-up').onclick = () => playerTank.adjustAngle(ANGLE_STEP);
    document.getElementById('btn-power-down').onclick = () => playerTank.adjustPower(-POWER_STEP);
    document.getElementById('btn-power-up').onclick = () => playerTank.adjustPower(POWER_STEP);
    document.getElementById('btn-fire').onclick = handleFire;

    // Thêm điều khiển bàn phím (ví dụ)
    window.addEventListener('keydown', (e) => {
        if (currentPlayer !== 'player' || isFiring || gameIsOver) return; // Chỉ cho phép khi đến lượt và không đang bắn

        switch (e.key) {
            case 'ArrowLeft':
                playerTank.move(-1);
                break;
            case 'ArrowRight':
                playerTank.move(1);
                break;
            case 'ArrowUp':
                playerTank.adjustAngle(ANGLE_STEP);
                break;
            case 'ArrowDown':
                playerTank.adjustAngle(-ANGLE_STEP);
                break;
             case 'PageUp': // Ví dụ tăng lực
                 playerTank.adjustPower(POWER_STEP);
                 break;
             case 'PageDown': // Ví dụ giảm lực
                 playerTank.adjustPower(-POWER_STEP);
                 break;
            case ' ': // Phím cách để bắn
            case 'Enter':
                e.preventDefault(); // Ngăn hành vi mặc định (vd: scroll)
                handleFire();
                break;
        }
    });

    // Lắng nghe sự kiện resize để điều chỉnh canvas
    window.addEventListener('resize', resizeCanvas);
    console.log("Controls setup complete.");
}

function updateUI() {
    if (!playerTank || !enemyTank) return; // Đảm bảo tank đã được khởi tạo

    scoreElement.textContent = score;
    levelElement.textContent = level;
    playerTurnElement.textContent = `Lượt của: ${currentPlayer === 'player' ? 'Bạn' : 'Đối thủ'}`;
    angleDisplay.textContent = playerTank.angle.toFixed(0); // Chỉ hiện góc của người chơi
    powerDisplay.textContent = playerTank.power.toFixed(0); // Chỉ hiện lực của người chơi

    // Cập nhật thông tin gió
    windSpeedElement.textContent = Math.abs(wind).toFixed(1);
    windDirectionElement.textContent = wind > 0 ? '->' : (wind < 0 ? '<-' : '-');
}

function handleFire() {
    if (isFiring || gameIsOver) return; // Không bắn nếu đang có đạn bay hoặc game kết thúc
    if (currentPlayer === 'player') {
        fire(playerTank);
    } else {
        // AI turn - Bỏ qua nút bấm nếu là lượt AI (sẽ gọi fire từ aiTurn)
    }
}

function fire(tank) {
    if (isFiring || gameIsOver) return;

    console.log(`${tank === playerTank ? 'Player' : 'AI'} firing! Angle: ${tank.angle}, Power: ${tank.power}`);
    isFiring = true; // Đánh dấu đang bắn

    const barrelEnd = tank.getBarrelEnd();
    const angleRad = -tank.angle * Math.PI / 180; // Radian, âm vì Y hướng xuống
    const initialVelocity = tank.power / 5; // Điều chỉnh tỷ lệ này

    const vx = Math.cos(angleRad) * initialVelocity;
    const vy = Math.sin(angleRad) * initialVelocity;

    projectiles.push(new Projectile(barrelEnd.x, barrelEnd.y, vx, vy));

    // Phát âm thanh bắn
    if (assets.fireSound) {
        assets.fireSound.currentTime = 0; // Tua về đầu để phát lại nếu cần
        assets.fireSound.play().catch(e => console.warn("Sound play interrupted:", e));
    }

    // Vô hiệu hóa điều khiển tạm thời (tùy chọn)
    toggleControls(false);
}

function toggleControls(enabled) {
     const buttons = document.querySelectorAll('#controls button');
     buttons.forEach(button => button.disabled = !enabled);
     // Có thể thêm class để làm mờ nút đi
}


function update() {
    if (gameIsOver) return;

    // Cập nhật đạn
    if (isFiring) {
        projectiles.forEach((p, index) => {
            p.update();

            // --- Kiểm tra va chạm ---
            let hit = false;
            let targetHit = null; // 'player', 'ai', 'terrain', 'obstacle'

            // 1. Va chạm với mặt đất/địa hình (đơn giản là y > groundY)
            if (p.y > canvas.height - 20) { // Giả sử mặt đất phẳng
                hit = true;
                targetHit = 'terrain';
            }

            // 2. Va chạm với vật cản
            obstacles.forEach(obs => {
                if (p.x >= obs.x && p.x <= obs.x + obs.width &&
                    p.y >= obs.y && p.y <= obs.y + obs.height) {
                    hit = true;
                    targetHit = 'obstacle';
                    // Có thể thêm hiệu ứng phá hủy vật cản ở đây
                }
            });

            // 3. Va chạm với xe tăng địch (nếu người chơi bắn)
            if (currentPlayer === 'player') {
                if (checkTankHit(p, enemyTank)) {
                    hit = true;
                    targetHit = 'ai';
                    handleHit(enemyTank, p); // Xử lý khi bắn trúng AI
                }
            }
            // 4. Va chạm với xe tăng người chơi (nếu AI bắn)
            else if (currentPlayer === 'ai') {
                 if (checkTankHit(p, playerTank)) {
                    hit = true;
                    targetHit = 'player';
                    handleHit(playerTank, p); // Xử lý khi bắn trúng Player
                 }
            }

             // 5. Ra khỏi màn hình (bên trái, phải, hoặc bay quá cao)
             if (p.x < 0 || p.x > canvas.width || p.y < -canvas.height) { // Bay quá cao hoặc ra biên
                 hit = true; // Coi như bắn trượt và kết thúc lượt
                 targetHit = 'outofbounds';
             }


            // Xử lý khi đạn chạm đích
            if (hit) {
                console.log(`Projectile hit: ${targetHit}`);
                projectiles.splice(index, 1); // Xóa đạn khỏi mảng

                 // Tạo hiệu ứng nổ (cần vẽ trong hàm draw)
                 createExplosion(p.x, p.y);

                // Phát âm thanh nổ
                if (assets.explosionSound) {
                    assets.explosionSound.currentTime = 0;
                    assets.explosionSound.play().catch(e => console.warn("Explosion sound play interrupted:", e));
                }

                 // Nếu không trúng tank nào, chuyển lượt
                 if (targetHit !== 'player' && targetHit !== 'ai') {
                    isFiring = false; // Kết thúc trạng thái bắn
                    switchTurn();
                 }
                 // Nếu trúng tank, hàm handleHit sẽ xử lý tiếp (có thể kết thúc game hoặc chuyển lượt)
            }
        });
    } else {
        // Nếu không có đạn đang bay và là lượt AI, thì AI bắn
        if (currentPlayer === 'ai') {
            aiTurn();
        }
    }
}

function checkTankHit(projectile, tank) {
    // Kiểm tra va chạm hình tròn (đạn) và hình chữ nhật (xe tăng) đơn giản
    const tankLeft = tank.x - tank.width / 2;
    const tankRight = tank.x + tank.width / 2;
    const tankTop = tank.y - tank.height;
    const tankBottom = tank.y;

    return projectile.x + projectile.radius > tankLeft &&
           projectile.x - projectile.radius < tankRight &&
           projectile.y + projectile.radius > tankTop &&
           projectile.y - projectile.radius < tankBottom;
}

function handleHit(tank, projectile) {
     // Giảm máu, kiểm tra game over, chuyển lượt
     const damage = 30 + Math.random() * 10; // Sát thương cơ bản + ngẫu nhiên
     tank.health -= damage;
     tank.health = Math.max(0, tank.health); // Đảm bảo máu không âm

     console.log(`${tank === playerTank ? 'Player' : 'AI'} hit! Health left: ${tank.health}`);

     if (tank.health <= 0) {
         // Game Over
         gameOver(currentPlayer === 'player' ? 'Bạn thắng!' : 'Đối thủ thắng!');
     } else {
         // Chưa kết thúc, chuyển lượt
         isFiring = false; // Kết thúc trạng thái bắn sau khi xử lý hit
         switchTurn();
     }
}

function createExplosion(x, y) {
    // Logic để tạo hiệu ứng nổ tại vị trí (x, y)
    // Có thể dùng một đối tượng Explosion với animation (vẽ từng frame của spritesheet)
    // Hoặc đơn giản là vẽ một vòng tròn lớn dần rồi mờ đi
    console.log(`Creating explosion at ${x.toFixed(1)}, ${y.toFixed(1)}`);
    // Thêm vào một mảng explosions để vẽ trong hàm draw()
    // Ví dụ đơn giản:
    // activeExplosions.push({ x: x, y: y, radius: 10, maxRadius: 50, life: 30 });
    // Trong draw(): vẽ các activeExplosions và giảm life của chúng
}


function switchTurn() {
    if (gameIsOver) return;

    console.log("Switching turn...");
    currentPlayer = (currentPlayer === 'player') ? 'ai' : 'player';
    isFiring = false; // Đảm bảo trạng thái bắn được reset
    updateUI();

    // Kích hoạt lại controls nếu là lượt người chơi
    if (currentPlayer === 'player') {
        toggleControls(true);
    } else {
        toggleControls(false); // Vô hiệu hóa khi AI chơi
        // Có thể thêm độ trễ nhỏ trước khi AI bắn
        // setTimeout(aiTurn, 1000); // AI bắn sau 1 giây
    }
    console.log(`Current turn: ${currentPlayer}`);
}

function aiTurn() {
    if (isFiring || gameIsOver || currentPlayer !== 'ai') return;

    console.log("AI's turn...");

    // --- AI Logic (đơn giản -> phức tạp) ---

    // 1. Đơn giản: Bắn ngẫu nhiên góc và lực trong một khoảng nào đó
    // enemyTank.angle = 90 + Math.random() * 90; // Góc từ 90-180 (hướng về player)
    // enemyTank.power = MIN_POWER + Math.random() * (MAX_POWER - MIN_POWER);

    // 2. Thông minh hơn: Tính toán góc/lực cơ bản (cần công thức vật lý) + thêm sai số
    // Đây là phần phức tạp, cần giải phương trình đường đạn để tìm góc/lực
    // Ước lượng khoảng cách
    const dx = playerTank.x - enemyTank.x;
    const dy = playerTank.y - enemyTank.y; // Chú ý y tăng xuống dưới

    // Công thức vật lý (bỏ qua gió, địa hình để đơn giản ban đầu):
    // Tìm góc theta để bắn trúng (x, y) với vận tốc v
    // x = v*cos(theta)*t
    // y = v*sin(theta)*t - 0.5*g*t^2
    // Cần giải hệ phương trình này hoặc dùng phương pháp thử và sai (iterative approach)

    // Tạm thời dùng AI đơn giản hơn: Hơi ngẫu nhiên dựa trên lần bắn trước hoặc vị trí địch
    let targetAngle = 135; // Mặc định hướng chung
    let targetPower = 60;  // Mặc định lực

    // Ước lượng góc dựa trên vị trí tương đối
    const angleToTargetRad = Math.atan2(-(playerTank.y - enemyTank.y), playerTank.x - enemyTank.x);
    targetAngle = angleToTargetRad * 180 / Math.PI;
    if (targetAngle < 0) targetAngle += 180; // AI chỉ bắn trong khoảng 0-180 (nếu đứng bên phải)


    // Thêm sai số ngẫu nhiên
    enemyTank.angle = targetAngle + (Math.random() - 0.5) * 20; // Sai số +/- 10 độ
    enemyTank.power = targetPower + (Math.random() - 0.5) * 30; // Sai số +/- 15 lực

    // Giới hạn lại giá trị sau khi thêm sai số
     enemyTank.angle = Math.max(91, Math.min(179, enemyTank.angle)); // Đảm bảo hướng về bên trái
     enemyTank.power = Math.max(MIN_POWER, Math.min(MAX_POWER, enemyTank.power));


    console.log(`AI aims - Angle: ${enemyTank.angle.toFixed(1)}, Power: ${enemyTank.power.toFixed(1)}`);

    // Bắn sau một khoảng trễ nhỏ để mô phỏng suy nghĩ
    setTimeout(() => {
         if (currentPlayer === 'ai' && !isFiring && !gameIsOver) { // Kiểm tra lại trạng thái trước khi bắn
             fire(enemyTank);
         }
    }, 500 + Math.random() * 1000); // Trễ 0.5 - 1.5 giây
}

function draw() {
    // Xóa canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Vẽ nền (nếu có ảnh nền)
    if (assets.backgroundImg && assets.backgroundImg.complete) {
        ctx.drawImage(assets.backgroundImg, 0, 0, canvas.width, canvas.height);
    } else {
        // Vẽ màu nền mặc định nếu không có ảnh
        ctx.fillStyle = '#87CEEB'; // Màu trời
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

     // Vẽ địa hình (hiện tại là đường thẳng)
     ctx.fillStyle = '#228B22'; // Màu đất
     ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

    // Vẽ vật cản
    ctx.fillStyle = '#A0522D'; // Màu gỗ/đất
    obstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    });

    // Vẽ xe tăng
    if (playerTank) playerTank.draw(ctx);
    if (enemyTank) enemyTank.draw(ctx);

    // Vẽ đạn
    projectiles.forEach(p => p.draw(ctx));

    // Vẽ hiệu ứng nổ (nếu có - cần logic quản lý explosion)

    // Vẽ thông tin debug (tùy chọn)
    if (debugInfo && playerTank && projectiles.length > 0) {
        const p = projectiles[0];
        debugInfo.textContent = `Player: (${playerTank.x.toFixed(1)}, ${playerTank.y.toFixed(1)}) | AI: (${enemyTank.x.toFixed(1)}, ${enemyTank.y.toFixed(1)}) | Proj: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) vx:${p.vx.toFixed(1)} vy:${p.vy.toFixed(1)}`;
    } else if (debugInfo) {
         debugInfo.textContent = '';
    }
}

function gameOver(message) {
    console.log(`Game Over: ${message}`);
    gameIsOver = true;
    isFiring = false; // Dừng mọi hoạt động bắn
    toggleControls(false); // Vô hiệu hóa điều khiển

    // Hiển thị thông báo kết thúc trên màn hình
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '40px sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '20px sans-serif';
    ctx.fillText("Nhấn F5 để chơi lại", canvas.width / 2, canvas.height / 2 + 20);

    // Lưu điểm cao nếu cần (dùng localStorage)
    // saveHighScore(score);
}

function gameLoop() {
    if (gameIsOver) return; // Dừng vòng lặp nếu game đã kết thúc

    update(); // Cập nhật trạng thái game
    draw();   // Vẽ lại game

    requestAnimationFrame(gameLoop); // Lặp lại ở frame tiếp theo
}

// --- Start the game after assets are loaded ---
// Chờ load xong assets rồi mới khởi tạo game
loadAssets(initGame);

// --- Lưu điểm (localStorage - ví dụ) ---
function saveHighScore(newScore) {
    let highScore = localStorage.getItem('tankGameHighScore') || 0;
    if (newScore > highScore) {
        localStorage.setItem('tankGameHighScore', newScore);
        console.log(`New high score saved: ${newScore}`);
    }
}

function loadHighScore() {
    return localStorage.getItem('tankGameHighScore') || 0;
}

// --- Địa hình phức tạp (Ý tưởng) ---
// Thay vì đường thẳng, `terrain` có thể là một mảng các điểm {x, y}
// function generateTerrain() { ... } // Tạo địa hình nhấp nhô
// function drawTerrain() { ... } // Vẽ địa hình bằng cách nối các điểm
// function checkCollisionWithTerrain(x, y) { ... } // Kiểm tra va chạm với địa hình
// function destroyTerrain(x, y, radius) { ... } // Phá hủy địa hình khi nổ

// --- Nhiều loại đạn (Ý tưởng) ---
// Thay đổi lớp Projectile hoặc tạo lớp con
// Thêm thuộc tính `type` cho đạn
// Thay đổi cách update/checkCollision/handleHit tùy loại đạn