/**
 * app.js — Lógica de la app de expedientes de personajes.
 * Todo se guarda en IndexedDB (persistente en el dispositivo). Nada se borra
 * solo: una ficha únicamente desaparece si el usuario pulsa "Eliminar" y confirma.
 */

// Definición de los campos largos por sección (clave interna, etiqueta visible, placeholder)
const SECCIONES = [
  {
    titulo: 'Perfil & Vulnerabilidades',
    campos: [
      { key: 'personalidad', label: 'Personalidad', placeholder: 'Comportamiento, rasgos, rutinas...' },
      { key: 'debilidades', label: 'Debilidades', placeholder: 'Miedos, inseguridades, traumas, secretos...' },
    ],
    cols: 2,
  },
  {
    titulo: 'Fortalezas & Relaciones',
    campos: [
      { key: 'fortalezas', label: 'Fortalezas', placeholder: 'Motivaciones, ambiciones, deseos...' },
      { key: 'relacionesClave', label: 'Relaciones clave', placeholder: 'Familia, amigos, enemigos, dependencias...' },
    ],
    cols: 2,
  },
  {
    titulo: 'Cómo influye en otros',
    campos: [
      { key: 'comoManipula', label: 'Cómo manipula a otros', placeholder: 'Su forma de presionar, convencer o presionar emocionalmente...' },
      { key: 'queOfrece', label: 'Qué usa como carnada', placeholder: 'Qué promete o entrega para conseguir lo que quiere...' },
      { key: 'hastaDonde', label: 'Hasta dónde está dispuesto a llegar', placeholder: 'Su límite moral, qué lo detiene o no lo detiene...' },
    ],
    cols: 3,
  },
  {
    titulo: 'Efecto en la trama',
    campos: [
      { key: 'queHaConseguido', label: 'Qué ha conseguido de otros personajes', placeholder: 'Información, favores, lealtades ganadas...' },
      { key: 'poderGanado', label: 'Poder o acceso ganado en la historia', placeholder: 'Posición, influencia, control que ha adquirido...' },
    ],
    cols: 2,
  },
  {
    titulo: 'Conexiones & Objetivos',
    campos: [
      { key: 'otrosPersonajes', label: 'Otros personajes relacionados', placeholder: 'Nombres, relaciones, cómo se conecta con el elenco...' },
      { key: 'notasTrama', label: 'Próximos pasos en la trama', placeholder: 'Ideas pendientes, escenas clave, evolución...' },
    ],
    cols: 2,
  },
];

const CAMPOS_BASICOS = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'apodo', label: 'Apodo / alias' },
  { key: 'edad', label: 'Edad' },
  { key: 'rol', label: 'Rol en la historia' },
  { key: 'ubicacion', label: 'Ubicación en la historia' },
  { key: 'ocupacion', label: 'Ocupación' },
];

let fichas = [];
let fichaActivaId = null;
let temporizadorGuardado = null;

async function init() {
  fichas = await obtenerTodasLasFichas();
  renderLista();
}

function crearFichaVacia() {
  return {
    id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    creado: Date.now(),
    foto: null,
    ...Object.fromEntries(CAMPOS_BASICOS.map((c) => [c.key, ''])),
    ...Object.fromEntries(SECCIONES.flatMap((s) => s.campos).map((c) => [c.key, ''])),
  };
}

async function nuevaFicha() {
  const ficha = crearFichaVacia();
  await guardarFicha(ficha);
  fichas.push(ficha);
  fichaActivaId = ficha.id;
  renderLista();
  renderPanel(ficha);
}

