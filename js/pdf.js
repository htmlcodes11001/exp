/**
 * pdf.js
 * Generador de PDF minimalista, sin dependencias externas ni conexión a internet.
 * Usa la fuente estándar Helvetica (incluida en todo lector PDF, no requiere embeber
 * archivos de fuente). Pensado para exportar el TEXTO de una ficha en A4.
 * La foto no se incluye en el PDF (para eso, usar "Imprimir / Guardar como PDF" del
 * sistema, que sí captura la vista completa con imagen).
 */

const PAGE_W = 595.28; // A4 en puntos
const PAGE_H = 841.89;
const MARGIN = 50;
const FONT_SIZE_TITLE = 16;
const FONT_SIZE_LABEL = 11;
const FONT_SIZE_BODY = 10;
const LINE_HEIGHT = 14;
const USABLE_WIDTH = PAGE_W - MARGIN * 2;

// Ancho aproximado de carácter en Helvetica (fracción del tamaño de fuente)
const AVG_CHAR_WIDTH_FACTOR = 0.5;

function escapeText(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}

function envolverTexto(texto, fontSize, maxWidth) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean);
  const charWidth = fontSize * AVG_CHAR_WIDTH_FACTOR;
  const maxChars = Math.max(10, Math.floor(maxWidth / charWidth));
  const lineas = [];
  let actual = '';
  palabras.forEach((palabra) => {
    const prueba = actual ? actual + ' ' + palabra : palabra;
    if (prueba.length > maxChars) {
      if (actual) lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  });
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [''];
}

/**
 * Genera un PDF (Blob) a partir de una ficha.
 * ficha = { titulo, campos: [{ label, texto }, ...] }
 * Puede generar varias páginas si el contenido no cabe en una.
 */
function generarPDFDeFicha(ficha) {
  const paginas = []; // cada página es un array de {texto, x, y, size}
  let paginaActual = [];
  let y = PAGE_H - MARGIN;

  function nuevaLinea(texto, size, extraEspacio) {
    if (y < MARGIN + LINE_HEIGHT) {
      paginas.push(paginaActual);
      paginaActual = [];
      y = PAGE_H - MARGIN;
    }
    paginaActual.push({ texto, x: MARGIN, y, size });
    y -= LINE_HEIGHT + (extraEspacio || 0);
  }

  nuevaLinea(ficha.titulo || 'Ficha de personaje', FONT_SIZE_TITLE, 8);

  (ficha.campos || []).forEach((campo) => {
    if (!campo.texto) return;
    nuevaLinea(campo.label.toUpperCase(), FONT_SIZE_LABEL, 2);
    const lineas = envolverTexto(campo.texto, FONT_SIZE_BODY, USABLE_WIDTH);
    lineas.forEach((linea) => nuevaLinea(linea, FONT_SIZE_BODY, 0));
    y -= 6; // espacio entre secciones
  });

  paginas.push(paginaActual);

  return construirPDFBytes(paginas);
}

function construirPDFBytes(paginas) {
  const objetos = [];
  const numPaginas = paginas.length;

  // 1: Catalog, 2: Pages, 3: Font, luego pares (contenido, página) por cada página
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  let nextId = 4;
  const pageIds = [];
  const contentIds = [];

  paginas.forEach(() => {
    pageIds.push(nextId++);
    contentIds.push(nextId++);
  });

  objetos[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objetos[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => id + ' 0 R').join(' ')}] /Count ${numPaginas} >>`;
  objetos[fontId] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  paginas.forEach((lineas, idx) => {
    const pageId = pageIds[idx];
    const contentId = contentIds[idx];
    objetos[pageId] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;

    let stream = 'BT\n';
    lineas.forEach((l) => {
      stream += `/F1 ${l.size} Tf\n${l.x} ${l.y} Td\n(${escapeText(l.texto)}) Tj\n`;
    });
    stream += 'ET';

    objetos[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  // Construir el archivo PDF final con tabla xref
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (let id = 1; id < nextId; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${nextId}\n0000000000 65535 f \n`;
  for (let id = 1; id < nextId; id++) {
    pdf += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${nextId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}
