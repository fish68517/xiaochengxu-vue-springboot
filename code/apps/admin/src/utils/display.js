const GAME_LABELS={lol:'英雄联盟',wangzhe:'王者荣耀',delta:'三角洲行动',valorant:'无畏契约'};
const SERVICE_LABELS={companion:'陪玩服务',team:'组队协作',training:'教学指导'};
const ROLE_LABELS={ADMIN:'平台管理员',SUPER_ADMIN:'超级管理员',BRAND_ADMIN:'品牌管理员',FINANCE_REVIEWER:'财务审核员',ARBITRATOR:'仲裁人员',CUSTOMER_SERVICE:'客服',WORKER:'接单人员'};
export const gameText=(value)=>GAME_LABELS[value]||value||'未分类';
export const serviceText=(value)=>SERVICE_LABELS[value]||value||'未分类';
export const roleText=(value)=>ROLE_LABELS[value]||value||'未知角色';
export function maskPhone(value){const phone=String(value||'');return /^1\d{10}$/.test(phone)?`${phone.slice(0,3)}****${phone.slice(-4)}`:phone||'—';}
export function formatDateTime(value){if(!value)return'—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('zh-CN',{hour12:false});}
export function copyText(value,label='内容'){if(!value)return;uni.setClipboardData({data:String(value),success:()=>uni.showToast({title:`${label}已复制`,icon:'success'})});}
