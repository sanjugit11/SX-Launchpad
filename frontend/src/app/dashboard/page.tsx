"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, Lock, Unlock, TrendingUp, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { SXUA_ABI, ERC20_ABI } from "@/lib/contracts";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  
  const [amount, setAmount] = useState("10000");
  const [split, setSplit] = useState(70);
  
  const [unifiedBalance, setUnifiedBalance] = useState("$0.00");
  const [committedBalance, setCommittedBalance] = useState("$0.00");
  const [uncommittedBalance, setUncommittedBalance] = useState("$0.00");

  const sxpAddress = process.env.NEXT_PUBLIC_SXP_ADDRESS as `0x${string}`;

  // Fetch SXP balance
  const { data: sxpBalanceRaw } = useReadContract({
    address: sxpAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!sxpAddress }
  });

  const sxpBalance = sxpBalanceRaw !== undefined ? parseFloat(formatUnits(sxpBalanceRaw as bigint, 18)) : 0;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const fetchBalances = async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/account/balance?user=${address}`);
      const data = await res.json();
      if (data && data.totalCommitted !== undefined) {
        setCommittedBalance(`$${Number(data.totalCommitted).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
        setUncommittedBalance(`$${Number(data.totalUncommitted).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
        const total = Number(data.totalCommitted) + Number(data.totalUncommitted);
        setUnifiedBalance(`$${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
      }
    } catch (e:any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [address]);

  useEffect(() => {
    if (isConfirmed) {
      fetchBalances();
    }
  }, [isConfirmed]);

  const handleApprove = () => {
    if (!amount) return;
    writeContract({
      chainId: 560048,
      address: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [process.env.NEXT_PUBLIC_SXUA_ADDRESS as `0x${string}`, parseUnits(amount, 18)],
    });
  };

  const handleDeposit = () => {
    if (!amount) return;
    writeContract({
      chainId: 560048,
      address: process.env.NEXT_PUBLIC_SXUA_ADDRESS as `0x${string}`,
      abi: SXUA_ABI,
      functionName: 'depositWithSplit',
      args: [process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`, parseUnits(amount, 18), BigInt(split)],
      gas: 300000n,
    });
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5 }
    })
  };

  if (!mounted) return null;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <Wallet className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-300 mb-2">Connect Wallet</h2>
        <p className="text-gray-500 text-center max-w-md">
          Please connect your wallet using the button in the top right to access your SX Unified Account dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
          SX Unified Account
        </h1>
        <p className="text-gray-400">Manage your deposits, track committed funds, and watch your yield grow.</p>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { title: "Unified Balance", value: unifiedBalance, icon: Wallet, color: "text-blue-400" },
          { title: "Committed", value: committedBalance, icon: Lock, color: "text-purple-400" },
          { title: "Uncommitted", value: uncommittedBalance, icon: Unlock, color: "text-green-400" },
          { title: "SXP Balance", value: sxpBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }), icon: TrendingUp, color: "text-amber-400", isDynamic: true },
        ].map((stat, i) => (
          <motion.div
            key={stat.title}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="glass-panel p-6 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <stat.icon className={`w-16 h-16 ${stat.color}`} />
            </div>
            <p className="text-sm font-medium text-gray-400 mb-2">{stat.title}</p>
            <h3 className={`text-3xl font-bold ${stat.isDynamic ? "premium-gradient-text" : "text-white"}`}>
              {stat.value}
            </h3>
          </motion.div>
        ))}
      </div>

      {/* Action Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sub-Accounts List (2/3 width) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass-panel p-6"
        >
          <h2 className="text-xl font-bold text-white mb-6">Committed Sub-Accounts</h2>
          <div className="space-y-4">
            {[1, 2].map((id) => (
              <div key={id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/10 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-1 rounded-md font-medium">
                      Sub-Account #{id}
                    </span>
                    <span className="text-xs text-gray-400">Locked 100 Days</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-white">$15,000</span>
                    <span className="text-sm text-gray-500">USDC</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-xs text-gray-400">Accrued Yield</p>
                    <p className="text-sm font-semibold text-amber-400">+62.25 SXP</p>
                  </div>
                  <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors">
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Deposit/Withdraw Form (1/3 width) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-panel p-1"
        >
          <div className="flex p-1 bg-white/5 rounded-t-xl mb-4">
            <button 
              onClick={() => setActiveTab("deposit")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'deposit' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              <ArrowDownToLine className="w-4 h-4" /> Deposit
            </button>
            <button 
              onClick={() => setActiveTab("withdraw")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'withdraw' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              <ArrowUpFromLine className="w-4 h-4" /> Withdraw
            </button>
          </div>
          
          <div className="p-5 pt-0">
            {activeTab === "deposit" ? (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Amount (USDC)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="10000" 
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button onClick={() => setAmount("10000")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-400 font-medium hover:text-indigo-300">
                      MAX
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Commitment Split (%)</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={split}
                    onChange={(e) => setSplit(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0% (Flexible)</span>
                    <span className="text-white font-bold">{split}% Committed</span>
                    <span>100% (Locked)</span>
                  </div>
                </div>
                
                {isPending ? (
                  <button disabled className="w-full py-3 px-4 bg-indigo-600/50 text-white font-bold rounded-xl shadow-lg transition-all">
                    Awaiting Wallet Signature...
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={handleApprove}
                      disabled={isPending || isConfirming}
                      className="w-1/2 py-3 px-4 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02]">
                      1. Approve USDC
                    </button>
                    <button 
                      onClick={handleDeposit}
                      disabled={isPending || isConfirming}
                      className="w-1/2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02]">
                      2. Deposit
                    </button>
                  </div>
                )}
                {isConfirmed && <p className="text-green-400 text-xs text-center">Transaction confirmed!</p>}
                <p className="text-center text-xs text-gray-500 mt-2">
                  0.5% PTF Fee applies to all deposits.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                 <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Sub-Account ID</label>
                  <select className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    <option>Sub-Account #1 ($15,000)</option>
                    <option>Sub-Account #2 ($15,000)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Amount to Withdraw</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-400 font-medium hover:text-indigo-300">
                      MAX
                    </button>
                  </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-xs text-red-400 flex items-start gap-2">
                    <span className="mt-0.5">⚠️</span> 
                    Early withdrawal from committed funds incurs a 10% penalty to SXMM.
                  </p>
                </div>
                <button className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all">
                  Withdraw Funds
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
