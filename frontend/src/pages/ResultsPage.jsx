import { ArrowRight, ChartNoAxesCombined, Clock3, RotateCcw, Sparkles } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis, Tooltip } from 'recharts';
import styles from './ResultsPage.module.css';

const MODULE_NAMES = { algo: 'Алгоритмы', coding: 'Кодинг', design: 'Дизайн', entrepreneur: 'Бизнес', teamwork: 'Команда' };

const ResultsPage = ({ results, onStartTest }) => {
  if (!results) return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>Карта компетенций</p>
      <h1 className={styles.title}>Твои результаты</h1>
      <section className={styles.emptyState}>
        <ChartNoAxesCombined size={40} strokeWidth={1.5} aria-hidden="true" />
        <h2>Первый шаг — узнать себя</h2>
        <p>Пройди тест по пяти направлениям. Здесь появятся твои сильные стороны, профессиональный профиль и рекомендации ИИ.</p>
        {onStartTest ? <button className={styles.primaryButton} onClick={onStartTest}>Пройти тест <ArrowRight size={18} aria-hidden="true" /></button> : <p>Перейди во вкладку «Тестирование», чтобы начать.</p>}
      </section>
    </div>
  );

  const chartData = Object.entries(MODULE_NAMES).map(([key, subject]) => ({
    subject, value: Number(results.scores[key]) || 0,
  }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Результаты тестирования</p><h1 className={styles.title}>Твоя карта компетенций</h1></div>
        {onStartTest && <button className={styles.secondaryButton} onClick={onStartTest}><RotateCcw size={16} aria-hidden="true" />К тестированию</button>}
      </header>
      <section className={styles.profileHeader}>
        <div><p className={styles.eyebrow}>Твой профиль</p><h2>{results.profile}</h2></div>
        {results.timeTaken && <p className={styles.timeTaken}><Clock3 size={18} aria-hidden="true" />Время прохождения <strong>{results.timeTaken}</strong></p>}
      </section>
      <div className={styles.layout}>
        <section className={styles.chartSection} aria-labelledby="skills-heading">
          <h2 id="skills-heading" className={styles.sectionTitle}>Пять направлений развития</h2>
          <div className={styles.chartWrapper} role="img" aria-label={chartData.map((item) => item.subject + ': ' + item.value + ' из 100').join(', ')}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 350, height: 350 }}>
              <RadarChart cx="50%" cy="50%" outerRadius="68%" data={chartData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" stroke="var(--text-main)" tick={{ fontSize: 12, fontWeight: 600 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Баллы" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="var(--accent-strong)" fillOpacity={0.3} dot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }} isAnimationActive={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-main)' }} itemStyle={{ color: 'var(--accent)' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <dl className={styles.scoreList}>
            {chartData.map((item) => <div key={item.subject}><div className={styles.scoreLabel}><dt>{item.subject}</dt><dd>{item.value}<small> / 100</small></dd></div><progress value={item.value} max="100" aria-label={item.subject} /></div>)}
          </dl>
        </section>
        <section className={styles.recommendations} aria-labelledby="recommendations-heading">
          <p className={styles.eyebrow}><Sparkles size={16} aria-hidden="true" />Персональный разбор</p>
          <h2 id="recommendations-heading">Рекомендации ИИ</h2>
          <p className={styles.adviceText}>{results.recommendations || 'Рекомендации пока не получены.'}</p>
        </section>
      </div>
    </div>
  );
};

export default ResultsPage;

