const crypto = require("node:crypto");

const Society = require("../models/Society");

// =======================================================
// SOCIETY CODE
//
// Six digits. A salesperson reads this out to a secretary over the
// phone and a resident types it into six boxes on their phone, so
// digits beat the previous ABC1234 form — nothing to spell out, no
// case to get wrong, and no letter/digit confusion (O/0, I/1).
//
// One million combinations, and codes are checked for collision on
// creation rather than trusted to chance.
// =======================================================

const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 10;

const randomCode = () => {

  // crypto rather than Math.random: this is the only credential
  // standing between a stranger and a society's flat list.
  const max = 10 ** CODE_LENGTH;

  return String(crypto.randomInt(0, max)).padStart(CODE_LENGTH, "0");

};

async function generateSocietyCode() {

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {

    const code = randomCode();

    const taken = await Society.exists({ societyCode: code });

    if (!taken) {
      return code;
    }

  }

  // A million codes and ten collisions in a row means the space is
  // genuinely crowded — better to fail loudly than loop forever.
  throw new Error(
    "Could not generate a unique society code. The code space may be exhausted."
  );

}

module.exports = generateSocietyCode;
module.exports.CODE_LENGTH = CODE_LENGTH;
