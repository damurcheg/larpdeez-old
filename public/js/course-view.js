// Read-only views: course page (modules list + completed block), module page,
// topic modal, task rows. Global `CourseView`.
window.CourseView = (() => {
  const { el, icon, refreshIcons } = U;

  // ---------- Topic dialog (view + quick actions) ----------
  function openTopic(courseId, moduleId, disciplineId, topicId) {
    const course = Store.getCourse(courseId);
    if (!course) return;
    const { mod, disc, topic } = Store.locate(course, moduleId, disciplineId, topicId);
    if (!topic) return;

    const body = el('div');
    const render = () => {
      body.innerHTML = '';
      if (topic.content) body.appendChild(el('p', { style: 'white-space:pre-wrap;margin-bottom:12px' }, topic.content));
      if (topic.date) body.appendChild(el('p', { class: 'topic-date', style: 'margin-bottom:10px' }, [icon('calendar'), `Дата: ${U.fmtDate(topic.date, { year: true })}`]));
      if (topic.links && topic.links.length) {
        body.appendChild(el('div', { class: 'field-label', text: 'Материалы' }));
        for (const l of topic.links) {
          if (!l.url) continue;
          body.appendChild(el('a', { class: 'ref-link', href: l.url, target: '_blank', rel: 'noopener' }, [icon('link-2'), l.text || l.url]));
          body.appendChild(el('div', { style: 'height:4px' }));
        }
      }
      // tasks
      body.appendChild(el('div', { class: 'field-label', style: 'margin-top:14px', text: `Задания (${topic.tasks.length})` }));
      const tasksWrap = el('div');
      for (const t of topic.tasks) tasksWrap.appendChild(taskRow(courseId, moduleId, disciplineId, topicId, t));
      if (!topic.tasks.length) tasksWrap.appendChild(el('div', { class: 'planner-empty', text: 'Заданий пока нет.' }));
      body.appendChild(tasksWrap);

      const addTaskBtn = el('button', { class: 'btn btn-secondary btn-sm', style: 'margin-top:10px' }, [icon('plus'), 'Добавить задание']);
      addTaskBtn.onclick = () => TaskEditor.open({ courseId, moduleId, disciplineId, topicId, task: null, onSave: () => { m.close(); openTopic(courseId, moduleId, disciplineId, topicId); } });
      body.appendChild(addTaskBtn);

      const editBtn = el('button', { class: 'btn btn-secondary btn-sm', style: 'margin-top:10px;margin-left:8px' }, [icon('pencil'), 'Редактировать тему']);
      editBtn.onclick = () => { m.close(); TopicEditor.open(courseId, moduleId, disciplineId, topicId, () => {}); };
      body.appendChild(editBtn);

      refreshIcons(body);
    };
    render();

    const doneToggle = UI.checkbox('Тема пройдена', !!topic.done, (v) => {
      Store.mutate(courseId, (c) => { const { topic: tp } = Store.locate(c, moduleId, disciplineId, topicId); if (tp) tp.done = v; });
      UI.toast(v ? 'Тема отмечена пройденной' : 'Отметка снята');
      window.dispatchEvent(new CustomEvent('view:refresh'));
    });

    const m = UI.openModal({ title: topic.title || 'Тема', wide: true, body: [doneToggle, el('div', { style: 'height:6px' }), body] });
    return m;
  }

  // ---------- Task row inside topic ----------
  function taskRow(courseId, moduleId, disciplineId, topicId, task) {
    const row = el('div', { class: 'list-editor-row' });
    row.appendChild(UI.checkbox('', !!task.done, (v) => {
      Store.mutate(courseId, (c) => { const { t } = locateTask(); if (t) t.done = v; });
      window.dispatchEvent(new CustomEvent('view:refresh'));
    }));
    const info = el('div', { style: 'flex:1;min-width:0' });
    info.appendChild(el('div', { class: 'topic-title', style: task.done ? 'color:var(--fg-faint)' : '', text: task.title || 'Без названия' }));
    if (task.description) info.appendChild(el('div', { class: 'planner-item-path', text: task.description.slice(0, 120) }));
    if (task.criteria && task.criteria.length) {
      const doneC = task.criteria.filter((c) => c.done).length;
      info.appendChild(el('div', { class: 'planner-item-path' }, [`${doneC}/${task.criteria.length} критериев выполнено`]));
    }
    row.appendChild(info);
    if (typeof task.grade === 'number') row.appendChild(UI.avgGradeBadge(task.grade));
    const edit = el('button', { class: 'btn-icon', title: 'Редактировать задание' }, icon('pencil'));
    edit.onclick = () => TaskEditor.open({ courseId, moduleId, disciplineId, topicId, task, onSave: () => { window.dispatchEvent(new CustomEvent('view:refresh')); location.reload(); } });
    row.appendChild(edit);
    refreshIcons(row);
    function locateTask() {
      const c = Store.getCourse(courseId);
      const res = Store.locate(c, moduleId, disciplineId, topicId);
      res.t = res.topic ? res.topic.tasks.find((x) => x.id === task.id) : null;
      return res;
    }
    return row;
  }

  // ---------- Course page ----------
  // Renders modules (active in user order + collapsible completed block) and sidebar widgets.
  function coursePage(courseId) {
    const root = el('div');
    const course = Store.getCourse(courseId);
    if (!course) { root.appendChild(UI.emptyState('file-question', 'Курс не найден', 'Возможно, он был удалён.')); return root; }

    const isPrimary = Store.state.settings.primaryCourseId === courseId;

    // header with banner
    const banner = ProfileUI.bannerNode();
    root.appendChild(banner);
    const header = el('div', { class: 'page-header' });
    const titleEl = el('h1', { class: 'page-title', text: course.title });
    const descEl = el('p', { class: 'page-desc', text: course.description || '' });
    if (!course.description) descEl.textContent = 'Добавьте описание…';
    header.appendChild(el('div', { class: 'page-title-row' }, [
      titleEl,
      isPrimary ? el('span', { class: 'chip tag-chip', title: 'Главный курс' }, [icon('star'), 'Главный']) : null,
    ]));
    header.appendChild(descEl);

    const prog = Store.courseProgress(course);
    const avg = Store.avgGrade({ type: 'course', course });
    header.appendChild(el('div', { class: 'page-toolbar' }, [
      UI.progressBar(prog.ratio, U.pct(prog.ratio)),
      el('span', { class: 'chip' }, [icon('award'), 'Средний балл: ', avg == null ? '—' : avg.toFixed(2)]),
      el('span', { class: 'chip' }, [icon('layers'), `${course.modules.length} модулей`]),
      el('div', { style: 'flex:1' }),
      (() => {
        const b = el('button', { class: 'btn btn-secondary' }, [icon('arrow-left'), 'Все курсы']);
        b.onclick = () => { location.hash = '#/'; };
        return b;
      })(),
      (() => {
        const b = el('button', { class: 'btn btn-primary' }, [icon('pencil-line'), 'Редактировать курс']);
        b.onclick = () => { location.hash = `#/course/${courseId}/edit`; };
        return b;
      })(),
    ]));
    root.appendChild(header);

    // split layout: content + sidebar
    const split = el('div', { class: 'layout-split', style: 'margin-top:24px' });
    const content = el('div');
    const sidebar = el('aside', { class: 'sidebar' });

    const mini = CalendarWidget.mini({ courseId });
    sidebar.appendChild(mini.node);
    const planner = PlannerWidget.widget({ courseId });
    sidebar.appendChild(planner.node);

    // modules list
    const active = course.modules.filter((m) => !Store.moduleProgress(m).complete);
    const completed = course.modules.filter((m) => Store.moduleProgress(m).complete);

    const listWrap = el('div', { class: 'module-list' });
    for (const mod of active) listWrap.appendChild(moduleCard(courseId, mod));
    if (!active.length && !completed.length) {
      listWrap.appendChild(UI.emptyState('layers', 'В курсе пока нет модулей', 'Нажмите «Редактировать курс», чтобы добавить первый модуль.'));
    }
    content.appendChild(listWrap);

    if (completed.length) {
      const collapsed = localStorage.getItem('completedCollapsed:' + courseId) === '1';
      const secTitle = el('div', { class: 'section-title' + (collapsed ? ' section-collapsed' : '') }, [icon('chevron-down', 'chev'), el('span', { text: `Завершённые модули (${completed.length})` })]);
      const compList = el('div', { class: 'module-list' + (collapsed ? ' hidden' : '') });
      for (const mod of completed) compList.appendChild(moduleCard(courseId, mod));
      secTitle.onclick = () => {
        const nowCollapsed = !compList.classList.contains('hidden');
        compList.classList.toggle('hidden', nowCollapsed);
        secTitle.classList.toggle('section-collapsed', nowCollapsed);
        localStorage.setItem('completedCollapsed:' + courseId, nowCollapsed ? '1' : '0');
        refreshIcons(secTitle);
      };
      content.appendChild(secTitle);
      content.appendChild(compList);
      refreshIcons(secTitle);
    }

    split.appendChild(content);
    split.appendChild(sidebar);
    root.appendChild(split);
    refreshIcons(root);
    return root;
  }

  function moduleCard(courseId, mod) {
    const card = el('article', { class: 'card card-hover module-card' });
    const prog = Store.moduleProgress(mod);
    const avg = Store.avgGrade({ type: 'module', mod });
    const complete = prog.complete;
    if (complete) card.classList.add('is-completed');

    card.appendChild(el('div', { class: 'module-card-head' }, [
      icon(complete ? 'check-circle-2' : 'layers', complete ? 'completed-badge' : ''),
      el('span', { class: 'module-card-title', text: mod.title || 'Без названия' }),
      mod.project && mod.project.enabled ? el('span', { class: 'chip', title: 'Финальный проект включён' }, icon(mod.project.icon || 'flag')) : null,
      complete ? el('span', { class: 'completed-badge', text: 'Завершён' }) : null,
    ]));
    if (mod.description) card.appendChild(el('div', { class: 'course-card-desc', text: mod.description }));
    if (mod.tags && mod.tags.length) {
      card.appendChild(el('div', { class: 'module-card-tags' }, mod.tags.map((t) => el('span', { class: 'chip tag-chip', text: t }))));
    }
    card.appendChild(el('div', { class: 'module-card-meta' }, [
      UI.progressBar(prog.ratio, `${prog.done}/${prog.total}`),
      el('span', {}, [el('span', { class: 'progress-label', text: 'Средний балл: ' }), UI.avgGradeBadge(avg)]),
      el('span', { class: 'progress-label', text: `${mod.disciplines.length} дисциплин` }),
    ]));
    card.onclick = () => { location.hash = `#/course/${courseId}/module/${mod.id}`; };
    refreshIcons(card);
    return card;
  }

  // ---------- Module page ----------
  function modulePage(courseId, moduleId) {
    const root = el('div');
    const course = Store.getCourse(courseId);
    if (!course) { root.appendChild(UI.emptyState('file-question', 'Курс не найден')); return root; }
    const mod = course.modules.find((m) => m.id === moduleId);
    if (!mod) { root.appendChild(UI.emptyState('file-question', 'Модуль не найден')); return root; }

    root.appendChild(el('div', { class: 'breadcrumbs' }, [
      el('a', { href: '#/', text: 'Все курсы' }), el('span', { class: 'sep', text: '›' }),
      el('a', { href: `#/course/${courseId}`, text: course.title }), el('span', { class: 'sep', text: '›' }),
      el('span', { text: mod.title }),
    ]));

    const head = el('div', { class: 'page-header', style: 'max-width:none' });
    const prog = Store.moduleProgress(mod);
    const avg = Store.avgGrade({ type: 'module', mod });
    head.appendChild(el('h1', { class: 'page-title', style: 'font-size:26px', text: mod.title }));
    if (mod.description) head.appendChild(el('p', { class: 'page-desc', text: mod.description }));
    if (mod.tags && mod.tags.length) head.appendChild(el('div', { class: 'module-card-tags', style: 'margin-top:8px' }, mod.tags.map((t) => el('span', { class: 'chip tag-chip', text: t }))));
    head.appendChild(el('div', { class: 'page-toolbar' }, [
      UI.progressBar(prog.ratio, U.pct(prog.ratio)),
      el('span', { class: 'chip' }, [icon('award'), 'Средний балл: ', avg == null ? '—' : avg.toFixed(2)]),
      prog.complete ? el('span', { class: 'completed-badge' }, [icon('check-circle-2'), 'Модуль завершён']) : null,
      el('div', { style: 'flex:1' }),
      (() => {
        const b = el('button', { class: 'btn btn-secondary' }, [icon('pencil-line'), 'Редактировать модуль']);
        b.onclick = () => ModuleEditor.open(courseId, moduleId, () => window.dispatchEvent(new CustomEvent('view:refresh')));
        return b;
      })(),
    ]));
    root.appendChild(head);

    const split = el('div', { class: 'layout-split', style: 'margin-top:20px' });
    const content = el('div');
    const sidebar = el('aside', { class: 'sidebar' });
    sidebar.appendChild(CalendarWidget.mini({ courseId }).node);
    sidebar.appendChild(PlannerWidget.widget({ courseId }).node);

    for (const disc of mod.disciplines) content.appendChild(disciplineBlock(courseId, mod, disc));
    if (!mod.disciplines.length) content.appendChild(UI.emptyState('book-open', 'В модуле нет дисциплин', 'Добавьте дисциплины через редактор модуля.'));

    // Final project block
    if (mod.project && mod.project.enabled) content.appendChild(projectBlock(courseId, mod));

    split.appendChild(content);
    split.appendChild(sidebar);
    root.appendChild(split);
    refreshIcons(root);
    return root;
  }

  function disciplineBlock(courseId, mod, disc) {
    const dp = Store.disciplineProgress(disc);
    const block = el('div', { class: 'discipline-block' });
    block.appendChild(el('div', { class: 'discipline-head' }, [
      icon(dp.complete ? 'check-circle-2' : 'book-open'),
      el('span', { class: 'discipline-title', text: disc.title || 'Без названия' }),
      el('span', { class: 'progress-label', text: `${dp.done}/${dp.total} тем` }),
    ]));
    if (disc.description) block.appendChild(el('div', { class: 'planner-item-path', style: 'padding:8px 14px 0', text: disc.description }));
    for (const topic of disc.topics) block.appendChild(topicRow(courseId, mod, disc, topic));
    if (!disc.topics.length) block.appendChild(el('div', { class: 'planner-empty', style: 'padding:10px 14px', text: 'Тем пока нет.' }));
    return block;
  }

  function topicRow(courseId, mod, disc, topic) {
    const row = el('div', { class: 'topic-row' });
    row.appendChild(UI.checkbox('', !!topic.done, (v) => {
      Store.mutate(courseId, (c) => { const { topic: tp } = Store.locate(c, mod.id, disc.id, topic.id); if (tp) tp.done = v; });
      window.dispatchEvent(new CustomEvent('view:refresh'));
    }));
    const title = el('span', { class: 'topic-title' + (topic.done ? ' done' : ''), text: topic.title || 'Без названия' });
    title.onclick = () => openTopic(courseId, mod.id, disc.id, topic.id);
    row.appendChild(title);
    if (topic.tasks.length) {
      const doneT = topic.tasks.filter((t) => t.done).length;
      row.appendChild(el('span', { class: 'task-count-badge' }, [icon('list-checks'), `${doneT}/${topic.tasks.length}`]));
    }
    if (topic.date) row.appendChild(el('span', { class: 'topic-date' }, [icon('calendar'), U.fmtDate(topic.date)]));
    const edit = el('button', { class: 'btn-icon', title: 'Редактировать тему' }, icon('pencil'));
    edit.onclick = (e) => { e.stopPropagation(); TopicEditor.open(courseId, mod.id, disc.id, topic.id, () => window.dispatchEvent(new CustomEvent('view:refresh'))); };
    row.appendChild(edit);
    refreshIcons(row);
    return row;
  }

  // ---------- Final project block ----------
  function projectBlock(courseId, mod) {
    const p = mod.project;
    const card = el('div', { class: 'project-card', style: 'margin-top:18px' });
    const statusLabels = { 'todo': 'Не начат', 'in-progress': 'В работе', 'done': 'Завершён' };
    card.appendChild(el('div', { class: 'project-card-head' }, [
      el('div', { class: 'project-icon' }, icon(p.icon || 'flag')),
      el('div', { style: 'flex:1' }, [
        el('div', { style: 'font-weight:650;font-size:15px', text: p.title || 'Финальный проект' }),
        el('div', { class: 'planner-item-path', text: 'Финальный проект модуля' }),
      ]),
      p.dueDate ? el('span', { class: 'project-due' }, [icon('alarm-clock'), 'Сдать до: ' + U.fmtDate(p.dueDate, { year: true })]) : null,
      (() => {
        const sel = UI.select({
          value: p.status || 'todo',
          width: '150px',
          options: Object.entries(statusLabels).map(([v, l]) => ({ value: v, label: l })),
          onChange: (v) => {
            Store.mutate(courseId, (c) => { const m = c.modules.find((x) => x.id === mod.id); if (m && m.project) m.project.status = v; });
            UI.toast('Статус проекта обновлён');
            window.dispatchEvent(new CustomEvent('view:refresh'));
          },
        });
        return sel.node;
      })(),
    ]));
    if (p.description) card.appendChild(el('p', { style: 'white-space:pre-wrap;font-size:13.5px;color:var(--fg-muted)', text: p.description }));
    if (p.criteria && p.criteria.length) {
      card.appendChild(el('div', { class: 'field-label', text: 'Критерии выполнения' }));
      for (const c of p.criteria) {
        card.appendChild(el('div', { class: 'criterion-row' }, [
          UI.checkbox(c.text || '—', !!c.done, (v) => {
            Store.mutate(courseId, (cc) => {
              const m = cc.modules.find((x) => x.id === mod.id);
              const cr = m && m.project && m.project.criteria.find((x) => x.id === c.id);
              if (cr) cr.done = v;
            });
            window.dispatchEvent(new CustomEvent('view:refresh'));
          }),
        ]));
      }
    }
    // score for project (participates in averages only when set)
    card.appendChild(el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' }, [
      el('span', { class: 'field-label', style: 'margin:0', text: 'Балл проекта' }),
      UI.gradeSelector(p.score, (g) => {
        Store.mutate(courseId, (cc) => {
          const m = cc.modules.find((x) => x.id === mod.id);
          if (m && m.project) m.project.score = g;
        });
        UI.toast(g == null ? 'Балл проекта снят' : `Балл проекта: ${g}`);
        window.dispatchEvent(new CustomEvent('view:refresh'));
      }),
    ]));
    if (p.refs && p.refs.length) {
      card.appendChild(el('div', { class: 'field-label', text: 'Референсы' }));
      const refsWrap = el('div', { style: 'display:flex;flex-direction:column;gap:4px' });
      for (const r of p.refs) {
        if (!r.url) continue;
        refsWrap.appendChild(el('a', { class: 'ref-link', href: r.url, target: '_blank', rel: 'noopener' }, [icon('link-2'), r.title || r.text || r.url]));
      }
      card.appendChild(refsWrap);
    }
    refreshIcons(card);
    return card;
  }

  return { coursePage, modulePage, openTopic, projectBlock };
})();
