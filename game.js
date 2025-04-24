const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let enemyDirection = 1;
let enemySpeed = 1;

let player, keysPressed, score, lives, timer, startTime, enemies = [], bullets = [], enemyBullets = [], speedLevel = 1, maxSpeedLevel = 4;
let gameInterval;

let enemyBullet = null;
let lastShotTime = 0;
const shootCooldown = 300;

let scoreHistory = [];
let currentPlayer = null;

let lastSpeedIncreaseTime = Date.now();
let enemyBulletSpeed = 3;

function rungame(fromNewGame = false) {
    if (fromNewGame) {
        clearInterval(gameInterval);
    }

    document.getElementById("backgroundMusic").play();

    score = 0;
    lives = 3;
    keysPressed = {};
    bullets = [];
    enemyBullets = [];
    startTime = Date.now();
    player = {
        x: Math.random() * (canvas.width - 280),
        y: canvas.height - 40,
        width: 40,
        height: 40,
        color: playerSettings.shipColor,
        speed: 5
    };

    enemySpeed = 1;
    enemyBulletSpeed = 3;
    speedLevel = 1;
    lastSpeedIncreaseTime = Date.now();
    enemyDirection = 1;
    enemyBullet = null;
    lastShotTime = 0;

    initEnemies();
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, 1000 / 60);
    updateTimeDisplay();
}

function shootBullet() {
    bullets.push({
        x: player.x + player.width / 2 - 2.5,
        y: player.y,
        width: 5,
        height: 10,
        speed: 7
    });
}

function checkBulletEnemyCollisions() {
    bullets.forEach((bullet, bulletIndex) => {
        enemies.forEach((enemy, enemyIndex) => {
            if (enemy.alive &&
                bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {

                // Bullet hit enemy
                enemy.alive = false;
                document.getElementById("hitSound").play();
                bullets.splice(bulletIndex, 1); // Remove bullet
                const rowPoints = [20, 15, 10, 5];
                score += rowPoints[enemy.row];
            }
        });
    });
}

function initEnemies() {
    enemies = [];
    const rows = 4, cols = 5, spacing = 70;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            enemies.push({
                x: 100 + c * spacing,
                y: 50 + r * 50,
                width: 40,
                height: 30,
                alive: true,
                row: r
            });
        }
    }
}

function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y); // Top
    ctx.lineTo(player.x, player.y + player.height);    // Bottom left
    ctx.lineTo(player.x + player.width, player.y + player.height); // Bottom right
    ctx.closePath();
    ctx.fill();
}

function movePlayer() {
    if (keysPressed["ArrowLeft"] && player.x > 0) player.x -= player.speed;
    if (keysPressed["ArrowRight"] && player.x < canvas.width - 280) player.x += player.speed;

    const lowerBound = canvas.height;
    const upperBound = canvas.height * 0.6;

    if (keysPressed["ArrowUp"] && player.y > upperBound) {
        player.y -= player.speed;
    }

    if (keysPressed["ArrowDown"] && player.y + player.height < lowerBound) {
        player.y += player.speed;
    }
}
function drawRestrictedAreaLine() {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 280);
    ctx.lineTo(canvas.width - 280, canvas.height - 280);
    ctx.stroke();
}

function moveEnemies() {
    let edgeReachedX = false;
    let edgeReachedY = false;

    enemies.forEach(e => {
        if (!e.alive) return;

        e.x += enemySpeed * enemyDirection;
        e.y += 0.05 * enemyDirection; // subtle Y movement to simulate drifting

        if (e.x + e.width >= canvas.width || e.x <= 0) {
            edgeReachedX = true;
        }
        if (e.y + e.height >= canvas.height || e.y <= 0) {
            edgeReachedY = true;
        }
    });

    if (edgeReachedX || edgeReachedY) {
        enemyDirection *= -1;
    }
}


