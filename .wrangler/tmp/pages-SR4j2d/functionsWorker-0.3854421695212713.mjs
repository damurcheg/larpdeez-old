var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// lib/crypto.js
function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(bytesToHex, "bytesToHex");
function randomHex(nbytes) {
  const a = new Uint8Array(nbytes);
  crypto.getRandomValues(a);
  return bytesToHex(a);
}
__name(randomHex, "randomHex");
function uid() {
  return crypto.randomUUID();
}
__name(uid, "uid");
function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}
__name(hexToBytes, "hexToBytes");
async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text));
  return bytesToHex(await crypto.subtle.digest("SHA-256", data));
}
__name(sha256Hex, "sha256Hex");
var PBKDF2_ITERATIONS = 15e4;
async function pbkdf2(password, saltHex, iterations, lenBytes) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations, hash: "SHA-256" },
    key,
    lenBytes * 8
  );
  return bytesToHex(bits);
}
__name(pbkdf2, "pbkdf2");
async function hashPassword(password) {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS, 32);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${hash}`;
}
__name(hashPassword, "hashPassword");
function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(timingSafeEqualStr, "timingSafeEqualStr");
async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split(":");
  if (parts.length === 4 && parts[0] === "pbkdf2") {
    const iterations = parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;
    if (!/^[0-9a-f]*$/i.test(parts[2]) || parts[2].length % 2) return false;
    const hash = await pbkdf2(password, parts[2], iterations, 32);
    return timingSafeEqualStr(hash, parts[3]);
  }
  return false;
}
__name(verifyPassword, "verifyPassword");
async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(message)));
  return bytesToHex(sig);
}
__name(hmacHex, "hmacHex");

// lib/db.js
function getSetting(env, key, fallback = null) {
  return env.DB.prepare("SELECT value FROM settings WHERE key = ?1").bind(key).first().then((r) => r ? r.value : fallback);
}
__name(getSetting, "getSetting");
function setSetting(env, key, value) {
  return env.DB.prepare("INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value)).run();
}
__name(setSetting, "setSetting");
function parseJsonSetting(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : fallback;
  } catch {
    return fallback;
  }
}
__name(parseJsonSetting, "parseJsonSetting");
async function getCourses(env) {
  const { results } = await env.DB.prepare("SELECT doc FROM courses ORDER BY sort ASC").all();
  return (results || []).map((r) => JSON.parse(r.doc));
}
__name(getCourses, "getCourses");
async function getCourse(env, id) {
  const row = await env.DB.prepare("SELECT doc FROM courses WHERE id = ?1").bind(id).first();
  return row ? JSON.parse(row.doc) : null;
}
__name(getCourse, "getCourse");
async function saveCourse(env, doc, sort) {
  let s = sort;
  if (typeof s !== "number") {
    const cur = await env.DB.prepare("SELECT sort FROM courses WHERE id = ?1").bind(doc.id).first();
    s = cur ? cur.sort : Date.now();
  }
  return env.DB.prepare(
    "INSERT INTO courses (id, doc, sort, updatedAt) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, sort = excluded.sort, updatedAt = excluded.updatedAt"
  ).bind(doc.id, JSON.stringify(doc), s, Date.now()).run();
}
__name(saveCourse, "saveCourse");
function removeCourse(env, id) {
  return env.DB.prepare("DELETE FROM courses WHERE id = ?1").bind(id).run();
}
__name(removeCourse, "removeCourse");
async function getEvents(env) {
  const { results } = await env.DB.prepare("SELECT doc FROM events ORDER BY date ASC").all();
  return (results || []).map((r) => JSON.parse(r.doc));
}
__name(getEvents, "getEvents");
async function getEventById(env, id) {
  const row = await env.DB.prepare("SELECT doc FROM events WHERE id = ?1").bind(id).first();
  return row ? JSON.parse(row.doc) : null;
}
__name(getEventById, "getEventById");
function saveEvent(env, doc) {
  return env.DB.prepare(
    "INSERT INTO events (id, doc, date, updatedAt) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, date = excluded.date, updatedAt = excluded.updatedAt"
  ).bind(doc.id, JSON.stringify(doc), doc.date || "", Date.now()).run();
}
__name(saveEvent, "saveEvent");
function removeEvent(env, id) {
  return env.DB.prepare("DELETE FROM events WHERE id = ?1").bind(id).run();
}
__name(removeEvent, "removeEvent");
async function exportAll(env) {
  return {
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    version: 1,
    profile: parseJsonSetting(await getSetting(env, "profile", "{}"), {}),
    settings: parseJsonSetting(await getSetting(env, "settings", "{}"), {}),
    courses: await getCourses(env),
    events: await getEvents(env)
  };
}
__name(exportAll, "exportAll");
var UPSERT_SETTING = "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value";
var UPSERT_COURSE = "INSERT INTO courses (id, doc, sort, updatedAt) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, sort = excluded.sort, updatedAt = excluded.updatedAt";
var UPSERT_EVENT = "INSERT INTO events (id, doc, date, updatedAt) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, date = excluded.date, updatedAt = excluded.updatedAt";
async function importAll(env, payload) {
  const errors = [];
  const batch = [];
  if (payload.profile && typeof payload.profile === "object") {
    batch.push(env.DB.prepare(UPSERT_SETTING).bind("profile", JSON.stringify(payload.profile)));
  }
  if (payload.settings && typeof payload.settings === "object") {
    batch.push(env.DB.prepare(UPSERT_SETTING).bind("settings", JSON.stringify(payload.settings)));
  }
  for (const c of payload.courses || []) {
    if (!c || !c.id) {
      errors.push("course without id skipped");
      continue;
    }
    batch.push(env.DB.prepare(UPSERT_COURSE).bind(c.id, JSON.stringify(c), typeof c.sort === "number" ? c.sort : Date.now(), Date.now()));
  }
  for (const e of payload.events || []) {
    if (!e || !e.id) {
      errors.push("event without id skipped");
      continue;
    }
    batch.push(env.DB.prepare(UPSERT_EVENT).bind(e.id, JSON.stringify(e), e.date || "", Date.now()));
  }
  if (batch.length) await env.DB.batch(batch);
  return errors;
}
__name(importAll, "importAll");
async function replaceAll(env, payload) {
  const batch = [env.DB.prepare("DELETE FROM courses"), env.DB.prepare("DELETE FROM events")];
  if (payload.profile) {
    batch.push(env.DB.prepare(UPSERT_SETTING).bind("profile", JSON.stringify(payload.profile)));
  }
  if (payload.settings) {
    batch.push(env.DB.prepare(UPSERT_SETTING).bind("settings", JSON.stringify(payload.settings)));
  }
  for (const c of payload.courses || []) {
    if (!c || !c.id) continue;
    batch.push(env.DB.prepare(UPSERT_COURSE).bind(c.id, JSON.stringify(c), typeof c.sort === "number" ? c.sort : Date.now(), Date.now()));
  }
  for (const e of payload.events || []) {
    if (!e || !e.id) continue;
    batch.push(env.DB.prepare(UPSERT_EVENT).bind(e.id, JSON.stringify(e), e.date || "", Date.now()));
  }
  await env.DB.batch(batch);
}
__name(replaceAll, "replaceAll");

// lib/auth.js
var SESSION_TTL_S = 30 * 24 * 60 * 60;
async function getSessionSecret(env) {
  let secret = await getSetting(env, "sessionSecret");
  if (!secret) {
    const seed = env.PLATFORM_SECRET_SEED || null;
    secret = seed ? await sha256Hex(`seed:${seed}`) : randomHex(32);
    await setSetting(env, "sessionSecret", secret);
  }
  return secret;
}
__name(getSessionSecret, "getSessionSecret");
async function ensureSetup(env) {
  const existing = await getSetting(env, "passwordHash");
  if (existing && !existing.startsWith("scrypt:")) return;
  const initial = env.PLATFORM_PASSWORD;
  if (!initial) {
    console.warn("[auth] passwordHash missing and PLATFORM_PASSWORD secret is not set \u2014 login is disabled until you configure it.");
    return;
  }
  await setSetting(env, "passwordHash", await hashPassword(String(initial)));
  await setSetting(env, "password_configured", initial === "admin123" ? "0" : "1");
  if (initial === "admin123") {
    console.warn('[auth] Bootstrapped with the temporary password "admin123" \u2014 change it in Profile immediately.');
  }
}
__name(ensureSetup, "ensureSetup");
async function signPayload(env, bodyB64) {
  const secret = await getSessionSecret(env);
  const mac = await hmacHex(secret, bodyB64);
  return mac;
}
__name(signPayload, "signPayload");
function b64urlEncode(str2) {
  return btoa(unescape(encodeURIComponent(str2))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(b64urlEncode, "b64urlEncode");
function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return decodeURIComponent(escape(atob(s)));
}
__name(b64urlDecode, "b64urlDecode");
async function createSessionToken(env) {
  const payload = { sid: randomHex(12), exp: Date.now() + SESSION_TTL_S * 1e3 };
  const body = b64urlEncode(JSON.stringify(payload));
  const mac = await signPayload(env, body);
  return `${body}.${mac}`;
}
__name(createSessionToken, "createSessionToken");
async function verifySessionToken(env, token) {
  if (!token || typeof token !== "string") return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const body = token.slice(0, i);
  const mac = token.slice(i + 1);
  const expected = await signPayload(env, body);
  if (!timingSafeEqualStr(mac, expected)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifySessionToken, "verifySessionToken");
async function createCsrfToken(env, sid) {
  const secret = await getSessionSecret(env);
  return hmacHex(`${secret}:csrf`, sid);
}
__name(createCsrfToken, "createCsrfToken");
async function login(env, password) {
  const hash = await getSetting(env, "passwordHash");
  if (!hash) return null;
  if (!await verifyPassword(password, hash)) return null;
  return createSessionToken(env);
}
__name(login, "login");
async function changePassword(env, oldPassword, newPassword) {
  const hash = await getSetting(env, "passwordHash");
  if (!await verifyPassword(oldPassword, hash || "")) return false;
  if (!newPassword || String(newPassword).length < 6) return "short";
  await setSetting(env, "passwordHash", await hashPassword(String(newPassword)));
  return true;
}
__name(changePassword, "changePassword");
function sessionCookie(token, secure) {
  return `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_S}${secure ? "; Secure" : ""}`;
}
__name(sessionCookie, "sessionCookie");
function clearSessionCookie(secure) {
  return `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}
