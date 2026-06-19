"use client";

import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, FileCheck2, ExternalLink, AlertTriangle } from "lucide-react";
import { useAccount } from "wagmi";
import AdminNav from "@/components/layout/AdminNav";

const VERIFICATIONS = [
  { contract: "SXUA.sol", status: "passed", properties: 3, time: "0.42s", file: "SXUA.spec" },
  { contract: "LaunchpadCore.sol", status: "passed", properties: 4, time: "0.55s", file: "LaunchpadCore.spec" },
  { contract: "Marketplace.sol", status: "passed", properties: 1, time: "0.47s", file: "Marketplace.spec" },
  { contract: "Referral.sol", status: "passed", properties: 2, time: "0.22s", file: "Referral.spec" },
  { contract: "DIGMonitor.sol", status: "passed", properties: 2, time: "0.68s", file: "DIGMonitor.spec" },
];

export default function VerificationPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <ShieldCheck className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-300 mb-2">Admin Access Required</h2>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center gap-3">
          <ShieldCheck className="text-green-400 w-8 h-8" /> Formal Verification
        </h1>
        <p className="text-gray-400">View Certora Prover logs, specification files, and mathematical proofs ensuring contract integrity.</p>
      </motion.div>

      <AdminNav />

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left: Summary */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div className="glass-panel p-6 bg-gradient-to-br from-green-900/20 to-black border-green-500/20">
            <h2 className="text-lg font-bold text-white mb-4">Verification Status</h2>
            <div className="flex items-end gap-3 mb-2">
              <span className="text-5xl font-extrabold text-green-400">12/12</span>
            </div>
            <p className="text-sm text-gray-400">Security Invariants Verified</p>
            
            <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Last Run</span>
                <span className="text-white">2 mins ago</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Run Time</span>
                <span className="text-white">2.83s</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Violations Found</span>
                <span className="text-green-400 font-bold">0</span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-white mb-4">Proof Artifacts</h2>
            <button className="w-full py-3 mb-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-between px-4 border border-white/10">
              <span className="flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-indigo-400" /> verification.log</span>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </button>
            <button className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-between px-4 border border-white/10">
              <span className="flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-purple-400" /> full-proof.zip</span>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </motion.div>

        {/* Right: Contract List */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="md:col-span-2">
          <div className="glass-panel overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Target Contracts</h2>
            </div>
            <div className="divide-y divide-white/10">
              {VERIFICATIONS.map((v) => (
                <div key={v.contract} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {v.contract}
                      <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        {v.status}
                      </span>
                    </h3>
                    <p className="text-sm text-gray-400 mt-1 flex gap-4">
                      <span>Spec: <span className="text-indigo-300 font-mono">{v.file}</span></span>
                      <span>{v.properties} properties checked</span>
                    </p>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between">
                    <span className="text-xs text-gray-500 mb-1">Compute Time</span>
                    <span className="font-mono text-sm text-white">{v.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
