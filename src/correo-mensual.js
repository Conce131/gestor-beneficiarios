import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { enlaceBorrador } from './mensual-envio.js';
import { confirmarCopiado } from './copy-feedback.js';

export function prepararCorreoMensual(resumen, copiarImagen) {
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'monthly-email-dialog';
  dialog.setAttribute('aria-labelledby', 'monthly-email-title');
  const form = document.createElement('form');
  form.method = 'dialog';
  const title = document.createElement('h2');
  title.id = 'monthly-email-title';
  title.textContent = 'Preparar correo';
  const help = document.createElement('p');
  help.textContent = 'Revisa el borrador. Puedes copiar la imagen o el texto para pegarlos en tu correo del navegador, o abrir tu aplicación de correo.';
  const field = (labelText, value, name, type = 'text') => {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    input.name = name;
    input.value = value;
    input.required = true;
    label.append(input);
    form.append(label);
    return input;
  };
  form.append(title, help);
  const para = field('Para', resumen.para, 'para', 'email');
  const asunto = field('Asunto', resumen.asunto, 'asunto');
  const cuerpo = field('Mensaje', resumen.cuerpo, 'cuerpo', 'textarea');
  const status = document.createElement('p');
  status.className = 'monthly-email-status';
  status.setAttribute('role', 'status');
  const note = document.createElement('p');
  note.className = 'monthly-email-note';
  note.textContent = 'Para el correo del navegador: pulsa «Copiar imagen», abre un mensaje y pega dentro del cuerpo con Ctrl+V (⌘V en Mac).';
  const actions = document.createElement('div');
  actions.className = 'actions';
  const button = (label, className, handler) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.textContent = label;
    el.addEventListener('click', handler);
    actions.append(el);
  };
  button('Cerrar', 'secondary', () => dialog.close());
  button('Copiar imagen', 'secondary', async event => {
    const button = event.currentTarget;
    const original = button.innerHTML;
    let copiado = false;
    button.disabled = true;
    button.textContent = 'Copiando imagen…';
    try {
      await copiarImagen();
      copiado = true;
      confirmarCopiado(button, original);
      status.textContent = 'Imagen copiada. Pégala dentro del mensaje de tu correo con Ctrl+V (⌘V en Mac).';
    } catch (error) {
      status.textContent = error.name === 'NotAllowedError'
        ? 'No se pudo copiar la imagen. Permite el acceso al portapapeles o utiliza «Descargar imagen» en el resumen.'
        : `No se pudo copiar la imagen. ${error.message}`;
    } finally {
      if (!copiado) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  });
  button('Copiar texto', 'secondary', async () => {
    try {
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(cuerpo.value); }
        catch { copiarSeleccion(); }
      } else copiarSeleccion();
      status.textContent = 'Texto copiado. Pégalo en el cuerpo del correo.';
    } catch {
      cuerpo.focus(); cuerpo.select();
      status.textContent = 'El texto está seleccionado. Pulsa Ctrl+C para copiarlo.';
    }
  });
  function copiarSeleccion() {
    cuerpo.focus(); cuerpo.select();
    if (!document.execCommand('copy')) throw new Error('No se pudo copiar.');
  }
  button('Abrir en mi correo', 'primary', async () => {
    if (!form.reportValidity()) return;
    try {
      const url = enlaceBorrador({ para: para.value.trim(), asunto: asunto.value, cuerpo: cuerpo.value });
      if (isTauri()) await openUrl(url);
      else {
        const link = document.createElement('a');
        link.href = url;
        link.click();
      }
      status.textContent = 'Se ha solicitado abrir el borrador. Si no se abre tu correo, utiliza «Copiar texto».';
    } catch (error) {
      status.textContent = `No se pudo abrir el correo. ${error.message} Puedes utilizar «Copiar texto».`;
    }
  });
  form.addEventListener('submit', event => event.preventDefault());
  form.append(note, status, actions);
  dialog.append(form);
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  para.focus();
}
