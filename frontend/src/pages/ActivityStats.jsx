import { useEffect, useState } from 'react';
import { CalendarRange, ArrowRight, Activity, Globe2 } from 'lucide-react';
import { fetchActivityStats } from '../activity';
import styles from './ActivityStats.module.css';

const toISO = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toISO(date);
};

const ActivityStats = ({ adminId }) => {
  const [from, setFrom] = useState(() => daysAgo(6));
  const [to, setTo] = useState(() => toISO(new Date()));
  const [range, setRange] = useState(() => ({ from: daysAgo(6), to: toISO(new Date()) }));
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchActivityStats(adminId, range.from, range.to)
      .then((data) => { if (active) setStats(data); })
      .catch((err) => {
        if (active) {
          setStats(null);
          setError(err.message);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adminId, range]);

  const load = (event) => {
    event.preventDefault();
    if (!from || !to || from > to) {
      setError('Выберите корректный период: дата начала должна быть не позже даты окончания.');
      return;
    }
    setError('');
    setLoading(true);
    setRange({ from, to });
  };

  const cards = stats ? [
    ['Всего пользователей', stats.total_users],
    ['Новых за период', stats.new_users],
    ['Активных за период', stats.active_users],
    ['Среднее активных в день', stats.avg_active_users_per_day],
    ['Взаимодействий с ботом', stats.bot_interactions],
    ['Запросов к ИИ', stats.ai_requests],
    ['Просмотров расписания', stats.schedule_views],
  ] : [];
  const countries = Object.entries(stats?.visits_by_country || {});

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Кабинет администратора / Аналитика</p>
        <h1 className={styles.title}>Активность на сайте</h1>
        <p className={styles.description}>Пользователи, обращения к ИИ и география событий за выбранный период.</p>
      </header>

      <form className={styles.filters} onSubmit={load}>
        <CalendarRange size={22} className={styles.filterIcon} aria-hidden="true" />
        <label>С <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></label>
        <span className={styles.rangeArrow} aria-hidden="true"><ArrowRight size={18} /></span>
        <label>По <input type="date" value={to} onChange={(event) => setTo(event.target.value)} required /></label>
        <button className={styles.btn} type="submit" disabled={loading}>{loading ? 'Загрузка…' : 'Показать'} <ArrowRight size={17} aria-hidden="true" /></button>
      </form>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading && <p className={styles.loading} role="status"><Activity size={18} aria-hidden="true" /> Загружаем статистику…</p>}

      {stats && (
        <div aria-busy={loading}>
          <div className={styles.grid}>
            {cards.map(([label, value]) => (
              <div key={label} className={styles.card}>
                <span className={styles.num}>{value ?? '—'}</span>
                <span className={styles.label}>{label}</span>
              </div>
            ))}
          </div>
          <section className={styles.geography}>
            <div className={styles.sectionHeader}>
              <Globe2 size={22} aria-hidden="true" />
              <h2 className={styles.subtitle}>География событий</h2>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th scope="col">Страна</th><th scope="col">События</th></tr></thead>
                <tbody>
                  {countries.length === 0 && <tr><td colSpan={2}>Данных за период нет</td></tr>}
                  {countries.map(([country, count]) => <tr key={country}><td>{country}</td><td>{count}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default ActivityStats;
