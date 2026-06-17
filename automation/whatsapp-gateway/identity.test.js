import assert from "node:assert/strict";
import { resolveOutboundJid } from "./identity.js";

const cases = [
  ["593999999999", "593999999999@s.whatsapp.net"],
  ["593999999999@s.whatsapp.net", "593999999999@s.whatsapp.net"],
  ["279868742840481@lid", "279868742840481@lid"],
  ["120363000000000000@g.us", "120363000000000000@g.us"]
];

for (const [input, expected] of cases) {
  assert.equal(resolveOutboundJid(input), expected);
}

console.log("WhatsApp identity checks passed.");
