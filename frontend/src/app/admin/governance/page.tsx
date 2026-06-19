"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, CheckCircle2, XCircle, Power, Shield, Clock, KeyRound, Plus, Fingerprint } from "lucide-react";
import { useAccount, useSwitchChain, useReadContract, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from "wagmi";
import { DIG_MONITOR_ABI, DMS_VERIFIER_ABI } from "@/lib/contracts";
import { isAddress, encodeFunctionData } from "viem";
import AdminNav from "@/components/layout/AdminNav";

const isValidHex = (value: string, length = 32) => /^0x[0-9a-fA-F]{64}$/.test(value) && length === 32;
const HOODI_CHAIN_ID = 560048;

const DIG_MONITOR_ADDRESS = process.env.NEXT_PUBLIC_DIG_MONITOR_ADDRESS;
const DMS_VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_DMS_VERIFIER_ADDRESS;

export default function GovernancePage() {
  const { isConnected, address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const isOnHoodi = chain?.id === 560048;

  const [deviceHash, setDeviceHash] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newData, setNewData] = useState("");
  const [registerAdmin, setRegisterAdmin] = useState("");
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [dpopValidationError, setDpopValidationError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data: contractDeviceData } = useReadContract({
    address: DMS_VERIFIER_ADDRESS as `0x${string}` | undefined,
    abi: DMS_VERIFIER_ABI,
    functionName: "masterDevices",
    args: address ? [address] : undefined,
    query: {
      enabled: !!DMS_VERIFIER_ADDRESS && isOnHoodi && !!address,
      refetchOnWindowFocus: false,
      staleTime: 10000,
    },
  });

  const contractDeviceHash = contractDeviceData?.[0];

  useEffect(() => {
    if (!address || !deviceHash || !isValidHex(deviceHash, 32)) {
      setDpopValidationError(null);
      return;
    }

    const checkIntegrity = async () => {
      try {
        const res = await fetch('/api/admin/kill-switch/status', {
          headers: {
            'dpop': 'mock-dpop-token',
            'x-device-id': deviceHash,
            'x-wallet': address
          }
        });

        if (res.status === 401) {
          const data = await res.json();
          setDpopValidationError(data.error || "DPoP Validation Failed: DPoP token from different device rejected.");
        } else if (res.ok) {
          setDpopValidationError(null);
        } else {
          setDpopValidationError(null);
        }
      } catch (err) {
        console.error("Integrity check failed", err);
      }
    };

    checkIntegrity();
  }, [address, deviceHash]);

  const { data: isSystemPaused, refetch: refetchPaused } = useReadContract({
    address: DIG_MONITOR_ADDRESS as `0x${string}` | undefined,
    abi: DIG_MONITOR_ABI,
    functionName: "isPaused",
    query: {
      enabled: !!DIG_MONITOR_ADDRESS && isOnHoodi,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  });

  const { data: isSystemKilled, refetch: refetchKilled } = useReadContract({
    address: DIG_MONITOR_ADDRESS as `0x${string}` | undefined,
    abi: DIG_MONITOR_ABI,
    functionName: "isKilled",
    query: {
      enabled: !!DIG_MONITOR_ADDRESS && isOnHoodi,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  });

  const [backendProposals, setBackendProposals] = useState<any[] | null>(null);

  const fetchBackendProposals = async () => {
    try {
      const res = await fetch('/api/admin/proposals');
      if (!res.ok) return;
      const data = await res.json();
      setBackendProposals(data);
    } catch (e) {
      console.error('Failed to fetch backend proposals', e);
    }
  };

  const [isMockApproving, setIsMockApproving] = useState<Record<number, boolean>>({});

  const handleMockApproveOthers = async (proposalId: number) => {
    setIsMockApproving(prev => ({ ...prev, [proposalId]: true }));
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/mock-approve`, {
        method: 'POST'
      });
      if (res.ok) {
        alert("Approvals from Admin 2 & 3 submitted successfully!");
        fetchBackendProposals();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || "Failed to submit approvals"}`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to submit approvals");
    } finally {
      setIsMockApproving(prev => ({ ...prev, [proposalId]: false }));
    }
  };

  const effectiveProposals = useMemo(() => {
    if (backendProposals && Array.isArray(backendProposals)) {
      return backendProposals.map((p: any) => ({
        id: p.id,
        target: p.target,
        data: p.data,
        approvalCount: p.approvalCount,
        executed: p.executed,
        status: p.executed ? 'executed' : p.approvalCount >= 3 ? 'ready' : 'pending',
      }));
    }
    return [];
  }, [backendProposals]);

  const { writeContract: writeCreateProposal, data: createTxHash } = useWriteContract();
  const { isLoading: isCreateConfirming, isSuccess: isCreateSuccess } =
    useWaitForTransactionReceipt({ hash: createTxHash });

  const { writeContract: writeApprove, data: approveTxHash } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const { writeContract: writeKillSwitch, data: killTxHash } = useWriteContract();
  const { isLoading: isKillConfirming, isSuccess: isKillSuccess } =
    useWaitForTransactionReceipt({ hash: killTxHash });

  const { writeContract: writeUnpause, data: unpauseTxHash } = useWriteContract();
  const { isLoading: isUnpauseConfirming, isSuccess: isUnpauseSuccess } =
    useWaitForTransactionReceipt({ hash: unpauseTxHash });

  const { writeContract: writeRegisterDevice, data: regTxHash } = useWriteContract();
  const { isLoading: isRegConfirming, isSuccess: isRegSuccess } =
    useWaitForTransactionReceipt({ hash: regTxHash });

  useEffect(() => {
    refetchPaused();
    refetchKilled();
  }, [isUnpauseSuccess, createTxHash, killTxHash, isKillSuccess]);

  useEffect(() => {
    if (!isOnHoodi) return;
    fetchBackendProposals();
    const interval = setInterval(fetchBackendProposals, 5000);
    return () => clearInterval(interval);
  }, [isOnHoodi, isApproveSuccess, isCreateSuccess, isRegSuccess]);

  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <Shield className="w-16 h-16 text-gray-500 mb-4 animate-pulse" />
        <h2 className="text-2xl font-bold text-gray-300 mb-2">Loading...</h2>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <Shield className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-300 mb-2">Admin Access Required</h2>
        <p className="text-gray-500 text-center max-w-md">
          Please connect your Multi-Sig authorized wallet to access the Governance Dashboard.
        </p>
      </div>
    );
  }

  if (!isOnHoodi) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <Shield className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-300 mb-2">Wrong Network</h2>
        <p className="text-gray-500 text-center max-w-md mb-4">Please switch to Hoodi Testnet (Chain 560048).</p>
        <button
          onClick={() => switchChain({ chainId: 560048 })}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg font-medium"
        >
          Switch to Hoodi
        </button>
      </div>
    );
  }

  if (!DIG_MONITOR_ADDRESS || !DMS_VERIFIER_ADDRESS) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-300 mb-2">Governance Not Configured</h2>
        <p className="text-gray-500 text-center max-w-md">
          NEXT_PUBLIC_DIG_MONITOR_ADDRESS or NEXT_PUBLIC_DMS_VERIFIER_ADDRESS is missing from environment.
        </p>
      </div>
    );
  }

  const handleCreateProposal = () => {
    if (!DIG_MONITOR_ADDRESS) return;
    if (!newTarget || !isAddress(newTarget)) {
      alert("Invalid target address");
      return;
    }
    const data = newData && isValidHex(newData) ? newData : "0x";
    writeCreateProposal({
      address: DIG_MONITOR_ADDRESS as `0x${string}`,
      abi: DIG_MONITOR_ABI,
      functionName: "createProposal",
      args: [newTarget as `0x${string}`, data as `0x${string}`],
      gas: 300000n,
    });
    setNewTarget("");
    setNewData("");
  };

  const handleApprove = (proposalId: number) => {
    if (!DIG_MONITOR_ADDRESS) return;
    if (!deviceHash || !isValidHex(deviceHash, 32)) {
      alert("Invalid deviceHash: must be 32-byte hex (0x... with 64 hex chars)");
      return;
    }
    writeApprove({
      address: DIG_MONITOR_ADDRESS as `0x${string}`,
      abi: DIG_MONITOR_ABI,
      functionName: "approveProposal",
      args: [BigInt(proposalId), deviceHash as `0x${string}`, "0x" as `0x${string}`],
      gas: 500000n,
    });
  };

  const handleKillSwitch = () => {
    if (!DIG_MONITOR_ADDRESS) return;
    writeKillSwitch({
      address: DIG_MONITOR_ADDRESS as `0x${string}`,
      abi: DIG_MONITOR_ABI,
      functionName: "activateKillSwitch",
      gas: 200000n,
    });
  };

  const handleUnpause = () => {
    if (!DIG_MONITOR_ADDRESS) return;
    const calldata = encodeFunctionData({
      abi: DIG_MONITOR_ABI,
      functionName: "deactivateKillSwitch",
    });
    writeUnpause({
      address: DIG_MONITOR_ADDRESS as `0x${string}`,
      abi: DIG_MONITOR_ABI,
      functionName: "createProposal",
      args: [DIG_MONITOR_ADDRESS as `0x${string}`, calldata],
      gas: 300000n,
    });
  };

  const handleRegisterDevice = () => {
  if (!DMS_VERIFIER_ADDRESS || !deviceHash) return;
  if (!isValidHex(deviceHash, 32)) {
      alert("Invalid deviceHash: must be 32-byte hex (0x... with 64 hex chars)");
      return;
    }
    writeRegisterDevice({
      address: DMS_VERIFIER_ADDRESS as `0x${string}`,
      abi: DMS_VERIFIER_ABI,
      functionName: "registerMasterDevice",
      args: [deviceHash as `0x${string}`],
      gas: 200000n,
    });
  };

  const handleRegisterForAdmin = () => {
    if (!DMS_VERIFIER_ADDRESS || !deviceHash || !registerAdmin) return;
    if (!isValidHex(deviceHash, 32)) {
      alert("Invalid deviceHash: must be 32-byte hex (0x... with 64 hex chars)");
      return;
    }
    if (!isAddress(registerAdmin)) {
      alert("Invalid admin address");
      return;
    }
    writeRegisterDevice({
      address: DMS_VERIFIER_ADDRESS as `0x${string}`,
      abi: DMS_VERIFIER_ABI,
      functionName: "registerMasterDeviceFor",
      args: [registerAdmin as `0x${string}`, deviceHash as `0x${string}`],
      gas: 200000n,
    });
  };

  const isPaused = Boolean(isSystemPaused);
  const isKilled = Boolean(isSystemKilled);
  const pendingProposals = effectiveProposals.filter((p) => !p.executed);

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-indigo-400" />
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            Governance <span className="text-indigo-400">Control Panel</span>
          </h1>
        </div>
        <p className="text-gray-400">3-of-3 Multi-Signature Administration and Emergency Controls.</p>
      </motion.div>

      <AdminNav />

      {/* Device Integrity Mismatch / DPoP Remediation Alert */}
      {(dpopValidationError || (contractDeviceHash && contractDeviceHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && contractDeviceHash !== deviceHash)) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-red-950/30 border border-red-500/40 rounded-2xl relative overflow-hidden backdrop-blur-md"
        >
          <div className="flex gap-4">
            <div className="p-3 bg-red-500/20 rounded-xl h-fit border border-red-500/30">
              <ShieldAlert className="w-6 h-6 text-red-400 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-red-200">Device Integrity Alert (DIG Mismatch)</h3>
              <p className="text-sm text-red-300/90 leading-relaxed">
                {dpopValidationError ? dpopValidationError : "Your active device hash does not match the registered Master Device hash on the contract for this admin wallet."}
              </p>
              <div className="text-xs font-mono bg-black/40 p-3 rounded-lg border border-red-900/30 text-red-300 space-y-1">
                <div>• Connected Wallet: {address}</div>
                <div>• Entered Device Hash: {deviceHash || "None"}</div>
                {contractDeviceHash && contractDeviceHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <div>• On-Chain Registered Hash: {String(contractDeviceHash)}</div>
                )}
              </div>
              <div className="pt-2 text-xs text-red-400/80 space-y-1">
                <span className="font-bold text-red-300">Remediation Steps:</span>
                <ol className="list-decimal pl-4 space-y-1 mt-1 text-red-300/70">
                  <li>Verify that your physical hardware device/key is correctly plugged in.</li>
                  <li>Check that you have copied the correct device hash (e.g. <code>0x8dadc974...</code>) into the input field below.</li>
                  <li>If this is a new device, a proposal must be created and approved by 3 admins to register the new device hash.</li>
                </ol>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-6">
          
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-400" /> Master Device Registration
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Register your hardware-linked DPoP device hash for governance actions. Required before approving proposals.
            </p>

            <div className="space-y-3">
              <input
                value={deviceHash}
                onChange={(e) => setDeviceHash(e.target.value)}
                placeholder="Device Hash (0x... 32 bytes hex)"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-indigo-500"
              />

              {address && (
                <button
                  onClick={handleRegisterDevice}
                  disabled={isRegConfirming || !deviceHash}
                  className="w-full py-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 font-medium rounded-xl border border-indigo-500/30 transition-colors disabled:opacity-50"
                >
                  {isRegConfirming ? "Registering..." : "Register My Device"}
                </button>
              )}

              {isRegSuccess && (
                <div className="text-sm text-green-400">Device registered successfully. Tx: {regTxHash}</div>
              )}
            </div>

            {address && (
              <>
                <hr className="border-white/10 my-4" />
                <h3 className="text-sm font-bold text-white mb-2">Owner: Register Device for Other Admin</h3>
                <input
                  value={registerAdmin}
                  onChange={(e) => setRegisterAdmin(e.target.value)}
                  placeholder="Admin Wallet Address"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-indigo-500 mb-2"
                />
                <button
                  onClick={handleRegisterForAdmin}
                  disabled={isRegConfirming || !deviceHash || !registerAdmin}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl border border-white/10 transition-colors disabled:opacity-50"
                >
                  {isRegConfirming ? "Registering..." : "Register Device for Admin"}
                </button>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-panel p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-400" /> Create Proposal
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Create an on-chain proposal targeting any contract method. Requires 3-of-3 approval to execute.
            </p>
            <div className="space-y-3">
              <input
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="Target Contract Address"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-indigo-500"
              />
              <input
                value={newData}
                onChange={(e) => setNewData(e.target.value)}
                placeholder='Calldata (hex, e.g. "0x")'
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleCreateProposal}
                disabled={isCreateConfirming || !newTarget}
                className="w-full py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium rounded-xl border border-green-500/30 transition-colors disabled:opacity-50"
              >
                {isCreateConfirming ? "Submitting..." : "Create Proposal"}
              </button>
              {isCreateSuccess && (
                <div className="text-sm text-green-400">Proposal submitted. Tx: {createTxHash}</div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel p-6"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Pending Proposals</h2>
              <span className="bg-indigo-500/20 text-indigo-400 text-xs font-bold px-3 py-1 rounded-full">
                {pendingProposals.filter((p) => !p.executed).length} Pending
              </span>
            </div>

            <div className="space-y-4">
              {effectiveProposals.length === 0 && (
                <p className="text-gray-500 text-sm">No proposals found on-chain.</p>
              )}
              {effectiveProposals.map((prop) => (
                <div key={prop.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500">PROP-{prop.id}</span>
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${prop.executed ? "text-green-400 bg-green-400/10" : prop.status === "ready" ? "text-amber-400 bg-amber-400/10" : "text-amber-400 bg-amber-400/10"}`}>
                          <Clock className="w-3 h-3" /> {prop.executed ? "Executed" : prop.status === "ready" ? "Ready" : "Active"}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white">Proposal #{prop.id}</h3>
                      <p className="text-xs text-gray-400 font-mono">Target: {prop.target.slice(0, 10)}...{prop.target.slice(-8)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-400">Approvals</p>
                      <p className="text-lg font-bold text-white">
                        <span className="text-indigo-400">{prop.approvalCount}</span> / 3
                      </p>
                    </div>
                  </div>

                  <div className="w-full bg-black/50 rounded-full h-2 mb-6 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all"
                      style={{ width: `${(prop.approvalCount / 3) * 100}%` }}
                    ></div>
                  </div>

                  {!prop.executed && (
                    <div className="space-y-2">
                      <input
                        value={selectedProposalId === prop.id ? deviceHash : ""}
                        onChange={(e) => {
                          setSelectedProposalId(prop.id);
                          setDeviceHash(e.target.value);
                        }}
                        placeholder="Your Device Hash (0x... 32 bytes)"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-xs outline-none focus:border-indigo-500"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(prop.id)}
                          disabled={isApproveConfirming || !deviceHash}
                          className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium rounded-lg border border-green-500/30 transition-colors disabled:opacity-50"
                        >
                          {isApproveConfirming ? "Approving..." : "Sign & Approve"}
                        </button>
                        <button disabled className="flex-1 py-2 bg-red-500/20 text-red-400 font-medium rounded-lg border border-red-500/30 transition-colors opacity-50 cursor-not-allowed">
                          Reject
                        </button>
                      </div>
                      {prop.approvalCount > 0 && prop.approvalCount < 3 && (
                        <button
                          onClick={() => handleMockApproveOthers(prop.id)}
                          disabled={isMockApproving[prop.id]}
                          className="w-full py-2 mt-2 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-400 font-medium rounded-lg border border-indigo-500/30 transition-colors disabled:opacity-50"
                        >
                          {isMockApproving[prop.id] ? "Submitting Admin 2 & 3 Approvals..." : "Mock Admin 2 & 3 Approvals (3-of-3)"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {(approveTxHash || createTxHash) && (
              <div className="text-sm text-green-400 mt-3">
                Actions processed. {approveTxHash && `Approve Tx: ${approveTxHash}.`} {createTxHash && `Create Tx: ${createTxHash}.`}
              </div>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <div className={`glass-panel p-6 relative overflow-hidden ${(isPaused || isKilled) ? "border-red-500/30 bg-gradient-to-br from-red-900/20 to-black" : "border-green-500/30 bg-gradient-to-br from-green-900/20 to-black"}`}>
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldAlert className="w-24 h-24 text-red-500" />
            </div>

            <h2 className="text-xl font-bold text-red-400 mb-2 flex items-center gap-2">
              <Power className="w-5 h-5" /> Emergency Controls
            </h2>
            <p className="text-sm text-gray-400 mb-6 relative z-10">
              Kill switch halts all deposits, withdrawals, and trading. Activation bypasses multi-sig; deactivation requires proposal.
            </p>

            <div className="bg-black/50 rounded-xl p-4 border border-white/5 mb-6 relative z-10">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-medium">System Status</span>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${(isPaused || isKilled) ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-green-500/20 border-green-500/30 text-green-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${(isPaused || isKilled) ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                  {(isPaused || isKilled) ? 'PAUSED / KILLED' : 'OPERATIONAL'}
                </div>
              </div>
            </div>

            <div className="relative z-10">
              {(isPaused || isKilled) ? (
                <button
                  onClick={handleUnpause}
                  disabled={isUnpauseConfirming}
                  className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors border border-white/20 disabled:opacity-50"
                >
                  {isUnpauseConfirming ? "Creating Proposal..." : "CREATE DEACTIVATION PROPOSAL"}
                </button>
              ) : (
                <button
                  onClick={handleKillSwitch}
                  disabled={isKillConfirming}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] disabled:opacity-50"
                >
                  {isKillConfirming ? "Processing..." : "ACTIVATE KILL SWITCH"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
