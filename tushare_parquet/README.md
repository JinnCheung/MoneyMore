# tushare_parquet

`tushare_parquet` 是一个为 [Tushare](https://tushare.pro) API 提供缓存功能的 Python 包，旨在通过将金融数据缓存为 Parquet 格式，减少重复的网络请求，加快数据获取速度。

## 主要功能

- **Tushare API 缓存**: 对 Tushare 的多个常用接口（如 `pro_bar`, `dividend`, `income`, `stock_basic`, `trade_cal`, `fina_indicator`）提供透明的缓存层。
- **高性能存储**: 使用 Apache Parquet 格式存储数据，读取速度快，占用空间小。
- **自动缓存管理**: 自动处理缓存的生成、验证和更新，用户无需关心底层实现。
- **与 Tushare 一致的接口**: 保持与原生 Tushare 接口相似的调用方式，轻松上手。

## 安装

通过 pip 从项目根目录安装：

```bash
pip install .
```

## 快速开始

### 1. 设置 Tushare Token

在使用前，您需要设置您的 Tushare token。您可以在代码中直接设置，或通过环境变量 `TUSHARE_TOKEN` 来配置。

```python
import tushare_parquet as tp

# 方法一：在代码中设置（推荐）
tp.set_token("your_actual_token")

# 方法二：通过环境变量（运行代码前需要在终端设置）
# export TUSHARE_TOKEN="your_actual_token"
```

### 2. 使用缓存函数

像调用原生 Tushare 函数一样调用 `tushare_parquet` 中的函数。第一次调用会从 Tushare API 获取数据并存入本地缓存；后续在缓存有效期内的调用将直接从本地加载数据。

```python
import tushare_parquet as tp

tp.set_token("your_actual_token")

# 获取K线数据
df_bar = tp.pro_bar(ts_code='000001.SZ', adj='qfq', start_date='20230101', end_date='20230131')
print(df_bar.head())

# 获取分红数据
df_dividend = tp.dividend(ts_code='600036.SH')
print(df_dividend.head())

# 获取利润表数据
df_income = tp.income(ts_code='600036.SH', start_date='20220101', end_date='20221231')
print(df_income.head())

# 获取股票列表
df_stock_basic = tp.stock_basic(exchange='SSE', list_status='L')
print(df_stock_basic.head())

# 获取交易日历
df_trade_cal = tp.trade_cal(exchange='SSE', start_date='20230101', end_date='20230131')
print(df_trade_cal.head())

# 获取财务指标数据
df_fina = tp.fina_indicator(ts_code='600900.SH', start_date='20230101', end_date='20231231')
print(df_fina.head())
```

### 财务指标数据接口 (fina_indicator)

`fina_indicator` 接口用于获取上市公司的财务指标数据，包括盈利能力、偿债能力、运营能力等多项财务指标。

**主要参数：**
- `ts_code` (必需): TS股票代码，如 '600001.SH' 或 '000001.SZ'
- `ann_date` (可选): 公告日期
- `start_date` (可选): 报告期开始日期
- `end_date` (可选): 报告期结束日期
- `period` (可选): 报告期，每个季度最后一天的日期，如 '20231231' 表示年报
- `ttl_minutes` (可选): 缓存有效期，默认30天

**主要字段：**
- `eps`: 基本每股收益
- `roe`: 净资产收益率
- `profit_dedt`: 扣除非经常性损益后的净利润（扣非净利润）
- `debt_to_assets`: 资产负债率
- `current_ratio`: 流动比率
- `netprofit_margin`: 销售净利率
- 更多字段请参考 [Tushare官方文档](https://tushare.pro/document/2?doc_id=79)

**使用示例：**
```python
# 获取长江电力最近的财务指标
df = tp.fina_indicator(ts_code='600900.SH', start_date='20230101')
print(f"获取到 {len(df)} 条财务指标数据")

# 查看扣非净利润
if not df.empty and 'profit_dedt' in df.columns:
    latest_profit = df.iloc[0]['profit_dedt']
    print(f"最新扣非净利润: {latest_profit/100000000:.2f}亿元")
```

**注意事项：**
- 需要至少2000积分才可以调取此接口
- 每次请求最多返回100条记录
- 可通过设置不同的日期范围多次请求获取更多数据

## 缓存机制

- **缓存位置**: 默认情况下，缓存文件存储在当前工作目录下的 `data_cache` 文件夹中。
- **缓存键**: 缓存键由调用的 API 名称和传递的参数（`fields` 参数除外）通过 MD5 哈希生成，确保不同请求的缓存相互独立。
- **缓存有效期**: 每个接口可以设置不同的缓存有效期（通过 `expire_days` 参数），默认为 7 天或 30 天。当缓存过期后，程序将自动重新从 Tushare API 获取最新数据。

## 贡献

欢迎提交 issue 或 pull request 来改进此项目。