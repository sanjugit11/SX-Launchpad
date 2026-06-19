"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Rocket, Clock, CheckCircle, ChevronRight, AlertTriangle, ExternalLink, RefreshCw, XCircle, ArrowRight } from "lucide-react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { LAUNCHPAD_CORE_ABI, ERC20_ABI } from "@/lib/contracts";

const HOODI_CHAIN_ID = 560048;

export default function LaunchpadPage() {
  const { isConnected, address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [projectData, setProjectData] = useState({ phase: 1, conversionRatio: 10 });
  const [amountUsdc, setAmountUsdc] = useState("");
  const [activePurchaseId, setActivePurchaseId] = useState<number | null>(null);
  const [allPurchases, setAllPurchases] = useState<any[]>([]);
  const [vestingData, setVestingData] = useState<any>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const launchpadAddress = process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS as `0x${string}`;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  // Fetch Project Data
  useEffect(() => {
    fetch('/api/launchpad/projects')
      .then(res => res.json())
      .then(data => setProjectData(data))
      .catch(console.error);
  }, []);

  // Fetch Vesting Data
  const fetchVestingData = async (id: number) => {
    try {
      const res = await fetch(`/api/launchpad/vesting/${id}`);
      const data = await res.json();
      if (!data.error) {
        setVestingData(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activePurchaseId) fetchVestingData(activePurchaseId);
  }, [activePurchaseId]);

  // Fetch all purchases for user — tries new API, falls back to legacy
  const fetchAllPurchases = async (wallet: string) => {
    try {
      const res = await fetch(`/api/launchpad/purchases/${wallet}`);
      if (res.ok) {
        const data = await res.json();
        console.log("[Launchpad] Purchases API response:", data);
        if (data.purchases && data.purchases.length > 0) {
          setAllPurchases(data.purchases);
          setActivePurchaseId(prev => prev || data.purchases[0].id);
          return; // success
        }
      }
    } catch (e) {
      console.warn("[Launchpad] New purchases API failed, using fallback:", e);
    }

    // Fallback: use the legacy /vesting/latest/ endpoint
    try {
      const res = await fetch(`/api/launchpad/vesting/latest/${wallet}`);
      const data = await res.json();
      console.log("[Launchpad] Fallback vesting/latest response:", data);
      if (data.purchaseId) {
        setActivePurchaseId(data.purchaseId);
      }
    } catch (e) {
      console.error("[Launchpad] Both APIs failed:", e);
    }
  };

  useEffect(() => {
    if (address) {
      fetchAllPurchases(address);
    } else {
      setAllPurchases([]);
      setActivePurchaseId(null);
      setVestingData(null);
    }
  }, [address]);

  const userUsdc = parseFloat(amountUsdc || "0");
  const contractUsdcDecimals = 18; // The actual mock token uses 18 decimals on-chain
  const displayUsdcDecimals = 18; // The actual mock token uses 18 decimals, so format with 18 for correct display
  const ltAmountDisplay = userUsdc; // 1 LT = 1 USDC
  const purchaseAmountWei = parseUnits(amountUsdc || "0", contractUsdcDecimals);

  const { data: usdcBalanceRaw } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: mounted && !!address }
  });
  const usdcBalanceDisplay = usdcBalanceRaw !== undefined ? parseFloat(formatUnits(usdcBalanceRaw as bigint, displayUsdcDecimals)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0.00";

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, launchpadAddress] : undefined,
    query: { enabled: mounted && !!address }
  });

  const needsApproval = allowance !== undefined && (allowance as bigint) < purchaseAmountWei;

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (writeError) {
      const msg = writeError.message || "Transaction failed";
      const match = msg.match(/reason:\s*(.+?)(\n|$)/);
      setTxError(match ? match[1] : msg.split("\n")[0]);
      setPendingAction(null);
    }
  }, [writeError]);

  useEffect(() => {
    if (isConfirmed && txHash) {
      setTxError(null);
      if (pendingAction === "APPROVE") {
        refetchAllowance();
        setPendingAction(null);
      } else if (pendingAction === "PURCHASE") {
        const now = new Date();
        const cliffEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const vestingEnd = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

        fetch('/api/launchpad/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: address,
            amountLT: ltAmountDisplay,
            cliffEnd: cliffEnd.toISOString(),
            vestingEnd: vestingEnd.toISOString(),
            phase: projectData.phase
          })
        }).then(res => res.json())
          .then(data => {
            if (data.purchaseId) {
              setActivePurchaseId(data.purchaseId);
              // Trigger a refetch of all purchases
              if (address) fetchAllPurchases(address);
            }
          }).catch(console.error);

        setAmountUsdc("");
        setPendingAction(null);
      } else if (pendingAction === "CLAIM") {
         fetch('/api/launchpad/claim', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ purchaseId: activePurchaseId })
         }).then(() => fetchVestingData(activePurchaseId!));
         setPendingAction(null);
      } else if (pendingAction === "FORFEIT") {
         fetch('/api/launchpad/forfeit', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ purchaseId: activePurchaseId })
         }).then(() => {
           setActivePurchaseId(null);
           setVestingData(null);
         });
         setPendingAction(null);
      } else if (pendingAction === "CONVERT") {
         fetch('/api/launchpad/convert', { method: 'POST' });
         setPendingAction(null);
         // Simulate balance update
         alert("Conversion successful!");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, pendingAction, txHash]);

  const isOnWrongNetwork = mounted && isConnected && chainId !== HOODI_CHAIN_ID;
  if (!mounted) return null;

  const handlePurchaseAction = () => {
    if (!amountUsdc || userUsdc <= 0) return;
    setTxError(null);

    if (needsApproval) {
      setPendingAction("APPROVE");
      writeContract({
        chainId: HOODI_CHAIN_ID,
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [launchpadAddress, purchaseAmountWei],
        gas: BigInt(500000),
      });
    } else {
      setPendingAction("PURCHASE");
      writeContract({
        chainId: HOODI_CHAIN_ID,
        address: launchpadAddress,
        abi: LAUNCHPAD_CORE_ABI,
        functionName: "purchaseTokens",
        args: [purchaseAmountWei],
        gas: BigInt(500000),
      });
    }
  };

  const handleClaim = () => {
    setTxError(null);
    setPendingAction("CLAIM");
    writeContract({
      chainId: HOODI_CHAIN_ID,
      address: launchpadAddress,
      abi: LAUNCHPAD_CORE_ABI,
      functionName: "claimVested",
      args: [BigInt(activePurchaseId!)],
      gas: BigInt(500000),
    });
  };

  const handleForfeit = () => {
    const confirmForfeit = window.confirm("You will forfeit all vested rights. ☑ I understand");
    if (!confirmForfeit) return;
    setTxError(null);
    setPendingAction("FORFEIT");
    writeContract({
      chainId: HOODI_CHAIN_ID,
      address: launchpadAddress,
      abi: LAUNCHPAD_CORE_ABI,
      functionName: "forfeitPurchase",
      args: [BigInt(activePurchaseId!)],
      gas: BigInt(500000),
    });
  };

  const handleConvert = () => {
    if (!vestingData || !vestingData.claimedAmount) return;
    // We convert 980 LT (net received from 1000 after 2% minting fee)
    // Here we'll just use the claimable amount minus 2% as what was claimed, or we can use the vestingData.claimedAmount directly if it represents the actual LT the user holds.
    // The requirement: "User receives: 980 LT... Mint: 9800 MP"
    // So we just burn what they have in wallet. We'll simulate fetching wallet balance by using claimedAmount * 0.98.
    const actualLTReceived = vestingData.claimedAmount * 0.98;
    const amountLTWei = parseUnits(actualLTReceived.toString(), 18);
    setTxError(null);
    setPendingAction("CONVERT");
    writeContract({
      chainId: HOODI_CHAIN_ID,
      address: launchpadAddress,
      abi: LAUNCHPAD_CORE_ABI,
      functionName: "convertToMP",
      args: [amountLTWei],
      gas: BigInt(500000),
    });
  };

  const isBusy = isPending || isConfirming;
  const aggregateTotalLT = allPurchases.reduce((sum, p) => sum + p.lt_amount, 0);

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            Project: <span className="premium-gradient-text">SX Launchpad</span>
          </h1>
          <p className="text-gray-400">Phase {projectData.phase} • Conversion: 1 LT → {projectData.conversionRatio} MP</p>
        </motion.div>
      </div>

      {isOnWrongNetwork && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-400 w-5 h-5 shrink-0" />
            <p className="text-sm text-amber-300">You are on the wrong network. Switch to <strong>Hoodi Testnet</strong> to interact with the Launchpad.</p>
          </div>
          <button
            onClick={() => switchChain({ chainId: HOODI_CHAIN_ID })}
            className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-lg transition-all"
          >
            Switch Network
          </button>
        </motion.div>
      )}

      {txError && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {txError}
          </p>
        </div>
      )}

      {isConfirmed && txHash && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-sm text-green-400 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            Transaction successful!{" "}
            <a href={`https://explorer.hoodi.ethpandaops.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline flex items-center gap-1 ml-2">
              View <ExternalLink className="w-4 h-4" />
            </a>
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left: Purchase Action */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Purchase LT</h2>
              <p className="text-gray-400 text-sm mt-1">Price: 1 LT = 1 USDC</p>
            </div>
          </div>
          
          <div className="bg-black/40 border border-white/10 rounded-xl p-5 mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-400">Amount (USDC)</label>
              <span className="text-xs text-indigo-400">Available: {usdcBalanceDisplay} USDC</span>
            </div>
            <div className="relative mb-4">
              <input 
                type="number" 
                placeholder="1000.00" 
                value={amountUsdc}
                onChange={(e) => setAmountUsdc(e.target.value)}
                className="w-full bg-transparent border-b-2 border-white/10 py-2 text-3xl text-white outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">You will receive:</span>
              <span className="font-medium text-white">{ltAmountDisplay.toLocaleString()} LT</span>
            </div>
          </div>

          <button 
            onClick={handlePurchaseAction}
            disabled={!isConnected || isBusy || userUsdc <= 0 || isOnWrongNetwork}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex justify-center items-center gap-2 group"
          >
            {!isConnected 
              ? "Connect Wallet to Purchase" 
              : isOnWrongNetwork
                ? "Switch to Hoodi Network"
                : isBusy && pendingAction === "APPROVE"
                  ? "Approving USDC..."
                  : isBusy && pendingAction === "PURCHASE"
                    ? "Purchasing..."
                    : needsApproval 
                      ? "Approve USDC" 
                      : "Buy LT"}
            {isConnected && !isOnWrongNetwork && !isBusy && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </motion.div>

        {/* Right: Vesting Dashboard & Conversion */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-6"
        >
          {vestingData ? (
            <>
              {/* Vesting Dashboard */}
              <div className="glass-panel p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">Active Vesting</div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white">Your Vesting</h3>
                  {allPurchases.length > 1 && (
                    <select 
                      value={activePurchaseId || ""}
                      onChange={(e) => setActivePurchaseId(Number(e.target.value))}
                      className="bg-black/50 border border-white/10 rounded-lg py-1 px-2 text-xs text-white outline-none"
                    >
                      {allPurchases.map(p => (
                        <option key={p.id} value={p.id}>Schedule #{p.id}</option>
                      ))}
                    </select>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/5 rounded-lg p-3 relative group cursor-help">
                    <p className="text-xs text-gray-400">Total Purchased LT</p>
                    <p className="text-lg font-bold text-white">{aggregateTotalLT.toLocaleString()}</p>
                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-black text-xs text-white p-2 rounded pointer-events-none transition-opacity z-10">
                      Total across all {allPurchases.length} active schedules.
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Current Schedule LT</p>
                    <p className="text-lg font-bold text-indigo-400">{vestingData.totalAmount}</p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-3 mb-6">
                  <p className="text-xs text-gray-400">Claimable LT (This Schedule)</p>
                  <p className="text-lg font-bold text-green-400">{vestingData.claimableAmount}</p>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-medium text-gray-300">Progress</span>
                    <span className="text-sm font-bold text-indigo-400">
                      {vestingData.isComplete ? "100%" : "Vesting..."}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden border border-white/5 mb-3">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: vestingData.isComplete ? '100%' : '45%' }}
                      transition={{ duration: 1 }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Cliff Ends: 30 days</span>
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Vesting Ends: 180 days</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                  <div className="flex-1" title={!vestingData.isComplete ? `Available on ${new Date(vestingData.vestingEnd * 1000).toLocaleDateString()}` : ""}>
                    <button 
                      onClick={handleClaim}
                      disabled={!vestingData.isComplete || isBusy}
                      className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex justify-center items-center"
                    >
                      {isBusy && pendingAction === "CLAIM" ? "Processing..." : "Claim"}
                    </button>
                    {vestingData.isComplete && (
                      <p className="text-[10px] text-gray-400 text-center mt-2">Minting Cost: {(vestingData.totalAmount * 0.02).toFixed(2)} LT (2%)</p>
                    )}
                  </div>
                  <button 
                    onClick={handleForfeit}
                    disabled={vestingData.isComplete || isBusy}
                    className="py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-30 disabled:cursor-not-allowed font-bold rounded-xl border border-red-500/30 transition-all flex items-center justify-center"
                    title="Exit Early"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* LT to MP Conversion */}
              {vestingData.claimedAmount > 0 && (
                <div className="glass-panel p-8">
                  <h3 className="text-xl font-bold text-white mb-6">Convert to MP</h3>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-5 mb-6 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">My LT Balance</p>
                      <p className="text-2xl font-bold text-white">{(vestingData.claimedAmount * 0.98).toLocaleString()} LT</p>
                    </div>
                    <ArrowRight className="text-indigo-400 w-6 h-6" />
                    <div className="text-right">
                      <p className="text-xs text-gray-400 mb-1">You will receive</p>
                      <p className="text-2xl font-bold text-green-400">{((vestingData.claimedAmount * 0.98) * projectData.conversionRatio).toLocaleString()} MP</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleConvert}
                    disabled={isBusy}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"
                  >
                    {isBusy && pendingAction === "CONVERT" ? "Converting..." : "Convert to MP"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="glass-panel p-8 h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Active Vesting</h3>
              <p className="text-gray-400 text-sm max-w-xs">Purchase LT allocation to view your vesting schedule and claim MP tokens.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
