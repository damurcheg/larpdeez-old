// Editors: course editor page, module/discipline/topic/task editors (modals).
// All mutations go through Store.mutate → debounced server save.
window.CourseEditor = (() => {
  const { el, icon, refreshIcons } = U;

  function page(courseId) {
    const root = el('div');
    const course = Store.getCourse(courseId);
    if (!course) { root.appendChild(UI.emptyState('file-question', 'Курс не найден')); return root; }

    root.appendChild(el('div', { class: 'breadcrumbs' }, [el('a', { href: `#/course/${courseId}`, text: '← К просмотру курса' })]));

    const head = el('div', { class: 'page-header', style: 'max-width:none;margin-bottom:18px' });
    const titleInp = el('input', { class: 'inline-edit page-title', value: course.title, style: 'font-size:26px;font-weight:700' });
    titleInp.addEventListener('change', () => Store.mutate(courseId, (c) => { c.title = titleInp.value.trim() || 'Без названия'; }));
    const descInp = el('textarea', { class: 'textarea', placeholder: 'Описание курса' });
    descInp.value = course.description || '';
    descInp.addEventListener('change', () => Store.mutate(courseId, (c) => { c.description = descInp.value; }));
    head.appendChild(titleInp);
    head.appendChild(descInp);
    root.appendChild(head);

    const layout = el('div', { class: 'editor-layout' });
    const treeWrap = el('div', { class: 'tree' });
    let selected = { level: 'course' };

    function treeNode(ic, label, depth, onclick) {
      const n = el('div', { class: 'tree-node tree-indent-' + depth }, [icon(ic), el('span', { class: 'grow', text: label })]);
      n.onclick = onclick;
      return n;
    }

    function renderTree() {
      treeWrap.innerHTML = '';
      treeWrap.appendChild(el('div', { class: 'widget-title', text: 'Структура курса' }));
      const nodeCourse = treeNode('library', course.title || 'Курс', 0, () => { selected = { level: 'course' }; render(); });
      if (selected.level === 'course') nodeCourse.classList.add('active');
      treeWrap.appendChild(nodeCourse);
      for (const mod of course.modules) {
        const nMod = treeNode('layers', mod.title || 'Модуль', 1, () => { selected = { level: 'module', moduleId: mod.id }; render(); });
        if (selected.moduleId === mod.id && ['module', 'discipline', 'topic'].includes(selected.level)) nMod.classList.add('active');
        treeWrap.appendChild(nMod);
        for (const disc of mod.disciplines) {
          const nD = treeNode('book-open', disc.title || 'Дисциплина', 2, () => { selected = { level: 'discipline', moduleId: mod.id, disciplineId: disc.id }; render(); });
          if (selected.disciplineId === disc.id && ['discipline', 'topic'].includes(selected.level)) nD.classList.add('active');
          treeWrap.appendChild(nD);
          for (const topic of disc.topics) {
            const nT = treeNode('file-text', topic.title || 'Тема', 3, () => { selected = { level: 'topic', moduleId: mod.id, disciplineId: disc.id, topicId: topic.id }; render(); });
            if (selected.topicId === topic.id && selected.level === 'topic') nT.classList.add('active');
            treeWrap.appendChild(nT);
          }
        }
      }
      refreshIcons(treeWrap);
    }

    const panel = el('div', { class: 'editor-panel' });

    function render() {
      renderTree();
      panel.innerHTML = '';
      if (selected.level === 'course') panel.appendChild(coursePanel());
      else if (selected.level === 'module') panel.appendChild(modulePanel(selected.moduleId));
      else if (selected.level === 'discipline') panel.appendChild(disciplinePanel(selected.moduleId, selected.disciplineId));
      else if (selected.level === 'topic') panel.appendChild(topicPanel(selected.moduleId, selected.disciplineId, selected.topicId));
      refreshIcons(panel);
    }

    function reorderIn(arr, ids) {
      const map = new Map(arr.map((x) => [x.id, x]));
      const next = ids.map((id) => map.get(id)).filter(Boolean);
      arr.length = 0; next.forEach((x) => arr.push(x));
    }

    function sortableList(items, getId, makeRow, onReorderIds) {
      const wrap = el('div');
      const rowEls = [];
      for (const it of items) {
        const row = makeRow(it);
        row.setAttribute('data-sort-id', getId(it));
        row.prepend(el('span', { class: 'drag-handle' }, icon('grip-vertical')));
        wrap.appendChild(row);
        rowEls.push(row);
      }
      UI.attachDragSort(wrap, rowEls, (r) => r.getAttribute('data-sort-id'), (ids) => onReorderIds(ids));
      refreshIcons(wrap);
      return wrap;
    }

    // ----- course panel: modules list -----
    function coursePanel() {
      const box = el('div', { class: 'card', style: 'padding:16px' });
      box.appendChild(el('div', { class: 'widget-title', text: 'Модули курса — порядок меняется перетаскиванием' }));
      box.appendChild(sortableList(course.modules, (m) => m.id, (mod) => {
        const prog = Store.moduleProgress(mod);
        const avg = Store.avgGrade({ type: 'module', mod });
        const row = el('div', { class: 'list-editor-row' });
        const inp = el('input', { class: 'inline-edit', value: mod.title });
        inp.addEventListener('change', () => Store.mutate(courseId, (c) => { const m = c.modules.find((x) => x.id === mod.id); if (m) m.title = inp.value.trim() || 'Без названия'; }));
        row.appendChild(inp);
        row.appendChild(el('span', { class: 'progress-label', text: `${prog.done}/${prog.total}` }));
        row.appendChild(UI.avgGradeBadge(avg));
        const openBtn = el('button', { class: 'btn btn-secondary btn-sm' }, [icon('settings-2'), 'Редактор']);
        openBtn.onclick = () => ModuleEditor.open(courseId, mod.id, render);
        row.appendChild(openBtn);
        const delBtn = el('button', { class: 'btn-icon', title: 'Удалить модуль' }, icon('trash-2'));
        delBtn.onclick = async () => {
          if (!(await UI.confirm({ text: `Удалить модуль «${mod.title}» со всеми дисциплинами, темами и заданиями?` }))) return;
          Store.mutate(courseId, (c) => { c.modules = c.modules.filter((x) => x.id !== mod.id); });
          UI.toast('Модуль удалён');
          render();
        };
        row.appendChild(delBtn);
        return row;
      }, (ids) => {
        Store.mutate(courseId, (c) => reorderIn(c.modules, ids));
        render();
      }));
      const add = el('button', { class: 'btn btn-primary', style: 'margin-top:10px' }, [icon('plus'), 'Новый модуль']);
      add.onclick = () => {
        const id = U.uid();
        Store.mutate(courseId, (c) => c.modules.push({ id, title: 'Новый модуль', description: '', tags: [], disciplines: [], project: null }));
        selected = { level: 'module', moduleId: id };
        UI.toast('Модуль создан — изменения сохраняются автоматически');
        render();
      };
      box.appendChild(add);
      return box;
    }

    // ----- module panel -----
    function modulePanel(moduleId) {
      const mod = course.modules.find((m) => m.id === moduleId);
      if (!mod) return el('div', {}, 'Модуль не найден');
      const box = el('div', { class: 'card', style: 'padding:16px' });
      const editBtn = el('button', { class: 'btn btn-secondary' }, [icon('settings-2'), 'Редактор модуля']);
      editBtn.onclick = () => ModuleEditor.open(courseId, moduleId, render);
      box.appendChild(el('div', { class: 'widget-title' }, [el('span', { text: 'Модуль: ' + (mod.title || '—') }), editBtn]));

      box.appendChild(el('div', { class: 'field-label', text: 'Дисциплины' }));
      box.appendChild(sortableList(mod.disciplines, (d) => d.id, (disc) => {
        const dp2 = Store.disciplineProgress(disc);
        const row = el('div', { class: 'list-editor-row' });
        const inp = el('input', { class: 'inline-edit', value: disc.title });
        inp.addEventListener('change', () => Store.mutate(courseId, (c) => {
          const m = c.modules.find((x) => x.id === mod.id); const d = m && m.disciplines.find((x) => x.id === disc.id);
          if (d) d.title = inp.value.trim() || 'Без названия';
        }));
        row.appendChild(inp);
        row.appendChild(el('span', { class: 'progress-label', text: `${dp2.done}/${dp2.total} тем` }));
        const openB = el('button', { class: 'btn btn-secondary btn-sm' }, [icon('chevron-right'), 'Темы']);
        openB.onclick = () => { selected = { level: 'discipline', moduleId: mod.id, disciplineId: disc.id }; render(); };
        row.appendChild(openB);
        const del = el('button', { class: 'btn-icon', title: 'Удалить дисциплину' }, icon('trash-2'));
        del.onclick = async () => {
          if (!(await UI.confirm({ text: `Удалить дисциплину «${disc.title}» со всеми темами?` }))) return;
          Store.mutate(courseId, (c) => { const m = c.modules.find((x) => x.id === mod.id); if (m) m.disciplines = m.disciplines.filter((x) => x.id !== disc.id); });
          render();
        };
        row.appendChild(del);
        return row;
      }, (ids) => {
        Store.mutate(courseId, (c) => { const m = c.modules.find((x) => x.id === mod.id); if (m) reorderIn(m.disciplines, ids); });
        render();
      }));
      const addDisc = el('button', { class: 'btn btn-secondary btn-sm', style: 'margin-top:8px' }, [icon('plus'), 'Новая дисциплина']);
      addDisc.onclick = () => {
        const id = U.uid();
        Store.mutate(courseId, (c) => { const m = c.modules.find((x) => x.id === mod.id); if (m) m.disciplines.push({ id, title: 'Новая дисциплина', description: '', topics: [] }); });
        render();
      };
      box.appendChild(addDisc);
      return box;
    }

    // ----- discipline panel -----
    function disciplinePanel(moduleId, disciplineId) {
      const mod = course.modules.find((m) => m.id === moduleId);
      const disc = mod && mod.disciplines.find((d) => d.id === disciplineId);
      if (!disc) return el('div', {}, 'Дисциплина не найдена');
      const box = el('div', { class: 'card', style: 'padding:16px' });
      const editBtn = el('button', { class: 'btn btn-secondary btn-sm' }, [icon('pencil'), 'Редактор дисциплины']);
      editBtn.onclick = () => DisciplineEditor.open(courseId, moduleId, disciplineId, render);
      box.appendChild(el('div', { class: 'widget-title' }, [el('span', { text: 'Дисциплина: ' + (disc.title || '—') }), editBtn]));
      box.appendChild(el('div', { class: 'field-label', text: 'Темы' }));
      box.appendChild(sortableList(disc.topics, (t) => t.id, (topic) => {
        const row = el('div', { class: 'list-editor-row' });
        const inp = el('input', { class: 'inline-edit', value: topic.title });
        inp.addEventListener('change', () => Store.mutate(courseId, (c) => {
          const t = Store.locate(c, mod.id, disc.id, topic.id).topic;
          if (t) t.title = inp.value.trim() || 'Без названия';
        }));
        row.appendChild(inp);
        if (topic.date) row.appendChild(el('span', { class: 'topic-date' }, [icon('calendar'), U.fmtDate(topic.date)]));
        row.appendChild(el('span', { class: 'progress-label', text: `${topic.tasks.length} заданий` }));
        const openB = el('button', { class: 'btn btn-secondary btn-sm' }, [icon('pencil'), 'Тема']);
        openB.onclick = () => TopicEditor.open(courseId, mod.id, disc.id, topic.id, render);
        row.appendChild(openB);
        const del = el('button', { class: 'btn-icon', title: 'Удалить тему' }, icon('trash-2'));
        del.onclick = async () => {
          if (!(await UI.confirm({ text: `Удалить тему «${topic.title}» со всеми заданиями?` }))) return;
          Store.mutate(courseId, (c) => {
            const d = Store.locate(c, mod.id, disc.id).disc;
            if (d) d.topics = d.topics.filter((x) => x.id !== topic.id);
          });
          render();
        };
        row.appendChild(del);
        return row;
      }, (ids) => {
        Store.mutate(courseId, (c) => {
          const d = Store.locate(c, mod.id, disc.id).disc;
          if (d) reorderIn(d.topics, ids);
        });
        render();
      }));
      const addTopic = el('button', { class: 'btn btn-secondary btn-sm', style: 'margin-top:8px' }, [icon('plus'), 'Новая тема']);
      addTopic.onclick = () => {
        const id = U.uid();
        Store.mutate(courseId, (c) => {
          const d = Store.locate(c, mod.id, disc.id).disc;
          if (d) d.topics.push({ id, title: 'Новая тема', content: '', date: null, links: [], done: false, tasks: [] });
        });
        render();
        TopicEditor.open(courseId, mod.id, disc.id, id, render);
      };
      box.appendChild(addTopic);
      return box;
    }

    // ----- topic panel with tasks -----
    function topicPanel(moduleId, disciplineId, topicId) {
      const { mod, disc, topic } = Store.locate(course, moduleId, disciplineId, topicId);
      if (!topic) return el('div', {}, 'Тема не найдена');
      const box = el('div', { class: 'card', style: 'padding:16px' });
      box.appendChild(el('div', { class: 'widget-title' }, [el('span', { text: 'Тема: ' + (topic.title || '—') }),
        (() => { const b = el('button', { class: 'btn btn-secondary btn-sm' }, [icon('pencil'), 'Редактировать']); b.onclick = () => TopicEditor.open(courseId, moduleId, disciplineId, topicId, render); return b; })()]));
      box.appendChild(el('div', { class: 'field-label', text: `Задания (${topic.tasks.length})` }));
      box.appendChild(sortableList(topic.tasks, (t) => t.id, (task) => {
        const row = el('div', { class: 'list-editor-row' });
        const inp = el('input', { class: 'inline-edit', value: task.title });
        inp.addEventListener('change', () => Store.mutate(courseId, (c) => {
          const t = Store.locate(c, moduleId, disciplineId, topicId).topic.tasks.find((x) => x.id === task.id);
          if (t) t.title = inp.value.trim() || 'Без названия';
        }));
        row.appendChild(inp);
        if (typeof task.grade === 'number') row.appendChild(UI.avgGradeBadge(task.grade));
        const openB = el('button', { class: 'btn btn-secondary btn-sm' }, [icon('pencil'), 'Задание']);
        openB.onclick = () => TaskEditor.open({ courseId, moduleId, disciplineId, topicId, task, onSave: render });
        row.appendChild(openB);
        const del = el('button', { class: 'btn-icon', title: 'Удалить задание' }, icon('trash-2'));
        del.onclick = async () => {
          if (!(await UI.confirm({ text: `Удалить задание «${task.title}»?` }))) return;
          Store.mutate(courseId, (c) => {
            const tp = Store.locate(c, moduleId, disciplineId, topicId).topic;
            if (tp) tp.tasks = tp.tasks.filter((x) => x.id !== task.id);
          });
          render();
        };
        row.appendChild(del);
        return row;
      }, (ids) => {
        Store.mutate(courseId, (c) => {
          const tp = Store.locate(c, moduleId, disciplineId, topicId).topic;
          if (tp) reorderIn(tp.tasks, ids);
        });
        render();
      }));
      const addTask = el('button', { class: 'btn btn-primary btn-sm', style: 'margin-top:8px' }, [icon('plus'), 'Новое задание']);
      addTask.onclick = () => TaskEditor.open({ courseId, moduleId, disciplineId, topicId, task: null, onSave: render });
      box.appendChild(addTask);
      return box;
    }

    render();
    layout.appendChild(treeWrap);
    layout.appendChild(panel);
    root.appendChild(layout);
    refreshIcons(root);
    return root;
  }

  return { page };
})();

