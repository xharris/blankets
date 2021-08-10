const {
  override,
  setWebpackTarget,
  addWebpackAlias,
  addWebpackModuleRule,
  addWebpackResolve
} = require("customize-cra")
const { TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin')
const path = require("path")

module.exports = override(
  setWebpackTarget("electron-renderer"),
  addWebpackAlias({
    ["@src"]: path.resolve(__dirname, 'src'),
    ["@ts"]: path.resolve(__dirname, 'src/ts'),
    ["@sass"]: path.resolve(__dirname, 'src/sass')
  }),
  addWebpackModuleRule({
    test: /\.worker\.[tj]s$/,
    loader: "worker-loader",
  })
)