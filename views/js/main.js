// MoneyMore 主入口文件

// 页面初始化
function initPage() {
    // 初始化API URL
    initApiUrl();
    
    // 加载并恢复应用状态
    const savedState = loadAppState();
    
    // 恢复UI状态
    restoreUIState(savedState);
    
    // 初始化控件
    initControls();
    
    // 初始化主题切换
    initThemeToggle();
    
    // 初始化图表
    initChart();
    
    // 开始时间显示更新
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);
    
    // 加载股票列表
    loadStockList();
    
    // 加载交易日历
    loadTradingCalendar();
    
    // 如果有当前股票，加载其数据
    if (currentStock) {
        loadKlineData(currentStock);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPage);

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initPage
    };
}