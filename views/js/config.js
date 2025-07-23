// MoneyMore 配置文件

// 应用配置
const CONFIG = {
    API_BASE_URL: null,  // 将在initPage中动态设置
    DEFAULT_STOCK: '600900.SH',  // 默认股票：长江电力
    CHART_HEIGHT: 500
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG };
} else {
    window.CONFIG = CONFIG;
}