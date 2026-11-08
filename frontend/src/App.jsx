import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import TeacherProfilePage from './pages/TeacherProfilePage';
import AdminPage from './pages/AdminPage';
import TestingPage from './pages/TestingPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';
import ActivityStats from './pages/ActivityStats';
import { trackEvent } from './activity';
import { ThemeProvider } from './context/ThemeContext';
import './styles/theme.css';
import './App.css';

const API = '';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [lastResults, setLastResults] = useState(null);

  const handleLogin = async (role, data) => {
    setUserRole(role);
    setUserData(data);
    setIsAuthenticated(true);
    setActiveTab(role === 'admin' ? 'requests' : 'profile');

    if (role === 'student') {
      try {
        const res = await fetch(`${API}/api/results/my/${data.id}`);
        if (res.ok) {
          const result = await res.json();
          setLastResults({
            scores: {
              algo:         result.algo,
              coding:       result.coding,
              design:       result.design,
              entrepreneur: result.entrepreneur,
              teamwork:     result.teamwork,
            },
            profile:         result.profile,
            recommendations: result.recommendations,
            timeTaken:       result.time_taken || null,
          });
        }
      } catch {
        console.log('Результатов пока нет');
      }
    }
  };

  // Статистика активности: какие экраны открывает студент.
  // Тестирование считаем «расписанием», результаты с рекомендациями ИИ — «ботом».
  useEffect(() => {
    if (!isAuthenticated || userRole !== 'student' || !userData) return;
    if (activeTab === 'testing') trackEvent('schedule_view', userData.id);
    if (activeTab === 'results') trackEvent('bot_interaction', userData.id);
  }, [activeTab, isAuthenticated, userRole, userData]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // The screen still returns to sign-in if the connection is unavailable.
    }
    setIsAuthenticated(false);
    setUserRole(null);
    setUserData(null);
    setLastResults(null);
    setActiveTab('profile');
  };

  if (!isAuthenticated) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        userRole={userRole}
        user={userData}
      />
      <main className="main-content" id="main" tabIndex={-1}>
        {activeTab === 'profile' && (
          userRole === 'teacher'
            ? <TeacherProfilePage user={userData} />
            : <ProfilePage user={userData} results={lastResults} onStartTest={() => setActiveTab('testing')} onViewResults={() => setActiveTab('results')} />
        )}
        {activeTab === 'requests' && userRole === 'admin' && (
          <AdminPage user={userData} />
        )}
        {activeTab === 'activity' && userRole === 'admin' && (
          <ActivityStats adminId={userData.id} />
        )}
        {activeTab === 'testing' && userRole === 'student' && (
          <TestingPage
            user={userData}
            onResultsReady={(results) => {
              setLastResults({
                scores:          results.scores,
                profile:         results.profile,
                recommendations: results.recommendations,
                timeTaken:       results.timeTaken || null,
              });
              setActiveTab('results');
            }}
          />
        )}
        {activeTab === 'results' && userRole === 'student' && (
          <ResultsPage results={lastResults} onStartTest={() => setActiveTab('testing')} />
        )}
        {activeTab === 'settings' && (
          <SettingsPage user={userData} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
