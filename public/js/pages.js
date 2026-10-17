// Page renderers: home (all courses), calendar page, settings page. Global `Pages`.
window.Pages = (() => {
  const { el, icon, refreshIcons } = U;

  // ---------- Home: all courses + sidebar (calendar & planner) ----------
  function home() {
    const root = el('div');
    const p = Store.state.profile;

    root.appendChild(el('div', { class: 'page-header' }, [
      el('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:6px' }, [
        ProfileUI.avatarNode(p, 'avatar-sm'),
        el('h1', { style: 'font-size:24px;font-weight:700', text: `Курсы ${p.name}` }),
      ]),
      el('p', { class: 'page-desc', style: 'margin-left:0;padding-left:0', text: 'Ваши образовательные курсы, прогресс и оценки в одном месте.' }),
    ]));

    const split = el('div', { class: 'layout-split', style: 'margin-top:18px' });
    const content = el('div');
    const sidebar = el('aside', { class: 'sidebar' });

    sidebar.appendChild(CalendarWidget.mini({ courseId: null }).node);
    sidebar.appendChild(PlannerWidget.widget({ courseId: null }).node);

    const toolbar = el('div', { class: 'page-toolbar', style: 'margin-bottom:14px' }, [
      (() => {
        const b = el('button', { class: 'btn btn-primary' }, [icon('plus'), 'Новый курс']);
        b.onclick = async () => {
          const doc = await Store.createCourse('Новый курс');
          UI.toast('Курс создан');
          location.hash = `#/course/${doc.id}/edit`;
        };
        return b;
      })(),
      el('span', { class: 'field-hint', text: 'Совет: карточки можно переставлять перетаскиванием за ручку слева.' }),
    ]);
    content.appendChild(toolbar);

    const courses = [...Store.state.courses].sort((a, b) => (a.sort || 0) - (b.sort || 0));
    if (!courses.length) {
      content.appendChild(UI.emptyState('library', 'Пока нет ни одного курса', 'Создайте первый курс — иерархия: Курс → Модули → Дисциплины → Темы → Задания.'));
    } else {
      const grid = el('div', { class: 'course-grid' });
      const rowEls = [];
      for (const c of courses) {
        const card = courseCard(c);
        card.setAttribute('data-sort-id', c.id);
        card.prepend(el('span', { class: 'drag-handle', style: 'position:absolute;top:10px;left:6px' }, icon('grip-vertical')));
        card.style.paddingLeft = '26px';
        grid.appendChild(card);
        rowEls.push(card);
      }
      UI.attachDragSort(grid, rowEls, (r) => r.getAttribute('data-sort-id'), (ids) => Store.reorderCourses(ids));
      content.appendChild(grid);
    }

    split.appendChild(content);
    split.appendChild(sidebar);
    root.appendChild(split);
    refreshIcons(root);
    return root;
  }

  function courseCard(c) {
    const isPrimary = Store.state.settings.primaryCourseId === c.id;
    const prog = Store.courseProgress(c);
    const avg = Store.avgGrade({ type: 'course', course: c });
    const card = el('article', { class: 'card card-hover course-card' });
    card.appendChild(el('div', { class: 'course-card-title' }, [
      isPrimary ? icon('star', 'star') : null,
      el('span', { text: c.title || 'Без названия' }),
    ]));
    if (c.description) card.appendChild(el('div', { class: 'course-card-desc', text: c.description }));
    card.appendChild(el('div', { class: 'stat-block' }, [
      el('span', { class: 'stat-label', text: 'Прогресс' }),
      UI.progressBar(prog.ratio, U.pct(prog.ratio)),
    ]));
    card.appendChild(el('div', { class: 'course-card-stats' }, [
      el('div', { class: 'stat-block' }, [el('span', { class: 'stat-label', text: 'Средний балл' }), el('div', {}, UI.avgGradeBadge(avg))]),
      el('div', { class: 'stat-block' }, [el('span', { class: 'stat-label', text: 'Модули' }), el('span', { class: 'stat-value', text: String(c.modules.length) })]),
      prog.complete ? el('span', { class: 'completed-badge' }, [icon('check-circle-2'), 'Завершён']) : null,
    ]));
    const menuBtn = el('button', { class: 'btn-icon course-card-menu', title: 'Действия' }, icon('more-horizontal'));
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      UI.menu(menuBtn, [
        { icon: isPrimary ? 'star' : 'star', text: isPrimary ? 'Снять главный статус' : 'Сделать главным курсом', action: async () => {
            await Store.setPrimaryCourse(isPrimary ? null : c.id);
            UI.toast(isPrimary ? 'Главный курс снят' : `«${c.title}» — главный курс`);
            window.dispatchEvent(new CustomEvent('view:refresh'));
          } },
        { icon: 'external-link', text: 'Открыть курс', action: () => { location.hash = `#/course/${c.id}`; } },
        { icon: 'pencil-line', text: 'Редактировать', action: () => { location.hash = `#/course/${c.id}/edit`; } },
        '-',
        { icon: 'trash-2', text: 'Удалить курс', danger: true, action: async () => {
            if (!(await UI.confirm({ text: `Удалить курс «${c.title}» вместе со всеми модулями, темами и заданиями? Это действие необратимо.` }))) return;
            await Store.deleteCourse(c.id);
            UI.toast('Курс удалён');
            window.dispatchEvent(new CustomEvent('view:refresh'));
          } },
      ], { alignRight: true });
    };
    card.appendChild(menuBtn);
    card.addEventListener('click', () => { location.hash = `#/course/${c.id}`; });
    refreshIcons(card);
    return card;
  }

  // ---------- Calendar page ----------
  function calendar() {
    const root = el('div');
    root.appendChild(el('h1', { class: 'page-title', style: 'font-size:24px', text: 'Календарь' }));
    root.appendChild(el('p', { class: 'page-desc', style: 'padding-left:0;margin-left:0;margin-bottom:16px', text: 'Неделя с темами, сроками финальных проектов и вашими событиями. Двойной клик по дню — создать событие.' }));
    const w = CalendarWidget.fullWeek();
    root.appendChild(w.node);
    refreshIcons(root);
    return root;
  }

  // ---------- Settings page ----------
  function settings() {
    const root = el('div');
    root.appendChild(el('h1', { class: 'page-title', style: 'font-size:24px', text: 'Настройки' }));

    // Appearance
    const sec1 = el('section', { class: 'settings-section', style: 'margin-top:18px' });
    sec1.appendChild(el('h2', {}, [icon('palette'), ' Внешний вид']));
    sec1.appendChild(el('p', { class: 'sub', text: 'Тема сохраняется на сервере и применяется на всех устройствах.' }));
    const themeSel = UI.select({
      value: Store.state.settings.theme,
      width: '220px',
      options: [{ value: 'light', label: 'Светлая', icon: 'sun' }, { value: 'dark', label: 'Тёмная', icon: 'moon' }],
      onChange: (v) => { window.App.setTheme(v); Store.setSetting('theme', v); UI.toast('Тема сохранена'); },
    });
    sec1.appendChild(el('div', { class: 'setting-row' }, [el('span', { class: 'label', text: 'Тема интерфейса' }), themeSel.node]));
    root.appendChild(sec1);

    // Account / password
    const sec2 = el('section', { class: 'settings-section' });
    sec2.appendChild(el('h2', {}, [icon('shield'), ' Аккаунт']));
    sec2.appendChild(el('p', { class: 'sub', text: 'Платформа для одного пользователя. Пароль проверяется только на сервере.' }));
    const openProfile = el('button', { class: 'btn btn-secondary' }, [icon('user-pen'), 'Редактировать профиль']);
    openProfile.onclick = () => ProfileUI.openEditor();
    const logoutBtn = el('button', { class: 'btn btn-danger' }, [icon('log-out'), 'Выйти']);
    logoutBtn.onclick = async () => { await API.logout(); window.App.showLogin(); };
    sec2.appendChild(el('div', { class: 'setting-row' }, [el('div', {}, [el('div', { class: 'label', text: 'Профиль и пароль' }), el('div', { class: 'desc', text: 'Имя, аватар, баннер, смена пароля.' })]), el('div', { style: 'display:flex;gap:8px' }, [openProfile, logoutBtn])]));
    root.appendChild(sec2);

    // Backup
    const sec3 = el('section', { class: 'settings-section' });
    sec3.appendChild(el('h2', {}, [icon('database-backup'), ' Резервное копирование']));
    sec3.appendChild(el('p', { class: 'sub', text: 'Все данные хранятся на сервере. Скачивайте полную копию или восстанавливайте из файла.' }));
    const dlBtn = el('a', { class: 'btn btn-secondary', href: API.backupUrl, download: '' }, [icon('download'), 'Скачать резервную копию (JSON)']);
    sec3.appendChild(el('div', { class: 'setting-row' }, [el('div', {}, [el('div', { class: 'label', text: 'Экспорт' }), el('div', { class: 'desc', text: 'Курсы, события, профиль и настройки одним файлом.' })]), dlBtn]));

    const fileInp = el('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
    const modeWrap = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    let mode = 'merge';
    const radio = (val, label, desc) => {
      const name = el('input', { type: 'radio', name: 'restore-mode' });
      name.checked = val === 'merge';
      name.addEventListener('change', () => { mode = val; });
      return el('label', { class: 'checkbox', style: 'align-items:flex-start' }, [name, el('span', {}, [el('div', { text: label }), el('div', { class: 'desc', text: desc })])]);
    };
    modeWrap.appendChild(radio('merge', 'Дополнить (слияние)', 'Курсы и события из файла добавляются/обновляются по id.'));
    modeWrap.appendChild(radio('replace', 'Полная замена', 'Текущие курсы и события будут удалены (пароль сохранится).'));
    const restoreBtn = el('button', { class: 'btn btn-primary' }, [icon('upload'), 'Выбрать файл и восстановить']);
    restoreBtn.onclick = () => fileInp.click();
    fileInp.addEventListener('change', async () => {
      const f = fileInp.files && fileInp.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const data = JSON.parse(text);
        if (mode === 'replace' && !(await UI.confirm({ text: 'Заменить все текущие данные курсов и событий данными из файла?', okLabel: 'Заменить' }))) {
          fileInp.value = ''; return;
        }
        await API.restore(data, mode);
        await Store.load();
        UI.toast('Данные восстановлены');
        window.dispatchEvent(new CustomEvent('view:refresh'));
      } catch (e) {
        UI.toast(e.code === 'invalid-backup' ? 'Файл не похож на резервную копию' : 'Ошибка восстановления файла', 'error');
      }
      fileInp.value = '';
    });
    sec3.appendChild(el('div', { class: 'setting-row', style: 'flex-direction:column;align-items:stretch;gap:10px' }, [
      el('div', {}, [el('div', { class: 'label', text: 'Импорт' }), modeWrap, el('div', { style: 'height:8px' }), restoreBtn]),
    ]));
    root.appendChild(sec3);

    // Scale info
    const sec4 = el('section', { class: 'settings-section' });
    sec4.appendChild(el('h2', {}, [icon('ruler'), ' Шкала оценивания']));
    sec4.appendChild(el('p', { class: 'sub', text: 'Единая шкала для всей платформы: целые баллы от 1 до 5. Средний балл считается по всем оценённым заданиям; неоценённые задания и проекты без балла не учитываются, двойной учёт исключён.' }));
    const scaleRow = el('div', { style: 'display:flex;gap:8px' }, Store.GRADES.map((g) => el('span', { class: 'grade-pill grade-' + g, text: String(g) })));
    sec4.appendChild(scaleRow);
    root.appendChild(sec4);

    refreshIcons(root);
    return root;
  }

  return { home, calendar, settings };
})();
