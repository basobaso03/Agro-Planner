import { useState, useEffect } from 'react';
import { nativeKeyboard } from '../native/keyboard.ts';

export function useKeyboardInset(): number {
  const [keyboardHeight, setKeyboardHeight] = useState<number>(() => nativeKeyboard.getHeight());

  useEffect(() => {
    nativeKeyboard.init();
    return nativeKeyboard.subscribe((height) => {
      setKeyboardHeight(height);
    });
  }, []);

  return keyboardHeight;
}

