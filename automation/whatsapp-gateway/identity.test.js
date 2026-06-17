import assert from "node:assert/strict";
import { resolveInboundIdentity, resolveOutboundJid } from "./identity.js";

const cases = [
  ["593999999999", "593999999999@s.whatsapp.net"],
  ["593999999999@s.whatsapp.net", "593999999999@s.whatsapp.net"],
  ["279868742840481@lid", "279868742840481@lid"],
  ["120363000000000000@g.us", "120363000000000000@g.us"]
];

for (const [input, expected] of cases) {
  assert.equal(resolveOutboundJid(input), expected);
}

const phoneIdentity = resolveInboundIdentity({
  key: {
    remoteJid: "593999999999@s.whatsapp.net"
  },
  pushName: "Cliente"
});
assert.equal(phoneIdentity.phone, "593999999999");
assert.equal(phoneIdentity.contact_key, "593999999999");
assert.equal(phoneIdentity.reply_to_jid, "593999999999@s.whatsapp.net");
assert.equal(phoneIdentity.is_lid, false);

const lidWithPhoneRemoteIdentity = resolveInboundIdentity({
  key: {
    remoteJid: "593999999999@s.whatsapp.net",
    participant: "279868742840481@lid"
  }
});
assert.equal(lidWithPhoneRemoteIdentity.phone, "593999999999");
assert.equal(lidWithPhoneRemoteIdentity.contact_key, "593999999999");
assert.equal(lidWithPhoneRemoteIdentity.from_jid, "279868742840481@lid");
assert.equal(lidWithPhoneRemoteIdentity.reply_to_jid, "593999999999@s.whatsapp.net");
assert.equal(lidWithPhoneRemoteIdentity.is_lid, true);

const lidOnlyIdentity = resolveInboundIdentity({
  key: {
    remoteJid: "279868742840481@lid"
  }
});
assert.equal(lidOnlyIdentity.phone, null);
assert.equal(lidOnlyIdentity.contact_key, "279868742840481@lid");
assert.equal(lidOnlyIdentity.reply_to_jid, "279868742840481@lid");
assert.equal(lidOnlyIdentity.is_lid, true);

const lidWithSenderPnIdentity = resolveInboundIdentity({
  key: {
    remoteJid: "279868742840481@lid",
    senderPn: "593999999999@s.whatsapp.net"
  }
});
assert.equal(lidWithSenderPnIdentity.phone, "593999999999");
assert.equal(lidWithSenderPnIdentity.contact_key, "593999999999");
assert.equal(lidWithSenderPnIdentity.reply_to_jid, "279868742840481@lid");
assert.equal(lidWithSenderPnIdentity.is_lid, true);

console.log("WhatsApp identity checks passed.");
