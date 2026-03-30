<template>
  <div class="profile-container">
    <el-card class="profile-card">
      <template #header>
        <div class="header">
          <h2>个人信息</h2>
          <el-button type="primary" @click="isEditing = true" v-if="!isEditing">
            <el-icon><Edit /></el-icon>
            编辑资料
          </el-button>
        </div>
      </template>

      <el-form 
        :model="userForm" 
        :rules="rules" 
        ref="userFormRef" 
        label-width="100px"
        :disabled="!isEditing"
      >
        <!-- 基本信息区域 -->
        <h3 class="section-title">基本信息</h3>
        <el-divider />
        
        <div class="avatar-container" v-if="false">
          <el-upload
            class="avatar-uploader"
            action="/api/user/uploadAvatar"
            :headers="uploadHeaders"
            :show-file-list="false"
            :disabled="!isEditing"
            :on-success="handleAvatarSuccess"
            :before-upload="beforeAvatarUpload"
          >
            <el-avatar 
              :size="100" 
              :src="avatarUrl" 
              v-if="avatarUrl"
            />
            <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
            <div class="avatar-text" v-if="isEditing">点击上传头像</div>
          </el-upload>
        </div>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="userForm.username" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="昵称" prop="nickname">
              <el-input v-model="userForm.nickname" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 身体健康数据区域 -->
        <h3 class="section-title">健康数据</h3>
        <el-divider />

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="身高(cm)" prop="height">
              <el-input-number 
                v-model="userForm.height" 
                :min="100" 
                :max="250" 
                :precision="1"
                :step="0.5"
                @change="calculateBMI"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="体重(kg)" prop="weight">
              <el-input-number 
                v-model="userForm.weight" 
                :min="20" 
                :max="200" 
                :precision="1"
                :step="0.5"
                @change="calculateBMI"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="BMI指数" prop="bmi">
              <el-input v-model="userForm.bmi" disabled>
                <template #append>
                  <el-tooltip 
                    :content="bmiTip" 
                    placement="top"
                    effect="light"
                  >
                    <el-tag :type="bmiTagType">{{bmiCategory}}</el-tag>
                  </el-tooltip>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 饮食偏好区域 -->
        <h3 class="section-title">饮食偏好</h3>
        <el-divider />

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="口味偏好" prop="tastePreference">
              <el-select 
                v-model="userForm.tastePreference" 
                multiple
                placeholder="请选择您的口味偏好"
                style="width: 100%"
              >
                <el-option label="清淡" value="清淡" />
                <el-option label="麻辣" value="麻辣" />
                <el-option label="酸甜" value="酸甜" />
                <el-option label="咸鲜" value="咸鲜" />
                <el-option label="香辣" value="香辣" />
                <el-option label="甜味" value="甜味" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="饮食限制" prop="dietaryRestriction" v-show="false">
              <el-select 
                v-model="userForm.dietaryRestriction" 
                multiple
                placeholder="请选择您的饮食限制"
                style="width: 100%"
              >
                <el-option label="无限制" value="无限制" />
                <el-option label="素食主义" value="素食主义" />
                <el-option label="无麸质" value="无麸质" />
                <el-option label="低碳水" value="低碳水" />
                <el-option label="低脂肪" value="低脂肪" />
                <el-option label="禁海鲜" value="禁海鲜" />
                <el-option label="禁乳制品" value="禁乳制品" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="烹饪技能" prop="cookingSkill">
          <el-radio-group v-model="userForm.cookingSkill">
            <el-radio label="初学者">初学者</el-radio>
            <el-radio label="进阶">进阶</el-radio>
            <el-radio label="专业">专业</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 按钮区域 -->
        <div class="button-container" v-if="isEditing">
          <el-button @click="isEditing = false">取消</el-button>
          <el-button type="primary" @click="saveProfile">保存</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { userApi } from '@/api/networkApi'
import { ElMessage } from 'element-plus'
import { Edit, Plus } from '@element-plus/icons-vue'

