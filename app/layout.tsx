// app/layout.tsx
import './globals.css';

export const metadata = { title: 'NeedMe' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: 'system-ui, Arial' }}>{children}</body>
    </html>
  );
}