__name(clearSessionCookie, "clearSessionCookie");
function readSessionCookie(request) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
__name(readSessionCookie, "readSessionCookie");
function isSecureRequest(request) {
  const proto = request.headers.get("X-Forwarded-Proto");
  if (proto === "https") return true;
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}
__name(isSecureRequest, "isSecureRequest");
var memAttempts = /* @__PURE__ */ new Map();
async function tooManyAttempts(env, ip) {
  if (env.RATE_LIMIT_KV) {
    const rec = await env.RATE_LIMIT_KV.get(`rl:${ip}`, "json");
    if (!rec) return false;
    if (Date.now() - rec.ts > 5 * 60 * 1e3) return false;
    return rec.count >= 8;
  }
  const a = memAttempts.get(ip);
  if (!a) return false;
  if (Date.now() - a.ts > 5 * 60 * 1e3) {
    memAttempts.delete(ip);
    return false;
  }
  return a.count >= 8;
}
__name(tooManyAttempts, "tooManyAttempts");
async function registerAttempt(env, ip, ok) {
  if (env.RATE_LIMIT_KV) {
    const key = `rl:${ip}`;
    if (ok) {
      await env.RATE_LIMIT_KV.delete(key);
      return;
    }
    const rec = await env.RATE_LIMIT_KV.get(key, "json") || { count: 0, ts: Date.now() };
    await env.RATE_LIMIT_KV.put(key, JSON.stringify({ count: rec.count + 1, ts: Date.now() }), { expirationTtl: 600 });
    return;
  }
  if (ok) memAttempts.delete(ip);
  else {
    const a = memAttempts.get(ip) || { count: 0, ts: Date.now() };
    a.count += 1;
    a.ts = Date.now();
    memAttempts.set(ip, a);
  }
}
__name(registerAttempt, "registerAttempt");

