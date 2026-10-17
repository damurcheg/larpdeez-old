// Calendar widgets: compact sidebar mini-calendar + full week calendar page logic.
window.CalendarWidget = (() => {
  const { el, icon, refreshIcons } = U;

  // Compact month calendar for sidebars.
  // opts: { courseId|null, onOpenFull() }
  function mini(opts = {}) {
    let view = new Date();
    const wrap = el('div', { class: 'widget' });

    const draw = () => {
      const items = Store.datedItems(opts.courseId || null);
      const byDate = new Set(items.map((i) => i.date));
      wrap.innerHTML = '';
      const title = el('div', { class: 'mini-cal-title', text: `${U.MONTHS_NOM[view.getMonth()]} ${view.getFullYear()}` });
      const prev = el('button', { class: 'btn-icon', style: 'width:24px;height:24px' }, icon('chevron-left'));
      const next = el('button', { class: 'btn-icon', style: 'width:24px;height:24px' }, icon('chevron-right'));
      prev.onclick = () => { view.setMonth(view.getMonth() - 1); draw(); };
      next.onclick = () => { view.setMonth(view.getMonth() + 1); draw(); };
      wrap.appendChild(el('div', { class: 'widget-title' }, [el('span', { text: 'Календарь' }),
        el('button', { class: 'btn btn-ghost btn-sm', onclick: () => (opts.onOpenFull ? opts.onOpenFull() : location.hash = '#/calendar') }, icon('maximize-2'))]));
      wrap.appendChild(el('div', { class: 'mini-cal-head' }, [prev, title, next]));
      const grid = el('div', { class: 'mini-cal-grid' });
      for (const d of U.DOW_SHORT) grid.appendChild(el('div', { class: 'mini-cal-dow', text: d }));
      const first = new Date(view.getFullYear(), view.getMonth(), 1);
      const startWd = (first.getDay() + 6) % 7;
      const start = new Date(first); start.setDate(first.getDate() - startWd);
      const today = U.todayStr();
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const cell = el('div', { class: 'mini-cal-day', text: String(d.getDate()) });
        if (d.getMonth() !== view.getMonth()) cell.classList.add('other');
        if (ds === today) cell.classList.add('today');
        if (byDate.has(ds)) cell.classList.add('has-event');
        grid.appendChild(cell);
      }
      wrap.appendChild(grid);
      refreshIcons(wrap);
    };
    draw();
    return { node: wrap, redraw: draw };
  }

  // Full week calendar. Returns DOM node with its own navigation state.
  function fullWeek() {
    let anchor = new Date();
    const root = el('div');

    const draw = () => {
      const items = Store.datedItems(null);
      const weekStart = U.startOfWeek(anchor);
      const days = [];
      for (let i = 0; i < 7; i++) days.push(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
      const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const today = U.todayStr();

      root.innerHTML = '';
      const rangeLabel = `${U.fmtDate(dstr(days[0]))} — ${U.fmtDate(dstr(days[6]), { year: true })}`;
      const prevBtn = el('button', { class: 'btn-icon', onclick: () => { anchor = U.addDays(anchor, -7); draw(); } }, icon('chevron-left'));
      const nextBtn = el('button', { class: 'btn-icon', onclick: () => { anchor = U.addDays(anchor, 7); draw(); } }, icon('chevron-right'));
      const todayBtn = el('button', { class: 'cal-today-btn', text: 'Сегодня', onclick: () => { anchor = new Date(); draw(); } });

      root.appendChild(el('div', { class: 'page-toolbar', style: 'margin-bottom:14px' }, [
        el('div', { class: 'cal-nav' }, [prevBtn, todayBtn, nextBtn, el('strong', { text: rangeLabel })]),
        el('div', { style: 'margin-left:auto' }, (() => {
          const b = el('button', { class: 'btn btn-primary' }, [icon('plus'), 'Новое событие']);
          b.onclick = () => EventEditor.open({ date: today, onSave: () => draw() });
          return b;
        })()),
      ]));

      const grid = el('div', { class: 'week-grid' });
      grid.appendChild(el('div', { class: 'week-head' })); // corner
      for (const d of days) {
        const head = el('div', { class: 'week-head' }, [
          el('span', { text: U.DOW_SHORT[(d.getDay() + 6) % 7] }),
          el('span', { class: 'daynum', text: String(d.getDate()) }),
        ]);
        if (dstr(d) === today) head.classList.add('today-col');
        grid.appendChild(head);
      }
      for (const d of days) {
        const ds = dstr(d);
        const col = el('div', { class: 'day-col' });
        const dayItems = items.filter((i) => i.date === ds);
        for (const it of dayItems) {
          const color = it.kind === 'event' ? it.color : it.kind === 'project' ? '#d9730d' : (it.done ? 'var(--fg-faint)' : 'var(--accent)');
          const pill = el('div', { class: 'event-pill', style: `background:${color}`, title: it.title });
          const ic = it.kind === 'event' ? it.icon : it.kind === 'project' ? 'flag' : 'book-open';
          pill.appendChild(icon(ic));
          pill.appendChild(el('span', { text: (it.time ? it.time + ' · ' : '') + it.title }));
          pill.onclick = () => openItem(it, draw);
          col.appendChild(pill);
        }
        if (!dayItems.length) {
          const add = el('button', { class: 'btn btn-ghost btn-sm', style: 'margin:4px;color:var(--fg-faint)', title: 'Добавить событие' }, icon('plus'));
          add.onclick = () => EventEditor.open({ date: ds, onSave: () => draw() });
          col.appendChild(add);
        }
        col.addEventListener('dblclick', () => EventEditor.open({ date: ds, onSave: () => draw() }));
        grid.appendChild(col);
      }
      root.appendChild(grid);
      refreshIcons(root);
    };

    draw();
    return { node: root, redraw: draw };
  }

  function openItem(it, after) {
    if (it.kind === 'event') {
      const ev = Store.state.events.find((e) => e.id === it.eventId);
      if (ev) EventEditor.open({ event: ev, onSave: () => after && after() });
    } else if (it.kind === 'topic') {
      location.hash = `#/course/${it.courseId}/module/${it.moduleId}`;
    } else if (it.kind === 'project') {
      location.hash = `#/course/${it.courseId}/module/${it.moduleId}`;
    }
  }

  return { mini, fullWeek };
})();
