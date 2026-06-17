import React, { useMemo } from 'react';
import { 
  IndianRupee, Briefcase, Users, CheckCircle2, TrendingUp, AlertCircle, ShoppingBag, 
  MapPin, Calendar, FileText, ArrowUpRight, ArrowDownRight, Award 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { WorkbookState, ProjectCategory, LeadSource } from '../types';
import { calculateMonthlyPL, getMonthYearFromDate } from '../lib/excelExport';

interface DashboardSheetProps {
  state: WorkbookState;
}

export default function DashboardSheet({ state }: DashboardSheetProps) {
  // 1. KPI Calculations
  const metrics = useMemo(() => {
    // Total Revenue
    const totalRevenue = state.projectRevenue.reduce((sum, p) => sum + p.revenue, 0);
    const amountReceived = state.projectRevenue.reduce((sum, p) => sum + p.amountReceived, 0);
    const pendingPayments = state.projectRevenue.reduce((sum, p) => sum + p.pendingAmount, 0);

    // Total Expenses
    const totalExpenses = state.businessExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Total Team Payouts
    const totalTeamPayout = state.teamContributions.reduce((sum, t) => sum + (t.amountAllocated + t.bonus), 0);

    // Net Profit
    const totalProfit = totalRevenue - totalExpenses - totalTeamPayout;

    // Project Counts
    const activeProjects = state.projectTracker.filter(p => !['Completed', 'Delivered'].includes(p.status)).length;
    const completedProjects = state.projectTracker.filter(p => ['Completed', 'Delivered'].includes(p.status)).length;

    // Active Interns (Not yet cleared)
    const activeInterns = state.internships.filter(i => i.certificateStatus === 'Pending').length;

    return {
      totalRevenue,
      amountReceived,
      pendingPayments,
      totalExpenses,
      totalTeamPayout,
      totalProfit,
      activeProjects,
      completedProjects,
      activeInterns
    };
  }, [state]);

  // 2. Timeline Aggregation (recharts data source)
  const chartTimelineData = useMemo(() => {
    const sortedPL = calculateMonthlyPL(state);
    return sortedPL.map(item => ({
      name: item.month,
      Revenue: item.revenue,
      Expenses: item.expenses,
      TeamPayments: item.teamPayments,
      Profit: item.netProfit
    }));
  }, [state]);

  // 3. Category Revenue distribution (Pie Chart)
  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    state.projectRevenue.forEach(p => {
      map[p.projectCategory] = (map[p.projectCategory] || 0) + p.revenue;
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  }, [state.projectRevenue]);

  // 4. Lead Source distribution (Pie/Bar Chart)
  const leadsChartData = useMemo(() => {
    const map: Record<string, number> = {};
    state.projectRevenue.forEach(p => {
      map[p.leadSource] = (map[p.leadSource] || 0) + p.revenue;
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  }, [state.projectRevenue]);

  // Colors for chart slices
  const COLORS = ['#0f4c81', '#1f77b4', '#4c99e0', '#32cd32', '#ffbc42', '#ff5a5f', '#963d97', '#00cccc'];

  return (
    <div className="space-y-6">
      {/* Page Title banner */}
      <div className="bg-[#0f4c81] rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-md">
        <div className="absolute right-0 bottom-0 top-0 opacity-15 translate-x-12 hidden lg:block select-none pointer-events-none">
          <svg width="400" height="100%" viewBox="0 0 100 100" fill="none">
            <ellipse cx="50" cy="50" rx="40" ry="25" fill="white" />
          </svg>
        </div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-white/25 rounded-md text-xs font-mono font-bold">Cambrian</span>
            <span className="text-white/80">•</span>
            <span className="px-2.5 py-1 bg-white/25 rounded-md text-xs font-mono font-bold">IndiWebPros</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-sans">Business Performance Dashboard</h1>
          <p className="text-sm text-sky-100 max-w-2xl font-light">
            Real-time spreadsheet intelligence & executive summaries mapping project pipelines, technical contributions, academic research revenues, and team margins.
          </p>
        </div>
      </div>

      {/* KPI 4-Column Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Total Revenue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-800 rounded-lg">
            <IndianRupee className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-550 font-medium uppercase tracking-wider">Total Revenue</p>
            <h3 className="text-xl font-bold text-slate-900 mt-1">
              ₹{metrics.totalRevenue.toLocaleString('en-IN')}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-semibold">
              <ArrowUpRight className="h-3 w-3" />
              <span>Full Project Billings</span>
            </div>
          </div>
        </div>

        {/* KPI: Total Expenses */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-700 rounded-lg">
            <ArrowDownRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-550 font-medium uppercase tracking-wider">Business Expenses</p>
            <h3 className="text-xl font-bold text-slate-900 mt-1">
              ₹{metrics.totalExpenses.toLocaleString('en-IN')}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
              <span>Hosting, Domains & Admin</span>
            </div>
          </div>
        </div>

        {/* KPI: Total Team Payout */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-lg">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-550 font-medium uppercase tracking-wider">Team Payments</p>
            <h3 className="text-xl font-bold text-slate-900 mt-1">
              ₹{metrics.totalTeamPayout.toLocaleString('en-IN')}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 font-semibold">
              <span>Dev Allocations + Bonuses</span>
            </div>
          </div>
        </div>

        {/* KPI: Net Profit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-550 font-medium uppercase tracking-wider">Agency Net Profit</p>
            <h3 className={`text-xl font-bold mt-1 ${metrics.totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-650'}`}>
              ₹{metrics.totalProfit.toLocaleString('en-IN')}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-semibold">
              <CheckCircle2 className="h-3 w-3" />
              <span>Revenue - Exp - Team</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Projects</span>
          <p className="text-2xl font-black text-slate-800 mt-0.5">{metrics.activeProjects}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Completed Projects</span>
          <p className="text-2xl font-black text-slate-800 mt-0.5">{metrics.completedProjects}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Interns</span>
          <p className="text-2xl font-black text-slate-800 mt-0.5">{metrics.activeInterns}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unpaid Receivables</span>
          <p className="text-xl font-bold text-rose-600 mt-1">₹{metrics.pendingPayments.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Revenue vs Expense Trend (Main Financial Chart) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Monthly Revenue vs. Expenses</h3>
              <p className="text-[11px] text-slate-500">Chronological analysis of cash inflows and cost burdens</p>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartTimelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={75} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
                  contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11, pt: 10 }} />
                <Bar dataKey="Revenue" fill="#0f4c81" radius={[4, 4, 0, 0]} name="Gross Revenue" />
                <Bar dataKey="Expenses" fill="#f56565" radius={[4, 4, 0, 0]} name="Operating Expenses" />
                <Bar dataKey="TeamPayments" fill="#edd060" radius={[4, 4, 0, 0]} name="Development Payouts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Revenue Category Breakdowns (Pie Chart) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Top Revenue Sources</h3>
              <p className="text-[11px] text-slate-500">Categorical division of client portfolio billings</p>
            </div>
          </div>
          <div className="h-[200px] flex items-center justify-center">
            {categoryChartData.length === 0 ? (
              <span className="text-xs text-slate-400">No project revenue recorded yet.</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => `₹${Number(val).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
            {categoryChartData.map((item, index) => {
              const pct = ((item.value / metrics.totalRevenue) * 100).toFixed(0);
              return (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="text-slate-650 truncate">{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-900 font-mono flex-shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Grid-span Chart 3: Net Profit Trend Area Graph */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Profit Trendline</h3>
              <p className="text-[11px] text-slate-500">Incremental view of Cambrian / IndiWebPros net profitmargins</p>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartTimelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={70} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Net Profit']} />
                <Area type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#profitGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Source Performance */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Lead Source Billings</h3>
              <p className="text-[11px] text-slate-500">Correlating revenues generated against marketing channels</p>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsChartData} layout="vertical" margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={10} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" fontSize={10} width={75} tickLine={false} />
                <Tooltip formatter={(val) => `₹${Number(val).toLocaleString()}`} />
                <Bar dataKey="value" fill="#4c99e0" radius={[0, 4, 4, 0]} name="Billing Yield" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Critical Action Items Drawer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pending Client Payments Panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Pending Accounts Receivable</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {state.projectRevenue.filter(p => p.pendingAmount > 0).length === 0 ? (
              <p className="p-4 text-xs text-slate-400 italic text-center">Perfect! No pending accounts receivable.</p>
            ) : (
              state.projectRevenue.filter(p => p.pendingAmount > 0).map(p => (
                <div key={p.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{p.projectName}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-slate-400 text-[10px]">
                      <span>Client: {p.clientName}</span>
                      <span>•</span>
                      <span>Target: {p.expectedCompletionDate}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-rose-600">₹{p.pendingAmount.toLocaleString('en-IN')}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded">Pending Payout</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Internship Completions Drawer */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Award className="h-4 w-4 text-blue-800" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Active Mentored Internships</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {state.internships.filter(i => i.certificateStatus === 'Pending').length === 0 ? (
              <p className="p-4 text-xs text-slate-400 italic text-center">Zero active internships in progress.</p>
            ) : (
              state.internships.filter(i => i.certificateStatus === 'Pending').map(i => (
                <div key={i.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{i.internName}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-slate-400 text-[10px]">
                      <span>{i.college} ({i.course})</span>
                      <span>•</span>
                      <span>Mentor: {i.mentor}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-700">{i.batch}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-sky-50 text-sky-800 rounded">Active</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Active Work Sprints (Founder Assigned Sprints) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-[#0f4c81]/5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-[#0f4c81]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Active Task Assignments (Founder Sprints)</h4>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-0.5 bg-[#0f4c81]/15 text-[#0f4c81] rounded-full">
            {(state.workAssignments || []).filter(w => w.status !== 'Completed').length} Pending Tasks
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-white">
          {/* Column 1: Critical/High Priority */}
          <div className="p-4 space-y-3">
            <h5 className="text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-rose-50 pb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-650 animate-pulse"></span>
              Critical & High Priority Sprints
            </h5>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {!(state.workAssignments || []).some(w => ['Critical', 'High'].includes(w.priority) && w.status !== 'Completed') ? (
                <p className="text-slate-400 italic text-[11px] text-center py-4">No critical/high pending tasks.</p>
              ) : (
                (state.workAssignments || [])
                  .filter(w => ['Critical', 'High'].includes(w.priority) && w.status !== 'Completed')
                  .map(w => (
                    <div key={w.id} className="p-2.5 bg-rose-50/40 rounded-lg border border-rose-100 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-800 truncate max-w-[150px]">{w.taskTitle}</span>
                        <span className="px-1 text-[9px] font-bold bg-rose-200 text-rose-800 rounded">{w.priority}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-1 line-clamp-1">{w.description}</p>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                        <span>Rep: <strong className="text-slate-700">{w.assignedTo}</strong></span>
                        <span>Due: <strong className="text-slate-700">{w.dueDate}</strong></span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Column 2: In Progress / Review Tasks */}
          <div className="p-4 space-y-3">
            <h5 className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-amber-50 pb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></span>
              Active Development (In Progress / Review)
            </h5>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {!(state.workAssignments || []).some(w => ['In Progress', 'Review'].includes(w.status)) ? (
                <p className="text-slate-400 italic text-[11px] text-center py-4">No tasks currently being actively built.</p>
              ) : (
                (state.workAssignments || [])
                  .filter(w => ['In Progress', 'Review'].includes(w.status))
                  .map(w => (
                    <div key={w.id} className="p-2.5 bg-amber-50/40 rounded-lg border border-amber-150 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 truncate max-w-[150px]">{w.taskTitle}</span>
                        <span className="px-1 text-[9px] font-bold bg-amber-200 text-amber-800 rounded">{w.status}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-1 line-clamp-1">{w.description}</p>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                        <span>Rep: <strong className="text-slate-700">{w.assignedTo}</strong></span>
                        <span>Est: <strong className="text-slate-700">{w.estimatedHours} hrs</strong></span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Column 3: Recently Completed Sprints */}
          <div className="p-4 space-y-3">
            <h5 className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-emerald-50 pb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Recently Completed Sprints
            </h5>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {!(state.workAssignments || []).some(w => w.status === 'Completed') ? (
                <p className="text-slate-400 italic text-[11px] text-center py-4">No completed tasks yet.</p>
              ) : (
                (state.workAssignments || [])
                  .filter(w => w.status === 'Completed')
                  .slice(0, 5)
                  .map(w => (
                    <div key={w.id} className="p-2.5 bg-emerald-50/30 rounded-lg border border-emerald-100 text-xs text-slate-500">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-850 truncate line-through max-w-[150px]">{w.taskTitle}</span>
                        <span className="px-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded">Done</span>
                      </div>
                      <p className="text-slate-450 text-[10px] mt-1 line-clamp-1">{w.description}</p>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                        <span>Rep: <strong>{w.assignedTo}</strong></span>
                        <span>By: <strong>{w.assignedBy}</strong></span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
