"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, AlertOctagon, Lock, Activity, ServerOff } from "lucide-react";
import { useAccount } from "wagmi";
import AdminNav from "@/components/layout/AdminNav";

interface Attempt {
  id: string;
  wallet: string | null;
  ip: string | null;
  pattern: string;
  timestamp: string;
}

interface PatternConfig {
  name: string;
  severity: string;
  description: string;
  action: string;
}

interface Stats {
  totalAttempts: number;
  activeLockouts: number;
  rateLimitedIPs: number;
  systemIntegrity: string;
  config?: {
    globalRateLimit: number;
    autoBanThreshold: number;
    jailbreakDetection: string;
    patterns: PatternConfig[];
  };
}

export default function JailbreakPage() {
  const { isConnected } = useAccount();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalAttempts: 0,
    activeLockouts: 0,
    rateLimitedIPs: 0,
    systemIntegrity: "100%",
    config: {
      globalRateLimit: 100,
      autoBanThreshold: 5,
      jailbreakDetection: "ACTIVE",
      patterns: [],
    },
  });
  const [loading, setLoading] = useState(true);

  const [demoMode, setDemoMode] = useState(false);

  const fetchData = async () => {
    try {
      const [attemptsRes, statsRes] = await Promise.all([
        fetch("/api/admin/jailbreak/attempts"),
        fetch("/api/admin/jailbreak/stats"),
      ]);

      if (attemptsRes.ok && statsRes.ok) {
        const attemptsData = await attemptsRes.json();
        const statsData = await statsRes.json();
        setAttempts(attemptsData);
        setStats(statsData);
      }
    } catch (error) {
      console.error("Failed to fetch security logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isConnected && !demoMode) return;
    
    // Initial fetch
    fetchData();

    // Poll every 4 seconds for real-time monitoring
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [isConnected, demoMode]);

  if (!isConnected && !demoMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-gray-300 mb-2">Security Clearance Required</h2>
        <p className="text-gray-500 text-sm mb-6">Please connect your wallet to access the Admin Panel.</p>
        <button
          onClick={() => {
            setDemoMode(true);
            fetchData();
          }}
          className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-indigo-600 hover:from-red-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-red-500/20"
        >
          Enter Demo Mode (Bypass Wallet Check)
        </button>
      </div>
    );
  }

  // Calculate if a specific attempt belongs to an IP/Wallet that is currently locked out
  const isAddressLockedOut = (ip: string | null, wallet: string | null) => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    
    // Filter attempts in last 10 minutes matching ip or wallet
    const recentFromSource = attempts.filter((a) => {
      const matchIp = ip && a.ip === ip;
      const matchWallet = wallet && a.wallet === wallet;
      const isRecent = new Date(a.timestamp).getTime() >= tenMinutesAgo;
      return (matchIp || matchWallet) && isRecent;
    });

    return recentFromSource.length >= 5;
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center gap-3">
          <AlertOctagon className="text-red-500 w-8 h-8" /> Threat Intelligence
        </h1>
        <p className="text-gray-400">Real-time monitoring of jailbreak attempts, exploit patterns, and automated defense mechanisms.</p>
      </motion.div>

      <AdminNav />

      {/* Top Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        {[
          { title: "Total Attempts (24h)", value: stats.totalAttempts.toString(), icon: Activity, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
          { title: "Active Lockouts", value: stats.activeLockouts.toString(), icon: Lock, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
          { title: "Rate Limited IPs", value: stats.rateLimitedIPs.toString(), icon: ServerOff, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
          { title: "System Integrity", value: stats.systemIntegrity, icon: ShieldAlert, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
        ].map((stat, i) => (
          <motion.div 
            key={stat.title}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className={`glass-panel p-6 ${stat.bg} border`}
          >
            <div className="flex justify-between items-start mb-4">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <p className="text-sm text-gray-400 mb-1">{stat.title}</p>
            <h3 className="text-3xl font-bold text-white">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left: Logs */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2 glass-panel overflow-hidden">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
            <h2 className="text-xl font-bold text-white">Security Event Logs</h2>
            <span className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold border border-red-500/30">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              Live Tracking Active
            </span>
          </div>
          
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-gray-400">Loading live security logs...</div>
            ) : attempts.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No security events logged in registry.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-xs text-gray-400 uppercase tracking-wider border-b border-white/10">
                    <th className="p-4 font-medium">Event ID</th>
                    <th className="p-4 font-medium">Source</th>
                    <th className="p-4 font-medium">Attack Vector</th>
                    <th className="p-4 font-medium">Target</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {attempts.map((evt) => {
                    const isLocked = isAddressLockedOut(evt.ip, evt.wallet);
                    
                    return (
                      <tr key={evt.id} className="hover:bg-white/5 transition-colors text-sm">
                        <td className="p-4 font-mono text-gray-400 text-xs">
                          {evt.id.substring(0, 8)}...
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-white font-medium">{evt.ip || "unknown"}</span>
                            <span className="text-xs text-gray-500 font-mono">
                              {evt.wallet ? `${evt.wallet.slice(0, 6)}...${evt.wallet.slice(-4)}` : "no-wallet"}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-red-400 font-medium">Jailbreak Attempt</span>
                            <span className="text-xs text-gray-500">
                              Pattern: <span className="font-semibold text-gray-300">{evt.pattern}</span>
                            </span>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-indigo-300 text-xs">/api/ai/chat</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                            isLocked ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          }`}>
                            {isLocked ? 'Locked Out' : 'Blocked'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>

        {/* Right: Patterns & Config */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-white mb-4">Detected Patterns</h2>
            <div className="space-y-4">
              {stats.config?.patterns && stats.config.patterns.length > 0 ? (
                stats.config.patterns.map((pattern, index) => (
                  <div key={index} className="bg-white/5 border border-white/10 p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-bold text-white">{pattern.name}</h3>
                      <span className={`text-xs ${
                        pattern.severity === "Critical" ? "text-red-400" : "text-amber-400"
                      }`}>{pattern.severity}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{pattern.description}</p>
                    <div className="flex justify-between text-[10px] text-gray-500 border-t border-white/5 pt-2">
                      <span>Sensitivity: High</span>
                      <span>Action: {pattern.action}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-500 text-center py-4">No patterns configured.</div>
              )}
            </div>
          </div>

          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-white mb-4">Active Countermeasures</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/5">
                <span className="text-sm text-gray-300">Global Rate Limit (Req/s)</span>
                <span className="text-sm font-bold text-white">{stats.config?.globalRateLimit || 100}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/5">
                <span className="text-sm text-gray-300">Auto-Ban Threshold</span>
                <span className="text-sm font-bold text-white">{stats.config?.autoBanThreshold || 5} Violations</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/5">
                <span className="text-sm text-gray-300">Jailbreak Detection</span>
                <span className={`text-xs px-2 py-1 rounded-md font-bold ${
                  stats.config?.jailbreakDetection === "ACTIVE" 
                    ? "bg-green-500/20 text-green-400" 
                    : "bg-red-500/20 text-red-400"
                }`}>{stats.config?.jailbreakDetection || "ACTIVE"}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
