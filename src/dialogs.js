import { isTauri } from '@tauri-apps/api/core';
import { ask, message } from '@tauri-apps/plugin-dialog';

export function alert(text) {
  if (!isTauri()) return window.alert(text);
  return message(String(text), { title: 'Gestor de beneficiarios' })
    .catch(error => console.error('No se pudo mostrar el aviso.', error));
}

export function confirm(text) {
  return isTauri()
    ? ask(text, { title: 'Confirmar', kind: 'warning', okLabel: 'Continuar', cancelLabel: 'Cancelar' })
    : Promise.resolve(window.confirm(text));
}

export function prompt(text, initialValue = '') {
  if (!isTauri()) return Promise.resolve(window.prompt(text, initialValue));
  // Usa un formulario propio para solicitar texto en la versión de escritorio.
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'input-dialog';
    const form = document.createElement('form');
    form.method = 'dialog';
    const label = document.createElement('label');
    label.textContent = text;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialValue;
    label.append(input);
    const actions = document.createElement('div');
    actions.className = 'actions';
    for (const [value, text] of [['cancel', 'Cancelar'], ['accept', 'Continuar']]) {
      const button = document.createElement('button');
      button.type = value === 'accept' ? 'submit' : 'button';
      button.value = value;
      button.textContent = text;
      button.className = value === 'accept' ? 'primary' : 'secondary';
      if (value === 'cancel') button.addEventListener('click', () => dialog.close('cancel'));
      actions.append(button);
    }
    form.append(label, actions);
    dialog.append(form);
    dialog.addEventListener('close', () => {
      const value = dialog.returnValue === 'accept' ? input.value : null;
      dialog.remove();
      resolve(value);
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    input.focus();
    input.select();
  });
}
