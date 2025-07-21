// MoneyMore K线图 JavaScript

// 配置
const CONFIG = {
    API_BASE_URL: null,  // 将在initPage中动态设置
    DEFAULT_STOCK: '600900.SH',  // 默认股票：长江电力
    CHART_HEIGHT: 500
};

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
    
    // 检测5000-5010端口范围
    for (let port = 5000; port <= 5010; port++) {
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
    
    throw new Error('无法在5000-5010端口范围内找到可用的API服务');
}

// 全局变量
let chart = null;
let currentStock = CONFIG.DEFAULT_STOCK;
let stockList = [];
let selectedStockIndex = -1;
let earningsData = null;
let tradingCalendar = null;
let showEarnings = false;
let currentStockInfo = null; // 存储当前股票的基础信息

// 初始化页面
async function initPage() {
    // 首先初始化API URL
    const apiReady = await initApiUrl();
    if (!apiReady) {
        console.error('❌ API初始化失败，无法继续');
        return;
    }
    
    // 初始化图表
    initChart();
    
    // 初始化控件
    initControls();
    
    // 初始化主题切换
    initThemeToggle();
    
    // 先加载股票列表，确保股票名称可以正确显示
    await loadStockList();
    
    // 为默认股票加载基础信息
    await loadDefaultStockInfo();
    
    // 加载默认数据
    loadKlineData();
}

// 加载默认股票基础信息
async function loadDefaultStockInfo() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/stock_basic`);
        const data = await response.json();
        
        if (data.success && data.data) {
            currentStockInfo = data.data.find(stock => stock.ts_code === CONFIG.DEFAULT_STOCK);
            if (currentStockInfo && currentStockInfo.list_date) {
                updateStartYearOptions(currentStockInfo.list_date);
            }
        }
    } catch (error) {
        console.error('获取默认股票基础信息失败:', error);
    }
}

// 初始化控件
function initControls() {
    // 股票搜索
    const stockSearch = document.getElementById('stockSearch');
    const stockDropdown = document.getElementById('stockDropdown');
    
    // 设置默认值
    stockSearch.value = `长江电力 (${CONFIG.DEFAULT_STOCK})`;
    
    stockSearch.addEventListener('input', handleStockSearch);
    
    // 获得焦点时清空内容并显示默认列表
    stockSearch.addEventListener('focus', async () => {
        stockSearch.value = ''; // 自动清空输入框内容
        const stocks = await searchStocks('');
        showStockOptions(stocks.slice(0, 10));
    });
    
    // 点击外部关闭下拉框
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.stock-search-container')) {
            hideStockDropdown();
        }
    });
    
    // 键盘导航
    stockSearch.addEventListener('keydown', handleKeyNavigation);
    
    // 时间跨度、复权方式和起始年份改变时自动更新
    document.getElementById('startYearSelect').addEventListener('change', loadKlineData);
    document.getElementById('periodSelect').addEventListener('change', loadKlineData);
    document.getElementById('adjSelect').addEventListener('change', loadKlineData);
    
    // 财报标记开关
    const earningsToggle = document.getElementById('earningsToggle');
    earningsToggle.addEventListener('change', (e) => {
        showEarnings = e.target.checked;

        if (showEarnings && (!earningsData || earningsData.length === 0)) {
            loadKlineData();
        } else if (chart) {
            // 重新渲染图表以应用开关状态
            loadKlineData();
        }
    });
}

// 初始化主题切换
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    
    // 检查本地存储的主题设置
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    
    themeToggle.addEventListener('click', toggleTheme);
}

// 切换主题
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // 重新渲染图表以应用主题
    if (chart) {
        updateChartTheme();
    }
}

// 更新图表主题
function updateChartTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    const option = chart.getOption();
    
    // 更新图表背景和文字颜色
    option.backgroundColor = isDark ? '#2d2d2d' : '#fff';
    
    chart.setOption(option, true);
}

// 更新时间显示
function updateTimeDisplay() {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('updateTime').textContent = timeStr;
}

// 搜索股票（支持股票代码、名称、拼音缩写）
async function searchStocks(query) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/search_stocks?q=${encodeURIComponent(query)}&limit=20`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        // 确保返回数组格式
        if (result && Array.isArray(result.data)) {
            return result.data;
        } else if (Array.isArray(result)) {
            return result;
        } else {
            console.warn('API返回格式异常:', result);
            return [];
        }
    } catch (error) {
        console.error('搜索股票失败:', error);
        return [];
    }
}

