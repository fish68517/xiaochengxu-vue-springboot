<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="最大功率" prop="maxPower">
        <el-select v-model="queryParams.maxPower" placeholder="请选择最大功率" clearable style="width: 200px;">
          <el-option v-for="dict in powerList" :key="dict.id" :label="dict.maxPower" :value="dict.maxPower" />
        </el-select>
      </el-form-item>
      <el-form-item label="创建时间" style="width: 308px">
        <el-date-picker
          v-model="daterangeCreateTime"
          value-format="YYYY-MM-DD"
          type="daterange"
          range-separator="-"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        ></el-date-picker>
      </el-form-item>
      <el-form-item label="用户名称" prop="userID">
        <el-select v-model="queryParams.userID" placeholder="请选择用户" clearable style="width: 200px;">
          <el-option v-for="dict in userinfoList" :key="dict.id" :label="dict.name" :value="dict.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="支付方式" prop="payWay">
        <el-select v-model="queryParams.payWay" placeholder="请选择支付方式" clearable style="width: 200px;">
          <el-option
            v-for="dict in zhifu"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="订单状态" prop="state">
        <el-select v-model="queryParams.state" placeholder="请选择订单状态" clearable style="width: 200px;">
          <el-option
            v-for="dict in order_staus"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button
          type="primary"
          plain
          icon="Plus"
          @click="handleAdd"
          v-hasPermi="['chargingstation:order:add']"
        >新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['chargingstation:order:edit']"
        >修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['chargingstation:order:remove']"
        >删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['chargingstation:order:export']"
        >导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="orderList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="订单编号" align="center" prop="id" />
      <el-table-column label="用户姓名" align="center" prop="userID">
        <template #default="scope">
          {{ getUserName(scope.row.userID) }}
        </template>
      </el-table-column>
      <el-table-column label="最大功率" align="center" prop="maxPower">
        <template #default="scope">
          <!-- 使用 getMaxPowerValue 函数显示最大功率值 -->
          {{ getMaxPowerValue(scope.row.maxPower) }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="充电时长" align="center" prop="chargingTime" />
      <el-table-column label="订单金额" align="center" prop="orderPrice" />
    
      <el-table-column label="支付方式" align="center" prop="payWay">
        <template #default="scope">
          <dict-tag :options="zhifu" :value="scope.row.payWay"/>
        </template>
      </el-table-column>
      <el-table-column label="订单状态" align="center" prop="state">
        <template #default="scope">
          <dict-tag :options="order_staus" :value="scope.row.state"/>
        </template>
      </el-table-column>
      <el-table-column label="取消原因" align="center" prop="cancelCause" />
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['chargingstation:order:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['chargingstation:order:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <pagination
      v-show="total>0"
      :total="total"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />

    <!-- 添加或修改订单信息对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="orderRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="车辆编号" prop="carInfoID">
          <el-input v-model="form.carInfoID" placeholder="请输入车辆编号" />
        </el-form-item>
        <el-form-item label="最大功率" prop="maxPower">
          <el-select v-model="form.maxPower" placeholder="请选择最大功率" clearable style="width: 200px;">
          <el-option v-for="dict in powerList" :key="dict.id" :label="dict.maxPower" :value="dict.id" />
        </el-select>
        </el-form-item>
        <el-form-item label="充电时长" prop="chargingTime">
          <el-input v-model="form.chargingTime" placeholder="请输入充电时长" />
        </el-form-item>
        <el-form-item label="订单金额" prop="orderPrice">
          <el-input v-model="form.orderPrice" placeholder="请输入订单金额" />
        </el-form-item>
        <el-form-item label="用户名称" prop="userID">
          <el-select v-model="form.userID" placeholder="请选择最大功率">
            <el-option v-for="dict in userinfoList" :key="dict.id" :label="dict.name" :value="dict.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="支付方式" prop="payWay">
          <el-select v-model="form.payWay" placeholder="请选择支付方式">
            <el-option
              v-for="dict in zhifu"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="电站名称" prop="chargingStationID">
          <el-select v-model="form.chargingStationID" placeholder="请选择电站名称" clearable style="width: 200px;">
          <el-option v-for="dict in chargingstationList" :key="dict.id" :label="dict.stationName" :value="dict.id" />
        </el-select>
        </el-form-item>
        <el-form-item label="电桩编号" prop="stumpID">
          <el-input v-model="form.stumpID" placeholder="请输入电桩编号" />
        </el-form-item>
        <el-form-item label="订单状态" prop="state">
          <el-select v-model="form.state" placeholder="请选择订单状态">
            <el-option
              v-for="dict in order_staus"
              :key="dict.value"
              :label="dict.label"
              :value="parseInt(dict.value)"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="取消原因" prop="cancelCause">
          <el-input v-model="form.cancelCause" type="textarea" placeholder="请输入内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Order">
import { listOrder, getOrder, delOrder, addOrder, updateOrder } from "@/api/chargingstation/order";
import { listPower } from "@/api/chargingstation/power";
import { listChongdianzhan } from "@/api/chargingstation/chongdianzhan";
import { listUserinfo } from "@/api/member/userinfo";


const { proxy } = getCurrentInstance();
const { order_staus, zhifu } = proxy.useDict('order_staus', 'zhifu');

const orderList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");
const daterangeCreateTime = ref([]);

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    maxPower: null,
    createTime: null,
    userID: null,
    payWay: null,
    state: null,
    del: null,
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询订单信息列表 */
function getList() {
  loading.value = true;
  queryParams.value.params = {};
  if (null != daterangeCreateTime && '' != daterangeCreateTime) {
    queryParams.value.params["beginCreateTime"] = daterangeCreateTime.value[0];
    queryParams.value.params["endCreateTime"] = daterangeCreateTime.value[1];
  }
  listOrder(queryParams.value).then(response => {
    orderList.value = response.rows;
    total.value = response.total;
    loading.value = false;
  });
}

// 取消按钮
function cancel() {
  open.value = false;
  reset();
}

// 表单重置
function reset() {
  form.value = {
    id: null,
    carInfoID: null,
    maxPower: null,
    createTime: null,
    chargingTime: null,
    orderPrice: null,
    userID: null,
    payWay: null,
    chargingStationID: null,
    stumpID: null,
    state: null,
    cancelCause: null,
    del: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("orderRef");
}
// 新增：用于存储功率数据的响应式变量
const powerList = ref([]);
const chargingstationList = ref([]);
const userinfoList = ref([]);
onMounted(async () => {
  try {
    const response = await listUserinfo();
    userinfoList.value = response.rows;
    console.log('用户列表:', userinfoList.value);
  } catch (error) {
    console.error('获取用户数据失败:', error);
  }
});
const getUserName = (userID) => {
  const user = userinfoList.value.find(item => item.id === userID);
  return user? user.name : '';
};
onMounted(async () => {
  try {
    const response = await listChongdianzhan();
    chargingstationList.value = response.rows;
    console.log('电站列表:', chargingstationList.value);
  } catch (error) {
    console.error('获取充电站数据失败:', error);
  }
});
//修改表格中电站编号列的渲染逻辑
const getChargingstationName = (chargingStationID) => {
  const chargingstation = chargingstationList.value.find(item => item.id === chargingStationID);
  return chargingstation? chargingstation.stationName : '';
};
// 新增：在组件挂载时调用 listPower 接口获取功率数据
onMounted(async () => {
  try {
    const response = await listPower();
    powerList.value = response.rows; 
  } catch (error) {
    console.error('获取功率数据失败:', error);
  }
});
// 修改表格中最大功率列的渲染逻辑
const getMaxPowerValue = (maxPower) => {
 // const power = powerList.value.find(item => item.id === maxPower);
  return maxPower ? `${maxPower}kw` : '';
};
/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  daterangeCreateTime.value = [];
  proxy.resetForm("queryRef");
  handleQuery();
}

// 多选框选中数据
function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
}

/** 新增按钮操作 */
function handleAdd() {
  reset();
  open.value = true;
  title.value = "添加订单信息";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getOrder(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改订单信息";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["orderRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateOrder(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addOrder(form.value).then(response => {
          proxy.$modal.msgSuccess("新增成功");
          open.value = false;
          getList();
        });
      }
    }
  });
}

/** 删除按钮操作 */
function handleDelete(row) {
  const _ids = row.id || ids.value;
  proxy.$modal.confirm('是否确认删除订单信息编号为"' + _ids + '"的数据项？').then(function() {
    return delOrder(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {});
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('chargingstation/order/export', {
    ...queryParams.value
  }, `order_${new Date().getTime()}.xlsx`)
}

getList();
</script>
