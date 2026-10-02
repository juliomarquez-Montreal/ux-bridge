// Busca aproximada (Ctrl+K): sem acento/maiúscula, aceita trecho no meio da
// palavra e pequenos erros de digitação (ex: "brigde" acha "Bridge").

export function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Distância de edição com transposição de letras vizinhas (OSA): "brigde" ->
// "bridge" = 1.
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[rows - 1][cols - 1];
}

function wordsOf(text: string): string[] {
  return text.split(/[^a-z0-9]+/).filter(Boolean);
}

// Pontuação 0..100 (0 = não corresponde). Todas as palavras da busca precisam
// corresponder a alguma palavra do texto (início, trecho ou com erro de
// digitação leve); a pontuação é a média.
export function fuzzyScore(query: string, text: string): number {
  const q = normalizeText(query).trim();
  const t = normalizeText(text);
  if (!q || !t) return 0;

  if (t.includes(q)) return 100 + (t.startsWith(q) ? 20 : 0) - Math.min(10, t.length / 10);

  const textWords = wordsOf(t);
  const tokens = wordsOf(q);
  if (tokens.length === 0) return 0;

  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const word of textWords) {
      if (word.startsWith(token)) best = Math.max(best, 80);
      else if (word.includes(token)) best = Math.max(best, 60);
      else if (token.length >= 4) {
        const allowed = token.length <= 6 ? 1 : 2;
        const distance = Math.min(editDistance(token, word), editDistance(token, word.slice(0, token.length)));
        if (distance <= allowed) best = Math.max(best, 45 - distance * 10);
      }
    }
    if (best === 0) return 0;
    total += best;
  }
  return total / tokens.length;
}