// 加载股票列表（备用数据）
async function loadStockList() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/stock_basic`);
        const data = await response.json();
        
        if (data.success && data.data) {
            stockList = data.data;
            console.log(`✅ 加载了 ${stockList.length} 只股票`);
        }
    } catch (error) {
        console.error('加载股票列表失败:', error);
        stockList = [
            { ts_code: '600900.SH', name: '长江电力', industry: '电力' },
            { ts_code: '000001.SZ', name: '平安银行', industry: '银行' },
            { ts_code: '000002.SZ', name: '万科A', industry: '房地产' }
        ];
    }
}

// 更新起始年份选择器
function updateStartYearOptions(listDate) {
    const startYearSelect = document.getElementById('startYearSelect');
    const currentYear = new Date().getFullYear();
    
    // 清空现有选项
    startYearSelect.innerHTML = '<option value="auto" selected>自动</option>';
    
    if (listDate) {
        // 解析上市日期 (格式: YYYYMMDD)
        const listYear = parseInt(listDate.toString().substring(0, 4));
        
        // 从上市年份到当前年份生成选项
        for (let year = listYear; year <= currentYear; year++) {
            const option = document.createElement('option');
            option.value = year.toString();
            option.textContent = `${year}年`;
            startYearSelect.appendChild(option);
        }
    }
}

// 处理股票搜索
function handleStockSearch(e) {
    const query = e.target.value.trim();
    
    // 清除之前的搜索定时器
    if (window.searchTimeout) {
        clearTimeout(window.searchTimeout);
    }
    
    // 延迟搜索，避免频繁请求
    window.searchTimeout = setTimeout(async () => {
        if (query.length > 0) {
            const stocks = await searchStocks(query);
            showStockOptions(stocks);
        } else {
            hideStockDropdown();
        }
    }, 300);
}

// 显示股票选项
function showStockOptions(stocks) {
    const dropdown = document.getElementById('stockDropdown');
    
    if (stocks.length === 0) {
        dropdown.innerHTML = '<div class="stock-option">未找到匹配的股票</div>';
    } else {
        dropdown.innerHTML = stocks.map((stock, index) => `
            <div class="stock-option" data-index="${index}" data-code="${stock.code}" data-name="${stock.name}">
                <span class="stock-option-code">${stock.code}</span>
                <span class="stock-option-name">${stock.name}</span>
                <span class="stock-option-info">${stock.industry || ''} ${stock.area || ''}</span>
            </div>
        `).join('');
        
        // 添加点击事件
        dropdown.querySelectorAll('.stock-option').forEach(option => {
            option.addEventListener('click', () => selectStock(option));
        });
    }
    
    showStockDropdown();
    selectedStockIndex = -1;
}

// 显示股票下拉框
function showStockDropdown() {
    document.getElementById('stockDropdown').style.display = 'block';
}

// 隐藏股票下拉框
function hideStockDropdown() {
    document.getElementById('stockDropdown').style.display = 'none';
    selectedStockIndex = -1;
}

// 选择股票
async function selectStock(option) {
    const code = option.dataset.code;
    const name = option.dataset.name;
    
    currentStock = code;
    document.getElementById('stockSearch').value = `${name} (${code})`;
    hideStockDropdown();
    
    console.log(`选择股票: ${code} ${name}`);
    
    // 获取股票基础信息
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/stock_basic`);
        const data = await response.json();
        
        if (data.success && data.data) {
            currentStockInfo = data.data.find(stock => stock.ts_code === code);
            if (currentStockInfo && currentStockInfo.list_date) {
                updateStartYearOptions(currentStockInfo.list_date);
            }
        }
    } catch (error) {
        console.error('获取股票基础信息失败:', error);
    }
    
    // 选择股票后直接加载K线数据
    await loadKlineData();
}

