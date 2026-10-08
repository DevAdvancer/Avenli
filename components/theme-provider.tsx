'use client';
import { ThemeProvider as Provider } from 'next-themes';
export default function ThemeProvider({children}:{children:React.ReactNode}) {
  return <Provider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="avenli-theme" disableTransitionOnChange>{children}</Provider>;
}
