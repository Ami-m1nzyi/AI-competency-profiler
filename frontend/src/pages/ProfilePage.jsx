import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, FolderOpen, FileText, Link, Paperclip, Plus, Trash2, Sparkles } from 'lucide-react';
import AsciiStar from '../components/AsciiStar';
import hudPaths from '../assets/moodboard/radar-frame.png';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import styles from './ProfilePage.module.css';

const API = '';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'zip', 'rar'];

const MODULE_NAMES = {
  algo: 'Алгоритмы',
  coding: 'Кодинг',
  design: 'Дизайн',
  entrepreneur: 'Бизнес',
  teamwork: 'Команда',
};

const TYPE_LABELS = {
  certificate: { label: 'Сертификат'},
  diploma:     { label: 'Диплом'},
  article:     { label: 'Статья'},
  project:     { label: 'Проект'},
};



const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

// Форма добавления элемента портфолио.
const AddPortfolioForm = ({ userId, onAdded }) => {
  const [open, setOpen]     = useState(false);
  const [form, setForm]     = useState({ type: 'certificate', title: '', description: '', url: '' });
  const [attachMode, setAttachMode] = useState('url');
  const [file, setFile]     = useState(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const reset = () => {
    setForm({ type: 'certificate', title: '', description: '', url: '' });
    setAttachMode('url');
    setFile(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); return; }

    const ext = f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Недопустимый формат файла. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')}`);
      setFile(null);
      e.target.value = '';
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError('Файл слишком большой (максимум 10 МБ)');
      setFile(null);
      e.target.value = '';
      return;
    }
    setError('');
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Укажите название'); return; }
    if (attachMode === 'file' && !file) { setError('Выберите файл'); return; }

    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('user_id', userId);
      fd.append('type', form.type);
      fd.append('title', form.title);
      fd.append('description', form.description);
      if (attachMode === 'url') {
        fd.append('url', form.url);
      } else if (file) {
        fd.append('file', file);
      }

      const res = await fetch(`${API}/api/portfolio`, {
        method: 'POST',
        body: fd, // Браузер сам задает Content-Type с boundary.
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Ошибка'); return; }

      reset();
      setOpen(false);
      onAdded();
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" /> Добавить
      </button>
    );
  }

  return (
    <div className={styles.addForm}>
      <select
        className={styles.formSelect} aria-label="Тип достижения"
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
      >
        {Object.entries(TYPE_LABELS).map(([val, { label }]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>

      <input
        className={styles.formInput}
        aria-label="Название достижения" placeholder="Название *"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <input
        className={styles.formInput}
        aria-label="Описание достижения" placeholder="Описание (необязательно)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      {/* Выбор типа вложения */}
      <div className={styles.attachToggle}>
        <button
          type="button"
          className={`${styles.toggleBtn} ${attachMode === 'url' ? styles.toggleActive : ''}`}
          onClick={() => { setAttachMode('url'); setFile(null); setError(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
        >
          <Link size={16} aria-hidden="true" /> Ссылка
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${attachMode === 'file' ? styles.toggleActive : ''}`}
          onClick={() => { setAttachMode('file'); setForm({ ...form, url: '' }); setError(''); }}
        >
          <Paperclip size={16} aria-hidden="true" /> Загрузить файл
        </button>
      </div>

      {attachMode === 'url' ? (
        <input
          className={styles.formInput}
          aria-label="Ссылка на достижение" placeholder="Ссылка (необязательно)"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
      ) : (
        <div className={styles.fileInputWrap}>
          <input
            ref={fileInputRef}
            type="file"
            id="portfolio-file-input"
            className={styles.fileInputHidden}
            accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
            onChange={handleFileChange}
          />
          <label htmlFor="portfolio-file-input" className={styles.fileInputLabel}>
            {file ? 'Заменить файл' : 'Выбрать файл'}
          </label>
          {file && (
            <span className={styles.fileInfo}>
              {file.name} · {formatFileSize(file.size)}
            </span>
          )}
          <span className={styles.fileHint}>
            До 10 МБ. PDF, DOC, PPT, XLS, изображения, ZIP
          </span>
        </div>
      )}

      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.formActions}>
        <button className={styles.saveBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button className={styles.cancelBtn} onClick={() => { reset(); setOpen(false); }}>
          Отмена
        </button>
      </div>
    </div>
  );
};

// Карточка элемента портфолио.
const PortfolioItem = ({ item, userId, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);
  const meta = TYPE_LABELS[item.type] || { label: item.type };

  const handleDelete = async () => {
    if (!window.confirm('Удалить запись?')) return;
    setDeleting(true);
    try {
      await fetch(`${API}/api/portfolio/${item.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  // Ссылка на загруженный файл или внешний ресурс.
  const link = item.file_path
    ? `${API}/api/portfolio/file/${item.file_path}`
    : item.link || item.url || null;


  return (
    <div className={styles.portfolioItem}>
      <div className={styles.portfolioItemLeft}>
        <span className={styles.portfolioEmoji}><FileText size={22} aria-hidden="true" /></span>
        <div>
          <div className={styles.portfolioTitle}>
            {link
              ? <a href={link} target="_blank" rel="noreferrer" className={styles.portfolioLink}>{item.title}</a>
              : item.title
            }
          </div>
          <div className={styles.portfolioMeta}>
            <span className={styles.portfolioType}>{meta.label}</span>
            {item.description && (
              <span className={styles.portfolioDesc}> · {item.description}</span>
            )}
          </div>
          {item.file_path && (
            <div className={styles.portfolioAttachment}>
              <Paperclip size={14} aria-hidden="true" /> <a href={link} target="_blank" rel="noreferrer" className={styles.portfolioLink}>{item.file_name}</a>
            </div>
          )}
          <div className={styles.portfolioDate}>{item.created_at?.slice(0, 10)}</div>
        </div>
      </div>
      {userId && (
        <button
          className={styles.deleteBtn}
          onClick={handleDelete}
          disabled={deleting}
          title="Удалить" aria-label={`Удалить ${item.title}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

// Секция портфолио.
const PortfolioSection = ({ userId, editable }) => {
  const [loadError, setLoadError] = useState('');
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API}/api/portfolio/${userId}`);
      if (!res.ok) throw new Error('Не удалось загрузить портфолио');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setLoadError('');
    } catch { setLoadError('Не удалось загрузить портфолио. Попробуйте ещё раз.'); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetch(`${API}/api/portfolio/${userId}`)
      .then(res => { if (!res.ok) throw new Error('Portfolio request failed'); return res.json(); })
      .then(data => { if (active) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setLoadError('Не удалось загрузить портфолио. Попробуйте ещё раз.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  return (
    <section className={styles.portfolioSection}>
      <div className={styles.portfolioHeader}>
        <h3><FolderOpen size={19} aria-hidden="true" /> Портфолио</h3>
        {editable && <AddPortfolioForm userId={userId} onAdded={load} />}
      </div>

      {loadError && <p className={styles.formError} role="alert">{loadError} <button className="text-button" onClick={load}>Повторить</button></p>}
      {loading ? (
        <p className={styles.portfolioEmpty}>Загрузка...</p>
      ) : items.length === 0 ? (
        <p className={styles.portfolioEmpty}>
          {editable ? 'Добавьте свои достижения — сертификаты, дипломы, статьи, проекты.' : 'Портфолио пока пустое.'}
        </p>
      ) : (
        <div className={styles.portfolioList}>
          {items.map((item) => (
            <PortfolioItem
              key={item.id}
              item={item}
              userId={editable ? userId : null}
              onDeleted={load}
            />
          ))}
        </div>
      )}
    </section>
  );
};

const STRENGTH_NAMES = { algo: 'алгоритмы', coding: 'кодинг', design: 'дизайн', entrepreneur: 'предпринимательство', teamwork: 'работа в команде' };

const ProfilePage = ({ user, results, onStartTest, onViewResults }) => {
  const [chartWidth, setChartWidth] = useState(0);
  const chartData = Object.entries(MODULE_NAMES).map(([key, subject]) => ({ subject, key, value: Number(results?.scores?.[key]) || 0 }));
  const strongest = [...chartData].sort((a, b) => b.value - a.value).slice(0, 2);
  const subtitle = [user?.name, user?.group_number, user?.course_year && `${user.course_year} курс`].filter(Boolean).join(' · ');
  return <div className={styles.page}>
    <div className={styles.heading}>
      <div><h1>Карта твоих компетенций</h1><p>{subtitle}</p></div>
      <AsciiStar className={styles.headingStar} />
    </div>
    <div className={styles.profileGrid}>
      <section className={styles.profileIntro}>
        <div className={styles.overline}>Твой профиль</div>
        <h2 className={styles.role}>{results?.profile || 'Начни с себя'}</h2>
        <p className={styles.strengths}>{results ? `Сильные стороны: ${strongest.map(item => STRENGTH_NAMES[item.key]).join(' и ')}.` : 'Узнай свои сильные стороны и найди направление для развития в IT.'}</p>
        <button className="primary-button" onClick={onStartTest}>{results ? 'Пройти тест снова' : 'Пройти тест'}<ArrowRight size={21} aria-hidden="true" /></button>
        <details className={styles.personalDetails}><summary>Данные профиля</summary><dl>
          <div><dt>Студент</dt><dd>{user?.name || '—'}</dd></div>
          <div><dt>Логин</dt><dd>{user?.login || '—'}</dd></div>
          <div><dt>Роль</dt><dd>Студент</dd></div>
          {user?.group_name && <div><dt>Направление</dt><dd>{user.group_name}</dd></div>}
          {user?.group_number && <div><dt>Группа</dt><dd>{user.group_number}</dd></div>}
          {user?.course_year && <div><dt>Курс</dt><dd>{user.course_year}</dd></div>}
        </dl></details>
      </section>
      <section className={styles.chartPanel} aria-label="Карта пяти компетенций">
        <img src={hudPaths} className={styles.chartFrame} alt="" aria-hidden="true" />
        {results ? <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 350, height: 440 }} onResize={setChartWidth}>
            <RadarChart cx="50%" cy="50%" outerRadius={chartWidth < 400 ? '65%' : '78%'} data={chartData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" stroke="var(--text-main)" tick={{ fontSize: 13, fontWeight: 700 }} tickLine={false} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Баллы" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="var(--accent-strong)" fillOpacity={0.36} dot={{ r: 5, fill: 'var(--accent)', strokeWidth: 0 }} isAnimationActive={false} />
            </RadarChart>
          </ResponsiveContainer>
        </div> : <div className={styles.emptyChart}><AsciiStar className={styles.emptyStar}/><p>Здесь появится твоя<br/>карта компетенций</p><span>5 направлений · 60 минут</span></div>}
      </section>
      <section className={styles.scores} aria-label="Баллы по направлениям">
        {chartData.map(item => <div key={item.key} className={styles.scoreRow}>
          <div><span>{item.subject}</span><strong>{results ? item.value : '—'}<small> / 100</small></strong></div>
          <meter min="0" max="100" value={item.value} aria-label={`${item.subject}: ${results ? item.value : 'ещё нет результата'}`} />
        </div>)}
      </section>
    </div>
    <div className={styles.supporting}>
      <section className={styles.advice}>
        <h3><Sparkles size={20} aria-hidden="true" /> Рекомендация ИИ</h3>
        <p>{results?.recommendations || 'После тестирования здесь появятся рекомендации по развитию твоих навыков.'}</p>
        {results && <button className="text-button" onClick={onViewResults}>Все рекомендации <ArrowRight size={19} aria-hidden="true" /></button>}
      </section>
      <PortfolioSection userId={user?.id} editable />
    </div>
  </div>;
};
export default ProfilePage;
