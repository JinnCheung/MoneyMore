// MoneyMore 图表渲染模块

// 渲染带财报标记的图表
function renderChart(dates, klineData, stockInfo, dividendYieldData) {
    hideLoading();
    
    // 更新页面主标题为当前股票名称
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = stockInfo.name;
    }
    
    const isDark = document.body.classList.contains('dark-mode');
    
    // 计算四进三出买卖点
    let buySignals = [];
    let sellSignals = [];
    if (showTradingSignals && typeof calculateTradingSignals === 'function') {
        const signals = calculateTradingSignals(dates, klineData);
        buySignals = signals.buySignals;
        sellSignals = signals.sellSignals;
    }
    
    // 处理财报标记数据
    const earningsMarks = [];
    const earningsLines = [];
    
    if (showEarnings && earningsData && earningsData.length > 0) {
        earningsData.forEach(earning => {
            // 使用ann_date作为虚线位置（交易日）
            const annDateStr = earning.ann_date.toString();
            const formattedAnnDate = `${annDateStr.slice(0,4)}-${annDateStr.slice(4,6)}-${annDateStr.slice(6,8)}`;
            const dateIndex = dates.indexOf(formattedAnnDate);
            
            // 使用display_date作为显示的日期标签
            const displayDateStr = earning.display_date ? earning.display_date.toString() : earning.ann_date.toString();
            const formattedDisplayDate = `${displayDateStr.slice(0,4)}-${displayDateStr.slice(4,6)}-${displayDateStr.slice(6,8)}`;
            
            if (dateIndex >= 0) {
                // 仅添加垂直虚线，位置在交易日，但显示真实披露日期
                earningsLines.push({
                    name: formattedDisplayDate,  // 显示真实披露日期
                    xAxis: formattedAnnDate,     // 虚线位置在交易日
                    lineStyle: {
                        color: '#ff6b35',
                        type: 'dashed',
                        width: 1,
                        opacity: 0.6
                    },
                    label: {
                        show: true,
                        formatter: formattedDisplayDate,  // 显示真实披露日期
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
            position: function (point, params, dom, rect, size) {
                // 获取tooltip的实际尺寸和视口尺寸
                const tooltipWidth = size.contentSize[0];
                const tooltipHeight = size.contentSize[1];
                const viewWidth = size.viewSize[0];
                const viewHeight = size.viewSize[1];

                let x = point[0];
                let y = point[1];

                // 水平方向边界检测
                if (x + tooltipWidth > viewWidth) {
                    x = viewWidth - tooltipWidth - 10; // 留10px边距
                }
                if (x < 0) {
                    x = 10; // 左边距
                }

                // 垂直方向边界检测
                if (y + tooltipHeight > viewHeight) {
                    y = y - tooltipHeight - 20; // 显示在鼠标上方
                }
                if (y < 0) {
                    y = 10; // 顶部边距
                }

                return [x, y];
            },
            axisPointer: {
                type: 'cross'
            },
            formatter: function(params) {
                const data = params[0];
                const values = data.data;
                const currentIndex = dates.indexOf(data.name);
                
                // 从原始数据中获取所有信息
                let open = values[0];
                let close = values[1];
                let low = values[2];
                let high = values[3];
                let change = 0;
                let changePercent = 0;
                let volume = 0;
                let amount = 0;
                
                if (currentIndex >= 0 && currentIndex < rawStockData.length) {
                    const rawData = rawStockData[currentIndex];
                    open = parseFloat(rawData.open) || values[0];
                    close = parseFloat(rawData.close) || values[1];
                    low = parseFloat(rawData.low) || values[2];
                    high = parseFloat(rawData.high) || values[3];
                    change = rawData.change || 0;
                    changePercent = rawData.pct_chg || 0;
                    volume = rawData.vol || 0;
                    amount = rawData.amount || 0;
                }
                
                let tooltip = [
                    `<strong>${data.name}</strong>`,
                    `开盘: ${open.toFixed(2)}`,
                    `收盘: ${close.toFixed(2)}`,
                    `最低: ${low.toFixed(2)}`,
                    `最高: ${high.toFixed(2)}`,
                    `涨跌: ${change.toFixed(2)}`,
                    `涨跌幅: ${changePercent.toFixed(2)}%`,
                    `成交量: ${volume.toFixed(0)}手`,
                    `成交额: ${(amount / 10).toFixed(0)}万元`
                ];
                
                // 检查是否有财报数据
                 if (showEarnings && earningsData) {
                     const earning = earningsData.find(e => {
                         const dateStr = e.ann_date.toString();
                         const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
                         return formattedDate === data.name;
                     });
                     
                     if (earning) {
                         // 根据end_date判断财报类型
                         let reportType = '财报';
                         if (earning.end_date) {
                             const endDateStr = earning.end_date.toString();
                             const monthDay = endDateStr.slice(4, 8);
                             switch (monthDay) {
                                 case '0331':
                                     reportType = '一季报';
                                     break;
                                 case '0630':
                                     reportType = '中报';
                                     break;
                                 case '0930':
                                     reportType = '三季报';
                                     break;
                                 case '1231':
                                     reportType = '年报';
                                     break;
                                 default:
                                     reportType = '财报';
                             }
                         }
                         
                         tooltip.push('', `<strong style="color: #ff6b35;">📊 ${reportType}发布日</strong>`);
                         if (earning.basic_eps) {
                             tooltip.push(`每股收益: ${earning.basic_eps}`);
                         }
                         if (earning.total_revenue) {
                             tooltip.push(`营业收入: ${(earning.total_revenue / 100000000).toFixed(2)}亿`);
                         }
                     }
                 }
                
                // 显示分红信息（基于年报披露日）
                if (dividendData && dividendData.length > 0 && earningsData && earningsData.length > 0) {
                    const currentDate = new Date(data.name);
                    
                    // 找到当前日期之前最近的年报披露日（只考虑年报，end_date以1231结尾）
                    const sortedAnnualEarnings = earningsData
                        .filter(e => {
                            // 只筛选年报（end_date以1231结尾）
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
                            return dateB - dateA; // 降序排列，最近的在前
                        });
                    
                    if (sortedAnnualEarnings.length > 0) {
                        const latestAnnualEarning = sortedAnnualEarnings[0];
                        const disclosureDate = new Date(latestAnnualEarning.display_date ? 
                            `${latestAnnualEarning.display_date.toString().slice(0,4)}-${latestAnnualEarning.display_date.toString().slice(4,6)}-${latestAnnualEarning.display_date.toString().slice(6,8)}` :
                            `${latestAnnualEarning.ann_date.toString().slice(0,4)}-${latestAnnualEarning.ann_date.toString().slice(4,6)}-${latestAnnualEarning.ann_date.toString().slice(6,8)}`);
                        
                        // 基于年报披露日计算应显示的分红年度
                        // 年报披露日当日显示前一年分红，年报披露日的下一个交易日开始才显示当年分红
                        const reportYear = parseInt(latestAnnualEarning.end_date.toString().slice(0, 4));
                        
                        // 判断当前日期是否为年报披露日当日
                        const isDisclosureDay = currentDate.toDateString() === disclosureDate.toDateString();
                        
                        // 如果是年报披露日当日，显示前一年分红；否则显示当年分红
                        const dividendYear = isDisclosureDay ? reportYear - 1 : reportYear;
                        
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
                            
                            if (totalDividend > 0) {
                                tooltip.push('', '<strong style="color: #4CAF50;">💰 分红信息</strong>');
                                tooltip.push(`${dividendYear}年累计分红: ${totalDividend.toFixed(4)}元/股`);
                                
                                // 计算静态股息率（使用不复权收盘价）
                                let closeForDividendYield = close; // 默认使用当前收盘价
                                if (rawStockDataNoAdj && rawStockDataNoAdj.length > 0) {
                                    // 根据交易日期查找对应的不复权数据
                                    const tradeDateStr = data.name.replace(/-/g, ''); // 将YYYY-MM-DD格式转换为YYYYMMDD
                                    const noAdjData = rawStockDataNoAdj.find(d => d.trade_date.toString() === tradeDateStr);
                                    if (noAdjData) {
                                        closeForDividendYield = parseFloat(noAdjData.close); // 使用不复权收盘价
                                    }
                                }
                                
                                if (closeForDividendYield && closeForDividendYield > 0 && !isNaN(closeForDividendYield)) {
                                    const dividendYield = (totalDividend / closeForDividendYield * 100).toFixed(2);
                                    tooltip.push(`静态股息率: ${dividendYield}%`);
                                }
                                
                                // 计算连续分红年数
                                const consecutiveYears = calculateConsecutiveDividendYears(dividendYear, currentDate, earningsData, dividendData);
                                if (consecutiveYears > 0) {
                                    tooltip.push(`连续第${consecutiveYears}年分红`);
                                }
                                
                                tooltip.push(`<span style="color: #9E9E9E; font-size: 12px;">基于${disclosureDate.getFullYear()}年${disclosureDate.getMonth()+1}月${disclosureDate.getDate()}日披露</span>`);
                            }
                        }
                    }
                }
                
                // 显示扣非同比增长率（基于季报披露日）
                if (finaIndicatorData && finaIndicatorData.length > 0 && earningsData && earningsData.length > 0) {
                    const currentDate = new Date(data.name);
                    
                    // 找到当前日期之前最近的季报披露日
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
                            return dateB - dateA; // 降序排列，最近的在前
                        });
                    
                    if (sortedEarnings.length > 0) {
                        const latestEarning = sortedEarnings[0];
                        const disclosureDate = new Date(latestEarning.display_date ? 
                            `${latestEarning.display_date.toString().slice(0,4)}-${latestEarning.display_date.toString().slice(4,6)}-${latestEarning.display_date.toString().slice(6,8)}` :
                            `${latestEarning.ann_date.toString().slice(0,4)}-${latestEarning.ann_date.toString().slice(4,6)}-${latestEarning.ann_date.toString().slice(6,8)}`);
                        
                        // 基于季报披露日计算应显示的财务指标期间
                        // 季报披露日当日显示前一期数据，季报披露日的下一个交易日开始才显示当期数据
                        const reportEndDate = latestEarning.end_date.toString();
                        
                        // 判断当前日期是否为季报披露日当日
                        const isDisclosureDay = currentDate.toDateString() === disclosureDate.toDateString();
                        
                        // 如果是季报披露日当日，显示前一期数据；否则显示当期数据
                        let targetEndDate;
                        if (isDisclosureDay) {
                            // 显示前一期数据
                            const year = parseInt(reportEndDate.slice(0, 4));
                            const monthDay = reportEndDate.slice(4, 8);
                            switch (monthDay) {
                                case '0331': // 一季报披露日显示上年年报数据
                                    targetEndDate = `${year - 1}1231`;
                                    break;
                                case '0630': // 中报披露日显示当年一季报数据
                                    targetEndDate = `${year}0331`;
                                    break;
                                case '0930': // 三季报披露日显示当年中报数据
                                    targetEndDate = `${year}0630`;
                                    break;
                                case '1231': // 年报披露日显示当年三季报数据
                                    targetEndDate = `${year}0930`;
                                    break;
                                default:
                                    targetEndDate = reportEndDate;
                            }
                        } else {
                            // 显示当期数据
                            targetEndDate = reportEndDate;
                        }
                        
                        // 查找对应期间的财务指标数据
                        const finaIndicator = finaIndicatorData.find(f => {
                            return f.end_date && f.end_date.toString() === targetEndDate;
                        });
                        
                        if (finaIndicator && finaIndicator.dt_netprofit_yoy !== null && finaIndicator.dt_netprofit_yoy !== undefined) {
                            // 根据end_date判断财报类型
                            let reportType = '财报';
                            const monthDay = targetEndDate.slice(4, 8);
                            switch (monthDay) {
                                case '0331':
                                    reportType = '一季报';
                                    break;
                                case '0630':
                                    reportType = '中报';
                                    break;
                                case '0930':
                                    reportType = '三季报';
                                    break;
                                case '1231':
                                    reportType = '年报';
                                    break;
                            }
                            
                            const year = targetEndDate.slice(0, 4);
                            const growthRate = parseFloat(finaIndicator.dt_netprofit_yoy).toFixed(2);
                            const growthColor = parseFloat(finaIndicator.dt_netprofit_yoy) >= 0 ? '#4CAF50' : '#f44336';
                            
                            tooltip.push('', `<strong style="color: #2196F3;">📈 扣非同比增长率</strong>`);
                            tooltip.push(`${year}年${reportType}: <span style="color: ${growthColor};">${growthRate}%</span>`);
                            
                            // 查找对应的披露日期
                            if (disclosureDateData && disclosureDateData.length > 0) {
                                const disclosureInfo = disclosureDateData.find(d => {
                                    return d.end_date && d.end_date.toString() === targetEndDate;
                                });
                                
                                if (disclosureInfo && disclosureInfo.actual_date) {
                                    const disclosureDate = disclosureInfo.actual_date.toString();
                                    const formattedDate = `${disclosureDate.slice(0, 4)}年${disclosureDate.slice(4, 6)}月${disclosureDate.slice(6, 8)}日`;
                                    tooltip.push(`<span style="color: #9E9E9E; font-size: 12px;">基于${formattedDate}披露</span>`);
                                }
                            }
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
            right: showDividendYield ? '3%' : '2%',
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
        yAxis: [
            {
                type: 'value',
                scale: true,
                position: 'left',
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
            {
                type: 'value',
                scale: true,
                position: 'right',
                show: showDividendYield,
                name: '',
                nameLocation: 'middle',
                nameGap: 50,
                nameTextStyle: {
                    color: isDark ? '#b0b0b0' : '#7f8c8d',
                    fontSize: 12
                },
                axisLine: {
                    show: true,
                    lineStyle: {
                        color: isDark ? '#555' : '#bdc3c7'
                    }
                },
                axisTick: {
                    show: true
                },
                axisLabel: {
                    color: isDark ? '#b0b0b0' : '#7f8c8d',
                    formatter: function(value) {
                        return value.toFixed(1) + '%';
                    }
                },
                splitLine: {
                    show: false
                }
            }
        ],
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
        series: (() => {
            const seriesArray = [
                {
                    name: stockInfo.name,
                    type: 'candlestick',
                    yAxisIndex: 0,
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
            ];
            
            // 只有当开关打开时才添加股息率曲线
            if (showDividendYield) {
                const dividendYieldSeriesData = dividendYieldData ? dividendYieldData.map(d => d ? d.dividendYield : null) : [];
                seriesArray.push({
                    name: '静态股息率',
                    type: 'line',
                    yAxisIndex: 1,
                    data: dividendYieldSeriesData,
                    lineStyle: {
                        color: '#3498db',
                        width: 2
                    },
                    itemStyle: {
                        color: '#3498db'
                    },
                    symbol: 'none',
                    smooth: true,
                    connectNulls: false
                });
            }
            
            // 添加买卖点标记
            if (showTradingSignals) {
                // 买入点（实心圆）
                if (buySignals.length > 0) {
                    const buyData = buySignals.map(signal => {
                        const dateIndex = dates.indexOf(signal.date);
                        if (dateIndex >= 0 && dateIndex < klineData.length) {
                            // 使用当日收盘价作为买入点位置
                            const dayClose = klineData[dateIndex][1]; // K线数据格式：[开盘, 收盘, 最低, 最高]
                            return [dateIndex, dayClose];
                        }
                        return null;
                    }).filter(item => item !== null);
                    
                    if (buyData.length > 0) {
                        seriesArray.push({
                            name: '买入点',
                            type: 'scatter',
                            yAxisIndex: 0,
                            data: buyData,
                            symbol: 'circle',
                            symbolSize: 8,
                            itemStyle: {
                                color: '#3498db',
                                borderColor: '#3498db',
                                borderWidth: 2
                            },
                            emphasis: {
                                itemStyle: {
                                    shadowBlur: 10,
                                    shadowColor: '#3498db'
                                }
                            },
                            tooltip: {
                                formatter: function(params) {
                                    const signal = buySignals[params.dataIndex];
                                    return `<div style="text-align: left;">
                                        <strong style="color: #3498db;">🔴 买入信号</strong><br/>
                                        日期: ${signal.date}<br/>
                                        价格: ${signal.price.toFixed(2)}元<br/>
                                        股息率: ${signal.dividendYield.toFixed(2)}%<br/>
                                        扣非增长率: ${signal.growthRate ? signal.growthRate.toFixed(2) + '%' : 'N/A'}<br/>
                                        连续分红: ${signal.consecutiveYears}年
                                    </div>`;
                                }
                            }
                        });
                    }
                }
                
                // 卖出点（空心圆）
                if (sellSignals.length > 0) {
                    const sellData = sellSignals.map(signal => {
                        const dateIndex = dates.indexOf(signal.date);
                        if (dateIndex >= 0 && dateIndex < klineData.length) {
                            // 使用当日收盘价作为卖出点位置
                            const dayClose = klineData[dateIndex][1]; // K线数据格式：[开盘, 收盘, 最低, 最高]
                            return [dateIndex, dayClose];
                        }
                        return null;
                    }).filter(item => item !== null);
                    
                    if (sellData.length > 0) {
                        seriesArray.push({
                            name: '卖出点',
                            type: 'scatter',
                            yAxisIndex: 0,
                            data: sellData,
                            symbol: 'circle',
                            symbolSize: 8,
                            itemStyle: {
                                color: 'transparent',
                                borderColor: '#3498db',
                                borderWidth: 2
                            },
                            emphasis: {
                                itemStyle: {
                                    shadowBlur: 10,
                                    shadowColor: '#3498db'
                                }
                            },
                            tooltip: {
                                formatter: function(params) {
                                    const signal = sellSignals[params.dataIndex];
                                    return `<div style="text-align: left;">
                                        <strong style="color: #3498db;">🟢 卖出信号</strong><br/>
                                        日期: ${signal.date}<br/>
                                        价格: ${signal.price.toFixed(2)}元<br/>
                                        股息率: ${signal.dividendYield.toFixed(2)}%<br/>
                                        扣非增长率: ${signal.growthRate ? signal.growthRate.toFixed(2) + '%' : 'N/A'}<br/>
                                        卖出原因: ${signal.reason}
                                    </div>`;
                                }
                            }
                        });
                    }
                }
            }
            
            return seriesArray;
        })()
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

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderChart
    };
}