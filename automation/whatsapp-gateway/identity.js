export function isPhoneJid(jid = "") {
  return String(jid || "").endsWith("@s.whatsapp.net");
}

export function isLidJid(jid = "") {
  return String(jid || "").endsWith("@lid");
}

export function phoneFromJid(jid = "") {
  if (!isPhoneJid(jid)) return null;
  return String(jid).replace("@s.whatsapp.net", "");
}

function firstPhoneFromJids(...jids) {
  for (const jid of jids) {
    const phone = phoneFromJid(jid);
    if (phone) return phone;
  }
  return null;
}

export function normalizePhone(phone) {
  const raw = String(phone || "").replace(/\D/g, "");
  if (!raw) return null;

  let normalized = raw;

  if (normalized.startsWith("0")) {
    normalized = `593${normalized.substring(1)}`;
  }

  if (!normalized.startsWith("593") && normalized.length === 9) {
    normalized = `593${normalized}`;
  }

  return `${normalized}@s.whatsapp.net`;
}

export function resolveOutboundJid(to) {
  const raw = String(to || "").trim();
  if (!raw) return null;
  if (raw.includes("@")) {
    return raw.replace("@c.us", "@s.whatsapp.net");
  }
  return normalizePhone(raw);
}

export function resolveInboundIdentity(message) {
  const key = message?.key || {};
  const remoteJid = key.remoteJid || "";
  const fromJid = key.participant || remoteJid;
  const phone = firstPhoneFromJids(
    key.senderPn,
    key.participantPn,
    key.remoteJidAlt,
    key.participantAlt,
    key.remoteJid,
    key.participant
  );
  const contactKey = phone || fromJid || remoteJid;

  return {
    phone,
    contact_key: contactKey,
    from_jid: fromJid,
    remote_jid: remoteJid,
    reply_to_jid: remoteJid,
    from: phone || contactKey,
    push_name: message?.pushName || "",
    is_lid: isLidJid(fromJid) || isLidJid(remoteJid)
  };
}
