/**
 * Imprime un « papier » (reçu) dans une fenêtre dédiée : même principe que
 * ReceiptModal — les feuilles de style de la page sont recopiées, puis la
 * fenêtre s'imprime et se referme. Renvoie false si le navigateur a bloqué
 * la fenêtre (popups).
 */
export function printPaper(el: Element, { title, format }: { title: string; format: 'thermal' | 'a4' }): boolean {
  let styles = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      styles += `<style>${Array.from(sheet.cssRules).map(r => r.cssText).join('\n')}</style>`;
    } catch {
      if (sheet.href) styles += `<link rel="stylesheet" href="${sheet.href}">`;
    }
  }

  const popup = window.open('', '_blank', 'width=640,height=820,toolbar=0,scrollbars=1,status=0,resizable=1');
  if (!popup) return false;

  const isA4 = format === 'a4';
  popup.document.open();
  popup.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    ${styles}
    <style>
      @page { size: ${isA4 ? 'A4' : '80mm auto'}; margin: ${isA4 ? '10mm' : '0'}; }
      html, body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body > * { margin: 0 auto !important; box-shadow: none !important; }
    </style>
  </head>
  <body>${el.outerHTML}</body>
</html>`);
  popup.document.close();

  let printed = false;
  const run = () => {
    if (printed || popup.closed) return;
    printed = true;
    popup.focus();
    popup.print();
    setTimeout(() => { if (!popup.closed) popup.close(); }, 1000);
  };
  popup.onload = () => setTimeout(run, 250);
  setTimeout(run, 900); // repli si onload ne se déclenche pas
  return true;
}
