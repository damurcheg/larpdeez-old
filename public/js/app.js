// App bootstrap: auth gate, theme, hash router, header wiring. Global `App`.
window.App = (() => {
  const { el, icon, refreshIcons } = U;

  let currentRender = null; // function to re-render the active view
  let storeUnsub = null;

  // ---------- theme ----------
  function setTheme(theme) {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    document.body.classList.toggle('theme-light', theme !== 'dark');
    const meta = document.getElementById('metaThemeColor');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#191919' : '#ffffff');
    const btn = document.getElementById('themeToggle');
    if (btn) { btn.innerHTML = ''; btn.appendChild(icon(theme === 'dark' ? 'sun' : 'moon')); refreshIcons(btn); }
  }

  function toggleTheme() {
    const next = Store.state.settings.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    Store.setSetting('theme', next);
  }

  // ---------- header ----------
  function renderHeaderUser() {
    const p = Store.state.profile;
    const chip = document.querySelector('.user-chip');
    chip.innerHTML = '';
    chip.appendChild(ProfileUI.avatarNode(p, 'avatar-sm'));
    chip.appendChild(el('span', { class: 'user-chip-name', text: p.name }));
    refreshIcons(chip);
  }

  // ---------- login screen ----------
  function showLogin(message, firstRun) {
    document.getElementById('app').classList.add('hidden');
    const screen = document.getElementById('authScreen');
    screen.classList.remove('hidden');
    const err = document.getElementById('loginError');
    if (firstRun) {
      err.textContent = 'Первый вход: временный пароль по умолчанию «admin123». Смените его в профиле сразу после входа.';
      err.classList.remove('hidden');
      err.style.color = 'var(--fg-muted)';
    } else if (message) {
      err.textContent = message;
      err.classList.remove('hidden');
      err.style.color = '';
    } else {
      err.classList.add('hidden');
    }
    setTimeout(() => document.getElementById('loginPassword').focus(), 50);
  }

  async function handleLogin(password) {
    const btn = document.getElementById('loginSubmit');
    btn.disabled = true;
    btn.innerHTML = '';
    btn.appendChild(el('span', { class: 'spinner' }));
    try {
      const res = await API.login(password);
      API.setCsrf(res.csrf);
      await enterApp();
    } catch (e) {
      showLogin(e.code === 'too-many-attempts' ? 'Слишком много попыток — подождите пару минут' : e.code === 'network-error' ? 'Сервер недоступен' : 'Неверный пароль. Попробуйте ещё раз.');
      btn.disabled = false;
      btn.textContent = 'Войти';
    }
  }

  // ---------- boot into app ----------
  async function enterApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    showLoading(true);
    try {
      await Store.load();
    } catch (e) {
      showLoading(false);
      UI.toast('Не удалось загрузить данные', 'error');
      return;
    }
    setTheme(Store.state.settings.theme || 'light');
    renderHeaderUser();
    showLoading(false);

    // primary course redirect on fresh open
    const primary = Store.state.settings.primaryCourseId;
    if (primary && (!location.hash || location.hash === '#/' || location.hash === '#')) {
      const c = Store.getCourse(primary);
      if (c) { location.hash = `#/course/${primary}`; return; } // hashchange will route
    }
    route();
  }

  function showLoading(on) {
    const v = document.getElementById('view');
    if (on) { v.innerHTML = ''; v.appendChild(el('div', { class: 'page-loading' }, [el('span', { class: 'spinner' }), 'Загрузка данных…'])); }
  }

  // ---------- router ----------
  const routes = [
    { re: /^#\/$/, name: 'home' },
    { re: /^#\/calendar$/, name: 'calendar' },
    { re: /^#\/settings$/, name: 'settings' },
    { re: /^#\/course\/([\w-]+)\/edit$/, name: 'course-edit' },
    { re: /^#\/course\/([\w-]+)\/module\/([\w-]+)$/, name: 'module' },
    { re: /^#\/course\/([\w-]+)$/, name: 'course' },
  ];

  function setActiveNav(name) {
    document.querySelectorAll('.topnav-link').forEach((a) => {
      const nav = a.dataset.nav;
      a.classList.toggle('active', (nav === 'courses' && ['home', 'course', 'module', 'course-edit'].includes(name)) || nav === name);
    });
  }

  function route() {
    if (!Store.state.ready) return;
    const hash = location.hash || '#/';
    for (const r of routes) {
      const m = hash.match(r.re);
      if (!m) continue;
      setActiveNav(r.name);
      window.scrollTo(0, 0);
      const view = document.getElementById('view');
      view.innerHTML = '';
      try {
        if (r.name === 'home') { const n = Pages.home(); view.appendChild(n); currentRender = () => route(); }
        else if (r.name === 'calendar') { const n = Pages.calendar(); view.appendChild(n); currentRender = () => route(); }
        else if (r.name === 'settings') { const n = Pages.settings(); view.appendChild(n); currentRender = () => route(); }
        else if (r.name === 'course') { const n = CourseView.coursePage(m[1]); view.appendChild(n); currentRender = () => route(); }
        else if (r.name === 'module') { const n = CourseView.modulePage(m[1], m[2]); view.appendChild(n); currentRender = () => route(); }
        else if (r.name === 'course-edit') { const n = CourseEditor.page(m[1]); view.appendChild(n); currentRender = () => route(); }
      } catch (e) {
        console.error(e);
        view.innerHTML = '';
        view.appendChild(UI.emptyState('triangle-alert', 'Что-то пошло не так', String(e.message || e)));
      }
      return;
    }
    // unknown route → home
    location.hash = '#/';
  }

  // save indicator
  function wireStoreEvents() {
    if (storeUnsub) storeUnsub();
    storeUnsub = Store.subscribe((ev) => {
      if (typeof ev === 'string' && ev.startsWith('save-error')) {
        UI.toast('Ошибка сохранения на сервер. Повторите действие.', 'error');
      }
    });
  }

  // ---------- init ----------
  async function init() {
    // lucide fallback
    if (!window.lucide) {
      console.warn('Lucide CDN unavailable — icons hidden');
      document.querySelectorAll('[data-lucide]').forEach((i) => i.style.display = 'none');
    }

    // login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin(document.getElementById('loginPassword').value);
    });
    document.getElementById('toggleLoginPass').addEventListener('click', () => {
      const inp = document.getElementById('loginPassword');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('userChip').addEventListener('click', () => ProfileUI.openEditor());

    window.addEventListener('hashchange', route);
    window.addEventListener('view:refresh', () => currentRender && currentRender());
    window.addEventListener('profile:updated', renderHeaderUser);
    window.addEventListener('auth:expired', () => showLogin('Сессия истекла — войдите снова'));

    wireStoreEvents();

    // session check
    try {
      const s = await API.session();
      API.setCsrf(s.csrf);
      await enterApp();
    } catch (e) {
      let configured = true;
      try { const sess = await API.session(); configured = !!sess.hasPasswordConfigured; } catch (e2) { /* unauthorized — assume unknown */ }
      showLogin(null, !configured);
    }
    refreshIcons(document.body);
  }

  window.addEventListener('beforeunload', () => {
    // best-effort flush of pending saves so nothing is lost on close
    try { Store.flushPending(); } catch (e) { /* noop */ }
  });

  document.addEventListener('DOMContentLoaded', init);

  return { init, setTheme, showLogin, route };
})();
