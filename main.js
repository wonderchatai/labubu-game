// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.labubuState = {
            hunger: 100,
            happiness: 100,
            hygiene: 100,
            energy: 100,
            money: 50, 
            lastUpdated: Date.now(),
            lastRentPaid: Date.now(), 
            lastMedicalBillPaid: Date.now(),
            inflationLevel: 0, // 0 = normal, 1 = moderate, 2 = high
            feedCost: 10, // Dynamic feed cost
            playCost: 5 // Dynamic play cost
        };
        this.actionTimers = {
            eating: 0,
            playing: 0,
            sleeping: 0,
            working: 0 
        };
        this.isInteracting = false;
        this.isGameOver = false;

        // Game constants
        this.BASE_FEED_COST = 10;
        this.BASE_PLAY_COST = 5;
        this.WORK_EARNINGS = 20;
        this.RENT_COST = 50;
        this.RENT_INTERVAL_MS = 30000; 
        this.MEDICAL_BILL_COST = 30;
        this.MEDICAL_INTERVAL_MS = 90000; 

        // Inflation configuration
        this.INFLATION_INTERVAL_MS = 120000; // Inflation event every 2 minutes for testing
        this.INFLATION_FEED_INCREASE = 5;
        this.INFLATION_PLAY_INCREASE = 3;

        this.notificationText = null; 
    }

    preload() {
        this.load.image('labubu_idle', 'assets/labubu_idle.png');
        this.load.image('labubu_happy', 'assets/labubu_happy.png');
        this.load.image('labubu_sad', 'assets/labubu_sad.png');
        this.load.image('labubu_eating', 'assets/labubu_eating.png');
        this.load.image('labubu_sleeping', 'assets/labubu_sleeping.png');
    }

    create() {
        // Center Labubu
        // Adjusted vertical position slightly due to reduced game height
        this.labubuSprite = this.add.sprite(this.scale.width / 2, this.scale.height / 2 + 20, 'labubu_idle').setScale(0.5);

        this.loadGame();
        this.calculateOfflineProgression();

        // Initialize dynamic costs based on loaded state
        if (this.labubuState.feedCost === undefined) this.labubuState.feedCost = this.BASE_FEED_COST;
        if (this.labubuState.playCost === undefined) this.labubuState.playCost = this.BASE_PLAY_COST;

        // Timers for stat degradation (increased difficulty)
        this.degradationTimers = [];
        this.degradationTimers.push(this.time.addEvent({
            delay: 10000, 
            callback: () => { this.labubuState.hunger = Math.max(0, this.labubuState.hunger - 5); },
            loop: true
        }));
        this.degradationTimers.push(this.time.addEvent({
            delay: 15000, 
            callback: () => { this.labubuState.happiness = Math.max(0, this.labubuState.happiness - 4); },
            loop: true
        }));
         this.degradationTimers.push(this.time.addEvent({
            delay: 20000, 
            callback: () => { this.labubuState.hygiene = Math.max(0, this.labubuState.hygiene - 3); },
            loop: true
        }));
        this.degradationTimers.push(this.time.addEvent({
            delay: 20000, 
            callback: () => { this.labubuState.energy = Math.max(0, this.labubuState.energy - 2); },
            loop: true
        }));

        // Timers for periodic charges
        this.degradationTimers.push(this.time.addEvent({
            delay: this.RENT_INTERVAL_MS,
            callback: this.payRent,
            callbackScope: this,
            loop: true
        }));
        this.degradationTimers.push(this.time.addEvent({
            delay: this.MEDICAL_INTERVAL_MS,
            callback: this.payMedicalBill,
            callbackScope: this,
            loop: true
        }));

        // New: Inflation event timer
        this.degradationTimers.push(this.time.addEvent({
            delay: this.INFLATION_INTERVAL_MS,
            callback: this.triggerInflation,
            callbackScope: this,
            loop: true
        }));

        // Save progress every 5 seconds
        this.time.addEvent({
            delay: 5000,
            callback: this.saveGame,
            callbackScope: this,
            loop: true
        });

        this.setupUI();
        this.checkGameOver();

        // Initial resize call and event listener
        this.scale.on('resize', this.resize, this);
        this.resize(this.game.scale, { width: 360, height: 500 }); // Initial call with current dimensions
    }

    update(time, delta) {
        if (this.isGameOver) return;

        this.updateUI();
        this.updateLabubuSprite();

        let anyActionActive = false;
        for (const action in this.actionTimers) {
            if (this.actionTimers[action] > 0) {
                this.actionTimers[action] -= delta;
                anyActionActive = true;
            } else {
                this.actionTimers[action] = 0; 
            }
        }
        this.isInteracting = anyActionActive;

        this.checkGameOver();
    }

    setupUI() {
        document.getElementById('feed-button').addEventListener('click', () => {
            if (this.isGameOver || this.labubuState.money < this.labubuState.feedCost || this.actionTimers.sleeping > 0) return;
            this.labubuState.money -= this.labubuState.feedCost; 
            this.labubuState.hunger = Math.min(100, this.labubuState.hunger + 25); 
            this.actionTimers.eating = 2000; 
            this.saveGame();
        });
        document.getElementById('play-button').addEventListener('click', () => {
            if (this.isGameOver || this.labubuState.money < this.labubuState.playCost || this.actionTimers.sleeping > 0) return;
            this.labubuState.money -= this.labubuState.playCost; 
            this.labubuState.happiness = Math.min(100, this.labubuState.happiness + 20); 
            this.labubuState.energy = Math.max(0, this.labubuState.energy - 10); 
            this.actionTimers.playing = 2000;
            this.saveGame();
        });
        document.getElementById('clean-button').addEventListener('click', () => {
            if (this.isGameOver || this.actionTimers.sleeping > 0) return; 
            this.labubuState.hygiene = Math.min(100, this.labubuState.hygiene + 30); 
            this.saveGame();
        });
        document.getElementById('sleep-button').addEventListener('click', () => {
            if (this.isGameOver || this.actionTimers.sleeping > 0) return; 
             this.actionTimers.sleeping = 10000; 
             this.time.delayedCall(10000, () => {
                this.labubuState.energy = 100;
                this.saveGame();
             });
        });
        document.getElementById('work-button').addEventListener('click', () => {
            if (this.isGameOver || this.labubuState.energy < 20 || this.actionTimers.sleeping > 0) return; 
            this.labubuState.money += this.WORK_EARNINGS; 
            this.labubuState.energy = Math.max(0, this.labubuState.energy - 30); 
            this.labubuState.happiness = Math.max(0, this.labubuState.happiness - 10); 
            this.actionTimers.working = 3000; 
            this.saveGame();
        });

        // Add restart button
        let restartButton = document.createElement('button');
        restartButton.id = 'restart-button';
        restartButton.textContent = 'Restart Game';
        restartButton.style.display = 'none'; 
        document.getElementById('actions-container').appendChild(restartButton);

        restartButton.addEventListener('click', () => {
            localStorage.removeItem('labubuSaveData');
            window.location.reload(); 
        });
    }

    updateUI() {
        const isSleeping = this.actionTimers.sleeping > 0;

        document.getElementById('money-amount').textContent = this.labubuState.money;

        // Update button texts with current costs
        document.getElementById('feed-button').textContent = `Feed ($${this.labubuState.feedCost})`;
        document.getElementById('play-button').textContent = `Play ($${this.labubuState.playCost})`;

        document.getElementById('hunger-bar').style.width = this.labubuState.hunger + '%';
        document.getElementById('happiness-bar').style.width = this.labubuState.happiness + '%';
        document.getElementById('hygiene-bar').style.width = this.labubuState.hygiene + '%';
        document.getElementById('energy-bar').style.width = this.labubuState.energy + '%';

        // Update progress bar colors based on stat levels
        this.setProgressBarColor('hunger-bar', this.labubuState.hunger);
        this.setProgressBarColor('happiness-bar', this.labubuState.happiness);
        this.setProgressBarColor('hygiene-bar', this.labubuState.hygiene);
        this.setProgressBarColor('energy-bar', this.labubuState.energy);

        // Show/hide restart button
        document.getElementById('restart-button').style.display = this.isGameOver ? 'block' : 'none';
        
        // Disable action buttons if game is over or conditions not met, or if sleeping
        document.getElementById('feed-button').disabled = this.isGameOver || isSleeping || this.labubuState.money < this.labubuState.feedCost;
        document.getElementById('play-button').disabled = this.isGameOver || isSleeping || this.labubuState.money < this.labubuState.playCost;
        document.getElementById('clean-button').disabled = this.isGameOver || isSleeping;
        document.getElementById('sleep-button').disabled = this.isGameOver || isSleeping;
        document.getElementById('work-button').disabled = this.isGameOver || isSleeping || this.labubuState.energy < 20;

    }

    setProgressBarColor(id, value) {
        const bar = document.getElementById(id);
        if (value < 20) {
            bar.style.backgroundColor = '#f44336'; // Red
        } else if (value < 50) {
            bar.style.backgroundColor = '#ffeb3b'; // Yellow
        } else {
            bar.style.backgroundColor = '#4caf50'; // Green
        }
    }

    updateLabubuSprite() {
        if (this.isGameOver) {
            this.labubuSprite.setTexture('labubu_sad'); 
            return;
        }

        if (this.actionTimers.eating > 0) {
            this.labubuSprite.setTexture('labubu_eating');
        } else if (this.actionTimers.playing > 0) {
            this.labubuSprite.setTexture('labubu_happy');
        } else if (this.actionTimers.sleeping > 0) {
             this.labubuSprite.setTexture('labubu_sleeping');
        } else if (this.actionTimers.working > 0) {
             if (this.labubuState.energy < 50) {
                 this.labubuSprite.setTexture('labubu_sad');
             }
        } else if (this.labubuState.happiness < 30 || this.labubuState.hunger < 30 || this.labubuState.hygiene < 20 || this.labubuState.energy < 20) {
            this.labubuSprite.setTexture('labubu_sad');
        } else {
            this.labubuSprite.setTexture('labubu_idle');
        }
    }

    triggerInflation() {
        if (this.isGameOver) return;

        this.labubuState.inflationLevel++;
        this.labubuState.feedCost += this.INFLATION_FEED_INCREASE;
        this.labubuState.playCost += this.INFLATION_PLAY_INCREASE;

        this.displayNotification(`Inflation! Prices increased!`);
        this.saveGame();
    }

    payRent() {
        if (this.isGameOver) return;
        this.labubuState.money -= this.RENT_COST;
        this.labubuState.lastRentPaid = Date.now();
        this.displayNotification(`Rent due! -$${this.RENT_COST}`);
        this.saveGame();
    }

    payMedicalBill() {
        if (this.isGameOver) return;
        this.labubuState.money -= this.MEDICAL_BILL_COST;
        this.labubuState.lastMedicalBillPaid = Date.now();
        this.displayNotification(`Medical bill! -$${this.MEDICAL_BILL_COST}`);
        this.saveGame();
    }

    displayNotification(message) {
        if (this.notificationText) {
            this.notificationText.destroy();
        }
        this.notificationText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 200, message, {
            fontSize: '24px',
            fill: '#000000',
            backgroundColor: '#ffffff',
            padding: { x: 10, y: 5 },
            wordWrap: { width: 300 },
            align: 'center'
        }).setOrigin(0.5);
        this.time.delayedCall(3000, () => {
            if (this.notificationText) {
                this.notificationText.destroy();
                this.notificationText = null;
            }
        });
    }

    saveGame() {
        this.labubuState.lastUpdated = Date.now();
        localStorage.setItem('labubuSaveData', JSON.stringify(this.labubuState));
    }

    loadGame() {
        const savedData = localStorage.getItem('labubuSaveData');
        const now = Date.now();
        if (savedData) {
            const loadedState = JSON.parse(savedData);
            this.labubuState = { ...this.labubuState, ...loadedState };
            
            // Ensure new money property is a number, default to 50 if not present
            if (typeof this.labubuState.money !== 'number') {
                this.labubuState.money = 50; 
            }
            // Initialize new timestamps for old saves
            if (typeof this.labubuState.lastRentPaid !== 'number') {
                this.labubuState.lastRentPaid = now;
            }
            if (typeof this.labubuState.lastMedicalBillPaid !== 'number') {
                this.labubuState.lastMedicalBillPaid = now;
            }
            // Initialize inflation properties for old saves
            if (typeof this.labubuState.inflationLevel !== 'number') {
                this.labubuState.inflationLevel = 0;
                this.labubuState.feedCost = this.BASE_FEED_COST;
                this.labubuState.playCost = this.BASE_PLAY_COST;
            }
        } else {
            // For a brand new game, ensure these are set to now and costs are base
            this.labubuState.lastRentPaid = now;
            this.labubuState.lastMedicalBillPaid = now;
            this.labubuState.inflationLevel = 0;
            this.labubuState.feedCost = this.BASE_FEED_COST;
            this.labubuState.playCost = this.BASE_PLAY_COST;
        }
    }
    
    calculateOfflineProgression() {
        const now = Date.now();
        const timeDiffSeconds = Math.floor((now - this.labubuState.lastUpdated) / 1000);

        if (timeDiffSeconds > 0) {
            // Stat degradation - aligned with new faster rates
            const hungerLossPer10s = 5;
            const happinessLossPer15s = 4;
            const hygieneLossPer20s = 3;
            const energyLossPer20s = 2;

            this.labubuState.hunger = Math.max(0, this.labubuState.hunger - Math.floor(timeDiffSeconds / 10) * hungerLossPer10s);
            this.labubuState.happiness = Math.max(0, this.labubuState.happiness - Math.floor(timeDiffSeconds / 15) * happinessLossPer15s);
            this.labubuState.hygiene = Math.max(0, this.labubuState.hygiene - Math.floor(timeDiffSeconds / 20) * hygieneLossPer20s);
            this.labubuState.energy = Math.max(0, this.labubuState.energy - Math.floor(timeDiffSeconds / 20) * energyLossPer20s);
            
            // Offline periodic charges - aligned with new faster rates
            const elapsedTimeSinceLastRent = now - this.labubuState.lastRentPaid;
            const rentCycles = Math.floor(elapsedTimeSinceLastRent / this.RENT_INTERVAL_MS);
            if (rentCycles > 0) {
                this.labubuState.money -= rentCycles * this.RENT_COST;
                this.labubuState.lastRentPaid += rentCycles * this.RENT_INTERVAL_MS;
            }

            const elapsedTimeSinceLastMedicalBill = now - this.labubuState.lastMedicalBillPaid;
            const medicalCycles = Math.floor(elapsedTimeSinceLastMedicalBill / this.MEDICAL_INTERVAL_MS);
            if (medicalCycles > 0) {
                this.labubuState.money -= medicalCycles * this.MEDICAL_BILL_COST;
                this.labubuState.lastMedicalBillPaid += medicalCycles * this.MEDICAL_INTERVAL_MS;
            }

            // New: Offline Inflation progression
            // Calculate elapsed time based on how many inflation intervals have passed since lastUpdated
            // We need to be careful not to apply inflation multiple times if loading an old save
            // A more robust solution might track lastInflationTime in state, but for now this approximates.
            // Let's assume inflation applies based on total time passed since game start or last reset.
            // This part is tricky for precise offline inflation matching online ticks without storing lastInflationTick.           
            // For simplicity in offline, let's just apply inflation based on fixed intervals from a theoretical start if `inflationLevel` is 0.

            // A simpler, more practical approach for offline inflation is to re-calculate current costs
            // based on how many INFLATION_INTERVAL_MS periods have passed since game start/reset.
            // This assumes inflation is a continuous process, not just triggered by online events.
            const totalInflationCycles = Math.floor(now / this.INFLATION_INTERVAL_MS) - Math.floor(this.labubuState.lastUpdated / this.INFLATION_INTERVAL_MS);
            if (totalInflationCycles > 0 && this.labubuState.inflationLevel < totalInflationCycles) {
                const cyclesToAdd = totalInflationCycles - this.labubuState.inflationLevel;
                this.labubuState.inflationLevel += cyclesToAdd;
                this.labubuState.feedCost = this.BASE_FEED_COST + (this.labubuState.inflationLevel * this.INFLATION_FEED_INCREASE);
                this.labubuState.playCost = this.BASE_PLAY_COST + (this.labubuState.inflationLevel * this.INFLATION_PLAY_INCREASE);
            }
        }

        this.saveGame(); 
    }

    checkGameOver() {
        if (this.labubuState.hunger <= 0 || this.labubuState.happiness <= 0 || this.labubuState.hygiene <= 0 || this.labubuState.energy <= 0 || this.labubuState.money < 0) {
            this.isGameOver = true;
            this.degradationTimers.forEach(timer => timer.remove());
            if (!this.gameOverText) {
                this.gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 200, 'GAME OVER', {
                    fontSize: '40px',
                    fill: '#ff0000',
                    fontStyle: 'bold'
                }).setOrigin(0.5);
            }
        } else {
            this.isGameOver = false;
            if (this.gameOverText) {
                this.gameOverText.destroy();
                this.gameOverText = null;
            }
        }
    }

    // New resize method
    resize(scaleManager, baseSize) {
        const uiContainer = document.getElementById('ui-container');
        const gameContainer = document.getElementById('game-container');

        const uiHeight = uiContainer ? uiContainer.offsetHeight : 0;

        // Use visualViewport.height for a more accurate height on iOS Safari
        const currentViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        
        // Calculate available height for the game, ensuring UI fits
        const availableHeightForGame = currentViewportHeight - uiHeight; 
        const availableWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;

        let newGameWidth = availableWidth;
        let newGameHeight = availableWidth * (baseSize.height / baseSize.width); 

        // If calculated height exceeds available height, cap it and adjust width
        if (newGameHeight > availableHeightForGame) {
            newGameHeight = availableHeightForGame;
            newGameWidth = availableHeightForGame * (baseSize.width / baseSize.height); 
        }

        const maxWidth = 400; 
        if (newGameWidth > maxWidth) {
            newGameWidth = maxWidth;
            newGameHeight = maxWidth * (baseSize.height / baseSize.width);
        }

        scaleManager.resize(newGameWidth, newGameHeight);

        // Manually set margin-bottom for game-container to push it up, avoiding overlap with fixed UI
        if (gameContainer) {
            gameContainer.style.marginBottom = `${uiHeight}px`;
        }

        this.labubuSprite.x = newGameWidth / 2;
        this.labubuSprite.y = newGameHeight / 2 + 20; 

        if (this.gameOverText) {
            this.gameOverText.setPosition(newGameWidth / 2, newGameHeight / 2 - 100);
        }

        if (this.notificationText) {
            this.notificationText.setPosition(newGameWidth / 2, newGameHeight / 2 - 200);
        }
    }
}

// Phaser Game Config
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE, // Use RESIZE mode for dynamic resizing
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container',
        width: 360, // Base width
        height: 500, // Base height, will be dynamically adjusted
    },
    backgroundColor: '#ffffff',
    scene: [GameScene]
};

const game = new Phaser.Game(config);

// Global window resize listener to trigger game resize
window.addEventListener('resize', () => {
    if (game && game.scale && game.scene.scenes[0]) {
        game.scene.scenes[0].resize(game.scale, { width: 360, height: 500 }); 
    }
});

// Listen for visual viewport resize event which is more reliable on iOS
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        if (game && game.scale && game.scene.scenes[0]) {
            game.scene.scenes[0].resize(game.scale, { width: 360, height: 500 }); 
        }
    });
}