function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRestrictedAreaLine();

    movePlayer();
    drawPlayer();

    // Handle shooting with cooldown
    const now = Date.now();
    if (keysPressed[playerSettings.shootKey] && now - lastShotTime > shootCooldown) {
        shootBullet();
        lastShotTime = now;
    }

    // Move and draw bullets
    bullets = bullets.filter(b => b.y > 0);
    bullets.forEach(bullet => {
        bullet.y -= bullet.speed;
        ctx.fillStyle = "yellow";
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });
    checkBulletEnemyCollisions();
    if (enemies.every(e => !e.alive)) {
        endGame("cleared");
    }

    const currentTime = Date.now();
    if (currentTime - lastSpeedIncreaseTime >= 5000 && speedLevel < maxSpeedLevel) {
        enemySpeed += 0.5;
        enemyBulletSpeed += 0.5;
        speedLevel++;
        lastSpeedIncreaseTime = currentTime;
    }
    drawEnemies();
    moveEnemies();
    handleEnemyBullet();
    drawUI();
    updateTimeDisplay();
}

function handleEnemyBullet() {
    // Move existing bullets
    enemyBullets.forEach((bullet, index) => {
        bullet.y += bullet.speed;
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, 5, 0, Math.PI * 2);
        ctx.fill();
        // Check collision with player
        if (
            bullet.x < player.x + player.width &&
            bullet.x + bullet.width > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + bullet.height > player.y
        ) {
            lives--;
            if (lives <= 0) {
                endGame("disqualified");
            } else {
                resetPlayerPosition();
            }
            enemyBullets.splice(index, 1); // Remove bullet on hit
            return;
        }
        // Fire another bullet at 75% screen height
        if (!bullet.firedNext && bullet.y >= canvas.height * 0.75) {
            bullet.firedNext = true;
            fireEnemyBullet(); // Fire a new one
        }
        // Remove if off-screen (100%)
        if (bullet.y > canvas.height) {
            enemyBullets.splice(index, 1);
        }
    });

    // If no bullets at all, shoot at least one
    if (enemyBullets.length === 0) {
        fireEnemyBullet();
    }
}

function fireEnemyBullet() {
    const shooters = enemies.filter(e => e.alive);
    if (shooters.length) {
        const shooter = shooters[Math.floor(Math.random() * shooters.length)];
        enemyBullets.push({
            x: shooter.x + shooter.width / 2 - 2.5,
            y: shooter.y + shooter.height,
            width: 5,
            height: 10,
            speed: enemyBulletSpeed,
            firedNext: false
        });
    }
}

function resetPlayerPosition() {
    player.x = Math.random() * (canvas.width - 280);
    player.y = canvas.height - 40;
}

function drawEnemies() {
    enemies.forEach(e => {
        if (e.alive) {
            switch (e.row) {
                case 0: ctx.fillStyle = "#ff0000"; break; // 20 pts
                case 1: ctx.fillStyle = "#ff7f00"; break; // 15 pts
                case 2: ctx.fillStyle = "#ffff00"; break; // 10 pts
                case 3: ctx.fillStyle = "#00ff00"; break; // 5 pts
            }
            ctx.fillRect(e.x, e.y, e.width, e.height);
        }
    });
}

function drawUI() {
    document.getElementById("score").textContent = score;
    document.getElementById("lives").textContent = lives;
}

function updateTimeDisplay() {
    let elapsed = Math.floor((Date.now() - startTime) / 1000);
    let remaining = Math.max(0, playerSettings.gameTime * 60 - elapsed);
    let mins = Math.floor(remaining / 60);
    let secs = remaining % 60;
    document.getElementById("timeLeft").textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    if (remaining <= 0) endGame("time");
}

function endGame(reason) {
    clearInterval(gameInterval);
    let msg = "";

    document.getElementById("backgroundMusic").pause();

    if (reason === "disqualified") {
        document.getElementById("loseSound").play();
        msg = "You Lost!";
    } else if (reason === "time") {
        msg = score >= 100 ? "Winner!" : `You can do better. Your score: ${score}`;
    } else if (reason === "cleared") {
        msg = "Champion!";
    }

    // Save score only for completed games
    if (reason === "cleared" || reason === "disqualified" || reason === "time") {
        scoreHistory.push(score);
        scoreHistory.sort((a, b) => b - a); // High-to-low
        const position = scoreHistory.indexOf(score) + 1;
        msg += `\nYour Scores: ${scoreHistory.join(', ')}\nYour Rank: #${position}`;
    }

    alert(msg);
}

document.addEventListener("keydown", function (e) {
    if (e.key === playerSettings.shootKey) {
        // Call your shooting function here
        shoot();
    }
});

document.addEventListener("keydown", e => keysPressed[e.key] = true);
document.addEventListener("keyup", e => keysPressed[e.key] = false);