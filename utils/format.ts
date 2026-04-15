export function formatCoins(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatPercentage(value: number) {
  return `${Math.round(value)}%`;
}