// ---------- Module editor modal ----------
window.ModuleEditor = (() => {
  const { el, icon, refreshIcons } = U;

  function open(courseId, moduleId, onDone) {
    const course = Store.getCourse(courseId);
    const mod = course && course.modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const titleInp = el('input', { class: 'input', value: mod.title });
    const descInp = el('textarea', { class: 'textarea' });
    descInp.value = mod.description || '';

    // working copies
    const tags = [...(mod.tags || [])];
    const discs = JSON.parse(JSON.stringify(mod.disciplines.map((d) => ({ id: d.id, title: d.title }))));

    const tagsWrap = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center' });
    const renderTags = () => {
      tagsWrap.innerHTML = '';
      tags.forEach((t, i) => {
        const chip = el('span', { class: 'chip tag-chip' }, [t + ' ']);
        const x = el('button', { style: 'display:inline-flex' }, icon('x'));
        x.onclick = () => { tags.splice(i, 1); renderTags(); };
        chip.appendChild(x);
        tagsWrap.appendChild(chip);
      });
      if (tags.length < 6) {
        const inp = el('input', { class: 'input', placeholder: 'Новый тег…', style: 'width:140px;padding:3px 8px;font-size:12.5px' });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && inp.value.trim()) {
            e.preventDefault();
            tags.push(inp.value.trim().slice(0, 40));
            renderTags();
            setTimeout(() => { const q = tagsWrap.querySelector('input'); q && q.focus(); }, 0);
          }
        });
        tagsWrap.appendChild(inp);
      } else {
        tagsWrap.appendChild(el('span', { class: 'field-hint', text: 'Максимум 6 тегов' }));
      }
      refreshIcons(tagsWrap);
    };
    renderTags();

    const discWrap = el('div');
    const renderDiscs = () => {
      discWrap.innerHTML = '';
      discs.forEach((d, i) => {
        const inp = el('input', { class: 'inline-edit', value: d.title });
        inp.addEventListener('change', () => { d.title = inp.value.trim() || 'Без названия'; });
        const up = el('button', { class: 'btn-icon', title: 'Выше' }, icon('chevron-up'));
        up.onclick = () => { if (i > 0) { [discs[i - 1], discs[i]] = [discs[i], discs[i - 1]]; renderDiscs(); } };
        const dn = el('button', { class: 'btn-icon', title: 'Ниже' }, icon('chevron-down'));
        dn.onclick = () => { if (i < discs.length - 1) { [discs[i + 1], discs[i]] = [discs[i], discs[i + 1]]; renderDiscs(); } };
        const del = el('button', { class: 'btn-icon', title: 'Удалить' }, icon('trash-2'));
        del.onclick = async () => {
          if (!(await UI.confirm({ text: `Удалить дисциплину «${d.title}» со всеми темами?` }))) return;
          discs.splice(i, 1); renderDiscs();
        };
        discWrap.appendChild(el('div', { class: 'list-editor-row' }, [up, dn, inp, del]));
      });
      const add = el('button', { class: 'btn btn-ghost btn-sm' }, [icon('plus'), 'Добавить дисциплину']);
      add.onclick = () => { discs.push({ id: U.uid(), title: 'Новая дисциплина' }); renderDiscs(); };
      discWrap.appendChild(add);
      refreshIcons(discWrap);
    };
    renderDiscs();

    // final project
    const project = mod.project ? JSON.parse(JSON.stringify(mod.project)) : { enabled: false, title: '', description: '', dueDate: null, icon: 'flag', criteria: [], refs: [], status: 'todo', score: null };
    const projFields = el('div', { style: 'border:1px dashed var(--border-strong);border-radius:8px;padding:12px' });
    const projTitle = el('input', { class: 'input', placeholder: 'Название проекта', value: project.title });
    const projDesc = el('textarea', { class: 'textarea', placeholder: 'Описание задания' });
    projDesc.value = project.description || '';
    const dp = DatePicker.create({ value: project.dueDate, onChange: () => {} });
    let projIcon = project.icon;
    const iconPick = UI.iconPicker(ICONS.project, projIcon, (v) => { projIcon = v; });
    const critEd = UI.criteriaEditor(project.criteria, () => {});
    const refsEd = UI.linksEditor(project.refs, () => {});
    projFields.appendChild(UI.field('Название проекта', projTitle));
    projFields.appendChild(UI.field('Описание задания', projDesc));
    projFields.appendChild(UI.field('Дата сдачи', dp.node));
    projFields.appendChild(UI.field('Иконка проекта', iconPick));
    projFields.appendChild(UI.field('Критерии выполнения (добавляйте и удаляйте пункты)', critEd.node));
    projFields.appendChild(UI.field('Референсы и ссылки (URL + название)', refsEd.node));

    const projSection = el('div', {}, [projFields]);
    const updateProjVisibility = (enabled) => { projSection.style.display = enabled ? '' : 'none'; };
    updateProjVisibility(project.enabled);
    const projSwitch = UI.switchControl(project.enabled, (v) => { project.enabled = v; updateProjVisibility(v); });

    const saveBtn = el('button', { class: 'btn btn-primary' }, [icon('check'), 'Сохранить']);
    const m = UI.openModal({
      title: 'Редактор модуля',
      wide: true,
      body: [
        UI.field('Название', titleInp),
        UI.field('Описание', descInp),
        UI.field('Теги (до 6, Enter — добавить)', tagsWrap),
        UI.field('Дисциплины', discWrap),
        el('div', { class: 'menu-sep', style: 'margin:14px 0' }),
        el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px' }, [el('strong', { text: 'Финальный проект' }), projSwitch]),
        projSection,
      ],
      footer: [saveBtn],
    });

    saveBtn.onclick = () => {
      Store.mutate(courseId, (c) => {
        const m2 = c.modules.find((x) => x.id === moduleId);
        m2.title = titleInp.value.trim() || 'Без названия';
        m2.description = descInp.value;
        m2.tags = tags.slice(0, 6);
        // merge disciplines: keep existing full objects, apply order/titles, add new, drop deleted
        const oldMap = new Map(m2.disciplines.map((d) => [d.id, d]));
        m2.disciplines = discs.map((d) => {
          const old = oldMap.get(d.id);
          if (old) { old.title = d.title; return old; }
          return { id: d.id, title: d.title, description: '', topics: [] };
        });
        if (project.enabled) {
          m2.project = { ...project, title: projTitle.value.trim(), description: projDesc.value, icon: projIcon, dueDate: dp.get() };
        } else {
          m2.project = { ...project, enabled: false };
        }
      });
      UI.toast('Модуль сохранён');
      m.close();
      onDone && onDone();
    };
    refreshIcons(saveBtn);
  }

  return { open };
})();

