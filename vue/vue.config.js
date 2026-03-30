const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    port: 8080,  // 前端开发服务器端口
    proxy: {
      '/api': {
        target: 'http://localhost:8089',
        changeOrigin: true,
        // pathRewrite: {
        //   '^/api': ''  // 如果后端接口没有/api前缀，则需要取消注释
        // }
      }
    }
  }
}) 