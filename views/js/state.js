// MoneyMore 状态管理模块

// 全局变量
let chart = null;
let currentStock = CONFIG.DEFAULT_STOCK;
let stockList = [];
let selectedStockIndex = -1;
let earningsData = null;
let dividendData = null; // 存储分红数据
let finaIndicatorData = null; // 存储财务指标数据
let disclosureDateData = null; // 存储披露日期数据
let tradingCalendar = null;
let showEarnings = false;
let showDividendYield = false; // 控制股息率曲线显示
let showTradingSignals = false; // 控制四进三出买卖点显示
let currentStockInfo = null; // 存储当前股票的基础信息
let rawStockDataNoAdj = []; // 存储不复权数据，用于计算股息率
let rawStockData = [];
let dividendYieldData = []; // 存储股息率曲线数据

// 状态持久化函数
function saveAppState() {
    const state = {
        currentStock: currentStock,
        showEarnings: showEarnings,
        showDividendYield: showDividendYield,
        showTradingSignals: showTradingSignals,
        periodSelect: document.getElementById('periodSelect').value,
        adjSelect: document.getElementById('adjSelect').value,
        startYearSelect: document.getElementById('startYearSelect').value
    };
    localStorage.setItem('moneyMoreAppState', JSON.stringify(state));
}

// 加载应用状态
function loadAppState() {
    try {
        const savedState = localStorage.getItem('moneyMoreAppState');
        if (savedState) {
            const state = JSON.parse(savedState);
            
            // 恢复股票选择
            if (state.currentStock) {
                currentStock = state.currentStock;
            }
            
            // 恢复显示选项
            if (typeof state.showEarnings === 'boolean') {
                showEarnings = state.showEarnings;
            }
            if (typeof state.showDividendYield === 'boolean') {
                showDividendYield = state.showDividendYield;
            }
            if (typeof state.showTradingSignals === 'boolean') {
                showTradingSignals = state.showTradingSignals;
            }
            
            return state;
        }
    } catch (error) {
        console.warn('加载应用状态失败:', error);
    }
    return null;
}

// 恢复UI状态
function restoreUIState(state) {
    if (!state) return;
    
    // 恢复下拉选择
    if (state.periodSelect) {
        const periodSelect = document.getElementById('periodSelect');
        if (periodSelect) {
            periodSelect.value = state.periodSelect;
        }
    }
    
    if (state.adjSelect) {
        const adjSelect = document.getElementById('adjSelect');
        if (adjSelect) {
            adjSelect.value = state.adjSelect;
        }
    }
    
    if (state.startYearSelect) {
        const startYearSelect = document.getElementById('startYearSelect');
        if (startYearSelect) {
            startYearSelect.value = state.startYearSelect;
        }
    }
    
    // 恢复复选框状态
    const earningsCheckbox = document.getElementById('showEarnings');
    if (earningsCheckbox) {
        earningsCheckbox.checked = showEarnings;
    }
    
    const dividendYieldCheckbox = document.getElementById('showDividendYield');
    if (dividendYieldCheckbox) {
        dividendYieldCheckbox.checked = showDividendYield;
    }
    
    const tradingSignalsCheckbox = document.getElementById('tradingSignalsToggle');
    if (tradingSignalsCheckbox) {
        tradingSignalsCheckbox.checked = showTradingSignals;
    }
    
    // 恢复股票搜索框
    const stockInput = document.getElementById('stockInput');
    if (stockInput && currentStockInfo) {
        stockInput.value = `${currentStockInfo.name} (${currentStockInfo.ts_code})`;
    }
}

// 获取股票名称
function getStockName(tsCode) {
    return stockList.find(stock => stock.ts_code === tsCode)?.name || tsCode;
}

// 导出变量和函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // 变量
        chart, currentStock, stockList, selectedStockIndex,
        earningsData, dividendData, finaIndicatorData, disclosureDateData,
        tradingCalendar, showEarnings, showDividendYield, showTradingSignals, currentStockInfo,
        rawStockDataNoAdj, rawStockData, dividendYieldData,
        // 函数
        saveAppState, loadAppState, restoreUIState, getStockName
    };
}