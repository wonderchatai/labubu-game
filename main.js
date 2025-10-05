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
            lastMedicalBillPaid: Date.now() 
        };
        this.actionTimers = {
            eating: 0,
            playing: 0,
            sleeping: 0,
            working: 0 
        };
        this.isInteracting = false;
        this.isGameOver = false;

        // Game costs
        this.FEED_COST = 10;
        this.PLAY_COST = 5;
        this.WORK_EARNINGS = 20;

        // New: Periodic charge costs and intervals (for testing, use smaller values)
        this.RENT_COST = 50;
        this.RENT_INTERVAL_MS = 30000; // Rent every 30 seconds (was 60s)
        this.MEDICAL_BILL_COST = 30;
        this.MEDICAL_INTERVAL_MS = 90000; // Still 1.5 minutes

        this.notificationText = null; // For displaying temporary messages
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
        this.labubuSprite = this.add.sprite(this.scale.width / 2, this.scale.height / 2, 'labubu_idle').setScale(0.5);

        this.loadGame();
        this.calculateOfflineProgression();

        // Timers for stat degradation (increased difficulty)
        this.degradationTimers = [];
        this.degradationTimers.push(this.time.addEvent({
            delay: 10000, // Hunger decreases every 10 seconds (was 15s)
            callback: () => { this.labubuState.hunger = Math.max(0, this.labubuState.hunger - 5); },
            loop: true
        }));
        this.degradationTimers.push(this.time.addEvent({
            delay: 15000, // Happiness decreases every 15 seconds (was 20s)
            callback: () => { this.labubuState.happiness = Math.max(0, this.labubuState.happiness - 4); },
            loop: true
        }));
         this.degradationTimers.push(this.time.addEvent({
            delay: 20000, // Hygiene decreases every 20 seconds (was 30s)
            callback: () => { this.labubuState.hygiene = Math.max(0, this.labubuState.hygiene - 3); },
            loop: true
        }));
        this.degradationTimers.push(this.time.addEvent({
            delay: 20000, // Energy decreases every 20 seconds (was 25s)
            callback: () => { this.labubuState.energy = Math.max(0, this.labubuState.energy - 2); },
            loop: true
        }));

        // New: Timers for periodic charges
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

        // Save progress every 5 seconds
        this.time.addEvent({
            delay: 5000,
            callback: this.saveGame,
            callbackScope: this,
            loop: true
        });

        this.setupUI();
        this.checkGameOver();
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
            if (this.isGameOver || this.labubuState.money < this.FEED_COST || this.actionTimers.sleeping > 0) return;
            this.labubuState.money -= this.FEED_COST; 
            this.labubuState.hunger = Math.min(100, this.labubuState.hunger + 25); 
            this.actionTimers.eating = 2000; 
            this.saveGame();
        });
        document.getElementById('play-button').addEventListener('click', () => {
            if (this.isGameOver || this.labubuState.money < this.PLAY_COST || this.actionTimers.sleeping > 0) return;
            this.labubuState.money -= this.PLAY_COST; 
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
        document.getElementById('feed-button').disabled = this.isGameOver || isSleeping || this.labubuState.money < this.FEED_COST;
        document.getElementById('play-button').disabled = this.isGameOver || isSleeping || this.labubuState.money < this.PLAY_COST;
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
             } else {
                 this.labubuSprite.setTexture('labubu_idle');
             }
        } else if (this.labubuState.happiness < 30 || this.labubuState.hunger < 30 || this.labubuState.hygiene < 20 || this.labubuState.energy < 20) {
            this.labubuSprite.setTexture('labubu_sad');
        } else {
            this.labubuSprite.setTexture('labubu_idle');
        }
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
        } else {
            // For a brand new game, ensure these are set to now
            this.labubuState.lastRentPaid = now;
            this.labubuState.lastMedicalBillPaid = now;
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
        }

        this.saveGame(); 
    }

    checkGameOver() {
        if (this.labubuState.hunger <= 0 || this.labubuState.happiness <= 0 || this.labubuState.hygiene <= 0 || this.labubuState.energy <= 0 || this.labubuState.money < 0) {
            this.isGameOver = true;
            this.degradationTimers.forEach(timer => timer.remove());
            if (!this.gameOverText) {
                this.gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 100, 'GAME OVER', {
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
}

// Phaser Game Config
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        parent: 'game-container',
        width: 360,
        height: 640,
    },
    backgroundColor: '#ffffff',
    scene: [GameScene]
};

const game = new Phaser.Game(config);