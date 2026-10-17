// Custom Notion-style date picker (global `DatePicker`). No native <input type=date>.
window.DatePicker = (() => {
  const { el, icon, refreshIcons } = U;
  let openPopup = null;

  function closePopup() {
    if (openPopup) { openPopup.remove(); openPopup = null; document.removeEventListener('mousedown', outside, true); }
  }
  function outside(e) { if (openPopup && !openPopup.contains(e.target)) closePopup(); }

  /**
   * create({ value: 'YYYY-MM-DD'|null, onChange(v), placeholder, clearable })
   * Returns { node, set(value) }
   */
  function create(opts) {
    let value = opts.value || null;
    const display = el('span', { class: 'select-value' });
    const btn = el('button', { class: 'select-trigger dp-trigger', type: 'button' }, [display, icon('calendar')]);
    const render = () => {
      display.textContent = value ? U.fmtDate(value, { year: true }) : (opts.placeholder || 'Без даты');
      display.style.color = value ? '' : 'var(--fg-faint)';
      refreshIcons(btn);
    };
    render();

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePopup();
      const popup = buildPopup(() => value, (v) => { value = v; render(); closePopup(); opts.onChange && opts.onChange(v); });
      position(popup, btn);
      document.body.appendChild(popup);
      openPopup = popup;
      document.addEventListener('mousedown', outside, true);
    });

    const api = { node: btn, set(v) { value = v; render(); }, get() { return value; } };
    return api;
  }

  function position(popup, anchor) {
    const r = anchor.getBoundingClientRect();
    popup.style.left = '0px'; popup.style.top = '0px'; // ensure measurable
    requestAnimationFrame(() => {
      const pw = popup.offsetWidth, ph = popup.offsetHeight;
      let left = Math.max(8, Math.min(r.left, window.innerWidth - pw - 8));
      let top = r.bottom + 6;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
      popup.style.left = left + 'px';
      popup.style.top = top + 'px';
    });
  }

  function toStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function buildPopup(getValue, setValue) {
    let view = U.parseDate(getValue()) || new Date();
    view = new Date(view.getFullYear(), view.getMonth(), 1);

    const popup = el('div', { class: 'dp-popup' });
    const title = el('div', { class: 'dp-title' });

    const draw = () => {
      title.textContent = `${U.MONTHS_NOM[view.getMonth()]} ${view.getFullYear()}`;
      grid.innerHTML = '';
      for (const d of U.DOW_SHORT) grid.appendChild(el('div', { class: 'dp-dow', text: d }));
      const first = new Date(view.getFullYear(), view.getMonth(), 1);
      const startWd = (first.getDay() + 6) % 7;
      const start = new Date(first); start.setDate(first.getDate() - startWd);
      const today = U.todayStr();
      const cur = getValue();
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const ds = toStr(d);
        const cell = el('button', { type: 'button', class: 'dp-day', text: String(d.getDate()) });
        if (d.getMonth() !== view.getMonth()) cell.classList.add('other');
        if (ds === today) cell.classList.add('today');
        if (ds === cur) cell.classList.add('selected');
        cell.onclick = () => setValue(ds);
        grid.appendChild(cell);
      }
    };

    const prev = el('button', { class: 'btn-icon', onclick: () => { view.setMonth(view.getMonth() - 1); draw(); } }, icon('chevron-left'));
    const next = el('button', { class: 'btn-icon', onclick: () => { view.setMonth(view.getMonth() + 1); draw(); } }, icon('chevron-right'));
    const grid = el('div', { class: 'dp-grid' });

    const todayBtn = el('button', { class: 'btn btn-ghost btn-sm', text: 'Сегодня' });
    todayBtn.onclick = () => setValue(U.todayStr());
    const clearBtn = el('button', { class: 'btn btn-ghost btn-sm', text: 'Очистить' });
    clearBtn.onclick = () => setValue(null);

    popup.appendChild(el('div', { class: 'dp-head' }, [prev, title, next]));
    popup.appendChild(grid);
    popup.appendChild(el('div', { class: 'dp-foot' }, [clearBtn, todayBtn]));
    draw();
    refreshIcons(popup);
    return popup;
  }

  return { create };
})();
