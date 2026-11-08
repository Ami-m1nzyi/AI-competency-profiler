import { useState, useContext } from 'react';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { ThemeContext } from '../context/theme-context';
import AsciiStar from '../components/AsciiStar';
import styles from './AuthPage.module.css';
import RegisterPage from './RegisterPage';

const API = '';
const roles = [
  { value: 'student', label: 'Студент' },
  { value: 'teacher', label: 'Преподаватель' },
  { value: 'admin', label: 'Админ' },
];

const AuthPage = ({ onLogin }) => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [role, setRole] = useState('student');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка входа');
        return;
      }
      onLogin(data.role, data);
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  const themeToggle = (
    <button type="button" className={styles.themeToggle} onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}>
      {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
      <span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
    </button>
  );

  if (showRegister) {
    return <>{themeToggle}<RegisterPage onSwitch={() => setShowRegister(false)} /></>;
  }

  return (
    <main className={styles.container}>
      {themeToggle}
      <div className={styles.shell}>
        <section className={styles.identity} aria-labelledby="welcome-title">
          <div className={styles.brand}><AsciiStar className={styles.brandStar} />AI-profiler</div>
          <p className={styles.eyebrow}>Карта твоих компетенций</p>
          <h1 className={styles.heroTitle} id="welcome-title">Твой потенциал.<br /><span>Твоя траектория.</span></h1>
          <p className={styles.intro}>Узнай свои сильные стороны и найди направление развития в IT.</p>
          <div className={styles.artwork} aria-hidden="true"><AsciiStar className={styles.heroStar} animated /></div>
          <p className={styles.caption}>Алгоритмы · Кодинг · Дизайн · Бизнес · Команда</p>
        </section>

        <section className={styles.card} aria-labelledby="login-title">
          <p className={styles.eyebrow}>Личный кабинет</p>
          <h2 className={styles.title} id="login-title">С возвращением</h2>
          <p className={styles.subtitle}>Войди, чтобы продолжить свою траекторию.</p>
          <div className={styles.roleSelector} role="group" aria-label="Роль для входа">
            {roles.map(item => (
              <button key={item.value} type="button" aria-pressed={role === item.value}
                className={`${styles.roleBtn} ${role === item.value ? styles.activeRole : ''}`}
                onClick={() => setRole(item.value)}>{item.label}</button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.field} htmlFor="login">Логин
              <input id="login" name="username" type="text" autoComplete="username" placeholder="Введи логин или почту" required
                className={styles.input} value={login} onChange={e => setLogin(e.target.value)} />
            </label>
            <label className={styles.field} htmlFor="login-password">Пароль
              <input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Введи пароль" required
                className={styles.input} value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Входим…' : 'Войти в кабинет'}<ArrowRight size={20} aria-hidden="true" />
            </button>
            <p className={styles.switchText}>Впервые здесь? <button type="button" className={styles.textButton} onClick={() => setShowRegister(true)}>Создать аккаунт</button></p>
          </form>
        </section>
      </div>
    </main>
  );
};

export default AuthPage;

