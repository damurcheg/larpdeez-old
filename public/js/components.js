// Reusable UI components: modal, confirm, toast, dropdown menu, custom select,
// icon picker, color picker, grade selector, link list editor, criteria list, dnd helper.
window.UI = (() => {
  const { el, icon, refreshIcons } = U;

  // ---------- Modal ----------
  function openModal({ title, body, footer, wide, onClose }) {
    const root = document.getElementById('modalRoot');
    const overlay = el('div', { class: 'modal-overlay' });
    const modal = el('div', { class: 'modal' + (wide ? ' modal-wide' : ''), role: 'dialog', 'aria-modal': 'true' });
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      if (onClose) onClose();
    };
    const header = el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: title || '' }),
      el('button', { class: 'btn-icon', onclick: close, 'aria-label': 'Закрыть' }, icon('x')),
    ]);
    modal.appendChild(header);
    if (body) modal.appendChild(el('div', { class: 'modal-body' }, body));
    if (footer) modal.appendChild(el('div', { class: 'modal-footer' }, footer));
    overlay.appendChild(modal);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    root.appendChild(overlay);
    refreshIcons(modal);
    const focusable = modal.querySelector('input:not([type=hidden]), textarea, button.btn-primary');
    if (focusable) setTimeout(() => focusable.focus(), 30);
    return { close, modal, overlay };
  }

  // ---------- Confirm ----------
  function confirm({ title = 'Вы уверены?', text = '', danger = true, okLabel = 'Удалить', cancelLabel = 'Отмена' }) {
    return new Promise((resolve) => {
      const btnOk = el('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), text: okLabel });
      const btnCancel = el('button', { class: 'btn btn-secondary', text: cancelLabel });
      let closed = false;
      const m = openModal({
        title,
        body: el('p', { class: 'confirm-text', text }),
        footer: [btnCancel, btnOk],
        onClose: () => { closed = true; resolve(false); },
      });
      btnOk.onclick = () => { if (!closed) { closed = true; m.close(); resolve(true); } };
      btnCancel.onclick = () => m.close();
    });
  }

  // ---------- Toast ----------
  function toast(message, type = 'success') {
    const root = document.getElementById('toastRoot');
    const t = el('div', { class: 'toast' + (type === 'error' ? ' toast-error' : '') }, [
      icon(type === 'error' ? 'alert-triangle' : 'check-circle-2'),
      el('span', { text: message }),
    ]);
    root.appendChild(t);
    refreshIcons(t);
    setTimeout(() => {
      t.style.transition = 'opacity .25s, transform .25s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(6px)';
      setTimeout(() => t.remove(), 280);
    }, 2400);
  }

  // ---------- Dropdown menu ----------
  let activeMenu = null;
  function closeMenu() {
    if (activeMenu) { activeMenu.remove(); activeMenu = null; document.removeEventListener('mousedown', outsideHandler, true); }
  }
  function outsideHandler(e) { if (activeMenu && !activeMenu.contains(e.target)) closeMenu(); }

  function menu(anchor, items, opts = {}) {
    closeMenu();
    const m = el('div', { class: 'menu' });
    for (const it of items) {
      if (it === '-') { m.appendChild(el('div', { class: 'menu-sep' })); continue; }
      if (it.label) { m.appendChild(el('div', { class: 'menu-label', text: it.label })); continue; }
      const node = el('button', { class: 'menu-item' + (it.danger ? ' danger' : '') + (it.active ? ' active' : '') }, [
        it.icon ? icon(it.icon) : el('span', { style: 'width:16px;display:inline-block' }),
        el('span', { text: it.text }),
      ]);
      node.onclick = (e) => { e.stopPropagation(); closeMenu(); it.action && it.action(); };
      m.appendChild(node);
    }
    document.getElementById('menuRoot').appendChild(m);
    activeMenu = m;
    const r = anchor.getBoundingClientRect();
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let left = opts.alignRight ? r.right - mw : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
    m.style.left = left + 'px';
    m.style.top = top + 'px';
    refreshIcons(m);
    document.addEventListener('mousedown', outsideHandler, true);
    return m;
  }

  // ---------- Custom select ----------
  function select({ value, options, onChange, placeholder = 'Выберите…', width }) {
    const trigger = el('button', { class: 'select-trigger', type: 'button' }, [
      el('span', { class: 'select-value' }),
      icon('chevron-down'),
    ]);
    trigger.style.width = width || '100%';
    const render = () => {
      const opt = options.find((o) => String(o.value) === String(value));
      trigger.querySelector('.select-value').textContent = opt ? opt.label : placeholder;
      refreshIcons(trigger);
    };
    render();
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = trigger.classList.contains('open');
      closeMenu();
      if (isOpen) { render(); return; }
      trigger.classList.add('open');
      const items = options.map((o) => ({ text: o.label, icon: o.icon, action: () => { value = o.value; render(); onChange && onChange(value); }, active: String(o.value) === String(value) }));
      const m = menu(trigger, items.length ? items : [{ text: placeholder, action: () => {} }]);
      const obs = new MutationObserver(() => { if (!document.body.contains(m)) { trigger.classList.remove('open'); obs.disconnect(); } });
      obs.observe(document.getElementById('menuRoot'), { childList: true });
    });
    return { node: trigger, set(v) { value = v; render(); } };
  }

  // ---------- Icon picker ----------
  function iconPicker(names, current, onPick) {
    const wrap = el('div', { class: 'icon-picker' });
    names.forEach((name) => {
      const b = el('button', { type: 'button', class: 'icon-option' + (name === current ? ' selected' : ''), title: name }, icon(name));
      b.onclick = () => {
        wrap.querySelectorAll('.icon-option').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
        onPick && onPick(name);
      };
      wrap.appendChild(b);
    });
    refreshIcons(wrap);
    return wrap;
  }

  // ---------- Color picker ----------
  function colorPicker(colors, current, onPick) {
    const wrap = el('div', { class: 'icon-picker' });
    colors.forEach((c) => {
      const b = el('button', { type: 'button', class: 'color-dot' + (c === current ? ' selected' : '') });
      b.style.background = c;
      b.onclick = () => {
        wrap.querySelectorAll('.color-dot').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
        onPick && onPick(c);
      };
      wrap.appendChild(b);
    });
    return wrap;
  }

  // ---------- Grade selector (unified 1..5 scale) ----------
  function gradeSelector(current, onPick, allowClear = true) {
    const wrap = el('div', { style: 'display:flex;gap:5px;align-items:center' });
    for (const g of Store.GRADES) {
      const b = el('button', { type: 'button', class: 'grade-pill grade-' + g, text: String(g) });
      b.style.outline = String(current) === String(g) ? '2px solid var(--fg)' : 'none';
      b.style.opacity = current != null && String(current) !== String(g) ? '.55' : '1';
      b.onclick = (e) => { e.stopPropagation(); onPick(g); };
      wrap.appendChild(b);
    }
    if (allowClear && current != null) {
      const clr = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Сбросить' });
      clr.onclick = (e) => { e.stopPropagation(); onPick(null); };
      wrap.appendChild(clr);
    }
    return wrap;
  }

  // ---------- Progress bar ----------
  function progressBar(ratio, label) {
    const p = el('div', { class: 'progress' }, el('div', { class: 'progress-fill' }));
    p.firstChild.style.width = Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%';
    if (label) {
      return el('div', { style: 'display:flex;align-items:center;gap:8px;min-width:110px' }, [p, el('span', { class: 'progress-label', text: label })]);
    }
    return p;
  }

  function avgGradeBadge(avg) {
    if (avg == null) return el('span', { class: 'progress-label', text: '—' });
    const rounded = Math.round(avg * 10) / 10;
    const cls = avg >= 4.5 ? 'grade-5' : avg >= 3.5 ? 'grade-4' : avg >= 2.5 ? 'grade-3' : avg >= 1.5 ? 'grade-2' : 'grade-1';
    return el('span', { class: 'grade-pill ' + cls, title: 'Средний балл' }, String(rounded.toFixed(1)));
  }

  // ---------- Link list editor (URL + display text) ----------
  function linksEditor(links, onChange) {
    const wrap = el('div');
    const render = () => {
      wrap.innerHTML = '';
      links.forEach((l, i) => {
        const urlInp = el('input', { class: 'input', placeholder: 'https://…', value: l.url || '' });
        const textInp = el('input', { class: 'input', placeholder: 'Название (необязательно)' });
        textInp.value = l.text || '';
        urlInp.addEventListener('change', () => { l.url = urlInp.value.trim(); commit(); });
        textInp.addEventListener('change', () => { l.text = textInp.value.trim(); commit(); });
        const del = el('button', { class: 'btn-icon', title: 'Удалить ссылку' }, icon('trash-2'));
        del.onclick = () => { links.splice(i, 1); commit(); render(); };
        wrap.appendChild(el('div', { class: 'link-row' }, [urlInp, textInp, del]));
      });
      const add = el('button', { class: 'btn btn-ghost btn-sm' }, [icon('plus'), 'Добавить ссылку']);
      add.onclick = () => { links.push({ id: U.uid(), url: '', text: '' }); commit(); render(); };
      wrap.appendChild(add);
      refreshIcons(wrap);
    };
    const commit = () => onChange(links);
    render();
    return { node: wrap, rerender: render };
  }

  // ---------- Criteria list editor ----------
  function criteriaEditor(criteria, onChange) {
    const wrap = el('div');
    const render = () => {
      wrap.innerHTML = '';
      criteria.forEach((c, i) => {
        const inp = el('input', { class: 'input', placeholder: 'Критерий…' });
        inp.value = c.text || '';
        inp.addEventListener('change', () => { c.text = inp.value; commit(); });
        const del = el('button', { class: 'btn-icon', title: 'Удалить' }, icon('trash-2'));
        del.onclick = () => { criteria.splice(i, 1); commit(); render(); };
        wrap.appendChild(el('div', { class: 'link-row' }, [inp, del]));
      });
      const add = el('button', { class: 'btn btn-ghost btn-sm' }, [icon('plus'), 'Добавить критерий']);
      add.onclick = () => { criteria.push({ id: U.uid(), text: '', done: false }); commit(); render(); };
      wrap.appendChild(add);
      refreshIcons(wrap);
    };
    const commit = () => onChange(criteria);
    render();
    return { node: wrap, rerender: render };
  }

  // ---------- Drag & drop reorder (pointer events; works with touch) ----------
  // rows: array of DOM elements; container holds them in order; onReorder(newOrderIds)
  function attachDragSort(container, rowEls, getId, onReorder, handleSelector = '.drag-handle') {
    let dragging = null, ghostFrom = null, lastOver = null;

    const clearMarks = () => rowEls.forEach((r) => r.classList.remove('drop-target-above', 'drop-target-below'));

    rowEls.forEach((row) => {
      const handle = handleSelector ? row.querySelector(handleSelector) : row;
      if (!handle) return;
      handle.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        dragging = row;
        ghostFrom = getId(row);
        row.classList.add('dragging');
        handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
      });
    });

    container.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const target = e.target.closest ? e.target.closest('[data-sort-id]') : null;
      clearMarks();
      if (target && target !== dragging && container.contains(target)) {
        const rect = target.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        target.classList.add(before ? 'drop-target-above' : 'drop-target-below');
        lastOver = { target, before };
      }
    });

    const finish = () => {
      if (!dragging) return;
      dragging.classList.remove('dragging');
      clearMarks();
      if (lastOver && ghostFrom) {
        const ids = rowEls.map(getId).filter(Boolean);
        const fromIdx = ids.indexOf(ghostFrom);
        let toIdx = ids.indexOf(getId(lastOver.target));
        if (fromIdx >= 0 && toIdx >= 0) {
          ids.splice(fromIdx, 1);
          if (toIdx > fromIdx) toIdx -= 1;
          ids.splice(lastOver.before ? toIdx : toIdx + 1, 0, ghostFrom);
          if (ids.join() !== rowEls.map(getId).join()) onReorder(ids);
        }
      }
      dragging = null; ghostFrom = null; lastOver = null;
    };

    container.addEventListener('pointerup', finish);
    container.addEventListener('pointercancel', finish);
  }

  // ---------- Field helpers ----------
  function field(labelText, controlNode, hint) {
    return el('div', { class: 'field' }, [
      labelText ? el('label', { class: 'field-label', text: labelText }) : null,
      controlNode,
      hint ? el('div', { class: 'field-hint', text: hint }) : null,
    ]);
  }

  function checkbox(labelText, checked, onChange) {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!checked;
    const box = el('span', { class: 'checkbox-box' }, icon('check'));
    input.addEventListener('change', () => onChange(input.checked));
    return el('label', { class: 'checkbox' }, [input, box, el('span', { text: labelText })]);
  }

  function switchControl(checked, onChange) {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!checked;
    input.addEventListener('change', () => onChange(input.checked));
    return el('label', { class: 'switch' }, [input, el('span', { class: 'switch-track' })]);
  }

  function emptyState(iconName, title, subtitle) {
    return el('div', { class: 'empty-state' }, [icon(iconName), el('h3', { text: title }), subtitle ? el('p', { text: subtitle }) : null]);
  }

  return { openModal, confirm, toast, menu, select, iconPicker, colorPicker, gradeSelector, progressBar, avgGradeBadge, linksEditor, criteriaEditor, attachDragSort, field, checkbox, switchControl, emptyState };
})();
