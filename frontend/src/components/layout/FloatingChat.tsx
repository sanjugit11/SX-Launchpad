"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Bot, ShieldAlert, Sparkles, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "system";
  isError?: boolean;
}

export default function FloatingChat() {
  const { address } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hello! I am your SX Launchpad AI Assistant. How can I help you manage your Unified Account or navigate the platform today?",
      sender: "ai",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue;
    setInputValue("");
    
    // Add user message
    const userMessageId = Math.random().toString(36).substring(7);
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, text: userText, sender: "user" },
    ]);
    
    setIsLoading(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (address) {
        headers["x-wallet"] = address.toLowerCase();
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userText,
          wallet: address || "unknown",
        }),
      });

      const data = await res.json();

      if (res.status === 403) {
        // Jailbreak pattern detected
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            text: "Security Violation: Jailbreak pattern detected! This incident has been logged in the Threat Intelligence registry.",
            sender: "system",
            isError: true,
          },
        ]);
      } else if (res.status === 429) {
        // Locked out
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            text: data.error || "Rate limit exceeded or system lockout active. Too many security violations detected. Try again in 10 minutes.",
            sender: "system",
            isError: true,
          },
        ]);
      } else if (res.ok) {
        // Success
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            text: data.message,
            sender: "ai",
          },
        ]);
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          text: `Error connecting to assistant: ${err.message}`,
          sender: "system",
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-2xl hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all border border-indigo-400/30 cursor-pointer"
        >
          {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>

      {/* Chat Window Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-80 sm:w-[380px] h-[500px] z-50 glass-panel border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden bg-black/80 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-indigo-950/60 to-purple-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    SX CoPilot <Sparkles className="w-3 h-3 text-indigo-400" />
                  </h3>
                  <span className="text-[10px] text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
                    Online
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => {
                if (msg.sender === "system") {
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 p-3 rounded-xl text-xs border ${
                        msg.isError
                          ? "bg-red-500/10 border-red-500/20 text-red-300"
                          : "bg-white/5 border-white/10 text-gray-300"
                      }`}
                    >
                      {msg.isError ? (
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                      )}
                      <span>{msg.text}</span>
                    </div>
                  );
                }

                const isUser = msg.sender === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        isUser
                          ? "bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/10"
                          : "bg-white/5 border border-white/10 text-zinc-100 rounded-bl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-none px-4 py-3 flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-4 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask SX CoPilot..."
                disabled={isLoading}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="h-10 w-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