// lib/http.js
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}
__name(json, "json");
var unauthorized = /* @__PURE__ */ __name(() => json({ error: "unauthorized" }, 401), "unauthorized");
var forbidden = /* @__PURE__ */ __name((code = "csrf") => json({ error: code }, 403), "forbidden");
var notFound = /* @__PURE__ */ __name(() => json({ error: "not-found" }, 404), "notFound");
var badRequest = /* @__PURE__ */ __name((code = "bad-request", details) => json({ error: code, ...details ? { details } : {} }, 400), "badRequest");
async function getSession(context) {
  const token = readSessionCookie(context.request);
  if (!token) return null;
  return verifySessionToken(context.env, token);
}
__name(getSession, "getSession");
async function requireSession(context) {
  const sess = await getSession(context);
  if (!sess) {
    return { sess: null, fail: unauthorized() };
  }
  const csrf = context.request.headers.get("x-csrf-token") || "";
  const expected = await createCsrfToken(context.env, sess.sid);
  if (!timingSafeEqualStr(csrf, expected)) {
    return { sess, fail: forbidden("csrf") };
  }
  return { sess, fail: null };
}
__name(requireSession, "requireSession");
async function readJsonBody(context) {
  try {
    const body = await context.request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return null;
  }
}
__name(readJsonBody, "readJsonBody");
function secureFlag(context) {
  return isSecureRequest(context.request);
}
__name(secureFlag, "secureFlag");
function clientIp(context) {
  return context.request.headers.get("CF-Connecting-IP") || "unknown";
}
__name(clientIp, "clientIp");

