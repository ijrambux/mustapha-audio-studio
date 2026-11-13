import "./globals.css";

export const metadata = {
  title: "MUSTAPHA AUDIO STUDIO",
  description: "Free, open-source music and audio production studio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
