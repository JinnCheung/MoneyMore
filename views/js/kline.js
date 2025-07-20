// MoneyMore K线图 JavaScript

// 配置
const CONFIG = {
    STOCK_CODE: '600900.SH',  // 长江电力
    STOCK_NAME: '长江电力',
    API_BASE_URL: '/api/v1',
    CHART_HEIGHT: 600
};

// 全局变量
let chart = null;

// 初始化页面
function initPage() {
    // 更新时间显示
    updateTimeDisplay();
    
    // 初始化图表
    initChart();
    
    // 加载数据
    loadKlineData();
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

// 初始化ECharts图表
function initChart() {
    const chartContainer = document.getElementById('klineChart');
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
        // 计算日期范围（最近3个月）
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 3);
        
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);
        
        console.log(`获取股票数据: ${startDateStr} 至 ${endDateStr}`);
        
        // 构建API请求URL
        const url = `${CONFIG.API_BASE_URL}/stock_data?ts_code=${CONFIG.STOCK_CODE}&start_date=${startDateStr}&end_date=${endDateStr}`;
        
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
        const { dates, klineData } = formatStockData(data.data);
        renderChart(dates, klineData);
        
        // 更新时间显示
        updateTimeDisplay();
        
        console.log(`✅ 成功加载 ${data.data.length} 条数据`);
        
    } catch (error) {
        console.error('加载K线数据失败:', error);
        showError('加载数据失败: ' + error.message);
    }
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
    
    stockData.forEach(item => {
        // 格式化日期显示
        const dateStr = item.trade_date.toString();
        const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
        dates.push(formattedDate);
        
        // K线数据格式: [开盘, 收盘, 最低, 最高]
        klineData.push([
            parseFloat(item.open),
            parseFloat(item.close),
            parseFloat(item.low),
            parseFloat(item.high)
        ]);
    });
    
    return { dates, klineData };
}

// 渲染图表
function renderChart(dates, klineData) {
    hideLoading();
    
    const option = {
        title: {
            text: `${CONFIG.STOCK_NAME} K线图`,
            left: 'center',
            textStyle: {
                fontSize: 20,
                fontWeight: 'bold',
                color: '#2c3e50'
            }
        },
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
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#667eea',
            borderWidth: 1,
            textStyle: {
                color: '#2c3e50'
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
                    color: '#bdc3c7'
                }
            },
            splitLine: { 
                show: false 
            },
            axisLabel: {
                color: '#7f8c8d'
            }
        },
        yAxis: {
            scale: true,
            splitArea: {
                show: true,
                areaStyle: {
                    color: ['rgba(250,250,250,0.1)', 'rgba(200,200,200,0.1)']
                }
            },
            axisLine: {
                lineStyle: {
                    color: '#bdc3c7'
                }
            },
            axisLabel: {
                color: '#7f8c8d'
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
                    color: '#667eea'
                },
                textStyle: {
                    color: '#7f8c8d'
                }
            }
        ],
        series: [
            {
                name: CONFIG.STOCK_NAME,
                type: 'candlestick',
                data: klineData,
                itemStyle: {
                    color: '#ef4444',      // 上涨颜色（红色）
                    color0: '#22c55e',     // 下跌颜色（绿色）
                    borderColor: '#ef4444',
                    borderColor0: '#22c55e'
                },
                markPoint: {
                    label: {
                        formatter: function (param) {
                            return param != null ? Math.round(param.value) + '' : '';
                        }
                    },
                    data: [
                        {
                            name: '最高值',
                            type: 'max',
                            valueDim: 'highest',
                            symbol: 'pin',
                            symbolSize: 50,
                            itemStyle: {
                                color: '#ef4444'
                            }
                        },
                        {
                            name: '最低值',
                            type: 'min',
                            valueDim: 'lowest',
                            symbol: 'pin',
                            symbolSize: 50,
                            itemStyle: {
                                color: '#22c55e'
                            }
                        }
                    ],
                    tooltip: {
                        formatter: function (param) {
                            return param.name + '<br>' + (param.data.coord || '');
                        }
                    }
                }
            }
        ]
    };
    
    // 设置图表配置
    chart.setOption(option);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 MoneyMore K线图初始化...');
    initPage();
});