/** @type {import('@expo/config-plugins')} */
const {
  withProjectBuildGradle,
  withDangerousMod,
  withPlugins,
  withAndroidManifest,
  createRunOncePlugin,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const configureProjectBuildGradle = (cfg) =>
  withProjectBuildGradle(cfg, (config) => {
    const {
      modResults: { contents },
    } = config;

    const [before, after] = contents.split("allprojects");
    const flatDir =
      'flatDir { dirs "$rootDir/../node_modules/expo-mds/android" }';
    // make it work so it replaces repositories under allprojects instead of buildscript
    const newAfter = after.includes(flatDir)
      ? after
      : after.replace(
          /repositories\W?{/,
          `repositories {\n        ${flatDir}\n`
        );

    config.modResults.contents = before + "allprojects" + newAfter;

    return config;
  });

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
      const src = path.join(
        config.modRequest.platformProjectRoot,
        "../node_modules/expo-mds/android/mdslib-1.68.0-without-libc++_shared.aar"
      );
      const libs = path.join(config.modRequest.platformProjectRoot, "libs");
      const dest = path.join(libs, "mdslib-1.68.0-without-libc++_shared.aar");

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
    configureProjectBuildGradle,
    configureAndroidPermissions,
  ]);
};

module.exports = createRunOncePlugin(mdsPlugins, pkg.name, pkg.version);
