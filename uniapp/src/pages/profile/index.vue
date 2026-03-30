<template>
  <view class="page">
    <view class="hero-card">
      <view class="avatar">{{ avatarText }}</view>
      <view class="hero-info">
        <text class="hero-name">{{ userForm.nickname || userForm.username || '用户' }}</text>
        <text class="hero-desc">管理个人口味、身体数据和推荐偏好</text>
      </view>
      <button class="ghost-btn" @tap="toggleEdit">
        {{ isEditing ? '取消' : '编辑' }}
      </button>
    </view>

    <view class="link-grid">
      <view class="link-card" @tap="openFavorites">
        <text class="link-title">我的收藏</text>
        <text class="link-desc">查看常用菜品</text>
      </view>
      <view class="link-card accent" @tap="openRecommend">
        <text class="link-title">智能推荐</text>
        <text class="link-desc">按偏好筛选</text>
      </view>
    </view>

    <view class="panel">
      <view class="section-head">
        <text class="section-title">基础信息</text>
      </view>

      <view class="field">
        <text class="label">用户名</text>
        <input class="input disabled" :value="userForm.username" disabled />
      </view>

      <view class="field">
        <text class="label">昵称</text>
        <input v-model="userForm.nickname" class="input" :disabled="!isEditing" />
      </view>
    </view>

    <view class="panel">
      <view class="section-head">
        <text class="section-title">身体数据</text>
        <text class="section-tip">BMI {{ bmi }} · {{ bmiLabel }}</text>
      </view>

      <view class="inline-fields">
        <view class="field half">
          <text class="label">身高(cm)</text>
          <input
            v-model="userForm.height"
            class="input"
            type="number"
            :disabled="!isEditing"
            @input="recalculateBmi"
          />
        </view>

        <view class="field half">
          <text class="label">体重(kg)</text>
          <input
            v-model="userForm.weight"
            class="input"
            type="number"
            :disabled="!isEditing"
            @input="recalculateBmi"
          />
        </view>
      </view>

      <view class="metric-card">
        <text class="metric-value">{{ bmi }}</text>
        <text class="metric-desc">{{ bmiMessage }}</text>
      </view>
    </view>

    <view class="panel">
      <view class="section-head">
        <text class="section-title">饮食偏好</text>
      </view>

      <view class="field">
        <text class="label">口味偏好</text>
        <view class="chip-list">
          <view
            v-for="item in tasteOptions"
            :key="item"
            :class="['chip', { active: userForm.tastePreference.includes(item), disabled: !isEditing }]"
            @tap="toggleArrayValue('tastePreference', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="field">
        <text class="label">饮食限制</text>
        <view class="chip-list">
          <view
            v-for="item in dietaryOptions"
            :key="item"
            :class="['chip', { active: userForm.dietaryRestriction.includes(item), disabled: !isEditing }]"
            @tap="toggleArrayValue('dietaryRestriction', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="field">
        <text class="label">烹饪技能</text>
        <view class="chip-list">
          <view
            v-for="item in cookingSkillOptions"
            :key="item"
            :class="['chip', { active: userForm.cookingSkill === item, disabled: !isEditing }]"
            @tap="selectCookingSkill(item)"
          >
            {{ item }}
          </view>
        </view>
      </view>
    </view>

    <button v-if="isEditing" class="primary-btn" :loading="saving" @tap="saveProfile">
      保存资料
    </button>
  </view>
</template>

<script>
import { userApi } from '../../api/modules/user'
import { ensureLoggedIn } from '../../utils/auth'
import { pickPayload } from '../../utils/response'
import { getUserInfo as getStoredUserInfo, setUserInfo } from '../../utils/storage'

