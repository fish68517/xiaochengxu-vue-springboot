import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getBills, getDashboard, getFeeItems, getNotices, parseImport, commitImport } from './api';
const active = ref('dashboard');
const loading = ref(false);
const dashboard = ref({});
const bills = ref([]);
const feeItems = ref([]);
const notices = ref([]);
const billStatus = ref('');
const importPreview = ref(null);
const committing = ref(false);
const menu = [
    ['dashboard', '▦', '工作台'], ['repairs', '🛠', '报修管理'], ['maintenance', '▣', '维保档案'],
    ['renovation', '▤', '装修管理'], ['notices', '📣', '公告管理'], ['company', '▥', '企业介绍'],
    ['billing', '¥', '缴费服务管理'], ['accounts', '♙', '账号与权限'], ['settings', '⚙', '系统设置'],
];
const titles = {
    dashboard: '工作台 / 数据概览', repairs: '报修工单管理', maintenance: '维保档案管理', renovation: '装修登记管理',
    notices: '公告发布管理', company: '企业介绍管理', billing: '缴费服务管理', accounts: '账号与权限', settings: '系统设置',
};
const filteredBills = computed(() => billStatus.value ? bills.value.filter(item => item.status === billStatus.value) : bills.value);
const money = (value) => `¥ ${value}`;
const statusText = (status) => ({ PENDING: '待缴', OVERDUE: '欠费', PAID: '已缴', CLOSED: '关闭' }[status] || status);
const statusType = (status) => ({ PENDING: 'warning', OVERDUE: 'danger', PAID: 'success', CLOSED: 'info' }[status] || 'info');
async function load() {
    loading.value = true;
    try {
        const [summary, billData, fees, noticeData] = await Promise.all([getDashboard(), getBills(), getFeeItems(), getNotices()]);
        dashboard.value = summary;
        bills.value = billData;
        feeItems.value = fees;
        notices.value = noticeData;
    }
    catch (error) {
        ElMessage.error('本地 API 连接失败，请确认后端已启动');
    }
    finally {
        loading.value = false;
    }
}
async function handleFile(upload) {
    if (!upload.raw)
        return;
    try {
        importPreview.value = await parseImport(upload.raw);
        ElMessage.success('解析完成，请检查预览结果');
    }
    catch (error) {
        ElMessage.error(error?.response?.data?.detail || '文件解析失败');
    }
}
async function handleCommit() {
    if (!importPreview.value)
        return;
    committing.value = true;
    try {
        const result = await commitImport(importPreview.value.batchId);
        ElMessage.success(`导入完成：生成 ${result.createdBills} 张账单`);
        importPreview.value = null;
        await load();
    }
    finally {
        committing.value = false;
    }
}
onMounted(load);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shell" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading), }, null, null);
/** @type {__VLS_StyleScopedClasses['shell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "sidebar" },
});
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "brand" },
});
/** @type {__VLS_StyleScopedClasses['brand']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "brand-mark" },
});
/** @type {__VLS_StyleScopedClasses['brand-mark']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({});
for (const [item] of __VLS_vFor((__VLS_ctx.menu))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                return (__VLS_ctx.active = item[0]);
                // @ts-ignore
                [vLoading, loading, menu, active,];
            } },
        key: (item[0]),
        ...{ class: ({ active: __VLS_ctx.active === item[0] }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "nav-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['nav-icon']} */ ;
    (item[1]);
    (item[2]);
    if (item[0] === 'billing') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    }
    // @ts-ignore
    [active,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "environment" },
});
/** @type {__VLS_StyleScopedClasses['environment']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
(__VLS_ctx.titles[__VLS_ctx.active]);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "admin" },
});
/** @type {__VLS_StyleScopedClasses['admin']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
if (__VLS_ctx.active === 'dashboard') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "page" },
    });
    /** @type {__VLS_StyleScopedClasses['page']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stats" },
    });
    /** @type {__VLS_StyleScopedClasses['stats']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "blue" },
    });
    /** @type {__VLS_StyleScopedClasses['blue']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.dashboard.pendingRepairs || 0);
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "orange" },
    });
    /** @type {__VLS_StyleScopedClasses['orange']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.dashboard.arrearsHouseholds || 0);
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "green" },
    });
    /** @type {__VLS_StyleScopedClasses['green']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.money(__VLS_ctx.dashboard.paid || '0.00'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "purple" },
    });
    /** @type {__VLS_StyleScopedClasses['purple']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.dashboard.maintenanceCount || 0);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid-two" },
    });
    /** @type {__VLS_StyleScopedClasses['grid-two']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "panel-title" },
    });
    /** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.active === 'dashboard'))
                    throw 0;
                return (__VLS_ctx.active = 'billing');
                // @ts-ignore
                [active, active, active, titles, dashboard, dashboard, dashboard, dashboard, money,];
            } },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "chart-placeholder" },
    });
    /** @type {__VLS_StyleScopedClasses['chart-placeholder']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ring" },
    });
    /** @type {__VLS_StyleScopedClasses['ring']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.money(__VLS_ctx.dashboard.receivable || '0.00'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "panel-title" },
    });
    /** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.active === 'dashboard'))
                    throw 0;
                return (__VLS_ctx.active = 'notices');
                // @ts-ignore
                [active, dashboard, money,];
            } },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "notice-list" },
    });
    /** @type {__VLS_StyleScopedClasses['notice-list']} */ ;
    for (const [notice] of __VLS_vFor((__VLS_ctx.notices.slice(0, 4)))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (notice.id),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (notice.category);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (notice.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        (notice.publishedAt.slice(0, 10));
        // @ts-ignore
        [notices,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "panel-title" },
    });
    /** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.load) },
    });
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table'] | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table']} */
    elTable;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        data: (__VLS_ctx.bills.slice(0, 5)),
    }));
    const __VLS_2 = __VLS_1({
        data: (__VLS_ctx.bills.slice(0, 5)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    const { default: __VLS_5 } = __VLS_3.slots;
    let __VLS_6;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        prop: "billNo",
        label: "账单号",
        width: "185",
    }));
    const __VLS_8 = __VLS_7({
        prop: "billNo",
        label: "账单号",
        width: "185",
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    let __VLS_11;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
        prop: "houseDisplayName",
        label: "房屋",
    }));
    const __VLS_13 = __VLS_12({
        prop: "houseDisplayName",
        label: "房屋",
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    let __VLS_16;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent1(__VLS_16, new __VLS_16({
        prop: "title",
        label: "账单名称",
    }));
    const __VLS_18 = __VLS_17({
        prop: "title",
        label: "账单名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    let __VLS_21;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
        prop: "totalAmount",
        label: "应缴金额",
    }));
    const __VLS_23 = __VLS_22({
        prop: "totalAmount",
        label: "应缴金额",
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    const { default: __VLS_26 } = __VLS_24.slots;
    {
        const { default: __VLS_27 } = __VLS_24.slots;
        const [scope] = __VLS_vSlot(__VLS_27);
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
            ...{ class: "amount" },
        });
        /** @type {__VLS_StyleScopedClasses['amount']} */ ;
        (scope.row.totalAmount);
        // @ts-ignore
        [load, bills,];
    }
    // @ts-ignore
    [];
    var __VLS_24;
    let __VLS_28;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({
        label: "状态",
    }));
    const __VLS_30 = __VLS_29({
        label: "状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    const { default: __VLS_33 } = __VLS_31.slots;
    {
        const { default: __VLS_34 } = __VLS_31.slots;
        const [scope] = __VLS_vSlot(__VLS_34);
        let __VLS_35;
        /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
        elTag;
        // @ts-ignore
        const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
            type: (__VLS_ctx.statusType(scope.row.status)),
        }));
        const __VLS_37 = __VLS_36({
            type: (__VLS_ctx.statusType(scope.row.status)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_36));
        const { default: __VLS_40 } = __VLS_38.slots;
        (__VLS_ctx.statusText(scope.row.status));
        // @ts-ignore
        [statusType, statusText,];
        var __VLS_38;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_31;
    // @ts-ignore
    [];
    var __VLS_3;
}
else if (__VLS_ctx.active === 'billing') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "page" },
    });
    /** @type {__VLS_StyleScopedClasses['page']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "billing-summary" },
    });
    /** @type {__VLS_StyleScopedClasses['billing-summary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.money(__VLS_ctx.dashboard.receivable || '0.00'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.money(__VLS_ctx.dashboard.paid || '0.00'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
        ...{ class: "danger" },
    });
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
    (__VLS_ctx.dashboard.arrearsHouseholds || 0);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.feeItems.length);
    let __VLS_41;
    /** @ts-ignore @type { | typeof __VLS_components.elTabs | typeof __VLS_components.ElTabs | typeof __VLS_components['el-tabs'] | typeof __VLS_components.elTabs | typeof __VLS_components.ElTabs | typeof __VLS_components['el-tabs']} */
    elTabs;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
        type: "border-card",
        ...{ class: "billing-tabs" },
    }));
    const __VLS_43 = __VLS_42({
        type: "border-card",
        ...{ class: "billing-tabs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    /** @type {__VLS_StyleScopedClasses['billing-tabs']} */ ;
    const { default: __VLS_46 } = __VLS_44.slots;
    let __VLS_47;
    /** @ts-ignore @type { | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane'] | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane']} */
    elTabPane;
    // @ts-ignore
    const __VLS_48 = __VLS_asFunctionalComponent1(__VLS_47, new __VLS_47({
        label: "账单台账",
    }));
    const __VLS_49 = __VLS_48({
        label: "账单台账",
    }, ...__VLS_functionalComponentArgsRest(__VLS_48));
    const { default: __VLS_52 } = __VLS_50.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "toolbar" },
    });
    /** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
    let __VLS_53;
    /** @ts-ignore @type { | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select'] | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select']} */
    elSelect;
    // @ts-ignore
    const __VLS_54 = __VLS_asFunctionalComponent1(__VLS_53, new __VLS_53({
        modelValue: (__VLS_ctx.billStatus),
        placeholder: "全部状态",
        clearable: true,
        ...{ style: {} },
    }));
    const __VLS_55 = __VLS_54({
        modelValue: (__VLS_ctx.billStatus),
        placeholder: "全部状态",
        clearable: true,
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_54));
    const { default: __VLS_58 } = __VLS_56.slots;
    let __VLS_59;
    /** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
    elOption;
    // @ts-ignore
    const __VLS_60 = __VLS_asFunctionalComponent1(__VLS_59, new __VLS_59({
        label: "待缴",
        value: "PENDING",
    }));
    const __VLS_61 = __VLS_60({
        label: "待缴",
        value: "PENDING",
    }, ...__VLS_functionalComponentArgsRest(__VLS_60));
    let __VLS_64;
    /** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
    elOption;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent1(__VLS_64, new __VLS_64({
        label: "欠费",
        value: "OVERDUE",
    }));
    const __VLS_66 = __VLS_65({
        label: "欠费",
        value: "OVERDUE",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    let __VLS_69;
    /** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
    elOption;
    // @ts-ignore
    const __VLS_70 = __VLS_asFunctionalComponent1(__VLS_69, new __VLS_69({
        label: "已缴",
        value: "PAID",
    }));
    const __VLS_71 = __VLS_70({
        label: "已缴",
        value: "PAID",
    }, ...__VLS_functionalComponentArgsRest(__VLS_70));
    // @ts-ignore
    [active, dashboard, dashboard, dashboard, money, money, feeItems, billStatus,];
    var __VLS_56;
    let __VLS_74;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_75 = __VLS_asFunctionalComponent1(__VLS_74, new __VLS_74({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_76 = __VLS_75({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_75));
    let __VLS_79;
    const __VLS_80 = {
        /** @type {typeof __VLS_79.click} */
        onClick: (__VLS_ctx.load),
    };
    const { default: __VLS_81 } = __VLS_77.slots;
    // @ts-ignore
    [load,];
    var __VLS_77;
    var __VLS_78;
    let __VLS_82;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent1(__VLS_82, new __VLS_82({}));
    const __VLS_84 = __VLS_83({}, ...__VLS_functionalComponentArgsRest(__VLS_83));
    const { default: __VLS_87 } = __VLS_85.slots;
    // @ts-ignore
    [];
    var __VLS_85;
    let __VLS_88;
    /** @ts-ignore @type { | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table'] | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table']} */
    elTable;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent1(__VLS_88, new __VLS_88({
        data: (__VLS_ctx.filteredBills),
        stripe: true,
    }));
    const __VLS_90 = __VLS_89({
        data: (__VLS_ctx.filteredBills),
        stripe: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    const { default: __VLS_93 } = __VLS_91.slots;
    let __VLS_94;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_95 = __VLS_asFunctionalComponent1(__VLS_94, new __VLS_94({
        prop: "billNo",
        label: "账单号",
        width: "190",
    }));
    const __VLS_96 = __VLS_95({
        prop: "billNo",
        label: "账单号",
        width: "190",
    }, ...__VLS_functionalComponentArgsRest(__VLS_95));
    let __VLS_99;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_100 = __VLS_asFunctionalComponent1(__VLS_99, new __VLS_99({
        prop: "houseDisplayName",
        label: "房屋",
        width: "190",
    }));
    const __VLS_101 = __VLS_100({
        prop: "houseDisplayName",
        label: "房屋",
        width: "190",
    }, ...__VLS_functionalComponentArgsRest(__VLS_100));
    let __VLS_104;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent1(__VLS_104, new __VLS_104({
        prop: "title",
        label: "账单名称",
        minWidth: "210",
    }));
    const __VLS_106 = __VLS_105({
        prop: "title",
        label: "账单名称",
        minWidth: "210",
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    let __VLS_109;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_110 = __VLS_asFunctionalComponent1(__VLS_109, new __VLS_109({
        prop: "billingPeriod",
        label: "周期",
        width: "100",
    }));
    const __VLS_111 = __VLS_110({
        prop: "billingPeriod",
        label: "周期",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_110));
    let __VLS_114;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_115 = __VLS_asFunctionalComponent1(__VLS_114, new __VLS_114({
        label: "应缴金额",
        width: "110",
    }));
    const __VLS_116 = __VLS_115({
        label: "应缴金额",
        width: "110",
    }, ...__VLS_functionalComponentArgsRest(__VLS_115));
    const { default: __VLS_119 } = __VLS_117.slots;
    {
        const { default: __VLS_120 } = __VLS_117.slots;
        const [scope] = __VLS_vSlot(__VLS_120);
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
            ...{ class: "amount" },
        });
        /** @type {__VLS_StyleScopedClasses['amount']} */ ;
        (scope.row.totalAmount);
        // @ts-ignore
        [filteredBills,];
    }
    // @ts-ignore
    [];
    var __VLS_117;
    let __VLS_121;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_122 = __VLS_asFunctionalComponent1(__VLS_121, new __VLS_121({
        prop: "dueDate",
        label: "截止日期",
        width: "120",
    }));
    const __VLS_123 = __VLS_122({
        prop: "dueDate",
        label: "截止日期",
        width: "120",
    }, ...__VLS_functionalComponentArgsRest(__VLS_122));
    let __VLS_126;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_127 = __VLS_asFunctionalComponent1(__VLS_126, new __VLS_126({
        label: "状态",
        width: "90",
    }));
    const __VLS_128 = __VLS_127({
        label: "状态",
        width: "90",
    }, ...__VLS_functionalComponentArgsRest(__VLS_127));
    const { default: __VLS_131 } = __VLS_129.slots;
    {
        const { default: __VLS_132 } = __VLS_129.slots;
        const [scope] = __VLS_vSlot(__VLS_132);
        let __VLS_133;
        /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
        elTag;
        // @ts-ignore
        const __VLS_134 = __VLS_asFunctionalComponent1(__VLS_133, new __VLS_133({
            type: (__VLS_ctx.statusType(scope.row.status)),
        }));
        const __VLS_135 = __VLS_134({
            type: (__VLS_ctx.statusType(scope.row.status)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_134));
        const { default: __VLS_138 } = __VLS_136.slots;
        (__VLS_ctx.statusText(scope.row.status));
        // @ts-ignore
        [statusType, statusText,];
        var __VLS_136;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_129;
    let __VLS_139;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_140 = __VLS_asFunctionalComponent1(__VLS_139, new __VLS_139({
        label: "操作",
        width: "150",
    }));
    const __VLS_141 = __VLS_140({
        label: "操作",
        width: "150",
    }, ...__VLS_functionalComponentArgsRest(__VLS_140));
    const { default: __VLS_144 } = __VLS_142.slots;
    {
        const { default: __VLS_145 } = __VLS_142.slots;
        let __VLS_146;
        /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
        elButton;
        // @ts-ignore
        const __VLS_147 = __VLS_asFunctionalComponent1(__VLS_146, new __VLS_146({
            link: true,
            type: "primary",
        }));
        const __VLS_148 = __VLS_147({
            link: true,
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_147));
        const { default: __VLS_151 } = __VLS_149.slots;
        // @ts-ignore
        [];
        var __VLS_149;
        let __VLS_152;
        /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
        elButton;
        // @ts-ignore
        const __VLS_153 = __VLS_asFunctionalComponent1(__VLS_152, new __VLS_152({
            link: true,
        }));
        const __VLS_154 = __VLS_153({
            link: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_153));
        const { default: __VLS_157 } = __VLS_155.slots;
        // @ts-ignore
        [];
        var __VLS_155;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_142;
    // @ts-ignore
    [];
    var __VLS_91;
    // @ts-ignore
    [];
    var __VLS_50;
    let __VLS_158;
    /** @ts-ignore @type { | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane'] | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane']} */
    elTabPane;
    // @ts-ignore
    const __VLS_159 = __VLS_asFunctionalComponent1(__VLS_158, new __VLS_158({
        label: "收费项目配置",
    }));
    const __VLS_160 = __VLS_159({
        label: "收费项目配置",
    }, ...__VLS_functionalComponentArgsRest(__VLS_159));
    const { default: __VLS_163 } = __VLS_161.slots;
    let __VLS_164;
    /** @ts-ignore @type { | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table'] | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table']} */
    elTable;
    // @ts-ignore
    const __VLS_165 = __VLS_asFunctionalComponent1(__VLS_164, new __VLS_164({
        data: (__VLS_ctx.feeItems),
    }));
    const __VLS_166 = __VLS_165({
        data: (__VLS_ctx.feeItems),
    }, ...__VLS_functionalComponentArgsRest(__VLS_165));
    const { default: __VLS_169 } = __VLS_167.slots;
    let __VLS_170;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_171 = __VLS_asFunctionalComponent1(__VLS_170, new __VLS_170({
        prop: "code",
        label: "项目编码",
    }));
    const __VLS_172 = __VLS_171({
        prop: "code",
        label: "项目编码",
    }, ...__VLS_functionalComponentArgsRest(__VLS_171));
    let __VLS_175;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_176 = __VLS_asFunctionalComponent1(__VLS_175, new __VLS_175({
        prop: "name",
        label: "项目名称",
    }));
    const __VLS_177 = __VLS_176({
        prop: "name",
        label: "项目名称",
    }, ...__VLS_functionalComponentArgsRest(__VLS_176));
    let __VLS_180;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_181 = __VLS_asFunctionalComponent1(__VLS_180, new __VLS_180({
        prop: "defaultAmount",
        label: "默认金额（辅助）",
    }));
    const __VLS_182 = __VLS_181({
        prop: "defaultAmount",
        label: "默认金额（辅助）",
    }, ...__VLS_functionalComponentArgsRest(__VLS_181));
    const { default: __VLS_185 } = __VLS_183.slots;
    {
        const { default: __VLS_186 } = __VLS_183.slots;
        const [scope] = __VLS_vSlot(__VLS_186);
        (scope.row.defaultAmount);
        // @ts-ignore
        [feeItems,];
    }
    // @ts-ignore
    [];
    var __VLS_183;
    let __VLS_187;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_188 = __VLS_asFunctionalComponent1(__VLS_187, new __VLS_187({
        prop: "sortOrder",
        label: "排序",
    }));
    const __VLS_189 = __VLS_188({
        prop: "sortOrder",
        label: "排序",
    }, ...__VLS_functionalComponentArgsRest(__VLS_188));
    let __VLS_192;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_193 = __VLS_asFunctionalComponent1(__VLS_192, new __VLS_192({
        label: "状态",
    }));
    const __VLS_194 = __VLS_193({
        label: "状态",
    }, ...__VLS_functionalComponentArgsRest(__VLS_193));
    const { default: __VLS_197 } = __VLS_195.slots;
    {
        const { default: __VLS_198 } = __VLS_195.slots;
        const [scope] = __VLS_vSlot(__VLS_198);
        let __VLS_199;
        /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
        elTag;
        // @ts-ignore
        const __VLS_200 = __VLS_asFunctionalComponent1(__VLS_199, new __VLS_199({
            type: (scope.row.enabled ? 'success' : 'info'),
        }));
        const __VLS_201 = __VLS_200({
            type: (scope.row.enabled ? 'success' : 'info'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_200));
        const { default: __VLS_204 } = __VLS_202.slots;
        (scope.row.enabled ? '启用' : '停用');
        // @ts-ignore
        [];
        var __VLS_202;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_195;
    let __VLS_205;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_206 = __VLS_asFunctionalComponent1(__VLS_205, new __VLS_205({
        label: "操作",
    }));
    const __VLS_207 = __VLS_206({
        label: "操作",
    }, ...__VLS_functionalComponentArgsRest(__VLS_206));
    const { default: __VLS_210 } = __VLS_208.slots;
    {
        const { default: __VLS_211 } = __VLS_208.slots;
        let __VLS_212;
        /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
        elButton;
        // @ts-ignore
        const __VLS_213 = __VLS_asFunctionalComponent1(__VLS_212, new __VLS_212({
            link: true,
            type: "primary",
        }));
        const __VLS_214 = __VLS_213({
            link: true,
            type: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_213));
        const { default: __VLS_217 } = __VLS_215.slots;
        // @ts-ignore
        [];
        var __VLS_215;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_208;
    // @ts-ignore
    [];
    var __VLS_167;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "table-tip" },
    });
    /** @type {__VLS_StyleScopedClasses['table-tip']} */ ;
    // @ts-ignore
    [];
    var __VLS_161;
    let __VLS_218;
    /** @ts-ignore @type { | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane'] | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane']} */
    elTabPane;
    // @ts-ignore
    const __VLS_219 = __VLS_asFunctionalComponent1(__VLS_218, new __VLS_218({
        label: "按户收费标准",
    }));
    const __VLS_220 = __VLS_219({
        label: "按户收费标准",
    }, ...__VLS_functionalComponentArgsRest(__VLS_219));
    const { default: __VLS_223 } = __VLS_221.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-business" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-business']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    let __VLS_224;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_225 = __VLS_asFunctionalComponent1(__VLS_224, new __VLS_224({
        type: "primary",
    }));
    const __VLS_226 = __VLS_225({
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_225));
    const { default: __VLS_229 } = __VLS_227.slots;
    // @ts-ignore
    [];
    var __VLS_227;
    // @ts-ignore
    [];
    var __VLS_221;
    let __VLS_230;
    /** @ts-ignore @type { | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane'] | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane']} */
    elTabPane;
    // @ts-ignore
    const __VLS_231 = __VLS_asFunctionalComponent1(__VLS_230, new __VLS_230({
        label: "批量上传账单",
    }));
    const __VLS_232 = __VLS_231({
        label: "批量上传账单",
    }, ...__VLS_functionalComponentArgsRest(__VLS_231));
    const { default: __VLS_235 } = __VLS_233.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "import-layout" },
    });
    /** @type {__VLS_StyleScopedClasses['import-layout']} */ ;
    let __VLS_236;
    /** @ts-ignore @type { | typeof __VLS_components.elUpload | typeof __VLS_components.ElUpload | typeof __VLS_components['el-upload'] | typeof __VLS_components.elUpload | typeof __VLS_components.ElUpload | typeof __VLS_components['el-upload']} */
    elUpload;
    // @ts-ignore
    const __VLS_237 = __VLS_asFunctionalComponent1(__VLS_236, new __VLS_236({
        drag: true,
        autoUpload: (false),
        showFileList: (false),
        accept: ".csv,.xlsx",
        onChange: (__VLS_ctx.handleFile),
    }));
    const __VLS_238 = __VLS_237({
        drag: true,
        autoUpload: (false),
        showFileList: (false),
        accept: ".csv,.xlsx",
        onChange: (__VLS_ctx.handleFile),
    }, ...__VLS_functionalComponentArgsRest(__VLS_237));
    const { default: __VLS_241 } = __VLS_239.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "upload-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['upload-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    // @ts-ignore
    [handleFile,];
    var __VLS_239;
    if (__VLS_ctx.importPreview) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "preview" },
        });
        /** @type {__VLS_StyleScopedClasses['preview']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "preview-head" },
        });
        /** @type {__VLS_StyleScopedClasses['preview-head']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ok" },
        });
        /** @type {__VLS_StyleScopedClasses['ok']} */ ;
        (__VLS_ctx.importPreview.validCount);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "bad" },
        });
        /** @type {__VLS_StyleScopedClasses['bad']} */ ;
        (__VLS_ctx.importPreview.invalidCount);
        let __VLS_242;
        /** @ts-ignore @type { | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table'] | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table']} */
        elTable;
        // @ts-ignore
        const __VLS_243 = __VLS_asFunctionalComponent1(__VLS_242, new __VLS_242({
            data: (__VLS_ctx.importPreview.rows),
            maxHeight: "360",
        }));
        const __VLS_244 = __VLS_243({
            data: (__VLS_ctx.importPreview.rows),
            maxHeight: "360",
        }, ...__VLS_functionalComponentArgsRest(__VLS_243));
        const { default: __VLS_247 } = __VLS_245.slots;
        let __VLS_248;
        /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
        elTableColumn;
        // @ts-ignore
        const __VLS_249 = __VLS_asFunctionalComponent1(__VLS_248, new __VLS_248({
            prop: "rowNo",
            label: "行",
            width: "60",
        }));
        const __VLS_250 = __VLS_249({
            prop: "rowNo",
            label: "行",
            width: "60",
        }, ...__VLS_functionalComponentArgsRest(__VLS_249));
        let __VLS_253;
        /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
        elTableColumn;
        // @ts-ignore
        const __VLS_254 = __VLS_asFunctionalComponent1(__VLS_253, new __VLS_253({
            prop: "roomNo",
            label: "房号",
        }));
        const __VLS_255 = __VLS_254({
            prop: "roomNo",
            label: "房号",
        }, ...__VLS_functionalComponentArgsRest(__VLS_254));
        let __VLS_258;
        /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
        elTableColumn;
        // @ts-ignore
        const __VLS_259 = __VLS_asFunctionalComponent1(__VLS_258, new __VLS_258({
            prop: "feeItemName",
            label: "费用项目",
        }));
        const __VLS_260 = __VLS_259({
            prop: "feeItemName",
            label: "费用项目",
        }, ...__VLS_functionalComponentArgsRest(__VLS_259));
        let __VLS_263;
        /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
        elTableColumn;
        // @ts-ignore
        const __VLS_264 = __VLS_asFunctionalComponent1(__VLS_263, new __VLS_263({
            prop: "amountYuan",
            label: "金额",
        }));
        const __VLS_265 = __VLS_264({
            prop: "amountYuan",
            label: "金额",
        }, ...__VLS_functionalComponentArgsRest(__VLS_264));
        let __VLS_268;
        /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
        elTableColumn;
        // @ts-ignore
        const __VLS_269 = __VLS_asFunctionalComponent1(__VLS_268, new __VLS_268({
            label: "校验",
        }));
        const __VLS_270 = __VLS_269({
            label: "校验",
        }, ...__VLS_functionalComponentArgsRest(__VLS_269));
        const { default: __VLS_273 } = __VLS_271.slots;
        {
            const { default: __VLS_274 } = __VLS_271.slots;
            const [scope] = __VLS_vSlot(__VLS_274);
            let __VLS_275;
            /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
            elTag;
            // @ts-ignore
            const __VLS_276 = __VLS_asFunctionalComponent1(__VLS_275, new __VLS_275({
                type: (scope.row.valid ? 'success' : 'danger'),
            }));
            const __VLS_277 = __VLS_276({
                type: (scope.row.valid ? 'success' : 'danger'),
            }, ...__VLS_functionalComponentArgsRest(__VLS_276));
            const { default: __VLS_280 } = __VLS_278.slots;
            (scope.row.valid ? '通过' : scope.row.errors.join('；'));
            // @ts-ignore
            [importPreview, importPreview, importPreview, importPreview,];
            var __VLS_278;
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
        var __VLS_271;
        // @ts-ignore
        [];
        var __VLS_245;
        let __VLS_281;
        /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
        elButton;
        // @ts-ignore
        const __VLS_282 = __VLS_asFunctionalComponent1(__VLS_281, new __VLS_281({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.committing),
            disabled: (!__VLS_ctx.importPreview.validCount),
        }));
        const __VLS_283 = __VLS_282({
            ...{ 'onClick': {} },
            type: "primary",
            loading: (__VLS_ctx.committing),
            disabled: (!__VLS_ctx.importPreview.validCount),
        }, ...__VLS_functionalComponentArgsRest(__VLS_282));
        let __VLS_286;
        const __VLS_287 = {
            /** @type {typeof __VLS_286.click} */
            onClick: (__VLS_ctx.handleCommit),
        };
        const { default: __VLS_288 } = __VLS_284.slots;
        // @ts-ignore
        [importPreview, committing, handleCommit,];
        var __VLS_284;
        var __VLS_285;
    }
    // @ts-ignore
    [];
    var __VLS_233;
    let __VLS_289;
    /** @ts-ignore @type { | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane'] | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane']} */
    elTabPane;
    // @ts-ignore
    const __VLS_290 = __VLS_asFunctionalComponent1(__VLS_289, new __VLS_289({
        label: "欠费预警 / 催缴",
    }));
    const __VLS_291 = __VLS_290({
        label: "欠费预警 / 催缴",
    }, ...__VLS_functionalComponentArgsRest(__VLS_290));
    const { default: __VLS_294 } = __VLS_292.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-business warning" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-business']} */ ;
    /** @type {__VLS_StyleScopedClasses['warning']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (__VLS_ctx.dashboard.arrearsHouseholds || 0);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    let __VLS_295;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_296 = __VLS_asFunctionalComponent1(__VLS_295, new __VLS_295({
        type: "danger",
    }));
    const __VLS_297 = __VLS_296({
        type: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_296));
    const { default: __VLS_300 } = __VLS_298.slots;
    // @ts-ignore
    [dashboard,];
    var __VLS_298;
    // @ts-ignore
    [];
    var __VLS_292;
    let __VLS_301;
    /** @ts-ignore @type { | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane'] | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane']} */
    elTabPane;
    // @ts-ignore
    const __VLS_302 = __VLS_asFunctionalComponent1(__VLS_301, new __VLS_301({
        label: "缴费记录 / 对账",
    }));
    const __VLS_303 = __VLS_302({
        label: "缴费记录 / 对账",
    }, ...__VLS_functionalComponentArgsRest(__VLS_302));
    const { default: __VLS_306 } = __VLS_304.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-business" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-business']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    // @ts-ignore
    [];
    var __VLS_304;
    let __VLS_307;
    /** @ts-ignore @type { | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane'] | typeof __VLS_components.elTabPane | typeof __VLS_components.ElTabPane | typeof __VLS_components['el-tab-pane']} */
    elTabPane;
    // @ts-ignore
    const __VLS_308 = __VLS_asFunctionalComponent1(__VLS_307, new __VLS_307({
        label: "收据申请管理",
    }));
    const __VLS_309 = __VLS_308({
        label: "收据申请管理",
    }, ...__VLS_functionalComponentArgsRest(__VLS_308));
    const { default: __VLS_312 } = __VLS_310.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty-business" },
    });
    /** @type {__VLS_StyleScopedClasses['empty-business']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    // @ts-ignore
    [];
    var __VLS_310;
    // @ts-ignore
    [];
    var __VLS_44;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "page" },
    });
    /** @type {__VLS_StyleScopedClasses['page']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "module-intro" },
    });
    /** @type {__VLS_StyleScopedClasses['module-intro']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.menu.find(item => item[0] === __VLS_ctx.active)?.[1]);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    (__VLS_ctx.titles[__VLS_ctx.active]);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "panel-title" },
    });
    /** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    let __VLS_313;
    /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
    elTag;
    // @ts-ignore
    const __VLS_314 = __VLS_asFunctionalComponent1(__VLS_313, new __VLS_313({
        type: "success",
    }));
    const __VLS_315 = __VLS_314({
        type: "success",
    }, ...__VLS_functionalComponentArgsRest(__VLS_314));
    const { default: __VLS_318 } = __VLS_316.slots;
    // @ts-ignore
    [menu, active, active, titles,];
    var __VLS_316;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "feature-cards" },
    });
    /** @type {__VLS_StyleScopedClasses['feature-cards']} */ ;
    for (const [name] of __VLS_vFor((['列表查询与筛选', '角色权限隔离', '状态流转记录', 'Mock 消息通知']))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
            key: (name),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
