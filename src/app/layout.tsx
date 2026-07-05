import type { Metadata } from "next";
import { Spectral, IBM_Plex_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "../styles/globals.css";
import "./site.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import MicrosoftClarity from "@/components/MicrosoftClarity";

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Enrico Mattia Salonia",
  description: "Enrico Mattia Salonia's personal website",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spectral.variable} ${mono.variable}`}>
      <head>
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-J54HJ5FRD8"
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-J54HJ5FRD8');
            `,
          }}
        />
        <link rel="icon" href="/img/jackie.png" />
      </head>
      <body>
        <MicrosoftClarity />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
