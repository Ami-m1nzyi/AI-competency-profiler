import { useState, useEffect, useCallback } from 'react';
import { useDialog } from '../components/useDialog';
import { UserRound, Mail, ChartNoAxesCombined, UsersRound, FolderOpen, FileText, Paperclip, X, Pin, PinOff, Sparkles, Clock3, CalendarDays, Settings2 } from 'lucide-react';
import styles from './TeacherProfilePage.module.css';

const API = '';

const fetchTeams = (withoutAI = false) => fetch(`${API}/api/teams${withoutAI ? '/no-ai' : ''}`)
  .then(async (response) => {
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'Не удалось загрузить команды');
    return data.teams || [];
  });

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

const SCORE_MAX = 100;
const normalizeGroup = (g) => (g || '').replace(/\s+/g, '').toUpperCase();

const ScoreBar = ({ value }) => {
  const pct = Math.max(0, Math.min(100, Math.round(((Number(value) || 0) / SCORE_MAX) * 100)));
  const color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--accent)' : 'var(--error)';
  return (
    <div className={styles.barWrap}>
      <div className={styles.barFill} style={{ width: `${pct}%`, backgroundColor: color }} />
      <span className={styles.barLabel}>{value ?? '—'}</span>
    </div>
  );
};

// Модальное окно портфолио студента.
const StudentModal = ({ student, onClose }) => {
  const dialogRef = useDialog(Boolean(student), onClose);
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(Boolean(student?.user_id));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!student?.user_id) return;
    let active = true;
    fetch(`${API}/api/portfolio/${student.user_id}`)
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить портфолио');
        return response.json();
      })
      .then((data) => { if (active) setItems(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [student?.user_id]);

  if (!student) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-label="Профиль студента" onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>{student.name}</h2>
            <span className={styles.modalSub}>{student.login}</span>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        {/* Результаты теста */}
        <div className={styles.modalScores}>
          {Object.entries(MODULE_NAMES).map(([key, label]) => (
            <div key={key} className={styles.modalScoreRow}>
              <span className={styles.modalScoreLabel}>{label}</span>
              <ScoreBar value={student[key]} />
            </div>
          ))}
          {student.profile && (
            <p className={styles.modalProfile}>
              Профиль: <strong>{student.profile}</strong>
            </p>
          )}
          {student.time_taken && (
            <p className={styles.modalProfile}>
              <Clock3 size={15} aria-hidden="true" /> Время прохождения: <strong>{student.time_taken}</strong>
            </p>
          )}
          {student.created_at && (
            <p className={styles.modalProfile}>
              <CalendarDays size={15} aria-hidden="true" /> Дата теста: <strong>{student.created_at.slice(0, 10)}</strong>
            </p>
          )}
        </div>

        {/* Рекомендации */}
        <div className={styles.modalPortfolio}>
          <h3 className={styles.modalPortfolioTitle}>Рекомендации ИИ</h3>
          {student.recommendations ? (
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
              {student.recommendations}
            </p>
          ) : (
            <p className={styles.modalEmpty}>Рекомендации отсутствуют.</p>
          )}
        </div>

        {/* Портфолио */}
        <div className={styles.modalPortfolio}>
          <h3 className={styles.modalPortfolioTitle}>Портфолио</h3>
          {error ? (
            <p className={styles.modalEmpty} role="alert">{error}</p>
          ) : loading ? (
            <p className={styles.modalEmpty}>Загрузка...</p>
          ) : items.length === 0 ? (
            <p className={styles.modalEmpty}>Студент ещё не добавил работы.</p>
          ) : (
            <div className={styles.modalItems}>
              {items.map((item) => {
                const meta = TYPE_LABELS[item.type] || { label: item.type };
                const link = item.file_path
                  ? `${API}/api/portfolio/file/${item.file_path}`
                  : item.link || item.url || null;

                return (
                  <div key={item.id} className={styles.modalItem}>
                    <FileText size={22} className={styles.modalItemIcon} aria-hidden="true" />
                    <div className={styles.modalItemBody}>
                      <div className={styles.modalItemTitle}>
                        {link
                          ? <a href={link} target="_blank" rel="noreferrer" className={styles.modalItemLink}>{item.title}</a>
                          : item.title
                        }
                      </div>
                      <div className={styles.modalItemMeta}>
                        <span className={styles.portfolioType}>{meta.label}</span>
                        {item.description && <span className={styles.modalItemDesc}> · {item.description}</span>}
                      </div>
                      {item.file_path && (
                        <div className={styles.modalItemAttachment}>
                          <Paperclip size={14} aria-hidden="true" /> <a href={link} target="_blank" rel="noreferrer" className={styles.modalItemLink}>{item.file_name}</a>
                        </div>
                      )}
                      <div className={styles.modalItemDate}>{item.created_at?.slice(0, 10)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Страница преподавателя.
const TeacherProfilePage = ({ user }) => {
  const [tab, setTab]                 = useState('students');
  const [results, setResults]         = useState([]);
  const [teams, setTeams]             = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadingTeams, setLoadingTeams]     = useState(false);
  const [teamsError, setTeamsError]   = useState('');
  const [resultsError, setResultsError] = useState('');
  const [search, setSearch]           = useState('');
  const [filterProfile, setFilterProfile] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [pinnedTeams, setPinnedTeams] = useState([]);
  const closeStudent = useCallback(() => setSelectedStudent(null), []);

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/results`)
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить результаты студентов');
        return response.json();
      })
      .then((data) => { if (active) setResults(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setResultsError(err.message); })
      .finally(() => { if (active) setLoadingResults(false); });
    return () => { active = false; };
  }, []);

  const generateTeams = (withoutAI = false) => {
    setLoadingTeams(true);
    setTeamsError('');
    fetchTeams(withoutAI)
      .then(setTeams)
      .catch((err) => setTeamsError(err.message))
      .finally(() => setLoadingTeams(false));
  };

  const loadTeams = () => generateTeams();
  const loadTeamsNoAI = () => generateTeams(true);

  const profileOptions = [...new Set(results.map((r) => r.profile).filter(Boolean))];
  const groupOptions = [...new Set(results.map((r) => normalizeGroup(r.group_number)).filter(Boolean))].sort();
  
  useEffect(() => {
    if (tab !== 'teams') return;
    let active = true;
    fetchTeams()
      .then((data) => { if (active) setTeams(data); })
      .catch((err) => { if (active) setTeamsError(err.message); })
      .finally(() => { if (active) setLoadingTeams(false); });
    if (user?.id) {
      fetch(`${API}/api/teams/pinned/${user.id}`)
        .then((response) => {
          if (!response.ok) throw new Error('Не удалось загрузить закреплённые команды');
          return response.json();
        })
        .then((data) => {
          if (active && data.pinned) setPinnedTeams(data.pinned.map((entry) => ({ ...entry.team, pinnedId: entry.id })));
        })
        .catch((err) => { if (active) setTeamsError(err.message); });
    }
    return () => { active = false; };
  }, [tab, user?.id]);

  const handlePinTeam = (team, index) => {
    if (!user?.id) return;
    setTeamsError('');
    fetch(`${API}/api/teams/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, team }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Не удалось изменить закрепление команды');
        return data;
      })
      .then((data) => {
        if (data.id) {
          setPinnedTeams((current) => [{ ...team, pinnedId: data.id }, ...current]);
          setTeams((current) => current.filter((_, i) => i !== index));
        }
      })
      .catch((err) => setTeamsError(err.message));
  };

  const handleUnpinTeam = (pinnedId, team) => {
    if (!user?.id) return;
    setTeamsError('');
    fetch(`${API}/api/teams/pin/${pinnedId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Не удалось изменить закрепление команды');
        return data;
      })
      .then(() => {
        // Удаляем закрепленную команду и возвращаем ее в список новых.
        setPinnedTeams((current) => current.filter((t) => t.pinnedId !== pinnedId));
        setTeams((current) => [team, ...current]);
      })
      .catch((err) => setTeamsError(err.message));
  };

    const filtered = results.filter((r) => {
    const q        = search.toLowerCase();
    const matchName = r.name?.toLowerCase().includes(q) || r.login?.toLowerCase().includes(q);
    const matchProfile = filterProfile ? r.profile === filterProfile : true;
    const matchGroup = filterGroup ? normalizeGroup(r.group_number) === filterGroup : true;
    return matchName && matchProfile && matchGroup;
  });

  const teacherName  = user?.name || 'Преподаватель';

  return (
    <div className={styles.page}>
      {/* Профиль преподавателя */}
      <div className={styles.profileHeader}>
        <div className={styles.avatar}>
          <UserRound size={28} strokeWidth={1.4} aria-hidden="true" />
        </div>
        <div className={styles.profileInfo}>
          <p className={styles.eyebrow}>Кабинет преподавателя</p>
          <h1 className={styles.profileName}>{teacherName}</h1>
          <div className={styles.profileMeta}>
            <span className={styles.badge}>Преподаватель</span>
            {user?.login && <span className={styles.metaItem}><Mail size={15} aria-hidden="true" /> {user.login}</span>}
          </div>
        </div>
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{results.length}</span>
            <span className={styles.statLabel}>Студентов</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{profileOptions.length}</span>
            <span className={styles.statLabel}>Профилей</span>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${tab === 'students' ? styles.tabActive : ''}`}
          onClick={() => setTab('students')}
          aria-pressed={tab === 'students'}
        >
          <ChartNoAxesCombined size={18} aria-hidden="true" /> Результаты студентов
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'teams' ? styles.tabActive : ''}`}
          onClick={() => { if (tab !== 'teams') { setLoadingTeams(true); setTeamsError(''); setTab('teams'); } }}
          aria-pressed={tab === 'teams'}
        >
          <UsersRound size={18} aria-hidden="true" /> Команды
        </button>
      </div>

      {/* Результаты студентов */}
      {tab === 'students' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Результаты тестирования</h2>
            <div className={styles.filters}>
              <input
                type="text"
                placeholder="Имя или логин студента"
                aria-label="Поиск студентов"
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className={styles.filterSelect}
                aria-label="Фильтр по профилю"
                value={filterProfile}
                onChange={(e) => setFilterProfile(e.target.value)}
              >
                <option value="">Все профили</option>
                {profileOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                className={styles.filterSelect}
                aria-label="Фильтр по группе"
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
              >
                <option value="">Все группы</option>
                {groupOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {resultsError ? (
            <div className={`${styles.emptyState} ${styles.errorState}`} role="alert">{resultsError}</div>
          ) : loadingResults ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <span>Загрузка данных...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              {results.length === 0
                ? 'Ни один студент ещё не прошёл тестирование'
                : 'Ничего не найдено по вашему запросу'}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Студент</th>
                    <th className={styles.th}>Логин</th>
                    <th className={styles.th}>Группа</th>
                    {Object.values(MODULE_NAMES).map((name) => (
                      <th key={name} className={`${styles.th} ${styles.thScore}`}>{name}</th>
                    ))}
                    <th className={styles.th}>Роль / Профиль</th>
                    <th className={styles.th}>Портфолио</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                      <td className={styles.td}>
                        <span className={styles.studentName}>{row.name}</span>
                      </td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>{row.login}</td>
                      <td className={`${styles.td} ${styles.tdMuted}`}>{row.group_number || '—'}</td>
                      {Object.keys(MODULE_NAMES).map((key) => (
                        <td key={key} className={`${styles.td} ${styles.tdScore}`}>
                          <ScoreBar value={row[key]} />
                        </td>
                      ))}
                      <td className={styles.td}>
                        <span className={styles.profileBadge}>{row.profile || '—'}</span>
                      </td>
                      <td className={styles.td}>
                        <button
                          className={styles.portfolioBtn}
                          onClick={() => setSelectedStudent(row)}
                        >
                          <FolderOpen size={16} aria-hidden="true" /> Смотреть
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Команды */}
      {tab === 'teams' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Команды студентов</h2>
            <div className={styles.actions}>
              <button className={styles.primaryBtn} onClick={loadTeams} disabled={loadingTeams}>
                <Sparkles size={17} aria-hidden="true" /> {loadingTeams ? 'Загрузка...' : 'Собрать с ИИ'}
              </button>
              <button className={styles.refreshBtn} onClick={loadTeamsNoAI} disabled={loadingTeams}>
                <Settings2 size={17} aria-hidden="true" /> Собрать без ИИ
              </button>
            </div>
          </div>

          {teamsError && <div className={`${styles.emptyState} ${styles.errorState}`} role="alert">{teamsError}</div>}

          {pinnedTeams.length > 0 && (
            <div>
              <h3 className={styles.subsectionTitle}>Закрепленные команды</h3>
              <div className={styles.teamsGrid}>
                {pinnedTeams.map((team) => (
                  <div key={`pinned-${team.pinnedId}`} className={`${styles.teamCard} ${styles.teamCardPinned}`}>
                    <div className={styles.teamHeader}>
                      <div style={{ flex: 1 }}>
                        <h3 className={styles.teamTitle}>{team.description?.substring(0, 30) || 'Команда'}</h3>
                        <span className={styles.teamCount}>{team.members?.length ?? 0} чел.</span>
                      </div>
                      <button
                        className={styles.unpinBtn}
                        onClick={() => handleUnpinTeam(team.pinnedId, team)}
                        title="Открепить команду"
                      >
                        <PinOff size={18} aria-hidden="true" />
                      </button>
                    </div>
                    <div className={styles.memberList}>
                      {(team.members || []).map((member, mi) => (
                        <div key={mi} className={styles.memberRow}>
                          <div className={styles.memberLeft}>
                            <span className={styles.memberAvatar}>
                              {(member.name || '?')[0].toUpperCase()}
                            </span>
                            <div>
                              <div className={styles.memberName}>{member.name}</div>
                              <div className={styles.memberProfile}>{member.role || member.profile || '—'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {team.description && (
                      <p className={styles.teamDesc}>{team.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingTeams ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <span>Формируем команды...</span>
            </div>
          ) : teams.length === 0 && pinnedTeams.length === 0 ? (
            <div className={styles.emptyState}>Нет данных для формирования команд</div>
          ) : teams.length > 0 ? (
            <div>
              <h3 className={styles.subsectionTitle}>Новые команды</h3>
              <div className={styles.teamsGrid}>
                {teams.map((team, ti) => (
                  <div key={ti} className={styles.teamCard}>
                    <div className={styles.teamHeader}>
                      <div style={{ flex: 1 }}>
                        <h3 className={styles.teamTitle}>Команда {ti + 1}</h3>
                        <span className={styles.teamCount}>{team.members?.length ?? 0} чел.</span>
                      </div>
                      <button
                        className={styles.pinBtn}
                        onClick={() => handlePinTeam(team, ti)}
                        title="Закрепить команду"
                      >
                        <Pin size={18} aria-hidden="true" />
                      </button>
                    </div>
                    <div className={styles.memberList}>
                      {(team.members || []).map((member, mi) => (
                        <div key={mi} className={styles.memberRow}>
                          <div className={styles.memberLeft}>
                            <span className={styles.memberAvatar}>
                              {(member.name || '?')[0].toUpperCase()}
                            </span>
                            <div>
                              <div className={styles.memberName}>{member.name}</div>
                              <div className={styles.memberProfile}>{member.role || member.profile || '—'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {team.description && (
                      <p className={styles.teamDesc}>{team.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Портфолио студента */}
      {selectedStudent && (
        <StudentModal
          student={selectedStudent}
          onClose={closeStudent}
        />
      )}
    </div>
  );
};

export default TeacherProfilePage;
