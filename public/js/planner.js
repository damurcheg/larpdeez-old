// Planner widget: upcoming topics grouped by date (global `PlannerWidget`)
window.PlannerWidget = (() => {
  const { el, icon, refreshIcons } = U;

  // opts: { courseId|null }
  function widget(opts = {}) {
    const wrap = el('div', { class: 'widget' });

    const draw = () => {
      const hideCompleted = !!Store.state.settings.completedHidden;
      wrap.innerHTML = '';
      const titleRow = el('div', { class: 'widget-title' }, [el('span', { text: 'Планер ближайших тем' })]);
      const toggle = UI.switchControl(hideCompleted, (v) => Store.setSetting('completedHidden', v));
      titleRow.appendChild(el('label', { title: 'Скрывать завершённые' }, [toggle]));
      wrap.appendChild(titleRow);

      let items = Store.datedItems(opts.courseId || null).filter((i) => i.kind === 'topic');
      if (hideCompleted) items = items.filter((i) => !i.done);
      // keep next 60 days + overdue
      const today = U.todayStr();
      items = items.filter((i) => U.dayDiff(i.date, today) <= 60).slice(0, 40);

      if (!items.length) {
        wrap.appendChild(el('div', { class: 'planner-empty', text: 'Нет запланированных тем. Назначьте дату теме в редакторе.' }));
        refreshIcons(wrap);
        return;
      }

      const groups = new Map();
      for (const it of items) {
        const diff = U.dayDiff(it.date, today);
        let label;
        if (diff < 0) label = 'Просрочено';
        else if (diff === 0) label = 'Сегодня';
        else if (diff === 1) label = 'Завтра';
        else if (diff <= 7) label = 'На этой неделе';
        else label = U.relativeDayLabel(it.date);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(it);
      }

      for (const [label, list] of groups) {
        wrap.appendChild(el('div', { class: 'planner-group-label', text: label }));
        for (const it of list) {
          const item = el('div', { class: 'planner-item' + (it.done ? ' dimmed' : '') });
          const chk = el('span', { style: 'margin-top:2px' });
          chk.appendChild(UI.checkbox('', it.done, async (checked) => {
            const course = Store.getCourse(it.courseId);
            if (!course) return;
            Store.mutate(course.id, (c) => {
              const { topic } = Store.locate(c, it.moduleId, it.disciplineId, it.topicId);
              if (topic) topic.done = checked;
            });
            await new Promise((r) => setTimeout(r, 500));
            UI.toast(checked ? 'Тема отмечена пройденной' : 'Отметка снята');
            draw();
          }));
          item.appendChild(chk);
          item.appendChild(el('div', {}, [
            el('div', { class: 'planner-item-title', text: it.title }),
            el('div', { class: 'planner-item-path', text: it.path }),
          ]));
          item.addEventListener('click', (e) => {
            if (e.target.closest('.checkbox')) return;
            location.hash = `#/course/${it.courseId}/module/${it.moduleId}`;
          });
          wrap.appendChild(item);
        }
      }
      refreshIcons(wrap);
    };

    draw();
    return { node: wrap, redraw: draw };
  }

  return { widget };
})();