export default {
  components: {
    Edit,
    Plus
  },
  
  setup() {
    const userFormRef = ref(null)
    const isEditing = ref(false)
    const avatarUrl = ref('')
    
    const userForm = reactive({
      username: '',
      nickname: '',
      height: 170,
      weight: 60,
      bmi: '',
      tastePreference: [],
      dietaryRestriction: [],
      cookingSkill: '初学者'
    })
    
    const rules = {
      nickname: [
        { required: true, message: '请输入昵称', trigger: 'blur' },
        { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
      ],
      height: [
        { required: true, message: '请输入身高', trigger: 'change' }
      ],
      weight: [
        { required: true, message: '请输入体重', trigger: 'change' }
      ]
    }

    // 计算BMI
    const calculateBMI = () => {
      if (userForm.height && userForm.weight) {
        // 将身高从cm转换为m
        const heightInMeter = userForm.height / 100
        // 计算BMI: 体重(kg) / 身高(m)²
        userForm.bmi = (userForm.weight / (heightInMeter * heightInMeter)).toFixed(1)
      }
    }
    
    // BMI分类
    const bmiCategory = computed(() => {
      const bmi = parseFloat(userForm.bmi)
      if (!bmi) return '未计算'
      if (bmi < 18.5) return '偏瘦'
      if (bmi < 24) return '正常'
      if (bmi < 28) return '偏胖'
      return '肥胖'
    })
    
    // BMI标签类型
    const bmiTagType = computed(() => {
      const category = bmiCategory.value
      if (category === '正常') return 'success'
      if (category === '偏瘦') return 'warning'
      if (category === '偏胖') return 'warning'
      if (category === '肥胖') return 'danger'
      return 'info'
    })
    
    // BMI提示
    const bmiTip = computed(() => {
      const category = bmiCategory.value
      if (category === '正常') return 'BMI正常范围：18.5-23.9'
      if (category === '偏瘦') return 'BMI偏低，建议适当增加营养摄入'
      if (category === '偏胖') return 'BMI偏高，建议控制饮食并增加运动'
      if (category === '肥胖') return 'BMI过高，建议咨询医生制定健康计划'
      return '请输入身高体重计算BMI'
    })
    
    // 上传头像相关
    const uploadHeaders = computed(() => {
      return { 
        Authorization: `Bearer ${localStorage.getItem('token')}` 
      }
    })
    
    // 头像上传成功
    const handleAvatarSuccess = (response, uploadFile) => {
      avatarUrl.value = response.data
      userForm.avatar = response.data
      ElMessage.success('头像上传成功')
    }
    
    // 头像上传前的校验
    const beforeAvatarUpload = (file) => {
      const isImage = file.type.startsWith('image/')
      const isLt2M = file.size / 1024 / 1024 < 2
      
      if (!isImage) {
        ElMessage.error('上传头像图片只能是图片格式!')
        return false
      }
      if (!isLt2M) {
        ElMessage.error('上传头像图片大小不能超过 2MB!')
        return false
      }
      return true
    }
    
    // 获取用户信息
    const getUserInfo = async () => {
      try {
        const userInfo = await userApi.getUserInfo()
        
        userForm.username = userInfo.username
        userForm.nickname = userInfo.nickname || ''
        userForm.bmi = userInfo.bmi || ''
        userForm.tastePreference = userInfo.taste_preference ? userInfo.taste_preference.split(',') : []
        userForm.dietaryRestriction = userInfo.dietary_restriction ? userInfo.dietary_restriction.split(',') : []
        userForm.cookingSkill = userInfo.cooking_skill || '初学者'
        
        // 如果BMI存在，反推身高体重
        if (userInfo.bmi) {
          // 假设身高已经存在或使用默认值
          userForm.height = userInfo.height || 170
          // 根据BMI和身高计算体重: BMI * 身高(m)²
          const heightInMeter = userForm.height / 100
          userForm.weight = (userInfo.bmi * heightInMeter * heightInMeter).toFixed(1)
        }
        
        // 设置头像
        if (userInfo.avatar) {
          avatarUrl.value = userInfo.avatar
        }
      } catch (error) {
        ElMessage.error('获取用户信息失败')
        console.error(error)
      }
    }
    
    // 保存用户信息
    const saveProfile = async () => {
      userFormRef.value.validate(async (valid) => {
        if (valid) {
          try {
            // 准备数据
            const updatedData = {
              nickname: userForm.nickname,
              bmi: userForm.bmi,
              height: userForm.height,
              weight: userForm.weight,
              taste_preference: userForm.tastePreference.join(','),
              dietary_restriction: userForm.dietaryRestriction.join(','),
              cooking_skill: userForm.cookingSkill,
              avatar: avatarUrl.value
            }
            
            await userApi.updateUserInfo(updatedData)
            ElMessage.success('保存成功')
            isEditing.value = false
          } catch (error) {
            ElMessage.error('保存失败')
            console.error(error)
          }
        } else {
          ElMessage.warning('请正确填写表单')
          return false
        }
      })
    }
    
    onMounted(() => {
      getUserInfo()
    })
    
    return {
      userFormRef,
      userForm,
      rules,
      isEditing,
      avatarUrl,
      uploadHeaders,
      bmiCategory,
      bmiTagType,
      bmiTip,
      calculateBMI,
      handleAvatarSuccess,
      beforeAvatarUpload,
      saveProfile
    }
  }
}
</script>

<style scoped>
.profile-container {
  padding: 20px;
}

.profile-card {
  max-width: 1000px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  color: #303133;
  margin-top: 20px;
  margin-bottom: 5px;
}

.avatar-container {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
}

.avatar-uploader {
  text-align: center;
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 100px;
  height: 100px;
  line-height: 100px;
  border: 1px dashed #d9d9d9;
  border-radius: 50%;
}

.avatar-text {
  margin-top: 10px;
  color: #606266;
  font-size: 14px;
}

.button-container {
  margin-top: 30px;
  text-align: center;
}
</style> 