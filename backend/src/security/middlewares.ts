import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';

const prisma = new PrismaClient();

const extractStrings = (val: any): string[] => {
  if (typeof val === 'string') return [val];
  if (Array.isArray(val)) return val.flatMap(extractStrings);
  if (val && typeof val === 'object') {
    try {
      return Object.values(val).flatMap(extractStrings);
    } catch {
      return [];
    }
  }
  return [];
};

export const inputFilterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // 1. DoS Mitigation: Size limit check
  const contentLength = req.headers['content-length'] 
    ? parseInt(req.headers['content-length'], 10) 
    : 0;

  if (contentLength > 50 * 1024) { // 50KB limit
    return res.status(413).json({ error: "Payload Too Large: Threat mitigation active." });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString().split(',')[0].trim();
  const wallet = (req.body?.wallet || req.headers['x-wallet'] || 'unknown').toString().toLowerCase();

  // 2. Persistent Lockout Check: Query DB for attempts within the last 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const filterConditions = [];
  if (wallet !== 'unknown') filterConditions.push({ wallet });
  if (ip !== 'unknown') filterConditions.push({ ip });

  if (filterConditions.length > 0) {
    const activeViolations = await prisma.jailbreakAttempt.count({
      where: {
        OR: filterConditions,
        timestamp: { gte: tenMinutesAgo }
      }
    });

    if (activeViolations >= 5) {
      return res.status(429).json({ error: "System Locked: Too many violations. Try again in 10 minutes." });
    }
  }

  // 3. Regex-based Jailbreak Detection
  const strings = extractStrings(req.body);
  const normalizedStrings = strings.map(s => 
    s.normalize("NFKC")
     .replace(/[\p{P}\p{S}]/gu, " ") // Replace punctuation/symbols with spaces
     .replace(/\s+/g, " ")            // Compress multiple spaces
     .toLowerCase()
  );

  const jailbreakRegexes = [
    { pattern: "ignore instructions", regex: /ignore\s*(?:previous\s*)?instructions/i },
    { pattern: "dan mode", regex: /\bdan\b/i },
    { pattern: "developer mode", regex: /developer\s*mode/i },
    { pattern: "roleplay", regex: /\broleplay\b/i },
    { pattern: "system prompt", regex: /system\s*prompt/i },
    { pattern: "forget instructions", regex: /forget\s*all\s*instructions/i }
  ];

  const matched = jailbreakRegexes.find(item => 
    normalizedStrings.some(s => item.regex.test(s))
  );

  if (matched) {
    // Log violation to database
    await prisma.jailbreakAttempt.create({
      data: {
        wallet: wallet !== 'unknown' ? wallet : null,
        ip: ip !== 'unknown' ? ip : null,
        pattern: matched.pattern,
      }
    });

    // Check if lockout threshold was reached by this violation
    if (filterConditions.length > 0) {
      const activeViolationsAfter = await prisma.jailbreakAttempt.count({
        where: {
          OR: filterConditions,
          timestamp: { gte: tenMinutesAgo }
        }
      });

      if (activeViolationsAfter >= 5) {
        return res.status(429).json({ error: "System Locked: Too many violations. Try again in 10 minutes." });
      }
    }

    return res.status(403).json({ error: "Security Violation Detected." });
  }

  next();
};

export const dpopMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const dpopToken = req.headers['dpop'];
  const deviceId = req.headers['x-device-id'] as string;
  const wallet = req.headers['x-wallet'] as string;

  if (!dpopToken || !deviceId || !wallet) {
    return res.status(401).json({ error: "DPoP Validation Failed: Missing headers (dpop, x-device-id, x-wallet)." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() }
    });

    if (!user || !user.device_id) {
      return res.status(401).json({ error: "DPoP Validation Failed: No device registered for this wallet." });
    }

    if (user.device_id.toLowerCase() !== deviceId.toLowerCase()) {
      return res.status(401).json({ error: "DPoP Validation Failed: DPoP token from different device rejected." });
    }

    if (req.body) {
      req.body.deviceId = deviceId;
    }
    (req as any).deviceId = deviceId;
    next();
  } catch (e: any) {
    console.error("DPoP validation error:", e.message);
    return res.status(500).json({ error: "Internal security check error" });
  }
};

// Rate Limiters
export const apiLimiterMinute = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString().split(',')[0].trim();
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
  message: { error: "Too many requests from this IP, please try again after a minute." }
});

export const apiLimiterDay = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1000, // Limit each IP to 1000 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString().split(',')[0].trim();
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
  message: { error: "Too many requests from this IP, please try again after 24 hours." }
});
