"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Rocket, Wallet, LogOut, ChevronDown, ShieldAlert } from "lucide-react";
import { useSocket } from "@/providers/SocketProvider";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

const NAV_LINKS = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Buy Stables", href: "/buy-stables" },
  { name: "Launchpad", href: "/launchpad" },
  { name: "Marketplace", href: "/marketplace" },
  { name: "Social", href: "/referral" },
  { name: "Admin", href: "/admin/governance" },
];

function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="w-36 h-9 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
    );
  }

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-sm font-medium text-white transition-all"
        >
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {address.slice(0, 6)}...{address.slice(-4)}
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
        {showMenu && (
          <div className="absolute right-0 mt-2 w-44 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-xl z-50">
            <button
              onClick={() => { disconnect(); setShowMenu(false); }}
              className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20"
    >
      <Wallet className="w-4 h-4" /> Connect Wallet
    </button>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { isConnected } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [isSystemPaused, setIsSystemPaused] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setIsSystemPaused(data.status === "PAUSED");
        }
      } catch (err) {
        console.error("Failed to check health:", err);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {isSystemPaused && !pathname.startsWith('/admin') && (
        <div className="bg-red-500/20 border-b border-red-500/30 text-red-200 text-center py-2.5 px-4 text-xs font-mono tracking-wider flex items-center justify-center gap-2 backdrop-blur-md relative z-50 animate-pulse">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span>[ALERT] SYSTEM PAUSED BY EMERGENCY MULTISIG GOVERNANCE - TRANSACTION FLOWS SUSPENDED</span>
        </div>
      )}
      <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="bg-indigo-600 p-2 rounded-xl group-hover:bg-indigo-500 transition-colors">
                <Rocket className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                SX Launchpad
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex space-x-1 items-center">
            {NAV_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Right section: Socket Status & Wallet */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
              <span className="relative flex h-2 w-2">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-green-500" : "bg-red-500"}`}></span>
              </span>
              {isConnected ? "Live" : "Offline"}
            </div>
            <WalletButton />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-400 hover:text-white p-2"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-xl border-b border-white/10">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname.startsWith(link.href)
                    ? "bg-indigo-600 text-white"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <div className="pt-4 pb-2 border-t border-white/10">
              <WalletButton />
            </div>
          </div>
        </div>
      )}
    </nav>
    </>
  );
}
