import { useEffect, useRef } from 'react';

export function useDialog(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const dialog = ref.current;
    const selector = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]';
    const focusables = () => [...dialog.querySelectorAll(selector)].filter(el => el.getClientRects().length);
    (focusables()[0] || dialog).focus();
    const keyboard = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const elements = focusables();
        if (!elements.length) { event.preventDefault(); dialog.focus(); return; }
        const first = elements[0]; const last = elements.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    dialog.addEventListener('keydown', keyboard);
    return () => { dialog.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [open, onClose]);
  return ref;
}
