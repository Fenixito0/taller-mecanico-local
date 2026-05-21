import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata = {
  title: "Taller Mecánico — Sistema de Gestión",
  description: "Sistema de gestión para taller mecánico",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${barlow.variable} ${barlowCondensed.variable}`}>
        {children}
      </body>
    </html>
  );
}
