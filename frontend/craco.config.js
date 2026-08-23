const { removePlugins, pluginByName } = require('@craco/craco');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Remove ForkTsCheckerWebpackPlugin — it crashes on Node 22
      // due to its bundled ajv-keywords incompatibility with ajv v8
      removePlugins(webpackConfig, pluginByName('ForkTsCheckerWebpackPlugin'));
      return webpackConfig;
    },
  },
};
