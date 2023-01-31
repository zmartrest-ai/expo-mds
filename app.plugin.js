/** @type {import('@expo/config-plugins')} */
const { withProjectBuildGradle } = require("@expo/config-plugins");

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withMdsLib = (config) =>
  withProjectBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      "repositories {",
      'repositories {\nflatDir { dirs "$rootDir/../node_modules/expo-mds/android/src/main/libs" }\n'
    );

    return config;
  });

module.exports = withMdsLib;
