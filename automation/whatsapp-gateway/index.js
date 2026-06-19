import express from "express";
import axios from "axios";
import qrcode from "qrcode-terminal";
import pino from "pino";
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

const app = express();
app.use(express.json({ limit: "10mb" }));

let sock;
let isReady = false;


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

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages?.[0];

    if (!message) return;

    const remoteJid = String(message.key?.remoteJid || "");
    const fromJid = String(message.key?.participant || remoteJid);
    const messageId = message.key?.id || "";

    if (message.key?.fromMe) {
      console.log("Ignorando mensaje propio", { remoteJid, fromJid, messageId });
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
    ready: isReady
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

    const jid = resolveOutboundJid(to);

    await sock.sendMessage(jid, { text: message });

    res.json({
      ok: true,
      to: jid,
      message: "Mensaje enviado."
    });
  } catch (error) {
    console.error("Error enviando WhatsApp:", error);
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

if (process.env.WHATSAPP_GATEWAY_SKIP_START !== "true") {
  app.listen(PORT, () => {
    console.log(`WhatsApp Gateway escuchando en puerto ${PORT}`);
  });

  startWhatsApp().catch((error) => {
    console.error("Error iniciando WhatsApp:", error);
    process.exit(1);
  });
}
