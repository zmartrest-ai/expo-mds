/** @type {import('@expo/config-plugins')} */
const {
  withProjectBuildGradle,
  withAppBuildGradle,
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

    // make it work so it replaces repositories under allprojects instead of buildscript
    const newAfter = after.includes(
      'flatDir { dirs "$rootDir/../node_modules/expo-mds/android" }'
    )
      ? after
      : after.replace(
          /repositories\W?{/,
          'repositories {\n        flatDir { dirs "$rootDir/../node_modules/expo-mds/android" }\n'
        );

    config.modResults.contents = before + "allprojects" + newAfter;

    return config;
  });

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const configureAppBuildGradle = (cfg) =>
  withAppBuildGradle(cfg, (config) => {
    const {
      modResults: { contents },
    } = config;

    // make it work so it replaces repositories under allprojects instead of buildscript
    const updated = contents.includes(
      ` packagingOptions { pickFirst '**/libc++_shared.so' }`
    )
      ? contents
      : contents.replace(
          /android\W?{/,
          `android {\npackagingOptions { pickFirst '**/libc++_shared.so' }\n\n`
        );

    config.modResults.contents = updated;

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

const configureAndroidPermissions = (config) => {
  return withAndroidManifest(config, (config) => {
    config.modResults.manifest["uses-permission"] = [
      ...config.modResults.manifest["uses-permission"],
      { $: { "android:name": "android.permission.BLUETOOTH" } },
      { $: { "android:name": "android.permission.BLUETOOTH_ADMIN" } },
      { $: { "android:name": "android.permission.BLUETOOTH_SCAN" } },
      { $: { "android:name": "android.permission.ACCESS_COARSE_LOCATION" } },
      { $: { "android:name": "android.permission.ACCESS_FINE_LOCATION" } },
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
    configureAppBuildGradle,
    configureProjectBuildGradle,
    configureAndroidPermissions,
  ]);
};

module.exports = createRunOncePlugin(mdsPlugins, pkg.name, pkg.version);
