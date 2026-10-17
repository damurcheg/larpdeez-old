// Profile editor modal + profile header helpers (global `ProfileUI`, `EventEditor`)
window.ProfileUI = (() => {
  const { el, icon, refreshIcons } = U;

  function avatarNode(profile, sizeClass = '') {
    const a = el('span', { class: 'avatar ' + sizeClass });
    a.style.background = profile.avatarColor || '#6366f1';
    a.appendChild(icon(profile.avatar || 'user'));
    refreshIcons(a);
    return a;
  }

  function bannerNode(extraClass = '') {
    const b = el('div', { class: `page-banner banner-gradient banner-${Store.state.profile.banner || 'banner1'} ${extraClass}` });
    return b;
  }

  function openEditor() {
    const p = { ...Store.state.profile };
    let avatar = p.avatar, avatarColor = p.avatarColor, banner = p.banner;

    const nameInput = el('input', { class: 'input', value: p.name, placeholder: 'Ваше имя' });
    const avatarPreview = el('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:8px' });
    const renderPreview = () => {
      avatarPreview.innerHTML = '';
      const prof = { ...p, avatar, avatarColor };
      avatarPreview.appendChild(avatarNode(prof, 'avatar-lg'));
      avatarPreview.appendChild(el('div', { class: 'field-hint', text: 'Выберите иконку и цвет аватара' }));
      refreshIcons(avatarPreview);
    };
    renderPreview();

    const avatarPicker = UI.iconPicker(ICONS.avatar, avatar, (v) => { avatar = v; renderPreview(); });
    const colorPicker = UI.colorPicker(['#6366f1', '#eb5757', '#d9730d', '#dfab01', '#4cbf99', '#0b6e99', '#694ec9', '#ad58dd', '#e03e8c', '#37352f'], avatarColor, (v) => { avatarColor = v; renderPreview(); });

    const bannerGrid = el('div', { class: 'banner-picker' });
    const renderBanners = () => {
      bannerGrid.innerHTML = '';
      for (let i = 1; i <= 8; i++) {
        const id = 'banner' + i;
        const opt = el('button', { type: 'button', class: `banner-option banner-gradient banner-${id}` + (id === banner ? ' selected' : '') });
        opt.onclick = () => { banner = id; renderBanners(); };
        bannerGrid.appendChild(opt);
      }
    };
    renderBanners();

    // password change section
    const oldPass = el('input', { class: 'input', type: 'password', placeholder: 'Текущий пароль', autocomplete: 'current-password' });
    const newPass = el('input', { class: 'input', type: 'password', placeholder: 'Новый пароль (мин. 6 символов)', autocomplete: 'new-password' });
    const passErr = el('div', { class: 'form-error hidden' });
    const passBtn = el('button', { class: 'btn btn-secondary' }, [icon('key-round'), 'Изменить пароль']);
    passBtn.onclick = async () => {
      passErr.classList.add('hidden');
      passBtn.disabled = true;
      try {
        await API.changePassword(oldPass.value, newPass.value);
        UI.toast('Пароль изменён');
        oldPass.value = ''; newPass.value = '';
      } catch (e) {
        passErr.textContent = e.code === 'wrong-old-password' ? 'Текущий пароль указан неверно' : e.code === 'password-too-short' ? 'Новый пароль слишком короткий' : 'Не удалось изменить пароль';
        passErr.classList.remove('hidden');
      } finally { passBtn.disabled = false; refreshIcons(passBtn); }
    };

    const saveBtn = el('button', { class: 'btn btn-primary' }, [icon('check'), 'Сохранить']);
    const m = UI.openModal({
      title: 'Редактирование профиля',
      wide: true,
      body: [
        UI.field('Имя', nameInput),
        UI.field('Аватар', el('div', {}, [avatarPreview, avatarPicker, el('div', { style: 'height:8px' }), colorPicker])),
        UI.field('Баннер профиля', bannerGrid),
        el('div', { class: 'menu-sep', style: 'margin:16px 0' }),
        UI.field('Изменение пароля', el('div', {}, [oldPass, el('div', { style: 'height:6px' }), newPass, el('div', { style: 'height:8px' }), passBtn, passErr]),
          'Пароль хранится только на сервере в виде хеша.'),
      ],
      footer: [saveBtn],
    });

    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      try {
        await Store.saveProfile({ name: nameInput.value.trim() || 'Студент', avatar, avatarColor, banner });
        UI.toast('Профиль сохранён');
        m.close();
        window.dispatchEvent(new CustomEvent('profile:updated'));
      } catch (e) {
        UI.toast('Ошибка сохранения профиля', 'error');
        saveBtn.disabled = false;
      }
    };
    refreshIcons(saveBtn);
  }

  return { openEditor, avatarNode, bannerNode };
})();