// ---------- Discipline editor modal ----------
window.DisciplineEditor = (() => {
  const { el, icon, refreshIcons } = U;

  function open(courseId, moduleId, disciplineId, onDone) {
    const course = Store.getCourse(courseId);
    const { mod, disc } = Store.locate(course, moduleId, disciplineId);
    if (!disc) return;

    const titleInp = el('input', { class: 'input', value: disc.title });
    const descInp = el('textarea', { class: 'textarea' });
    descInp.value = disc.description || '';

    const topics = JSON.parse(JSON.stringify(disc.topics.map((t) => ({ id: t.id, title: t.title }))));
    const topicsWrap = el('div');
    const renderTopics = () => {
      topicsWrap.innerHTML = '';
      topics.forEach((t, i) => {
        const inp = el('input', { class: 'inline-edit', value: t.title });
        inp.addEventListener('change', () => { t.title = inp.value.trim() || 'Без названия'; });
        const up = el('button', { class: 'btn-icon', title: 'Выше' }, icon('chevron-up'));
        up.onclick = () => { if (i > 0) { [topics[i - 1], topics[i]] = [topics[i], topics[i - 1]]; renderTopics(); } };
        const dn = el('button', { class: 'btn-icon', title: 'Ниже' }, icon('chevron-down'));
        dn.onclick = () => { if (i < topics.length - 1) { [topics[i + 1], topics[i]] = [topics[i], topics[i + 1]]; renderTopics(); } };
        const del = el('button', { class: 'btn-icon', title: 'Удалить тему' }, icon('trash-2'));
        del.onclick = async () => {
          if (!(await UI.confirm({ text: `Удалить тему «${t.title}» со всеми заданиями?` }))) return;
          topics.splice(i, 1); renderTopics();
        };
        topicsWrap.appendChild(el('div', { class: 'list-editor-row' }, [up, dn, inp, del]));
      });
      const add = el('button', { class: 'btn btn-ghost btn-sm' }, [icon('plus'), 'Добавить тему']);
      add.onclick = () => { topics.push({ id: U.uid(), title: 'Новая тема' }); renderTopics(); };
      topicsWrap.appendChild(add);
      refreshIcons(topicsWrap);
    };
    renderTopics();

    const saveBtn = el('button', { class: 'btn btn-primary' }, [icon('check'), 'Сохранить']);
    const m = UI.openModal({
      title: 'Редактор дисциплины',
      wide: true,
      body: [UI.field('Название', titleInp), UI.field('Описание', descInp), UI.field('Темы (порядок — кнопками ↑↓)', topicsWrap)],
      footer: [saveBtn],
    });

    saveBtn.onclick = () => {
      Store.mutate(courseId, (c) => {
        const d = Store.locate(c, moduleId, disciplineId).disc;
        d.title = titleInp.value.trim() || 'Без названия';
        d.description = descInp.value;
        const oldMap = new Map(d.topics.map((t) => [t.id, t]));
        d.topics = topics.map((t) => {
          const old = oldMap.get(t.id);
          if (old) { old.title = t.title; return old; }
          return { id: t.id, title: t.title, content: '', date: null, links: [], done: false, tasks: [] };
        });
      });
      UI.toast('Дисциплина сохранена');
      m.close();
      onDone && onDone();
    };
    refreshIcons(saveBtn);
  }

  return { open };
})();

