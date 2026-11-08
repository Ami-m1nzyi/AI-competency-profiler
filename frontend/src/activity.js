// Отправка событий активности на бэкенд.
// Если в проекте есть общая константа с адресом API (например API_URL),
// подставьте её вместо пустой строки.
const API = "";

// eventType: "visit" | "bot_interaction" | "ai_request" | "schedule_view"
export function trackEvent(eventType, userId) {
  fetch(`${API}/api/activity/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: eventType, user_id: userId ?? null }),
  }).catch(() => {
    // статистика не должна ломать интерфейс, ошибки игнорируем
  });
}

// Статистика для админа
export async function fetchActivityStats(adminId, from, to) {
  const params = new URLSearchParams({ user_id: adminId, from, to });
  const res = await fetch(`${API}/api/activity/stats?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка загрузки статистики");
  return data;
}
