import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, Clock3, RotateCcw, Send, X } from 'lucide-react';
import styles from './TestingPage.module.css';

const API = '';
const TOTAL_SECONDS = 60 * 60;
const MODULE_NAMES = { algo: 'Алгоритмы', coding: 'Кодинг', design: 'Дизайн', entrepreneur: 'Бизнес', teamwork: 'Команда' };
const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
const formatTime = (seconds) => String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');

const TestingPage = ({ user, onResultsReady }) => {
  const [modules, setModules] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const timerRef = useRef(null);
  const submittingRef = useRef(false);
  const moduleStartTime = useRef({});
  const testStartTime = useRef(null);
  const userId = user?.id;
  const userName = user?.name || 'Студент';

  useEffect(() => {
    const controller = new AbortController();
    const checkExistingResults = async () => {
      try {
        if (!userId) return;
        const res = await fetch(API + '/api/results/my/' + userId, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (data.questions_snapshot && data.answered_questions) {
          const savedQuestions = JSON.parse(data.questions_snapshot);
          const savedAnswers = JSON.parse(data.answered_questions);
          const flat = savedQuestions.modules.flatMap((mod) => mod.questions.map((q) => ({ ...q, module_id: mod.id })));
          if (!flat.length || controller.signal.aborted) return;
          setAllQuestions(flat);
          setModules(savedQuestions.modules);
          setResults({
            scores: { algo: data.algo, coding: data.coding, design: data.design, entrepreneur: data.entrepreneur, teamwork: data.teamwork },
            profile: data.profile, recommendations: data.recommendations,
            userAnswers: savedAnswers, timeTaken: data.time_taken || null, timeout: false,
          });
          setFinished(true);
        }
      } catch {
        // A missing or unreadable saved attempt must not prevent taking a new test.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    checkExistingResults();
    return () => controller.abort();
  }, [userId]);

  const handleFinish = useCallback(async (timeout = false) => {
    if (submittingRef.current || finished) return;
    submittingRef.current = true;
    clearInterval(timerRef.current);
    setSubmitting(true);
    setError('');
    const now = Date.now();
    const elapsed = Math.max(0, Math.round((now - testStartTime.current) / 1000));
    const timeLabel = Math.floor(elapsed / 60) + ' мин ' + elapsed % 60 + ' сек';
    const timeSpent = Object.fromEntries(modules.map((mod) => [mod.id, Math.round((now - moduleStartTime.current[mod.id]) / 1000)]));
    try {
      const res = await fetch(API + '/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId || null, name: userName, answers, timed_out: timeout, attempt_id: attemptId,
          time_spent: timeSpent, questions_snapshot: JSON.stringify({ modules }), time_taken: timeLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить результаты. Попробуйте отправить ещё раз.');
      if (data.questions_snapshot) {
        const saved = JSON.parse(data.questions_snapshot);
        setModules(saved.modules);
        setAllQuestions(saved.modules.flatMap((mod) => mod.questions.map((q) => ({ ...q, module_id: mod.id }))));
      }
      const completed = { ...data, timeout, userAnswers: { ...answers }, timeTaken: timeLabel };
      setResults(completed);
      setFinished(true);
      onResultsReady?.(completed);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Не удалось отправить результаты. Проверьте подключение и попробуйте ещё раз.' : err.message || 'Не удалось отправить результаты. Попробуйте ещё раз.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [answers, attemptId, finished, modules, onResultsReady, userName, userId]);

  useEffect(() => {
    if (finished || loading || !started || submitting) return undefined;
    const tick = () => {
      const remaining = Math.max(0, TOTAL_SECONDS - Math.floor((Date.now() - testStartTime.current) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && !error) handleFinish(true);
    };
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [finished, loading, started, submitting, error, handleFinish]);

  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API + '/api/questions');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.modules) || !data.modules.length) throw new Error('Не удалось загрузить вопросы. Попробуйте ещё раз.');
      const flat = data.modules.flatMap((mod) => mod.questions.map((q) => ({ ...q, module_id: mod.id })));
      if (!flat.length) throw new Error('Вопросы пока недоступны. Попробуйте ещё раз.');
      setModules(data.modules);
      setAttemptId(data.attempt_id);
      setAllQuestions(flat);
      const now = Date.now();
      moduleStartTime.current = Object.fromEntries(data.modules.map((mod) => [mod.id, now]));
      testStartTime.current = now;
      setStarted(true);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Не удалось загрузить вопросы. Проверьте подключение и попробуйте ещё раз.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    clearInterval(timerRef.current);
    setAnswers({}); setCurrentQuestion(0); setSecondsLeft(TOTAL_SECONDS);
    setAttemptId(null);
    setFinished(false); setResults(null); setError(''); setStarted(false);
  };

  if (loading) return <div className={styles.page}><div className={styles.loading} role="status">Загружаем тестирование…</div></div>;

  if (!finished && !started) return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>Оценка компетенций</p>
      <h1 className={styles.title}>Узнай свои сильные стороны</h1>
      <p className={styles.intro}>Пять направлений — один взгляд на твой потенциал.</p>
      <section className={styles.startPanel} aria-labelledby="start-heading">
        <div>
          <span className={styles.eyebrow}>Перед началом</span>
          <h2 id="start-heading">Твой следующий шаг</h2>
          <p>Ответь на вопросы, чтобы получить карту навыков, профессиональный профиль и персональные рекомендации.</p>
          <ul className={styles.moduleList}>
            {Object.entries(MODULE_NAMES).map(([id, label], index) => <li key={id}><span>{String(index + 1).padStart(2, '0')}</span>{label}</li>)}
          </ul>
        </div>
        <div className={styles.startAction}>
          <Clock3 size={28} aria-hidden="true" />
          <strong className={styles.duration}>60 <span>минут</span></strong>
          <p>Таймер запустится после нажатия кнопки. К любому вопросу можно вернуться до завершения теста.</p>
          <button className={styles.finishBtn} onClick={handleStart}>Начать тест <ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      </section>
      {error && <div className={styles.errorBanner} role="alert"><CircleAlert size={20} aria-hidden="true" /><p>{error}</p></div>}
    </div>
  );

  if (finished && results) return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div><p className={styles.eyebrow}>Тестирование завершено</p><h1 className={styles.title}>Разбор твоих ответов</h1></div>
        <button className={styles.finishBtn} onClick={handleRetry}><RotateCcw size={18} aria-hidden="true" />Пройти заново</button>
      </div>
      {results.timeout && <div className={styles.timeoutBanner}><Clock3 size={20} aria-hidden="true" />Время вышло. Тест завершён автоматически.</div>}
      <section className={styles.summary}>
        <div>
          <span className={styles.eyebrow}>Твой профиль</span><h2>{results.profile}</h2>
          {results.timeTaken && <p className={styles.timeTaken}><Clock3 size={16} aria-hidden="true" />Время прохождения: {results.timeTaken}</p>}
        </div>
        <dl className={styles.scoreList}>{Object.entries(results.scores).map(([mod, score]) => <div key={mod}><dt>{MODULE_NAMES[mod] || mod}</dt><dd>{score}<small> / 100</small></dd></div>)}</dl>
      </section>
      <section className={styles.advice}><p className={styles.eyebrow}>Рекомендации ИИ</p><p>{results.recommendations}</p></section>
      <div className={styles.reviewHeading}><h2>Разбор ответов</h2><span>{allQuestions.length} вопросов</span></div>
      <div className={styles.reviewList}>
        {allQuestions.map((q, idx) => {
          const userAnswer = results.userAnswers[q.id];
          const isCorrect = userAnswer === q.correct;
          return (
            <article key={q.id} className={[styles.reviewCard, isCorrect ? styles.correct : styles.wrong].join(' ')}>
              <div className={styles.reviewMeta}><span>Вопрос {String(idx + 1).padStart(2, '0')} · {MODULE_NAMES[q.module_id] || q.module_id}</span><span className={isCorrect ? styles.correctLabel : styles.wrongLabel}>{isCorrect ? <CheckCircle2 size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}{isCorrect ? 'Верно' : userAnswer === undefined ? 'Без ответа' : 'Есть ошибка'}</span></div>
              <h3>{q.text}</h3>
              <div className={styles.reviewOptions}>
                {q.options.map((opt, oi) => <div key={oi} className={[styles.reviewOption, oi === q.correct ? styles.correctOption : '', oi === userAnswer && !isCorrect ? styles.wrongOption : ''].join(' ')}><span className={styles.optionLetter}>{LETTERS[oi] || oi + 1}</span><span>{opt}</span>{oi === q.correct && <span className={styles.answerNote}><Check size={16} aria-hidden="true" />Правильный ответ</span>}{oi === userAnswer && !isCorrect && <span className={styles.answerNote}><X size={16} aria-hidden="true" />Твой ответ</span>}</div>)}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );

  const question = allQuestions[currentQuestion];
  const answeredCount = Object.keys(answers).length;
  const controlsDisabled = submitting || secondsLeft === 0;
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div><p className={styles.eyebrow}>Тестирование / {MODULE_NAMES[question.module_id] || question.module_id}</p><h1 className={styles.title}>Исследуй свои навыки</h1></div>
        <div className={[styles.timer, secondsLeft <= 60 ? styles.timerWarning : ''].join(' ')} aria-label={'Осталось ' + formatTime(secondsLeft)}><Clock3 size={20} aria-hidden="true" /><span>{formatTime(secondsLeft)}</span><small>осталось</small></div>
      </div>
      <section className={styles.testPanel}>
        <div className={styles.progressHeader}><span>Твой прогресс</span><span><strong>{answeredCount}</strong> / {allQuestions.length} ответов</span></div>
        <progress className={styles.progress} value={answeredCount} max={allQuestions.length} aria-label="Количество отвеченных вопросов" />
        <nav className={styles.progressContainer} aria-label="Навигация по вопросам">
          {allQuestions.map((q, idx) => <button key={q.id} type="button" disabled={controlsDisabled} className={[styles.dot, idx === currentQuestion ? styles.activeDot : '', answers[q.id] !== undefined && idx !== currentQuestion ? styles.answeredDot : ''].join(' ')} onClick={() => setCurrentQuestion(idx)} aria-current={idx === currentQuestion ? 'step' : undefined} aria-label={'Вопрос ' + (idx + 1) + (answers[q.id] !== undefined ? ', ответ выбран' : ', без ответа')}>{idx + 1}</button>)}
        </nav>
        <div className={styles.questionBlock}>
          <p className={styles.eyebrow}>Вопрос {String(currentQuestion + 1).padStart(2, '0')} / {allQuestions.length}</p>
          <h2>{question.text}</h2>
          <div className={styles.options}>
            {question.options.map((opt, idx) => <button key={idx} disabled={controlsDisabled} className={[styles.optionBtn, answers[question.id] === idx ? styles.selectedOption : ''].join(' ')} aria-pressed={answers[question.id] === idx} onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: idx }))}><span className={styles.optionLetter}>{LETTERS[idx] || idx + 1}</span><span>{opt}</span>{answers[question.id] === idx && <Check size={20} className={styles.selectedCheck} aria-hidden="true" />}</button>)}
          </div>
        </div>
        {error && <div className={styles.errorBanner} role="alert"><CircleAlert size={20} aria-hidden="true" /><p>{error} Ответы сохранены на этом экране.</p></div>}
        <div className={styles.footer}>
          <div className={styles.navBtns}>
            <button className={styles.navBtn} disabled={currentQuestion === 0 || controlsDisabled} onClick={() => setCurrentQuestion((p) => p - 1)}><ArrowLeft size={17} aria-hidden="true" />Назад</button>
            <button className={styles.navBtn} disabled={currentQuestion === allQuestions.length - 1 || controlsDisabled} onClick={() => setCurrentQuestion((p) => p + 1)}>Вперёд<ArrowRight size={17} aria-hidden="true" /></button>
          </div>
          <button className={styles.finishBtn} onClick={() => handleFinish(secondsLeft === 0)} disabled={submitting}><Send size={17} aria-hidden="true" />{submitting ? 'Сохраняем результаты…' : error ? 'Отправить ещё раз' : 'Завершить тест'}</button>
        </div>
      </section>
    </div>
  );
};

export default TestingPage;

