# MoneyMore

基于 Tushare 数据的智能投资分析与个人财富管理平台

## 项目描述

MoneyMore 是一个集成了专业金融数据源的个人投资管理和财富分析平台。项目核心基于 `tushare_parquet` 模块，提供高效的金融数据缓存和分析功能，帮助用户做出更明智的投资决策。

## 核心功能

### 📊 金融数据管理
- **高性能数据缓存**: 基于 Apache Parquet 格式的 Tushare 数据缓存系统
- **多维度数据获取**: 支持股票基础信息、K线数据、财务指标、分红信息等
- **智能缓存机制**: 自动管理数据更新，减少网络请求，提升查询速度

### 💰 投资组合分析
- **股票基本面分析**: 基于财务指标进行深度分析
- **技术指标计算**: K线数据处理和技术分析
- **投资组合跟踪**: 个人持仓管理和收益分析
- **风险评估**: 基于历史数据的风险指标计算

### 📈 数据可视化
- **交互式图表**: 股价走势、财务指标趋势图
- **投资报表**: 个人投资组合表现报告
- **市场分析**: 行业对比和市场概况

## 技术特性

- **Python 3.11**: 现代 Python 开发环境
- **Tushare Pro API**: 专业金融数据源
- **Parquet 存储**: 高效的列式存储格式
- **智能缓存**: 自动化的数据管理机制

## 快速开始

### 1. 环境准备

```bash
# 激活虚拟环境
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置 Tushare Token

在项目根目录创建 `.env` 文件并添加您的 Tushare token：

```bash
TUSHARE_TOKEN=your_tushare_token_here
```

### 3. 使用示例

```python
import tushare_parquet as tp

# 设置 token
tp.set_token("your_token")

# 获取股票基础信息
df_stocks = tp.stock_basic(exchange='SSE', list_status='L')

# 获取K线数据
df_kline = tp.pro_bar(ts_code='000001.SZ', adj='qfq', 
                      start_date='20240101', end_date='20241201')

# 获取财务指标
df_fina = tp.fina_indicator(ts_code='600036.SH', 
                           start_date='20240101', end_date='20241201')
```

## 贡献

欢迎提交 Pull Request 和 Issue。

## 许可证

MIT License