// 键盘导航
function handleKeyNavigation(e) {
    const dropdown = document.getElementById('stockDropdown');
    const options = dropdown.querySelectorAll('.stock-option');
    
    if (options.length === 0) return;
    
    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedStockIndex = Math.min(selectedStockIndex + 1, options.length - 1);
            updateSelection(options);
            break;
        case 'ArrowUp':
            e.preventDefault();
            selectedStockIndex = Math.max(selectedStockIndex - 1, 0);
            updateSelection(options);
            break;
        case 'Enter':
            e.preventDefault();
            if (selectedStockIndex >= 0) {
                selectStock(options[selectedStockIndex]);
            }
            break;
        case 'Escape':
            hideStockDropdown();
            break;
    }
}

// 更新选择状态
function updateSelection(options) {
    options.forEach((option, index) => {
        option.classList.toggle('selected', index === selectedStockIndex);
    });
}

// 初始化ECharts图表
function initChart() {
    const chartContainer = document.getElementById('chart');
    chart = echarts.init(chartContainer);
    
    // 显示加载状态
    showLoading();
    
    // 响应式调整
    window.addEventListener('resize', function() {
        if (chart) {
            chart.resize();
        }
    });
}

// 显示加载状态
function showLoading() {
    if (chart) {
        chart.showLoading('default', {
            text: '正在加载数据...',
            color: '#667eea',
            textColor: '#2c3e50',
            maskColor: 'rgba(255, 255, 255, 0.8)',
            zlevel: 0
        });
    }
}

// 隐藏加载状态
function hideLoading() {
    if (chart) {
        chart.hideLoading();
    }
}

// 显示错误信息
function showError(message) {
    hideLoading();
    const chartContainer = document.getElementById('chart');
    chartContainer.innerHTML = `
        <div class="error">
            <div>
                <span class="error-icon">⚠️</span>
                <p>${message}</p>
                <p style="font-size: 14px; color: #95a5a6; margin-top: 10px;">请检查API服务是否正常运行</p>
            </div>
        </div>
    `;
}

