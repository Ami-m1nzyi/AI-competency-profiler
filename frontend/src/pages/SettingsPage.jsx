import { useContext, useState } from 'react';
import { ArrowRight, ArrowUpRight, Headphones, Moon, Palette, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { ThemeContext } from '../context/theme-context';
import SupportRequestModal from '../components/SupportRequestModal';
import styles from './SettingsPage.module.css';

const API = '';

const SettingsPage = ({ user }) => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [supportOpen, setSupportOpen] = useState(false);

  // Поля смены пароля.
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [oldPwd, setOldPwd]           = useState('');
  const [newPwd, setNewPwd]           = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [pwdError, setPwdError]       = useState('');
  const [pwdSuccess, setPwdSuccess]   = useState('');
  const [pwdLoading, setPwdLoading]   = useState(false);

  const isAdmin = user?.role === 'admin';

  const handleChangePassword = async () => {
    setPwdError('');
    setPwdSuccess('');

    if (!oldPwd || !newPwd || !confirmPwd) {
      setPwdError('Заполните все поля'); return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Новые пароли не совпадают'); return;
    }
    if (newPwd.length < 4) {
      setPwdError('Пароль должен быть не менее 4 символов'); return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch(`${API}/api/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:      user?.id,
          old_password: oldPwd,
          new_password: newPwd,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwdError(data.error || 'Ошибка');
      } else {
        setPwdSuccess('Пароль успешно изменён!');
        setOldPwd(''); setNewPwd(''); setConfirmPwd('');
        setTimeout(() => { setShowPwdForm(false); setPwdSuccess(''); }, 2000);
      }
    } catch {
      setPwdError('Не удалось подключиться к серверу');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Твоё пространство</p>
        <h1 className={styles.title}>Настройки</h1>
        <p className={styles.subtitle}>Оформление, безопасность и помощь — всё под рукой.</p>
      </header>
      <div className={styles.layout}>
        <aside className={styles.identity}>
          <UserRound size={25} strokeWidth={1.5} aria-hidden="true" />
          <h2>{user?.name || 'Мой аккаунт'}</h2>
          <p className={styles.accountLogin}>{user?.login || 'AI-profiler'}</p>
          <span className={styles.role}>{isAdmin ? 'Администратор' : user?.role === 'teacher' ? 'Преподаватель' : 'Студент'}</span>
        </aside>

        <div className={styles.settings}>
          <section className={styles.section} aria-labelledby="appearance-title">
            <div className={styles.sectionHeading}><Palette size={20} aria-hidden="true" /><h2 id="appearance-title">Оформление</h2></div>
            <div className={styles.settingRow}>
              <div><h3>Тема интерфейса</h3><p className={styles.desc}>Выбери комфортное оформление для работы.</p></div>
              <button type="button" className={styles.themeToggle} onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}>
                {theme === 'dark' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
                {theme === 'dark' ? 'Тёмная' : 'Светлая'}<ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="security-title">
            <div className={styles.sectionHeading}><ShieldCheck size={20} aria-hidden="true" /><h2 id="security-title">Безопасность</h2></div>
            <div className={styles.settingRow}>
              <div><h3>Пароль аккаунта</h3><p className={styles.desc}>Для смены понадобится текущий пароль.</p></div>
              <button type="button" className={styles.actionBtn} aria-expanded={showPwdForm} aria-controls="password-form"
                onClick={() => { setShowPwdForm(!showPwdForm); setPwdError(''); setPwdSuccess(''); }}>
                {showPwdForm ? 'Отмена' : 'Сменить пароль'}
              </button>
            </div>
            {showPwdForm && (
              <form id="password-form" className={styles.pwdForm} onSubmit={e => { e.preventDefault(); handleChangePassword(); }}>
                <label className={styles.field} htmlFor="current-password">Текущий пароль
                  <input id="current-password" className={styles.pwdInput} type="password" autoComplete="current-password" placeholder="Введи текущий пароль" value={oldPwd} onChange={e => setOldPwd(e.target.value)} />
                </label>
                <div className={styles.passwordRow}>
                  <label className={styles.field} htmlFor="new-password">Новый пароль
                    <input id="new-password" className={styles.pwdInput} type="password" autoComplete="new-password" placeholder="Не менее 4 символов" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                  </label>
                  <label className={styles.field} htmlFor="confirm-new-password">Повтори новый пароль
                    <input id="confirm-new-password" className={styles.pwdInput} type="password" autoComplete="new-password" placeholder="Ещё раз" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
                  </label>
                </div>
                {pwdError && <p className={styles.pwdError} role="alert">{pwdError}</p>}
                {pwdSuccess && <p className={styles.pwdSuccess} role="status">{pwdSuccess}</p>}
                <button type="submit" className={styles.pwdSaveBtn} disabled={pwdLoading}>{pwdLoading ? 'Сохраняем…' : 'Сохранить пароль'}<ArrowRight size={17} aria-hidden="true" /></button>
              </form>
            )}
          </section>

          {!isAdmin && (
            <section className={styles.section} aria-labelledby="support-title">
              <div className={styles.sectionHeading}><Headphones size={20} aria-hidden="true" /><h2 id="support-title">Помощь</h2></div>
              <div className={styles.settingRow}>
                <div><h3>Техническая поддержка</h3><p className={styles.desc}>Напиши администраторам, если нужна помощь с платформой.</p></div>
                <button type="button" className={styles.actionBtn} onClick={() => setSupportOpen(true)}>Написать<ArrowUpRight size={17} aria-hidden="true" /></button>
              </div>
            </section>
          )}
        </div>
      </div>
      {!isAdmin && <SupportRequestModal isOpen={supportOpen} onClose={() => setSupportOpen(false)} userId={user?.id} />}
    </div>
  );
};

export default SettingsPage;
