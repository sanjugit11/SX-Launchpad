"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";

const ADMIN_LINKS = [
  { name: "Governance", href: "/admin/governance", icon: Shield },
  { name: "Threat Intelligence", href: "/admin/jailbreak", icon: ShieldAlert },
  { name: "Formal Verification", href: "/admin/verification", icon: ShieldCheck },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-white/10 mb-8 bg-white/5 rounded-xl p-1 max-w-2xl">
      {ADMIN_LINKS.map((link) => {
        const isActive = pathname === link.href;
        const Icon = link.icon;
        
        return (
          <Link
            key={link.name}
            href={link.href}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-lg transition-all ${
              isActive
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-gray-400"}`} />
            {link.name}
          </Link>
        );
      })}
    </div>
  );
}
