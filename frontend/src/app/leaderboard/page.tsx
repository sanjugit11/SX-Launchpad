"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Award, Activity } from "lucide-react";
import { useSocket } from "@/providers/SocketProvider";

type LeaderboardEntry = {
  address: string;
  referrals: number;
  volume: number;
  score: number;
};

const INITIAL_DATA: LeaderboardEntry[] = [
  { address: "0x1a2...b3c4", referrals: 145, volume: 250000, score: 14500 },
  { address: "0x9f8...e7d6", referrals: 120, volume: 180000, score: 12000 },
  { address: "0x4b5...c6d7", referrals: 98, volume: 150000, score: 9800 },
  { address: "0x7e8...f9a0", referrals: 85, volume: 120000, score: 8500 },
  { address: "0x2c3...d4e5", referrals: 72, volume: 95000, score: 7200 },
];

export default function LeaderboardPage() {
  const { socket, isConnected } = useSocket();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    // Fetch initial leaderboard data from API
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLeaderboard(data);
        }
      })
      .catch(err => {
        console.error("Failed to fetch leaderboard stats:", err);
      });
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on("leaderboard_update", (data: LeaderboardEntry[]) => {
        setLeaderboard(data);
      });
    }
    return () => {
      if (socket) socket.off("leaderboard_update");
    };
  }, [socket]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12 relative">
        <div className="absolute top-0 right-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <Activity className={`w-4 h-4 ${isConnected ? "text-green-400" : "text-red-400"}`} />
          <span className="text-xs font-medium text-gray-300 hidden sm:inline">{isConnected ? "Live Updates" : "Connecting..."}</span>
        </div>
        
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center justify-center p-3 bg-amber-500/20 rounded-2xl mb-4 border border-amber-500/30">
            <Trophy className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
            Global <span className="text-amber-400">Leaderboard</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Top referrers across the SX ecosystem. Rankings are updated in real-time.
          </p>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-panel overflow-hidden"
      >
        <div className="grid grid-cols-12 p-4 md:p-6 border-b border-white/10 text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider bg-black/40">
          <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
          <div className="col-span-6 sm:col-span-5">Referrer</div>
          <div className="col-span-4 sm:col-span-3 text-right">Referrals</div>
          <div className="hidden sm:block col-span-3 text-right">Volume (USDC)</div>
        </div>

        <div className="divide-y divide-white/5">
          <AnimatePresence>
            {leaderboard.map((entry, index) => (
              <motion.div
                key={entry.address}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`grid grid-cols-12 p-4 md:p-6 items-center hover:bg-white/[0.02] transition-colors ${
                  index < 3 ? 'bg-gradient-to-r from-white/[0.03] to-transparent' : ''
                }`}
              >
                <div className="col-span-2 sm:col-span-1 flex justify-center">
                  {index === 0 ? <Trophy className="w-6 h-6 text-yellow-400" /> :
                   index === 1 ? <Medal className="w-6 h-6 text-gray-300" /> :
                   index === 2 ? <Medal className="w-6 h-6 text-amber-600" /> :
                   <span className="text-lg font-bold text-gray-500">#{index + 1}</span>}
                </div>
                
                <div className="col-span-6 sm:col-span-5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 hidden sm:block"></div>
                  <span className={`font-mono text-sm sm:text-base ${index < 3 ? 'text-white font-bold' : 'text-gray-300'}`}>
                    {entry.address.length > 10 
                      ? `${entry.address.substring(0, 6)}...${entry.address.substring(entry.address.length - 4)}` 
                      : entry.address}
                  </span>
                </div>
                
                <div className="col-span-4 sm:col-span-3 text-right">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                    <span className="text-white font-bold">{entry.referrals}</span>
                    <span className="text-xs text-gray-400 hidden lg:inline">users</span>
                  </span>
                </div>
                
                <div className="hidden sm:block col-span-3 text-right">
                  <span className="text-indigo-400 font-medium">
                    ${entry.volume.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
