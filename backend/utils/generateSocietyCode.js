const Society = require("../models/Society");

async function generateSocietyCode(name) {

  const prefix = name
    .replace(/[^a-zA-Z]/g, "")
    .substring(0,3)
    .toUpperCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const code =prefix+randomNum;

    return code;

}

module.exports = generateSocietyCode;