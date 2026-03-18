<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="电站名称" prop="chargingstationId">
        <el-input
          v-model="queryParams.chargingstationId"
          placeholder="请输入充电站名称"
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
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['chargingstation:stationgrade:remove']"
        >删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['chargingstation:stationgrade:export']"
        >导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="stationgradeList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="编号" align="center" prop="id" />
      <el-table-column label="评分" align="center" prop="grade">
      <!-- 用星星显示评分 -->
        <template #default="scope">
          <el-rate v-model="scope.row.grade" :max="5" readonly disabled></el-rate>
        </template>
      </el-table-column>
      <el-table-column label="用户" align="center" prop="userId">
        <template #default="scope">
          <span v-for="item in userList" :key="item.id">
            <span v-if="item.id === scope.row.userId">{{ item.name }}</span>
          </span>
        </template>
      </el-table-column>

      <el-table-column label="评论内容" align="center" prop="commentContent" />
      <el-table-column label="评论时间" align="center" prop="commentTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.commentTime, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="充电站名称" align="center" prop="chargingstationId">
        <template #default="scope">
          <span v-for="item in chargingstationList" :key="item.id">
            <span v-if="item.id === scope.row.chargingstationId">{{ item.stationName }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['chargingstation:stationgrade:remove']">删除</el-button>
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

    <!-- 添加或修改评分管理对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="stationgradeRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户id" prop="userId">
          <el-input v-model="form.userId" placeholder="请输入用户id" />
        </el-form-item>
        <el-form-item label="充电站id" prop="chargingstationId">
          <el-input v-model="form.chargingstationId" placeholder="请输入充电站id" />
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

<script setup name="Stationgrade">
import { listStationgrade, getStationgrade, delStationgrade, addStationgrade, updateStationgrade } from "@/api/chargingstation/stationgrade";
import { listChongdianzhan} from "@/api/chargingstation/chongdianzhan";
import { listUserinfo} from "@/api/member/userinfo";
const { proxy } = getCurrentInstance();

const stationgradeList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");
const chargingstationList = ref([]);
function getchargingstationList() {
  listChongdianzhan().then(response => {
    chargingstationList.value = response.rows;
  });
}
const userList = ref([]);
function getUserList() {
  listUserinfo().then(response => {
    userList.value = response.rows;
  });
}
const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    grade: null,
    chargingstationId: null,
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询评分管理列表 */
function getList() {
  loading.value = true;
  listStationgrade(queryParams.value).then(response => {
    stationgradeList.value = response.rows;
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
    grade: null,
    userId: null,
    commentContent: null,
    commentTime: null,
    chargingstationId: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("stationgradeRef");
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
  title.value = "添加评分管理";
}

/** 修改按钮操作 */
// function handleUpdate(row) {
//   reset();
//   const _id = row.id || ids.value
//   getStationgrade(_id).then(response => {
//     form.value = response.data;
//     open.value = true;
//     title.value = "修改评分管理";
//   });
// }

/** 提交按钮 */
function submitForm() {
  proxy.$refs["stationgradeRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateStationgrade(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addStationgrade(form.value).then(response => {
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
  proxy.$modal.confirm('是否确认删除评分管理编号为"' + _ids + '"的数据项？').then(function() {
    return delStationgrade(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {});
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('chargingstation/stationgrade/export', {
    ...queryParams.value
  }, `stationgrade_${new Date().getTime()}.xlsx`)
}

getList();
getchargingstationList();
getUserList();
</script>
