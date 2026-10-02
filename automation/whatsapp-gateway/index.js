import express from "express";
import axios from "axios";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "redis";
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} from "@whiskeysockets/baileys";
import { resolveInboundIdentity, resolveOutboundJid } from "./identity.js";

const PORT = Number(process.env.WHATSAPP_GATEWAY_PORT || 8081);
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "http://n8n:5678/webhook/whatsapp-inbound";
const FACTURAOF1_API_URL = String(process.env.FACTURAOF1_API_URL || "").replace(/\/+$/, "");
const AUTOMATION_API_TOKEN = process.env.AUTOMATION_API_TOKEN || "";
const WHATSAPP_GATEWAY_TOKEN = process.env.WHATSAPP_GATEWAY_TOKEN || "";
const redisClient = process.env.REDIS_URL ? createClient({ url: process.env.REDIS_URL }) : null;
const markerTtlSeconds = 300;
const localOutboundMarkers = new Map();
const pendingBotSends = new Map();

const app = express();
app.use(express.json({ limit: "10mb" }));

let sock;
let isReady = false;

function backendEndpoint(path) {
  if (!FACTURAOF1_API_URL) return "";
  const apiBase = FACTURAOF1_API_URL.endsWith("/api") ? FACTURAOF1_API_URL : `${FACTURAOF1_API_URL}/api`;
  return `${apiBase}/automation/${path.replace(/^\/+/, "")}`;
}

function gatewayAuthorized(req) {
  const supplied = String(req.get("X-WhatsApp-Gateway-Token") || "");
  if (!WHATSAPP_GATEWAY_TOKEN || supplied.length !== WHATSAPP_GATEWAY_TOKEN.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(WHATSAPP_GATEWAY_TOKEN));
}

async function setOutboundMarker(messageId, marker) {
  if (!messageId) return;
  localOutboundMarkers.set(messageId, { marker, expiresAt: Date.now() + markerTtlSeconds * 1000 });
  if (redisClient?.isReady) {
    try {
      await redisClient.set(`whatsapp:bot-message:${messageId}`, JSON.stringify(marker), { EX: markerTtlSeconds });
    } catch (error) {
      console.warn("No se pudo guardar el marcador saliente en Redis:", error.message);
    }
  }
}

async function getOutboundMarker(messageId) {
  if (!messageId) return null;
  if (redisClient?.isReady) {
    try {
      const raw = await redisClient.get(`whatsapp:bot-message:${messageId}`);
      if (raw) return JSON.parse(raw);
    } catch (error) {
      console.warn("No se pudo leer el marcador saliente de Redis:", error.message);
    }
  }
  const local = localOutboundMarkers.get(messageId);
  if (!local) return null;
  if (local.expiresAt <= Date.now()) {
    localOutboundMarkers.delete(messageId);
    return null;
  }
  return local.marker;
}

async function authorizeBotSend(to) {
  const endpoint = backendEndpoint("gateway/authorize-bot-send/");
  if (!endpoint || !AUTOMATION_API_TOKEN) {
    const error = new Error("Falta configurar la autorización de FacturaOF1 para envíos del bot.");
    error.status = 503;
    throw error;
  }
  const { data } = await axios.post(endpoint, { to }, {
    headers: { "X-Automation-Token": AUTOMATION_API_TOKEN }, timeout: 5000
  });
  return data?.allowed === true;
}

async function sendWhatsAppText({ to, message, senderType = "AI", origin = "n8n" }) {
  if (!sock || !isReady) {
    const error = new Error("WhatsApp no está conectado todavía.");
    error.status = 503;
    throw error;
  }
  // A final handoff acknowledgement is the only AI-originated send allowed
  // after the backend has moved the conversation to HUMAN_PENDING.
  if (senderType === "AI" && origin !== "n8n_handoff_ack" && !(await authorizeBotSend(to))) {
    const error = new Error("El bot está pausado para esta conversación.");
    error.status = 409;
    throw error;
  }
  const jid = resolveOutboundJid(to);
  const pending = pendingBotSends.get(jid) || { count: 0, marker: { sender_type: senderType, origin } };
  pending.count += 1;
  pending.marker = { sender_type: senderType, origin };
  pendingBotSends.set(jid, pending);
  try {
    const result = await sock.sendMessage(jid, { text: message });
    const messageId = String(result?.key?.id || "");
    await setOutboundMarker(messageId, { sender_type: senderType, origin });
    return { to: jid, message_id: messageId, message: "Mensaje enviado." };
  } finally {
    const current = pendingBotSends.get(jid);
    if (current) {
      current.count -= 1;
      if (current.count <= 0) pendingBotSends.delete(jid);
    }
  }
}

