"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, ShieldCheck, CheckCircle2, AlertTriangle, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useReadContract } from "wagmi";
import { parseEther } from "viem";
import { BUY_STABLES_PORTAL_ABI } from "@/lib/contracts";

const HOODI_CHAIN_ID = 560048;

export default function BuyStablesPage() {
  const { isConnected, address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [amount, setAmount] = useState("");
  const [usdcGross, setUsdcGross] = useState("");
  const [currency, setCurrency] = useState("ETH");
  const [showModal, setShowModal] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const [isSxseRegistered, setIsSxseRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [quoteBreakdown, setQuoteBreakdown] = useState<{
    grossAmount: number;
    fees: {
      sxseFee: number;
      portalFee: number;
      ptfFee: number;
      networkFee: number;
    };
    netAmount: number;
  } | null>(null);

  // Read SXSE registration status on-chain
  const { data: isSxseOnChain, refetch: refetchSxse } = useReadContract({
    address: process.env.NEXT_PUBLIC_BUY_STABLES_PORTAL as `0x${string}`,
    abi: BUY_STABLES_PORTAL_ABI,
    functionName: "isSXSE",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const exchangeRate = 30000000; // 1 ETH = 30,000,000 USDC

  const checkRegistration = async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/stables/registration-status?wallet=${address}`);
      const data = await res.json();
      setIsSxseRegistered(data.registered);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (address) {
      if (isSxseOnChain !== undefined) {
        setIsSxseRegistered(!!isSxseOnChain);
      } else {
        checkRegistration();
      }
    }
  }, [isSxseOnChain, address]);

  // Update error state when writeError changes
  useEffect(() => {
    if (writeError) {
      const msg = writeError.message || "Transaction failed";
      const match = msg.match(/reason:\s*(.+?)(\n|$)/);
      setTxError(match ? match[1] : msg.split("\n")[0]);
    }
  }, [writeError]);

  useEffect(() => {
    if (isConfirmed) {
      setShowModal(false);
      setAmount("");
      setUsdcGross("");
      setQuoteBreakdown(null);
      setTxError(null);
    }
  }, [isConfirmed]);

  const fetchQuote = async (gross: number) => {
    try {
      const res = await fetch(`/api/stables/quote?amount=${gross}`);
      const data = await res.json();
      if (data && data.netAmount !== undefined) {
        setQuoteBreakdown(data);
      }
    } catch (err) {
      console.error("Quote fetch error:", err);
    }
  };

  const handleEthChange = (val: string) => {
    setAmount(val);
    if (!val || parseFloat(val) <= 0) {
      setUsdcGross("");
      setQuoteBreakdown(null);
      return;
    }
    const gross = parseFloat(val) * exchangeRate;
    setUsdcGross(gross.toString());
    fetchQuote(gross);
  };

  const handleUsdcChange = (val: string) => {
    setUsdcGross(val);
    if (!val || parseFloat(val) <= 0) {
      setAmount("");
      setQuoteBreakdown(null);
      return;
    }
    const ethNeeded = parseFloat(val) / exchangeRate;
    setAmount(ethNeeded.toFixed(18).replace(/\.?0+$/, ""));
    fetchQuote(parseFloat(val));
  };

  const handleRegisterSXSE = async () => {
    if (!address) return;
    setIsRegistering(true);
    setTxError(null);
    try {
      const res = await fetch("/api/stables/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSxseRegistered(true);
        refetchSxse();
      } else {
        setTxError(data.error || "Registration failed");
      }
    } catch (err: any) {
      setTxError(err.message || "Registration failed");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleConfirmSwap = () => {
    if (!amount) return;
    setTxError(null);
    writeContract({
      chainId: HOODI_CHAIN_ID,
      address: process.env.NEXT_PUBLIC_BUY_STABLES_PORTAL as `0x${string}`,
      abi: BUY_STABLES_PORTAL_ABI,
      functionName: "buyStables",
      args: [BigInt(0), BigInt(100)],
      value: parseEther(amount),
      gas: BigInt(500000),
    });
  };

  const isOnWrongNetwork = mounted && isConnected && chainId !== HOODI_CHAIN_ID;

  if (!mounted) return null;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <ArrowRightLeft className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-300 mb-2">Connect Wallet</h2>
        <p className="text-gray-500 text-center max-w-md">
          Please connect your wallet to access the Buy Stables portal.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl relative">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
          Buy <span className="premium-gradient-text">Stables</span> Portal
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Instantly convert your native assets into USDC deposited directly into your SX Unified Account.
        </p>
      </motion.div>

      {/* Wrong Network Banner */}
      {isOnWrongNetwork && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-400 w-5 h-5 shrink-0" />
            <p className="text-sm text-amber-300">You are on the wrong network. Switch to <strong>Hoodi Testnet</strong> to transact.</p>
          </div>
          <button
            onClick={() => switchChain({ chainId: HOODI_CHAIN_ID })}
            className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-lg transition-all"
          >
            Switch Network
          </button>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Registration Info Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-8 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/30">
              <ShieldCheck className="text-indigo-400 w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">SXSE Registration</h2>
            <p className="text-gray-400 text-sm mb-6">
              To buy stables, your wallet must be registered with the SX Secure Exchange (SXSE) on the Hoodi testnet.
            </p>
          </div>

          {isSxseRegistered ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="text-green-400 w-5 h-5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-400">Registered On-Chain</p>
                <p className="text-xs text-green-500/70 font-mono mt-0.5">{address?.slice(0, 10)}...{address?.slice(-6)}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="text-red-400 w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-400">Not Registered</p>
                  <p className="text-xs text-red-500/70 mt-0.5">Registration is required before buying stables.</p>
                </div>
              </div>
              <button
                onClick={handleRegisterSXSE}
                disabled={isRegistering || isOnWrongNetwork}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering Wallet...
                  </>
                ) : (
                  "Register Wallet with SXSE"
                )}
              </button>
            </div>
          )}

          <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-xs text-blue-300">
              <strong>Testnet Rate:</strong> 1 ETH = 30,000,000 USDC (mock rate for Hoodi testnet)
            </p>
          </div>
        </motion.div>

        {/* Swap Interface */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-8 relative"
        >
          <h2 className="text-xl font-bold text-white mb-6">Exchange</h2>

          <div className="space-y-4">
            {/* Input Pay */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-4">
              <div className="flex justify-between mb-2">
                <label className="text-xs font-medium text-gray-400">You Pay</label>
                <span className="text-xs text-gray-500">Hoodi Testnet ETH</span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => handleEthChange(e.target.value)}
                  placeholder="0.0"
                  className="bg-transparent text-3xl text-white outline-none w-full font-medium"
                />
                <span className="bg-white/10 text-white rounded-lg px-3 py-2 font-medium">ETH</span>
              </div>
            </div>

            <div className="flex justify-center -my-2 relative z-10">
              <div className="bg-indigo-600 p-2 rounded-full border-4 border-[#0a0a0a]">
                <ArrowRightLeft className="w-4 h-4 text-white rotate-90" />
              </div>
            </div>

            {/* Output Receive */}
            <div className="bg-black/40 border border-indigo-500/30 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-indigo-500/5"></div>
              <div className="relative z-10">
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-medium text-indigo-300">You Receive (Deposited to SXUA)</label>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="number"
                    value={usdcGross}
                    onChange={(e) => handleUsdcChange(e.target.value)}
                    placeholder="0.0"
                    className="bg-transparent text-3xl text-white outline-none w-full font-medium"
                  />
                  <span className="bg-white/10 text-white rounded-lg px-3 py-2 font-medium">USDC</span>
                </div>
              </div>
            </div>

            {/* Quick Preset for $1,000 USDC */}
            <button
              onClick={() => handleUsdcChange("1000")}
              className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-indigo-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> Buy $1,000 USDC Preset
            </button>

            {/* Dynamic Quote Breakdown */}
            {quoteBreakdown && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs space-y-2 mt-4">
                <p className="font-semibold text-white border-b border-white/5 pb-2 mb-2">Quote Breakdown</p>
                <div className="flex justify-between text-gray-400">
                  <span>Gross USDC Swap:</span>
                  <span className="text-white">${quoteBreakdown.grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>SXSE Compliance Fee (15%):</span>
                  <span className="text-red-400">-${quoteBreakdown.fees.sxseFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Portal Swap Fee (1%):</span>
                  <span className="text-red-400">-${quoteBreakdown.fees.portalFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>PTF Deposit Fee (0.5%):</span>
                  <span className="text-red-400">-${quoteBreakdown.fees.ptfFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Network/Gas Fee:</span>
                  <span className="text-red-400">-${quoteBreakdown.fees.networkFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-white border-t border-white/5 pt-2 mt-2 text-sm">
                  <span>Final Net Amount:</span>
                  <span className="text-green-400">${quoteBreakdown.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => { setShowModal(true); setTxError(null); }}
              disabled={!amount || parseFloat(amount) <= 0 || isOnWrongNetwork || !isSxseRegistered}
              className="w-full py-4 mt-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all"
            >
              {!isSxseRegistered ? "SXSE Registration Required" : isOnWrongNetwork ? "Switch to Hoodi Network First" : "Review Order"}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-bold text-white">Confirm Purchase</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">You Send</span>
                <span className="text-lg font-medium text-white">{amount} ETH</span>
              </div>
              
              {quoteBreakdown ? (
                <div className="space-y-2 border-b border-white/5 pb-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Gross USDC:</span>
                    <span className="text-white">${quoteBreakdown.grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-red-400">
                    <span>Total Fees Deducted:</span>
                    <span>
                      -${(quoteBreakdown.fees.sxseFee + quoteBreakdown.fees.portalFee + quoteBreakdown.fees.ptfFee + quoteBreakdown.fees.networkFee).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-gray-400">You Receive (Net)</span>
                    <span className="text-lg font-bold text-indigo-400">${quoteBreakdown.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-gray-400">You Receive</span>
                  <span className="text-lg font-bold text-indigo-400">USDC</span>
                </div>
              )}

              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">Network</span>
                <span className="text-sm text-green-400 font-medium">Hoodi Testnet</span>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-blue-300 text-center">
                  Funds will be automatically deposited into your primary SXUA sub-account.
                </p>
              </div>

              {/* Error display */}
              {txError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-xs text-red-400 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    {txError}
                  </p>
                </div>
              )}

              {/* Success display */}
              {isConfirmed && hash && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <p className="text-xs text-green-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Transaction confirmed!{" "}
                    <a
                      href={`https://explorer.hoodi.ethpandaops.io/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline flex items-center gap-1"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 bg-black/50 flex gap-3">
              <button
                onClick={() => { setShowModal(false); setTxError(null); }}
                disabled={isPending || isConfirming}
                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSwap}
                disabled={isPending || isConfirming || isConfirmed}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
              >
                {isPending ? "Check MetaMask..." : isConfirming ? "Confirming..." : isConfirmed ? "Done!" : "Confirm Swap"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
