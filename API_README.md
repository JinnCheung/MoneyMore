# MoneyMore RESTful API 文档

基于 `tushare_parquet` 模块构建的金融数据 RESTful API 服务。

## 快速开始

### 1. 安装依赖

```bash
# 激活虚拟环境
source venv/bin/activate

# 安装依赖包
pip install -r requirements.txt
```

### 2. 配置环境变量

创建 `.env` 文件并设置 Tushare Token 和 API 端口：

```bash
TUSHARE_TOKEN=your_tushare_token_here
API_PORT=5000
```

**端口配置说明**：
- `API_PORT`：API 服务的默认端口，默认为 5000
- 如果指定端口被占用，服务会自动尝试下一个可用端口
- 最多尝试 100 个端口（从默认端口开始）

### 3. 启动 API 服务

```bash
python app.py
```

服务将在配置的端口启动（默认 `http://localhost:5000`，如端口被占用会自动使用下一个可用端口）。

**项目结构**：
- `app.py`：程序启动入口
- `api/server.py`：API 服务核心模块
- `api/__init__.py`：API 包初始化文件

## API 接口文档

### 基础信息

- **Base URL**: `http://localhost:{port}` （端口由 .env 文件中的 API_PORT 指定，默认 5000）
- **API 版本**: `v1`
- **API 前缀**: `/api/v1`
- **响应格式**: JSON
- **端口策略**: 自动检测端口占用，如默认端口被占用会自动使用下一个可用端口

### 通用响应格式

#### 成功响应
```json
{
  "success": true,
  "message": "操作成功",
  "data": [...],
  "count": 100,
  "timestamp": "2024-01-01T12:00:00"
}
```

#### 错误响应
```json
{
  "success": false,
  "error": "ErrorType",
  "message": "错误描述"
}
```

### 接口列表

#### 1. 根路径

**GET** `/`

获取 API 基本信息和可用接口列表。

**响应示例**:
```json
{
  "name": "MoneyMore API",
  "version": "v1",
  "description": "基于 tushare_parquet 的金融数据 RESTful API",
  "endpoints": {
    "stock_data": "/api/v1/stock_data",
    "dividend": "/api/v1/dividend",
    "income": "/api/v1/income",
    "stock_basic": "/api/v1/stock_basic",
    "trade_cal": "/api/v1/trade_cal",
    "fina_indicator": "/api/v1/fina_indicator",
    "disclosure_date": "/api/v1/disclosure_date"
  }
}
```

#### 2. 股票行情数据

**GET** `/api/v1/stock_data`

获取股票行情数据。

**参数**:
- `ts_code` (必需): 股票代码，如 `000001.SZ`
- `start_date` (可选): 开始日期，格式 `YYYYMMDD`
- `end_date` (可选): 结束日期，格式 `YYYYMMDD`
- `adj` (可选): 复权类型，`qfq`-前复权 `hfq`-后复权 `None`-不复权
- `freq` (可选): 数据频度，支持 `D`/`W`/`M`，默认 `D`
- `ttl_minutes` (可选): 缓存时间（分钟），默认 1440（24小时）

**示例请求**:
```bash
curl "http://localhost:5000/api/v1/stock_data?ts_code=000001.SZ&start_date=20240101&end_date=20240131"
```

#### 3. 分红送股数据

**GET** `/api/v1/dividend`

获取分红送股数据。

**参数**:
- `ts_code` (可选): 股票代码
- `ann_date` (可选): 公告日期
- `record_date` (可选): 股权登记日
- `ex_date` (可选): 除权除息日
- `imp_ann_date` (可选): 实施公告日
- `ttl_minutes` (可选): 缓存时间（分钟），默认 1440

**示例请求**:
```bash
curl "http://localhost:5000/api/v1/dividend?ts_code=000001.SZ"
```

#### 4. 利润表数据

**GET** `/api/v1/income`

获取利润表数据。

**参数**:
- `ts_code` (可选): 股票代码
- `ann_date` (可选): 公告日期
- `start_date` (可选): 报告期开始日期
- `end_date` (可选): 报告期结束日期
- `period` (可选): 报告期
- `report_type` (可选): 报告类型
- `comp_type` (可选): 公司类型
- `ttl_minutes` (可选): 缓存时间（分钟），默认 43200（30天）

**示例请求**:
```bash
curl "http://localhost:5000/api/v1/income?ts_code=000001.SZ&period=20231231"
```

#### 5. 股票基础信息

**GET** `/api/v1/stock_basic`

获取股票基础信息数据。