async function reportManualOutbound(message) {
  const endpoint = backendEndpoint("gateway/manual-outbound/");
  if (!endpoint || !AUTOMATION_API_TOKEN) {
    console.error("Mensaje manual detectado, pero falta configurar la API autenticada de FacturaOF1.");
    return;
  }
  const identity = resolveInboundIdentity(message);
  const { text, messageType, hasMedia } = getMessagePayload(message);
  const messageId = String(message.key?.id || "");
  const lockKey = `whatsapp:manual-outbound:${messageId}`;
  let claimed = false;
  if (redisClient?.isReady && messageId) {
    try {
      const result = await redisClient.set(lockKey, "processing", { EX: markerTtlSeconds, NX: true });
      if (result !== "OK") return;
      claimed = true;
    } catch (error) {
      console.warn("No se pudo reservar idempotencia del mensaje manual:", error.message);
    }
  }
  try {
    await axios.post(endpoint, {
      ...identity,
      direction: "OUTBOUND",
      sender_type: "HUMAN",
      origin: "whatsapp_manual",
      body: text,
      channel: "whatsapp",
      message_id: messageId,
      message_type: messageType,
      timestamp: Number(message.messageTimestamp || Math.floor(Date.now() / 1000)),
      has_media: hasMedia
    }, { headers: { "X-Automation-Token": AUTOMATION_API_TOKEN }, timeout: 8000 });
    if (messageId) await setOutboundMarker(messageId, { sender_type: "HUMAN", origin: "whatsapp_manual" });
    console.log("HUMAN_OUTBOUND registrado en FacturaOF1.", { messageId });
  } catch (error) {
    if (claimed && redisClient?.isReady) {
      try { await redisClient.del(lockKey); } catch { /* permite reintento del evento */ }
    }
    console.error("No se pudo registrar el mensaje humano en FacturaOF1:", error.response?.data || error.message);
  }
}


