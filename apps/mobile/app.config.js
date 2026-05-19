/**
 * Carrega EXPO_PUBLIC_* do .env na raiz do monorepo.
 * Expo usa app.config.js em preferência a app.json estático.
 */
const path = require("path");

try {
  require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
} catch {
  /* dotenv pode não estar instalado em ambientes estranhos */
}

/** @type {import("./app.json")} */
const appJson = require("./app.json");

/** @type {import("expo/config").ExpoConfig} */
module.exports = {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    eas: {
      projectId: "533c4fc8-7849-4180-bdb5-5d27fd5be149",
    },
  },
};
