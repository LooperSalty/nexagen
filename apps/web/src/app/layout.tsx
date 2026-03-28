import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "NEXAGEN — AI World Engine",
  description:
    "Décris ton monde en langage naturel, l'IA le construit en voxels 3D, et tu y joues instantanément dans ton navigateur.",
  keywords: ["voxel", "3D", "AI", "world engine", "procedural generation", "browser game"],
  authors: [{ name: "NEXAGEN" }],
  openGraph: {
    title: "NEXAGEN — AI World Engine",
    description:
      "Décris ton monde en langage naturel, l'IA le construit en voxels 3D, et tu y joues instantanément.",
    type: "website",
    locale: "fr_FR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="fr" className={`dark ${inter.variable}`}>
        <body className="min-h-screen bg-bg-primary text-text-primary antialiased font-sans">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
