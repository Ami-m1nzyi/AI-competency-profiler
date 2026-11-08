
import * as Icons from 'lucide-react';
import styles from './Sidebar.module.css';

const Sidebar = ({ activeTab, setActiveTab, onLogout }) => {
  const menuItems = [
    { id: 'profile', label: 'Мой профиль', iconName: 'User' },
    { id: 'testing', label: 'Тестирование', iconName: 'ClipboardList' },
    { id: 'results', label: 'Результаты', iconName: 'BarChart3' },
    { id: 'settings', label: 'Настройки', iconName: 'Settings' },
  ];

  return (
    <div className={styles.sidebar}>
      <div className={styles.logo}>AI-profiler</div>
      <nav className={styles.nav}>
        {menuItems.map((item) => {
          // Ищем иконку по имени из menuItems.
          const LucideIcon = Icons[item.iconName];

          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className={styles.indicator} />
              {LucideIcon ? <LucideIcon size={22} className={styles.icon} /> : null}
              <span className={styles.label}>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <button className={styles.logoutBtn} onClick={onLogout}>
        <Icons.LogOut size={20} />
        <span className={styles.label}>Выйти</span>
      </button>
    </div>
  );
};

export default Sidebar;