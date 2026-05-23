import { cardsForRound, createDeck, dealCards, shuffleDeck } from "./deck.js";
import {
  canPlayCard,
  getLegalCards,
  getTrickWinner,
  removeCardFromHand,
  scoreRound,
  sortHand,
} from "./rules.js";
import { chooseBid, chooseCard, shouldUseLaser } from "./ai.js";
import { createUI } from "./ui.js";
import {
  applyTheme,
  getPlayerNames,
  initTheme,
  isLaserEnabled,
  isMinecraftTheme,
  onThemeChange,
} from "./themes.js";
import { playCardPlaceSound, playLaserSound, playMinecraftMenuClickSound, unlockSounds } from "./sounds.js";

const PLAYER_COUNT = 3;
const HUMAN_INDEX = 0;
const TOTAL_ROUNDS = 10;
const AI_DELAY_MS = 650;
const AI_PLAY_DELAY_MS = Math.round(AI_DELAY_MS * 1.36);
const TRICK_HOLD_MS = 1400;
const PRE_WIN_ANIMATION_MS = 350;
const WINNER_DISPLAY_MS = 2300;
const LASER_RESOLVE_MS = 1800;

function createPlayer() {
  return {
    hand: [],
    points: 0,
    plumps: 0,
  };
}

function createRoundStats() {
  return Array.from({ length: PLAYER_COUNT }, () => ({
    bid: null,
    tricksWon: 0,
  }));
}

function createLaserShots() {
  return Array.from({ length: PLAYER_COUNT }, () => 1);
}

class PlumpGame {
  constructor(ui) {
    this.ui = ui;
    this.resetMatch();
  }

  resetMatch() {
    this.roundNumber = 1;
    this.dealerIndex = PLAYER_COUNT - 1;
    this.players = Array.from({ length: PLAYER_COUNT }, createPlayer);
    this.currentRoundStats = createRoundStats();
    this.phase = "idle";
    this.currentPlayerIndex = 0;
    this.leaderIndex = 0;
    this.trickPlays = [];
    this.trickWinnerIndex = null;
    this.lastPlayedPlayerIndex = null;
    this.laserShotsRemaining = createLaserShots();
    this.laserMode = false;
    this.laserDestroyedPlayerIndex = null;
    this.cardsInRound = cardsForRound(this.roundNumber);
    this.deck = [];
    this.pendingTimeouts = [];
  }

  startMatch() {
    this.resetMatch();
    this.ui.hideOverlay();
    this.startRound();
  }

  startRound() {
    this.cardsInRound = cardsForRound(this.roundNumber);
    this.currentRoundStats = createRoundStats();
    this.trickPlays = [];
    this.leaderIndex = (this.dealerIndex + 1) % PLAYER_COUNT;
    this.currentPlayerIndex = this.leaderIndex;
    this.phase = "bidding";
    this.laserMode = false;
    this.laserDestroyedPlayerIndex = null;

    this.deck = shuffleDeck(createDeck());
    const { hands } = dealCards(this.deck, PLAYER_COUNT, this.cardsInRound);
    this.players.forEach((player, index) => {
      player.hand = hands[index];
    });

    this.ui.setRoundInfo(this.roundNumber, this.cardsInRound);
    this.ui.setMessage(`Runda ${this.roundNumber}: lägg bud innan stickspelen börjar.`);
    this.ui.clearTrick();
    this.render();

    this.currentPlayerIndex = (this.dealerIndex + 1) % PLAYER_COUNT;
    this.continueBidding();
  }

  continueBidding() {
    if (this.phase !== "bidding") {
      return;
    }

    if (this.currentPlayerIndex === HUMAN_INDEX) {
      this.ui.showBidPanel(this.cardsInRound, true);
      this.ui.setMessage("Din tur att buda. Hur många stick tar du?");
      this.render();
      return;
    }

    this.ui.showBidPanel(this.cardsInRound, false);
    this.schedule(() => {
      const bid = chooseBid(
        this.players[this.currentPlayerIndex].hand,
        this.cardsInRound,
      );
      this.submitBid(this.currentPlayerIndex, bid);
    }, AI_DELAY_MS);
  }

