/**
 * Shared helpers — currency formatting, etc.
 */

export const fmt = (v: number, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(v || 0);
