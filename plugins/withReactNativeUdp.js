const { withSettingsGradle, withAppBuildGradle, createRunOncePlugin } = require('expo/config-plugins');

/**
 * Expo Config Plugin สำหรับบังคับ link react-native-udp เข้า Android native build
 * เพราะ expo-modules-autolinking อาจไม่ autolink community RN modules ที่ไม่ใช่ Expo Module
 */
function withReactNativeUdp(config) {
  // 1. เพิ่ม include ':react-native-udp' ใน settings.gradle
  config = withSettingsGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes(':react-native-udp')) {
      config.modResults.contents = contents +
        `\ninclude ':react-native-udp'\n` +
        `project(':react-native-udp').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-udp/android')\n`;
    }
    return config;
  });

  // 2. เพิ่ม implementation project(':react-native-udp') ใน app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes("project(':react-native-udp')")) {
      config.modResults.contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation project(':react-native-udp')`
      );
    }
    return config;
  });

  return config;
}

module.exports = createRunOncePlugin(withReactNativeUdp, 'react-native-udp', '4.1.7');
