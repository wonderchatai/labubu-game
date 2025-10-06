**Built with [WonderChat AI](https://wonderchat.dev).**

<a href="https://apps.apple.com/us/app/wonderchat-ai/id6752497385" target="_blank">
  <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" height="50">
</a>

# Labubu Virtual Pet

A client-side virtual pet game, emulating Tamagotchi-style mechanics, where the player is responsible for the well-being of a digital creature named Labubu. The application runs entirely in the browser with no server-side dependencies.

## Technical Summary

This project is built with a focus on modern, client-side web technologies.

### Core Technologies
*   **Game Logic:** [Phaser 3](https://phaser.io/) - A fast, free, and fun open-source HTML5 game framework.
*   **Frontend:** HTML5, CSS3, and modern JavaScript (ES6+).
*   **Persistence:** Browser `localStorage` is used for saving and loading game state, allowing for session persistence and offline progression calculation.
*   **Deployment:** The application is automatically deployed to GitHub Pages using a GitHub Actions workflow. The workflow is triggered by pushing a git tag.

### Project Structure
*   `index.html`: The main entry point for the application.
*   `style.css`: Contains all the styles for the UI, including responsive design for mobile devices.
*   `main.js`: The core of the game, containing all the Phaser 3 game logic, scene management, and state handling.
*   `assets/`: Directory containing all image assets for the game.
*   `.github/workflows/publish-pages.yml`: The GitHub Actions workflow for continuous deployment to GitHub Pages.

## Game Mechanics
*   **Core Stats:** Labubu has four primary stats: Hunger, Happiness, Hygiene, and Energy.
*   **Financial System:** The game includes a simple economy with a 'Money' attribute. Players can 'Work' to earn money.
*   **Dynamic Events:** To create a more challenging experience, the game includes:
    *   **Stat Degradation:** All core stats decrease over time.
    *   **Recurring Charges:** 'Rent' and 'Medical Bills' are deducted automatically at set intervals.
    *   **Inflation:** The cost of actions like 'Feed' and 'Play' increases periodically.
*   **Game State:** The game automatically saves progress every 5 seconds and calculates offline progression when the user returns.
*   **Auto-Restart:** The game automatically restarts 2 seconds after a 'Game Over' condition is met.
