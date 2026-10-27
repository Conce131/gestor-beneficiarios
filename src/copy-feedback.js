import { icon } from './icons.js';

export function confirmarCopiado(button, original) {
  const minWidth = button.style.minWidth;
  button.style.minWidth = `${Math.ceil(button.getBoundingClientRect().width)}px`;
  button.innerHTML = `${icon('check')} Copiado`;
  button.classList.add('copy-confirmed');
  button.disabled = true;
  setTimeout(() => {
    button.classList.remove('copy-confirmed');
    button.innerHTML = original;
    button.style.minWidth = minWidth;
    button.disabled = false;
  }, 1800);
}
