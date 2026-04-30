import type { Metadata } from 'next';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

// Inter Display is the Cal Sans substitute per docs/design/typography.md.
// Inter_Tight is the closest available next/font/google family for "Inter Display"
// (the actual Cal Sans face is licensed and Inter Display ships as the Tight
// cut on Google Fonts). The negative letter-spacing applied per-size in the
// type scale approximates the Cal Sans look.
const interDisplay = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Middlemist',
  description: 'A freelance operations tool for solo developers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interDisplay.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