// lib/validate.js
var ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
function badId(id) {
  return typeof id !== "string" || !ID_RE.test(id);
}
__name(badId, "badId");
function str(v, max = 5e3) {
  return typeof v === "string" ? v.slice(0, max) : "";
}
__name(str, "str");
function DATE_RE(d) {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}
__name(DATE_RE, "DATE_RE");
function sanitizeLink(l) {
  if (!l || typeof l !== "object") return null;
  const url = str(l.url, 2e3).trim();
  if (!url) return null;
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return null;
  return { id: badId(l.id) ? uid() : l.id, url, text: str(l.text, 300).trim() };
}
__name(sanitizeLink, "sanitizeLink");
function sanitizeCriterion(c) {
  if (!c || typeof c !== "object") return null;
  return {
    id: badId(c.id) ? uid() : c.id,
    text: str(c.text, 500),
    done: !!c.done,
    score: typeof c.score === "number" && c.score >= 0 && c.score <= 5 ? c.score : null
  };
}
__name(sanitizeCriterion, "sanitizeCriterion");
var GRADES = [1, 2, 3, 4, 5];
function sanitizeTask(t) {
  if (!t || typeof t !== "object") return null;
  const grade = typeof t.grade === "number" && GRADES.includes(t.grade) ? t.grade : null;
  return {
    id: badId(t.id) ? uid() : t.id,
    title: str(t.title, 300),
    description: str(t.description, 5e3),
    date: DATE_RE(t.date) ? t.date : null,
    criteria: Array.isArray(t.criteria) ? t.criteria.map(sanitizeCriterion).filter(Boolean).slice(0, 50) : [],
    links: Array.isArray(t.links) ? t.links.map(sanitizeLink).filter(Boolean).slice(0, 50) : [],
    done: !!t.done,
    grade
  };
}
__name(sanitizeTask, "sanitizeTask");
function sanitizeTopic(tp) {
  if (!tp || typeof tp !== "object") return null;
  return {
    id: badId(tp.id) ? uid() : tp.id,
    title: str(tp.title, 300),
    content: str(tp.content, 2e4),
    date: DATE_RE(tp.date) ? tp.date : null,
    links: Array.isArray(tp.links) ? tp.links.map(sanitizeLink).filter(Boolean).slice(0, 50) : [],
    done: !!tp.done,
    tasks: Array.isArray(tp.tasks) ? tp.tasks.map(sanitizeTask).filter(Boolean).slice(0, 100) : []
  };
}
__name(sanitizeTopic, "sanitizeTopic");
function sanitizeDiscipline(d) {
  if (!d || typeof d !== "object") return null;
  return {
    id: badId(d.id) ? uid() : d.id,
    title: str(d.title, 300),
    description: str(d.description, 5e3),
    topics: Array.isArray(d.topics) ? d.topics.map(sanitizeTopic).filter(Boolean).slice(0, 200) : []
  };
}
__name(sanitizeDiscipline, "sanitizeDiscipline");
function sanitizeProject(p) {
  if (!p || typeof p !== "object") return null;
  const icon = /^[\w-]{1,40}$/.test(str(p.icon)) ? p.icon : "flag";
  return {
    enabled: !!p.enabled,
    title: str(p.title, 300),
    description: str(p.description, 5e3),
    dueDate: DATE_RE(p.dueDate) ? p.dueDate : null,
    icon,
    criteria: Array.isArray(p.criteria) ? p.criteria.map(sanitizeCriterion).filter(Boolean).slice(0, 50) : [],
    refs: Array.isArray(p.refs) ? p.refs.map((r) => {
      const link = sanitizeLink(r);
      return link ? { ...link, title: str(r.title, 300).trim() } : null;
    }).filter(Boolean).slice(0, 50) : [],
    status: ["todo", "in-progress", "done"].includes(p.status) ? p.status : "todo",
    score: typeof p.score === "number" && p.score >= 1 && p.score <= 5 ? p.score : null
  };
}
__name(sanitizeProject, "sanitizeProject");
function sanitizeModule(m) {
  if (!m || typeof m !== "object") return null;
  return {
    id: badId(m.id) ? uid() : m.id,
    title: str(m.title, 300),
    description: str(m.description, 5e3),
    tags: Array.isArray(m.tags) ? m.tags.slice(0, 6).map((t) => str(typeof t === "string" ? t : t.name, 40).trim()).filter(Boolean) : [],
    disciplines: Array.isArray(m.disciplines) ? m.disciplines.map(sanitizeDiscipline).filter(Boolean).slice(0, 100) : [],
    project: sanitizeProject(m.project)
  };
}
__name(sanitizeModule, "sanitizeModule");
function sanitizeCourseDoc(doc) {
  if (!doc || typeof doc !== "object") return null;
  return {
    id: badId(doc.id) ? uid() : doc.id,
    title: str(doc.title, 300),
    description: str(doc.description, 5e3),
    modules: Array.isArray(doc.modules) ? doc.modules.map(sanitizeModule).filter(Boolean).slice(0, 100) : []
  };
}
__name(sanitizeCourseDoc, "sanitizeCourseDoc");
function sanitizeEvent(e) {
  if (!e || typeof e !== "object") return null;
  const color = /^#[0-9a-fA-F]{6}$/.test(str(e.color)) ? e.color : "#3b82f6";
  const icon = /^[\w-]{1,40}$/.test(str(e.icon)) ? e.icon : "calendar-days";
  const time = typeof e.time === "string" && /^\d{2}:\d{2}$/.test(e.time) ? e.time : null;
  return {
    id: badId(e.id) ? uid() : e.id,
    title: str(e.title, 300),
    description: str(e.description, 5e3),
    date: DATE_RE(e.date) ? e.date : null,
    time,
    icon,
    color
  };
}
__name(sanitizeEvent, "sanitizeEvent");
function sanitizeProfile(p) {
  p = p || {};
  return {
    name: str(p.name, 100).trim() || "\u0421\u0442\u0443\u0434\u0435\u043D\u0442",
    avatar: /^[\w-]{1,40}$/.test(str(p.avatar)) ? p.avatar : "user",
    avatarColor: /^#[0-9a-fA-F]{6}$/.test(str(p.avatarColor)) ? p.avatarColor : "#6366f1",
    banner: /^[\w-]{1,40}$/.test(str(p.banner)) ? p.banner : "banner1"
  };
}
__name(sanitizeProfile, "sanitizeProfile");

