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


def find_available_port(start_port):
    """从指定端口开始查找可用端口"""
    port = start_port
    while port < start_port + 100:  # 最多尝试100个端口
        if is_port_available(port):
            return port
        port += 1
    raise RuntimeError(f"无法找到可用端口（从 {start_port} 开始）")


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
    if isinstance(data, pd.DataFrame):
        # 将 DataFrame 转换为字典列表
        data_dict = data.to_dict('records')
        return jsonify({
            'success': True,
            'message': message,
            'data': data_dict,
            'count': len(data_dict),
            'timestamp': datetime.now().isoformat()
        })
    else:
        return jsonify({
            'success': True,
            'message': message,
            'data': data,
            'timestamp': datetime.now().isoformat()
        })


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
    return send_from_directory(app.static_folder, filename)


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
    
    # 调用 tushare_parquet 接口
    df = tsp.pro_bar(ttl_minutes=ttl_minutes, **params)
    
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
    
    # 调用 tushare_parquet 接口
    df = tsp.dividend(ttl_minutes=ttl_minutes, **params)
    
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
    
    # 调用 tushare_parquet 接口
    df = tsp.income(ttl_minutes=ttl_minutes, **params)
    
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
    
    # 调用 tushare_parquet 接口
    df = tsp.stock_basic(ttl_minutes=ttl_minutes, **params)
    
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
    
    # 调用 tushare_parquet 接口
    df = tsp.trade_cal(ttl_minutes=ttl_minutes, **params)
    
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
    
    # 调用 tushare_parquet 接口
    df = tsp.fina_indicator(ttl_minutes=ttl_minutes, **params)
    
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
    
    # 调用 tushare_parquet 接口
    df = tsp.disclosure_date(ttl_minutes=ttl_minutes, **params)
    
    if df is None or df.empty:
        return jsonify({
            'success': False,
            'message': '未找到财报披露计划数据',
            'data': [],
            'count': 0
        })
    
    return format_response(df, '财报披露计划数据获取成功')


@app.route('/api/search_stocks')
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
    try:
        df = tsp.stock_basic(ttl_minutes=1440)  # 缓存1天
        
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


# 注意：启动逻辑已移至 app.py
# 如需直接运行此文件，请使用: python app.py