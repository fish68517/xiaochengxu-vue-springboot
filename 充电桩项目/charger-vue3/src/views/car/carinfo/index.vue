<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="车牌号" prop="licenceNumber">
        <el-input
          v-model="queryParams.licenceNumber"
          placeholder="请输入车牌号"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="用户" prop="user_id">
        <el-input
          v-model="queryParams.userName"
          placeholder="请输入用户"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="车辆类型" prop="carModel_id">
        <el-select v-model="queryParams.carModel_id" placeholder="请选择车辆类型" style="width: 160px" clearable @keyup.enter="handleQuery">
          <el-option v-for="item in carmodelList" :key="item.id" :label="item.carModel" :value="item.id" />
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
          v-hasPermi="['car:carinfo:add']"
        >新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['car:carinfo:edit']"
        >修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['car:carinfo:remove']"
        >删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['car:carinfo:export']"
        >导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="carinfoList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="车辆信息id" align="center" prop="id" />
      <el-table-column label="车牌号" align="center" prop="licenceNumber" />
      <el-table-column label="续航里程" align="center" prop="mileage" />
      <el-table-column label="用户" align="center" prop="user_id">
        <template #default="scope">
          {{ userinfoMap[scope.row.user_id] }}
        </template>
      </el-table-column>
      <el-table-column label="车辆类型" align="center" prop="carModel_id">
        <template #default="scope">
          {{ carmodelMap[scope.row.carModel_id] }}
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['car:carinfo:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['car:carinfo:remove']">删除</el-button>
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

    <!-- 添加或修改车辆信息对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="carinfoRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="车牌号" prop="licenceNumber">
          <el-input v-model="form.licenceNumber" placeholder="请输入车牌号" />
        </el-form-item>
        <el-form-item label="续航里程" prop="mileage">
          <el-input v-model="form.mileage" placeholder="请输入续航里程" />
        </el-form-item>
        <el-form-item label="用户" prop="user_id">
          <el-select v-model="form.user_id" placeholder="请选择用户" style="width: 160px">
              <el-option v-for="item in userinfoList" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="车辆类型" prop="carModel_id">
          <el-select v-model="form.carModel_id" placeholder="请选择车辆类型" style="width: 160px">
              <el-option v-for="item in carmodelList" :key="item.id" :label="item.carModel" :value="item.id" />
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

<script setup name="Carinfo">
import { listCarinfo, getCarinfo, delCarinfo, addCarinfo, updateCarinfo } from "@/api/car/carinfo";
import { listUserinfo} from "@/api/member/userinfo";
import { listCarmodel} from "@/api/car/carmodel";

const { proxy } = getCurrentInstance();

const carinfoList = ref([]);
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
    licenceNumber: null,
    user_id: null,
    carModel_id: null,
    userName: null
  },
  rules: {
    licenceNumber: [
      { required: true, message: "车牌号不能为空", trigger: "blur" },
      {
      pattern: /^[\u4e00-\u9fa5][A-Z][A-Z0-9]{5}$/,
      message: '车牌号格式不正确,例如:粤B12345',
      trigger: ['blur', 'change']
    }
    ],
    mileage: [
      { required: true, message: "续航里程不能为空", trigger: "blur" }
    ],
    user_id: [
      { required: true, message: "用户id不能为空", trigger: "blur" }
    ],
    carModel_id: [
      { required: true, message: "车辆类型id不能为空", trigger: "blur" }
    ],
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询车辆信息列表 */
function getList() {
  loading.value = true;
  const inputName = queryParams.value.userName?.trim();
  if(inputName){
    const match = userinfoList.value.find(user => user.name === inputName);
    queryParams.value.user_id = match ? match.id : null;
  } else {
    queryParams.value.user_id = null; 
  }
  listCarinfo(queryParams.value).then(response => {
    carinfoList.value = response.rows;
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
    licenceNumber: null,
    mileage: null,
    user_id: null,
    carModel_id: null,
    del: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("carinfoRef");
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm("queryRef");
  queryParams.value.userName = null;
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
  title.value = "添加车辆信息";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getCarinfo(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改车辆信息";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["carinfoRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateCarinfo(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addCarinfo(form.value).then(response => {
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
  proxy.$modal.confirm('是否确认删除车辆信息编号为"' + _ids + '"的数据项？').then(function() {
    return delCarinfo(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {});
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('car/carinfo/export', {
    ...queryParams.value
  }, `carinfo_${new Date().getTime()}.xlsx`)
}

// 获取车辆类型
const queryCarModelParams = ref({
  pageNum: 1,
  pageSize: 20,
  carModel: null,
  carBrandId: null,
});
const carmodelMap = ref({});
const carmodelList = ref([]);
function getCarmodelList() {
  loading.value = true;
  listCarmodel(queryCarModelParams.value).then(response => {
    carmodelList.value = response.rows;
    carmodelMap.value = {};
    for(const item of response.rows){
      carmodelMap.value[item.id] = item.carModel;
    }
    loading.value = false;
  }); 
  
}

// 获取用户列表
const queryUserinfoParams = ref({
  pageNum: 1,
  pageSize: 20,
  name: null, 
  phoneNum: null
})
const userinfoMap = ref([]);
const userinfoList = ref([]);
function getUserinfoList() {
  loading.value = true;
  listUserinfo(queryUserinfoParams.value).then(response => {
    userinfoList.value = response.rows;
    userinfoMap.value = {};
    for(const item of response.rows){
      userinfoMap.value[item.id] = item.name; 
    }
    loading.value = false;
    console.log(userinfoMap.value)
    console.log(userinfoList.value)
  });
}

getCarmodelList();
getUserinfoList();
getList();
</script>
