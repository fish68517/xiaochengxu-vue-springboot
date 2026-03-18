<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="故障类别" prop="questionDescribe">
        <el-select v-model="queryParams.questionId" placeholder="请选择故障类别" clearable style="width: 192px">
          <el-option
            v-for="dict in types"
            :key="dict.id"
            :label="dict.questionDescribe"
            :value="dict.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="del">
        <el-input
          v-model="queryParams.del"
          placeholder="请输入逻辑删状态"
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
          v-hasPermi="['breaks:answer:add']"
        >新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['breaks:answer:edit']"
        >修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['breaks:answer:remove']"
        >删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['breaks:answer:export']"
        >导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="answerList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="编号" align="center" prop="id" />
      <el-table-column label="问题id" align="center" prop="questionId" >
        <template #default="scope">
           <span v-for="t in types" :key="t">
            <span v-if="t.id==scope.row.questionId">{{ t.questionDescribe }}</span>
           </span>
        </template>
      </el-table-column>
      <el-table-column label="答案描述" align="center" prop="answerDescribe">
        <template #default="scope">
            <el-button type="text" @click="showDetails(scope.row)">查看详情</el-button>
        </template>
      </el-table-column>
      <el-table-column label="逻辑删状态" align="center" prop="del" />
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['breaks:answer:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['breaks:answer:remove']">删除</el-button>
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

    <!-- 添加或修改答案管理对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="answerRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="答案描述" prop="answerDescribe">
          <el-input v-model="form.answerDescribe" type="textarea" placeholder="请输入内容" />
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
  <!-- 查看详情 -->
  <el-dialog v-model="detailsDialogVisible" width="800" style="height: 500px;">
        <div v-html="currentArticleDetails"></div>
    </el-dialog>
</template>

<script setup name="Answer">
import { listAnswer, getAnswer, delAnswer, addAnswer, updateAnswer } from "@/api/breaks/answer";
import { listQuestion } from "@/api/breaks/question";

const { proxy } = getCurrentInstance();

const answerList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");

// 问题类型
const types = ref([]);
// 获取问题类型
function getTypes() {
  listQuestion().then(response => {
    types.value = response.rows;
    console.log(types.value);
  });
}
const detailsDialogVisible = ref(false); // 详情内容弹框的显示状态
const currentArticleDetails = ref(''); // 当前答案的详情内容
// 显示详情内容的函数
const showDetails = (row) => {
    currentArticleDetails.value = row.answerDescribe;
    detailsDialogVisible.value = true;
};

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    questionId: null,
    answerDescribe: null,
    del: null,
  },
  rules: {
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询答案管理列表 */
function getList() {
  loading.value = true;
  listAnswer(queryParams.value).then(response => {
    answerList.value = response.rows;
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
    questionId: null,
    answerDescribe: null,
    del: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("answerRef");
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
  title.value = "添加答案管理";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getAnswer(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改答案管理";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["answerRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateAnswer(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addAnswer(form.value).then(response => {
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
  proxy.$modal.confirm('是否确认删除答案管理编号为"' + _ids + '"的数据项？').then(function() {
    return delAnswer(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {});
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('breaks/answer/export', {
    ...queryParams.value
  }, `answer_${new Date().getTime()}.xlsx`)
}

getList();
getTypes();
</script>
