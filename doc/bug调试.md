当前 uniCloud H5 已通过 HBuilderX 正式发行。

生产前端使用：

uniCloud.callFunction({
    name: 'game-service',
    data: ...
})

浏览器实际请求：

POST https://api.next.bspapp.com/client

返回：

HTTP 400
Required request body is missing

game-service 是普通云函数，入口 exports.main 正确，不要修改 game-service
为 module.exports。

请重点排查项目是否存在 uni.request 全局 interceptor、request wrapper、
uni.addInterceptor('request') 或对 uni.request 的覆写。

DCloud callFunction 内部依赖 uni.request。现在症状说明 callFunction 请求的
POST body 很可能被项目的 request interceptor 修改或清空。

任务：

1. 搜索 apps、packages、config：
   - uni.addInterceptor
   - uni.request
   - addInterceptor
   - request interceptor
   - invoke(args)
   - uni.request =

2. 检查 client/workbench/admin 的 production API Adapter。

3. 确认 callFunction 调用保持：

   uniCloud.callFunction({
     name: 'game-service',
     data: {
       action,
       payload,
       ...现有真实字段
     }
   })

4. 如果存在全局 request interceptor：
   - 不得修改 uniCloud.callFunction 内部请求
   - api.next.bspapp.com/client 必须原样放行
   - 不得清空或覆盖 args.data
   - 不得改变 method
   - 不得重写 URL

5. 更推荐把本地 HTTP 拦截逻辑限制在 Local API Adapter 内，
   不要全局污染 uni.request。

6. 不修改 game-service 的 exports.main。

7. 修改后用 HBuilderX 重新发行 Client Web。

8. 验证浏览器 Network：
   POST https://api.next.bspapp.com/client
   Request Body 必须非空
   HTTP 不再返回 400 Required request body is missing。

9. 最终告诉我修改了哪些文件。