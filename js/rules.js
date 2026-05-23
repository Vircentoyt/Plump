import { compareCards } from "./deck.js";

export function getLegalCards(hand, leadSuit) {
  if (!leadSuit) {
    return [...hand];
  }

  const matchingSuit = hand.filter((card) => card.suit === leadSuit);
  return matchingSuit.length > 0 ? matchingSuit : [...hand];
}

export function canPlayCard(hand, card, leadSuit) {
  return getLegalCards(hand, leadSuit).some((legalCard) => legalCard.id === card.id);
}

export function getTrickWinner(trickPlays, leadPlayerIndex) {
  const leadSuit = trickPlays[0].card.suit;
  let winnerIndex = leadPlayerIndex;

  trickPlays.forEach((play, offset) => {
    const playerIndex = (leadPlayerIndex + offset) % trickPlays.length;
    const currentWinnerCard = trickPlays[(winnerIndex - leadPlayerIndex + trickPlays.length) % trickPlays.length].card;
    const challengerCard = play.card;

    if (challengerCard.suit !== leadSuit) {
      return;
    }

    if (
      currentWinnerCard.suit !== leadSuit ||
      challengerCard.value > currentWinnerCard.value
    ) {
      winnerIndex = playerIndex;
    }
  });

  return winnerIndex;
}

export function scoreRound(bid, tricksWon) {
  if (bid === tricksWon) {
    return {
      pointsAwarded: bid + 10,
      gotPlump: false,
    };
  }

  return {
    pointsAwarded: 0,
    gotPlump: true,
  };
}

export function sortHand(hand) {
  return [...hand].sort(compareCards);
}

export function removeCardFromHand(hand, cardId) {
  return hand.filter((card) => card.id !== cardId);
}

export function getWinningPlay(trickPlays, leadPlayerIndex) {
  const leadSuit = trickPlays[0].card.suit;
  let winningPlay = trickPlays[0];
  let winningPlayerIndex = leadPlayerIndex;

  trickPlays.forEach((play, offset) => {
    const playerIndex = (leadPlayerIndex + offset) % trickPlays.length;
    if (play.card.suit !== leadSuit) {
      return;
    }

    if (
      winningPlay.card.suit !== leadSuit ||
      play.card.value > winningPlay.card.value
    ) {
      winningPlay = play;
      winningPlayerIndex = playerIndex;
    }
  });

  return { winningPlay, winningPlayerIndex };
}