function renderLista() {
  const cont = document.getElementById('lista-personajes');
  const filtro = document.getElementById('buscador').value.trim().toLowerCase();
  const visibles = fichas.filter((f) =>
    !filtro || (f.nombre || '').toLowerCase().includes(filtro) || (f.rol || '').toLowerCase().includes(filtro)
  );

  if (visibles.length === 0) {
    cont.innerHTML = '<div style="padding:16px; color:#888; font-size:9pt;">Sin resultados.</div>';
    return;
  }

  cont.innerHTML = visibles
    .map((f) => `
      <div class="item-personaje ${f.id === fichaActivaId ? 'activo' : ''}" data-id="${f.id}">
        ${f.foto
          ? `<img class="item-thumb" src="${f.foto}">`
          : `<div class="item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:14px;">👤</div>`}
        <div class="item-info">
          <div class="item-nombre">${escapeHTML(f.nombre) || 'Sin nombre'}</div>
          <div class="item-rol">${escapeHTML(f.rol) || '—'}</div>
        </div>
      </div>
    `)
    .join('');

  cont.querySelectorAll('.item-personaje').forEach((el) => {
    el.addEventListener('click', () => {
      fichaActivaId = el.dataset.id;
      const ficha = fichas.find((f) => f.id === fichaActivaId);
      renderLista();
      renderPanel(ficha);
    });
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function renderPanel(ficha) {
  const panel = document.getElementById('panel');

  const camposBasicosHTML = CAMPOS_BASICOS.map(
    (c) => `
      <div class="basic-field">
        <label>${c.label}</label>
        <input type="text" data-campo="${c.key}" value="${escapeHTML(ficha[c.key])}">
      </div>`
  ).join('');

  const seccionesHTML = SECCIONES.map(
    (s) => `
      <div class="seccion-titulo">${s.titulo}</div>
      <div class="grid-${s.cols}">
        ${s.campos
          .map(
            (c) => `
          <div class="campo-largo">
            <label>${c.label}</label>
            <textarea data-campo="${c.key}" placeholder="${c.placeholder}">${ficha[c.key] || ''}</textarea>
          </div>`
          )
          .join('')}
      </div>`
  ).join('<div class="divider"></div>');

  panel.innerHTML = `
    <div class="hoja" id="hoja-imprimible">
      <div class="hoja-toolbar">
        <span class="btn-guardar-estado" id="estado-guardado">Guardado</span>
        <button class="btn btn-pdf" id="btn-pdf">📄 Exportar PDF</button>
        <button class="btn btn-imprimir" id="btn-imprimir">🖨️ Imprimir / Guardar con foto</button>
        <button class="btn btn-eliminar" id="btn-eliminar">🗑️ Eliminar</button>
      </div>

      <div class="header">
        <div class="header-title">📁 Expediente de Peon</div>
        <div class="header-subtitle">${escapeHTML(ficha.nombre) || 'Sin nombre asignado'}</div>
      </div>

      <div class="photo-section">
        <div class="photo-box" id="foto-caja">
          <input type="file" accept="image/*" id="input-foto">
          ${ficha.foto ? `<img src="${ficha.foto}">` : '<span>FOTO</span>'}
        </div>
        <div class="basic-info">${camposBasicosHTML}</div>
      </div>

      <div class="divider"></div>

      ${seccionesHTML}

      <div class="footer">Última edición: ${new Date(ficha.creado || Date.now()).toLocaleDateString('es-ES')}</div>
    </div>
  `;

  // Autoguardado de campos de texto
  panel.querySelectorAll('[data-campo]').forEach((el) => {
    el.addEventListener('input', () => {
      ficha[el.dataset.campo] = el.value;
      marcarSinGuardar();
      programarGuardado(ficha);
      if (el.dataset.campo === 'nombre' || el.dataset.campo === 'rol') renderLista();
    });
  });

  // Foto
  document.getElementById('foto-caja').addEventListener('click', () => {
    document.getElementById('input-foto').click();
  });
  document.getElementById('input-foto').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      ficha.foto = e.target.result;
      programarGuardado(ficha, true);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-eliminar').addEventListener('click', () => confirmarEliminar(ficha));
  document.getElementById('btn-pdf').addEventListener('click', () => exportarPDF(ficha));
  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
}

function marcarSinGuardar() {
  const estado = document.getElementById('estado-guardado');
  if (estado) estado.textContent = 'Guardando...';
}

function programarGuardado(ficha, inmediato) {
  clearTimeout(temporizadorGuardado);
  const ejecutar = async () => {
    await guardarFicha(ficha);
    const estado = document.getElementById('estado-guardado');
    if (estado) estado.textContent = 'Guardado';
    if (inmediato) renderLista();
  };
  if (inmediato) ejecutar();
  else temporizadorGuardado = setTimeout(ejecutar, 400);
}

async function confirmarEliminar(ficha) {
  const ok = confirm(`¿Eliminar la ficha de "${ficha.nombre || 'este peon'}"? Esta acción no se puede deshacer.`);
  if (!ok) return;
  await eliminarFicha(ficha.id);
  fichas = fichas.filter((f) => f.id !== ficha.id);
  fichaActivaId = null;
  renderLista();
  document.getElementById('panel').innerHTML = '<div id="ficha-vacia">Selecciona un peon o crea uno nuevo para empezar.</div>';
}

function construirCamposParaPDF(ficha) {
  const campos = [];
  CAMPOS_BASICOS.forEach((c) => campos.push({ label: c.label, texto: ficha[c.key] }));
  SECCIONES.forEach((s) => {
    campos.push({ label: '— ' + s.titulo + ' —', texto: '' });
    s.campos.forEach((c) => campos.push({ label: c.label, texto: ficha[c.key] }));
  });
  return campos;
}

async function exportarPDF(ficha) {
  const blob = generarPDFDeFicha({
    titulo: ficha.nombre ? `Expediente: ${ficha.nombre}` : 'Expediente de peon',
    campos: construirCamposParaPDF(ficha),
  });
  const nombreArchivo = `expediente_${(ficha.nombre || 'personaje').replace(/[^a-z0-9]+/gi, '_')}.pdf`;
  await guardarOCompartirBlob(blob, nombreArchivo, 'application/pdf');
}

// Guarda/comparte un blob: usa Capacitor Filesystem+Share si está disponible (APK),
// o descarga normal si se ejecuta en un navegador.
async function guardarOCompartirBlob(blob, nombreArchivo, mime) {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
    try {
      const { Filesystem, Directory } = window.Capacitor.Plugins;
      const base64 = await blobToBase64(blob);
      const resultado = await Filesystem.writeFile({
        path: nombreArchivo,
        data: base64,
        directory: Directory.Documents,
      });
      if (window.Capacitor.Plugins.Share) {
        await window.Capacitor.Plugins.Share.share({
          title: nombreArchivo,
          url: resultado.uri,
        });
      } else {
        alert('Archivo guardado en Documentos: ' + nombreArchivo);
      }
      return;
    } catch (err) {
      console.error('Error guardando con Capacitor, uso descarga estándar:', err);
    }
  }
  // Navegador normal
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function exportarTodoJSON() {
  const todas = await obtenerTodasLasFichas();
  const blob = new Blob([JSON.stringify({ version: 1, fichas: todas }, null, 2)], { type: 'application/json' });
  const fecha = new Date().toISOString().slice(0, 10);
  await guardarOCompartirBlob(blob, `copia_expedientes_${fecha}.json`, 'application/json');
}

function importarJSON(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const datos = JSON.parse(e.target.result);
      const nuevas = Array.isArray(datos) ? datos : datos.fichas;
      if (!Array.isArray(nuevas)) throw new Error('Formato no reconocido');
      await importarFichas(nuevas);
      fichas = await obtenerTodasLasFichas();
      renderLista();
      alert(`Se importaron ${nuevas.length} fichas.`);
    } catch (err) {
      alert('No se pudo importar el archivo: ' + err.message);
    }
  };
  reader.readAsText(file);
}

document.getElementById('btn-nuevo').addEventListener('click', nuevaFicha);
document.getElementById('buscador').addEventListener('input', renderLista);
document.getElementById('btn-exportar-todo').addEventListener('click', exportarTodoJSON);
document.getElementById('input-importar').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importarJSON(file);
  e.target.value = '';
});

init();
