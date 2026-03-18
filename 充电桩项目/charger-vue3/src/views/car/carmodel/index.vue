<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="车型" prop="carModel">
        <el-input
          v-model="queryParams.carModel"
          placeholder="请输入车型"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="车辆品牌" prop="carBrandId">
          <el-select v-model="queryParams.carBrandId" placeholder="请选择车辆品牌" style="width: 160px" clearable
          @keyup.enter="handleQuery">
              <el-option v-for="item in carbrandList" :key="item.id" :label="item.brand" :value="item.id" />
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
          v-hasPermi="['car:carmodel:add']"
        >新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['car:carmodel:edit']"
        >修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['car:carmodel:remove']"
        >删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['car:carmodel:export']"
        >导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="carmodelList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="车型id" align="center" prop="id" />
      <el-table-column label="车型图片" align="center" prop="modelImage" width="100">
        <template #default="scope">
          <image-preview :src="scope.row.modelImage" :width="50" :height="50"/>
        </template>
      </el-table-column>
      <el-table-column label="车型" align="center" prop="carModel" />
      <el-table-column label="车辆品牌" align="center" prop="carBrandId" >
        <template #default="scope">
          {{carbrandList[scope.row.carBrandId-1].brand}}
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['car:carmodel:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['car:carmodel:remove']">删除</el-button>
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

    <!-- 添加或修改车辆类型对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="carmodelRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="车型图片" prop="modelImage">
          <image-upload v-model="form.modelImage"/>
        </el-form-item>
        <el-form-item label="车辆品牌">
          <el-select v-model="form.carBrandId" placeholder="请选择车辆品牌" style="width: 160px">
              <el-option v-for="item in carbrandList" :key="item.id" :label="item.brand" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="车型" prop="carModel">
          <el-input v-model="form.carModel" placeholder="请输入车型" />
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

<script setup name="Carmodel">
import { listCarmodel, getCarmodel, delCarmodel, addCarmodel, updateCarmodel } from "@/api/car/carmodel";
import { listCarbrand } from "@/api/car/carbrand";

const { proxy } = getCurrentInstance();

const carmodelList = ref([]);
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
    carModel: null,
    carBrandId: null,
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询车辆类型列表 */
function getList() {
  loading.value = true;
  listCarmodel(queryParams.value).then(response => {
    carmodelList.value = response.rows;
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
    modelImage: null,
    carModel: null,
    carBrandId: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("carmodelRef");
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
  title.value = "添加车辆类型";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getCarmodel(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改车辆类型";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["carmodelRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateCarmodel(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addCarmodel(form.value).then(response => {
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
  proxy.$modal.confirm('是否确认删除车辆类型编号为"' + _ids + '"的数据项？').then(function() {
    return delCarmodel(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {});
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('car/carmodel/export', {
    ...queryParams.value
  }, `carmodel_${new Date().getTime()}.xlsx`)
}

// 获取车辆品牌列表
// 查询车辆品牌的参数
const queryBrandParams = ref({
  pageNum: 1,
  pageSize: 10,
  brand: null,
});
// 车辆品牌列表
const carbrandList = ref([]);

function getCarBrandList() {
  loading.value = true;
  listCarbrand(queryBrandParams.value).then(response => {
    carbrandList.value = response.rows;
    total.value = response.total;
    loading.value = false;
  })
}

getCarBrandList();
getList();
</script>
