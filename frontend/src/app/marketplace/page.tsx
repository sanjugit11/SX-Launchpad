"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Tag, X, ShoppingCart, AlertTriangle } from "lucide-react";
import { useSocket } from "@/providers/SocketProvider";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { MARKETPLACE_ABI, ERC20_ABI, LAUNCHPAD_CORE_ABI } from "@/lib/contracts";
import { formatUnits, parseUnits } from "viem";

const HOODI_CHAIN_ID = 560048;
const marketplaceAddress = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`;
const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const launchpadAddress = process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS as `0x${string}`;

type OnChainPurchase = { id: number; amountLT: string; isActive: boolean };
type Order = { id: string; seller: string; amount: number; price: number; type: "sell" };

export default function MarketplacePage() {
  const { address, isConnected } = useAccount();
  const { socket, isConnected: isSocketConnected } = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // On-chain vesting positions
  const [myPurchases, setMyPurchases] = useState<OnChainPurchase[]>([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [listAmount, setListAmount] = useState("");
  const [listPrice, setListPrice] = useState("");

  const [txState, setTxState] = useState<"IDLE" | "APPROVING" | "BUYING" | "LISTING">("IDLE");
  const [txError, setTxError] = useState<string | null>(null);

  // Wagmi Hooks
  const { data: hash, writeContract, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Capture writeContract errors
  useEffect(() => {
    if (writeError) {
      const msg = writeError.message || "Transaction failed";
      const match = msg.match(/reason:\s*(.+?)(\n|$)/);
      setTxError(match ? match[1] : msg.split("\n")[0]);
      setTxState("IDLE");
    }
  }, [writeError]);

  // ===== READ ON-CHAIN PURCHASE IDS =====
  const { data: onChainPurchaseIds } = useReadContract({
    address: launchpadAddress,
    abi: LAUNCHPAD_CORE_ABI,
    functionName: "getUserPurchases",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // For each on-chain ID, fetch purchase details from the backend (which reads the right vesting data)
  useEffect(() => {
    if (!onChainPurchaseIds || !Array.isArray(onChainPurchaseIds)) return;
    const ids = (onChainPurchaseIds as bigint[]).map(id => Number(id));
    console.log("[Marketplace] On-chain purchase IDs:", ids);

    if (ids.length === 0) {
      setMyPurchases([]);
      return;
    }

    // Use on-chain IDs directly — the smart contract validates ownership & amounts
    const results: OnChainPurchase[] = ids.map(id => ({
      id,
      amountLT: "—",
      isActive: true,
    }));
    setMyPurchases(results);
    if (results.length > 0 && !selectedPurchaseId) {
      setSelectedPurchaseId(results[0].id.toString());
    }
  }, [onChainPurchaseIds]);

  // ===== FETCH MARKETPLACE LISTINGS =====
  useEffect(() => {
    fetch("/api/marketplace/listings")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setOrders(
            data.map((l: any) => ({
              id: l.id,
              seller: l.seller_wallet,
              amount: l.amount,
              price: l.price,
              type: "sell" as const,
            }))
          );
        }
      })
      .catch(err => console.error("[Marketplace] Fetch listings error:", err));
  }, []);

  // ===== SOCKET LISTENERS =====
  useEffect(() => {
    if (socket) {
      socket.on("new_order", (order: Order) => {
        setOrders(prev => [...prev, order].sort((a, b) => a.price - b.price));
      });
      socket.on("order_filled", (orderId: string) => {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        if (selectedOrder?.id === orderId) setSelectedOrder(null);
      });
    }
    return () => {
      if (socket) {
        socket.off("new_order");
        socket.off("order_filled");
      }
    };
  }, [socket, selectedOrder]);

  // ===== POST-TRANSACTION HANDLER =====
  useEffect(() => {
    if (isConfirmed && hash) {
      if (txState === "LISTING") {
        fetch("/api/marketplace/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purchaseId: selectedPurchaseId,
            seller: address,
            amount: listAmount,
            price: listPrice,
          }),
        }).then(() => {
          setTxState("IDLE");
          setTxError(null);
          setListAmount("");
          setListPrice("");
        });
      } else if (txState === "APPROVING" && selectedOrder) {
        setTxState("BUYING");
        console.log("[Marketplace] Approving finished. Executing buyListing on-chain for listingId:", selectedOrder.id);
        writeContract({
          chainId: HOODI_CHAIN_ID,
          address: marketplaceAddress,
          abi: MARKETPLACE_ABI,
          functionName: "buyListing",
          args: [BigInt(selectedOrder.id)],
          gas: BigInt(500000),
        });
      } else if (txState === "BUYING" && selectedOrder) {
        console.log("[Marketplace] Purchase transaction confirmed. Syncing with backend database.");
        const cliffEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
        const vestingEnd = Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60;

        fetch(`/api/marketplace/buy/${selectedOrder.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyer: address,
            cliffEnd,
            vestingEnd,
          }),
        }).then(() => {
          setTxState("IDLE");
          setTxError(null);
          setSelectedOrder(null);
          // Refresh orderbook listings
          fetch("/api/marketplace/listings")
            .then(r => r.json())
            .then(data => {
              if (Array.isArray(data)) {
                setOrders(
                  data.map((l: any) => ({
                    id: l.id,
                    seller: l.seller_wallet,
                    amount: l.amount,
                    price: l.price,
                    type: "sell" as const,
                  }))
                );
              }
            });
        });
      }
    }
  }, [isConfirmed, hash, txState, selectedOrder]);

  // ===== ACTIONS =====
  const handleList = async () => {
    if (!selectedPurchaseId || !listAmount || !listPrice) return;
    setTxError(null);
    setTxState("LISTING");
    console.log("[Marketplace] Listing with ON-CHAIN ID:", selectedPurchaseId, { listAmount, listPrice, marketplaceAddress });
    writeContract({
      chainId: HOODI_CHAIN_ID,
      address: marketplaceAddress,
      abi: MARKETPLACE_ABI,
      functionName: "listTokens",
      args: [BigInt(selectedPurchaseId), parseUnits(listAmount, 18), parseUnits(listPrice, 18)],
      gas: BigInt(500000),
    });
  };

  const handleBuy = async () => {
    if (!selectedOrder) return;
    setTxError(null);
    setTxState("APPROVING");
    writeContract({
      chainId: HOODI_CHAIN_ID,
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [marketplaceAddress, parseUnits((selectedOrder.price * selectedOrder.amount * 1.01).toString(), 18)],
      gas: BigInt(500000),
    });
  };

  const selectedPurchase = myPurchases.find(p => p.id.toString() === selectedPurchaseId);
  const totalCost = listAmount && listPrice ? (parseFloat(listAmount) * parseFloat(listPrice)) : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-end mb-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            Secondary <span className="premium-gradient-text">Marketplace</span>
          </h1>
          <p className="text-gray-400">Trade your unvested Launchpad Tokens via our secure escrow system.</p>
        </motion.div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <Activity className={`w-4 h-4 ${isSocketConnected ? "text-green-400" : "text-red-400"}`} />
          <span className="text-xs font-medium text-gray-300">{isSocketConnected ? "Realtime Active" : "Connecting..."}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Panel: List Tokens */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6">
            <h2 className="text-lg font-bold text-white mb-4">My Vested Tokens</h2>

            {txError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-xs text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{txError}</span>
              </div>
            )}

            {myPurchases.length === 0 ? (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-6 text-center text-sm text-gray-400">
                {isConnected ? "No active vesting schedules found on-chain." : "Connect wallet to view your positions."}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Select Schedule (On-Chain ID)</label>
                  <select
                    value={selectedPurchaseId}
                    onChange={(e) => setSelectedPurchaseId(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-sm text-white outline-none"
                  >
                    {myPurchases.map((p) => (
                      <option key={p.id} value={p.id}>
                        Purchase #{p.id} — {p.amountLT} LT
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPurchase && (
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Available LT</span>
                      <span className="text-white font-medium">{selectedPurchase.amountLT} LT</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Amount to Sell</label>
                    <input
                      type="number"
                      value={listAmount}
                      onChange={(e) => setListAmount(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-sm text-white outline-none"
                      placeholder="e.g. 500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Price per LT (USDC)</label>
                    <input
                      type="number"
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-sm text-white outline-none"
                      placeholder="e.g. 1.50"
                    />
                  </div>
                </div>

                {totalCost > 0 && (
                  <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-500/20 text-center">
                    <p className="text-xs text-gray-400">Listing Total</p>
                    <p className="text-lg font-bold text-white">{totalCost.toLocaleString()} USDC</p>
                  </div>
                )}

                <button
                  onClick={handleList}
                  disabled={!isConnected || txState !== "IDLE" || !listAmount || !listPrice}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex justify-center items-center gap-2"
                >
                  {txState === "LISTING" ? "Listing..." : <><Tag className="w-4 h-4" /> List on Orderbook</>}
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Panel: Live Orderbook */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2 glass-panel p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Live Orderbook</h2>
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-medium">Nova LT</span>
          </div>

          <div className="flex-1 bg-black/40 rounded-xl border border-white/5 overflow-hidden flex flex-col min-h-[300px]">
            <div className="grid grid-cols-4 p-3 border-b border-white/10 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span>Price (USDC)</span>
              <span>Amount (LT)</span>
              <span>Total (USDC)</span>
              <span className="text-right">Action</span>
            </div>

            <div className="p-2 space-y-1 overflow-y-auto">
              <AnimatePresence>
                {orders.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400">No active listings available.</div>
                ) : (
                  orders.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="grid grid-cols-4 items-center p-2 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <span className="text-red-400 font-medium">${Number(order.price).toFixed(2)}</span>
                      <span className="text-white">{Number(order.amount).toLocaleString()}</span>
                      <span className="text-gray-400">${(order.amount * order.price).toLocaleString()}</span>
                      <div className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded-md font-medium">Buy</button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Purchase Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-400" /> Purchase Listing
              </h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Token</span>
                  <span className="text-white font-medium">Nova LT</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-white font-medium">{selectedOrder.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                  <span className="text-gray-400">Price per Token</span>
                  <span className="text-red-400 font-medium">${Number(selectedOrder.price).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-2 px-1">
                <span className="text-gray-300 font-medium">Total Cost + 1% Fee</span>
                <span className="text-2xl font-bold text-white">${(selectedOrder.amount * selectedOrder.price * 1.01).toLocaleString()} USDC</span>
              </div>

              <p className="text-xs text-center text-gray-500 py-2">
                By purchasing, you inherit the original seller&apos;s vesting schedule constraints.
              </p>

              <button
                onClick={handleBuy}
                disabled={txState !== "IDLE"}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
              >
                {txState === "APPROVING" ? "Approving USDC..." : txState === "BUYING" ? "Purchasing..." : "Confirm Purchase"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
