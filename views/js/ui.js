// MoneyMore UI控制和交互模块

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
        // 显示默认的热门股票列表
        if (stockList && stockList.length > 0) {
            const defaultStocks = stockList.slice(0, 10).map(stock => ({
                code: stock.ts_code,
                name: stock.name,
                industry: stock.industry,
                area: stock.area
            }));
            showStockOptions(defaultStocks);
        } else {
            // 如果stockList还没加载，尝试搜索一些热门股票
            const stocks = await searchStocks('00');
            showStockOptions(stocks.slice(0, 10));
        }
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
    document.getElementById('startYearSelect').addEventListener('change', () => {
        saveAppState();
        loadKlineData();
    });
    document.getElementById('periodSelect').addEventListener('change', () => {
        saveAppState();
        loadKlineData();
    });
    document.getElementById('adjSelect').addEventListener('change', () => {
        saveAppState();
        loadKlineData();
    });
    
    // 财报标记开关
    const earningsToggle = document.getElementById('earningsToggle');
    earningsToggle.addEventListener('change', (e) => {
        showEarnings = e.target.checked;
        saveAppState();

        if (showEarnings && (!earningsData || earningsData.length === 0)) {
            loadKlineData();
        } else if (chart) {
            // 重新渲染图表以应用开关状态
            loadKlineData();
        }
    });
    
    // 股息率曲线开关
    const dividendYieldToggle = document.getElementById('dividendYieldToggle');
    dividendYieldToggle.addEventListener('change', (e) => {
        showDividendYield = e.target.checked;
        saveAppState();
        
        if (chart) {
            // 重新渲染图表以应用开关状态
            loadKlineData();
        }
    });
    
    // 四进三出买卖点开关
    const tradingSignalsToggle = document.getElementById('tradingSignalsToggle');
    tradingSignalsToggle.addEventListener('change', (e) => {
        showTradingSignals = e.target.checked;
        saveAppState();
        
        if (chart) {
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
async function updateTimeDisplay(stockCode = null) {
    try {
        console.log('⏰ 正在获取缓存时间信息...');
        
        let url = `${CONFIG.API_BASE_URL}/cache_info`;
        
        // 如果提供了股票代码，则查询该股票的缓存信息
        if (stockCode) {
            const params = new URLSearchParams({ ts_code: stockCode });
            
            // 添加其他相关参数
            const period = document.getElementById('periodSelect').value || '1Y';
            const startYear = document.getElementById('startYearSelect').value || 'auto';
            const adj = document.getElementById('adjSelect').value;
            const freq = 'D'; // pro_bar固定使用日频数据
            
            // 计算日期范围（使用与loadKlineData相同的逻辑）
            const { startDate, endDate } = calculateDateRange(period, startYear);
            const startDateStr = formatDate(startDate);
            const endDateStr = formatDate(endDate);
            
            if (startDateStr) params.append('start_date', startDateStr);
            if (endDateStr) params.append('end_date', endDateStr);
            if (adj && adj !== 'None') params.append('adj', adj);
            if (freq) params.append('freq', freq);
            
            url += '?' + params.toString();
            console.log('⏰ 查询股票缓存信息:', stockCode);
        } else {
            console.log('⏰ 查询股票基础信息缓存');
        }
        
        const response = await fetch(url);
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                console.log('⏰ 缓存时间获取成功:', result.data.cache_time, '类型:', result.data.cache_type);
                document.getElementById('updateTime').textContent = result.data.cache_time;
            } else {
                console.warn('⏰ 缓存时间API返回失败:', result);
                document.getElementById('updateTime').textContent = '获取失败';
            }
        } else {
            console.warn('⏰ 缓存时间API请求失败:', response.status, response.statusText);
            document.getElementById('updateTime').textContent = '获取失败';
        }
    } catch (error) {
        console.warn('⏰ 获取缓存时间失败:', error);
        document.getElementById('updateTime').textContent = '获取失败';
    }
}

// 更新起始年份选择器
function updateStartYearOptions(listDate) {
    const startYearSelect = document.getElementById('startYearSelect');
    const currentYear = new Date().getFullYear();
    
    // 保存当前选中的值
    const currentValue = startYearSelect.value;
    
    // 临时移除事件监听器，防止在更新选项时触发change事件
    const changeHandler = startYearSelect.onchange;
    startYearSelect.onchange = null;
    
    // 清空现有选项
    startYearSelect.innerHTML = '<option value="auto">自动</option>';
    
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
    
    // 恢复之前选中的值，如果该值仍然存在的话
    if (currentValue && [...startYearSelect.options].some(option => option.value === currentValue)) {
        startYearSelect.value = currentValue;
    } else {
        startYearSelect.value = 'auto';
    }
    
    // 恢复事件监听器
    startYearSelect.onchange = changeHandler;
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
    
    // 保存状态
    saveAppState();
    
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
            } else if (options.length === 1) {
                // 如果搜索结果只有一个，直接选择它
                selectStock(options[0]);
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

// 初始化图表
function initChart() {
    const chartDom = document.getElementById('chart');
    chart = echarts.init(chartDom);
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        if (chart) {
            chart.resize();
        }
    });
}

// 显示加载状态
function showLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'flex';
    }
    
    if (chart) {
        chart.showLoading('default', {
            text: '加载中...',
            color: '#4f46e5',
            textColor: '#000',
            maskColor: 'rgba(255, 255, 255, 0.8)'
        });
    }
}

// 隐藏加载状态
function hideLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    if (chart) {
        chart.hideLoading();
    }
}

// 显示错误信息
function showError(message) {
    hideLoading();
    
    const errorElement = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorElement && errorMessage) {
        errorMessage.textContent = message;
        errorElement.style.display = 'block';
        
        // 5秒后自动隐藏错误信息
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
}

// 显示统计信息
function showStats(stockInfo) {
    if (!stockInfo) return;
    
    const statsElement = document.getElementById('stats');
    if (statsElement) {
        statsElement.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">股票名称:</span>
                <span class="stat-value">${stockInfo.name}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">股票代码:</span>
                <span class="stat-value">${stockInfo.ts_code}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">所属行业:</span>
                <span class="stat-value">${stockInfo.industry || '未知'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">上市日期:</span>
                <span class="stat-value">${stockInfo.list_date ? stockInfo.list_date.toString().replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '未知'}</span>
            </div>
        `;
    }
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initControls, initThemeToggle, toggleTheme, updateChartTheme,
        updateTimeDisplay, updateStartYearOptions, handleStockSearch,
        showStockOptions, showStockDropdown, hideStockDropdown,
        selectStock, handleKeyNavigation, updateSelection,
        initChart, showLoading, hideLoading, showError, showStats
    };
}