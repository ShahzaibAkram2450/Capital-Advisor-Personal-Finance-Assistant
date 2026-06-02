import { useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from "recharts";
import { Transaction } from "../types";
import { LayoutDashboard, TrendingUp, DollarSign } from "lucide-react";

interface FinanceChartsProps {
  transactions: Transaction[];
}

export default function FinanceCharts({ transactions }: FinanceChartsProps) {
  // 1. Group transactions by Month (compare across multiple months)
  const monthlyData = useMemo(() => {
    const monthlyGroups: { [month: string]: { income: number; expenses: number } } = {};
    
    // Process items
    transactions.forEach(tx => {
      // YYYY-MM-DD -> YYYY-MM
      if (!tx.date) return;
      const monthStr = tx.date.substr(0, 7); 
      if (!monthlyGroups[monthStr]) {
        monthlyGroups[monthStr] = { income: 0, expenses: 0 };
      }
      
      if (tx.amount < 0) {
        // Income is negative-keyed in standard transaction datasets, convert to absolute income
        monthlyGroups[monthStr].income += Math.abs(tx.amount);
      } else {
        // Expense is positive float
        monthlyGroups[monthStr].expenses += tx.amount;
      }
    });

    // Sort chronologically and format
    const months = Object.keys(monthlyGroups).sort();
    return months.map(m => {
      const year = m.substr(0, 4);
      const mNum = m.substr(5, 2);
      const dateParse = new Date(parseInt(year), parseInt(mNum) - 1, 1);
      const name = dateParse.toLocaleString("default", { month: "short", year: "2-digit" });
      
      return {
        monthKey: m,
        name,
        Income: monthlyGroups[m].income,
        Expenses: monthlyGroups[m].expenses,
        Net: monthlyGroups[m].income - monthlyGroups[m].expenses
      };
    }).slice(-6); // Limit to last 6 months for clean focus
  }, [transactions]);

  // 2. Group expenses only by Category
  const categoryData = useMemo(() => {
    const catGroups: { [cat: string]: number } = {};
    let totalExpenses = 0;

    transactions.forEach(tx => {
      if (tx.amount > 0 && tx.category !== "Income") {
        catGroups[tx.category] = (catGroups[tx.category] || 0) + tx.amount;
        totalExpenses += tx.amount;
      }
    });

    // Format and sort descending
    return Object.entries(catGroups)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const totalMonthlySpend = useMemo(() => {
    // Current month is June 2026 based on metadata
    const nowMonth = "2026-06";
    return transactions
      .filter(tx => tx.date?.startsWith(nowMonth) && tx.amount > 0 && tx.category !== "Income")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const totalMonthlyIncome = useMemo(() => {
    const nowMonth = "2026-06";
    return transactions
      .filter(tx => tx.date?.startsWith(nowMonth) && tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  }, [transactions]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* KPI Overviews */}
      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div id="kpi-income" className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs hover:shadow-sm transition-all duration-300 flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-105 duration-300">
            <DollarSign className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-display">June Income</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight font-display mt-0.5">${totalMonthlyIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div id="kpi-expenses" className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs hover:shadow-sm transition-all duration-300 flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center transition-transform group-hover:scale-105 duration-300">
            <TrendingUp className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-display">June Expenses</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight font-display mt-0.5">${totalMonthlySpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div id="kpi-cashflow" className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs hover:shadow-sm transition-all duration-300 flex items-center gap-4 group">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 duration-300 ${totalMonthlyIncome - totalMonthlySpend >= 0 ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"}`}>
            <LayoutDashboard className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-display">June Net savings</p>
            <p className={`text-2xl font-bold tracking-tight font-display mt-0.5 ${totalMonthlyIncome - totalMonthlySpend >= 0 ? "text-blue-600" : "text-amber-600"}`}>
              ${(totalMonthlyIncome - totalMonthlySpend).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Cash Flow Comparison Across Months */}
      <div id="chart-comparison" className="lg:col-span-2 bg-white border border-slate-100 p-6 rounded-2xl shadow-xs hover:shadow-sm transition-all duration-300">
        <h3 className="text-xs font-bold text-slate-700 mb-5 flex items-center gap-2 uppercase tracking-wider font-display">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          Historical Monthly Comparison
        </h3>
        
        {monthlyData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
            No historical cash flow data to map.
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart
                data={monthlyData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px', fontFamily: 'var(--font-sans)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#94a3b8', marginBottom: '4px' }}
                />
                <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <ReferenceLine y={0} stroke="#e2e8f0" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Category Breakdown list */}
      <div id="chart-categories" className="bg-white border border-slate-100 p-6 rounded-2xl shadow-xs hover:shadow-sm transition-all duration-300">
        <h3 className="text-xs font-bold text-slate-700 mb-5 flex items-center gap-2 uppercase tracking-wider font-display">
          <LayoutDashboard className="w-4 h-4 text-teal-600" />
          Spend by Category
        </h3>

        {categoryData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
            Add or import transactions to view category breakdowns.
          </div>
        ) : (
          <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
            {categoryData.map((cat, idx) => {
              // Color map for sleek tags
              const colorKeys = [
                "bg-blue-600", "bg-teal-500", "bg-rose-500", 
                "bg-amber-500", "bg-emerald-500", "bg-sky-500"
              ];
              const progressColor = colorKeys[idx % colorKeys.length];

              return (
                <div key={cat.name} className="space-y-1.5Packed">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span className="font-display text-slate-600">{cat.name}</span>
                    <span className="font-mono text-slate-500 text-[11px]">${cat.value.toFixed(2)} ({cat.percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full ${progressColor} transition-all duration-500`} 
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
