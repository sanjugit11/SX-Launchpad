import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { Web3Provider } from "@/providers/Web3Provider";
import { SocketProvider } from "@/providers/SocketProvider";
import Navbar from "@/components/layout/Navbar";
import FloatingChat from "@/components/layout/FloatingChat";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SX Launchpad",
  description: "Advanced Web3 Launchpad & Trading Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-black text-white antialiased selection:bg-indigo-500/30`}>
        <Web3Provider>
          <SocketProvider>
            <div className="relative flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">
                {children}
              </main>
              <FloatingChat />
            </div>
          </SocketProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