  submitBid(playerIndex, bid) {
    if (this.phase !== "bidding") {
      return;
    }

    const safeBid = Math.max(0, Math.min(this.cardsInRound, bid));
    this.currentRoundStats[playerIndex].bid = safeBid;

    if (playerIndex === HUMAN_INDEX) {
      this.ui.showBidPanel(this.cardsInRound, false);
    }

    const bidsCompleted = this.currentRoundStats.every((stats) => stats.bid !== null);
    if (bidsCompleted) {
      this.beginPlayPhase();
      return;
    }

    this.currentPlayerIndex = (playerIndex + 1) % PLAYER_COUNT;
    this.render();
    this.continueBidding();
  }

  beginPlayPhase() {
    this.phase = "play";
    this.trickPlays = [];
    this.currentPlayerIndex = this.leaderIndex;
    this.laserMode = false;
    this.ui.setMessage(`${getPlayerNames()[this.currentPlayerIndex]} leder första sticket.`);
    this.render();
    this.continuePlay();
  }

  canUseLaser(playerIndex) {
    return (
      isLaserEnabled() &&
      this.phase === "play" &&
      this.trickPlays.length >= 1 &&
      this.trickWinnerIndex === null &&
      this.laserShotsRemaining[playerIndex] > 0 &&
      this.laserDestroyedPlayerIndex === null
    );
  }

  toggleLaserMode() {
    if (!this.canUseLaser(HUMAN_INDEX)) {
      return;
    }

    this.laserMode = !this.laserMode;
    this.ui.setMessage(
      this.laserMode
        ? "Lasermål aktivt. Klicka ett kort på bordet för att skjuta bort det och vinna sticket."
        : "Ditt drag. Välj ett kort.",
    );
    this.render();
  }

  fireLaser(shooterIndex, targetPlayerIndex) {
    if (!this.canUseLaser(shooterIndex)) {
      return false;
    }

    const targetPlay = this.trickPlays.find((play) => play.playerIndex === targetPlayerIndex);
    if (!targetPlay) {
      return false;
    }

    this.clearScheduled();
    this.laserShotsRemaining[shooterIndex] -= 1;
    this.laserMode = false;
    this.laserDestroyedPlayerIndex = targetPlayerIndex;
    this.trickPlays = this.trickPlays.filter((play) => play.playerIndex !== targetPlayerIndex);
    this.currentRoundStats[shooterIndex].tricksWon += 1;
    this.phase = "laserResolve";

    this.ui.setMessage(`${getPlayerNames()[shooterIndex]} laser-skjöt och vann sticket!`);
    playLaserSound();
    this.render();

    this.ui.playLaserEffect(shooterIndex, targetPlayerIndex, () => {
      this.schedule(() => this.finalizeTrick(shooterIndex), LASER_RESOLVE_MS);
    });

    return true;
  }

  maybeAIShootLaser(playerIndex) {
    if (!this.canUseLaser(playerIndex)) {
      return false;
    }

    const projectedWinner = getTrickWinner(this.trickPlays, this.leaderIndex);
    const stats = this.currentRoundStats[playerIndex];
    const shouldShoot = shouldUseLaser({
      playerIndex,
      projectedWinner,
      tricksWon: stats.tricksWon,
      bid: stats.bid,
      trickSize: this.trickPlays.length,
    });

    if (!shouldShoot) {
      return false;
    }

    return this.fireLaser(playerIndex, projectedWinner);
  }

  continuePlay() {
    if (this.phase !== "play") {
      return;
    }

    if (this.maybeAIShootLaser(this.currentPlayerIndex)) {
      return;
    }

    if (this.currentPlayerIndex === HUMAN_INDEX) {
      this.ui.setMessage(
        this.laserMode
          ? "Lasermål aktivt. Klicka ett kort på bordet för att skjuta bort det och vinna sticket."
          : "Ditt drag. Välj ett kort.",
      );
      this.render();
      return;
    }

    this.schedule(() => {
      if (this.maybeAIShootLaser(this.currentPlayerIndex)) {
        return;
      }

      const hand = this.players[this.currentPlayerIndex].hand;
      const leadSuit = this.trickPlays[0]?.card.suit ?? null;
      const card = chooseCard(hand, {
        leadSuit,
        trickPlays: this.trickPlays,
        leadPlayerIndex: this.leaderIndex,
        tricksWon: this.currentRoundStats[this.currentPlayerIndex].tricksWon,
        bid: this.currentRoundStats[this.currentPlayerIndex].bid,
      });
      this.playCard(this.currentPlayerIndex, card.id);
    }, AI_PLAY_DELAY_MS);
  }

