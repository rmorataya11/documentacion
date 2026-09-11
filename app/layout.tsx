import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Conversor de Documentación API",
  description:
    "Convierte tu documentación técnica al formato estándar de Davivienda, en Word o PDF",
  icons: {
    icon: [{ url: "/icon/freir.png", type: "image/png" }],
    shortcut: "/icon/freir.png",
    apple: "/icon/freir.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-surface-dark text-foreground">
        {children}
      </body>
    </html>
  );
}
