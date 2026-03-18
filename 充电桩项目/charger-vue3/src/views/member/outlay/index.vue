<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="支付时间" prop="payTime">
        <el-date-picker clearable v-model="queryParams.payTime" type="date" value-format="YYYY-MM-DD"
          placeholder="请选择支付时间">
        </el-date-picker>
      </el-form-item>
      <el-form-item label="支付方式" prop="payWay">
        <el-select v-model="queryParams.payWay" placeholder="请选择支付方式" clearable style="width: 200px;">
          <el-option v-for="dict in zhifu" :key="dict.value" :label="dict.label" :value="dict.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['member:outlay:add']">添加支付记录</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate"
          v-hasPermi="['member:outlay:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete"
          v-hasPermi="['member:outlay:remove']">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" @click="handleExport"
          v-hasPermi="['member:outlay:export']">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="outlayList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="编号" align="center" prop="id" />
      <el-table-column label="用户姓名" align="center" prop="userId">
        <template #default="scope">
          <span v-for="u in userinfoList" :key="u.id">
            <span v-if="u.id === scope.row.userId">{{ u.name }}</span>
          </span>
        </template>
      </el-table-column>
      <!-- <el-table-column label="充电站id" align="center" prop="chargingstationId" /> -->
      <el-table-column label="充电站名" align="center" prop="chargingstationId" >
        <template #default="scope">
          <span v-for="c in chongdianzhanList" :key="c.id">
            <span v-if="c.id === scope.row.chargingstationId">{{ c.stationName }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="充电桩名" align="center" prop="stumpId" >
        <template #default="scope">
          <span v-for="s in stumpList" :key="s.id">
            <span v-if="s.id === scope.row.stumpId">{{ s.stumpName }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="支付金额" align="center" prop="payAmount" />
      <el-table-column label="支付时间" align="center" prop="payTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.payTime, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="支付方式" align="center" prop="payWay">
        <template #default="scope">
          <dict-tag :options="zhifu" :value="scope.row.payWay" />
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <!-- <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)"
            v-hasPermi="['member:outlay:edit']">修改</el-button> -->
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)"
            v-hasPermi="['member:outlay:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 添加或修改支出管理对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="outlayRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户姓名" prop="userId">
          <el-select v-model="form.userId" placeholder="请选择用户">
            <el-option v-for="u in userinfoList" :key="u.id" :label="u.name" :value="parseInt(u.id)"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="充电站名" prop="chargingstationId">
          <el-select v-model="form.chargingstationId" placeholder="请选择充电站">
            <el-option v-for="c in chongdianzhanList" :key="c.id" :label="c.stationName" :value="parseInt(c.id)"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="充电桩名" prop="stumpId">
          <el-select v-model="form.stumpId" placeholder="请选择充电桩">
            <el-option v-for="s in stumpList" :key="s.id" :label="s.stumpName" :value="parseInt(s.id)"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="支付金额" prop="payAmount">
          <el-input v-model="form.payAmount" placeholder="请输入支付金额" />
        </el-form-item>
        <el-form-item label="支付时间" prop="payTime">
          <el-date-picker clearable v-model="form.payTime" type="date" value-format="YYYY-MM-DD" placeholder="请选择支付时间">
          </el-date-picker>
        </el-form-item>
        <el-form-item label="支付方式" prop="payWay">
          <el-select v-model="form.payWay" placeholder="请选择支付方式">
            <el-option v-for="dict in zhifu" :key="dict.value" :label="dict.label" :value="dict.value"></el-option>
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

<script setup name="Outlay">
import { listOutlay, getOutlay, delOutlay, addOutlay, updateOutlay } from "@/api/member/outlay";
import { listUserinfo } from "@/api/member/userinfo";
import { listChongdianzhan} from "@/api/chargingstation/chongdianzhan";
import { listStump } from "@/api/chargingstation/stump";
import { expense } from "@/api/member/Record";

const { proxy } = getCurrentInstance();
const { zhifu } = proxy.useDict('zhifu');

const outlayList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");
const userinfoList = ref([]);
const chongdianzhanList = ref([]);
const stumpList = ref([]);
/** 查询用户信息列表 */
function getUser() {
  loading.value = true;
  listUserinfo(queryParams.value).then(response => {
    userinfoList.value = response.rows;
  });
}
/** 查询电站信息列表 */
function getChongdianzhan() {
  loading.value = true;
  listChongdianzhan(queryParams.value).then(response => {
    chongdianzhanList.value = response.rows;
  });
}

/** 查询电桩信息列表 */
function getStump() {
  loading.value = true;
  listStump(queryParams.value).then(response => {
    stumpList.value = response.rows;
  });
}
const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    payTime: null,
    payWay: null,
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询支出管理列表 */
function getList() {
  loading.value = true;
  listOutlay(queryParams.value).then(response => {
    outlayList.value = response.rows;
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
    userId: null,
    chargingstationId: null,
    stumpId: null,
    payAmount: null,
    payTime: null,
    payWay: null,
    del: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("outlayRef");
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
  title.value = "添加支出记录";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getOutlay(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改支出管理";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["outlayRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateOutlay(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addOutlay(form.value).then(response => {
          proxy.$modal.msgSuccess("新增成功");
          open.value = false;
          getList();
          // 更新用户余额
          expense(form.value)
          .then(response => {
            proxy.$modal.msgSuccess("用户余额更新成功");
          })
          .catch(error => {
            console.error('用户余额更新失败:', error);
            proxy.$modal.msgError("用户余额更新失败，请稍后重试"); 
          })
        });
      }
    }
  });
}

/** 删除按钮操作 */
function handleDelete(row) {
  const _ids = row.id || ids.value;
  proxy.$modal.confirm('是否确认删除支出管理编号为"' + _ids + '"的数据项？').then(function () {
    return delOutlay(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => { });
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('member/outlay/export', {
    ...queryParams.value
  }, `outlay_${new Date().getTime()}.xlsx`)
}

getList();
getUser();
getChongdianzhan();
getStump();
</script>
