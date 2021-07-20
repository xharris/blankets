// const { resolve } = require("path")
const CracoAlias = require("craco-alias")

// let target = 'web'
// if (process.env.REACT_APP_MODE === 'electron')
//    target = 'electron-renderer'

module.exports = {
   webpack: {
      configure: {
         target: 'electron-renderer'
      }
   },
   plugins: [
      {
         plugin: CracoAlias,
         options: {
            source: "tsconfig",
            // baseUrl SHOULD be specified
            // plugin does not take it from tsconfig
            baseUrl: "./src",
            /* tsConfigPath should point to the file where "baseUrl" and "paths" 
            are specified*/
            tsConfigPath: "./tsconfig.paths.json"
         }
      }
   ]
  // webpack: {
  //   alias: {
  //     src: resolve(__dirname, "./src"),
  //     ts: resolve(__dirname, "./src/ts"),
  //     sass: resolve(__dirname, "./src/sass"),
  //   }
  // }
}
