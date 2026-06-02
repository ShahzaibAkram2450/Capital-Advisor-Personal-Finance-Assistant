import { useState } from "react";
import { Budget } from "../types";
import { Settings, Save, Sparkles, Check } from "lucide-react";

interface ContextEditorProps {
  customContext: string;
  onSaveContext: (text: string) => Promise<void>;
  budgets: Budget[];
  onSaveBudget: (category: string, limit: number) => Promise<void>;
}

export default function ContextEditor({
  customContext,
  onSaveContext,
  budgets,
  onSaveBudget,
}: ContextEditorProps) {
  const [contextText, setContextText] = useState(customContext);
  const [savingContext, setSavingContext] = useState(false);
  const [contextSuccess, setContextSuccess] = useState(false);

  // Form states for category budgets
  const budgetCategories = [
    "Groceries",
    "Dining & Cafes",
    "Rent & Housing",
    "Subscriptions & Bills",
    "Transport & Travel",
    "Entertainment & Leisure",
    "Shopping & Retail",
    "Health & Fitness",
    "Miscellaneous"
  ];

  const [activeCategory, setActiveCategory] = useState(budgetCategories[0]);
  const [budgetLimit, setBudgetLimit] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetSuccess, setBudgetSuccess] = useState(false);

  async function handleContextSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingContext(true);
    setContextSuccess(false);
    try {
      await onSaveContext(contextText);
      setContextSuccess(true);
      setTimeout(() => setContextSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingContext(false);
    }
  }

  async function handleBudgetSubmit(e: React.FormEvent) {
    e.preventDefault();
    const limit = parseFloat(budgetLimit);
    if (isNaN(limit) || limit < 0) return;

    setSavingBudget(true);
    setBudgetSuccess(false);
    try {
      await onSaveBudget(activeCategory, limit);
      setBudgetSuccess(true);
      setBudgetLimit("");
      setTimeout(() => setBudgetSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingBudget(false);
    }
  }

  // Find active budget limits for presentation
  const budgetMap = budgets.reduce((acc, curr) => {
    acc[curr.category] = curr.limit;
    return acc;
  }, {} as { [cat: string]: number });

  return (
    <div id="context-editor-wrapper" className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* 1. Custom Instruction Policy Guidelines */}
      <div id="context-instruction-block" className="bg-white border border-slate-100 rounded-2xl shadow-xs p-6 space-y-4 hover:shadow-sm transition-all duration-300">
        <div className="flex gap-3 items-center pb-3 border-b border-slate-50">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 tracking-wider uppercase font-display">Advisor Memory & Context Rules</h3>
            <p className="text-[11px] text-slate-400">Instruct Gemini on your pay cycles, thresholds, or exemptions</p>
          </div>
        </div>

        <form onSubmit={handleContextSubmit} className="space-y-4">
          <textarea
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
            placeholder="Example: 'I get paid on the 10th' or 'Ignore apartment rent when advising on food budgets.' or 'Limit coffee spending warning is $50.'"
            className="w-full text-xs border border-slate-200 rounded-xl p-3 h-32 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-700 outline-none resize-none bg-slate-50/40 font-sans transition-all duration-200"
          />
          <button
            type="submit"
            disabled={savingContext}
            className="w-full bg-slate-950 text-white text-xs hover:bg-slate-900 active:scale-[0.99] font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all duration-150 cursor-pointer"
          >
            {savingContext ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : contextSuccess ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {savingContext ? "Saving Guidelines..." : contextSuccess ? "Guidelines Updated!" : "Save Memory Guidelines"}
          </button>
        </form>
      </div>

      {/* 2. Budget Threshold Configuration */}
      <div id="context-budget-block" className="bg-white border border-slate-100 rounded-2xl shadow-xs p-6 space-y-4 hover:shadow-sm transition-all duration-300">
        <div className="flex gap-3 items-center pb-3 border-b border-slate-50">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 tracking-wider uppercase font-display">Category Budget limits</h3>
            <p className="text-[11px] text-slate-400">Establish custom monthly spending boundaries</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Create Limit Form */}
          <form onSubmit={handleBudgetSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Category</label>
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none bg-slate-50/20 font-sans"
              >
                {budgetCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Limit ($)</label>
              <input
                type="number"
                step="5"
                placeholder="e.g. 350"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none bg-slate-50/20 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={savingBudget}
              className="w-full bg-teal-600 text-white text-xs hover:bg-teal-700 active:scale-[0.99] font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all duration-150 cursor-pointer"
            >
              {savingBudget ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : budgetSuccess ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {savingBudget ? "Setting..." : budgetSuccess ? "Budget Saved!" : "Set Limit"}
            </button>
          </form>

          {/* List existing active limits */}
          <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 max-h-[190px] overflow-y-auto space-y-3.5">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 font-display">Active Limits</h4>
            {budgets.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic text-center py-6">No limits specified yet.</p>
            ) : (
              <div className="space-y-2">
                {budgets.map((b) => (
                  <div key={b.category} className="flex justify-between items-center text-[11px] pb-1 border-b border-slate-100/40">
                    <span className="text-slate-600 font-medium truncate max-w-[90px] font-display">{b.category}</span>
                    <span className="text-slate-800 font-bold font-mono">${b.limit.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
