<script>
export default {
  onLaunch() {},
  onShow() {},
  onHide() {}
}
</script>

<style lang="scss">
@import './uni.scss';

page {
  min-height: 100%;
  background: $page-bg;
  color: $text-primary;
  font-size: 28rpx;
}

view,
text,
button,
input,
image,
scroll-view,
swiper,
swiper-item {
  box-sizing: border-box;
}

button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 1;
}

button::after {
  border: 0;
}
</style>
