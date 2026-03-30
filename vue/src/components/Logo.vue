<template>
  <svg
    class="logo-svg"
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- 背景圆 -->
    <circle cx="100" cy="100" r="90" fill="#1890ff" />
    
    <!-- 餐具图标 -->
    <g fill="#fff" transform="translate(50, 50)">
      <!-- 叉子 -->
      <path d="M20,0 L30,0 L30,60 L25,70 L20,60 Z" />
      <path d="M40,0 L50,0 L50,60 L45,70 L40,60 Z" />
      
      <!-- 勺子 -->
      <path d="M70,0 C90,0 100,10 100,30 C100,50 90,60 70,60 L65,70 L60,60 L60,0 Z" />
    </g>
    
    <!-- 蒸汽 -->
    <g fill="#fff" opacity="0.8">
      <path d="M85,40 Q90,30 95,40 T105,40 T115,40" stroke="#fff" fill="none" stroke-width="3" />
      <path d="M80,30 Q85,20 90,30 T100,30 T110,30" stroke="#fff" fill="none" stroke-width="2" />
    </g>
  </svg>
</template>

<script>
export default {
  name: 'Logo'
}
</script>

<style scoped>
.logo-svg {
  width: 32px;
  height: 32px;
}

@media (prefers-reduced-motion: no-preference) {
  .logo-svg g:last-child {
    animation: steam 2s ease-in-out infinite;
    transform-origin: center;
  }
}

@keyframes steam {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.8;
  }
  50% {
    transform: translateY(-5px);
    opacity: 0.5;
  }
}
</style> 