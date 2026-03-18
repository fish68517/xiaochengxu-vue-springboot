<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="用户" prop="userId">
        <el-input
          v-model="queryParams.userId"
          placeholder="请输入用户"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="充电站" prop="chargingstationId">
        <el-select v-model="queryParams.chargingstationId" placeholder="请选择充电站" clearable style="width: 190px">
          <el-option
            v-for="dict in chongdianzhanList"
            :key="dict.id"
            :label="dict.stationName"
            :value="dict.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="充电桩" prop="stumpId">
        <el-select v-model="queryParams.stumpId" placeholder="请选择充电桩" clearable style="width: 190px">
          <el-option
            v-for="dict in stumpList"
            :key="dict.id"
            :label="dict.stumpName"
            :value="dict.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="故障时间" prop="breakTime">
        <el-date-picker clearable
          v-model="queryParams.breakTime"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="请选择故障时间">
        </el-date-picker>
      </el-form-item>
      <el-form-item label="故障类别" prop="breakType">
        <el-select v-model="queryParams.breakType" placeholder="请选择故障类别" clearable style="width: 192px">
          <el-option
            v-for="dict in types"
            :key="dict.id"
            :label="dict.breakName"
            :value="dict.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="维修员" prop="spare1">
        <el-select v-model="queryParams.spare1" placeholder="请选择维修员" clearable style="width: 192px">
          <el-option
            v-for="dict in staffList"
            :key="dict.id"
            :label="dict.name"
            :value="dict.id"
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
          v-hasPermi="['breaks:breakdown:add']"
        >新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['breaks:breakdown:edit']"
        >修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['breaks:breakdown:remove']"
        >删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['breaks:breakdown:export']"
        >导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>
