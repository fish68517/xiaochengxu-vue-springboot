<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="电站名称" prop="stationName">
        <el-input v-model="queryParams.stationName" placeholder="请输入电站名称" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="电站地址" prop="stationAddress">
        <el-input v-model="queryParams.stationAddress" placeholder="请输入电站地址" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="停车收费" prop="stop">
        <el-select v-model="queryParams.stop" placeholder="请选择停车收费" clearable style="width: 150px;">
          <el-option v-for="dict in tingche" :key="dict.value" :label="dict.label" :value="dict.value" />
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
          v-hasPermi="['chargingstation:chongdianzhan:add']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate"
          v-hasPermi="['chargingstation:chongdianzhan:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete"
          v-hasPermi="['chargingstation:chongdianzhan:remove']">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" @click="handleExport"
          v-hasPermi="['chargingstation:chongdianzhan:export']">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="chongdianzhanList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="编号" align="center" prop="id" />
      <el-table-column label="电站名称" align="center" prop="stationName" />
      <el-table-column label="电站地址" align="center" prop="stationAddress" />
      <el-table-column label="坐标经度" align="center" prop="longitude" />
      <el-table-column label="坐标纬度" align="center" prop="latitude" />
      <el-table-column label="实景图" align="center" prop="stationPhoto" width="100">
        <template #default="scope">
          <image-preview :src="scope.row.stationPhoto" :width="50" :height="50" />
        </template>
      </el-table-column>
      <el-table-column label="电桩数量" align="center">
        <template #default="scope">
          <span>{{ scope.row.stumpCount || 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="停车收费" align="center" prop="stop">
        <template #default="scope">
          <dict-tag :options="tingche" :value="scope.row.stop" />
        </template>
      </el-table-column>
      <el-table-column label="开放时间" align="center">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleDetails(scope.row)"
            v-hasPermi="['chargingstation:chongdianzhan:edit']">详情</el-button>
        </template>
      </el-table-column>
      <el-table-column label="站点服务" align="center">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="servicesDetails(scope.row)"
            v-hasPermi="['chargingstation:chongdianzhan:edit']">详情</el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)"
            v-hasPermi="['chargingstation:chongdianzhan:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)"
            v-hasPermi="['chargingstation:chongdianzhan:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 添加或修改电站信息对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="chongdianzhanRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="电站名称" prop="stationName">
          <el-input v-model="form.stationName" placeholder="请输入电站名称" />
        </el-form-item>
        <el-form-item label="电站地址" prop="stationAddress">
          <el-input v-model="form.stationAddress" placeholder="请输入电站地址" @blur="getLocation" clearable>
            <template #suffix>
              <el-icon v-if="loadingLocation" class="is-loading">
                <Loading />
              </el-icon>
            </template>
          </el-input>
          <div class="tip" style="font-size:12px;color:#999">输入完成后请失焦自动获取坐标</div>
        </el-form-item>
        <el-form-item label="坐标经度" prop="longitude">
          <el-input v-model="form.longitude" placeholder="自动获取或手动输入经度" :disabled="loadingLocation" />
        </el-form-item>
        <el-form-item label="坐标纬度" prop="latitude">
          <el-input v-model="form.latitude" placeholder="自动获取或手动输入纬度" :disabled="loadingLocation" />
        </el-form-item>
        <el-form-item label="实景图" prop="stationPhoto">
          <image-upload v-model="form.stationPhoto" />
        </el-form-item>
        <el-form-item label="电桩数量" prop="stumpNum">
          <el-input v-model="form.stumpNum" placeholder="请输入电桩数量" />
        </el-form-item>
        <el-form-item label="站点介绍" prop="stationIntroduction">
          <el-input v-model="form.stationIntroduction" type="textarea" placeholder="请输入内容" />
        </el-form-item>
        <el-form-item label="停车收费" prop="stop">
          <el-select v-model="form.stop" placeholder="请选择停车收费">
            <el-option v-for="dict in tingche" :key="dict.value" :label="dict.label"
              :value="parseInt(dict.value)"></el-option>
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

    <!-- 开放时间详情对话框 -->
    <el-dialog :title="`${selectedStationName} 开放时间详情`" v-model="openOpeningTimeDialog" width="500px" append-to-body>
      <div v-if="openingTimeInfo.length > 0">
        <div v-for="(item, index) in openingTimeInfo" :key="index" style="margin: 8px 0">
          {{ item.openData }}: {{ item.openTimePeriod }}
        </div>
      </div>
      <div v-else>暂无开放时间信息</div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="openOpeningTimeDialog = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
    <!-- 站点服务详情对话框 -->
    <el-dialog :title="`${selectedStationName} 站点服务详情`" v-model="openServicesDialog" width="500px" append-to-body>
      <div v-if="servicesInfo.length > 0">
        <div v-for="(service, index) in servicesInfo" :key="index">
          <div><img :src="service.icon" alt="服务图标" style="width: 15px; height: 15px; margin-right: 5px;">{{
            service.serviceType }}</div>
        </div>
      </div>
      <div v-else>暂无站点服务信息</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="openServicesDialog = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Chongdianzhan">
import { listChongdianzhan, getChongdianzhan, delChongdianzhan, addChongdianzhan, updateChongdianzhan, getOpeningTimesByStationId, selectServicesByStationId } from "@/api/chargingstation/chongdianzhan";
// 引入axios组件
import axios from "axios";
import {stumpCount} from "@/api/chargingstation/stump";
// 定义一个函数，根据地址用来获取经纬度

const loadingLocation = ref(false); // 添加加载状态
async function getLocation() {
  try {
    loadingLocation.value = true; // 开始加载
    const resp = await axios.get('https://restapi.amap.com/v3/geocode/geo', {
      params: {
        key: '457886b5972a97e93fb9cdccebfd450f',
        address: form.value.stationAddress
      }
    });
    
    if (resp.data.geocodes?.length > 0) {
      const [longitude, latitude] = resp.data.geocodes[0].location.split(',');
      form.value.longitude = Number(longitude).toFixed(2);
      form.value.latitude = Number(latitude).toFixed(2);
    } else {
      proxy.$modal.msgWarning("未找到该地址对应的坐标");
    }
  } catch (error) {
    console.error('获取经纬度失败:', error);
    proxy.$modal.msgError("坐标获取失败，请手动输入");
  } finally {
    loadingLocation.value = false; // 结束加载
  }
}
const { proxy } = getCurrentInstance();
const { tingche } = proxy.useDict('tingche');

const chongdianzhanList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");
const openOpeningTimeDialog = ref(false);
const openingTimeInfo = ref("");
const selectedStationName = ref("");

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    stationName: null,
    stationAddress: null,
    stop: null,
  },
  rules: {
    stationName: [
      { required: true, message: "电站名称不能为空", trigger: "blur" }
    ],
    stationAddress: [
      { required: true, message: "电站地址不能为空", trigger: "blur" }
    ],
    longitude: [
      { required: true, message: "坐标经度不能为空", trigger: "blur" }
    ],
    latitude: [
      { required: true, message: "坐标纬度不能为空", trigger: "blur" }
    ],
    stop: [
      { required: true, message: "停车收费不能为空", trigger: "change" }
    ],
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询电站信息列表 */
async function getList() {
  loading.value = true;
  try {
    const response = await listChongdianzhan(queryParams.value);
    // 获取所有充电站ID
    const stationIds = response.rows.map(station => station.id);
    // 批量获取充电桩数量（假设stumpCount支持批量查询，若不支持则需要单个查询）
    const countResponses = await Promise.all(
      stationIds.map(stationId => stumpCount(stationId))
    );
    // 合并数据
    const updatedStations = response.rows.map((station, index) => ({
      ...station,
      stumpCount: countResponses[index].data 
    }));
    chongdianzhanList.value = updatedStations;
    total.value = response.total;
  } finally {
    loading.value = false;
  }
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
    stationName: null,
    stationAddress: null,
    longitude: null,
    latitude: null,
    stationPhoto: null,
    stumpNum: null,
    stationIntroduction: null,
    stop: null,
    del: null,
    spare1: null,
    spare2: null
  };
  proxy.resetForm("chongdianzhanRef");
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
  title.value = "添加电站信息";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getChongdianzhan(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改电站信息";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["chongdianzhanRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateChongdianzhan(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addChongdianzhan(form.value).then(response => {
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
  proxy.$modal.confirm('是否确认删除电站信息编号为"' + _ids + '"的数据项？').then(function () {
    return delChongdianzhan(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => { });
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('chargingstation/chongdianzhan/export', {
    ...queryParams.value
  }, `chongdianzhan_${new Date().getTime()}.xlsx`)
}

/** 查看开放时间详情按钮操作 */
async function handleDetails(row) {
  try {
    selectedStationName.value = row.stationName;
    const response = await getOpeningTimesByStationId(row.id);
    // 确保响应数据是数组格式
    openingTimeInfo.value = Array.isArray(response.data) ? response.data : [];
    openOpeningTimeDialog.value = true;
  } catch (error) {
    console.error("获取开放时间失败:", error);
    proxy.$modal.msgError("获取开放时间信息失败");
    openingTimeInfo.value = []; // 确保失败时清空数据
  }
}
const openServicesDialog = ref(false);
const servicesInfo = ref([]);

/** 查看站点服务详情按钮操作 */
async function servicesDetails(row) {
  selectedStationName.value = row.stationName;
  try {
    const response = await selectServicesByStationId(row.id);
    console.log('response 数据:', response);
    servicesInfo.value = response.data || [];
    console.log('servicesInfo 数据:', servicesInfo.value);
    openServicesDialog.value = true;
    console.log(servicesInfo);
  } catch (error) {
    proxy.$modal.msgError("获取站点服务信息失败");
  }
}
getList();
</script>    