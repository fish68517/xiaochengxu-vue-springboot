<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="用户外键" prop="userId">
        <el-input
          v-model="queryParams.userId"
          placeholder="请输入用户外键"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="车辆品牌" prop="carBrand">
        <el-input
          v-model="queryParams.carBrand"
          placeholder="请输入车辆品牌"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="车辆型号" prop="carModel">
        <el-input
          v-model="queryParams.carModel"
          placeholder="请输入车辆型号"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="车辆续航" prop="mileage">
        <el-input
          v-model="queryParams.mileage"
          placeholder="请输入车辆续航"
          clearable
          @keyup.enter="handleQuery"
        />
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
          v-hasPermi="['member:usercar:add']"
        >新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['member:usercar:edit']"
        >修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['member:usercar:remove']"
        >删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['member:usercar:export']"
        >导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="usercarList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="车辆Id" align="center" prop="id" />
      <el-table-column label="用户外键" align="center" prop="userId" />
      <el-table-column label="车辆品牌" align="center" prop="carBrand" />
      <el-table-column label="车辆型号" align="center" prop="carModel" />
      <el-table-column label="车辆续航" align="center" prop="mileage" />
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['member:usercar:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['member:usercar:remove']">删除</el-button>
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

    <!-- 添加或修改用户车辆对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="usercarRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户外键" prop="userId">
          <el-input v-model="form.userId" placeholder="请输入用户外键" />
        </el-form-item>
        <el-form-item label="车辆品牌" prop="carBrand">
          <el-input v-model="form.carBrand" placeholder="请输入车辆品牌" />
        </el-form-item>
        <el-form-item label="车辆型号" prop="carModel">
          <el-input v-model="form.carModel" placeholder="请输入车辆型号" />
        </el-form-item>
        <el-form-item label="车辆续航" prop="mileage">
          <el-input v-model="form.mileage" placeholder="请输入车辆续航" />
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

<script setup name="Usercar">
import { listUsercar, getUsercar, delUsercar, addUsercar, updateUsercar } from "@/api/member/usercar";

const { proxy } = getCurrentInstance();

const usercarList = ref([]);
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
    userId: null,
    carBrand: null,
    carModel: null,
    mileage: null
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询用户车辆列表 */
function getList() {
  loading.value = true;
  listUsercar(queryParams.value).then(response => {
    usercarList.value = response.rows;
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
    carBrand: null,
    carModel: null,
    mileage: null
  };
  proxy.resetForm("usercarRef");
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
  title.value = "添加用户车辆";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getUsercar(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改用户车辆";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["usercarRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateUsercar(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addUsercar(form.value).then(response => {
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
  proxy.$modal.confirm('是否确认删除用户车辆编号为"' + _ids + '"的数据项？').then(function() {
    return delUsercar(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {});
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('member/usercar/export', {
    ...queryParams.value
  }, `usercar_${new Date().getTime()}.xlsx`)
}

getList();
</script>
