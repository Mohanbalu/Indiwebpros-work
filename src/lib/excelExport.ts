import * as XLSX from 'xlsx';
import { WorkbookState, ProjectRevenue, BusinessExpense, TeamContribution, CoFounderRevenueSharing } from '../types';

// Helper to extract "Month Year" (e.g. "June 2026") from a YYYY-MM-DD date string
export function getMonthYearFromDate(dateStr: string): string {
  if (!dateStr) return 'Uncategorized';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 2) return 'Uncategorized';
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return 'Uncategorized';
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[monthIndex]} ${year}`;
  } catch (e) {
    return 'Uncategorized';
  }
}

// Group all metrics for Profit & Loss dynamically
export interface MonthlySummaryPL {
  month: string;
  revenue: number;
  expenses: number;
  teamPayments: number;
  netProfit: number;
}

export function calculateMonthlyPL(state: WorkbookState): MonthlySummaryPL[] {
  const monthsSet = new Set<string>();

  // Collect all months from project revenues, contributions, and expenses
  state.projectRevenue.forEach(p => {
    monthsSet.add(getMonthYearFromDate(p.date));
  });
  state.teamContributions.forEach(t => {
    if (t.month) monthsSet.add(t.month);
  });
  state.businessExpenses.forEach(e => {
    monthsSet.add(getMonthYearFromDate(e.date));
  });

  const months = Array.from(monthsSet).filter(m => m !== 'Uncategorized');
  
  // Sort months chronologically
  const monthOrder: Record<string, number> = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
    'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
  };

  months.sort((a, b) => {
    const [aMonth, aYear] = a.split(' ');
    const [bMonth, bYear] = b.split(' ');
    if (aYear !== bYear) return aYear.localeCompare(bYear);
    return (monthOrder[aMonth] || 0) - (monthOrder[bMonth] || 0);
  });

  return months.map(m => {
    // Revenue
    const rev = state.projectRevenue
      .filter(p => getMonthYearFromDate(p.date) === m)
      .reduce((sum, p) => sum + p.revenue, 0);

    // Expenses
    const exp = state.businessExpenses
      .filter(e => getMonthYearFromDate(e.date) === m)
      .reduce((sum, e) => sum + e.amount, 0);

    // Team contributions
    const team = state.teamContributions
      .filter(t => t.month === m)
      .reduce((sum, t) => sum + (t.amountAllocated + t.bonus), 0);

    return {
      month: m,
      revenue: rev,
      expenses: exp,
      teamPayments: team,
      netProfit: rev - exp - team
    };
  });
}

export function exportWorkbookToExcel(state: WorkbookState) {
  const wb = XLSX.utils.book_new();

  // 1. SHEET: Team Contributions
  const teamRows = state.teamContributions.map((row, idx) => {
    const excelRowIdx = idx + 2; // Row 1 is header
    return {
      'Month': row.month,
      'Name': row.name,
      'Role': row.role,
      'Organization / Client': row.organizationClient,
      'Project Name': row.projectName,
      'Contribution Type': row.contributionType,
      'Hours Worked': row.hoursWorked,
      'Tasks Completed': row.tasksCompleted,
      'Amount Allocated (₹)': row.amountAllocated,
      'Bonus (₹)': row.bonus,
      'Total Amount (₹)': { t: 'n', v: row.amountAllocated + row.bonus, f: `I${excelRowIdx}+J${excelRowIdx}` },
      'Payment Status': row.paymentStatus,
      'Payment Date': row.paymentDate || 'N/A',
      'Remarks': row.remarks
    };
  });
  
  const wsTeam = XLSX.utils.json_to_sheet(teamRows);
  XLSX.utils.book_append_sheet(wb, wsTeam, 'Team Contributions');

  // 2. SHEET: Project Revenue
  const revRows = state.projectRevenue.map((row, idx) => {
    const excelRowIdx = idx + 2;
    return {
      'Date': row.date,
      'Client Name': row.clientName,
      'Organization': row.organization,
      'Project Name': row.projectName,
      'Project Category': row.projectCategory,
      'Lead Source': row.leadSource,
      'Revenue (₹)': row.revenue,
      'Amount Received (₹)': row.amountReceived,
      'Pending Amount (₹)': { t: 'n', v: row.revenue - row.amountReceived, f: `G${excelRowIdx}-H${excelRowIdx}` },
      'Payment Status': row.paymentStatus,
      'Expected Completion Date': row.expectedCompletionDate,
      'Remarks': row.remarks
    };
  });
  const wsRev = XLSX.utils.json_to_sheet(revRows);
  XLSX.utils.book_append_sheet(wb, wsRev, 'Project Revenue');

  // 3. SHEET: Business Expenses
  const expRows = state.businessExpenses.map(row => ({
    'Date': row.date,
    'Expense Category': row.expenseCategory,
    'Description': row.description,
    'Amount (₹)': row.amount,
    'Paid By': row.paidBy,
    'Project Linked': row.projectLinked,
    'Remarks': row.remarks
  }));
  const wsExp = XLSX.utils.json_to_sheet(expRows);
  XLSX.utils.book_append_sheet(wb, wsExp, 'Business Expenses');

  // 4. SHEET: Internship Management
  const internRows = state.internships.map(row => ({
    'Intern Name': row.internName,
    'College': row.college,
    'Course': row.course,
    'Start Date': row.startDate,
    'End Date': row.endDate,
    'Batch': row.batch,
    'Fee Paid (₹)': row.feePaid,
    'Certificate Status': row.certificateStatus,
    'Mentor': row.mentor,
    'Remarks': row.remarks
  }));
  const wsIntern = XLSX.utils.json_to_sheet(internRows);
  XLSX.utils.book_append_sheet(wb, wsIntern, 'Internship Management');

  // 5. SHEET: Co-Founder Revenue Sharing
  const founderRows = state.coFounderPayouts.map((row, idx) => {
    const excelRowIdx = idx + 2;
    return {
      'Month': row.month,
      'Name': row.name,
      'Ownership Percentage': row.ownershipPercentage + '%',
      'Profit Share (₹)': row.profitShare,
      'Amount Paid (₹)': row.amountPaid,
      'Pending Amount (₹)': { t: 'n', v: row.profitShare - row.amountPaid, f: `D${excelRowIdx}-E${excelRowIdx}` },
      'Status': row.status
    };
  });
  const wsFounder = XLSX.utils.json_to_sheet(founderRows);
  XLSX.utils.book_append_sheet(wb, wsFounder, 'Co-Founder Revenue Sharing');

  // 6. SHEET: Monthly Profit & Loss
  const plData = calculateMonthlyPL(state);
  const plRows = plData.map((row, idx) => {
    const excelRowIdx = idx + 2;
    return {
      'Month': row.month,
      'Total Revenue': row.revenue,
      'Total Expenses': row.expenses,
      'Team Payments': row.teamPayments,
      'Net Profit': { t: 'n', v: row.netProfit, f: `B${excelRowIdx}-C${excelRowIdx}-D${excelRowIdx}` }
    };
  });
  const wsPL = XLSX.utils.json_to_sheet(plRows);
  XLSX.utils.book_append_sheet(wb, wsPL, 'Monthly Profit & Loss');

  // 7. SHEET: Project Tracker
  const trackerRows = state.projectTracker.map(row => ({
    'Project ID': row.id,
    'Client': row.client,
    'Project Name': row.projectName,
    'Category': row.category,
    'Assigned To': row.assignedTo,
    'Start Date': row.startDate,
    'Deadline': row.deadline,
    'Status': row.status,
    'Project Value (₹)': row.projectValue,
    'Payment Status': row.paymentStatus,
    'Remarks': row.remarks
  }));
  const wsTracker = XLSX.utils.json_to_sheet(trackerRows);
  XLSX.utils.book_append_sheet(wb, wsTracker, 'Project Tracker');

  // 7.5. SHEET: Founder Work Assignments
  const assignmentRows = (state.workAssignments || []).map(row => ({
    'Task ID': row.id,
    'Task Title': row.taskTitle,
    'Description': row.description,
    'Assigned To': row.assignedTo,
    'Assigned By': row.assignedBy,
    'Priority': row.priority,
    'Status': row.status,
    'Start Date': row.startDate,
    'Due Date': row.dueDate,
    'Estimated Hours': row.estimatedHours,
    'Remarks': row.remarks
  }));
  const wsAssignments = XLSX.utils.json_to_sheet(assignmentRows);
  XLSX.utils.book_append_sheet(wb, wsAssignments, 'Founder Work Assignments');

  // 8. SHEET: Dashboard Summary (Values to make spreadsheet standalone robust)
  const totalRevSum = state.projectRevenue.reduce((sum, p) => sum + p.revenue, 0);
  const totalExpSum = state.businessExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalTeamSum = state.teamContributions.reduce((sum, t) => sum + (t.amountAllocated + t.bonus), 0);
  const netProfitSum = totalRevSum - totalExpSum - totalTeamSum;

  const dashboardRows = [
    { 'Financial Indicator': 'Total Revenue', 'Amount (₹)': totalRevSum, 'Formula / Reference': 'Sum of Project Revenue' },
    { 'Financial Indicator': 'Total Expenses', 'Amount (₹)': totalExpSum, 'Formula / Reference': 'Sum of Business Expenses' },
    { 'Financial Indicator': 'Total Team Payouts', 'Amount (₹)': totalTeamSum, 'Formula / Reference': 'Sum of Team Contributions' },
    { 'Financial Indicator': 'Calculated Net Profit', 'Amount (₹)': netProfitSum, 'Formula / Reference': 'Revenue - Expenses - Team Payments' },
    { 'Financial Indicator': 'Active Interns Count', 'Amount (₹)': state.internships.filter(i => i.certificateStatus === 'Pending').length, 'Formula / Reference': 'Internships (Pending Status)' },
    { 'Financial Indicator': 'Active Projects Tracked', 'Amount (₹)': state.projectTracker.filter(p => p.status !== 'Delivered' && p.status !== 'Completed').length, 'Formula / Reference': 'Tracker Status != Delivered/Completed' },
    { 'Financial Indicator': 'Pending Team Tasks', 'Amount (₹)': (state.workAssignments || []).filter(w => w.status !== 'Completed').length, 'Formula / Reference': 'Founder Work Assignments (Status != Completed)' }
  ];
  const wsDashboard = XLSX.utils.json_to_sheet(dashboardRows);
  XLSX.utils.book_append_sheet(wb, wsDashboard, 'Dashboard Summary');

  // Enable filters & layout tweaks on all sheets
  const sheets = [wsTeam, wsRev, wsExp, wsIntern, wsFounder, wsPL, wsTracker, wsAssignments, wsDashboard];
  sheets.forEach(ws => {
    // Add Auto filters (approximate selection of columns)
    const ref = ws['!ref'];
    if (ref) {
      const decoded = XLSX.utils.decode_range(ref);
      ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(decoded.e.c)}1` };
    }
  });

  // Write file out
  XLSX.writeFile(wb, 'Cambrian_IndiWebPros_Finance_Workbook.xlsx');
}
