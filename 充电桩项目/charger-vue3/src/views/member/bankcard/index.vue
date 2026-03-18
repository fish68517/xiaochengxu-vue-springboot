<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="有效期" prop="validityPeriod">
        <el-date-picker clearable v-model="queryParams.validityPeriod" type="date" value-format="YYYY-MM-DD"
          placeholder="请选择有效期">
        </el-date-picker>
      </el-form-item>
      <el-form-item label="开户银行" prop="depositBank">
        <el-select v-model="queryParams.depositBank" placeholder="请选择开户银行" clearable style="width: 200px;">
          <el-option v-for="dict in yinhang" :key="dict.value" :label="dict.label" :value="dict.value" />
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
          v-hasPermi="['member:bankcard:add']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate"
          v-hasPermi="['member:bankcard:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete"
          v-hasPermi="['member:bankcard:remove']">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" @click="handleExport"
          v-hasPermi="['member:bankcard:export']">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="bankcardList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="编号" align="center" prop="id" />
      <el-table-column label="用户姓名" align="center" prop="userId">
        <template #default="scope">
          <span v-for="u in userinfoList" :key="u.id">
            <span v-if="u.id === scope.row.userId">{{ u.name }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="卡号" align="center" prop="cardNumber" />
      <el-table-column label="有效期" align="center" prop="validityPeriod" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.validityPeriod, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="开户银行" align="center" prop="depositBank">
        <template #default="scope">
          <dict-tag :options="yinhang" :value="scope.row.depositBank" />
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)"
            v-hasPermi="['member:bankcard:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)"
            v-hasPermi="['member:bankcard:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 添加或修改银行卡表对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="bankcardRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户姓名" prop="userId">
          <el-select v-model="form.userId" placeholder="请选择用户">
            <el-option v-for="u in userinfoList" :key="u.id" :label="u.name" :value="parseInt(u.id)"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="卡号" prop="cardNumber">
          <el-input v-model="form.cardNumber" placeholder="请输入卡号" />
        </el-form-item>
        <el-form-item label="有效期" prop="validityPeriod">
          <el-date-picker clearable v-model="form.validityPeriod" type="date" value-format="YYYY-MM-DD"
            placeholder="请选择有效期">
          </el-date-picker>
        </el-form-item>
        <el-form-item label="开户银行" prop="depositBank">
          <el-select v-model="form.depositBank" placeholder="请选择开户银行">
            <el-option v-for="dict in yinhang" :key="dict.value" :label="dict.label" :value="dict.value"></el-option>
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

<script setup name="Bankcard">
import { listBankcard, getBankcard, delBankcard, addBankcard, updateBankcard } from "@/api/member/bankcard";
import { listUserinfo } from "@/api/member/userinfo";
const { proxy } = getCurrentInstance();
const { yinhang } = proxy.useDict('yinhang');

const bankcardList = ref([]);
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
    validityPeriod: null,
    depositBank: null,
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询银行卡表列表 */
function getList() {
  loading.value = true;
  listBankcard(queryParams.value).then(response => {
    bankcardList.value = response.rows;
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
    cardNumber: null,
    validityPeriod: null,
    depositBank: null,
    password: null,
    del: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("bankcardRef");
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
  title.value = "添加银行卡表";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getBankcard(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改银行卡表";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["bankcardRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateBankcard(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addBankcard(form.value).then(response => {
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
  proxy.$modal.confirm('是否确认删除银行卡表编号为"' + _ids + '"的数据项？').then(function () {
    return delBankcard(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => { });
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('member/bankcard/export', {
    ...queryParams.value
  }, `bankcard_${new Date().getTime()}.xlsx`)
}

getList();
getUser();
</script>