**参数**:
- `is_hs` (可选): 是否沪深港通标的，`N`否 `H`沪股通 `S`深股通
- `list_status` (可选): 上市状态，`L`上市 `D`退市 `P`暂停上市，默认 `L`
- `exchange` (可选): 交易所 `SSE`上交所 `SZSE`深交所 `BSE`北交所
- `ts_code` (可选): 股票代码
- `ttl_minutes` (可选): 缓存时间（分钟），默认 43200

**示例请求**:
```bash
curl "http://localhost:5000/api/v1/stock_basic?exchange=SZSE&list_status=L"
```

#### 6. 交易日历

**GET** `/api/v1/trade_cal`

获取交易日历数据。

**参数**:
- `exchange` (可选): 交易所 `SSE`上交所 `SZSE`深交所
- `start_date` (可选): 开始日期
- `end_date` (可选): 结束日期
- `is_open` (可选): 是否交易 `0`休市 `1`交易
- `ttl_minutes` (可选): 缓存时间（分钟），默认 43200

**示例请求**:
```bash
curl "http://localhost:5000/api/v1/trade_cal?exchange=SSE&start_date=20240101&end_date=20240131"
```

#### 7. 财务指标数据

**GET** `/api/v1/fina_indicator`

获取财务指标数据。

**参数**:
- `ts_code` (必需): 股票代码
- `ann_date` (可选): 公告日期
- `start_date` (可选): 报告期开始日期
- `end_date` (可选): 报告期结束日期
- `period` (可选): 报告期
- `ttl_minutes` (可选): 缓存时间（分钟），默认 43200

**示例请求**:
```bash
curl "http://localhost:5000/api/v1/fina_indicator?ts_code=000001.SZ&period=20231231"
```

#### 8. 财报披露计划

**GET** `/api/v1/disclosure_date`

获取财报披露计划日期数据。

**参数**:
- `ts_code` (可选): 股票代码
- `end_date` (可选): 财报周期
- `pre_date` (可选): 计划披露日期
- `actual_date` (可选): 实际披露日期
- `ttl_minutes` (可选): 缓存时间（分钟），默认 43200

**示例请求**:
```bash
curl "http://localhost:5000/api/v1/disclosure_date?end_date=20231231"
```

## 错误码说明

| 错误码 | 错误类型 | 说明 |
|--------|----------|------|
| 400 | ValueError | 参数错误 |
| 400 | MissingParameter | 缺少必需参数 |
| 404 | NotFound | 请求的资源不存在 |
| 405 | MethodNotAllowed | 请求方法不被允许 |
| 500 | InternalError | 服务器内部错误 |

## 缓存机制

- API 使用 `tushare_parquet` 模块的缓存功能
- 缓存文件存储在 `~/.tushare_parquet_cache/` 目录
- 不同接口有不同的默认缓存时间：
  - 股票行情数据：24小时
  - 其他数据：30天
- 可通过 `ttl_minutes` 参数自定义缓存时间

## 使用示例

### Python 示例

```python
import requests
import json

# 获取股票基础信息
response = requests.get('http://localhost:5000/api/v1/stock_basic?exchange=SZSE')
data = response.json()

if data['success']:
    print(f"获取到 {data['count']} 条股票信息")
    for stock in data['data'][:5]:  # 显示前5条
        print(f"{stock['ts_code']} - {stock['name']}")
else:
    print(f"错误: {data['message']}")
```

### JavaScript 示例

```javascript
// 获取股票行情数据
fetch('http://localhost:5000/api/v1/stock_data?ts_code=000001.SZ&start_date=20240101')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log(`获取到 ${data.count} 条行情数据`);
      console.log(data.data);
    } else {
      console.error(`错误: ${data.message}`);
    }
  })
  .catch(error => console.error('请求失败:', error));
```

## 注意事项

1. **Tushare Token**: 需要有效的 Tushare Pro Token
2. **积分要求**: 某些接口需要足够的 Tushare 积分
3. **请求频率**: 遵守 Tushare API 的请求频率限制
4. **数据权限**: 不同积分等级可获取的数据范围不同
5. **缓存策略**: 合理设置缓存时间以平衡数据实时性和请求效率

## 开发和调试

### 启动开发模式

```bash
# 开发模式启动（自动重载）
python api_server.py
```

### 查看日志

API 服务会在控制台输出详细的请求日志和错误信息。

### 测试接口

可以使用以下工具测试 API：
- curl 命令行工具
- Postman
- 浏览器（GET 请求）
- Python requests 库

## 扩展开发

如需添加新的接口，可以参考现有接口的实现模式：

1. 在 `tushare_parquet/core.py` 中添加新的缓存函数
2. 在 `api_server.py` 中添加对应的 Flask 路由
3. 使用 `@handle_api_error` 装饰器处理错误
4. 使用 `format_response()` 函数格式化响应
5. 更新本文档