export default {
  data() {
    return {
      loading: false,
      saving: false,
      isEditing: false,
      tasteOptions: ['清淡', '麻辣', '酸甜', '咸鲜', '香辣', '甜味'],
      dietaryOptions: ['无限制', '素食主义', '无麸质', '低碳水', '低脂肪', '禁海鲜', '禁乳制品'],
      cookingSkillOptions: ['初学者', '进阶', '专业'],
      userForm: {
        username: '',
        nickname: '',
        height: '170',
        weight: '60',
        bmi: '',
        tastePreference: [],
        dietaryRestriction: [],
        cookingSkill: '初学者'
      }
    }
  },
  onShow() {
    if (!ensureLoggedIn()) return
    this.loadProfile()
  },
  computed: {
    bmi() {
      return this.userForm.bmi || '--'
    },
    bmiLabel() {
      const value = Number(this.userForm.bmi || 0)
      if (!value) return '未计算'
      if (value < 18.5) return '偏瘦'
      if (value < 24) return '正常'
      if (value < 28) return '偏胖'
      return '肥胖'
    },
    bmiMessage() {
      const label = this.bmiLabel
      if (label === '正常') return '当前身体数据处于合理区间'
      if (label === '偏瘦') return '建议适度增加营养摄入'
      if (label === '偏胖') return '建议控制饮食并加强运动'
      if (label === '肥胖') return '建议结合医生建议制定计划'
      return '输入身高和体重后自动计算'
    },
    avatarText() {
      const name = this.userForm.nickname || this.userForm.username || 'U'
      return String(name).slice(0, 1).toUpperCase()
    }
  },
  methods: {
    async loadProfile() {
      this.loading = true
      try {
        const payload = pickPayload(await userApi.getUserInfo())
        const stored = getStoredUserInfo()
        const merged = {
          ...stored,
          ...payload
        }

        this.userForm.username = merged.username || ''
        this.userForm.nickname = merged.nickname || ''
        this.userForm.height = String(merged.height || 170)
        this.userForm.weight = String(merged.weight || 60)
        this.userForm.bmi = merged.bmi ? String(merged.bmi) : ''
        this.userForm.tastePreference = merged.tastePreference ? merged.tastePreference.split(',') : []
        this.userForm.dietaryRestriction = merged.dietaryRestriction ? merged.dietaryRestriction.split(',') : []
        this.userForm.cookingSkill = merged.cookingSkill || '初学者'

        if (!this.userForm.bmi) {
          this.recalculateBmi()
        }
      } catch (error) {
        // request layer handled toast
      } finally {
        this.loading = false
      }
    },
    toggleEdit() {
      this.isEditing = !this.isEditing
      if (!this.isEditing) {
        this.loadProfile()
      }
    },
    recalculateBmi() {
      const height = Number(this.userForm.height || 0)
      const weight = Number(this.userForm.weight || 0)

      if (!height || !weight) {
        this.userForm.bmi = ''
        return
      }

      const heightInMeter = height / 100
      const bmi = weight / (heightInMeter * heightInMeter)
      this.userForm.bmi = bmi.toFixed(1)
    },
    toggleArrayValue(field, value) {
      if (!this.isEditing) return
      const current = this.userForm[field]

      if (current.includes(value)) {
        this.userForm[field] = current.filter((item) => item !== value)
        return
      }

      this.userForm[field] = [...current, value]
    },
    selectCookingSkill(value) {
      if (!this.isEditing) return
      this.userForm.cookingSkill = value
    },
    async saveProfile() {
      if (!this.userForm.nickname.trim()) {
        uni.showToast({
          title: '请输入昵称',
          icon: 'none'
        })
        return
      }

      this.saving = true
      this.recalculateBmi()

      try {
        const payload = {
          nickname: this.userForm.nickname.trim(),
          bmi: this.userForm.bmi,
          height: Number(this.userForm.height || 0),
          weight: Number(this.userForm.weight || 0),
          tastePreference: this.userForm.tastePreference.join(','),
          dietaryRestriction: this.userForm.dietaryRestriction.join(','),
          cookingSkill: this.userForm.cookingSkill
        }

        const response = await userApi.updateUserInfo(payload)
        const nextUserInfo = {
          ...getStoredUserInfo(),
          ...pickPayload(response),
          ...payload,
          username: this.userForm.username
        }

        setUserInfo({
          ...nextUserInfo
        })

        uni.showToast({
          title: '保存成功',
          icon: 'success'
        })

        this.isEditing = false
      } catch (error) {
        // request layer handled toast
      } finally {
        this.saving = false
      }
    },
    openFavorites() {
      uni.navigateTo({
        url: '/pages/favorites/index'
      })
    },
    openRecommend() {
      uni.navigateTo({
        url: '/pages/recommend/index'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 24rpx 40rpx;
}

.hero-card,
.link-card,
.panel {
  border: 1rpx solid rgba(234, 215, 196, 0.95);
  border-radius: 28rpx;
  background: $panel-bg;
  box-shadow: $shadow-soft;
}

.hero-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 26rpx;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  color: #fff7ee;
  font-size: 34rpx;
  font-weight: 700;
}

.hero-info {
  flex: 1;
}

.hero-name {
  display: block;
  color: $text-primary;
  font-size: 34rpx;
  font-weight: 700;
}

.hero-desc {
  display: block;
  margin-top: 10rpx;
  color: $text-secondary;
  font-size: 24rpx;
  line-height: 1.6;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 112rpx;
  height: 64rpx;
  padding: 0 18rpx;
  border: 1rpx solid rgba(217, 119, 6, 0.22);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.76);
  color: $brand-primary;
  font-size: 24rpx;
}

.link-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-top: 20rpx;
}

.link-card {
  padding: 22rpx;
}

.link-card.accent {
  background: rgba(255, 244, 230, 0.96);
}

.link-title {
  display: block;
  color: $text-primary;
  font-size: 28rpx;
  font-weight: 700;
}

.link-desc {
  display: block;
  margin-top: 8rpx;
  color: $text-secondary;
  font-size: 22rpx;
}

.panel {
  margin-top: 20rpx;
  padding: 24rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.section-title {
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 700;
}

.section-tip {
  color: $text-secondary;
  font-size: 22rpx;
}

.field + .field {
  margin-top: 18rpx;
}

.label {
  display: block;
  margin-bottom: 10rpx;
  color: $text-secondary;
  font-size: 24rpx;
}

.input {
  width: 100%;
  height: 84rpx;
  padding: 0 22rpx;
  border-radius: 20rpx;
  background: #fffdf9;
  border: 1rpx solid $border-color;
  color: $text-primary;
}

.input.disabled {
  background: #f6ede2;
  color: $text-light;
}

.inline-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.metric-card {
  margin-top: 20rpx;
  padding: 22rpx;
  border-radius: 22rpx;
  background: #fff8f0;
}

.metric-value {
  display: block;
  color: $brand-secondary;
  font-size: 42rpx;
  font-weight: 700;
}

.metric-desc {
  display: block;
  margin-top: 10rpx;
  color: $text-secondary;
  font-size: 24rpx;
  line-height: 1.6;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.chip {
  padding: 14rpx 18rpx;
  border-radius: 999rpx;
  background: #fff8f0;
  border: 1rpx solid $border-color;
  color: $text-secondary;
  font-size: 24rpx;
}

.chip.active {
  background: rgba(217, 119, 6, 0.12);
  border-color: rgba(217, 119, 6, 0.2);
  color: $brand-primary;
}

.chip.disabled {
  opacity: 0.72;
}

.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 92rpx;
  margin-top: 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  color: #fff7ee;
  font-size: 30rpx;
  font-weight: 700;
}
</style>
