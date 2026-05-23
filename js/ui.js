import { buildCardFaceHTML } from "./cardFace.js";
import { THEMES, getPlayerNames } from "./themes.js";

function createCardElement(card, options = {}) {
  const {
    faceDown = false,
    playable = false,
    disabled = false,
    fromPlayer = null,
    winner = false,
    dimmed = false,
    laserTarget = false,
    laserDestroyed = false,
    onClick = null,
    onLaserTarget = null,
  } = options;

  const element = document.createElement("button");
  element.type = "button";
  element.className = "card";

  if (faceDown) {
    element.classList.add("card--back");
    element.disabled = true;
    element.setAttribute("aria-label", "Dolt kort");
    return element;
  }

  element.classList.add(card.isRed ? "card--red" : "card--black");
  element.dataset.rank = card.rank;
  if (playable) {
    element.classList.add("card--playable");
  }
  if (disabled) {
    element.classList.add("card--disabled");
    element.disabled = true;
  }
  if (fromPlayer !== null) {
    element.classList.add(`card--enter-from-${fromPlayer}`);
  }
  if (winner) {
    element.classList.add("card--winner");
  }
  if (dimmed) {
    element.classList.add("card--dimmed");
  }
  if (laserTarget) {
    element.classList.add("card--laser-target");
  }
  if (laserDestroyed) {
    element.classList.add("card--laser-destroyed");
  }

  element.innerHTML = buildCardFaceHTML(card);
  element.setAttribute("aria-label", `${card.rank} ${card.suit}`);

  if (onLaserTarget && laserTarget) {
    element.addEventListener("click", onLaserTarget);
  } else if (onClick && playable && !disabled) {
    element.addEventListener("click", onClick);
  }

  return element;
}