// 加载K线数据
async function loadKlineData() {
    try {
        showLoading();
        
        // 获取时间跨度
        const period = document.getElementById('periodSelect').value || '1Y';
        const adj = document.getElementById('adjSelect').value || '';
        
        // 获取起始年份
        const startYear = document.getElementById('startYearSelect').value || 'auto';
        
        // 计算日期范围
        const { startDate, endDate } = calculateDateRange(period, startYear);
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);
        
        console.log(`获取股票数据: ${currentStock}, ${startDateStr} 至 ${endDateStr}, 复权: ${adj || '不复权'}`);
        
        // 构建API请求URL
        let url = `${CONFIG.API_BASE_URL}/stock_data?ts_code=${currentStock}&start_date=${startDateStr}&end_date=${endDateStr}`;
        if (adj) {
            url += `&adj=${adj}`;
        }
        
        // 并行获取K线和财报数据
        const [stockResponse, earningsResponse] = await Promise.all([
            fetch(url),
            fetch(`${CONFIG.API_BASE_URL}/earnings?ts_code=${currentStock}`)
        ]);

        // 处理K线数据
        if (!stockResponse.ok) {
            throw new Error(`K线数据请求失败: HTTP ${stockResponse.status}`);
        }
        const stockResult = await stockResponse.json();
        if (!stockResult.success || !stockResult.data || stockResult.data.length === 0) {
            throw new Error(stockResult.message || '未获取到有效的股票数据');
        }

        // 处理财报数据
        if (earningsResponse.ok) {
            const earningsResult = await earningsResponse.json();
            if (earningsResult.success && earningsResult.data) {
                earningsData = earningsResult.data;
                console.log(`✅ 加载了 ${earningsData.length} 条财报数据`);
            } else {
                earningsData = []; // API成功但无数据
            }
        } else {
            console.warn('加载财报数据失败:', earningsResponse.statusText);
            earningsData = []; // API请求失败
        }

        // 格式化数据并渲染图表
        const { dates, klineData, stockInfo } = formatStockData(stockResult.data);
        window.currentChartData = { dates, klineData, stockInfo };

        showStats(stockInfo);
        updateTimeDisplay();
        renderChart(dates, klineData, stockInfo);

        // 根据起始年份和时间跨度动态设置dataZoom
        const selectedStartYear = document.getElementById('startYearSelect').value;
        const dataLength = dates.length;
        
        if (dataLength > 0) {
            let startPercent = 0;
            let endPercent = 100;
            
            if (selectedStartYear === 'auto') {
                // 自动模式：显示最后几年的数据
                const years = parseInt(period.replace('Y', ''));
                const daysPerYear = 252; // 估算每年交易日
                const daysToShow = years * daysPerYear;
                const startIndex = Math.max(0, dataLength - daysToShow);
                startPercent = (startIndex / dataLength) * 100;
                endPercent = 100; // 自动模式显示到最新数据
            } else {
                // 指定年份模式：根据起始年份和时间跨度计算显示范围
                const selectedYear = parseInt(selectedStartYear);
                const years = parseInt(period.replace('Y', ''));
                const endYear = selectedYear + years;
                const currentYear = new Date().getFullYear();
                
                // 计算起始日期在数据中的位置
                let targetStartDate;
                if (currentStockInfo && currentStockInfo.list_date) {
                    const listYear = parseInt(currentStockInfo.list_date.toString().substring(0, 4));
                    if (selectedYear === listYear) {
                        // 使用上市日期
                        const listDateStr = currentStockInfo.list_date.toString();
                        targetStartDate = `${listDateStr.substring(0, 4)}-${listDateStr.substring(4, 6)}-${listDateStr.substring(6, 8)}`;
                    } else {
                        targetStartDate = `${selectedYear}-01-01`;
                    }
                } else {
                    targetStartDate = `${selectedYear}-01-01`;
                }
                
                // 计算结束日期，但不能超过当前日期
                const currentDate = new Date().toISOString().split('T')[0];
                const calculatedEndDate = `${endYear}-12-31`;
                const targetEndDate = calculatedEndDate <= currentDate ? calculatedEndDate : currentDate;
                
                // 在dates数组中找到对应的索引
                let startIndex = dates.findIndex(date => date >= targetStartDate);
                let endIndex = dates.findIndex(date => date > targetEndDate);
                
                if (startIndex === -1) startIndex = 0;
                if (endIndex === -1) {
                    // 如果结束日期超出数据范围，使用数据的最后日期
                    endIndex = dates.length - 1;
                } else {
                    // 确保不超出数据范围
                    endIndex = Math.min(endIndex, dates.length - 1);
                }
                
                startPercent = (startIndex / dataLength) * 100;
                endPercent = (endIndex / dataLength) * 100;
                
                // 确保显示范围合理
                if (endPercent <= startPercent) {
                    endPercent = Math.min(100, startPercent + 20); // 至少显示20%的数据
                }
            }
            
            chart.dispatchAction({
                type: 'dataZoom',
                start: startPercent,
                end: endPercent
            });
        }
        
        console.log(`✅ 成功加载 ${stockResult.data.length} 条数据`);
        
    } catch (error) {
        console.error('加载K线数据失败:', error);
        showError('加载数据失败: ' + error.message);
    }
}

