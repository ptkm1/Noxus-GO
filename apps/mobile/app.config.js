/**
 * Carrega EXPO_PUBLIC_* do .env na raiz do monorepo.
 * Reexporta app.json (Expo usa app.config.js em preferência a app.json estático).
 */
const path = require("path");

try {
  require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
} catch {
  /* dotenv pode não estar instalado em ambientes estranhos */
}

module.exports = require("./app.json");
