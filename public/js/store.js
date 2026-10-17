// Central data store + progress/grade computation (global `Store`)
// Single source of truth for the client. Mutations update local state immediately,
// then persist the whole course document to the server (debounced), so nothing is lost.
window.Store = (() => {
  const listeners = new Set();
  let state = {
    ready: false,
    profile: { name: 'Студент', avatar: 'user', avatarColor: '#6366f1', banner: 'banner1' },
    settings: { theme: 'light', primaryCourseId: null, completedHidden: false },
    courses: [], // [{id,title,description,sort,modules:[...]}]
    events: [],
  };

  function emit(event) { listeners.forEach((fn) => fn(event)); }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  const GRADES = [1, 2, 3, 4, 5]; // единая шкала оценивания платформы

  // ---------- load / mutate ----------
  async function load() {
    const s = await API.state();
    state.courses = s.courses || [];
    state.events = s.events || [];
    if (s.profile && s.profile.name) state.profile = s.profile;
    if (s.settings) state.settings = { ...state.settings, ...s.settings };
    state.ready = true;
    emit('load');
  }

  function getCourse(id) { return state.courses.find((c) => c.id === id) || null; }

  // Find a nested node by path of ids: e.g. findNode(course, ['modules', mId, 'disciplines', dId])
  function locate(course, moduleId, disciplineId, topicId, taskId) {
    const mod = moduleId ? course.modules.find((m) => m.id === moduleId) : null;
    if (moduleId && !mod) return {};
    const disc = disciplineId && mod ? mod.disciplines.find((d) => d.id === disciplineId) : null;
    if (disciplineId && !disc) return { mod };
    const topic = topicId && disc ? disc.topics.find((t) => t.id === topicId) : null;
    if (topicId && !topic) return { mod, disc };
    const task = taskId && topic ? topic.tasks.find((t) => t.id === taskId) : null;
    return { mod, disc, topic, task };
  }

  const pendingSaves = new Map(); // courseId -> { timer, immediate }

  function doSave(courseId) {
    pendingSaves.delete(courseId);
    const doc = getCourse(courseId);
    if (!doc) return;
    API.saveCourse(courseId, doc).then((res) => {
      const idx = state.courses.findIndex((c) => c.id === courseId);
      if (idx >= 0 && res.course) state.courses[idx] = { ...res.course, sort: doc.sort };
      emit('saved:' + courseId);
    }).catch((e) => {
      emit('save-error:' + (e.code || 'error'));
    });
  }

  function persist(courseId) {
    const p = pendingSaves.get(courseId);
    if (p) clearTimeout(p.timer);
    pendingSaves.set(courseId, { timer: setTimeout(() => doSave(courseId), 350) });
  }

  // flush all pending saves immediately (beforeunload / visibilitychange)
  function flushPending() {
    for (const [courseId, p] of [...pendingSaves]) {
      clearTimeout(p.timer);
      doSave(courseId);
    }
  }

  /**
   * mutate(courseId, fn, opts) — apply fn(course) locally, re-render and schedule save.
   * opts.local = true → don't touch server (used for transient UI state).
   */
  function mutate(courseId, fn, opts = {}) {
    const course = getCourse(courseId);
    if (!course) return;
    fn(course);
    if (!opts.local) persist(courseId);
    emit('change:' + courseId);
  }

  // ---------- CRUD helpers ----------
  async function createCourse(title) {
    const res = await API.createCourse({ title: title || 'Новый курс', description: '', modules: [] });
    const doc = res.course;
    doc.sort = state.courses.length ? Math.max(...state.courses.map((c) => c.sort || 0)) + 1 : 1;
    state.courses.push(doc);
    emit('courses-changed');
    return doc;
  }

  async function deleteCourse(id) {
    await API.deleteCourse(id);
    state.courses = state.courses.filter((c) => c.id !== id);
    if (state.settings.primaryCourseId === id) await setSetting('primaryCourseId', null, true);
    emit('courses-changed');
  }

  async function reorderCourses(ids) {
    ids.forEach((id, i) => { const c = getCourse(id); if (c) c.sort = i + 1; });
    state.courses.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    emit('courses-changed');
    try { await API.reorderCourses(ids); } catch (e) { emit('save-error:' + (e.code || 'error')); }
  }

  async function setSetting(key, value, silent) {
    state.settings = { ...state.settings, [key]: value };
    if (!silent) emit('settings');
    try { await API.saveSettings({ [key]: value }); } catch (e) { /* ignore */ }
  }

  async function saveProfile(patch) {
    state.profile = { ...state.profile, ...patch };
    emit('profile');
    const res = await API.saveProfile(state.profile);
    if (res.profile) state.profile = res.profile;
    emit('profile-saved');
  }

  // Events
  async function createEvent(ev) {
    const res = await API.createEvent(ev);
    state.events.push(res.event);
    state.events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    emit('events');
    return res.event;
  }
  async function updateEvent(id, ev) {
    const res = await API.saveEvent(id, ev);
    const i = state.events.findIndex((e) => e.id === id);
    if (i >= 0) state.events[i] = res.event;
    state.events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    emit('events');
    return res.event;
  }
  async function removeEvent(id) {
    await API.deleteEvent(id);
    state.events = state.events.filter((e) => e.id !== id);
    emit('events');
  }

  // ---------- Progress & grades ----------
  // Rules:
  //  - topic complete when marked done
  //  - discipline complete when all topics done
  //  - module complete when all disciplines have ≥1 topic and all topics are done
  //  - course complete when all modules complete (and it has modules)
  //  - average grade: each graded TASK counts once; final project counts once only if scored.
  function topicStats(topic) {
    const totalTasks = topic.tasks.length;
    const doneTasks = topic.tasks.filter((t) => t.done).length;
    return { totalTasks, doneTasks };
  }

  function disciplineProgress(disc) {
    const total = disc.topics.length;
    const done = disc.topics.filter((t) => t.done).length;
    return { total, done, complete: total > 0 && done === total };
  }

  function moduleProgress(mod) {
    let total = 0, done = 0;
    for (const d of mod.disciplines) { total += d.topics.length; done += d.topics.filter((t) => t.done).length; }
    const noDisciplines = mod.disciplines.length === 0;
    const complete = !noDisciplines && total > 0 && done === total;
    return { total, done, complete, ratio: total ? done / total : 0 };
  }

  function courseProgress(course) {
    let total = 0, done = 0;
    for (const m of course.modules) { total += m.disciplines.reduce((s, d) => s + d.topics.length, 0); done += m.disciplines.reduce((s, d) => s + d.topics.filter((t) => t.done).length, 0); }
    const complete = course.modules.length > 0 && course.modules.every((m) => moduleProgress(m).complete);
    return { total, done, complete, ratio: total ? done / total : (complete ? 1 : 0) };
  }

  // Collect grades WITHOUT double counting: tasks (unique objects) + project score (if any).
  function collectGrades(scope) {
    const grades = [];
    const addFromModule = (mod) => {
      for (const d of mod.disciplines || [])
        for (const t of d.topics || [])
          for (const task of t.tasks || [])
            if (typeof task.grade === 'number') grades.push(task.grade);
      const p = mod.project;
      if (p && p.enabled && typeof p.score === 'number') grades.push(p.score);
    };
    if (scope.type === 'module') addFromModule(scope.mod);
    else if (scope.type === 'discipline') {
      for (const t of scope.disc.topics || [])
        for (const task of t.tasks || []) if (typeof task.grade === 'number') grades.push(task.grade);
    } else if (scope.type === 'topic') {
      for (const task of scope.topic.tasks || []) if (typeof task.grade === 'number') grades.push(task.grade);
    } else { // course
      for (const m of scope.course.modules) addFromModule(m);
    }
    return grades;
  }

  function avgGrade(scope) {
    const g = collectGrades(scope);
    if (!g.length) return null;
    return g.reduce((a, b) => a + b, 0) / g.length;
  }

  // All dated items across courses for calendar/planner
  function datedItems(filterCourseId) {
    const items = [];
    for (const course of state.courses) {
      if (filterCourseId && course.id !== filterCourseId) continue;
      for (const mod of course.modules) {
        for (const disc of mod.disciplines) {
          for (const topic of disc.topics) {
            if (topic.date) items.push({ kind: 'topic', date: topic.date, title: topic.title, done: !!topic.done, courseId: course.id, moduleId: mod.id, disciplineId: disc.id, topicId: topic.id, path: [course.title, mod.title, disc.title].join(' › ') });
          }
        }
        const p = mod.project;
        if (p && p.enabled && p.dueDate) items.push({ kind: 'project', date: p.dueDate, title: p.title || 'Финальный проект', done: p.status === 'done', courseId: course.id, moduleId: mod.id, path: [course.title, mod.title].join(' › ') });
      }
    }
    for (const ev of state.events) {
      if (ev.date) items.push({ kind: 'event', date: ev.date, title: ev.title, done: false, eventId: ev.id, color: ev.color, icon: ev.icon, time: ev.time, path: 'Событие' });
    }
    items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return items;
  }

  function setPrimaryCourse(id) { return setSetting('primaryCourseId', id); }

  return {
    subscribe, load, get state() { return state; },
    getCourse, locate, mutate, createCourse, deleteCourse, reorderCourses,
    setSetting, saveProfile, createEvent, updateEvent, removeEvent,
    topicStats, disciplineProgress, moduleProgress, courseProgress, avgGrade, collectGrades,
    datedItems, setPrimaryCourse, flushPending, GRADES,
  };
})();
