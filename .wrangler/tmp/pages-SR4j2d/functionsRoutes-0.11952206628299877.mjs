import { onRequestDelete as __api_courses__id__js_onRequestDelete } from "/workspace/functions/api/courses/[id].js"
import { onRequestGet as __api_courses__id__js_onRequestGet } from "/workspace/functions/api/courses/[id].js"
import { onRequestPut as __api_courses__id__js_onRequestPut } from "/workspace/functions/api/courses/[id].js"
import { onRequestDelete as __api_events__id__js_onRequestDelete } from "/workspace/functions/api/events/[id].js"
import { onRequestPut as __api_events__id__js_onRequestPut } from "/workspace/functions/api/events/[id].js"
import { onRequestGet as __api_backup_js_onRequestGet } from "/workspace/functions/api/backup.js"
import { onRequestGet as __api_courses_index_js_onRequestGet } from "/workspace/functions/api/courses/index.js"
import { onRequestPost as __api_courses_index_js_onRequestPost } from "/workspace/functions/api/courses/index.js"
import { onRequestGet as __api_events_index_js_onRequestGet } from "/workspace/functions/api/events/index.js"
import { onRequestPost as __api_events_index_js_onRequestPost } from "/workspace/functions/api/events/index.js"
import { onRequestPost as __api_login_js_onRequestPost } from "/workspace/functions/api/login.js"
import { onRequestPost as __api_logout_js_onRequestPost } from "/workspace/functions/api/logout.js"
import { onRequestPost as __api_password_js_onRequestPost } from "/workspace/functions/api/password.js"
import { onRequestPut as __api_profile_js_onRequestPut } from "/workspace/functions/api/profile.js"
import { onRequestPost as __api_restore_js_onRequestPost } from "/workspace/functions/api/restore.js"
import { onRequestGet as __api_session_js_onRequestGet } from "/workspace/functions/api/session.js"
import { onRequestPut as __api_settings_js_onRequestPut } from "/workspace/functions/api/settings.js"
import { onRequestGet as __api_state_js_onRequestGet } from "/workspace/functions/api/state.js"

export const routes = [
    {
      routePath: "/api/courses/:id",
      mountPath: "/api/courses",
      method: "DELETE",
      middlewares: [],
      modules: [__api_courses__id__js_onRequestDelete],
    },
  {
      routePath: "/api/courses/:id",
      mountPath: "/api/courses",
      method: "GET",
      middlewares: [],
      modules: [__api_courses__id__js_onRequestGet],
    },
  {
      routePath: "/api/courses/:id",
      mountPath: "/api/courses",
      method: "PUT",
      middlewares: [],
      modules: [__api_courses__id__js_onRequestPut],
    },
  {
      routePath: "/api/events/:id",
      mountPath: "/api/events",
      method: "DELETE",
      middlewares: [],
      modules: [__api_events__id__js_onRequestDelete],
    },
  {
      routePath: "/api/events/:id",
      mountPath: "/api/events",
      method: "PUT",
      middlewares: [],
      modules: [__api_events__id__js_onRequestPut],
    },
  {
      routePath: "/api/backup",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_backup_js_onRequestGet],
    },
  {
      routePath: "/api/courses",
      mountPath: "/api/courses",
      method: "GET",
      middlewares: [],
      modules: [__api_courses_index_js_onRequestGet],
    },
  {
      routePath: "/api/courses",
      mountPath: "/api/courses",
      method: "POST",
      middlewares: [],
      modules: [__api_courses_index_js_onRequestPost],
    },
  {
      routePath: "/api/events",
      mountPath: "/api/events",
      method: "GET",
      middlewares: [],
      modules: [__api_events_index_js_onRequestGet],
    },
  {
      routePath: "/api/events",
      mountPath: "/api/events",
      method: "POST",
      middlewares: [],
      modules: [__api_events_index_js_onRequestPost],
    },
  {
      routePath: "/api/login",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_login_js_onRequestPost],
    },
  {
      routePath: "/api/logout",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_logout_js_onRequestPost],
    },
  {
      routePath: "/api/password",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_password_js_onRequestPost],
    },
  {
      routePath: "/api/profile",
      mountPath: "/api",
      method: "PUT",
      middlewares: [],
      modules: [__api_profile_js_onRequestPut],
    },
  {
      routePath: "/api/restore",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_restore_js_onRequestPost],
    },
  {
      routePath: "/api/session",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_session_js_onRequestGet],
    },
  {
      routePath: "/api/settings",
      mountPath: "/api",
      method: "PUT",
      middlewares: [],
      modules: [__api_settings_js_onRequestPut],
    },
  {
      routePath: "/api/state",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_state_js_onRequestGet],
    },
  ]