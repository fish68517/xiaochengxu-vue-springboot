<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="充值方式" prop="rechargeMode">
        <el-select v-model="queryParams.rechargeMode" placeholder="请选择充值方式" clearable style="width: 200px;">
          <el-option v-for="dict in zhifu" :key="dict.value" :label="dict.label" :value="dict.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="充值时间" prop="rechargeData">
        <el-date-picker clearable v-model="queryParams.rechargeData" type="date" value-format="YYYY-MM-DD"
          placeholder="请选择充值时间">
        </el-date-picker>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['member:topup:add']">添加充值记录</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate"
          v-hasPermi="['member:topup:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete"
          v-hasPermi="['member:topup:remove']">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" @click="handleExport"
          v-hasPermi="['member:topup:export']">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="topupList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="编号" align="center" prop="id" />
      <el-table-column label="用户姓名" align="center" prop="userId">
        <template #default="scope">
          <span v-for="u in userinfoList" :key="u.id">
            <span v-if="u.id === scope.row.userId">{{ u.name }}</span>  
          </span>
        </template>
      </el-table-column>

      <el-table-column label="充值金额" align="center" prop="rechargeMoney" />
      <el-table-column label="充值方式" align="center" prop="rechargeMode">
        <template #default="scope">
          <dict-tag :options="zhifu" :value="scope.row.rechargeMode" />
        </template>
      </el-table-column>
      <el-table-column label="充值时间" align="center" prop="rechargeData" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.rechargeData, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <!-- <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)"
            v-hasPermi="['member:topup:edit']">修改</el-button> -->
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)"
            v-hasPermi="['member:topup:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 添加或修改充值表对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="topupRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户姓名" prop="userId">
          <el-select v-model="form.userId" placeholder="请选择用户" >
            <el-option
              v-for="u in userinfoList"
              :key="u.id"
              :label="u.name"
              :value="parseInt(u.id)"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="充值金额" prop="rechargeMoney">
          <el-input v-model="form.rechargeMoney" placeholder="请输入充值金额" />
        </el-form-item>
        <el-form-item label="充值方式" prop="rechargeMode">
          <el-select v-model="form.rechargeMode" placeholder="请选择充值方式">
            <el-option v-for="dict in zhifu" :key="dict.value" :label="dict.label" :value="dict.value"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="充值时间" prop="rechargeData">
          <el-date-picker clearable v-model="form.rechargeData" type="date" value-format="YYYY-MM-DD"
            placeholder="请选择充值时间">
          </el-date-picker>
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

<script setup name="Topup">
import { listTopup, getTopup, delTopup, addTopup, updateTopup } from "@/api/member/topup";
import { listUserinfo} from "@/api/member/userinfo";
import { recharge} from "@/api/member/Record";

const { proxy } = getCurrentInstance();
const { zhifu } = proxy.useDict('zhifu');

const topupList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");
const userinfoList = ref([]);
/** 查询用户信息列表 */
function getUser() {
  loading.value = true;
  listUserinfo(queryParams.value).then(response => {
    userinfoList.value = response.rows;
  });
}

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    rechargeMode: null,
    rechargeData: null,
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询充值表列表 */
function getList() {
  loading.value = true;
  listTopup(queryParams.value).then(response => {
    topupList.value = response.rows;
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
    rechargeMoney: null,
    rechargeMode: null,
    rechargeData: null,
    del: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("topupRef");
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
  title.value = "添加充值记录";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getTopup(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改充值表";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["topupRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateTopup(form.value)
          .then(response => {
            proxy.$modal.msgSuccess("修改成功");
            open.value = false;
            getList();
          })
          .catch(error => {
            console.error('修改失败:', error);
            proxy.$modal.msgError("修改失败，请稍后重试");
          });
      } else {
        addTopup(form.value)
          .then(response => {
            proxy.$modal.msgSuccess("新增成功");
            open.value = false;
            getList();
            // 更新用户余额
            recharge(form.value)
            .then(response => {
              proxy.$modal.msgSuccess("用户余额更新成功"); 
            })
           .catch(error => {
              console.error('用户余额更新失败:', error);
              proxy.$modal.msgError("用户余额更新失败，请稍后重试");
            }); 
           })
      }
    }
  });
}    

/** 删除按钮操作 */
function handleDelete(row) {
  const _ids = row.id || ids.value;
  proxy.$modal.confirm('是否确认删除充值表编号为"' + _ids + '"的数据项？').then(function () {
    return delTopup(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => { });
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('member/topup/export', {
    ...queryParams.value
  }, `topup_${new Date().getTime()}.xlsx`)
}

getList();
getUser();
</script>
