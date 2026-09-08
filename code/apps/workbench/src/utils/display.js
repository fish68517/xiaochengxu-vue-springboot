const GAME_LABELS={lol:'英雄联盟',wangzhe:'王者荣耀',honor:'王者荣耀',delta:'三角洲行动',valorant:'无畏契约',pubg:'绝地求生'};
const SERVICE_LABELS={companion:'陪玩服务',boosting:'进阶服务',training:'教学指导',team:'组队协作'};
const STATUS_LABELS={PENDING_PAYMENT:'待支付',PENDING_ACCEPT:'待受理',PENDING_GRAB:'待抢单',ASSIGN_PENDING:'指派待确认',IN_SERVICE:'服务中',PENDING_CONFIRM:'待确认',SETTLED:'已结单',DISPUTING:'异议中',CANCELLED:'已取消',REFUNDING:'退款中',REFUNDED:'已退款',CLOSED:'已关闭'};
export function gameText(value){const key=String(value||'').trim();return GAME_LABELS[key.toLowerCase()]||key||'综合服务';}
export function serviceTypeText(value){const key=String(value||'').trim();return SERVICE_LABELS[key.toLowerCase()]||key||'品质服务';}
export function statusText(value){return STATUS_LABELS[value]||value||'未知状态';}
export function formatDateTime(value){if(value===null||value===undefined||value==='')return '待确认';const parsed=/^\d{10,13}$/.test(String(value))?Number(value):value;const date=new Date(parsed);if(Number.isNaN(date.getTime()))return '待确认';const pad=(number)=>String(number).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;}
export function maskPhone(value){return String(value||'').replace(/^(1\d{2})\d{4}(\d{4})$/,'$1****$2');}
export function maskName(value){const text=String(value||'');if(!text)return '未填写';return text.length===1?'*':`${text.slice(0,1)}${'*'.repeat(Math.min(3,text.length-1))}`;}
export function maskWechat(value){const text=String(value||'');if(!text)return '未填写';if(text.includes('*'))return text;return text.length<=4?`${text.slice(0,1)}***`:`${text.slice(0,2)}***${text.slice(-2)}`;}
export function transactionTypeText(value){return {COMMISSION:'服务佣金',REFUND_CLAWBACK:'退款追佣',WITHDRAW_FREEZE:'提现冻结',WITHDRAW_PAID:'提现完成',WITHDRAW_REJECT:'提现退回',ADJUST_ADD:'人工调增',ADJUST_SUB:'人工调减',WALLET_FREEZE:'钱包冻结',WALLET_UNFREEZE:'解除冻结'}[value]||value||'钱包变动';}
export function orderActionText(value){return {create:'创建订单',pay:'支付完成',enter:'客服录入',grab:'接单成功',assign:'客服指派',reassign:'订单改派',release:'接单人员退单',submitCompletion:'提交完成凭证',verifyCompletion:'客服核对通过',rejectCompletion:'退回重做',closeOrder:'确认结单',requestRefund:'发起退款',resolveDispute:'提交仲裁'}[value]||value||'订单更新';}
export function assignmentTypeText(value){return {CLAIM:'主动接单',ASSIGN:'客服指派',REASSIGN:'订单改派',RELEASE:'接单人员退单',REJECT:'拒绝指派',ACCEPT:'接受指派'}[value]||value||'指派更新';}
