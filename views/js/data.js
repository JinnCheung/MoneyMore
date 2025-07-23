// MoneyMore 数据处理模块

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
        
        // 构建不复权数据请求URL（用于计算股息率）
        const noAdjUrl = `${CONFIG.API_BASE_URL}/stock_data?ts_code=${currentStock}&start_date=${startDateStr}&end_date=${endDateStr}`;
        
        // 并行获取K线、不复权K线、财报、分红、财务指标和披露日期数据
        const [stockResponse, noAdjStockResponse, earningsResponse, dividendResponse, finaIndicatorResponse, disclosureDateResponse] = await Promise.all([
            fetch(url),
            fetch(noAdjUrl),
            fetch(`${CONFIG.API_BASE_URL}/earnings?ts_code=${currentStock}`),
            fetch(`${CONFIG.API_BASE_URL}/dividend?ts_code=${currentStock}`),
            fetch(`${CONFIG.API_BASE_URL}/fina_indicator?ts_code=${currentStock}`),
            fetch(`${CONFIG.API_BASE_URL}/disclosure_date?ts_code=${currentStock}`)
        ]);

        // 处理K线数据
        if (!stockResponse.ok) {
            throw new Error(`K线数据请求失败: HTTP ${stockResponse.status}`);
        }
        const stockResult = await stockResponse.json();
        if (!stockResult.success || !stockResult.data || stockResult.data.length === 0) {
            throw new Error(stockResult.message || '未获取到有效的股票数据');
        }
        
        // 处理不复权K线数据（用于计算股息率）
        if (!noAdjStockResponse.ok) {
            console.warn('不复权数据请求失败:', noAdjStockResponse.statusText);
            rawStockDataNoAdj = []; // 如果获取失败，使用空数组
        } else {
            const noAdjStockResult = await noAdjStockResponse.json();
            if (noAdjStockResult.success && noAdjStockResult.data) {
                rawStockDataNoAdj = noAdjStockResult.data;
                console.log(`✅ 加载了 ${rawStockDataNoAdj.length} 条不复权数据用于股息率计算`);
            } else {
                rawStockDataNoAdj = [];
                console.warn('不复权数据为空');
            }
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

        // 处理分红数据
        if (dividendResponse.ok) {
            const dividendResult = await dividendResponse.json();
            if (dividendResult.success && dividendResult.data) {
                dividendData = dividendResult.data;
                console.log(`✅ 加载了 ${dividendData.length} 条分红数据`);
            } else {
                dividendData = []; // API成功但无数据
            }
        } else {
            console.warn('加载分红数据失败:', dividendResponse.statusText);
            dividendData = []; // API请求失败
        }

        // 处理财务指标数据
        if (finaIndicatorResponse.ok) {
            const finaIndicatorResult = await finaIndicatorResponse.json();
            if (finaIndicatorResult.success && finaIndicatorResult.data) {
                finaIndicatorData = finaIndicatorResult.data;
                console.log(`✅ 加载了 ${finaIndicatorData.length} 条财务指标数据`);
            } else {
                finaIndicatorData = []; // API成功但无数据
            }
        } else {
            console.warn('加载财务指标数据失败:', finaIndicatorResponse.statusText);
            finaIndicatorData = []; // API请求失败
        }

        // 处理披露日期数据
        if (disclosureDateResponse.ok) {
            const disclosureDateResult = await disclosureDateResponse.json();
            if (disclosureDateResult.success && disclosureDateResult.data) {
                disclosureDateData = disclosureDateResult.data;
                console.log(`✅ 加载了 ${disclosureDateData.length} 条披露日期数据`);
            } else {
                disclosureDateData = []; // API成功但无数据
            }
        } else {
            console.warn('加载披露日期数据失败:', disclosureDateResponse.statusText);
            disclosureDateData = []; // API请求失败
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
            case '7Y':
                startDate.setFullYear(endDate.getFullYear() - 7);
                break;
            case '10Y':
                startDate.setFullYear(endDate.getFullYear() - 10);
                break;
            case '20Y':
                startDate.setFullYear(endDate.getFullYear() - 20);
                break;
            case '30Y':
                startDate.setFullYear(endDate.getFullYear() - 30);
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

// 计算连续分红年数
function calculateConsecutiveDividendYears(currentYear, currentDate, earningsData, dividendData) {
    if (!dividendData || !earningsData || dividendData.length === 0 || earningsData.length === 0) {
        return 0;
    }
    
    let consecutiveYears = 0;
    let checkYear = currentYear;
    
    // 从当前年份开始向前检查连续分红情况
    while (true) {
        // 检查该年度是否有分红记录，只取状态为"实施"的记录
        const yearDividends = dividendData.filter(d => {
            if (!d.end_date) return false;
            const endDateStr = d.end_date.toString();
            const endYear = parseInt(endDateStr.slice(0, 4));
            return endYear === checkYear && d.div_proc === '实施';
        });
        
        // 计算该年度的累计分红（只计算实施状态的记录）
        const totalDividend = yearDividends.reduce((sum, d) => {
            return sum + (parseFloat(d.cash_div_tax) || 0);
        }, 0);
        
        // 如果该年度有分红（大于0），则连续年数+1
        if (totalDividend > 0) {
            consecutiveYears++;
            checkYear--; // 检查前一年
        } else {
            // 如果该年度没有分红，则中断连续性
            break;
        }
        
        // 防止无限循环，最多检查50年
        if (consecutiveYears >= 50) {
            break;
        }
    }
    
    return consecutiveYears;
}

// 计算股息率曲线数据
function calculateDividendYieldData(dates, stockData) {
    const yieldData = [];
    
    if (!dividendData || dividendData.length === 0 || !earningsData || earningsData.length === 0) {
        return dates.map(() => null);
    }
    
    // 预处理年报数据，按披露日期排序
    const sortedAnnualEarnings = earningsData
        .filter(e => {
            // 只筛选年报（end_date以1231结尾）
            const endDateStr = e.end_date ? e.end_date.toString() : '';
            return endDateStr.endsWith('1231');
        })
        .map(e => {
            const disclosureDate = new Date(e.display_date ? 
                `${e.display_date.toString().slice(0,4)}-${e.display_date.toString().slice(4,6)}-${e.display_date.toString().slice(6,8)}` :
                `${e.ann_date.toString().slice(0,4)}-${e.ann_date.toString().slice(4,6)}-${e.ann_date.toString().slice(6,8)}`);
            return {
                ...e,
                disclosureDate: disclosureDate,
                reportYear: parseInt(e.end_date.toString().slice(0, 4))
            };
        })
        .sort((a, b) => a.disclosureDate - b.disclosureDate); // 按时间正序排列
    
    dates.forEach((date, index) => {
        const currentData = stockData[index];
        if (!currentData) {
            yieldData.push(null);
            return;
        }
        
        // 使用不复权数据的收盘价计算股息率
        let close;
        if (rawStockDataNoAdj && rawStockDataNoAdj.length > 0) {
            // 根据交易日期查找对应的不复权数据
            const tradeDateStr = currentData.trade_date.toString();
            const noAdjData = rawStockDataNoAdj.find(d => d.trade_date.toString() === tradeDateStr);
            if (noAdjData) {
                close = parseFloat(noAdjData.close); // 使用不复权收盘价
            } else {
                close = parseFloat(currentData.close); // 如果找不到对应的不复权数据，回退到当前数据
            }
        } else {
            close = parseFloat(currentData.close); // 如果没有不复权数据，回退到当前数据
        }
        
        const currentDate = new Date(date);
        
        // 找到当前日期之前最近的年报披露日
        let latestAnnualEarning = null;
        for (let i = sortedAnnualEarnings.length - 1; i >= 0; i--) {
            if (sortedAnnualEarnings[i].disclosureDate <= currentDate) {
                latestAnnualEarning = sortedAnnualEarnings[i];
                break;
            }
        }
        
        if (latestAnnualEarning) {
            // 判断当前日期是否为年报披露日当日
            const isDisclosureDay = currentDate.toDateString() === latestAnnualEarning.disclosureDate.toDateString();
            
            // 如果是年报披露日当日，显示前一年分红；否则显示当年分红
            const dividendYear = isDisclosureDay ? latestAnnualEarning.reportYear - 1 : latestAnnualEarning.reportYear;
            
            // 查找该年度的所有分红记录，只取状态为"实施"的记录
            const yearDividends = dividendData.filter(d => {
                if (!d.end_date) return false;
                const endDateStr = d.end_date.toString();
                const endYear = parseInt(endDateStr.slice(0, 4));
                return endYear === dividendYear && d.div_proc === '实施';
            });
            
            if (yearDividends.length > 0) {
                // 计算累计分红（只计算实施状态的记录）
                const totalDividend = yearDividends.reduce((sum, d) => {
                    return sum + (parseFloat(d.cash_div_tax) || 0);
                }, 0);
                
                // 计算静态股息率（与tooltip保持一致，乘以100转换为百分比）
                if (close && close > 0 && !isNaN(close) && totalDividend > 0) {
                    const yieldRate = (totalDividend / close * 100);
                    yieldData.push(yieldRate);
                } else {
                    yieldData.push(null);
                }
            } else {
                yieldData.push(null);
            }
        } else {
            yieldData.push(null);
        }
    });
    
    return yieldData;
}

// 格式化股票数据
function formatStockData(stockData) {
    const dates = [];
    const klineData = [];
    
    // 按日期排序（从旧到新）
    stockData.sort((a, b) => a.trade_date - b.trade_date);
    
    // 存储原始数据供tooltip使用
    rawStockData = stockData;
    
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
    
    // 计算股息率曲线数据
    dividendYieldData = calculateDividendYieldData(dates, stockData);
    
    return { dates, klineData, stockInfo };
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
            } else {
                console.warn('交易日历数据为空');
                tradingCalendar = [];
            }
        } else {
            console.warn('加载交易日历失败:', response.statusText);
            tradingCalendar = [];
        }
    } catch (error) {
        console.error('加载交易日历失败:', error);
        tradingCalendar = [];
    }
}

