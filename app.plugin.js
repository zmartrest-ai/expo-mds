/** @type {import('@expo/config-plugins')} */
const { withProjectBuildGradle } = require("@expo/config-plugins");

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withMdsLib = (config) =>
  withProjectBuildGradle(config, (config) => {
    const {
      modResults: { contents },
    } = config;

    const [before, after] = contents.split("allprojects");

    // make it work so it replaces repositories under allprojects instead of buildscript
    const newAfter = after.replace(
      /repositories\W?{/,
      'repositories {\n        flatDir { dirs "$rootDir/../node_modules/expo-mds/android/src/main/libs" }\n'
    );

    config.modResults.contents = before + "allprojects" + newAfter;

    return config;
  });

module.exports = withMdsLib;
