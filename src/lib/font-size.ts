export type FontSizeKey = 'sm' | 'md' | 'lg' | 'xl';

export const FONT_SIZE_STORAGE_KEY = 'nikki:font-size';
export const DEFAULT_FONT_SIZE: FontSizeKey = 'md';

export const FONT_SIZE_OPTIONS: { value: FontSizeKey; label: string; scale: number }[] = [
  { value: 'sm', label: 'Pequeño',     scale: 0.875 },
  { value: 'md', label: 'Normal',      scale: 1 },
  { value: 'lg', label: 'Grande',      scale: 1.125 },
  { value: 'xl', label: 'Muy grande',  scale: 1.25 },
];

export function isFontSizeKey(value: string | null): value is FontSizeKey {
  return FONT_SIZE_OPTIONS.some(o => o.value === value);
}
