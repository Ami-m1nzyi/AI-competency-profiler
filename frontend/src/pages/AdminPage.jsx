import { useState, useEffect, useCallback } from 'react';
import { useDialog } from '../components/useDialog';
import { X, KeyRound, RefreshCw, Check, Clock3, Circle, LoaderCircle } from 'lucide-react';
import styles from './AdminPage.module.css';

const API = '';

const STATUS_META = {
  open:        { label: 'Открыт',       icon: Circle, cls: 'statusOpen' },
  in_progress: { label: 'В разработке', icon: LoaderCircle, cls: 'statusProgress' },
  completed:   { label: 'Завершён',     icon: Check, cls: 'statusDone' },
};

const ROLE_LABELS = {
  student: 'Студент',
  teacher: 'Преподаватель',
  admin:   'Админ',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const [datePart, timePart] = dateStr.split(' ');
  if (!datePart) return dateStr;
  const [y, m, d] = datePart.split('-');
  return `${d}.${m}.${y}${timePart ? ' ' + timePart.slice(0, 5) : ''}`;
};

// Модальное окно смены логина и пароля.
const CredentialsModal = ({ userId, userName, onClose }) => {
  const dialogRef = useDialog(true, onClose);
  const [newLogin, setNewLogin]       = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);
  const [loading, setLoading]         = useState(false);

  const handleSave = async () => {
    if (!newLogin.trim() && !newPassword.trim()) {
      setError('Заполните хотя бы одно поле');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/users/${userId}/credentials`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login:    newLogin.trim() || undefined,
          password: newPassword.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка обновления');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-label="Смена данных пользователя" onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Смена данных</h2>
            <span className={styles.modalSub}>{userName}</span>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        {success ? (
          <div className={styles.credSuccess}>
            <p>Данные успешно обновлены</p>
            <button className={styles.statusOption} onClick={onClose}>Закрыть</button>
          </div>
        ) : (
          <div className={styles.modalBody}>
            <p className={styles.credHint}>
              Оставьте поле пустым, если не хотите его менять.
            </p>
            <div className={styles.credFields}>
              <div className={styles.credField}>
                <label className={styles.credLabel} htmlFor="new-login">Новый логин</label>
                <input
                  className={styles.credInput}
                  id="new-login"
                  autoComplete="off"
                  placeholder="Введите новый логин..."
                  value={newLogin}
                  onChange={(e) => setNewLogin(e.target.value)}
                />
              </div>
              <div className={styles.credField}>
                <label className={styles.credLabel} htmlFor="new-password">Новый пароль</label>
                <input
                  id="new-password"
                  autoComplete="new-password"
                  type="password"
                  className={styles.credInput}
                  placeholder="Введите новый пароль..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            {error && <p className={styles.credError}>{error}</p>}
            <div className={styles.credActions}>
              <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Модальное окно запроса поддержки.
const RequestModal = ({ request, onClose, onStatusChange, updating, error }) => {
  const [showCredentials, setShowCredentials] = useState(false);
  const [replyText, setReplyText] = useState('');
  const closeCredentials = useCallback(() => setShowCredentials(false), []);
  const dialogRef = useDialog(Boolean(request) && !showCredentials, onClose);

  if (!request) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div ref={dialogRef} tabIndex={-1} inert={showCredentials} aria-hidden={showCredentials || undefined} className={styles.modal} role="dialog" aria-modal={showCredentials ? undefined : "true"} aria-label="Запрос поддержки" onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <div>
              <h2 className={styles.modalTitle}>{request.subject}</h2>
              <span className={styles.modalSub}>
                {request.user_name} · {ROLE_LABELS[request.user_role] || request.user_role}
              </span>
            </div>
            <button className={styles.modalClose} onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
          </div>

          <div className={styles.modalBody}>
            <p className={styles.modalDate}>{formatDate(request.created_at)}</p>
            <p className={styles.modalMessage}>{request.message}</p>
          </div>

          <div className={styles.modalBody}>
            <label className={styles.credLabel} htmlFor="support-reply">Комментарий для письма (необязательно):</label>
            <textarea
              id="support-reply"
              className={styles.credInput}
              style={{ minHeight: '60px', width: '100%' }}
              placeholder="Добавьте ответ пользователю"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
          </div>

          <div className={styles.modalFooter}>
            {error && <p className={styles.credError} role="alert">{error}</p>}
            <span className={styles.modalFooterLabel}>Статус запроса:</span>
            <div className={styles.statusButtons}>
              {Object.entries(STATUS_META).map(([key, { label, icon: StatusIcon }]) => (
                <button
                  key={key}
                  className={`${styles.statusOption} ${request.status === key ? styles.statusOptionActive : ''}`}
                  onClick={() => onStatusChange(request.id, key, replyText)}
                  disabled={updating}
                >
                  <StatusIcon size={15} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
            <button className={styles.credBtn} onClick={() => setShowCredentials(true)}>
              Сменить логин / пароль пользователю
            </button>
          </div>
        </div>
      </div>

      {showCredentials && (
        <CredentialsModal
          userId={request.user_id}
          userName={request.user_name}
          onClose={closeCredentials}
        />
      )}
    </>
  );
};

// Модальное окно приглашений преподавателей.
const InviteModal = ({ onClose }) => {
  const dialogRef = useDialog(true, onClose);
  const [email, setEmail]     = useState('');
  const [invites, setInvites] = useState([]);
  const [error, setError]     = useState('');
  const [lastToken, setLastToken] = useState('');
  const [loading, setLoading] = useState(false);

  const loadInvites = () => {
    fetch(`${API}/api/invite/list`)
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить приглашения');
        return response.json();
      })
      .then((data) => setInvites(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/invite/list`)
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить приглашения');
        return response.json();
      })
      .then((data) => { if (active) setInvites(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  const handleCreate = async () => {
    if (!email.trim()) { setError('Укажите email преподавателя'); return; }
    setLoading(true);
    setError('');
    setLastToken('');
    try {
      const res = await fetch(`${API}/api/invite/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role: 'teacher' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Ошибка'); return; }
      setLastToken(data.token);
      setEmail('');
      loadInvites();
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-label="Приглашения преподавателей" onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Коды приглашения для преподавателей</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.inviteForm}>
            <input
              type="email"
              className={styles.searchInput}
              aria-label="Email преподавателя"
              placeholder="Email преподавателя"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className={styles.primaryBtn} onClick={handleCreate} disabled={loading}>
              {loading ? 'Создаём...' : 'Создать код'}
            </button>
          </div>

          {error && <p className={styles.credError} role="alert">{error}</p>}

          {lastToken && (
            <p className={styles.tokenMessage}>
              Код создан: <strong>{lastToken}</strong> (также отправлен на почту)
            </p>
          )}

          {invites.length === 0 ? (
            <div className={styles.emptyState}>Кодов пока нет</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Код</th>
                    <th className={styles.th}>Email</th>
                    <th className={styles.th}>Статус</th>
                    <th className={styles.th}>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv, i) => (
                    <tr key={inv.id} className={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                      <td className={styles.td}><strong>{inv.token}</strong></td>
                      <td className={styles.td}>{inv.email}</td>
                      <td className={styles.td}>{inv.used ? <span className={styles.inviteStatus}><Check size={15} /> Использован</span> : <span className={styles.inviteStatus}><Clock3 size={15} /> Ожидает</span>}</td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>{formatDate(inv.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Страница администратора.
const AdminPage = () => {
  const [requests, setRequests]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected]         = useState(null);
  const [updatingId, setUpdatingId]     = useState(null);
  const [loadError, setLoadError] = useState('');
  const [showInvites, setShowInvites]   = useState(false);
  const closeRequest = useCallback(() => setSelected(null), []);
  const closeInvites = useCallback(() => setShowInvites(false), []);

  const load = () => {
    setLoading(true);
    setLoadError('');
    fetch(`${API}/api/support`)
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить запросы');
        return response.json();
      })
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/support`)
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить запросы');
        return response.json();
      })
      .then((data) => { if (active) setRequests(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setLoadError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleStatusChange = async (id, status, adminReply = '') => {
    setUpdatingId(id);
    setLoadError('');
    try {
      const res = await fetch(`${API}/api/support/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_reply: adminReply }),
      });
      if (!res.ok) throw new Error('Не удалось изменить статус запроса');
      if (res.ok) {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
        setSelected((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      r.user_name?.toLowerCase().includes(q) ||
      r.subject?.toLowerCase().includes(q);
    const matchStatus = filterStatus ? r.status === filterStatus : true;
    return matchSearch && matchStatus;
  });

  const counts = {
    open:        requests.filter((r) => r.status === 'open').length,
    in_progress: requests.filter((r) => r.status === 'in_progress').length,
    completed:   requests.filter((r) => r.status === 'completed').length,
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Кабинет администратора</p>
          <h1 className={styles.title}>Центр запросов</h1>
          <p className={styles.description}>Обращения пользователей и приглашения преподавателей.</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setShowInvites(true)}>
          <KeyRound size={18} aria-hidden="true" /> Коды приглашения
        </button>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{requests.length}</span>
          <span className={styles.statLabel}>Всего</span>
        </div>
        <div className={`${styles.statCard} ${styles.statOpen}`}>
          <span className={styles.statNum}>{counts.open}</span>
          <span className={styles.statLabel}>Открыто</span>
        </div>
        <div className={`${styles.statCard} ${styles.statProgress}`}>
          <span className={styles.statNum}>{counts.in_progress}</span>
          <span className={styles.statLabel}>В разработке</span>
        </div>
        <div className={`${styles.statCard} ${styles.statDone}`}>
          <span className={styles.statNum}>{counts.completed}</span>
          <span className={styles.statLabel}>Завершено</span>
        </div>
      </div>

      <div className={styles.section}>
        {loadError && <p className={styles.credError} role="alert">{loadError}</p>}
        <div className={styles.sectionHeader}>
          <div className={styles.filters}>
            <input
              type="text"
              aria-label="Поиск по имени или теме"
              placeholder="Имя или тема обращения"
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={styles.filterSelect}
              aria-label="Фильтр по статусу"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Все статусы</option>
              <option value="open">Открыт</option>
              <option value="in_progress">В разработке</option>
              <option value="completed">Завершён</option>
            </select>
          </div>
          <button className={styles.refreshBtn} onClick={load} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> {loading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <span>Загрузка запросов...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            {requests.length === 0 ? 'Запросов пока нет' : 'Ничего не найдено по вашему запросу'}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Отправитель</th>
                  <th className={styles.th}>Роль</th>
                  <th className={styles.th}>Тема</th>
                  <th className={styles.th}>Дата и время</th>
                  <th className={styles.th}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const meta = STATUS_META[r.status] || STATUS_META.open;
                  return (
                    <tr
                      key={r.id}
                      className={i % 2 === 0 ? styles.trEven : styles.trOdd}
                      onClick={() => setSelected(r)}
                    >
                      <td className={styles.td}>
                        <div className={styles.senderName}>{r.user_name}</div>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.roleBadge}>{ROLE_LABELS[r.user_role] || r.user_role}</span>
                      </td>
                      <td className={styles.td}>
                        <button className={styles.subject} onClick={() => setSelected(r)}>{r.subject}</button>
                      </td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>{formatDate(r.created_at)}</td>
                      <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                        <select
                          className={`${styles.statusSelect} ${styles[meta.cls]}`}
                          aria-label={`Статус запроса: ${r.subject}`}
                          value={r.status}
                          onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          disabled={updatingId === r.id}
                        >
                          <option value="open">Открыт</option>
                          <option value="in_progress">В разработке</option>
                          <option value="completed">Завершён</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RequestModal
        request={selected}
        onClose={closeRequest}
        onStatusChange={handleStatusChange}
        updating={selected && updatingId === selected.id}
        error={loadError}
      />

      {showInvites && <InviteModal onClose={closeInvites} />}
    </div>
  );
};

export default AdminPage;