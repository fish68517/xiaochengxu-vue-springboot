<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="电桩名称" prop="stumpName">
        <el-input v-model="queryParams.stumpName" placeholder="请输入电桩名称" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="是否占用" prop="occupy">
        <el-select v-model="queryParams.occupy" placeholder="请选择是否占用" clearable style="width: 200px;">
          <el-option v-for="dict in stump" :key="dict.value" :label="dict.label" :value="dict.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="最大功率" prop="powerId">
        <!-- 修改绑定字段为 queryParams.powerId -->
        <el-select v-model="queryParams.powerId" placeholder="请选择最大功率" clearable style="width: 200px;">
          <el-option v-for="dict in powerList" :key="dict.id" :label="dict.maxPower" :value="dict.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="电站名称" prop="chargingstationId">
        <el-select v-model="queryParams.chargingstationId" placeholder="请选择电站名称" clearable style="width: 200px;">
          <el-option v-for="dict in chargingstationList" :key="dict.id" :label="dict.stationName" :value="dict.id" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd"
          v-hasPermi="['chargingstation:stump:add']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate"
          v-hasPermi="['chargingstation:stump:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete"
          v-hasPermi="['chargingstation:stump:remove']">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" @click="handleExport"
          v-hasPermi="['chargingstation:stump:export']">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="stumpList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="电桩编号" align="center" prop="id" />
      <el-table-column label="电桩名称" align="center" prop="stumpName" />
      <el-table-column label="是否占用" align="center" prop="occupy">
        <template #default="scope">
          <dict-tag :options="stump" :value="scope.row.occupy" />
        </template>
      </el-table-column>
      <el-table-column label="最大功率" align="center" prop="maxPower">
        <template #default="scope">
          <!-- 使用 getMaxPowerValue 函数显示最大功率值 -->
          {{ getMaxPowerValue(scope.row.powerId) }}
        </template>
      </el-table-column>
      <el-table-column label="电站名称" align="center" prop="stationName">
        <template #default="scope">
          {{ getChargingstationName(scope.row.chargingstationId) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)"
            v-hasPermi="['chargingstation:stump:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)"
            v-hasPermi="['chargingstation:stump:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize"
      @pagination="getList" />

    <!-- 添加或修改电桩信息对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="stumpRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="电桩名称" prop="stumpName">
          <el-input v-model="form.stumpName" placeholder="请输入电桩名称" />
        </el-form-item>
        <el-form-item label="是否占用" prop="occupy">
          <el-select v-model="form.occupy" placeholder="请选择是否占用">
            <el-option v-for="dict in stump" :key="dict.value" :label="dict.label"
              :value="parseInt(dict.value)"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="最大功率" prop="item.id">
          <el-select v-model="form.powerId" placeholder="请选择最大功率" clearable style="width: 200px;">
            <el-option
              v-for="dict in powerList"
              :key="dict.id"
              :label="dict.maxPower"
              :value="dict.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="电站名称" prop="chargingstationId">
          <el-select v-model="form.chargingstationId" placeholder="请选择电站名称" clearable style="width: 200px;">
          <el-option v-for="dict in chargingstationList" :key="dict.id" :label="dict.stationName" :value="dict.id" />
        </el-select>
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

<script setup name="Stump">
import { listStump, getStump, delStump, addStump, updateStump } from "@/api/chargingstation/stump";
import { listPower } from "@/api/chargingstation/power";
import { listChongdianzhan } from "@/api/chargingstation/chongdianzhan";

const { proxy } = getCurrentInstance();
const { stump } = proxy.useDict('stump');

const stumpList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    stumpName: null,
    occupy: null,
    powerId: null,
    chargingstationId: null,
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询电桩信息列表 */
function getList() {
  loading.value = true;
  listStump(queryParams.value).then(response => {
    stumpList.value = response.rows;
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
    stumpName: null,
    occupy: null,
    powerId: null,
    chargingstationId: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("stumpRef");
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
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
  title.value = "添加电桩信息";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getStump(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改电桩信息";
  });
}

// 新增：用于存储功率数据的响应式变量
const powerList = ref([]);
const chargingstationList = ref([]);
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
const getChargingstationName = (chargingstationId) => {
  const chargingstation = chargingstationList.value.find(item => item.id === chargingstationId);
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
const getMaxPowerValue = (powerId) => {
  const power = powerList.value.find(item => item.id === powerId);
  return power ? power.maxPower : '';
};
/** 提交按钮 */
function submitForm() {
  proxy.$refs["stumpRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateStump(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addStump(form.value).then(response => {
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
  proxy.$modal.confirm('是否确认删除电桩信息编号为"' + _ids + '"的数据项？').then(function () {
    return delStump(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => { });
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('chargingstation/stump/export', {
    ...queryParams.value
  }, `stump_${new Date().getTime()}.xlsx`)
}

getList();
</script>
