// MoneyMore K线图 JavaScript

// 配置
const CONFIG = {
    API_BASE_URL: getApiBaseUrl(),
    DEFAULT_STOCK: '600900.SH',  // 默认股票：长江电力
    CHART_HEIGHT: 500
};

// 动态获取API基础URL，自动适应当前端口
function getApiBaseUrl() {
    // 使用当前页面的协议、主机和端口
    const { protocol, hostname, port } = window.location;
    const baseUrl = `${protocol}//${hostname}${port ? ':' + port : ''}`;
    return `${baseUrl}/api/v1`;
}

// 全局变量
let chart = null;
let currentStock = CONFIG.DEFAULT_STOCK;
let stockList = [];
let selectedStockIndex = -1;

// 初始化页面
async function initPage() {
    // 初始化图表
    initChart();
    
    // 初始化控件
    initControls();
    
    // 初始化主题切换
    initThemeToggle();
    
    // 先加载股票列表，确保股票名称可以正确显示
    await loadStockList();
    
    // 加载默认数据
    loadKlineData();
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
    
    // 时间跨度和复权方式改变时自动更新
    document.getElementById('periodSelect').addEventListener('change', loadKlineData);
    document.getElementById('adjSelect').addEventListener('change', loadKlineData);
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
        const { protocol, hostname, port } = window.location;
        const baseUrl = `${protocol}//${hostname}${port ? ':' + port : ''}`;
        const response = await fetch(`${baseUrl}/api/search_stocks?q=${encodeURIComponent(query)}&limit=20`);
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
    const chartContainer = document.getElementById('klineChart');
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
        
        // 计算日期范围
        const { startDate, endDate } = calculateDateRange(period);
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);
        
        console.log(`获取股票数据: ${currentStock}, ${startDateStr} 至 ${endDateStr}, 复权: ${adj || '不复权'}`);
        
        // 构建API请求URL
        let url = `${CONFIG.API_BASE_URL}/stock_data?ts_code=${currentStock}&start_date=${startDateStr}&end_date=${endDateStr}`;
        if (adj) {
            url += `&adj=${adj}`;
        }
        
        // 发起API请求
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '获取数据失败');
        }
        
        if (!data.data || data.data.length === 0) {
            throw new Error('未获取到有效的股票数据');
        }
        
        // 格式化数据并渲染图表
        const { dates, klineData, stockInfo } = formatStockData(data.data);
        renderChart(dates, klineData, stockInfo);
        
        // 显示统计信息
        showStats(stockInfo);
        
        // 更新时间显示
        updateTimeDisplay();
        
        console.log(`✅ 成功加载 ${data.data.length} 条数据`);
        
    } catch (error) {
        console.error('加载K线数据失败:', error);
        showError('加载数据失败: ' + error.message);
    }
}

// 计算日期范围
function calculateDateRange(period) {
    const endDate = new Date();
    const startDate = new Date();
    
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

// 渲染图表
function renderChart(dates, klineData, stockInfo) {
    hideLoading();
    
    // 更新页面主标题为当前股票名称
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = stockInfo.name;
    }
    
    const isDark = document.body.classList.contains('dark-mode');
    
    const option = {
        backgroundColor: isDark ? '#2d2d2d' : '#fff',
        // 移除图表标题，不在图表上方显示股票名称
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
                
                return [
                    `<strong>${data.name}</strong>`,
                    `开盘: ${values[0].toFixed(2)}`,
                    `收盘: ${values[1].toFixed(2)}`,
                    `最低: ${values[2].toFixed(2)}`,
                    `最高: ${values[3].toFixed(2)}`,
                    `涨跌: ${change.toFixed(2)}`,
                    `涨跌幅: ${changePercent}%`
                ].join('<br/>');
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
                type: 'inside',
                start: 70,
                end: 100
            },
            {
                show: true,
                type: 'slider',
                top: '90%',
                start: 70,
                end: 100,
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
                }
            }
        ]
    };
    
    // 设置图表配置
    chart.setOption(option, true);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 MoneyMore K线图初始化...');
    initPage();
});