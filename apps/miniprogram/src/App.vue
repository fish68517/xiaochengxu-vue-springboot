<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'

onLaunch(async () => {
  console.info('萌宠生活商城 development 环境启动')
  await useAuthStore().restoreSession()
})
</script>

<style lang="scss">
page {
  background: #fff9f1;
  color: #2b211b;
}
</style>
