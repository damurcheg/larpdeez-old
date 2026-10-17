// Input validation & sanitization — ported 1:1 from the Express server.

import { uid } from './crypto.js';

export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export function badId(id) { return typeof id !== 'string' || !ID_RE.test(id); }
export function str(v, max = 5000) { return typeof v === 'string' ? v.slice(0, max) : ''; }
export function DATE_RE(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); }

export function sanitizeLink(l) {
  if (!l || typeof l !== 'object') return null;
  const url = str(l.url, 2000).trim();
  if (!url) return null;
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return null;
  return { id: badId(l.id) ? uid() : l.id, url, text: str(l.text, 300).trim() };
}

export function sanitizeCriterion(c) {
  if (!c || typeof c !== 'object') return null;
  return {
    id: badId(c.id) ? uid() : c.id,
    text: str(c.text, 500),
    done: !!c.done,
    score: typeof c.score === 'number' && c.score >= 0 && c.score <= 5 ? c.score : null,
  };
}

export const GRADES = [1, 2, 3, 4, 5];

export function sanitizeTask(t) {
  if (!t || typeof t !== 'object') return null;
  const grade = typeof t.grade === 'number' && GRADES.includes(t.grade) ? t.grade : null;
  return {
    id: badId(t.id) ? uid() : t.id,
    title: str(t.title, 300),
    description: str(t.description, 5000),
    date: DATE_RE(t.date) ? t.date : null,
    criteria: Array.isArray(t.criteria) ? t.criteria.map(sanitizeCriterion).filter(Boolean).slice(0, 50) : [],
    links: Array.isArray(t.links) ? t.links.map(sanitizeLink).filter(Boolean).slice(0, 50) : [],
    done: !!t.done,
    grade,
  };
}

export function sanitizeTopic(tp) {
  if (!tp || typeof tp !== 'object') return null;
  return {
    id: badId(tp.id) ? uid() : tp.id,
    title: str(tp.title, 300),
    content: str(tp.content, 20000),
    date: DATE_RE(tp.date) ? tp.date : null,
    links: Array.isArray(tp.links) ? tp.links.map(sanitizeLink).filter(Boolean).slice(0, 50) : [],
    done: !!tp.done,
    tasks: Array.isArray(tp.tasks) ? tp.tasks.map(sanitizeTask).filter(Boolean).slice(0, 100) : [],
  };
}

export function sanitizeDiscipline(d) {
  if (!d || typeof d !== 'object') return null;
  return {
    id: badId(d.id) ? uid() : d.id,
    title: str(d.title, 300),
    description: str(d.description, 5000),
    topics: Array.isArray(d.topics) ? d.topics.map(sanitizeTopic).filter(Boolean).slice(0, 200) : [],
  };
}

export function sanitizeProject(p) {
  if (!p || typeof p !== 'object') return null;
  const icon = /^[\w-]{1,40}$/.test(str(p.icon)) ? p.icon : 'flag';
  return {
    enabled: !!p.enabled,
    title: str(p.title, 300),
    description: str(p.description, 5000),
    dueDate: DATE_RE(p.dueDate) ? p.dueDate : null,
    icon,
    criteria: Array.isArray(p.criteria) ? p.criteria.map(sanitizeCriterion).filter(Boolean).slice(0, 50) : [],
    refs: Array.isArray(p.refs)
      ? p.refs.map((r) => {
          const link = sanitizeLink(r);
          return link ? { ...link, title: str(r.title, 300).trim() } : null;
        }).filter(Boolean).slice(0, 50)
      : [],
    status: ['todo', 'in-progress', 'done'].includes(p.status) ? p.status : 'todo',
    score: typeof p.score === 'number' && p.score >= 1 && p.score <= 5 ? p.score : null,
  };
}

export function sanitizeModule(m) {
  if (!m || typeof m !== 'object') return null;
  return {
    id: badId(m.id) ? uid() : m.id,
    title: str(m.title, 300),
    description: str(m.description, 5000),
    tags: Array.isArray(m.tags) ? m.tags.slice(0, 6).map((t) => str(typeof t === 'string' ? t : t.name, 40).trim()).filter(Boolean) : [],
    disciplines: Array.isArray(m.disciplines) ? m.disciplines.map(sanitizeDiscipline).filter(Boolean).slice(0, 100) : [],
    project: sanitizeProject(m.project),
  };
}

export function sanitizeCourseDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;
  return {
    id: badId(doc.id) ? uid() : doc.id,
    title: str(doc.title, 300),
    description: str(doc.description, 5000),
    modules: Array.isArray(doc.modules) ? doc.modules.map(sanitizeModule).filter(Boolean).slice(0, 100) : [],
  };
}

export function sanitizeEvent(e) {
  if (!e || typeof e !== 'object') return null;
  const color = /^#[0-9a-fA-F]{6}$/.test(str(e.color)) ? e.color : '#3b82f6';
  const icon = /^[\w-]{1,40}$/.test(str(e.icon)) ? e.icon : 'calendar-days';
  const time = typeof e.time === 'string' && /^\d{2}:\d{2}$/.test(e.time) ? e.time : null;
  return {
    id: badId(e.id) ? uid() : e.id,
    title: str(e.title, 300),
    description: str(e.description, 5000),
    date: DATE_RE(e.date) ? e.date : null,
    time,
    icon,
    color,
  };
}

export function sanitizeProfile(p) {
  p = p || {};
  return {
    name: str(p.name, 100).trim() || 'Студент',
    avatar: /^[\w-]{1,40}$/.test(str(p.avatar)) ? p.avatar : 'user',
    avatarColor: /^#[0-9a-fA-F]{6}$/.test(str(p.avatarColor)) ? p.avatarColor : '#6366f1',
    banner: /^[\w-]{1,40}$/.test(str(p.banner)) ? p.banner : 'banner1',
  };
}
