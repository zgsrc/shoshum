const { signAsync } = require("@electron/osx-sign");

const developerIdFingerprint = "58C04F14554D34A1D75D7CF3AD257A7F0B97FCA8";

module.exports = async function signMacApp(options) {
  await signAsync({
    ...options,
    identity: developerIdFingerprint,
  });
};
