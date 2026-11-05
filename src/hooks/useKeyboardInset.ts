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

export function useKeyboardOpen(): boolean {
  const [isOpen, setIsOpen] = useState<boolean>(() => nativeKeyboard.isOpen());

  useEffect(() => {
    nativeKeyboard.init();
    return nativeKeyboard.subscribe((_height, open) => {
      setIsOpen(open);
    });
  }, []);

  return isOpen;
}
