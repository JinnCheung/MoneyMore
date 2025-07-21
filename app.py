#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MoneyMore 应用程序启动入口
基于 tushare_parquet 的金融数据分析平台
"""

import os
import sys
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

def main():
    """主程序入口"""
    # 检查环境变量
    if not os.getenv('TUSHARE_TOKEN'):
        print("错误: 请设置 TUSHARE_TOKEN 环境变量")
        print("请在 .env 文件中添加: TUSHARE_TOKEN=your_token_here")
        sys.exit(1)
    
    print("="*60)
    print("🚀 MoneyMore 金融数据分析平台")
    print("基于 tushare_parquet 的智能投资分析与个人财富管理平台")
    print("="*60)
    
    try:
        # 导入并启动 API 服务
        from api.server import app, find_available_port, API_VERSION, API_PREFIX
        
        # 在5000-5010范围内查找可用端口
        try:
            available_port = find_available_port()
            print(f"✅ 找到可用端口: {available_port}")
        except RuntimeError as e:
            print(f"❌ 错误: {e}")
            sys.exit(1)
        
        print(f"📡 API 服务信息:")
        print(f"   版本: {API_VERSION}")
        print(f"   前缀: {API_PREFIX}")
        print(f"   端口范围: 5000-5010")
        print(f"   使用端口: {available_port}")
        print(f"   服务地址: http://localhost:{available_port}")
        
        print(f"\n🔗 可用接口:")
        print(f"   - 股票行情: {API_PREFIX}/stock_data")
        print(f"   - 分红数据: {API_PREFIX}/dividend")
        print(f"   - 利润表: {API_PREFIX}/income")
        print(f"   - 股票基础信息: {API_PREFIX}/stock_basic")
        print(f"   - 交易日历: {API_PREFIX}/trade_cal")
        print(f"   - 财务指标: {API_PREFIX}/fina_indicator")
        print(f"   - 财报披露计划: {API_PREFIX}/disclosure_date")
        
        print(f"\n📚 API 文档: 查看 API_README.md")
        print(f"🌐 在浏览器中访问: http://localhost:{available_port}")
        print(f"\n⏹️  按 Ctrl+C 停止服务")
        print("="*60)
        
        # 启动 Flask 应用
        app.run(host='0.0.0.0', port=available_port, debug=True)
        
    except ImportError as e:
        print(f"❌ 导入错误: {e}")
        print("请确保已安装所有依赖包: pip install -r requirements.txt")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n👋 服务已停止，感谢使用 MoneyMore！")
        sys.exit(0)
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()