  playCard(playerIndex, cardId) {
    if (this.phase !== "play" || this.currentPlayerIndex !== playerIndex) {
      return;
    }

    if (this.trickPlays.length >= PLAYER_COUNT) {
      return;
    }

    const hand = this.players[playerIndex].hand;
    const card = hand.find((entry) => entry.id === cardId);
    const leadSuit = this.trickPlays[0]?.card.suit ?? null;

    if (!card || !canPlayCard(hand, card, leadSuit)) {
      if (playerIndex === HUMAN_INDEX) {
        this.ui.setMessage("Ogiltigt kort. Du måste följa färg om du kan.");
        this.render();
      }
      return;
    }

    this.players[playerIndex].hand = removeCardFromHand(hand, cardId);
    this.trickPlays.push({ playerIndex, card });
    this.lastPlayedPlayerIndex = playerIndex;
    playCardPlaceSound();
    this.render();

    if (this.trickPlays.length < PLAYER_COUNT) {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % PLAYER_COUNT;
      this.continuePlay();
      return;
    }

    this.schedule(() => {
      if (this.tryPreResolveLasers()) {
        return;
      }
      this.resolveTrick();
    }, TRICK_HOLD_MS);
  }

  tryPreResolveLasers() {
    for (const playerIndex of [1, 2]) {
      if (this.maybeAIShootLaser(playerIndex)) {
        return true;
      }
    }
    return false;
  }

  resolveTrick() {
    this.lastPlayedPlayerIndex = null;
    const winnerIndex = getTrickWinner(this.trickPlays, this.leaderIndex);
    this.schedule(() => this.showTrickWinner(winnerIndex), PRE_WIN_ANIMATION_MS);
  }

  showTrickWinner(winnerIndex) {
    this.trickWinnerIndex = winnerIndex;
    this.ui.setMessage(`${getPlayerNames()[winnerIndex]} vann sticket.`);
    this.render();
    this.schedule(() => this.finalizeTrick(winnerIndex), WINNER_DISPLAY_MS);
  }

  finalizeTrick(winnerIndex) {
    this.trickWinnerIndex = null;
    this.laserDestroyedPlayerIndex = null;

    const cardsPlayed = this.players.every((player) => player.hand.length === 0);
    this.trickPlays = [];
    this.ui.clearTrick();

    if (cardsPlayed) {
      this.phase = "roundSummary";
      this.finishRound();
      return;
    }

    this.phase = "play";
    this.leaderIndex = winnerIndex;
    this.currentPlayerIndex = winnerIndex;
    this.render();
    this.continuePlay();
  }

  finishRound() {
    this.phase = "roundSummary";

    const summaries = this.currentRoundStats.map((stats, index) => {
      const result = scoreRound(stats.bid, stats.tricksWon);
      this.players[index].points += result.pointsAwarded;
      if (result.gotPlump) {
        this.players[index].plumps += 1;
      }

      return {
        name: getPlayerNames()[index],
        bid: stats.bid,
        tricksWon: stats.tricksWon,
        ...result,
      };
    });

    const summaryText = summaries
      .map((entry) => {
        if (entry.gotPlump) {
          return `${entry.name}: bud ${entry.bid}, tog ${entry.tricksWon} → plump`;
        }
        return `${entry.name}: bud ${entry.bid}, tog ${entry.tricksWon} → +${entry.pointsAwarded} poäng`;
      })
      .join(" · ");

    this.ui.setMessage(summaryText);
    this.render();

    if (this.roundNumber >= TOTAL_ROUNDS) {
      this.finishMatch();
      return;
    }

    this.schedule(() => {
      this.roundNumber += 1;
      this.dealerIndex = (this.dealerIndex + 1) % PLAYER_COUNT;
      this.startRound();
    }, AI_DELAY_MS * 2);
  }