export function createUI(root) {
  const elements = {
    roundInfo: root.querySelector("#round-info"),
    message: root.querySelector("#message"),
    scoreBody: root.querySelector("#score-body"),
    laserColHeader: root.querySelector("#laser-col-header"),
    bidPanel: root.querySelector("#bid-panel"),
    bidButtons: root.querySelector("#bid-buttons"),
    newGameBtn: root.querySelector("#new-game-btn"),
    overlay: root.querySelector("#overlay"),
    overlayTitle: root.querySelector("#overlay-title"),
    overlayText: root.querySelector("#overlay-text"),
    overlayBtn: root.querySelector("#overlay-btn"),
    settingsBtn: root.querySelector("#settings-btn"),
    settingsPanel: root.querySelector("#settings-panel"),
    themeOptions: root.querySelector("#theme-options"),
    laserBtn: root.querySelector("#laser-btn"),
    laserBeam: root.querySelector("#laser-beam"),
    hands: [
      root.querySelector("#hand-0"),
      root.querySelector("#hand-1"),
      root.querySelector("#hand-2"),
    ],
    metas: [
      root.querySelector("#meta-0"),
      root.querySelector("#meta-1"),
      root.querySelector("#meta-2"),
    ],
    playerAreas: [
      root.querySelector("#player-0"),
      root.querySelector("#player-1"),
      root.querySelector("#player-2"),
    ],
    opponentNames: [
      root.querySelector("#player-name-1"),
      root.querySelector("#player-name-2"),
    ],
    opponentAvatars: [
      root.querySelector("#avatar-1"),
      root.querySelector("#avatar-2"),
    ],
    trickSlots: [
      root.querySelector("#trick-0"),
      root.querySelector("#trick-1"),
      root.querySelector("#trick-2"),
    ],
  };

  let settingsOpen = false;

  function renderThemeOptions(currentThemeId) {
    elements.themeOptions.innerHTML = "";

    Object.values(THEMES).forEach((theme) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "theme-option";
      button.dataset.themeId = theme.id;
      button.setAttribute("aria-pressed", theme.id === currentThemeId ? "true" : "false");
      button.innerHTML = `
        <span class="theme-option-label">${theme.label}</span>
        <span class="theme-option-desc">${theme.description}</span>
      `;
      if (theme.id === currentThemeId) {
        button.classList.add("theme-option--active");
      }
      elements.themeOptions.appendChild(button);
    });
  }

  function setSettingsOpen(open) {
    settingsOpen = open;
    elements.settingsPanel.classList.toggle("hidden", !open);
    elements.settingsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  renderThemeOptions(document.documentElement.dataset.theme || "classic");

  elements.settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    setSettingsOpen(!settingsOpen);
  });

  document.addEventListener("click", (event) => {
    if (!settingsOpen) {
      return;
    }
    if (
      elements.settingsPanel.contains(event.target) ||
      elements.settingsBtn.contains(event.target)
    ) {
      return;
    }
    setSettingsOpen(false);
  });

  return {
    elements,
    onNewGame(callback) {
      elements.newGameBtn.addEventListener("click", callback);
      elements.overlayBtn.addEventListener("click", callback);
    },
    onBid(callback) {
      elements.bidButtons.addEventListener("click", (event) => {
        const button = event.target.closest("[data-bid]");
        if (!button) {
          return;
        }
        callback(Number(button.dataset.bid));
      });
    },
    onThemeSelect(callback) {
      elements.themeOptions.addEventListener("click", (event) => {
        const button = event.target.closest("[data-theme-id]");
        if (!button) {
          return;
        }
        callback(button.dataset.themeId);
      });
    },
    onLaserToggle(callback) {
      elements.laserBtn.addEventListener("click", callback);
    },
    setTheme(themeId) {
      renderThemeOptions(themeId);
      const laserEnabled = Boolean(THEMES[themeId]?.laserEnabled);
      elements.laserColHeader.classList.toggle("hidden", !laserEnabled);
      document.body.classList.toggle("theme-laser-enabled", laserEnabled);

      const names = getPlayerNames(themeId);
      elements.opponentNames.forEach((nameElement, index) => {
        if (nameElement) {
          nameElement.textContent = names[index + 1];
        }
      });

      [1, 2].forEach((playerIndex) => {
        elements.playerAreas[playerIndex]?.classList.toggle(
          "player-area--creeper",
          themeId === "minecraft",
        );
      });
    },
    setLaserMode(active, canUse) {
      elements.laserBtn.classList.toggle("hidden", !canUse && !active);
      elements.laserBtn.classList.toggle("laser-btn--active", active);
      elements.laserBtn.setAttribute("aria-pressed", active ? "true" : "false");
      elements.laserBtn.disabled = !canUse && !active;
    },
    playLaserEffect(fromPlayerIndex, toPlayerIndex, onDone) {
      const fromArea = elements.playerAreas[fromPlayerIndex];
      const toSlot = elements.trickSlots[toPlayerIndex];
      if (!fromArea || !toSlot || !elements.laserBeam) {
        onDone?.();
        return;
      }

      const fromRect = fromArea.getBoundingClientRect();
      const toRect = toSlot.getBoundingClientRect();
      const startX = fromRect.left + fromRect.width / 2;
      const startY = fromRect.top + fromRect.height * 0.35;
      const endX = toRect.left + toRect.width / 2;
      const endY = toRect.top + toRect.height / 2;
      const dx = endX - startX;
      const dy = endY - startY;
      const length = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      const beam = elements.laserBeam;
      beam.classList.remove("hidden");
      beam.style.left = `${startX}px`;
      beam.style.top = `${startY}px`;
      beam.style.width = `${length}px`;
      beam.style.transform = `rotate(${angle}deg)`;

      window.setTimeout(() => {
        beam.classList.add("hidden");
        onDone?.();
      }, 520);
    },
    setMessage(text) {
      elements.message.textContent = text;
    },
    setRoundInfo(roundNumber, cardsInRound) {
      elements.roundInfo.textContent = `Runda ${roundNumber} av 10 · ${cardsInRound} kort`;
    },
    showBidPanel(maxBid, visible) {
      elements.bidPanel.classList.toggle("hidden", !visible);
      elements.bidButtons.innerHTML = "";

      if (!visible) {
        return;
      }

      for (let bid = 0; bid <= maxBid; bid += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-bid";
        button.dataset.bid = String(bid);
        button.textContent = String(bid);
        elements.bidButtons.appendChild(button);
      }
    },
    renderScoreboard(
      players,
      currentRoundStats,
      activePlayerIndex,
      laserShotsRemaining,
      laserEnabled,
    ) {
      elements.scoreBody.innerHTML = "";
      players.forEach((player, index) => {
        const row = document.createElement("tr");
        if (index === activePlayerIndex) {
          row.classList.add("is-active");
        }
        const roundStats = currentRoundStats[index];
        const laserCell = laserEnabled
          ? `<td>${laserShotsRemaining[index] > 0 ? "1" : "0"}</td>`
          : "";
        row.innerHTML = `
          <td>${getPlayerNames()[index]}</td>
          <td>${player.points}</td>
          <td>${player.plumps}</td>
          <td>${roundStats.bid ?? "-"}</td>
          <td>${roundStats.tricksWon ?? "-"}</td>
          ${laserCell}
        `;
        elements.scoreBody.appendChild(row);
      });
    },
    renderHands(state, legalCardIds, onPlayCard) {
      state.players.forEach((player, playerIndex) => {
        elements.playerAreas[playerIndex]?.classList.toggle(
          "is-active",
          state.phase !== "idle" &&
            state.phase !== "finished" &&
            state.currentPlayerIndex === playerIndex,
        );

        const handElement = elements.hands[playerIndex];
        handElement.innerHTML = "";

        player.hand.forEach((card) => {
          const isHuman = playerIndex === 0;
          const isPlayable =
            isHuman &&
            state.phase === "play" &&
            state.currentPlayerIndex === 0 &&
            legalCardIds.has(card.id) &&
            !state.laserMode;

          const isDisabled =
            isHuman &&
            state.phase === "play" &&
            state.currentPlayerIndex === 0 &&
            !legalCardIds.has(card.id);

          const cardElement = createCardElement(card, {
            faceDown: !isHuman,
            playable: isPlayable,
            disabled: isDisabled || state.laserMode,
            onClick: isPlayable ? () => onPlayCard(card.id) : null,
          });

          handElement.appendChild(cardElement);
        });
      });
    },
    renderTrick(
      trickPlays,
      leadPlayerIndex,
      winnerPlayerIndex = null,
      animatedPlayerIndex = null,
      laserOptions = {},
    ) {
      const {
        laserMode = false,
        laserDestroyedPlayerIndex = null,
        onLaserTarget = null,
      } = laserOptions;

      elements.trickSlots.forEach((slot) => {
        slot.innerHTML = "";
        slot.classList.remove("trick-slot--winner", "trick-slot--laser-hit");
      });

      trickPlays.forEach((play, offset) => {
        const playerIndex = (leadPlayerIndex + offset) % 3;
        const slot = elements.trickSlots[playerIndex];
        const isWinner =
          winnerPlayerIndex !== null && playerIndex === winnerPlayerIndex;
        const showResult = winnerPlayerIndex !== null;
        const animateEntry =
          animatedPlayerIndex !== null && playerIndex === animatedPlayerIndex;
        const isLaserDestroyed = laserDestroyedPlayerIndex === playerIndex;

        if (isWinner) {
          slot.classList.add("trick-slot--winner");
        }
        if (isLaserDestroyed) {
          slot.classList.add("trick-slot--laser-hit");
        }

        slot.appendChild(
          createCardElement(play.card, {
            fromPlayer: animateEntry ? playerIndex : null,
            winner: isWinner,
            dimmed: showResult && !isWinner,
            laserTarget: laserMode && !isLaserDestroyed,
            laserDestroyed: isLaserDestroyed,
            onLaserTarget:
              laserMode && onLaserTarget
                ? () => onLaserTarget(playerIndex)
                : null,
          }),
        );
      });
    },
    clearTrick() {
      elements.trickSlots.forEach((slot) => {
        slot.innerHTML = "";
        slot.classList.remove("trick-slot--winner", "trick-slot--laser-hit");
      });
    },
    renderPlayerMeta(players, currentRoundStats, currentPlayerIndex, phase) {
      players.forEach((player, index) => {
        const stats = currentRoundStats[index];
        const parts = [];

        if (stats.bid !== null) {
          parts.push(`Bud: ${stats.bid}`);
        }
        if (phase === "play" || phase === "roundSummary" || phase === "finished") {
          parts.push(`Stick: ${stats.tricksWon}`);
        }
        if (phase === "play" && currentPlayerIndex === index) {
          parts.push("Spelar nu");
        }

        elements.metas[index].textContent = parts.join(" · ");
      });
    },
    showOverlay(title, text) {
      elements.overlayTitle.textContent = title;
      elements.overlayText.textContent = text;
      elements.overlay.classList.remove("hidden");
    },
    hideOverlay() {
      elements.overlay.classList.add("hidden");
    },
  };
}
