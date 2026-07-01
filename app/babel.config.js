module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 uses react-native-worklets; its plugin MUST stay last.
    plugins: ['react-native-worklets/plugin'],
  };
};