<!-- 展示列表 -->
    <el-table v-loading="loading" :data="breakdownList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="编号" align="center" prop="id" />
      <el-table-column label="用户" align="center" prop="userId">
        <template #default="scope">
           <span v-for="t in userList" :key="t">
            <span v-if="t.id==scope.row.userId">{{ t.name }}</span>
           </span>
        </template>
      </el-table-column>
      <el-table-column label="充电站" align="center" prop="chargingstationId">
        <template #default="scope">
          <!-- <dict-tag :options="sys_user_sex" :value="scope.row.stationName"/> -->
          <span v-for="t in chongdianzhanList" :key="t">
            <span v-if="t.id==scope.row.chargingstationId">{{ t.stationName }}</span>
           </span>
        </template>
      </el-table-column>
      <el-table-column label="充电桩" align="center">
        <template #default="scope">
          <!-- <dict-tag :options="sys_user_sex" :value="scope.row.stumpId"/> -->
          <span v-for="t in stumpList" :key="t" prop="stumpId">
            <span v-if="t.id==scope.row.stumpId">{{ t.stumpName }}</span>
           </span>
           <!-- {{ scope.row.stumpId }}--{{ scope.row.chargingstationId }} -->
        </template>
      </el-table-column>
      <el-table-column label="故障时间" align="center" prop="breakTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.breakTime, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="故障类别" align="center" prop="breakType">
        <template #default="scope">
          <!-- <dict-tag :options="types" :value="scope.row.breakType"/> -->
           <span v-for="t in types" :key="t">
            <span v-if="t.id==scope.row.breakType">{{ t.breakName }}</span>
           </span>
        </template>
      </el-table-column>
      <el-table-column label="描述" align="center" prop="breakDescribe" />
      <el-table-column label="维修员" align="center" prop="spare1">
        <template #default="scope">
          <!-- <dict-tag :options="sys_user_sex" :value="scope.row.spare1"/> -->
          <span v-for="t in staffList" :key="t">
            <span v-if="t.id==scope.row.spare1">{{ t.name }}</span>
           </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="del" > 
        <template #default="scope">
          <el-tag :type="scope.row.del ? 'danger' : 'success'">
            {{ scope.row.del ? '未完成' : '已完成' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['breaks:breakdown:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['breaks:breakdown:remove']">删除</el-button>
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

    <!-- 添加或修改故障管理对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="breakdownRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户" prop="userId">
          <el-input v-model="form.userId" placeholder="请输入用户" />
        </el-form-item>
        <el-form-item label="充电站" prop="chargingstationId">
          <el-select v-model="form.chargingstationId" placeholder="请选择充电站">
            <el-option
              v-for="dict in chongdianzhanList"
              :key="dict.id"
              :label="dict.stationName"
              :value="parseInt(dict.id)"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="充电桩" prop="stumpId">
          <el-select v-model="form.stumpId" placeholder="请选择充电桩">
            <el-option
            v-for="dict in stumpList"
            :key="dict.id"
            :label="dict.stumpName"
            :value="dict.id"
          />
          </el-select>
        </el-form-item>
        <el-form-item label="故障时间" prop="breakTime">
          <el-date-picker clearable
            v-model="form.breakTime"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="请选择故障时间">
          </el-date-picker>
        </el-form-item>
        <el-form-item label="故障类别" prop="breakType">
          <el-select v-model="form.breakType" placeholder="请选择故障类别">
            <el-option
              v-for="dict in types"
              :key="dict.id"
              :label="dict.breakName"
              :value="parseInt(dict.id)"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="描述" prop="breakDescribe">
          <el-input v-model="form.breakDescribe" type="textarea" placeholder="请输入内容" />
        </el-form-item>
        <el-form-item label="维修员" prop="spare1">
          <el-select v-model="form.spare1" placeholder="请选择维修员">
            <el-option
              v-for="dict in staffList"
              :key="dict.id"
              :label="dict.name"
              :value="dict.id"
            ></el-option>
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

<script setup name="Breakdown">
import { listBreakdown, getBreakdown, delBreakdown, addBreakdown, updateBreakdown } from "@/api/breaks/breakdown";
import { listBreaktype } from "@/api/breaks/breaktype";
import { listStump} from "@/api/chargingstation/stump";
import { listUserinfo } from "@/api/member/userinfo";
import { listStaff } from "@/api/staff/staff";
import { listChongdianzhan } from "@/api/chargingstation/chongdianzhan";

const { proxy } = getCurrentInstance();
const { sys_user_sex } = proxy.useDict('sys_user_sex');

const breakdownList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");

//定义一个故障类型集合
const types = ref([]);
//定义一个方法，动态的获取所有的故障类型
function getTypes() {
  listBreaktype().then(response => {
    types.value = response.rows;
    // console.log("故障：",types.value);
  });
}

//充电桩集合
const stumpList = ref([]);
//定义一个获得所有充电桩的方法
function getStumps() {
  listStump().then(response => {
    stumpList.value = response.rows;
    console.log("充电桩：",stumpList.value);
  }); 
}

//用户集合
const userList = ref([]);
//定义一个获得所有用户的方法
function getUsers() {
  listUserinfo().then(response => {
    userList.value = response.rows;
    console.log("用户：",userList.value);
  });
}

//员工集合
const staffList = ref([]);
//定义一个获得所有员工的方法
function getStaffs() {
  listStaff().then(response => {
    staffList.value = response.rows;
    console.log("员工：",staffList.value);
  });
}

//充电站集合
const chongdianzhanList = ref([]);
//定义一个获得所有充电站的方法
function getChongdianzhans() {
  listChongdianzhan().then(response => {
    chongdianzhanList.value = response.rows;
    console.log("充电站：",chongdianzhanList.value);
  });
}
const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    userId: null,
    chargingstationId: null,
    stumpId: null,
    breakTime: null,
    breakType: null,
    breakDescribe: null,
    spare1: null,
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询故障管理列表 */
function getList() {
  loading.value = true;
  listBreakdown(queryParams.value).then(response => {
    breakdownList.value = response.rows;
    total.value = response.total;
    loading.value = false;
    console.log("故障管理：",breakdownList.value);
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
    breakTime: null,
    breakType: null,
    breakDescribe: null,
    del: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("breakdownRef");
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
  title.value = "添加故障管理";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getBreakdown(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改故障管理";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["breakdownRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateBreakdown(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addBreakdown(form.value).then(response => {
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
  proxy.$modal.confirm('是否确认删除故障管理编号为"' + _ids + '"的数据项？').then(function() {
    return delBreakdown(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {});
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('breaks/breakdown/export', {
    ...queryParams.value
  }, `breakdown_${new Date().getTime()}.xlsx`)
}

getList();
getTypes();
//获得所有充电桩
getStumps();
//获得所有用户
getUsers();
//获得所有员工
getStaffs();
//获得所有充电站
getChongdianzhans();
</script>
