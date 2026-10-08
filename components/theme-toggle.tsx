'use client';
import {Moon,Sun} from 'lucide-react';
import {useTheme} from 'next-themes';
export default function ThemeToggle(){const {resolvedTheme,setTheme}=useTheme();return <button className="theme-toggle" aria-label="Toggle light or dark theme" title="Switch color theme" onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}><Sun className="theme-sun" size={17}/><Moon className="theme-moon" size={17}/><span className="theme-sun">Light mode</span><span className="theme-moon">Dark mode</span></button>}
