import {useState,useEffect} from 'react';
import {ThemeContext} from './theme-context';
export function ThemeProvider({children}) {
 const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('profiler-theme')==='light'?'light':'dark'}catch{return 'dark'}});
 useEffect(()=>{document.documentElement.setAttribute('data-theme',theme);try{localStorage.setItem('profiler-theme',theme)}catch{/* Theme remains usable when storage is unavailable. */}},[theme]);
 return <ThemeContext.Provider value={{theme,toggleTheme:()=>setTheme(value=>value==='dark'?'light':'dark')}}>{children}</ThemeContext.Provider>;
}