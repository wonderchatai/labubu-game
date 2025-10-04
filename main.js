// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.labubuState = {
            hunger: 100,
            happiness: 100,
            hygiene: 100,
            energy: 100,
            lastUpdated: Date.now()
        };
        this.actionTimers = {
            eating: 0,
            playing: 0,
            sleeping: 0
        };
        this.isInteracting = false;
        this.isGameOver = false;
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

        // Timers for stat degradation
        this.degradationTimers = [];
        this.degradationTimers.push(this.time.addEvent({
            delay: 3000, // 3 seconds for testing, should be 30000 (30s)
            callback: () => { this.labubuState.hunger = Math.max(0, this.labubuState.hunger - 3); },
            loop: true
        }));
        this.degradationTimers.push(this.time.addEvent({
            delay: 6000, // 6 seconds for testing, should be 60000 (60s)
            callback: () => { this.labubuState.happiness = Math.max(0, this.labubuState.happiness - 2); },
            loop: true
        }));
         this.degradationTimers.push(this.time.addEvent({
            delay: 12000, // 12 seconds for testing, should be 120000 (120s)
            callback: () => { this.labubuState.hygiene = Math.max(0, this.labubuState.hygiene - 2); },
            loop: true
        }));
        this.degradationTimers.push(this.time.addEvent({
            delay: 9000, // 9 seconds for testing, should be 90000 (90s)
            callback: () => { this.labubuState.energy = Math.max(0, this.labubuState.energy - 1); },
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
            if (this.isGameOver) return;
            this.labubuState.hunger = Math.min(100, this.labubuState.hunger + 15);
            this.actionTimers.eating = 2000; // Show eating sprite for 2 seconds
            this.saveGame();
        });
        document.getElementById('play-button').addEventListener('click', () => {
            if (this.isGameOver) return;
            this.labubuState.happiness = Math.min(100, this.labubuState.happiness + 10);
            this.labubuState.energy = Math.max(0, this.labubuState.energy - 5);
            this.actionTimers.playing = 2000; // Show happy sprite for 2 seconds
            this.saveGame();
        });
        document.getElementById('clean-button').addEventListener('click', () => {
            if (this.isGameOver) return;
            this.labubuState.hygiene = Math.min(100, this.labubuState.hygiene + 20);
            this.saveGame();
        });
        document.getElementById('sleep-button').addEventListener('click', () => {
            if (this.isGameOver) return;
            // Set sleeping timer
            this.actionTimers.sleeping = 10000; // Sleep for 10 seconds
            // After 10 seconds, set energy to full
            this.time.delayedCall(10000, () => {
                this.labubuState.energy = 100;
                this.saveGame();
            });
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
        // Disable action buttons if game is over
        document.getElementById('feed-button').disabled = this.isGameOver;
        document.getElementById('play-button').disabled = this.isGameOver;
        document.getElementById('clean-button').disabled = this.isGameOver;
        document.getElementById('sleep-button').disabled = this.isGameOver;
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
            this.labubuState = JSON.parse(savedData);
        }
    }
    
    calculateOfflineProgression() {
        const now = Date.now();
        const timeDiffSeconds = Math.floor((now - this.labubuState.lastUpdated) / 1000);

        if (timeDiffSeconds > 0) {
            // Degradation values for offline progression (matching online rates)
            const hungerLossPer30s = 3;
            const happinessLossPer60s = 2;
            const hygieneLossPer120s = 2;
            const energyLossPer90s = 1;

            this.labubuState.hunger = Math.max(0, this.labubuState.hunger - Math.floor(timeDiffSeconds / 30) * hungerLossPer30s);
            this.labubuState.happiness = Math.max(0, this.labubuState.happiness - Math.floor(timeDiffSeconds / 60) * happinessLossPer60s);
            this.labubuState.hygiene = Math.max(0, this.labubuState.hygiene - Math.floor(timeDiffSeconds / 120) * hygieneLossPer120s);
            this.labubuState.energy = Math.max(0, this.labubuState.energy - Math.floor(timeDiffSeconds / 90) * energyLossPer90s);
        }

        this.saveGame(); // Update timestamp immediately
    }

    checkGameOver() {
        if (this.labubuState.hunger <= 0 || this.labubuState.happiness <= 0 || this.labubuState.hygiene <= 0 || this.labubuState.energy <= 0) {
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