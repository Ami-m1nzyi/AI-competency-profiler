import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import AsciiStar from '../components/AsciiStar';
import styles from './AuthPage.module.css';
import regStyles from './RegisterPage.module.css';

const API = '';

const RegisterPage = ({ onSwitch }) => {
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Поля регистрации.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Поля студента.
  const [groupNumber, setGroupNumber] = useState('');
  const [groupName, setGroupName] = useState('');
  const [courseYear, setCourseYear] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 4) {
      setError('Пароль должен быть не менее 4 символов');
      return;
    }

    const fullName = [lastName, firstName, middleName].filter(Boolean).join(' ');
    const login = email; // Email используется как логин.

    const body = {
      name: fullName,
      login,
      password,
      role,
      first_name: firstName,
      last_name: lastName,
      middle_name: middleName,
      email,
      ...(role === 'student' && {
        group_number: groupNumber,
        group_name: groupName,
        course_year: courseYear,
      }),
      ...(role === 'teacher' && {
        invite_token: inviteToken,
      }),
    };

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка регистрации');
        return;
      }

      setSuccess('Аккаунт создан! Теперь войдите в систему.');
      setTimeout(() => onSwitch(), 2000);
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={regStyles.container}>
      <div className={regStyles.layout}>
        <aside className={regStyles.intro}>
          <div className={styles.brand}><AsciiStar className={styles.brandStar} />AI-profiler</div>
          <p className={styles.eyebrow}>Начало твоей траектории</p>
          <h1>Сильные стороны<br /><span>начинаются с тебя.</span></h1>
          <p className={regStyles.introText}>Создай профиль, оцени свои компетенции и собери достижения в одном месте.</p>
          <AsciiStar className={regStyles.star} animated />
          <button type="button" onClick={onSwitch} className={regStyles.backLink}><ArrowLeft size={17} />Вернуться ко входу</button>
        </aside>
        <section className={regStyles.content} aria-labelledby="registration-title">
          <p className={styles.eyebrow}>Новый профиль</p>
          <h2 id="registration-title" className={styles.title}>Создать аккаунт</h2>
          <p className={styles.subtitle}>Заполни данные, чтобы начать работу.</p>
          <div className={styles.roleSelector} role="group" aria-label="Роль для регистрации">
            <button type="button" aria-pressed={role === 'student'} className={`${styles.roleBtn} ${role === 'student' ? styles.activeRole : ''}`} onClick={() => setRole('student')}>Студент</button>
            <button type="button" aria-pressed={role === 'teacher'} className={`${styles.roleBtn} ${role === 'teacher' ? styles.activeRole : ''}`} onClick={() => setRole('teacher')}>Преподаватель</button>
          </div>
          <form onSubmit={handleSubmit} className={regStyles.form}>
            <div className={regStyles.row}>
              <label className={styles.field} htmlFor="reg-last-name">Фамилия
                <input id="reg-last-name" autoComplete="family-name" type="text" placeholder="Фамилия" required className={styles.input} value={lastName} onChange={e => setLastName(e.target.value)} />
              </label>
              <label className={styles.field} htmlFor="reg-first-name">Имя
                <input id="reg-first-name" autoComplete="given-name" type="text" placeholder="Имя" required className={styles.input} value={firstName} onChange={e => setFirstName(e.target.value)} />
              </label>
            </div>
            <label className={styles.field} htmlFor="reg-middle-name">Отчество <span className={regStyles.optional}>Необязательно</span>
              <input id="reg-middle-name" autoComplete="additional-name" type="text" placeholder="Отчество" className={styles.input} value={middleName} onChange={e => setMiddleName(e.target.value)} />
            </label>
            {role === 'student' && (
              <>
                <div className={regStyles.row}>
                  <label className={styles.field} htmlFor="reg-group-number">Номер группы
                    <input id="reg-group-number" type="text" placeholder="Например, 301" required className={styles.input} value={groupNumber} onChange={e => setGroupNumber(e.target.value)} />
                  </label>
                  <label className={styles.field} htmlFor="reg-course">Курс
                    <select id="reg-course" required className={styles.input} value={courseYear} onChange={e => setCourseYear(e.target.value)}>
                      <option value="">Выбери курс</option>
                      {[1, 2, 3, 4, 5].map(year => <option value={String(year)} key={year}>{year} курс</option>)}
                    </select>
                  </label>
                </div>
                <label className={styles.field} htmlFor="reg-group-name">Название учебной группы
                  <input id="reg-group-name" type="text" placeholder="Название группы" required className={styles.input} value={groupName} onChange={e => setGroupName(e.target.value)} />
                </label>
              </>
            )}
            <label className={styles.field} htmlFor="reg-email">{role === 'student' ? 'Почта' : 'Корпоративная почта'}
              <input id="reg-email" autoComplete="email" type="email" placeholder="name@example.com" required className={styles.input} value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            {role === 'teacher' && (
              <label className={styles.field} htmlFor="reg-invite">Код приглашения
                <input id="reg-invite" type="text" placeholder="Введи код" required className={styles.input} value={inviteToken} onChange={e => setInviteToken(e.target.value.toUpperCase())} aria-describedby="invite-help" />
                <span className={regStyles.hint} id="invite-help">Код отправляет администратор на твою почту.</span>
              </label>
            )}
            <div className={regStyles.row}>
              <label className={styles.field} htmlFor="reg-password">Пароль
                <input id="reg-password" autoComplete="new-password" type="password" placeholder="Не менее 4 символов" required className={styles.input} value={password} onChange={e => setPassword(e.target.value)} />
              </label>
              <label className={styles.field} htmlFor="reg-confirm-password">Повтори пароль
                <input id="reg-confirm-password" autoComplete="new-password" type="password" placeholder="Ещё раз" required className={styles.input} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </label>
            </div>
            {error && <p className={regStyles.errorMsg} role="alert">{error}</p>}
            {success && <p className={regStyles.successMsg} role="status">{success}</p>}
            <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? 'Создаём аккаунт…' : 'Зарегистрироваться'}<ArrowRight size={20} aria-hidden="true" /></button>
            <p className={styles.switchText}>Уже есть аккаунт? <button type="button" className={styles.textButton} onClick={onSwitch}>Войти</button></p>
          </form>
        </section>
      </div>
    </main>
  );
};

export default RegisterPage;