// 计算日期范围
function calculateDateRange(period, startYear) {
    let endDate = new Date();
    let startDate = new Date();
    
    if (startYear === 'auto' || !startYear) {
        // 自动模式：根据选择的时间跨度设置起始日期，结束日期为当前日期
        switch (period) {
            case '1Y':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
            case '2Y':
                startDate.setFullYear(endDate.getFullYear() - 2);
                break;
            case '3Y':
                startDate.setFullYear(endDate.getFullYear() - 3);
                break;
            case '4Y':
                startDate.setFullYear(endDate.getFullYear() - 4);
                break;
            case '5Y':
                startDate.setFullYear(endDate.getFullYear() - 5);
                break;
            case '6Y':
                startDate.setFullYear(endDate.getFullYear() - 6);
                break;
            case '7Y':
                startDate.setFullYear(endDate.getFullYear() - 7);
                break;
            case '8Y':
                startDate.setFullYear(endDate.getFullYear() - 8);
                break;
            case '9Y':
                startDate.setFullYear(endDate.getFullYear() - 9);
                break;
            case '10Y':
                startDate.setFullYear(endDate.getFullYear() - 10);
                break;
            default:
                startDate.setFullYear(endDate.getFullYear() - 1);
        }
    } else {
        // 指定年份模式：根据起始年份和时间跨度计算起始和结束日期
        const selectedYear = parseInt(startYear);
        const years = parseInt(period.replace('Y', ''));
        const calculatedEndYear = selectedYear + years - 1; // 修正：1年跨度应该是同一年，2年跨度是下一年
        const currentYear = new Date().getFullYear();
        
        // 如果选择的是上市年份且有上市日期信息，使用上市日期
        if (currentStockInfo && currentStockInfo.list_date) {
            const listYear = parseInt(currentStockInfo.list_date.toString().substring(0, 4));
            if (selectedYear === listYear) {
                // 使用上市日期作为起始日期
                const listDateStr = currentStockInfo.list_date.toString();
                startDate = new Date(
                    parseInt(listDateStr.substring(0, 4)),
                    parseInt(listDateStr.substring(4, 6)) - 1,
                    parseInt(listDateStr.substring(6, 8))
                );
            } else {
                // 使用选择年份的1月1日
                startDate = new Date(selectedYear, 0, 1);
            }
        } else {
            // 没有上市日期信息，使用选择年份的1月1日
            startDate = new Date(selectedYear, 0, 1);
        }
        
        // 计算结束日期：从起始日期开始计算满跨度时间
        const tempEndDate = new Date(startDate);
        tempEndDate.setFullYear(tempEndDate.getFullYear() + years);
        
        // 如果计算出的结束日期超过当前日期，使用当前日期，但确保至少有满跨度数据
        const currentDate = new Date();
        if (tempEndDate > currentDate) {
            // 检查从起始日期到当前日期是否已经满足选择的跨度
            const fullSpanFromStart = new Date(startDate);
            fullSpanFromStart.setFullYear(fullSpanFromStart.getFullYear() + years);
            
            if (fullSpanFromStart <= currentDate) {
                // 如果已经满足跨度要求，使用当前日期
                endDate = currentDate;
            } else {
                // 如果不足跨度要求，使用满跨度的日期
                endDate = fullSpanFromStart;
            }
        } else {
            endDate = tempEndDate;
        }
    }
    
    return { startDate, endDate };
}

