/** @type {import('@expo/config-plugins')} */
const {
  withDangerousMod,
  withPlugins,
  withAndroidManifest,
  withInfoPlist,
  createRunOncePlugin,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withPodfile(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const filePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      const contents = fs.readFileSync(filePath, "utf-8");

      const newContents = !contents.includes("movesense")
        ? contents.replace(
            /post_install do \|installer\|/,
            ` pod 'Movesense', :git => 'https://bitbucket.org/movesense/movesense-mobile-lib.git'\n\n post_install do |installer|`,
          )
        : contents;

      fs.writeFileSync(filePath, newContents, { encoding: "utf-8" });

      return config;
    },
  ]);
}

// modified mdslib to remove libc++_shared as described here: https://stefanmajiros.medium.com/how-to-integrate-zoom-sdk-into-react-native-47492d4e46a6
/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withCopyMdsAARfile(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      // Copy mds lib to android folder
      const mdsLibPath =
        process.env.EXPO_PUBLIC_MDS_LIB_PATH ??
        path.join(
          config.modRequest.platformProjectRoot,
          "../node_modules/expo-mds/android/libs/",
        );
      console.log("mdsLibPath", mdsLibPath);
      const src = path.join(mdsLibPath, "mdslib-3.15.0(1)-release.aar");
      const libs = path.join(config.modRequest.platformProjectRoot, "libs");
      const dest = path.join(libs, "mdslib-3.15.0(1)-release.aar");

      if (!fs.existsSync(dest)) {
        fs.mkdirSync(libs);
        fs.copyFileSync(src, dest);
      }

      return config;
    },
  ]);
}

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withAndroidPermissions(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults.manifest["uses-permission"] = [
      ...(config.modResults.manifest["uses-permission"] ?? []),
      { $: { "android:name": "android.permission.BLUETOOTH" } },
      { $: { "android:name": "android.permission.BLUETOOTH_ADMIN" } },
      { $: { "android:name": "android.permission.BLUETOOTH_SCAN" } },
      { $: { "android:name": "android.permission.ACCESS_COARSE_LOCATION" } },
      { $: { "android:name": "android.permission.ACCESS_FINE_LOCATION" } },
      { $: { "android:name": "android.permission.BLUETOOTH_CONNECT" } },
      {
        $: { "android:name": "android.permission.ACCESS_BACKGROUND_LOCATION" },
      },
    ];

    config.modResults.manifest["uses-feature"] = [
      ...(config.modResults.manifest["uses-feature"] ?? []),
      {
        $: {
          "android:name": "android.hardware.bluetooth_le",
          "android:required": "true",
        },
      },
    ];

    return config;
  });
}

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withIOSPermissions(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.NSBluetoothAlwaysUsageDescription =
      config.modResults.NSBluetoothAlwaysUsageDescription ||
      "Use bluetooth to scan for sensor";

    return config;
  });
}

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withBLEBackgroundModes(config) {
  return withInfoPlist(config, (config) => {
    if (config.modResults.UIBackgroundModes?.includes("bluetooth-peripheral")) {
      return config;
    }

    const backgroundModes = config.modResults.UIBackgroundModes ?? [];
    backgroundModes.push("bluetooth-peripheral");

    config.modResults.UIBackgroundModes = backgroundModes;

    return config;
  });
}

const pkg = require("./package.json");

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const mdsPlugins = (config) => {
  return withPlugins(config, [
    withPodfile,
    withCopyMdsAARfile,
    withAndroidPermissions,
    withIOSPermissions,
    withBLEBackgroundModes,
  ]);
};

module.exports = createRunOncePlugin(mdsPlugins, pkg.name, pkg.version);
