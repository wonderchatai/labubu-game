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

        // Store original Labubu sprite dimensions for scaling calculations
        this.labubuOriginalWidth = 0; 
        this.labubuOriginalHeight = 0; 
    }

    preload() {
        this.load.image('labubu_idle', 'assets/labubu_idle.png');
        this.load.image('labubu_happy', 'assets/labubu_happy.png');
        this.load.image('labubu_sad', 'assets/labubu_sad.png');
        this.load.image('labubu_eating', 'assets/labubu_eating.png');
        this.load.image('labubu_sleeping', 'assets/labubu_sleeping.png');
    }

    create() {
        // Center Labubu without explicit scale initially
        this.labubuSprite = this.add.sprite(this.scale.width / 2, this.scale.height / 2, 'labubu_idle');
        // Set initial original dimensions for scaling after image is loaded
        this.labubuOriginalWidth = this.labubuSprite.width;
        this.labubuOriginalHeight = this.labubuSprite.height;

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
        // Call resize immediately to set initial dimensions and scale Labubu
        this.resize(this.game.scale); 
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
        }\n    }

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
             } else {
                 this.labubuSprite.setTexture('labubu_idle');
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
    resize(scaleManager) {
        const uiContainer = document.getElementById('ui-container');
        const gameContainer = document.getElementById('game-container');

        const uiHeight = uiContainer ? uiContainer.offsetHeight : 0;

        // Get current viewport dimensions using visualViewport for accuracy on iOS
        const currentViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const currentViewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
        
        // Calculate available height for the game, ensuring UI fits
        let availableHeightForGame = currentViewportHeight - uiHeight;
        if (availableHeightForGame < 0) availableHeightForGame = 0; // Prevent negative height

        // Apply max-width constraint for the overall layout
        const maxWidth = 400; 
        let targetWidth = currentViewportWidth;
        if (targetWidth > maxWidth) {
            targetWidth = maxWidth;
        }

        // Set game-container's dimensions based on calculated available space
        if (gameContainer) {
            gameContainer.style.width = `${targetWidth}px`; 
            gameContainer.style.height = `${availableHeightForGame}px`;
            // No manual scaleManager.resize call here; Phaser.Scale.RESIZE will handle it.
        }

        // Reposition Labubu and text elements based on new canvas size
        // scaleManager.width/height reflect the actual canvas size after Phaser's internal resize
        this.labubuSprite.x = scaleManager.width / 2;
        this.labubuSprite.y = scaleManager.height / 2; 

        // Dynamic scaling for Labubu sprite
        if (this.labubuSprite && this.labubuOriginalWidth && this.labubuOriginalHeight) {
            const scaleX = scaleManager.width / this.labubuOriginalWidth;
            const scaleY = scaleManager.height / this.labubuOriginalHeight;
            // Use the larger scale to fill one dimension, potentially cropping the other
            const scaleFactor = Math.max(scaleX, scaleY); 
            this.labubuSprite.setScale(scaleFactor);
        }

        if (this.gameOverText) {
            this.gameOverText.setPosition(scaleManager.width / 2, scaleManager.height / 2 - 100);
        }

        if (this.notificationText) {
            this.notificationText.setPosition(scaleManager.width / 2, scaleManager.height / 2 - 200);
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
        // No fixed width/height here; RESIZE mode will infer from parent
    },
    backgroundColor: '#ffffff',
    scene: [GameScene]
};

const game = new Phaser.Game(config);

// Global window resize listener to trigger game resize
window.addEventListener('resize', () => {
    if (game && game.scale && game.scene.scenes[0]) {
        game.scene.scenes[0].resize(game.scale); 
    }
});

// Listen for visual viewport resize event which is more reliable on iOS
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        if (game && game.scale && game.scene.scenes[0]) {
            game.scene.scenes[0].resize(game.scale); 
        }
    });
}