function getMessagePayload(message) {
  const content = message.message || {};
  const text =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    '';

  let messageType = 'unknown';
  if (content.conversation || content.extendedTextMessage) messageType = 'text';
  else if (content.imageMessage) messageType = 'image';
  else if (content.audioMessage) messageType = 'audio';
  else if (content.videoMessage) messageType = 'video';
  else if (content.documentMessage) messageType = 'document';

  return {
    text,
    messageType,
    hasMedia: ['image', 'audio', 'video', 'document'].includes(messageType)
  };
}

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log("Usando versión de WhatsApp Web:", version, {
    isLatest
  });

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("======================================");
      console.log("Escanea este QR con WhatsApp:");
      qrcode.generate(qr, { small: true });
      console.log("======================================");
    }

    if (connection === "open") {
      isReady = true;
      console.log("WhatsApp conectado correctamente.");
    }

    if (connection === "close") {
      isReady = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log("WhatsApp desconectado.", { statusCode, shouldReconnect });

      if (shouldReconnect) {
        setTimeout(startWhatsApp, 3000);
      } else {
        console.log(
          "Sesión cerrada. Borra whatsapp-gateway/session y vuelve a escanear QR."
        );
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    const message = messages?.[0];

    if (!message) return;

    const remoteJid = String(message.key?.remoteJid || "");
    const fromJid = String(message.key?.participant || remoteJid);
    const messageId = message.key?.id || "";

    if (message.key?.fromMe) {
      if (remoteJid === "status@broadcast" || remoteJid.endsWith("@broadcast") || remoteJid.endsWith("@g.us")) {
        console.log("Ignorando mensaje propio de estado/grupo", { messageId });
        return;
      }
      if (type !== "notify") {
        console.log("Ignorando mensaje propio fuera de notificación nueva", { messageId });
        return;
      }
      const marker = await getOutboundMarker(messageId);
      const pending = pendingBotSends.get(remoteJid);
      if (marker) {
        console.log(marker.sender_type === "HUMAN" ? "FACTURAOF1_OUTBOUND" : "BOT_OUTBOUND", { messageId, origin: marker.origin });
        return;
      }
      if (pending) {
        await setOutboundMarker(messageId, pending.marker);
        console.log(pending.marker.sender_type === "HUMAN" ? "FACTURAOF1_OUTBOUND" : "BOT_OUTBOUND", { messageId, origin: pending.marker.origin });
        return;
      }
      await reportManualOutbound(message);
      return;
    }

    if (
      remoteJid === "status@broadcast" ||
      fromJid === "status@broadcast" ||
      remoteJid.endsWith("@broadcast")
    ) {
      console.log("Ignorando estado/broadcast", { remoteJid, fromJid, messageId });
      return;
    }

    if (remoteJid.endsWith("@g.us")) {
      console.log("Ignorando grupo", { remoteJid, fromJid, messageId });
      return;
    }

    const { text, messageType, hasMedia } = getMessagePayload(message);
    if (!String(text).trim()) {
      console.log("Ignorando mensaje sin texto", { remoteJid, fromJid, messageId });
      return;
    }

    const identity = resolveInboundIdentity(message);
    const timestamp = Number(message.messageTimestamp || Math.floor(Date.now() / 1000));

    const inboundPayload = {
      ...identity,
      body: text,
      channel: "whatsapp",
      message_id: messageId,
      message_type: messageType,
      timestamp,
      has_media: hasMedia
    };

    console.log("Mensaje recibido:", {
      contact_key: identity.contact_key,
      phone: identity.phone,
      reply_to_jid: identity.reply_to_jid,
      key: message.key,
      text,
      messageType,
      messageId
    });

    try {
      await axios.post(N8N_WEBHOOK_URL, inboundPayload);
    } catch (error) {
      console.error(
        "Error enviando mensaje a n8n:",
        error.response?.data || error.message
      );
    }
  });
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    ready: isReady,
    redis_ready: Boolean(redisClient?.isReady)
  });
});

app.post("/sendText", async (req, res) => {
  try {
    if (!sock || !isReady) {
      return res.status(503).json({
        ok: false,
        message: "WhatsApp no está conectado todavía."
      });
    }

    const to = req.body.to || req.body.phone || req.body.args?.[0];
    const message = req.body.message || req.body.text || req.body.args?.[1];

    if (!to || !message) {
      return res.status(400).json({
        ok: false,
        message: "Debe enviar to/phone y message/text."
      });
    }

    const result = await sendWhatsAppText({ to, message, senderType: "AI", origin: "n8n" });
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error enviando WhatsApp:", error.message);
    res.status(error.status || error.response?.status || 500).json({
      ok: false,
      message: error.message
    });
  }
});

app.post("/internal/sendText", async (req, res) => {
  if (!gatewayAuthorized(req)) return res.status(401).json({ ok: false, message: "No autorizado." });
  try {
    const to = req.body.to || req.body.phone;
    const message = String(req.body.message || "").trim();
    const senderType = req.body.sender_type === "AI" ? "AI" : "HUMAN";
    const origin = senderType === "AI" ? String(req.body.origin || "n8n") : "facturaof1";
    if (!to || !message) return res.status(400).json({ ok: false, message: "Debe enviar to y message." });
    const result = await sendWhatsAppText({ to, message, senderType, origin });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(error.status || error.response?.status || 500).json({ ok: false, message: error.message });
  }
});

if (process.env.WHATSAPP_GATEWAY_SKIP_START !== "true") {
  app.listen(PORT, () => {
    console.log(`WhatsApp Gateway escuchando en puerto ${PORT}`);
  });

  if (redisClient) {
    redisClient.on("error", (error) => console.error("Redis gateway error:", error.message));
    redisClient.connect().catch((error) => console.error("Redis no disponible; usando marcadores locales temporales:", error.message));
  } else {
    console.warn("REDIS_URL no configurado; los marcadores salientes solo vivirán en memoria.");
  }

  startWhatsApp().catch((error) => {
    console.error("Error iniciando WhatsApp:", error);
    process.exit(1);
  });
}
