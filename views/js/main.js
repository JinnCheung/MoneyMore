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
    
    // 初始化时间显示
    updateTimeDisplay(currentStock);
    
    // 加载交易日历
    loadTradingCalendar();
    
    // 如果有当前股票，加载其数据
    if (currentStock) {
        loadKlineData(false); // 页面初始化时不强制刷新
    }
    
    // 添加强制刷新按钮事件监听器
    const refreshBtn = document.getElementById('refreshToggle');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            console.log('🔄 强制刷新按钮被点击');
            if (currentStock) {
                console.log(`🔄 开始强制刷新股票数据: ${currentStock}`);
                loadKlineData(true); // 强制刷新数据
            } else {
                console.warn('🔄 无法强制刷新：未选择股票');
            }
        });
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