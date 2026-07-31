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

const publicApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || "";
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
const buildProfile = process.env.EAS_BUILD_PROFILE?.trim() || "";
const isStoreBuild = buildProfile === "production";
const allowCleartext =
  !isStoreBuild && process.env.EXPO_ALLOW_CLEARTEXT !== "0";
const plugins = (appJson.expo.plugins || []).filter((plugin) => {
  if (!isStoreBuild) return true;
  return plugin !== "expo-dev-client";
});

if (isStoreBuild && !/^https:\/\//i.test(publicApiUrl)) {
  throw new Error(
    "EAS production exige EXPO_PUBLIC_API_URL com HTTPS para submissão às lojas.",
  );
}

/** @type {import("expo/config").ExpoConfig} */
module.exports = {
  ...appJson.expo,
  plugins,
  android: {
    ...appJson.expo.android,
    usesCleartextTraffic: allowCleartext,
    config: {
      ...appJson.expo.android?.config,
      ...(googleMapsApiKey
        ? {
            googleMaps: {
              apiKey: googleMapsApiKey,
            },
          }
        : {}),
    },
  },
  extra: {
    ...appJson.expo.extra,
    apiUrl: publicApiUrl || undefined,
    googleMapsApiKey: googleMapsApiKey || undefined,
    eas: {
      projectId: "533c4fc8-7849-4180-bdb5-5d27fd5be149",
    },
  },
};
