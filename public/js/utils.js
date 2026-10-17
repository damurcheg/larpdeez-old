// Small DOM & formatting utilities (global namespace `U`)
window.U = (() => {
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const DOW_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (v === true) node.setAttribute(k, '');
      else if (v !== false) node.setAttribute(k, v);
    }
    const kids = Array.isArray(children) ? children : [children];
    for (const c of kids) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return node;
  }

  function icon(name, cls = '') {
    const i = el('i', { 'data-lucide': name });
    if (cls) i.className = cls;
    return i;
  }

  function refreshIcons(root) {
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons({ root: root || document.body, attrs: { 'stroke-width': 2 } }); } catch (e) { /* noop */ }
    }
  }

  // date helpers — all dates are local "YYYY-MM-DD" strings
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function parseDate(s) {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function fmtDate(s, opts = {}) {
    const d = parseDate(s);
    if (!d) return '';
    const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    return opts.year ? `${base} ${d.getFullYear()}` : base;
  }
  function addDays(dateOrStr, n) {
    const d = typeof dateOrStr === 'string' ? parseDate(dateOrStr) : new Date(dateOrStr);
    d.setDate(d.getDate() + n);
    return d;
  }
  function dayDiff(aStr, bStr) {
    const a = parseDate(aStr), b = parseDate(bStr);
    return Math.round((a - b) / 86400000);
  }
  function startOfWeek(d) {
    const x = new Date(d);
    const wd = (x.getDay() + 6) % 7; // Monday=0
    x.setDate(x.getDate() - wd);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function relativeDayLabel(dateStr) {
    const diff = dayDiff(dateStr, todayStr());
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Завтра';
    if (diff === -1) return 'Вчера';
    const d = parseDate(dateStr);
    const thisYear = new Date().getFullYear();
    return fmtDate(dateStr, { year: d.getFullYear() !== thisYear });
  }

  function uid() {
    return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function initials(name) {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }

  function pct(n) {
    return `${Math.round(n * 100)}%`;
  }

  return { el, icon, refreshIcons, MONTHS, MONTHS_NOM, DOW_SHORT, todayStr, parseDate, fmtDate, addDays, dayDiff, startOfWeek, relativeDayLabel, uid, debounce, escapeHtml, initials, pct };
})();
