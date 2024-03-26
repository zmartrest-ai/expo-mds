/** @type {import('@expo/config-plugins')} */
const {
  withDangerousMod,
  withPlugins,
  withAndroidManifest,
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
        "Podfile"
      );
      const contents = fs.readFileSync(filePath, "utf-8");

      const newContents = !contents.includes("movesense")
        ? contents.replace(
            /post_install do \|installer\|/,
            ` pod 'Movesense', :git => 'https://bitbucket.org/movesense/movesense-mobile-lib.git'\n\n post_install do |installer|`
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

const configureAndroidPermissions = (config) => {
  return withAndroidManifest(config, (config) => {
    config.modResults.manifest["uses-permission"] = [
      ...config.modResults.manifest["uses-permission"],
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

    return config;
  });
};

const pkg = require("./package.json");

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const mdsPlugins = (config) => {
  return withPlugins(config, [
    withPodfile,
    withCopyMdsAARfile,
    configureAndroidPermissions,
  ]);
};

module.exports = createRunOncePlugin(mdsPlugins, pkg.name, pkg.version);