// 计算四进三出买卖点
function calculateTradingSignals(dates, stockData) {
    const buySignals = [];
    const sellSignals = [];
    
    if (!dates || !stockData || !earningsData || !dividendData || !finaIndicatorData || !rawStockDataNoAdj) {
        return { buySignals, sellSignals };
    }
    
    let isHolding = false; // 当前是否持有股票
    let lastBuyIndex = -1; // 最后一次买入的索引
    
    for (let i = 0; i < dates.length; i++) {
        const currentDate = new Date(dates[i]);
        const tradeDateStr = dates[i].replace(/-/g, ''); // 转换为YYYYMMDD格式
        
        // 获取当前日期的不复权收盘价
        const noAdjData = rawStockDataNoAdj.find(d => d.trade_date.toString() === tradeDateStr);
        if (!noAdjData) continue;
        
        const currentPrice = parseFloat(noAdjData.close);
        if (!currentPrice || currentPrice <= 0) continue;
        
        // 找到当前日期之前最近的年报披露日（用于分红计算）
        const sortedAnnualEarnings = earningsData
            .filter(e => {
                const endDateStr = e.end_date ? e.end_date.toString() : '';
                if (!endDateStr.endsWith('1231')) return false;
                
                const disclosureDate = new Date(e.display_date ? 
                    `${e.display_date.toString().slice(0,4)}-${e.display_date.toString().slice(4,6)}-${e.display_date.toString().slice(6,8)}` :
                    `${e.ann_date.toString().slice(0,4)}-${e.ann_date.toString().slice(4,6)}-${e.ann_date.toString().slice(6,8)}`);
                return disclosureDate <= currentDate;
            })
            .sort((a, b) => {
                const dateA = a.display_date || a.ann_date;
                const dateB = b.display_date || b.ann_date;
                return dateB - dateA;
            });
        
        if (sortedAnnualEarnings.length === 0) continue;
        
        const latestAnnualEarning = sortedAnnualEarnings[0];
        const disclosureDate = new Date(latestAnnualEarning.display_date ? 
            `${latestAnnualEarning.display_date.toString().slice(0,4)}-${latestAnnualEarning.display_date.toString().slice(4,6)}-${latestAnnualEarning.display_date.toString().slice(6,8)}` :
            `${latestAnnualEarning.ann_date.toString().slice(0,4)}-${latestAnnualEarning.ann_date.toString().slice(4,6)}-${latestAnnualEarning.ann_date.toString().slice(6,8)}`);
        
        const reportYear = parseInt(latestAnnualEarning.end_date.toString().slice(0, 4));
        const isDisclosureDay = currentDate.toDateString() === disclosureDate.toDateString();
        const dividendYear = isDisclosureDay ? reportYear - 1 : reportYear;
        
        // 计算当前静态股息率
        const yearDividends = dividendData.filter(d => {
            if (!d.end_date) return false;
            const endDateStr = d.end_date.toString();
            const endYear = parseInt(endDateStr.slice(0, 4));
            return endYear === dividendYear && d.div_proc === '实施';
        });
        
        const totalDividend = yearDividends.reduce((sum, d) => {
            return sum + (parseFloat(d.cash_div_tax) || 0);
        }, 0);
        
        const currentDividendYield = totalDividend > 0 ? (totalDividend / currentPrice * 100) : 0;
        
        // 计算连续分红年数
        const consecutiveYears = calculateConsecutiveDividendYears(dividendYear, currentDate, earningsData, dividendData);
        
        // 获取最近季报的扣非同比增长率
        const sortedEarnings = earningsData
            .filter(e => {
                const disclosureDate = new Date(e.display_date ? 
                    `${e.display_date.toString().slice(0,4)}-${e.display_date.toString().slice(4,6)}-${e.display_date.toString().slice(6,8)}` :
                    `${e.ann_date.toString().slice(0,4)}-${e.ann_date.toString().slice(4,6)}-${e.ann_date.toString().slice(6,8)}`);
                return disclosureDate <= currentDate;
            })
            .sort((a, b) => {
                const dateA = a.display_date || a.ann_date;
                const dateB = b.display_date || b.ann_date;
                return dateB - dateA;
            });
        
        let currentGrowthRate = null;
        if (sortedEarnings.length > 0) {
            const latestEarning = sortedEarnings[0];
            const reportEndDate = latestEarning.end_date.toString();
            const isEarningsDisclosureDay = currentDate.toDateString() === new Date(latestEarning.display_date ? 
                `${latestEarning.display_date.toString().slice(0,4)}-${latestEarning.display_date.toString().slice(4,6)}-${latestEarning.display_date.toString().slice(6,8)}` :
                `${latestEarning.ann_date.toString().slice(0,4)}-${latestEarning.ann_date.toString().slice(4,6)}-${latestEarning.ann_date.toString().slice(6,8)}`).toDateString();
            
            let targetEndDate;
            if (isEarningsDisclosureDay) {
                const year = parseInt(reportEndDate.slice(0, 4));
                const monthDay = reportEndDate.slice(4, 8);
                switch (monthDay) {
                    case '0331':
                        targetEndDate = `${year - 1}1231`;
                        break;
                    case '0630':
                        targetEndDate = `${year}0331`;
                        break;
                    case '0930':
                        targetEndDate = `${year}0630`;
                        break;
                    case '1231':
                        targetEndDate = `${year}0930`;
                        break;
                    default:
                        targetEndDate = reportEndDate;
                }
            } else {
                targetEndDate = reportEndDate;
            }
            
            const finaIndicator = finaIndicatorData.find(f => {
                return f.end_date && f.end_date.toString() === targetEndDate;
            });
            
            if (finaIndicator && finaIndicator.dt_netprofit_yoy !== null && finaIndicator.dt_netprofit_yoy !== undefined) {
                currentGrowthRate = parseFloat(finaIndicator.dt_netprofit_yoy);
            }
        }
        
        if (!isHolding) {
            // 买入条件：连续四年分红 + 扣非增长率≥-10% + 股息率首次达到4%
            if (consecutiveYears >= 4 && 
                currentGrowthRate !== null && currentGrowthRate >= -10 && 
                currentDividendYield >= 4.0) {
                
                // 检查是否是首次达到4%（避免重复买入）
                let isFirstTime = true;
                if (i > 0) {
                    // 检查前一个交易日的股息率
                    const prevTradeDateStr = dates[i-1].replace(/-/g, '');
                    const prevNoAdjData = rawStockDataNoAdj.find(d => d.trade_date.toString() === prevTradeDateStr);
                    if (prevNoAdjData) {
                        const prevPrice = parseFloat(prevNoAdjData.close);
                        const prevDividendYield = totalDividend > 0 ? (totalDividend / prevPrice * 100) : 0;
                        if (prevDividendYield >= 4.0) {
                            isFirstTime = false;
                        }
                    }
                }
                
                if (isFirstTime) {
                    buySignals.push({
                        date: dates[i],
                        price: currentPrice,
                        dividendYield: currentDividendYield,
                        growthRate: currentGrowthRate,
                        consecutiveYears: consecutiveYears
                    });
                    isHolding = true;
                    lastBuyIndex = i;
                }
            }
        } else {
            // 卖出条件：股息率首次达到3% 或 扣非增长率<-10%
            let shouldSell = false;
            let sellReason = '';
            
            // 条件1：扣非增长率小于-10%
            if (currentGrowthRate !== null && currentGrowthRate < -10) {
                shouldSell = true;
                sellReason = '扣非增长率<-10%';
            }
            
            // 条件2：股息率首次达到3%
            if (!shouldSell && currentDividendYield <= 3.0) {
                // 检查是否是首次达到3%
                let isFirstTime = true;
                if (i > lastBuyIndex) {
                    // 检查前一个交易日的股息率
                    const prevTradeDateStr = dates[i-1].replace(/-/g, '');
                    const prevNoAdjData = rawStockDataNoAdj.find(d => d.trade_date.toString() === prevTradeDateStr);
                    if (prevNoAdjData) {
                        const prevPrice = parseFloat(prevNoAdjData.close);
                        const prevDividendYield = totalDividend > 0 ? (totalDividend / prevPrice * 100) : 0;
                        if (prevDividendYield <= 3.0) {
                            isFirstTime = false;
                        }
                    }
                }
                
                if (isFirstTime) {
                    shouldSell = true;
                    sellReason = '股息率首次达到3%';
                }
            }
            
            if (shouldSell) {
                sellSignals.push({
                    date: dates[i],
                    price: currentPrice,
                    dividendYield: currentDividendYield,
                    growthRate: currentGrowthRate,
                    reason: sellReason
                });
                isHolding = false;
            }
        }
    }
    
    return { buySignals, sellSignals };
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadKlineData, calculateDateRange, formatDate,
        calculateConsecutiveDividendYears, calculateDividendYieldData,
        formatStockData, loadTradingCalendar, calculateTradingSignals
    };
}