// api/courses/[id].js
var onRequestGet = /* @__PURE__ */ __name(async (context) => {
  if (!await getSession(context)) return unauthorized();
  const { id } = context.params;
  if (badId(id)) return badRequest("invalid-id");
  const doc = await getCourse(context.env, id);
  if (!doc) return notFound();
  return json({ course: doc });
}, "onRequestGet");
var onRequestPut = /* @__PURE__ */ __name(async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const { id } = context.params;
  if (badId(id)) return badRequest("invalid-id");
  if (!await getCourse(context.env, id)) return notFound();
  const body = await readJsonBody(context);
  if (body === null) return badRequest("invalid-json");
  const doc = sanitizeCourseDoc({ ...body, id });
  if (!doc) return badRequest("invalid-course");
  await saveCourse(context.env, doc);
  return json({ course: doc });
}, "onRequestPut");
var onRequestDelete = /* @__PURE__ */ __name(async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const { id } = context.params;
  if (badId(id)) return badRequest("invalid-id");
  await removeCourse(context.env, id);
  const settings = parseJsonSetting(await getSetting(context.env, "settings", "{}"), {});
  if (settings.primaryCourseId === id) {
    settings.primaryCourseId = null;
    await setSetting(context.env, "settings", JSON.stringify(settings));
  }
  return json({ ok: true });
}, "onRequestDelete");

