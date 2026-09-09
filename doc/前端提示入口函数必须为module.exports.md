# 前端提示“入口函数必须为 module.exports”分析结论

## 一、现象

测试地址：

`https://static-mp-d55868c9-2e64-41c5-baf6-ecbb16b511be.next.bspapp.com/#/`

页面提示：

`入口函数必须为 module.exports`

浏览器 Network 抓包确认：

- `POST https://api.next.bspapp.com/client` 请求体非空；
- 匿名鉴权请求返回 HTTP 200；
- 随后的 `serverless.function.runtime.invoke` 已正确指定 `game-service`；
- `functionArgs` 中已包含 `action`、`payload` 和 `clientInfo`；
- 云端返回 `FunctionBizError`，错误正文为“入口函数必须为 module.exports”。

因此，该问题已经不是前端请求体被清空，也不是 `uni.request` 拦截器导致的。错误来自 `pwfinal` 中 `game-service` 的云端入口加载阶段，业务路由尚未执行。

## 二、代码检查结论

当前普通云函数入口写法为：

```js
exports.main = async (event = {}) => {
  // 业务逻辑
};
```

DCloud 普通 JavaScript 云函数文档仍以 `exports.main` 为标准写法；`module.exports = { ... }` 通常用于云对象。参考：[uniCloud 云函数文档](https://doc.dcloud.net.cn/uniCloud/cf-functions)。

但 `pwfinal` 当前实际运行时明确检查顶层导出必须是函数类型的 `module.exports`。只保留 `exports.main` 时，`require(index.js)` 得到的是对象 `{ main }`，不满足该运行时的入口检查。

## 三、处理方案

采用兼容性双导出，不改业务逻辑：

```js
async function main(event = {}) {
  // 原有业务逻辑
}

module.exports = main;
module.exports.main = main;
```

该方式同时满足：

1. `typeof require('./index.js') === 'function'`，适配当前 `pwfinal` 的直接函数入口加载器；
2. `require('./index.js').main` 仍然存在，兼容 uniCloud 普通云函数标准入口及现有本地测试；
3. 不把普通云函数改造成云对象；
4. 不修改 action 路由、鉴权、数据库、支付回调和领域逻辑。

## 四、需要同步的源码

当前仓库保留了多套相同的云函数目录，为避免后续部署使用不同副本，需要同步修改：

- `code/uniCloud-tcb/cloudfunctions/game-service/index.js`
- `code/apps/client/uniCloud/cloudfunctions/game-service/index.js`
- `code/apps/client/uniCloud-aliyun/cloudfunctions/game-service/index.js`
- `code/apps/client/uniCloud-aliyun/cloudfunctions/game-service/game-service/index.js`

实际向阿里云 `pwfinal` 上传的是 `apps/client/uniCloud-aliyun/cloudfunctions/game-service`。

## 五、验收标准

1. 四个入口文件内容保持一致；
2. Node 加载结果同时满足“自身是函数”和“.main 是同一个函数”；
3. 现有 `game-service` 单元测试通过；
4. 重新上传 `game-service` 后，测试域名不再返回“入口函数必须为 module.exports”；
5. `getBrandConfig`、`listProducts` 能进入原有 action 路由并返回业务结果。

## 六、风险说明

本次只调整 CommonJS 导出形态，不改变云函数业务规则。若上传后出现数据库集合、索引、环境变量或权限错误，应作为下一层云端配置问题单独处理，不能再归因于前端请求体或入口函数。

## 七、本次实施与验证结果

- 四套 `game-service/index.js` 已完成兼容性双导出，文件哈希一致；
- 新增入口导出回归测试，确认模块自身为函数且 `.main` 指向同一函数；
- `game-service` 原有 62 项测试全部通过；
- 新增入口回归测试通过；
- 领域产物同步校验通过，共校验 56 个导出；
- 修改文件 ESLint 检查和 `git diff --check` 通过。

本地代码已经完成，但本次用户要求是“分析并修改代码”，未要求上传覆盖生产云函数，因此 `pwfinal` 云端仍需重新上传 `game-service` 后才能验证错误是否消失。上传目标必须是：

`code/apps/client/uniCloud-aliyun/cloudfunctions/game-service`