// Event create/edit modal (calendar events)
window.EventEditor = (() => {
  const { el, icon, refreshIcons } = U;

  function open({ event, date, onSave }) {
    const isNew = !event;
    const ev = event ? { ...event } : { id: null, title: '', description: '', date: date || U.todayStr(), time: null, icon: 'calendar-days', color: ICONS.colors[5] };

    const titleInp = el('input', { class: 'input', placeholder: 'Название события', value: ev.title });
    const descInp = el('textarea', { class: 'textarea', placeholder: 'Описание (необязательно)' });
    descInp.value = ev.description || '';
    let curDate = ev.date, curTime = ev.time, curIcon = ev.icon, curColor = ev.color;

    const dp = DatePicker.create({ value: curDate, onChange: (v) => { curDate = v; } });

    const hasTime = el('input', { type: 'checkbox' });
    hasTime.checked = !!ev.time;
    const timeH = el('input', { class: 'input time-input', inputmode: 'numeric', placeholder: 'чч:мм', maxlength: 5 });
    timeH.value = ev.time || '';
    const timeM = el('input', { class: 'input time-input', inputmode: 'numeric', placeholder: 'мм', maxlength: 2 });
    timeM.value = '';
    if (ev.time) { const [h, mi] = ev.time.split(':'); timeH.value = h; timeM.value = mi; }
    const timeRow = el('div', { class: 'time-field hidden' }, [
      timeH, el('span', { text: ':' }), timeM,
      el('span', { class: 'field-hint', text: '(например 09:30)' }),
    ]);
    const timeWrap = el('div', { class: 'field' }, [
      UI.checkbox('Указать время', hasTime.checked, (v) => { timeRow.classList.toggle('hidden', !v); }),
      timeRow,
    ]);

    const iconPicker = UI.iconPicker(ICONS.event, curIcon, (v) => { curIcon = v; });
    const colorPicker = UI.colorPicker(ICONS.colors, curColor, (v) => { curColor = v; });

    const delBtn = el('button', { class: 'btn btn-danger-soft' }, [icon('trash-2'), 'Удалить']);
    const saveBtn = el('button', { class: 'btn btn-primary' }, [icon('check'), 'Сохранить']);

    const m = UI.openModal({
      title: isNew ? 'Новое событие' : 'Редактирование события',
      body: [
        UI.field('Название', titleInp),
        UI.field('Описание', descInp),
        UI.field('Дата', dp.node),
        timeWrap,
        UI.field('Иконка', iconPicker),
        UI.field('Цвет', colorPicker),
      ],
      footer: [isNew ? null : delBtn, saveBtn],
    });

    if (!isNew) {
      delBtn.onclick = async () => {
        const ok = await UI.confirm({ text: `Удалить событие «${ev.title}»?` });
        if (!ok) return;
        await Store.removeEvent(ev.id);
        UI.toast('Событие удалено');
        m.close();
        onSave && onSave();
      };
    }

    saveBtn.onclick = async () => {
      if (!titleInp.value.trim()) { UI.toast('Укажите название', 'error'); return; }
      if (!curDate) { UI.toast('Укажите дату', 'error'); return; }
      let time = null;
      if (!timeRow.classList.contains('hidden')) {
        const h = String(timeH.value).padStart(2, '0'), mi = String(timeM.value || '0').padStart(2, '0');
        if (/^\d{1,2}$/.test(timeH.value) && /^\d{1,2}$/.test(timeM.value || '0') && +h < 24 && +mi < 60) time = `${h}:${mi}`;
      }
      const payload = { title: titleInp.value.trim(), description: descInp.value.trim(), date: curDate, time, icon: curIcon, color: curColor };
      try {
        if (isNew) await Store.createEvent(payload);
        else await Store.updateEvent(ev.id, { ...payload, id: ev.id });
        UI.toast(isNew ? 'Событие создано' : 'Событие сохранено');
        m.close();
        onSave && onSave();
      } catch (e) {
        UI.toast('Ошибка сохранения события', 'error');
      }
    };
    refreshIcons(m.modal);
  }

  return { open };
})();
