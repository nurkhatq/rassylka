import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kaspi Calling Tool',
  description: 'Merchant calling management tool',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
