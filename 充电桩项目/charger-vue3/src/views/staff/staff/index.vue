<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="78px">
      <el-form-item label="姓名" prop="name" >
        <el-input
          v-model="queryParams.name"
          placeholder="请输入姓名"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="性别" prop="sex">
        <el-select v-model="queryParams.sex" placeholder="请选择性别" clearable style="width: 150px;">
          <el-option label="男" value="0" />
          <el-option label="女" value="1" />
      </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="state">
        <el-select v-model="queryParams.state" style="width: 100px;" clearable>
            <el-option label="在职" value="在职" />
            <el-option label="离职" value="离职" />
        </el-select>
      </el-form-item>
      <el-form-item label="员工类别" prop="stafftypeId">
        <el-select v-model="queryParams.stafftypeId" placeholder="请选择员工类别" clearable style="width: 150px;">
          <el-option
            v-for="item in types"
            :key="item.id"
            :label="item.jobTitle"
            :value="item.id"
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
          v-hasPermi="['staff:staff:add']"
        >新增</el-button>
      </el-col>
      <!-- <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['staff:staff:edit']"
        >修改</el-button>
      </el-col> -->
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['staff:staff:remove']"
        >删除</el-button>
      </el-col>
      <!-- <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['staff:staff:export']"
        >导出</el-button>
      </el-col> -->
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="staffList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="ID" align="center" prop="id" />
      
      <el-table-column label="姓名" align="center" prop="name" />
      <el-table-column label="电话" align="center" prop="phone" />
      <el-table-column label="性别" align="center" prop="sex">
        <template #default="scope">
          {{scope.row.sex===0 ? '男' : '女'}}
        </template>
      </el-table-column>
      <el-table-column label="资格证书" align="center" prop="credentials" />
      <el-table-column label="状态" align="center" prop="state">
          <template #default="scope">
            <el-tag :type="scope.row.state === '在职' ? 'success' : 'danger'">
             {{scope.row.state}}
             </el-tag>
          </template>
      </el-table-column>
      <el-table-column label="员工类别" align="center" prop="stafftypeId">
        <template #default="scope">
          {{types.find(item => item.id === scope.row.stafftypeId)?.jobTitle || '-'}}
        </template>
        </el-table-column>
      <el-table-column label="员工描述" align="center" prop="staffDescribe" />
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['staff:staff:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['staff:staff:remove']">删除</el-button>
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

    <!-- 添加或修改全体员工对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="staffRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="ID" prop="id">
          <el-input v-model="form.id" placeholder="请输入ID" disabled />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入电话" />
        </el-form-item>
        <el-form-item label="性别" prop="sex">
          <el-select v-model="form.sex" placeholder="请选择性别">
            <el-option label="男" value="0" />
            <el-option label="女" value="1" />
          </el-select>
        </el-form-item>
        <el-form-item label="资格证书" prop="credentials">
          <el-input v-model="form.credentials" placeholder="请输入资格证书" />
        </el-form-item>
        <el-form-item label="状态" prop="state">
          <el-select v-model="form.state" placeholder="请选择状态">
            <el-option label="在职" value="0"/>
            <el-option label="离职" value="1"/>  
          </el-select>
        </el-form-item>
        <el-form-item label="员工类别" prop="stafftypeId">
          <el-select v-model="form.stafftypeId" placeholder="请选择员工类别" style="width: 150px;">
            <el-option
              v-for="item in types"
              :key="item.id"
              :label="item.jobTitle"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="员工描述">
          <editor v-model="form.staffDescribe" :min-height="192"/>
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

<script setup name="Staff">
import { listStaff, getStaff, delStaff, addStaff, updateStaff } from "@/api/staff/staff";
import { listStafftype} from "@/api/staff/stafftype";
const { proxy } = getCurrentInstance();
const { sys_normal_disable, sys_user_sex } = proxy.useDict('sys_normal_disable', 'sys_user_sex');
const staffList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");
const types=ref([])
const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    credentials: null,
    name: null,
    sex: null,
    state: null,
    stafftypeId: null,
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询全体员工列表 */
function getList() {
  loading.value = true;
  listStaff(queryParams.value).then(response => {
    staffList.value = response.rows;
    total.value = response.total;
    loading.value = false;
  });
}
//查询员工类型列表
function getTypesList(){
  listStafftype().then(response => {
   types.value=response.rows;
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
    credentials: null,
    name: null,
    phone: null,
    sex: null,
    state: null,
    stafftypeId: null,
    staffDescribe: null,
    del: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("staffRef");
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
  title.value = "添加全体员工";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getStaff(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改全体员工";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["staffRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateStaff(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addStaff(form.value).then(response => {
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
  proxy.$modal.confirm('是否确认删除全体员工编号为"' + _ids + '"的数据项？').then(function() {
    return delStaff(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {});
}

/** 导出按钮操作 */
// function handleExport() {
//   proxy.download('staff/staff/export', {
//     ...queryParams.value
//   }, `staff_${new Date().getTime()}.xlsx`)
// }
getTypesList();
getList();
</script>
