'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FONT_SIZE_OPTIONS, FONT_SIZE_STORAGE_KEY, DEFAULT_FONT_SIZE, isFontSizeKey, type FontSizeKey,
} from '@/lib/font-size';

function applyFontSize(key: FontSizeKey) {
  const opt = FONT_SIZE_OPTIONS.find(o => o.value === key);
  if (opt) document.documentElement.style.fontSize = `${opt.scale * 100}%`;
}

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState<FontSizeKey>(DEFAULT_FONT_SIZE);

  useEffect(() => {
    const stored = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (isFontSizeKey(stored)) setFontSizeState(stored);
  }, []);

  const setFontSize = useCallback((key: FontSizeKey) => {
    setFontSizeState(key);
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, key);
    applyFontSize(key);
  }, []);

  return { fontSize, setFontSize };
}
