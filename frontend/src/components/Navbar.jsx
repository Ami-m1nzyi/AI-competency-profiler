import { UserRound, LogOut } from 'lucide-react';
import AsciiStar from './AsciiStar';
import styles from './Sidebar.module.css';
const items = [
 {id:'profile',label:'Мой профиль',roles:['student','teacher']},
 {id:'testing',label:'Тестирование',roles:['student']},
 {id:'results',label:'Результаты',roles:['student']},
 {id:'requests',label:'Запросы',roles:['admin']},
 {id:'activity',label:'Активность',roles:['admin']},
 {id:'settings',label:'Настройки',roles:['student','teacher','admin']}
];
export default function Navbar({activeTab,setActiveTab,onLogout,userRole,user}) {
 return <header className={styles.navbar}>
  <a href="#main" className="skip-link">Перейти к содержимому</a>
  <button className={styles.logo} onClick={()=>setActiveTab(userRole==='admin'?'requests':'profile')} aria-label="AI-profiler — главная"><AsciiStar className={styles.logoMark}/><span>AI-profiler</span></button>
  <nav className={styles.nav} aria-label="Основная навигация">{items.filter(item=>item.roles.includes(userRole)).map(item=><button key={item.id} className={`${styles.navItem} ${activeTab===item.id?styles.active:''}`} aria-current={activeTab===item.id?'page':undefined} onClick={()=>setActiveTab(item.id)}>{item.label}</button>)}</nav>
  <div className={styles.account}><UserRound size={21} aria-hidden="true"/><span title={user?.name}>{user?.first_name||user?.name||'Личный кабинет'}</span><button className={styles.logoutBtn} onClick={onLogout} aria-label="Выйти из аккаунта" title="Выйти"><LogOut size={19}/></button></div>
 </header>;
}