#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MoneyMore RESTful API 服务
基于 tushare_parquet 模块提供金融数据 API 接口
"""

import os
import json
import socket
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, send_from_directory, redirect, url_for
from flask_cors import CORS
from dotenv import load_dotenv
import tushare_parquet as tsp
import pandas as pd

# 加载环境变量
load_dotenv()

# 初始化 Flask 应用
app = Flask(__name__, 
            template_folder='../views',
            static_folder='../views')
CORS(app)  # 允许跨域请求

# 设置 tushare_parquet token
tsp.set_token(os.getenv('TUSHARE_TOKEN'))

# API 版本
API_VERSION = 'v1'
API_PREFIX = f'/api/{API_VERSION}'


def is_port_available(port):
    """检查端口是否可用"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(1)
            result = sock.connect_ex(('localhost', port))
            return result != 0
    except Exception:
        return False


def find_available_port(start_port=5000):
    """在5000-5010范围内查找可用端口"""
    # 固定在5000-5010范围内查找
    for port in range(5000, 5011):
        if is_port_available(port):
            return port
    raise RuntimeError("无法在5000-5010端口范围内找到可用端口")


def handle_api_error(func):
    """API 错误处理装饰器"""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ValueError as e:
            return jsonify({
                'success': False,
                'error': 'ValueError',
                'message': str(e)
            }), 400
        except Exception as e:
            return jsonify({
                'success': False,
                'error': 'InternalError',
                'message': f'服务器内部错误: {str(e)}'
            }), 500
    wrapper.__name__ = func.__name__
    return wrapper