// api/events/[id].js
var onRequestPut2 = /* @__PURE__ */ __name(async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const { id } = context.params;
  if (badId(id)) return badRequest("invalid-id");
  if (!await getEventById(context.env, id)) return notFound();
  const body = await readJsonBody(context);
  if (body === null) return badRequest("invalid-json");
  const ev = sanitizeEvent({ ...body, id });
  if (!ev || !ev.date || !ev.title) return badRequest("invalid-event");
  await saveEvent(context.env, ev);
  return json({ event: ev });
}, "onRequestPut");
var onRequestDelete2 = /* @__PURE__ */ __name(async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const { id } = context.params;
  if (badId(id)) return badRequest("invalid-id");
  await removeEvent(context.env, id);
  return json({ ok: true });
}, "onRequestDelete");

// api/backup.js
var onRequestGet2 = /* @__PURE__ */ __name(async (context) => {
  if (!await getSession(context)) return unauthorized();
  const data = await exportAll(context.env);
  return json(
    data,
    200,
    { "Content-Disposition": `attachment; filename="edu-backup-${data.exportedAt.slice(0, 10)}.json"` }
  );
}, "onRequestGet");

// api/courses/index.js
var onRequestGet3 = /* @__PURE__ */ __name(async (context) => {
  if (!await getSession(context)) return unauthorized();
  return json({ courses: await getCourses(context.env) });
}, "onRequestGet");
var reorderHandler = /* @__PURE__ */ __name(async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest("invalid-json");
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.some(badId)) return badRequest("invalid-id");
  const batch = [];
  for (let i = 0; i < ids.length; i++) {
    const doc = await getCourse(context.env, ids[i]);
    if (doc) batch.push(saveCourse(context.env, doc, i + 1));
  }
  await Promise.all(batch);
  return json({ ok: true });
}, "reorderHandler");
var onRequestPost = /* @__PURE__ */ __name(async (context) => {
  const url = new URL(context.request.url);
  if (url.pathname.endsWith("/reorder")) return reorderHandler(context);
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest("invalid-json");
  const doc = sanitizeCourseDoc({ ...body, id: uid() });
  if (!doc) return badRequest("invalid-course");
  if (!doc.title) doc.title = "\u041D\u043E\u0432\u044B\u0439 \u043A\u0443\u0440\u0441";
  const all = await getCourses(context.env);
  await saveCourse(context.env, doc, all.length ? Math.max(...all.map((c) => c.sort || 0)) + 1 : 1);
  return json({ course: doc });
}, "onRequestPost");