// 格式化日期
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// 格式化股票数据
function formatStockData(stockData) {
    const dates = [];
    const klineData = [];
    
    // 按日期排序（从旧到新）
    stockData.sort((a, b) => a.trade_date - b.trade_date);
    
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    stockData.forEach(item => {
        // 格式化日期显示
        const dateStr = item.trade_date.toString();
        const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
        dates.push(formattedDate);
        
        // K线数据格式: [开盘, 收盘, 最低, 最高]
        const open = parseFloat(item.open);
        const close = parseFloat(item.close);
        const low = parseFloat(item.low);
        const high = parseFloat(item.high);
        
        klineData.push([open, close, low, high]);
        
        // 计算最高最低价
        minPrice = Math.min(minPrice, low);
        maxPrice = Math.max(maxPrice, high);
    });
    
    // 计算统计信息
    const firstData = stockData[0];
    const lastData = stockData[stockData.length - 1];
    const startPrice = parseFloat(firstData.open);
    const endPrice = parseFloat(lastData.close);
    const totalReturn = ((endPrice - startPrice) / startPrice * 100).toFixed(2);
    
    const stockInfo = {
        name: getStockName(currentStock),
        totalDays: stockData.length,
        startPrice: startPrice.toFixed(2),
        endPrice: endPrice.toFixed(2),
        totalReturn: totalReturn,
        maxPrice: maxPrice.toFixed(2),
        minPrice: minPrice.toFixed(2)
    };
    
    return { dates, klineData, stockInfo };
}

// 获取股票名称
function getStockName(tsCode) {
    const stock = stockList.find(s => s.ts_code === tsCode);
    return stock ? stock.name : tsCode;
}

// 显示统计信息
function showStats(stockInfo) {
    document.getElementById('stockName').textContent = stockInfo.name;
    document.getElementById('totalDays').textContent = stockInfo.totalDays;
    document.getElementById('startPrice').textContent = stockInfo.startPrice;
    document.getElementById('endPrice').textContent = stockInfo.endPrice;
    document.getElementById('totalReturn').textContent = stockInfo.totalReturn + '%';
    document.getElementById('maxPrice').textContent = stockInfo.maxPrice;
    document.getElementById('minPrice').textContent = stockInfo.minPrice;
    
    // 设置收益率颜色
    const returnElement = document.getElementById('totalReturn');
    const returnValue = parseFloat(stockInfo.totalReturn);
    if (returnValue > 0) {
        returnElement.style.color = '#ef4444';
    } else if (returnValue < 0) {
        returnElement.style.color = '#22c55e';
    } else {
        returnElement.style.color = '#666';
    }
    
    // 显示统计面板
    document.getElementById('stats').style.display = 'flex';
}





// 加载交易日历
 async function loadTradingCalendar() {
     try {
         const response = await fetch(`${CONFIG.API_BASE_URL}/api/v1/trading_calendar`);
         
         if (!response.ok) {
             console.warn('获取交易日历失败:', response.statusText);
             return;
         }
         
         const result = await response.json();
         
         if (result.success && result.data) {
             tradingCalendar = result.data;
             console.log(`✅ 加载了交易日历数据`);
         }
     } catch (error) {
         console.warn('加载交易日历失败:', error);
     }
 }



