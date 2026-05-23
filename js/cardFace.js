const PIP_PATTERNS = {
  2: [[0.5, 0.24], [0.5, 0.76]],
  3: [[0.5, 0.18], [0.5, 0.5], [0.5, 0.82]],
  4: [[0.34, 0.24], [0.66, 0.24], [0.34, 0.76], [0.66, 0.76]],
  5: [[0.34, 0.18], [0.66, 0.18], [0.5, 0.5], [0.34, 0.82], [0.66, 0.82]],
  6: [[0.34, 0.22], [0.66, 0.22], [0.34, 0.5], [0.66, 0.5], [0.34, 0.78], [0.66, 0.78]],
  7: [[0.34, 0.16], [0.66, 0.16], [0.5, 0.36], [0.34, 0.56], [0.66, 0.56], [0.34, 0.84], [0.66, 0.84]],
  8: [[0.34, 0.14], [0.66, 0.14], [0.34, 0.38], [0.66, 0.38], [0.34, 0.62], [0.66, 0.62], [0.34, 0.86], [0.66, 0.86]],
  9: [[0.3, 0.14], [0.5, 0.14], [0.7, 0.14], [0.3, 0.5], [0.5, 0.5], [0.7, 0.5], [0.3, 0.86], [0.5, 0.86], [0.7, 0.86]],
  10: [
    [0.28, 0.13],
    [0.5, 0.13],
    [0.72, 0.13],
    [0.34, 0.36],
    [0.66, 0.36],
    [0.34, 0.64],
    [0.66, 0.64],
    [0.28, 0.87],
    [0.5, 0.87],
    [0.72, 0.87],
  ],
};

function cornerMarkup(rank, suit) {
  return `
    <span class="card-corner card-corner--tl" aria-hidden="true">
      <span class="card-corner-rank">${rank}</span>
      <span class="card-corner-suit">${suit}</span>
    </span>
    <span class="card-corner card-corner--br" aria-hidden="true">
      <span class="card-corner-rank">${rank}</span>
      <span class="card-corner-suit">${suit}</span>
    </span>
  `;
}

function pipMarkup(suit, positions) {
  return positions
    .map(
      ([x, y]) =>
        `<span class="card-pip" style="left:${x * 100}%; top:${y * 100}%;">${suit}</span>`,
    )
    .join("");
}

function centerMarkup(card) {
  const { rank, suit } = card;
  const numericRank = Number(rank);

  if (rank === "A" || ["K", "D", "Kn"].includes(rank)) {
    return `<span class="card-center card-center--ace"><span class="card-center-suit">${suit}</span></span>`;
  }

  if (Number.isFinite(numericRank) && PIP_PATTERNS[numericRank]) {
    return `<span class="card-center card-center--pips">${pipMarkup(suit, PIP_PATTERNS[numericRank])}</span>`;
  }

  return `<span class="card-center card-center--ace"><span class="card-center-suit">${suit}</span></span>`;
}

export function buildCardFaceHTML(card) {
  return `
    <span class="card-face">
      ${cornerMarkup(card.rank, card.suit)}
      ${centerMarkup(card)}
    </span>
  `;
}