// api/events/index.js
var onRequestGet4 = /* @__PURE__ */ __name(async (context) => {
  if (!await getSession(context)) return unauthorized();
  return json({ events: await getEvents(context.env) });
}, "onRequestGet");
var onRequestPost2 = /* @__PURE__ */ __name(async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest("invalid-json");
  const ev = sanitizeEvent({ ...body, id: uid() });
  if (!ev || !ev.date || !ev.title) return badRequest("invalid-event");
  await saveEvent(context.env, ev);
  return json({ event: ev });
}, "onRequestPost");

// api/login.js
var onRequestPost3 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  await ensureSetup(env);
  const ip = clientIp(context);
  if (await tooManyAttempts(env, ip)) return json({ error: "too-many-attempts" }, 429);
  const body = await readJsonBody(context);
  if (body === null) return badRequest("invalid-json");
  const password = str(body.password, 200);
  const token = await login(env, password);
  if (!token) {
    await registerAttempt(env, ip, false);
    return json({ error: "bad-password" }, 401);
  }
  await registerAttempt(env, ip, true);
  const sess = await verifySessionToken(env, token);
  return json(
    { csrf: await createCsrfToken(env, sess.sid), profile: parseJsonSetting(await getSetting(env, "profile", "{}"), {}) },
    200,
    { "Set-Cookie": sessionCookie(token, secureFlag(context)) }
  );
}, "onRequestPost");

// api/logout.js
var onRequestPost4 = /* @__PURE__ */ __name(async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(secureFlag(context)) });
}, "onRequestPost");

// api/password.js
var onRequestPost5 = /* @__PURE__ */ __name(async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest("invalid-json");
  const oldP = str(body.oldPassword, 200);
  const newP = str(body.newPassword, 200);
  const result = await changePassword(context.env, oldP, newP);
  if (result === "short") return badRequest("password-too-short");
  if (result !== true) return badRequest("wrong-old-password");
  await setSetting(context.env, "password_configured", "1");
  return json({ ok: true });
}, "onRequestPost");

// api/profile.js
var onRequestPut3 = /* @__PURE__ */ __name(async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest("invalid-json");
  const profile = sanitizeProfile(body);
  await setSetting(context.env, "profile", JSON.stringify(profile));
  return json({ profile });
}, "onRequestPut");

// api/restore.js
var onRequestPost6 = /* @__PURE__ */ __name(async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const body = await readJsonBody(context);
  if (body === null) return badRequest("invalid-json");
  const payload = body.data;
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.courses)) {
    return badRequest("invalid-backup");
  }
  const courses = payload.courses.map(sanitizeCourseDoc).filter(Boolean);
  const events = Array.isArray(payload.events) ? payload.events.map(sanitizeEvent).filter(Boolean) : [];
  const clean = { profile: payload.profile, settings: payload.settings, courses, events };
  if (body.mode === "replace") {
    await replaceAll(context.env, clean);
  } else {
    const errors = await importAll(context.env, clean);
    if (errors.length) return badRequest("partial", errors);
  }
  return json({ ok: true, summary: { courses: courses.length, events: events.length } });
}, "onRequestPost");

