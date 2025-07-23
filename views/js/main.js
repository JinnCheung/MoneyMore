// MoneyMore 主入口文件

// 初始化起始年份选项
async function initStartYearOptions() {
    if (currentStock) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/stock_basic`);
            const data = await response.json();
            
            if (data.success && data.data) {
                const stockInfo = data.data.find(stock => stock.ts_code === currentStock);
                if (stockInfo && stockInfo.list_date) {
                    updateStartYearOptions(stockInfo.list_date);
                }
            }
        } catch (error) {
            console.error('获取股票基础信息失败:', error);
        }
    }
}

// 页面初始化
async function initPage() {
    // 初始化API URL
    initApiUrl();
    
    // 初始化控件
    initControls();
    
    // 加载并恢复应用状态
    const savedState = loadAppState();
    
    // 先加载股票列表，确保股票名称可以正确显示
    await loadStockList();
    
    // 为当前股票初始化起始年份选项
    await initStartYearOptions();
    
    // 恢复UI状态（现在stockList已经加载完成，起始年份选项也已生成）
    restoreUIState(savedState);
    
    // 初始化主题切换
    initThemeToggle();
    
    // 初始化图表
    initChart();
    
    // 开始时间显示更新
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);
    
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