  finishMatch() {
    this.phase = "finished";
    const ranking = [...this.players]
      .map((player, index) => ({
        name: getPlayerNames()[index],
        points: player.points,
        plumps: player.plumps,
      }))
      .sort((a, b) => b.points - a.points);

    const topScore = ranking[0].points;
    const winners = ranking.filter((entry) => entry.points === topScore);
    const winnerText =
      winners.length === 1
        ? `${winners[0].name} vann med ${winners[0].points} poäng!`
        : `Oavgjort mellan ${winners.map((entry) => entry.name).join(", ")} med ${topScore} poäng!`;

    const details = ranking
      .map((entry) => `${entry.name}: ${entry.points} poäng, ${entry.plumps} plumpar`)
      .join("\n");

    this.ui.setMessage("Matchen är slut.");
    this.ui.showOverlay("Slutresultat", `${winnerText}\n\n${details}`);
    this.render();
  }

  render() {
    const leadSuit = this.trickPlays[0]?.card.suit ?? null;
    const legalCards =
      this.phase === "play" && this.currentPlayerIndex === HUMAN_INDEX && !this.laserMode
        ? getLegalCards(this.players[HUMAN_INDEX].hand, leadSuit)
        : [];
    const legalCardIds = new Set(legalCards.map((card) => card.id));
    const laserEnabled = isLaserEnabled();
    const humanCanLaser = this.canUseLaser(HUMAN_INDEX);

    this.ui.setLaserMode(this.laserMode, humanCanLaser || this.laserMode);
    this.ui.renderScoreboard(
      this.players,
      this.currentRoundStats,
      this.currentPlayerIndex,
      this.laserShotsRemaining,
      laserEnabled,
    );
    this.ui.renderPlayerMeta(
      this.players,
      this.currentRoundStats,
      this.currentPlayerIndex,
      this.phase,
    );
    this.ui.renderHands(this.getRenderState(), legalCardIds, (cardId) => {
      this.playCard(HUMAN_INDEX, cardId);
    });
    this.ui.renderTrick(
      this.trickPlays,
      this.leaderIndex,
      this.trickWinnerIndex,
      this.trickWinnerIndex === null ? this.lastPlayedPlayerIndex : null,
      {
        laserMode: this.laserMode,
        laserDestroyedPlayerIndex: this.laserDestroyedPlayerIndex,
        onLaserTarget: (targetPlayerIndex) => {
          this.fireLaser(HUMAN_INDEX, targetPlayerIndex);
        },
      },
    );
  }

  getRenderState() {
    return {
      phase: this.phase,
      currentPlayerIndex: this.currentPlayerIndex,
      laserMode: this.laserMode,
      players: this.players.map((player) => ({
        ...player,
        hand: sortHand(player.hand),
      })),
    };
  }

  schedule(callback, delay) {
    const timeoutId = window.setTimeout(callback, delay);
    this.pendingTimeouts.push(timeoutId);
  }

  clearScheduled() {
    this.pendingTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.pendingTimeouts = [];
  }
}

const ui = createUI(document);
const game = new PlumpGame(ui);

initTheme();
ui.setTheme(document.documentElement.dataset.theme || "classic");

onThemeChange((themeId) => {
  ui.setTheme(themeId);
  game.laserMode = false;
  game.render();
});

ui.onNewGame(() => {
  unlockSounds();
  if (isMinecraftTheme()) {
    playMinecraftMenuClickSound();
  }
  game.clearScheduled();
  game.startMatch();
});

ui.onBid((bid) => {
  game.submitBid(HUMAN_INDEX, bid);
});

ui.onThemeSelect((themeId) => {
  applyTheme(themeId);
});

ui.onLaserToggle(() => {
  unlockSounds();
  game.toggleLaserMode();
});

document.addEventListener(
  "pointerdown",
  () => {
    unlockSounds();
  },
  { once: true },
);

game.render();