// ---------- Topic editor modal ----------
window.TopicEditor = (() => {
  const { el, icon, refreshIcons } = U;

  function open(courseId, moduleId, disciplineId, topicId, onDone) {
    const course = Store.getCourse(courseId);
    const { topic } = Store.locate(course, moduleId, disciplineId, topicId);
    if (!topic) return;

    const titleInp = el('input', { class: 'input', value: topic.title, placeholder: 'Название темы' });
    const contentTa = el('textarea', { class: 'textarea', style: 'min-height:110px', placeholder: 'Описание или содержимое темы…' });
    contentTa.value = topic.content || '';
    const dp = DatePicker.create({ value: topic.date, onChange: () => {} });
    const links = JSON.parse(JSON.stringify(topic.links || []));
    const linksEd = UI.linksEditor(links, () => {});

    const saveBtn = el('button', { class: 'btn btn-primary' }, [icon('check'), 'Сохранить']);
    const m = UI.openModal({
      title: 'Редактор темы',
      wide: true,
      body: [
        UI.field('Название', titleInp),
        UI.field('Описание / содержимое', contentTa),
        UI.field('Дата изучения или выполнения', dp.node, 'Дата появится в календаре и планере.'),
        UI.field('Ссылки на материалы', linksEd.node, 'Если отображаемый текст не указан — показывается сам URL.'),
      ],
      footer: [saveBtn],
    });

    saveBtn.onclick = () => {
      Store.mutate(courseId, (c) => {
        const t = Store.locate(c, moduleId, disciplineId, topicId).topic;
        if (!t) return;
        t.title = titleInp.value.trim() || 'Без названия';
        t.content = contentTa.value;
        t.date = dp.get();
        t.links = links.filter((l) => l.url);
      });
      UI.toast('Тема сохранена');
      m.close();
      onDone && onDone();
    };
    refreshIcons(saveBtn);
  }

  return { open };
})();

