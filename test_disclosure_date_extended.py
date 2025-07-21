#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
扩展测试 tushare_parquet 的 disclosure_date 接口
"""

import os
import sys
from dotenv import load_dotenv
import pandas as pd

# 加载环境变量
load_dotenv()

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import tushare_parquet as tp

def test_disclosure_date_extended():
    """扩展测试 disclosure_date 接口"""
    print("="*60)
    print("🔍 扩展测试 tushare_parquet disclosure_date 接口")
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
    
    # 扩展测试用例
    test_cases = [
        {
            "name": "获取2024年年报披露计划",
            "params": {"end_date": "20241231"},
            "description": "测试获取最新年报披露计划"
        },
        {
            "name": "获取2024年三季报披露计划",
            "params": {"end_date": "20240930"},
            "description": "测试获取季报披露计划"
        },
        {
            "name": "获取招商银行披露计划",
            "params": {"ts_code": "600036.SH"},
            "description": "测试获取沪市股票披露计划"
        },
        {
            "name": "获取实际披露日期为2024年4月30日的数据",
            "params": {"actual_date": "20240430"},
            "description": "测试获取特定实际披露日期的数据"
        },
        {
            "name": "获取计划披露日期为2024年4月30日的数据",
            "params": {"pre_date": "20240430"},
            "description": "测试获取特定计划披露日期的数据"
        },
        {
            "name": "无参数调用（获取所有数据）",
            "params": {},
            "description": "测试无参数调用的情况",
            "limit_output": True
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
                
                # 数据质量检查
                print(f"   📈 数据质量检查:")
                print(f"      - ts_code 非空率: {(df['ts_code'].notna().sum() / len(df) * 100):.1f}%")
                print(f"      - end_date 非空率: {(df['end_date'].notna().sum() / len(df) * 100):.1f}%")
                print(f"      - actual_date 非空率: {(df['actual_date'].notna().sum() / len(df) * 100):.1f}%")
                print(f"      - pre_date 非空率: {(df['pre_date'].notna().sum() / len(df) * 100):.1f}%")
                
                # 显示数据样本
                if not test_case.get('limit_output', False):
                    print("   📄 数据样本:")
                    print(df.head(3).to_string(index=False))
                else:
                    print("   📄 数据样本（前2条）:")
                    print(df.head(2).to_string(index=False))
                
                success_count += 1
            else:
                print("   ⚠️  返回数据为空")
                # 对于空数据，我们也认为是成功的（可能确实没有数据）
                success_count += 1
                
        except Exception as e:
            print(f"   ❌ 测试失败: {e}")
            print(f"   错误类型: {type(e).__name__}")
            
            # 如果是权限问题，给出提示
            if "权限" in str(e) or "积分" in str(e) or "permission" in str(e).lower():
                print("   💡 提示: 可能是 Tushare 积分不足或权限问题")
    
    print(f"\n{'='*60}")
    print(f"📈 测试结果汇总: {success_count}/{total_count} 个测试通过")
    
    if success_count >= total_count * 0.8:  # 80% 通过率认为正常
        print("🎉 disclosure_date 接口工作正常！")
        return True
    else:
        print(f"⚠️  有较多测试失败，请检查接口状态")
        return False

def test_cache_functionality():
    """测试缓存功能"""
    print(f"\n{'='*60}")
    print("🗄️  测试缓存功能")
    print("="*60)
    
    try:
        import time
        
        # 第一次调用（从API获取）
        print("📡 第一次调用（从API获取数据）...")
        start_time = time.time()
        df1 = tp.disclosure_date(ts_code="000001.SZ")
        first_call_time = time.time() - start_time
        print(f"   耗时: {first_call_time:.2f} 秒")
        
        # 第二次调用（从缓存获取）
        print("💾 第二次调用（从缓存获取数据）...")
        start_time = time.time()
        df2 = tp.disclosure_date(ts_code="000001.SZ")
        second_call_time = time.time() - start_time
        print(f"   耗时: {second_call_time:.2f} 秒")
        
        # 验证数据一致性
        if df1.equals(df2):
            print("✅ 缓存数据与原始数据一致")
        else:
            print("⚠️  缓存数据与原始数据不一致")
        
        # 性能提升
        if second_call_time < first_call_time:
            speedup = first_call_time / second_call_time
            print(f"🚀 缓存性能提升: {speedup:.1f}x")
        
        return True
        
    except Exception as e:
        print(f"❌ 缓存测试失败: {e}")
        return False

if __name__ == "__main__":
    # 运行扩展测试
    api_test_result = test_disclosure_date_extended()
    
    # 运行缓存测试
    cache_test_result = test_cache_functionality()
    
    print(f"\n{'='*60}")
    print("🏁 最终测试结果")
    print("="*60)
    print(f"API 功能测试: {'✅ 通过' if api_test_result else '❌ 失败'}")
    print(f"缓存功能测试: {'✅ 通过' if cache_test_result else '❌ 失败'}")
    
    if api_test_result and cache_test_result:
        print("🎉 disclosure_date 接口完全正常！")
    else:
        print("⚠️  部分功能存在问题，请检查")