def format_response(data, message='success'):
    """格式化 API 响应"""
    import math
    
    def clean_nan_values(obj):
        """递归清理所有NaN值"""
        if isinstance(obj, dict):
            return {k: clean_nan_values(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [clean_nan_values(item) for item in obj]
        elif isinstance(obj, float) and (math.isnan(obj) or obj != obj):  # 检查NaN
            return None
        else:
            return obj
    
    if isinstance(data, pd.DataFrame):
        # 将 DataFrame 转换为字典列表
        data_dict = data.to_dict('records')
        # 递归清理所有NaN值
        data_dict = clean_nan_values(data_dict)
        response_data = {
            'success': True,
            'message': message,
            'data': data_dict,
            'count': len(data_dict),
            'timestamp': datetime.now().isoformat()
        }
        # 使用json.dumps确保NaN值被正确处理为null
        return app.response_class(
            response=json.dumps(response_data, ensure_ascii=False),
            status=200,
            mimetype='application/json'
        )
    else:
        # 清理非DataFrame数据中的NaN值
        cleaned_data = clean_nan_values(data)
        response_data = {
            'success': True,
            'message': message,
            'data': cleaned_data,
            'timestamp': datetime.now().isoformat()
        }
        return app.response_class(
            response=json.dumps(response_data, ensure_ascii=False),
            status=200,
            mimetype='application/json'
        )


@app.route('/')
def index():
    """首页 - 显示长江电力K线图"""
    return render_template('index.html')


@app.route('/api')
def api_info():
    """API 信息页面"""
    return jsonify({
        'name': 'MoneyMore API',
        'version': API_VERSION,
        'description': '基于 tushare_parquet 的金融数据 RESTful API',
        'endpoints': {
            'stock_data': f'{API_PREFIX}/stock_data',
            'dividend': f'{API_PREFIX}/dividend',
            'income': f'{API_PREFIX}/income',
            'stock_basic': f'{API_PREFIX}/stock_basic',
            'trade_cal': f'{API_PREFIX}/trade_cal',
            'fina_indicator': f'{API_PREFIX}/fina_indicator',
            'disclosure_date': f'{API_PREFIX}/disclosure_date'
        }
    })


@app.route('/static/<path:filename>')
def static_files(filename):
    """静态文件服务"""
    return send_from_directory('../views', filename)

@app.route('/test_api.html')
def test_api():
    """API测试页面"""
    return send_from_directory('..', 'test_api.html')


@app.route(f'{API_PREFIX}/stock_data')
@handle_api_error
def get_stock_data():
    """
    获取股票行情数据
    
    参数:
        ts_code (str): 股票代码，如 000001.SZ
        start_date (str, 可选): 开始日期，格式 YYYYMMDD
        end_date (str, 可选): 结束日期，格式 YYYYMMDD
        adj (str, 可选): 复权类型，qfq-前复权 hfq-后复权 None-不复权，默认None
        freq (str, 可选): 数据频度，支持D/W/M，默认D
        ttl_minutes (int, 可选): 缓存时间（分钟），默认1440（24小时）
    """
    ts_code = request.args.get('ts_code')
    if not ts_code:
        return jsonify({
            'success': False,
            'error': 'MissingParameter',
            'message': '缺少必需参数: ts_code'
        }), 400
    
    # 获取参数
    params = {
        'ts_code': ts_code,
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'adj': request.args.get('adj'),
        'freq': request.args.get('freq', 'D')
    }
    
    # 移除空值参数
    params = {k: v for k, v in params.items() if v is not None}
    
    ttl_minutes = int(request.args.get('ttl_minutes', 1440))
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    
    # 调用 tushare_parquet 接口
    df = tsp.pro_bar(ttl_minutes=ttl_minutes, force_refresh=force_refresh, **params)
    
    if df is None or df.empty:
        return jsonify({
            'success': False,
            'message': '未找到数据',
            'data': [],
            'count': 0
        })
    
    return format_response(df, '股票行情数据获取成功')


@app.route(f'{API_PREFIX}/dividend')
@handle_api_error
def get_dividend():
    """
    获取分红送股数据
    
    参数:
        ts_code (str, 可选): 股票代码
        ann_date (str, 可选): 公告日期
        record_date (str, 可选): 股权登记日
        ex_date (str, 可选): 除权除息日
        imp_ann_date (str, 可选): 实施公告日
        ttl_minutes (int, 可选): 缓存时间（分钟），默认1440（24小时）
    """
    # 获取参数
    params = {
        'ts_code': request.args.get('ts_code'),
        'ann_date': request.args.get('ann_date'),
        'record_date': request.args.get('record_date'),
        'ex_date': request.args.get('ex_date'),
        'imp_ann_date': request.args.get('imp_ann_date')
    }
    
    # 移除空值参数
    params = {k: v for k, v in params.items() if v is not None}
    
    ttl_minutes = int(request.args.get('ttl_minutes', 1440))
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    
    # 调用 tushare_parquet 接口
    df = tsp.dividend(ttl_minutes=ttl_minutes, force_refresh=force_refresh, **params)
    
    if df is None or df.empty:
        return jsonify({
            'success': False,
            'message': '未找到分红数据',
            'data': [],
            'count': 0
        })
    
    return format_response(df, '分红数据获取成功')


@app.route(f'{API_PREFIX}/income')
@handle_api_error
def get_income():
    """
    获取利润表数据
    
    参数:
        ts_code (str, 可选): 股票代码
        ann_date (str, 可选): 公告日期
        start_date (str, 可选): 报告期开始日期
        end_date (str, 可选): 报告期结束日期
        period (str, 可选): 报告期
        report_type (str, 可选): 报告类型
        comp_type (str, 可选): 公司类型
        ttl_minutes (int, 可选): 缓存时间（分钟），默认43200（30天）
    """
    # 获取参数
    params = {
        'ts_code': request.args.get('ts_code'),
        'ann_date': request.args.get('ann_date'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'period': request.args.get('period'),
        'report_type': request.args.get('report_type'),
        'comp_type': request.args.get('comp_type')
    }
    
    # 移除空值参数
    params = {k: v for k, v in params.items() if v is not None}
    
    ttl_minutes = int(request.args.get('ttl_minutes', 43200))
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    
    # 调用 tushare_parquet 接口
    df = tsp.income(ttl_minutes=ttl_minutes, force_refresh=force_refresh, **params)
    
    if df is None or df.empty:
        return jsonify({
            'success': False,
            'message': '未找到利润表数据',
            'data': [],
            'count': 0
        })
    
    return format_response(df, '利润表数据获取成功')


@app.route(f'{API_PREFIX}/stock_basic')
@handle_api_error
def get_stock_basic():
    """
    获取基础信息数据
    
    参数:
        is_hs (str, 可选): 是否沪深港通标的，N否 H沪股通 S深股通
        list_status (str, 可选): 上市状态，L上市 D退市 P暂停上市，默认L
        exchange (str, 可选): 交易所 SSE上交所 SZSE深交所 BSE北交所
        ts_code (str, 可选): 股票代码
        ttl_minutes (int, 可选): 缓存时间（分钟），默认43200（30天）
    """
    # 获取参数
    params = {
        'is_hs': request.args.get('is_hs'),
        'list_status': request.args.get('list_status', 'L'),
        'exchange': request.args.get('exchange'),
        'ts_code': request.args.get('ts_code')
    }
    
    # 移除空值参数
    params = {k: v for k, v in params.items() if v is not None}
    
    ttl_minutes = int(request.args.get('ttl_minutes', 43200))
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    
    # 调用 tushare_parquet 接口
    df = tsp.stock_basic(ttl_minutes=ttl_minutes, force_refresh=force_refresh, **params)
    
    if df is None or df.empty:
        return jsonify({
            'success': False,
            'message': '未找到股票基础信息',
            'data': [],
            'count': 0
        })
    
    return format_response(df, '股票基础信息获取成功')


@app.route(f'{API_PREFIX}/trade_cal')
@handle_api_error
def get_trade_cal():
    """
    获取交易日历数据
    
    参数:
        exchange (str, 可选): 交易所 SSE上交所 SZSE深交所
        start_date (str, 可选): 开始日期
        end_date (str, 可选): 结束日期
        is_open (str, 可选): 是否交易 0休市 1交易
        ttl_minutes (int, 可选): 缓存时间（分钟），默认43200（30天）
    """
    # 获取参数
    params = {
        'exchange': request.args.get('exchange'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'is_open': request.args.get('is_open')
    }
    
    # 移除空值参数
    params = {k: v for k, v in params.items() if v is not None}
    
    ttl_minutes = int(request.args.get('ttl_minutes', 43200))
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    
    # 调用 tushare_parquet 接口
    df = tsp.trade_cal(ttl_minutes=ttl_minutes, force_refresh=force_refresh, **params)
    
    if df is None or df.empty:
        return jsonify({
            'success': False,
            'message': '未找到交易日历数据',
            'data': [],
            'count': 0
        })
    
    return format_response(df, '交易日历数据获取成功')


@app.route(f'{API_PREFIX}/fina_indicator')
@handle_api_error
def get_fina_indicator():
    """
    获取财务指标数据
    
    参数:
        ts_code (str): 股票代码（必需）
        ann_date (str, 可选): 公告日期
        start_date (str, 可选): 报告期开始日期
        end_date (str, 可选): 报告期结束日期
        period (str, 可选): 报告期
        ttl_minutes (int, 可选): 缓存时间（分钟），默认43200（30天）
    """
    ts_code = request.args.get('ts_code')
    if not ts_code:
        return jsonify({
            'success': False,
            'error': 'MissingParameter',
            'message': '缺少必需参数: ts_code'
        }), 400
    
    # 获取参数
    params = {
        'ts_code': ts_code,
        'ann_date': request.args.get('ann_date'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'period': request.args.get('period')
    }
    
    # 移除空值参数
    params = {k: v for k, v in params.items() if v is not None}
    
    ttl_minutes = int(request.args.get('ttl_minutes', 43200))
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    
    # 调用 tushare_parquet 接口
    df = tsp.fina_indicator(ttl_minutes=ttl_minutes, force_refresh=force_refresh, **params)
    
    if df is None or df.empty:
        return jsonify({
            'success': False,
            'message': '未找到财务指标数据',
            'data': [],
            'count': 0
        })
    
    return format_response(df, '财务指标数据获取成功')


@app.route(f'{API_PREFIX}/disclosure_date')
@handle_api_error
def get_disclosure_date():
    """
    获取财报披露计划日期数据
    
    参数:
        ts_code (str, 可选): 股票代码
        end_date (str, 可选): 财报周期
        pre_date (str, 可选): 计划披露日期
        actual_date (str, 可选): 实际披露日期
        ttl_minutes (int, 可选): 缓存时间（分钟），默认43200（30天）
    """
    # 获取参数
    params = {
        'ts_code': request.args.get('ts_code'),
        'end_date': request.args.get('end_date'),
        'pre_date': request.args.get('pre_date'),
        'actual_date': request.args.get('actual_date')
    }
    
    # 移除空值参数
    params = {k: v for k, v in params.items() if v is not None}
    
    ttl_minutes = int(request.args.get('ttl_minutes', 43200))
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    
    # 调用 tushare_parquet 接口
    df = tsp.disclosure_date(ttl_minutes=ttl_minutes, force_refresh=force_refresh, **params)
    
    if df is None or df.empty:
        return jsonify({
            'success': False,
            'message': '未找到财报披露计划数据',
            'data': [],
            'count': 0
        })
    
    return format_response(df, '财报披露计划数据获取成功')


@app.route(f'{API_PREFIX}/earnings')
@handle_api_error
def get_earnings():
    """
    获取财报数据用于K线图标记
    
    参数:
        ts_code (str): 股票代码（必需）
        ttl_minutes (int, 可选): 缓存时间（分钟），默认43200（30天）
    """
    ts_code = request.args.get('ts_code')
    
    if not ts_code:
        return jsonify({
            'success': False,
            'error': 'MissingParameter',
            'message': '缺少必需参数: ts_code'
        }), 400
    
    ttl_minutes = int(request.args.get('ttl_minutes', 43200))
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    
    try:
        # 获取财报披露计划数据
        disclosure_data = tsp.disclosure_date(ts_code=ts_code, ttl_minutes=ttl_minutes, force_refresh=force_refresh)
        
        if disclosure_data is None or disclosure_data.empty:
            return jsonify({
                'success': True,
                'message': '未找到财报披露数据',
                'data': [],
                'count': 0
            })
        
        # 过滤有实际披露日期的数据
        actual_disclosures = disclosure_data[disclosure_data['actual_date'].notna()]
        
        if actual_disclosures.empty:
            return jsonify({
                'success': True,
                'message': '未找到实际披露日期数据',
                'data': [],
                'count': 0
            })
        
        # 获取交易日历数据
        trade_cal = tsp.trade_cal(ttl_minutes=ttl_minutes, force_refresh=force_refresh)
        trading_days = set(trade_cal[trade_cal['is_open'] == 1]['cal_date'].astype(str))
        
        # 处理财报数据，调整到最近的交易日
        earnings_data = []
        for _, row in actual_disclosures.iterrows():
            actual_date = str(row['actual_date'])
            
            # 如果实际披露日期是交易日，直接使用
            if actual_date in trading_days:
                ann_date = actual_date
                display_date = actual_date
            else:
                # 找到最近的前一个交易日作为虚线标记位置
                ann_date = find_previous_trading_day(actual_date, trading_days)
                display_date = actual_date  # 保持显示真实披露日期
            
            if ann_date:
                earnings_data.append({
                    'ts_code': row['ts_code'],
                    'end_date': row['end_date'],
                    'ann_date': ann_date,  # 虚线标记的位置（交易日）
                    'actual_date': actual_date,  # 真实披露日期
                    'display_date': display_date,  # 显示的日期
                    'pre_date': row['pre_date']
                })
        
        return jsonify({
            'success': True,
            'message': '财报数据获取成功',
            'data': earnings_data,
            'count': len(earnings_data),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'InternalError',
            'message': f'获取财报数据失败: {str(e)}'
        }), 500


@app.route(f'{API_PREFIX}/trading_calendar')
@handle_api_error
def get_trading_calendar():
    """
    获取交易日历
    
    参数:
        exchange (str, 可选): 交易所 SSE上交所 SZSE深交所
        start_date (str, 可选): 开始日期
        end_date (str, 可选): 结束日期
        is_open (str, 可选): 是否交易 0休市 1交易
        ttl_minutes (int, 可选): 缓存时间（分钟），默认43200（30天）
    """
    # 获取参数
    params = {
        'exchange': request.args.get('exchange'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'is_open': request.args.get('is_open')
    }
    
    # 移除空值参数
    params = {k: v for k, v in params.items() if v is not None}
    
    ttl_minutes = int(request.args.get('ttl_minutes', 43200))
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    
    try:
        data = tsp.trade_cal(ttl_minutes=ttl_minutes, force_refresh=force_refresh, **params)
        
        if data is None or data.empty:
            return jsonify({
                'success': True,
                'message': '未找到交易日历数据',
                'data': [],
                'count': 0
            })
        
        return format_response(data, '交易日历数据获取成功')
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'InternalError',
            'message': f'获取交易日历失败: {str(e)}'
        }), 500


def find_next_trading_day(date_str, trading_days):
    """
    找到指定日期之后的最近交易日
    
    参数:
        date_str (str): 日期字符串，格式YYYYMMDD
        trading_days (set): 交易日集合
    
    返回:
        str: 最近的交易日，格式YYYYMMDD，如果找不到返回None
    """
    try:
        # 解析日期
        date_obj = datetime.strptime(date_str, '%Y%m%d')
        
        # 向后查找最多30天
        for i in range(1, 31):
            next_date = date_obj + timedelta(days=i)
            next_date_str = next_date.strftime('%Y%m%d')
            
            if next_date_str in trading_days:
                return next_date_str
        
        return None
    except Exception:
        return None


def find_previous_trading_day(date_str, trading_days):
    """
    找到指定日期之前的最近交易日
    
    参数:
        date_str (str): 日期字符串，格式YYYYMMDD
        trading_days (set): 交易日集合
    
    返回:
        str: 最近的交易日，格式YYYYMMDD，如果找不到返回None
    """
    try:
        # 解析日期
        date_obj = datetime.strptime(date_str, '%Y%m%d')
        
        # 向前查找最多30天
        for i in range(1, 31):
            prev_date = date_obj - timedelta(days=i)
            prev_date_str = prev_date.strftime('%Y%m%d')
            
            if prev_date_str in trading_days:
                return prev_date_str
        
        return None
    except Exception:
        return None


@app.route(f'{API_PREFIX}/search_stocks')
@handle_api_error
def search_stocks():
    """
    搜索股票（支持股票代码、名称、拼音缩写等）
    
    参数:
        q (str): 搜索关键词
        limit (int, 可选): 返回结果数量限制，默认20
    """
    query = request.args.get('q', '').strip()
    limit = int(request.args.get('limit', 20))
    
    # 获取股票基础信息
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    try:
        df = tsp.stock_basic(ttl_minutes=1440, force_refresh=force_refresh)  # 缓存1天
        
        if df is None or df.empty:
            return jsonify({
                'success': False,
                'message': '无法获取股票基础信息',
                'data': []
            })
        
        # 如果没有查询条件，返回前N个活跃股票
        if not query:
            # 过滤掉退市股票（如果有list_status字段的话）
            if 'list_status' in df.columns:
                active_stocks = df[df['list_status'] == 'L'].head(limit)
            else:
                # 如果没有list_status字段，直接取前N个
                active_stocks = df.head(limit)
            
            result = []
            for _, row in active_stocks.iterrows():
                result.append({
                    'code': row['ts_code'],
                    'name': row['name'],
                    'industry': row.get('industry', ''),
                    'area': row.get('area', ''),
                    'market': row.get('market', ''),
                    'list_date': row.get('list_date', ''),
                    'cnspell': row.get('cnspell', '')  # 返回拼音缩写信息
                })
            return jsonify({
                'success': True,
                'message': '获取股票列表成功',
                'data': result,
                'count': len(result)
            })
        
        # 进行搜索匹配
        query_lower = query.lower()
        matched_stocks = []
        
        for _, row in df.iterrows():
            # 跳过退市股票（如果有list_status字段的话）
            if 'list_status' in df.columns and row.get('list_status') != 'L':
                continue
                
            ts_code = str(row['ts_code']).lower()
            name = str(row['name']).lower()
            cnspell = str(row.get('cnspell', '')).lower()  # 获取拼音缩写
            
            # 匹配股票代码、名称或拼音缩写
            if (query_lower in ts_code or 
                query_lower in name or
                query_lower in cnspell or  # 支持拼音缩写搜索
                query in str(row['ts_code']) or
                query in str(row['name']) or
                query in str(row.get('cnspell', ''))):
                
                matched_stocks.append({
                    'code': row['ts_code'],
                    'name': row['name'],
                    'industry': row.get('industry', ''),
                    'area': row.get('area', ''),
                    'market': row.get('market', ''),
                    'list_date': row.get('list_date', ''),
                    'cnspell': row.get('cnspell', '')  # 返回拼音缩写信息
                })
                
                # 限制返回数量
                if len(matched_stocks) >= limit:
                    break
        
        return jsonify({
            'success': True,
            'message': f'找到 {len(matched_stocks)} 个匹配结果',
            'data': matched_stocks,
            'count': len(matched_stocks)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'搜索失败: {str(e)}',
            'data': []
        })


@app.errorhandler(404)
def not_found(error):
    """404 错误处理"""
    return jsonify({
        'success': False,
        'error': 'NotFound',
        'message': '请求的资源不存在'
    }), 404


@app.errorhandler(405)
def method_not_allowed(error):
    """405 错误处理"""
    return jsonify({
        'success': False,
        'error': 'MethodNotAllowed',
        'message': '请求方法不被允许'
    }), 405


@app.route(f'{API_PREFIX}/cache_info')
@handle_api_error
def get_cache_info():
    """
    获取缓存信息
    
    参数:
        ts_code (str, 可选): 股票代码，如果提供则返回该股票的缓存信息，否则返回stock_basic的缓存信息
        start_date (str, 可选): 开始日期，格式 YYYYMMDD（仅在查询股票数据缓存时使用）
        end_date (str, 可选): 结束日期，格式 YYYYMMDD（仅在查询股票数据缓存时使用）
        adj (str, 可选): 复权类型（仅在查询股票数据缓存时使用）
        freq (str, 可选): 数据频度（仅在查询股票数据缓存时使用）
    """
    try:
        ts_code = request.args.get('ts_code')
        
        if ts_code:
            # 查询股票数据的缓存信息
            params = {
                'ts_code': ts_code,
                'start_date': request.args.get('start_date'),
                'end_date': request.args.get('end_date'),
                'adj': request.args.get('adj'),
                'freq': request.args.get('freq', 'D')
            }
            # 移除空值参数
            params = {k: v for k, v in params.items() if v is not None}
            
            cache_key = tsp.core._generate_cache_key('pro_bar', **params)
            cache_type = f'股票数据 ({ts_code})'
        else:
            # 查询 stock_basic 的缓存信息
            cache_key = tsp.core._generate_cache_key('stock_basic')
            cache_type = '股票基础信息'
        
        metadata_file_path = tsp.core._get_metadata_file_path(cache_key)
        
        if os.path.exists(metadata_file_path):
            with open(metadata_file_path, 'r') as f:
                metadata = json.load(f)
            
            # 解析时间戳
            cache_time = datetime.fromisoformat(metadata['timestamp'])
            
            return jsonify({
                'success': True,
                'message': f'{cache_type}缓存信息获取成功',
                'data': {
                    'cache_time': cache_time.strftime('%Y-%m-%d %H:%M:%S'),
                    'cache_timestamp': metadata['timestamp'],
                    'cache_type': cache_type
                }
            })
        else:
            return jsonify({
                'success': True,
                'message': f'{cache_type}缓存文件不存在',
                'data': {
                    'cache_time': '暂无缓存',
                    'cache_timestamp': None,
                    'cache_type': cache_type
                }
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'获取缓存信息失败: {str(e)}',
            'data': {
                'cache_time': '获取失败',
                'cache_timestamp': None
            }
        })


# 注意：启动逻辑已移至 app.py
# 如需直接运行此文件，请使用: python app.py