// ---------- Task editor modal ----------
window.TaskEditor = (() => {
  const { el, icon, refreshIcons } = U;

  function open({ courseId, moduleId, disciplineId, topicId, task, onSave }) {
    const isNew = !task;
    const t = task ? JSON.parse(JSON.stringify(task)) : { id: U.uid(), title: '', description: '', date: null, criteria: [], links: [], done: false, grade: null };

    const titleInp = el('input', { class: 'input', value: t.title, placeholder: 'Название задания' });
    const descTa = el('textarea', { class: 'textarea', placeholder: 'Описание задания…' });
    descTa.value = t.description || '';
    const dp = DatePicker.create({ value: t.date, onChange: () => {} });
    const critEd = UI.criteriaEditor(t.criteria, () => {});
    const linksEd = UI.linksEditor(t.links, () => {});

    let done = !!t.done;
    const doneCheck = UI.checkbox('Задание выполнено', done, (v) => { done = v; });
    let grade = t.grade;
    const gradeWrap = el('div');
    const drawGrade = () => {
      gradeWrap.innerHTML = '';
      gradeWrap.appendChild(UI.gradeSelector(grade, (g) => { grade = g; drawGrade(); }));
      refreshIcons(gradeWrap);
    };
    drawGrade();

    const delBtn = isNew ? null : el('button', { class: 'btn btn-danger-soft' }, [icon('trash-2'), 'Удалить']);
    const saveBtn = el('button', { class: 'btn btn-primary' }, [icon('check'), 'Сохранить']);

    const m = UI.openModal({
      title: isNew ? 'Новое задание' : 'Редактор задания',
      wide: true,
      body: [
        UI.field('Название', titleInp),
        UI.field('Описание', descTa),
        UI.field('Дата (необязательно)', dp.node),
        UI.field('Критерии выполнения', critEd.node),
        UI.field('Ссылки', linksEd.node),
        UI.field('Результат', el('div', { style: 'display:flex;flex-direction:column;gap:10px' }, [doneCheck, el('div', {}, [el('div', { class: 'field-label', text: 'Оценка по единой шкале 1–5' }), gradeWrap])])),
      ],
      footer: [delBtn, saveBtn],
    });

    if (delBtn) {
      delBtn.onclick = async () => {
        if (!(await UI.confirm({ text: `Удалить задание «${t.title}»?` }))) return;
        Store.mutate(courseId, (c) => {
          const tp = Store.locate(c, moduleId, disciplineId, topicId).topic;
          if (tp) tp.tasks = tp.tasks.filter((x) => x.id !== t.id);
        });
        UI.toast('Задание удалено');
        m.close();
        onSave && onSave();
      };
    }

    saveBtn.onclick = () => {
      if (!titleInp.value.trim()) { UI.toast('Укажите название задания', 'error'); return; }
      const payload = { ...t, title: titleInp.value.trim(), description: descTa.value, date: dp.get(), done, grade };
      Store.mutate(courseId, (c) => {
        const tp = Store.locate(c, moduleId, disciplineId, topicId).topic;
        if (!tp) return;
        const idx = tp.tasks.findIndex((x) => x.id === t.id);
        if (idx >= 0) tp.tasks[idx] = payload;
        else tp.tasks.push(payload);
      });
      UI.toast(isNew ? 'Задание создано' : 'Задание сохранено');
      m.close();
      onSave && onSave();
    };
    refreshIcons(m.modal);
  }

  return { open };
})();
