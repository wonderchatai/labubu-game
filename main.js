// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.labubuState = {
            hunger: 100,
            happiness: 100,
            hygiene: 100,
            energy: 100,
            money: 50, // New: Starting money
            lastUpdated: Date.now()
        };
        this.actionTimers = {
            eating: 0,
            playing: 0,
            sleeping: 0,
            working: 0 // New: Working timer
        };
        this.isInteracting = false;
        this.isGameOver = false;

        // Game costs
        this.FEED_COST = 10;
        this.PLAY_COST = 5;
        this.WORK_EARNINGS = 20;
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

        // Timers for stat degradation (adjusted for realism/balance, but still fast for testing)
        this.degradationTimers = [];
        this.degradationTimers.push(this.time.addEvent({
            delay: 15000, // Hunger decreases every 15 seconds
            callback: () => { this.labubuState.hunger = Math.max(0, this.labubuState.hunger - 5); },
            loop: true
        }));
        this.degradationTimers.push(this.time.addEvent({
            delay: 20000, // Happiness decreases every 20 seconds
            callback: () => { this.labubuState.happiness = Math.max(0, this.labubuState.happiness - 4); },
            loop: true
        }));
         this.degradationTimers.push(this.time.addEvent({
            delay: 30000, // Hygiene decreases every 30 seconds
            callback: () => { this.labubuState.hygiene = Math.max(0, this.labubuState.hygiene - 3); },
            loop: true
        }));
        this.degradationTimers.push(this.time.addEvent({
            delay: 25000, // Energy decreases every 25 seconds
            callback: () => { this.labubuState.energy = Math.max(0, this.labubuState.energy - 2); },
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
                this.actionTimers[action] = 0; // Ensure it doesn't go negative
            }
        }
        this.isInteracting = anyActionActive;

        this.checkGameOver();
    }

    setupUI() {
        document.getElementById('feed-button').addEventListener('click', () => {
            if (this.isGameOver || this.labubuState.money < this.FEED_COST || this.actionTimers.sleeping > 0) return; // Added check for sleeping
            this.labubuState.money -= this.FEED_COST; // Deduct cost
            this.labubuState.hunger = Math.min(100, this.labubuState.hunger + 25); // Increased effect
            this.actionTimers.eating = 2000; 
            this.saveGame();
        });
        document.getElementById('play-button').addEventListener('click', () => {
            if (this.isGameOver || this.labubuState.money < this.PLAY_COST || this.actionTimers.sleeping > 0) return; // Added check for sleeping
            this.labubuState.money -= this.PLAY_COST; // Deduct cost
            this.labubuState.happiness = Math.min(100, this.labubuState.happiness + 20); // Increased effect
            this.labubuState.energy = Math.max(0, this.labubuState.energy - 10); // Play costs energy
            this.actionTimers.playing = 2000;
            this.saveGame();
        });
        document.getElementById('clean-button').addEventListener('click', () => {
            if (this.isGameOver || this.actionTimers.sleeping > 0) return; // Added check for sleeping
            this.labubuState.hygiene = Math.min(100, this.labubuState.hygiene + 30); // Increased effect
            this.saveGame();
        });
        document.getElementById('sleep-button').addEventListener('click', () => {
            if (this.isGameOver || this.actionTimers.sleeping > 0) return; // Prevent sleeping multiple times
             this.actionTimers.sleeping = 10000; // Sleep for 10 seconds
             this.time.delayedCall(10000, () => {
                this.labubuState.energy = 100;
                this.saveGame();
             });
        });
        document.getElementById('work-button').addEventListener('click', () => {
            if (this.isGameOver || this.labubuState.energy < 20 || this.actionTimers.sleeping > 0) return; // Added check for sleeping
            this.labubuState.money += this.WORK_EARNINGS; // Earn money
            this.labubuState.energy = Math.max(0, this.labubuState.energy - 30); // Working costs significant energy
            this.labubuState.happiness = Math.max(0, this.labubuState.happiness - 10); // Working slightly decreases happiness
            this.actionTimers.working = 3000; // Work animation for 3 seconds
            this.saveGame();
        });

        // Add restart button (not in original plan, but good for game over state)
        let restartButton = document.createElement('button');
        restartButton.id = 'restart-button';
        restartButton.textContent = 'Restart Game';
        restartButton.style.display = 'none'; // Hidden by default
        document.getElementById('actions-container').appendChild(restartButton);

        restartButton.addEventListener('click', () => {
            localStorage.removeItem('labubuSaveData');
            window.location.reload(); // Reload the page to restart the game
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
            this.labubuSprite.setTexture('labubu_sad'); // Always sad when game over
            return;
        }

        if (this.actionTimers.eating > 0) {
            this.labubuSprite.setTexture('labubu_eating');
        } else if (this.actionTimers.playing > 0) {
            this.labubuSprite.setTexture('labubu_happy');
        } else if (this.actionTimers.sleeping > 0) {
             this.labubuSprite.setTexture('labubu_sleeping');
        } else if (this.actionTimers.working > 0) {
             // No specific 'working' sprite, use idle or a tired look if energy is low
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

    saveGame() {
        this.labubuState.lastUpdated = Date.now();
        localStorage.setItem('labubuSaveData', JSON.stringify(this.labubuState));
    }

    loadGame() {
        const savedData = localStorage.getItem('labubuSaveData');
        if (savedData) {
            // Ensure new properties are initialized if loading an older save
            const loadedState = JSON.parse(savedData);
            this.labubuState = { ...this.labubuState, ...loadedState };
            // Make sure money is a number, default to 0 if not present
            if (typeof this.labubuState.money !== 'number') {
                this.labubuState.money = 0;
            }
        }
    }
    
    calculateOfflineProgression() {
        const now = Date.now();
        const timeDiffSeconds = Math.floor((now - this.labubuState.lastUpdated) / 1000);

        if (timeDiffSeconds > 0) {
            // Degradation values for offline progression (matching online rates)
            const hungerLossPer15s = 5;
            const happinessLossPer20s = 4;
            const hygieneLossPer30s = 3;
            const energyLossPer25s = 2;

            this.labubuState.hunger = Math.max(0, this.labubuState.hunger - Math.floor(timeDiffSeconds / 15) * hungerLossPer15s);
            this.labubuState.happiness = Math.max(0, this.labubuState.happiness - Math.floor(timeDiffSeconds / 20) * happinessLossPer20s);
            this.labubuState.hygiene = Math.max(0, this.labubuState.hygiene - Math.floor(timeDiffSeconds / 30) * hygieneLossPer30s);
            this.labubuState.energy = Math.max(0, this.labubuState.energy - Math.floor(timeDiffSeconds / 25) * energyLossPer25s);
            
            // No change to money during offline progression for simplicity
        }

        this.saveGame(); // Update timestamp immediately
    }

    checkGameOver() {
        if (this.labubuState.hunger <= 0 || this.labubuState.happiness <= 0 || this.labubuState.hygiene <= 0 || this.labubuState.energy <= 0 || this.labubuState.money < 0) {
            this.isGameOver = true;
            // Stop all degradation timers
            this.degradationTimers.forEach(timer => timer.remove());
            // You might want to display a game over message on the canvas as well
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
    width: 360,
    height: 640,
    parent: 'game-container',
    backgroundColor: '#ffffff',
    scene: [GameScene]
};

const game = new Phaser.Game(config);