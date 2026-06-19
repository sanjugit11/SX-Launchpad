"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Users, Gift, Share2, Award, QrCode, UserPlus, Link, AlertCircle, Loader2 } from "lucide-react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits } from "viem";
import { useSearchParams } from "next/navigation";
import { REFERRAL_ABI, ERC20_ABI } from "@/lib/contracts";

function ReferralContent() {
  const { isConnected, address } = useAccount();
  const searchParams = useSearchParams();
  const refCodeParam = searchParams.get("ref");

  const [mounted, setMounted] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [copied, setCopied] = useState(false);
  
  // Stats state
  const [stats, setStats] = useState({
    totalInvites: 0,
    successful: 0,
    rank: 0
  });

  const referralAddress = process.env.NEXT_PUBLIC_REFERRAL_ADDRESS as `0x${string}`;
  const sxpAddress = process.env.NEXT_PUBLIC_SXP_ADDRESS as `0x${string}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Fetch User Code
  const { data: userCode, refetch: refetchUserCode } = useReadContract({
    address: referralAddress,
    abi: REFERRAL_ABI,
    functionName: "referrerToCode",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!referralAddress }
  });

  // 2. Fetch User Referrer (to check if already referred)
  const { data: referrerAddress, refetch: refetchReferrer } = useReadContract({
    address: referralAddress,
    abi: REFERRAL_ABI,
    functionName: "userToReferrer",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!referralAddress }
  });

  // 3. Fetch SXP Balance
  const { data: sxpBalanceRaw, refetch: refetchSxp } = useReadContract({
    address: sxpAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!sxpAddress }
  });

  const sxpBalance = sxpBalanceRaw !== undefined ? parseFloat(formatUnits(sxpBalanceRaw as bigint, 18)) : 0;

  // 4. Fetch DB stats
  const fetchStats = async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/referral/stats?user=${address}`);
      const data = await res.json();
      if (!data.error) {
        setStats(data);
      }
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  useEffect(() => {
    if (address) {
      fetchStats();
    }
  }, [address]);

  // Write contract hook
  const { writeContract, data: txHash, isPending: isTxSending, error: txError } = useWriteContract();

  // Wait for tx confirmation
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Refetch states when a transaction completes
  useEffect(() => {
    if (isTxSuccess) {
      refetchUserCode();
      refetchReferrer();
      refetchSxp();
      fetchStats();
      setCustomCode("");
    }
  }, [isTxSuccess]);

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode.trim()) return;
    
    writeContract({
      address: referralAddress,
      abi: REFERRAL_ABI,
      functionName: "createReferral",
      args: [customCode.trim()],
    });
  };

  const handleApplyReferral = async () => {
    if (!refCodeParam) return;
    writeContract({
      address: referralAddress,
      abi: REFERRAL_ABI,
      functionName: "completeReferral",
      args: [refCodeParam],
    });
  };

  const referralLink = typeof window !== "undefined" && userCode 
    ? `${window.location.origin}/referral?ref=${userCode}` 
    : "";

  const copyToClipboard = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Determine referral relationship state
  const isAlreadyReferred = referrerAddress && referrerAddress !== "0x0000000000000000000000000000000000000000";
  const canApplyReferral = refCodeParam && !isAlreadyReferred && address;

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
          Invite & <span className="premium-gradient-text">Earn</span>
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Share your unique link. Earn 100 SXP for both you and your friend once they deposit $500 or more.
        </p>
      </motion.div>

      {!isConnected && (
        <div className="glass-panel p-8 text-center max-w-md mx-auto mb-10">
          <AlertCircle className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400 text-sm mb-6">
            Please connect your MetaMask wallet to view your referral codes, track invites, and claim SXP rewards.
          </p>
        </div>
      )}

      {isConnected && (
        <div className="grid md:grid-cols-5 gap-8">
          {/* Left Panel: Referral Code Management & Applying Codes */}
          <div className="md:col-span-3 space-y-6">
            
            {/* 1. Apply Invitation Section (if URL contains ref param and user hasn't been referred) */}
            {canApplyReferral && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="glass-panel p-6 border-amber-500/30 bg-amber-500/5"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-xl shrink-0">
                    <UserPlus className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">Apply Invitation</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      You were invited by code <span className="text-amber-400 font-mono font-bold">{refCodeParam}</span>. Register now to claim your SXP reward when you deposit!
                    </p>
                    
                    <button
                      onClick={handleApplyReferral}
                      disabled={isTxSending || isTxConfirming}
                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {(isTxSending || isTxConfirming) && <Loader2 className="w-4 h-4 animate-spin" />}
                      Register Referral
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. Referral Link Section */}
            <div className="glass-panel p-8">
              {!userCode ? (
                // Register code form
                <form onSubmit={handleCreateCode} className="space-y-4">
                  <h2 className="text-xl font-bold text-white mb-2">Create Referral Code</h2>
                  <p className="text-gray-400 text-sm mb-4">
                    Choose a unique alphanumeric code to start inviting your friends.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="e.g. crypto_whale"
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                      maxLength={20}
                      disabled={isTxSending || isTxConfirming}
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={isTxSending || isTxConfirming || !customCode.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(isTxSending || isTxConfirming) && <Loader2 className="w-4 h-4 animate-spin" />}
                      Generate Code
                    </button>
                  </div>
                </form>
              ) : (
                // Display referral link
                <div>
                  <h2 className="text-xl font-bold text-white mb-6">Your Referral Link</h2>
                  <div className="flex items-center gap-2 mb-8">
                    <div className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-indigo-300 font-mono text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                      {referralLink}
                    </div>
                    <button 
                      onClick={copyToClipboard}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-colors flex items-center justify-center shrink-0"
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>

                  <h3 className="text-sm font-medium text-gray-400 mb-4">Share via</h3>
                  <div className="flex gap-4">
                    <a 
                      href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Join%20me%20on%20SX%20Launchpad%20and%20earn%20SXP!`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" /> Telegram
                    </a>
                    <a 
                      href={`https://twitter.com/intent/tweet?text=Join%20me%20on%20SX%20Launchpad%20and%20earn%20SXP!%20${encodeURIComponent(referralLink)}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" /> X (Twitter)
                    </a>
                  </div>
                </div>
              )}

              {/* Status indicator */}
              <AnimatePresence>
                {(txError || isTxSuccess) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: "auto" }} 
                    exit={{ opacity: 0, height: 0 }} 
                    className="mt-4"
                  >
                    {txError && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Transaction failed: {txError.message || "Unknown error"}</span>
                      </div>
                    )}
                    {isTxSuccess && (
                      <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-2">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>Transaction confirmed successfully!</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* QR Code */}
            {userCode && (
              <div className="glass-panel p-8 flex items-center gap-8">
                <div className="w-32 h-32 bg-white rounded-xl p-2 flex items-center justify-center shrink-0">
                  <QrCode className="w-full h-full text-black" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">QR Code</h3>
                  <p className="text-gray-400 text-sm">
                    Let your friends scan this QR code directly from your device to automatically apply your referral code <span className="text-indigo-400 font-bold">{userCode}</span>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Rewards & Stats */}
          <div className="md:col-span-2 space-y-6">
            
            {/* SXP Rewards Display */}
            <div className="glass-panel p-6 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/30">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Gift className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-lg font-bold text-white">SXP Balance</h2>
              </div>
              <p className="text-4xl font-extrabold text-white mb-1">
                {sxpBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                <span className="text-xl text-indigo-300">SXP</span>
              </p>
              <p className="text-sm text-indigo-400/80">Minted instantly to your wallet</p>
            </div>

            {/* Referral Statistics */}
            <div className="glass-panel p-6">
              <h2 className="text-lg font-bold text-white mb-4">Referral Stats</h2>
              <div className="space-y-4">
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-3 text-gray-300">
                    <Users className="w-5 h-5 text-gray-400" />
                    <span>Total Invites</span>
                  </div>
                  <span className="text-xl font-bold text-white">{stats.totalInvites}</span>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-3 text-gray-300">
                    <Check className="w-5 h-5 text-green-400" />
                    <span>Successful</span>
                  </div>
                  <span className="text-xl font-bold text-white">{stats.successful}</span>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-3 text-gray-300">
                    <Award className="w-5 h-5 text-amber-400" />
                    <span>Rank</span>
                  </div>
                  <span className="text-xl font-bold text-white">
                    {stats.rank > 0 ? `#${stats.rank}` : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReferralPage() {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    }>
      <ReferralContent />
    </React.Suspense>
  );
}
