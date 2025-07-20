import tushare as ts
import pandas as pd
import os
import hashlib
import json
from datetime import datetime, timedelta

_token = None
_pro = None
_cache_dir = os.path.join(os.path.expanduser('~'), '.tushare_parquet_cache')
_metadata_dir = os.path.join(_cache_dir, 'metadata')

# 确保缓存目录存在
os.makedirs(_cache_dir, exist_ok=True)
os.makedirs(_metadata_dir, exist_ok=True)

def set_token(token):
    """设置 Tushare token。"""
    global _token, _pro
    _token = token
    _pro = ts.pro_api(_token)

def _get_pro_api():
    """获取 Tushare Pro API 实例。"""
    if _pro is None:
        raise ValueError("Tushare token 尚未设置。请先调用 set_token('your_token')。")
    return _pro

def _generate_cache_key(api_name, **kwargs):
    """根据 API 名称和参数生成唯一的缓存键。"""
    # 对 kwargs 排序以确保一致的键生成
    sorted_kwargs = sorted(kwargs.items())
    # 使用更稳定和可读的表示形式进行哈希
    hasher = hashlib.md5()
    hasher.update(api_name.encode('utf-8'))
    for key, value in sorted_kwargs:
        hasher.update(str(key).encode('utf-8'))
        hasher.update(str(value).encode('utf-8'))
    return hasher.hexdigest()

def _get_cache_file_path(key):
    """获取缓存文件的完整路径。"""
    return os.path.join(_cache_dir, f"{key}.parquet")

def _get_metadata_file_path(key):
    """获取元数据文件的完整路径。"""
    return os.path.join(_metadata_dir, f"{key}.json")

def _is_cache_valid(key, ttl_minutes=1440): # 默认 TTL: 24 小时
    """检查给定键的缓存是否仍然有效。"""
    metadata_path = _get_metadata_file_path(key)
    if not os.path.exists(metadata_path):
        return False
    
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    
    timestamp = datetime.fromisoformat(metadata['timestamp'])
    if datetime.now() - timestamp > timedelta(minutes=ttl_minutes):
        return False
        
    return True

def _fetch_and_cache(api_name, fetch_callable, ttl_minutes, **kwargs):
    """从可调用对象获取数据并进行缓存的通用函数。"""
    cache_key = _generate_cache_key(api_name, **kwargs)
    cache_file_path = _get_cache_file_path(cache_key)
    metadata_file_path = _get_metadata_file_path(cache_key)

    if _is_cache_valid(cache_key, ttl_minutes):
        try:
            # 从缓存加载
            return pd.read_parquet(cache_file_path)
        except Exception:
            # 从缓存加载失败，将从 API 获取
            pass

    # 从 API 获取
    df = fetch_callable(**kwargs)
    
    if df is not None and not df.empty:
        df.to_parquet(cache_file_path)
        metadata = {'timestamp': datetime.now().isoformat()}
        with open(metadata_file_path, 'w') as f:
            json.dump(metadata, f)
            
    return df

def pro_bar(ttl_minutes=1440, **kwargs):
    """tushare.pro_bar 的缓存版本。"""
    if 'ts_code' not in kwargs:
        raise ValueError("pro_bar 需要 ts_code 参数")
    
    # pro_bar 是 tushare 包中的一个函数，而不是 pro_api 的方法
    return _fetch_and_cache('pro_bar', ts.pro_bar, ttl_minutes, **kwargs)

def dividend(ttl_minutes=1440, **kwargs):
    """tushare.pro.dividend 的缓存版本。"""
    pro = _get_pro_api()
    
    required_params = ['ts_code', 'ann_date', 'record_date', 'ex_date', 'imp_ann_date']
    if not any(param in kwargs and kwargs[param] is not None for param in required_params):
        raise ValueError(f"以下参数至少需要一个: {', '.join(required_params)}")

    return _fetch_and_cache('dividend', pro.dividend, ttl_minutes, **kwargs)

def income(ttl_minutes=43200, **kwargs):
    """获取带缓存的利润表数据。"""
    pro = _get_pro_api()
    return _fetch_and_cache('income', pro.income, ttl_minutes, **kwargs)

def stock_basic(ttl_minutes=43200, **kwargs):
    """获取带缓存的基础信息数据。"""
    pro = _get_pro_api()
    return _fetch_and_cache('stock_basic', pro.stock_basic, ttl_minutes, **kwargs)

def trade_cal(ttl_minutes=43200, **kwargs):
    """获取带缓存的交易日历数据。"""
    pro = _get_pro_api()
    return _fetch_and_cache('trade_cal', pro.trade_cal, ttl_minutes, **kwargs)

def fina_indicator(ttl_minutes=43200, **kwargs):
    """获取带缓存的财务指标数据。
    
    参数:
        ts_code (str): TS股票代码，如 600001.SH/000001.SZ
        ann_date (str, 可选): 公告日期
        start_date (str, 可选): 报告期开始日期
        end_date (str, 可选): 报告期结束日期
        period (str, 可选): 报告期(每个季度最后一天的日期，如20171231表示年报)
        ttl_minutes (int): 缓存有效期，默认30天(43200分钟)
        
    返回:
        pandas.DataFrame: 财务指标数据
        
    注意:
        - 需要至少2000积分才可以调取
        - 每次请求最多返回100条记录
        - 可通过设置日期多次请求获取更多数据
    """
    pro = _get_pro_api()
    
    # 验证必需参数
    if 'ts_code' not in kwargs:
        raise ValueError("fina_indicator 需要 ts_code 参数")
    
    return _fetch_and_cache('fina_indicator', pro.fina_indicator, ttl_minutes, **kwargs)

def disclosure_date(ttl_minutes=43200, **kwargs):
    """获取带缓存的财报披露计划日期数据。
    
    参数:
        ts_code (str, 可选): TS股票代码，如 600001.SH/000001.SZ
        end_date (str, 可选): 财报周期（每个季度最后一天的日期，比如20181231表示2018年年报，20180630表示中报）
        pre_date (str, 可选): 计划披露日期
        actual_date (str, 可选): 实际披露日期
        ttl_minutes (int): 缓存有效期，默认30天(43200分钟)
        
    返回:
        pandas.DataFrame: 财报披露计划数据，包含以下字段：
            - ts_code: TS代码
            - ann_date: 最新披露公告日
            - end_date: 报告期
            - pre_date: 预计披露日期
            - actual_date: 实际披露日期
            - modify_date: 披露日期修正记录
        
    注意:
        - 需要至少500积分才可以调取
        - 单次最大3000条记录，总量不限制
        - 积分越多权限越大
        
    示例:
        # 获取2018年年报的披露计划
        df = disclosure_date(end_date='20181231')
        
        # 获取特定股票的披露计划
        df = disclosure_date(ts_code='000001.SZ')
        
        # 获取特定计划披露日期的数据
        df = disclosure_date(pre_date='20190131')
    """
    pro = _get_pro_api()
    
    return _fetch_and_cache('disclosure_date', pro.disclosure_date, ttl_minutes, **kwargs)