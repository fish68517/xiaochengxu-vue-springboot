<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="100px">
      <!-- 用户名下拉框 -->
      <el-form-item label="用户名:" prop="userId">
        <el-select v-model="queryParams.userId" placeholder="请选择用户名" clearable @keyup.enter="handleQuery" style="width: 150px;">
          <el-option v-for="item in userInfo" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="充电站名称:" prop="chargingstationId">
       <el-select v-model="queryParams.chargingstationId" placeholder="请选择充电站" clearable @keyup="handleQuery" style="width:150px">
          <el-option v-for="item in chargingStationInfo" :key="item.id" :label="item.stationName" :value="item.id" />
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
          v-hasPermi="['SC:collect:add']"
        >新增</el-button>
      </el-col>
      <!-- <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['SC:collect:edit']"
        >修改</el-button>
      </el-col> -->
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="StarFilled"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['SC:collect:remove']"
        >收藏</el-button>
      </el-col>
      <!-- <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['SC:collect:export']"
        >导出</el-button>
      </el-col> -->
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="collectList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="ID" align="center" prop="id" />
      <el-table-column label="用户id" align="center" prop="用户名">
        <template #default="scope">
          {{userInfo.find(item => item.id === scope.row.userId)?.name || '-'}}
        </template>
        </el-table-column>
        <el-table-column label="电话" align="center" prop="userId">
          <template #default="scope">
            {{userInfo.find(item => item.id === scope.row.userId)?.phoneNum || '-'}}
          </template>
        </el-table-column>
        <el-table-column label="头像" align="center" prop="userId">
          <template #default="scope">
            <el-image :src="userInfo.find(item => item.id === scope.row.userId)?.avatar" :preview-src-list="[userInfo.find(item => item.id === scope.row.userId)?.avatar]" style="width: 50px; height: 50px;" />
          </template>
        </el-table-column>
        <el-table-column label="地址" align="center" prop="userId">
          <template #default="scope">
            {{userInfo.find(item => item.id === scope.row.userId)?.address || '-'}}
          </template>
        </el-table-column>
        <el-table-column label="钱包金额" align="center" prop="userId">
          <template #default="scope">
            {{userInfo.find(item => item.id === scope.row.userId)?.money || '-'}} 
          </template>
        </el-table-column>
      <el-table-column label="充电站名称" align="center" prop="chargingstationId" >
        <template #default="scope">
          {{chargingStationInfo.find(item => item.id === scope.row.chargingstationId)?.stationName || '-'}}
        </template>
        </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['SC:collect:edit']">修改</el-button>
          <el-button link type="danger" icon="StarFilled" @click="handleDelete(scope.row)" v-hasPermi="['SC:collect:remove']">收藏</el-button>
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

    <!-- 添加或修改收藏管理对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="collectRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="userId">
          <el-select v-model="form.userId" placeholder="请选择用户名" clearable style="width: 150px;">
            <el-option v-for="item in userInfo" :key="item.id" :label="item.name" :value="item.id"/>
          </el-select>
        </el-form-item>
        <el-form-item label="充电站" prop="chargingstationId">
          <el-select v-model="form.chargingstationId" placeholder="请选择充电站" clearable  style="width: 150px;">
            <el-option v-for="item in chargingStationInfo" :key="item.id" :label="item.stationName" :value="item.id"/>
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

<script setup name="Collect">
import { listCollect, getCollect, delCollect, addCollect, updateCollect } from "@/api/SC/collect";
import { listUserinfo} from "@/api/member/userinfo";
import { listChongdianzhan} from "@/api/chargingstation/chongdianzhan";
const { proxy } = getCurrentInstance();

const collectList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");
const userInfo=ref("");
const chargingStationInfo=ref("");
const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    userId: null,
    chargingstationId: null,
  },
  rules: {
    userId: [
      {
        validator:(_,value,callback)=>{
          if(!value) return callback()
          if(form.value.chargingstationId){
            const exits=collectList.value.some(item=>
              item.userId===value && 
              item.chargingstationId===form.value.chargingstationId && item.id!==form.value.id
            )
            if(exits){
              callback(new Error('该用户已经收藏过该充电站'))
            } else callback()
          }else{
            callback()
          }
        },
        trigger:'change'
      }
    ],
    chargingstationId: [
      { 
        validator: (_, value, callback) => {
          if (!value) return callback()
          if (form.value.userId) {
            const exists = collectList.value.some(item => 
              item.userId === form.value.userId && 
              item.chargingstationId === value &&
              item.id !== form.value.id
            )
            if (exists) callback(new Error('该充电站已被此用户收藏'))
            else callback()
          } else {
            callback()
          }
        },
        trigger: 'change'
      }
    ]
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询收藏管理列表 */
function getList() {
  loading.value = true;
  listCollect(queryParams.value).then(response => {
    collectList.value = response.rows;
    total.value = response.total;
    loading.value = false;
  });
}
function getUserInfo(){
  loading.value = true;
  listUserinfo(queryParams.value).then(response => {
    userInfo.value = response.rows;
  });
}
function getChargingStationInfo(){
  loading.value = true;
  listChongdianzhan().then(response => {
    chargingStationInfo.value = response.rows;
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
    spare1: null,
    spare2: null
  };
  proxy.resetForm("collectRef");
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
  title.value = "添加收藏管理";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getCollect(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改收藏管理";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["collectRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateCollect(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addCollect(form.value).then(response => {
          proxy.$modal.msgSuccess("新增成功");
          open.value = false;
          getList();
        });
      }
    }
  });
}

/** 收藏按钮操作 */
function handleDelete(row) {
  const _ids = row.id || ids.value;
  proxy.$modal.confirm('是否确认收藏收藏管理编号为"' + _ids + '"的数据项？').then(function() {
    return delCollect(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("收藏成功");
  }).catch(() => {});
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('SC/collect/export', {
    ...queryParams.value
  }, `collect_${new Date().getTime()}.xlsx`)
}

getList();
getUserInfo();
getChargingStationInfo();
</script>
