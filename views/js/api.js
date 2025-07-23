// MoneyMore API 管理模块

// 初始化API URL
async function initApiUrl() {
    let apiUrl = getApiBaseUrl();
    
    if (!apiUrl) {
        console.log('🔍 当前页面不在API端口范围内，开始检测可用端口...');
        try {
            apiUrl = await detectApiPort();
        } catch (error) {
            console.error('❌ API端口检测失败:', error.message);
            showError('无法连接到API服务，请确保后端服务已启动');
            return false;
        }
    }
    
    CONFIG.API_BASE_URL = apiUrl;
    console.log('📡 API服务地址:', apiUrl);
    return true;
}

// 动态获取API基础URL，自动检测5000-5010端口
function getApiBaseUrl() {
    // 如果当前页面已经在5000-5010端口范围内，直接使用
    const { protocol, hostname, port } = window.location;
    const currentPort = parseInt(port) || 80;
    
    if (currentPort >= 5000 && currentPort <= 5010) {
        const baseUrl = `${protocol}//${hostname}:${currentPort}`;
        return `${baseUrl}/api/v1`;
    }
    
    // 否则返回null，需要通过detectApiPort()检测
    return null;
}

// 检测可用的API端口
async function detectApiPort() {
    const { protocol, hostname } = window.location;
    
    // 检测常用端口：8000, 5000-5010
    const portsToCheck = [8000, ...Array.from({length: 11}, (_, i) => 5000 + i)];
    
    for (let port of portsToCheck) {
        try {
            const testUrl = `${protocol}//${hostname}:${port}/api/v1/stock_basic`;
            const response = await fetch(testUrl, {
                method: 'GET',
                timeout: 2000
            });
            
            if (response.ok) {
                console.log(`✅ 检测到API服务运行在端口 ${port}`);
                return `${protocol}//${hostname}:${port}/api/v1`;
            }
        } catch (error) {
            // 端口不可用，继续检测下一个
            continue;
        }
    }
    
    throw new Error('无法在常用端口范围内找到可用的API服务');
}

// 搜索股票
async function searchStocks(query) {
    if (!query || query.length < 1) {
        return [];
    }
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/stock_basic?search=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`搜索请求失败: HTTP ${response.status}`);
        }
        const result = await response.json();
        if (result.success && result.data) {
            return result.data.slice(0, 10); // 限制返回10个结果
        }
        return [];
    } catch (error) {
        console.error('搜索股票失败:', error);
        return [];
    }
}

// 加载股票列表
async function loadStockList() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/stock_basic`);
        if (!response.ok) {
            throw new Error(`请求失败: HTTP ${response.status}`);
        }
        const result = await response.json();
        if (result.success && result.data) {
            stockList = result.data;
            console.log(`✅ 加载了 ${stockList.length} 只股票`);
        }
    } catch (error) {
        console.error('加载股票列表失败:', error);
    }
}

// 加载交易日历
async function loadTradingCalendar() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/trading_calendar`);
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                tradingCalendar = result.data;
                console.log(`✅ 加载了 ${tradingCalendar.length} 条交易日历数据`);
            }
        }
    } catch (error) {
        console.warn('加载交易日历失败:', error);
    }
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initApiUrl,
        getApiBaseUrl,
        detectApiPort,
        searchStocks,
        loadStockList,
        loadTradingCalendar
    };
}