// api/session.js
var onRequestGet5 = /* @__PURE__ */ __name(async (context) => {
  const sess = await getSession(context);
  if (!sess) {
    const hash = await getSetting(context.env, "passwordHash");
    if (!hash || String(hash).startsWith("scrypt:")) {
      if (!context.env.PLATFORM_PASSWORD) {
        return json({ error: "auth-not-configured" }, 503);
      }
    }
    return unauthorized();
  }
  return json({
    csrf: await createCsrfToken(context.env, sess.sid),
    profile: parseJsonSetting(await getSetting(context.env, "profile", "{}"), {}),
    settings: parseJsonSetting(await getSetting(context.env, "settings", "{}"), {}),
    hasPasswordConfigured: await getSetting(context.env, "password_configured") === "1"
  });
}, "onRequestGet");

// api/settings.js
var onRequestPut4 = /* @__PURE__ */ __name(async (context) => {
  const { fail } = await requireSession(context);
  if (fail) return fail;
  const s = await readJsonBody(context);
  if (s === null) return badRequest("invalid-json");
  const cur = parseJsonSetting(await getSetting(context.env, "settings", "{}"), {});
  const next = { ...cur };
  if (typeof s.theme === "string" && ["light", "dark"].includes(s.theme)) next.theme = s.theme;
  if ("primaryCourseId" in s) {
    const v = s.primaryCourseId;
    next.primaryCourseId = v === null || v === "" ? null : typeof v === "string" && ID_RE.test(v) ? v : null;
  }
  if (typeof s.completedHidden === "boolean") next.completedHidden = s.completedHidden;
  await setSetting(context.env, "settings", JSON.stringify(next));
  return json({ settings: next });
}, "onRequestPut");

// api/state.js
var onRequestGet6 = /* @__PURE__ */ __name(async (context) => {
  const sess = await getSession(context);
  if (!sess) return unauthorized();
  return json({
    courses: await getCourses(context.env),
    events: await getEvents(context.env),
    profile: parseJsonSetting(await getSetting(context.env, "profile", "{}"), {}),
    settings: parseJsonSetting(await getSetting(context.env, "settings", "{}"), {})
  });
}, "onRequestGet");

// ../.wrangler/tmp/pages-SR4j2d/functionsRoutes-0.11952206628299877.mjs
var routes = [
  {
    routePath: "/api/courses/:id",
    mountPath: "/api/courses",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/courses/:id",
    mountPath: "/api/courses",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/courses/:id",
    mountPath: "/api/courses",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/events/:id",
    mountPath: "/api/events",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/events/:id",
    mountPath: "/api/events",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut2]
  },
  {
    routePath: "/api/backup",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/courses",
    mountPath: "/api/courses",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/courses",
    mountPath: "/api/courses",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/events",
    mountPath: "/api/events",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/events",
    mountPath: "/api/events",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/login",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/logout",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/password",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/profile",
    mountPath: "/api",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut3]
  },
  {
    routePath: "/api/restore",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/session",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/settings",
    mountPath: "/api",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut4]
  },
  {
    routePath: "/api/state",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  }
];

// ../node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str2) {
  var tokens = [];
  var i = 0;
  while (i < str2.length) {
    var char = str2[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str2[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str2[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str2[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str2[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str2.length) {
        var code = str2.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str2[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str2[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str2.length) {
        if (str2[j] === "\\") {
          pattern += str2[j++] + str2[j++];
          continue;
        }
        if (str2[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str2[j] === "(") {
          count++;
          if (str2[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str2[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str2[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str2, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str2);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str2, options) {
  var keys = [];
  var re = pathToRegexp(str2, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str2) {
  return str2.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-NRz3W2/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-NRz3W2/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.3854421695212713.mjs.map