// 渲染带财报标记的图表
function renderChart(dates, klineData, stockInfo) {
    hideLoading();
    
    // 更新页面主标题为当前股票名称
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = stockInfo.name;
    }
    
    const isDark = document.body.classList.contains('dark-mode');
    
    // 处理财报标记数据
    const earningsMarks = [];
    const earningsLines = [];
    
    if (showEarnings && earningsData && earningsData.length > 0) {
        earningsData.forEach(earning => {
            const dateStr = earning.ann_date.toString();
            const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
            const dateIndex = dates.indexOf(formattedDate);
            
            if (dateIndex >= 0) {
                // 仅添加垂直虚线
                earningsLines.push({
                    name: formattedDate,
                    xAxis: formattedDate,
                    lineStyle: {
                        color: '#ff6b35',
                        type: 'dashed',
                        width: 1,
                        opacity: 0.6
                    },
                    label: {
                        show: true,
                        formatter: '{b}',
                        position: 'end',
                        color: isDark ? '#e0e0e0' : '#2c3e50',
                        fontSize: 12
                    },
                    symbol: 'none',
                    symbolSize: 0
                });
            }
        });
    }
    
    const option = {
        backgroundColor: isDark ? '#2d2d2d' : '#fff',
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            },
            formatter: function(params) {
                const data = params[0];
                const values = data.data;
                const change = values[1] - values[0];
                const changePercent = ((change / values[0]) * 100).toFixed(2);
                
                let tooltip = [
                    `<strong>${data.name}</strong>`,
                    `开盘: ${values[0].toFixed(2)}`,
                    `收盘: ${values[1].toFixed(2)}`,
                    `最低: ${values[2].toFixed(2)}`,
                    `最高: ${values[3].toFixed(2)}`,
                    `涨跌: ${change.toFixed(2)}`,
                    `涨跌幅: ${changePercent}%`
                ];
                
                // 检查是否有财报数据
                 if (showEarnings && earningsData) {
                     const earning = earningsData.find(e => {
                         const dateStr = e.ann_date.toString();
                         const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
                         return formattedDate === data.name;
                     });
                     
                     if (earning) {
                     tooltip.push('', '<strong style="color: #ff6b35;">📊 财报发布日</strong>');
                     if (earning.basic_eps) {
                         tooltip.push(`每股收益: ${earning.basic_eps}`);
                     }
                     if (earning.total_revenue) {
                         tooltip.push(`营业收入: ${(earning.total_revenue / 100000000).toFixed(2)}亿`);
                     }
                 }
                 }
                
                return tooltip.join('<br/>');
            },
            backgroundColor: isDark ? 'rgba(45, 45, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: '#3498db',
            borderWidth: 1,
            textStyle: {
                color: isDark ? '#e0e0e0' : '#2c3e50'
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: dates,
            scale: true,
            boundaryGap: false,
            axisLine: { 
                onZero: false,
                lineStyle: {
                    color: isDark ? '#555' : '#bdc3c7'
                }
            },
            splitLine: { 
                show: false 
            },
            axisLabel: {
                color: isDark ? '#b0b0b0' : '#7f8c8d'
            }
        },
        yAxis: {
            scale: true,
            splitArea: {
                show: true,
                areaStyle: {
                    color: isDark ? 
                        ['rgba(68,68,68,0.1)', 'rgba(85,85,85,0.1)'] : 
                        ['rgba(250,250,250,0.1)', 'rgba(200,200,200,0.1)']
                }
            },
            axisLine: {
                lineStyle: {
                    color: isDark ? '#555' : '#bdc3c7'
                }
            },
            axisLabel: {
                color: isDark ? '#b0b0b0' : '#7f8c8d'
            }
        },
        dataZoom: [
            {
                type: 'inside'
                // start and end are set dynamically in loadKlineData
            },
            {
                show: true,
                type: 'slider',
                top: '90%',
                // start and end are set dynamically in loadKlineData
                handleStyle: {
                    color: '#3498db'
                },
                textStyle: {
                    color: isDark ? '#b0b0b0' : '#7f8c8d'
                }
            }
        ],
        series: [
            {
                name: stockInfo.name,
                type: 'candlestick',
                data: klineData,
                itemStyle: {
                    color: '#ef4444',      // 上涨颜色（红色）
                    color0: '#22c55e',     // 下跌颜色（绿色）
                    borderColor: '#ef4444',
                    borderColor0: '#22c55e'
                },


                markLine: {
                    symbol: 'none',
                    show: showEarnings && earningsLines.length > 0, // 只有开关打开且有数据时才显示
                    data: earningsLines,
                    silent: true
                }
            }
        ]
    };
    
    // 设置图表配置
    chart.setOption(option, true);

    // 强制图表在下一个事件循环中重新计算尺寸，确保布局稳定
    setTimeout(() => {
        if (chart) {
            chart.resize();
        }
    }, 0);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 MoneyMore K线图初始化...');
    initPage();
});