#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试 tushare_parquet 的 disclosure_date 接口
"""

import os
import sys
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import tushare_parquet as tp

def test_disclosure_date():
    """测试 disclosure_date 接口"""
    print("="*60)
    print("🧪 测试 tushare_parquet disclosure_date 接口")
    print("="*60)
    
    # 设置 token
    token = os.getenv('TUSHARE_TOKEN')
    if not token:
        print("❌ 错误: 未找到 TUSHARE_TOKEN 环境变量")
        return False
    
    try:
        tp.set_token(token)
        print("✅ Tushare token 设置成功")
    except Exception as e:
        print(f"❌ 设置 token 失败: {e}")
        return False
    
    # 测试用例
    test_cases = [
        {
            "name": "获取2023年年报披露计划",
            "params": {"end_date": "20231231"},
            "description": "测试获取特定报告期的披露计划"
        },
        {
            "name": "获取平安银行披露计划",
            "params": {"ts_code": "000001.SZ"},
            "description": "测试获取特定股票的披露计划"
        },
        {
            "name": "获取2024年1月31日计划披露的数据",
            "params": {"pre_date": "20240131"},
            "description": "测试获取特定计划披露日期的数据"
        }
    ]
    
    success_count = 0
    total_count = len(test_cases)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 测试 {i}/{total_count}: {test_case['name']}")
        print(f"   描述: {test_case['description']}")
        print(f"   参数: {test_case['params']}")
        
        try:
            # 调用 disclosure_date 接口
            df = tp.disclosure_date(**test_case['params'])
            
            if df is not None and not df.empty:
                print(f"   ✅ 成功获取数据，共 {len(df)} 条记录")
                print(f"   📊 数据列: {list(df.columns)}")
                
                # 显示前几条数据
                if len(df) > 0:
                    print("   📄 前3条数据:")
                    print(df.head(3).to_string(index=False))
                
                success_count += 1
            else:
                print("   ⚠️  返回数据为空")
                
        except Exception as e:
            print(f"   ❌ 测试失败: {e}")
            print(f"   错误类型: {type(e).__name__}")
    
    print(f"\n{'='*60}")
    print(f"📈 测试结果汇总: {success_count}/{total_count} 个测试通过")
    
    if success_count == total_count:
        print("🎉 所有测试通过！disclosure_date 接口工作正常")
        return True
    else:
        print(f"⚠️  有 {total_count - success_count} 个测试失败")
        return False

if __name__ == "__main__":
    test_disclosure_date()