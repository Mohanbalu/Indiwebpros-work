import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, Trash2, RotateCcw, TableProperties, LineChart, 
  Settings, Layers, TrendingUp, IndianRupee, Users, 
  HelpCircle, RefreshCw, FileSpreadsheet, Sparkles, Plus, Info,
  ExternalLink, AlertTriangle, X, Check, Copy, Globe, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import firebaseConfig from '../firebase-applet-config.json';

// Data modules
import { 
  WorkbookState, TeamContribution, ProjectCategory, LeadSource, 
  ProjectRevenue, ExpenseCategory, BusinessExpense, InternshipManagement, 
  CoFounderRevenueSharing, ProjectTracker, WorkAssignment 
} from './types';
import { INITIAL_WORKBOOK_STATE } from './data/mockData';
import { exportWorkbookToExcel, calculateMonthlyPL, getMonthYearFromDate } from './lib/excelExport';

// Sub components
import ExcelTable, { ColumnDefinition } from './components/ExcelTable';
import DashboardSheet from './components/DashboardSheet';

// Firebase modules
import { auth, db, googleAuthProvider, OperationType, handleFirestoreError } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEY = 'cambrian_workbook_state_v1';

export default function App() {
  // --- 1. CORE APplet STATE ---
  const [state, setState] = useState<WorkbookState>(INITIAL_WORKBOOK_STATE);

  // --- 1.5. FIREBASE AUTH & SYNC STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'error' | 'offline'>('offline');
  const [authError, setAuthError] = useState<{ code?: string; message: string; hostname: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Workbook custom branding states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempCompany, setTempCompany] = useState('');
  const [tempSystem, setTempSystem] = useState('');

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(window.location.hostname);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Load initial local storage data BEFORE Firebase overrides it
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setState(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to restore local workbook state:', e);
    }
  }, []);

  // Set up Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Cloud workbook when user logs in
  useEffect(() => {
    if (!currentUser) {
      setSyncState('offline');
      return;
    }

    const loadData = async () => {
      setSyncState('syncing');
      try {
        const userDocRef = doc(db, 'workbooks', currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const dbData = docSnap.data();
          const { userId, updatedAt, ...restData } = dbData;
          setState({
            teamContributions: restData.teamContributions || [],
            projectRevenue: restData.projectRevenue || [],
            businessExpenses: restData.businessExpenses || [],
            internships: restData.internships || [],
            coFounderPayouts: restData.coFounderPayouts || [],
            projectTracker: restData.projectTracker || [],
            workAssignments: restData.workAssignments || [],
            companyName: restData.companyName || 'Cambrian',
            systemName: restData.systemName || 'IndiWebPros'
          } as WorkbookState);
          setSyncState('synced');
        } else {
          // Store existing local state to Firestore as initial onboarding state
          await setDoc(userDocRef, {
            userId: currentUser.uid,
            teamContributions: state.teamContributions || [],
            projectRevenue: state.projectRevenue || [],
            businessExpenses: state.businessExpenses || [],
            internships: state.internships || [],
            coFounderPayouts: state.coFounderPayouts || [],
            projectTracker: state.projectTracker || [],
            workAssignments: state.workAssignments || [],
            companyName: state.companyName || 'Cambrian',
            systemName: state.systemName || 'IndiWebPros',
            updatedAt: new Date().toISOString()
          });
          setSyncState('synced');
        }
      } catch (err) {
        setSyncState('error');
        handleFirestoreError(err, OperationType.GET, `workbooks/${currentUser.uid}`);
      }
    };

    loadData();
  }, [currentUser]);

  // Debounced auto-save of state to Cloud/Local
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    if (!currentUser) return;

    const timer = setTimeout(async () => {
      setSyncState('syncing');
      try {
        const userDocRef = doc(db, 'workbooks', currentUser.uid);
        await setDoc(userDocRef, {
          userId: currentUser.uid,
          teamContributions: state.teamContributions || [],
          projectRevenue: state.projectRevenue || [],
          businessExpenses: state.businessExpenses || [],
          internships: state.internships || [],
          coFounderPayouts: state.coFounderPayouts || [],
          projectTracker: state.projectTracker || [],
          workAssignments: state.workAssignments || [],
          companyName: state.companyName || 'Cambrian',
          systemName: state.systemName || 'IndiWebPros',
          updatedAt: new Date().toISOString()
        });
        setSyncState('synced');
      } catch (err) {
        setSyncState('error');
        console.error('Failed to auto-sync to Firestore:', err);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [state, currentUser]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      setAuthError({
        code: err?.code,
        message: err?.message || String(err),
        hostname: window.location.hostname
      });
    }
  };

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out? Your cloud data remains safe, and you will continue in offline mode.')) {
      try {
        await signOut(auth);
        setState(INITIAL_WORKBOOK_STATE);
      } catch (err) {
        console.error('Sign Out Error:', err);
      }
    }
  };

  // Active sheet tracker (1 to 8)
  // 1: Team Contributions, 2: Project Revenue, 3: Business Expenses, 
  // 4: Internship Management, 5: Co-founder Payouts, 6: Monthly P&L (calculated/custom), 
  // 7: Project Tracker, 8: Interactive Dashboard
  const [activeSheet, setActiveSheet] = useState<number>(8); // Default to gorgeous dashboard summary

  // For informational help popup
  const [showHelp, setShowHelp] = useState(false);

  // --- 2. GLOBAL CONTROLS ---
  const openBrandingEditor = () => {
    setTempCompany(state.companyName || 'Cambrian');
    setTempSystem(state.systemName || 'IndiWebPros');
    setIsEditingTitle(true);
  };

  const handleSaveBranding = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tempCompany.trim() || !tempSystem.trim()) return;
    setState(prev => ({
      ...prev,
      companyName: tempCompany.trim(),
      systemName: tempSystem.trim()
    }));
    setIsEditingTitle(false);
  };

  const handleResetToDefault = () => {
    if (confirm('Are you sure you want to revert all sheets to the default Cambrian / IndiWebPros template? This will overwrite your current draft.')) {
      setState(INITIAL_WORKBOOK_STATE);
    }
  };

  const handleClearAll = () => {
    if (confirm('Clear entire workbook? All rows across all sheets will be permanently erased.')) {
      setState({
        teamContributions: [],
        projectRevenue: [],
        businessExpenses: [],
        internships: [],
        coFounderPayouts: [],
        projectTracker: [],
        workAssignments: [],
        companyName: state.companyName || 'Cambrian',
        systemName: state.systemName || 'IndiWebPros'
      });
    }
  };

  const triggerExcelExport = () => {
    exportWorkbookToExcel(state);
  };

  // --- 3. DYNAMIC CALCULATION ENGINES (FORMULAS) ---

  // Dynamic P&L calculation (Sheet 6) computed for visual display
  const dynamicPL = useMemo(() => {
    return calculateMonthlyPL(state);
  }, [state]);

  // Dynamic Co-founder profit share generator (helps keep Sheet 5 synchronized)
  // We check if Sheet 5 rows match the current months calculated in P&L, 
  // if yes, we can calculate/show the real-time profit share!
  const getDynamicFounderProfitShare = (fRow: CoFounderRevenueSharing): number => {
    const matchingMonthPL = dynamicPL.find(m => m.month === fRow.month);
    if (!matchingMonthPL) return fRow.profitShare; // Fallback to recorded value
    const calculatedShare = matchingMonthPL.netProfit * (fRow.ownershipPercentage / 100);
    return calculatedShare > 0 ? calculatedShare : 0;
  };

  // --- 4. SHEET CRUD ACTION HANDLERS ---
  
  // Sheet 1: Team contributions
  const addTeamrow = (newRow: Partial<TeamContribution>) => {
    const record: TeamContribution = {
      id: `TC-${Date.now().toString().slice(-4)}`,
      month: newRow.month || 'June 2026',
      name: newRow.name || 'Anonymous Developer',
      role: newRow.role || 'Contributor',
      organizationClient: newRow.organizationClient || 'Direct Client',
      projectName: newRow.projectName || 'Internal Development',
      contributionType: newRow.contributionType || 'Software Engineering',
      hoursWorked: Number(newRow.hoursWorked) || 0,
      tasksCompleted: newRow.tasksCompleted || 'Tasks detailed in sprint ticket',
      amountAllocated: Number(newRow.amountAllocated) || 0,
      bonus: Number(newRow.bonus) || 0,
      totalAmount: (Number(newRow.amountAllocated) || 0) + (Number(newRow.bonus) || 0),
      paymentStatus: (newRow.paymentStatus as any) || 'Pending',
      paymentDate: newRow.paymentDate || '',
      remarks: newRow.remarks || ''
    };
    setState(prev => ({
      ...prev,
      teamContributions: [record, ...prev.teamContributions]
    }));
  };

  const updateTeamrow = (id: string, updated: Partial<TeamContribution>) => {
    setState(prev => ({
      ...prev,
      teamContributions: prev.teamContributions.map(row => 
        row.id === id ? { 
          ...row, 
          ...updated,
          // Recalculate formula totalAmount in place
          totalAmount: (Number(updated.amountAllocated ?? row.amountAllocated) || 0) + (Number(updated.bonus ?? row.bonus) || 0)
        } : row
      )
    }));
  };

  const deleteTeamrow = (id: string) => {
    setState(prev => ({
      ...prev,
      teamContributions: prev.teamContributions.filter(r => r.id !== id)
    }));
  };

  // Sheet 2: Project Revenue
  const addProjectRevenue = (newRow: Partial<ProjectRevenue>) => {
    const record: ProjectRevenue = {
      id: `PR-${Date.now().toString().slice(-4)}`,
      date: newRow.date || new Date().toISOString().split('T')[0],
      clientName: newRow.clientName || 'Unspecified Client',
      organization: newRow.organization || 'Unspecified Organization',
      projectName: newRow.projectName || 'New Technical Contract',
      projectCategory: (newRow.projectCategory as ProjectCategory) || 'Website Development',
      leadSource: (newRow.leadSource as LeadSource) || 'Website',
      revenue: Number(newRow.revenue) || 0,
      amountReceived: Number(newRow.amountReceived) || 0,
      pendingAmount: (Number(newRow.revenue) || 0) - (Number(newRow.amountReceived) || 0),
      paymentStatus: (newRow.paymentStatus as any) || 'Pending',
      expectedCompletionDate: newRow.expectedCompletionDate || '2026-06-30',
      remarks: newRow.remarks || ''
    };
    setState(prev => ({
      ...prev,
      projectRevenue: [record, ...prev.projectRevenue]
    }));
  };

  const updateProjectRevenue = (id: string, updated: Partial<ProjectRevenue>) => {
    setState(prev => ({
      ...prev,
      projectRevenue: prev.projectRevenue.map(row => 
        row.id === id ? {
          ...row,
          ...updated,
          pendingAmount: (Number(updated.revenue ?? row.revenue) || 0) - (Number(updated.amountReceived ?? row.amountReceived) || 0)
        } : row
      )
    }));
  };

  const deleteProjectRevenue = (id: string) => {
    setState(prev => ({
      ...prev,
      projectRevenue: prev.projectRevenue.filter(r => r.id !== id)
    }));
  };

  // Sheet 3: Business Expenses
  const addExpense = (newRow: Partial<BusinessExpense>) => {
    const record: BusinessExpense = {
      id: `BE-${Date.now().toString().slice(-4)}`,
      date: newRow.date || new Date().toISOString().split('T')[0],
      expenseCategory: (newRow.expenseCategory as ExpenseCategory) || 'Hosting',
      description: newRow.description || 'Acquisition of business resources',
      amount: Number(newRow.amount) || 0,
      paidBy: newRow.paidBy || 'Cambrian Office Fund',
      projectLinked: newRow.projectLinked || 'Administrative',
      remarks: newRow.remarks || ''
    };
    setState(prev => ({
      ...prev,
      businessExpenses: [record, ...prev.businessExpenses]
    }));
  };

  const updateExpense = (id: string, updated: Partial<BusinessExpense>) => {
    setState(prev => ({
      ...prev,
      businessExpenses: prev.businessExpenses.map(row => 
        row.id === id ? { ...row, ...updated } : row
      )
    }));
  };

  const deleteExpense = (id: string) => {
    setState(prev => ({
      ...prev,
      businessExpenses: prev.businessExpenses.filter(r => r.id !== id)
    }));
  };

  // Sheet 4: Internship Management
  const addInternship = (newRow: Partial<InternshipManagement>) => {
    const record: InternshipManagement = {
      id: `INT-${Date.now().toString().slice(-4)}`,
      internName: newRow.internName || 'Fresh Intern',
      college: newRow.college || 'Engineering Institute',
      course: newRow.course || 'B.Tech CSE',
      startDate: newRow.startDate || '2026-06-01',
      endDate: newRow.endDate || '2026-08-01',
      batch: newRow.batch || 'Summer Batch B',
      feePaid: Number(newRow.feePaid) || 0,
      certificateStatus: (newRow.certificateStatus as any) || 'Pending',
      mentor: newRow.mentor || 'Dr. Aarav Mehta',
      remarks: newRow.remarks || ''
    };
    setState(prev => ({
      ...prev,
      internships: [record, ...prev.internships]
    }));
  };

  const updateInternship = (id: string, updated: Partial<InternshipManagement>) => {
    setState(prev => ({
      ...prev,
      internships: prev.internships.map(row => 
        row.id === id ? { ...row, ...updated } : row
      )
    }));
  };

  const deleteInternship = (id: string) => {
    setState(prev => ({
      ...prev,
      internships: prev.internships.filter(r => r.id !== id)
    }));
  };

  // Sheet 5: Co-Founder revenue sharing
  const addCoFounderPayout = (newRow: Partial<CoFounderRevenueSharing>) => {
    const record: CoFounderRevenueSharing = {
      id: `CO-${Date.now().toString().slice(-4)}`,
      month: newRow.month || 'June 2026',
      name: newRow.name || 'Founder',
      ownershipPercentage: Number(newRow.ownershipPercentage) || 50,
      profitShare: Number(newRow.profitShare) || 0,
      amountPaid: Number(newRow.amountPaid) || 0,
      pendingAmount: (Number(newRow.profitShare) || 0) - (Number(newRow.amountPaid) || 0),
      status: (newRow.status as any) || 'Pending'
    };
    setState(prev => ({
      ...prev,
      coFounderPayouts: [record, ...prev.coFounderPayouts]
    }));
  };

  const updateCoFounderPayout = (id: string, updated: Partial<CoFounderRevenueSharing>) => {
    setState(prev => ({
      ...prev,
      coFounderPayouts: prev.coFounderPayouts.map(row => {
        if (row.id !== id) return row;
        const mergedRow = { ...row, ...updated };
        return {
          ...mergedRow,
          pendingAmount: (Number(mergedRow.profitShare) || 0) - (Number(mergedRow.amountPaid) || 0)
        };
      })
    }));
  };

  const deleteCoFounderPayout = (id: string) => {
    setState(prev => ({
      ...prev,
      coFounderPayouts: prev.coFounderPayouts.filter(r => r.id !== id)
    }));
  };

  // Sheet 7: Project Tracker
  const addProjectTracker = (newRow: Partial<ProjectTracker>) => {
    const record: ProjectTracker = {
      id: newRow.id || `PROJ-${Date.now().toString().slice(-3)}`,
      client: newRow.client || 'Client',
      projectName: newRow.projectName || 'New Delivery Pipeline',
      category: (newRow.category as ProjectCategory) || 'Website Development',
      assignedTo: newRow.assignedTo || 'Lead Dev',
      startDate: newRow.startDate || '2026-06-01',
      deadline: newRow.deadline || '2026-07-31',
      status: (newRow.status as any) || 'Planning',
      projectValue: Number(newRow.projectValue) || 0,
      paymentStatus: (newRow.paymentStatus as any) || 'Pending',
      remarks: newRow.remarks || ''
    };
    setState(prev => ({
      ...prev,
      projectTracker: [record, ...prev.projectTracker]
    }));
  };

  const updateProjectTracker = (id: string, updated: Partial<ProjectTracker>) => {
    setState(prev => ({
      ...prev,
      projectTracker: prev.projectTracker.map(row => 
        row.id === id ? { ...row, ...updated } : row
      )
    }));
  };

  const deleteProjectTracker = (id: string) => {
    setState(prev => ({
      ...prev,
      projectTracker: prev.projectTracker.filter(r => r.id !== id)
    }));
  };

  // Founder Work Assignments CRUD handlers
  const addWorkAssignment = (newRow: Partial<WorkAssignment>) => {
    const record: WorkAssignment = {
      id: `TASK-${Date.now().toString().slice(-4)}`,
      taskTitle: newRow.taskTitle || 'New Work Assignment',
      description: newRow.description || 'Sprint task requirements details',
      assignedTo: newRow.assignedTo || 'Unassigned Student/Dev',
      assignedBy: newRow.assignedBy || 'Founder',
      priority: (newRow.priority as any) || 'Medium',
      status: (newRow.status as any) || 'Not Started',
      startDate: newRow.startDate || new Date().toISOString().split('T')[0],
      dueDate: newRow.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedHours: Number(newRow.estimatedHours) || 0,
      remarks: newRow.remarks || ''
    };
    setState(prev => ({
      ...prev,
      workAssignments: [record, ...(prev.workAssignments || [])]
    }));
  };

  const updateWorkAssignment = (id: string, updated: Partial<WorkAssignment>) => {
    setState(prev => ({
      ...prev,
      workAssignments: (prev.workAssignments || []).map(row => 
        row.id === id ? { ...row, ...updated } : row
      )
    }));
  };

  const deleteWorkAssignment = (id: string) => {
    setState(prev => ({
      ...prev,
      workAssignments: (prev.workAssignments || []).filter(r => r.id !== id)
    }));
  };

  // --- 5. DEFINE TABLE COLUMNS FOR ALL DATA SHEETS ---

  const teamColumns: ColumnDefinition<TeamContribution>[] = [
    { key: 'month', header: 'Month', type: 'select', selectOptions: ['June 2026', 'May 2026', 'April 2026', 'March 2026'] },
    { key: 'name', header: 'Name', type: 'text', placeholder: 'e.g. Dr. Aarav Mehta' },
    { key: 'role', header: 'Role', type: 'text', placeholder: 'e.g. Lead AI Specialist' },
    { key: 'organizationClient', header: 'Organization Client', type: 'text', placeholder: 'e.g. Cambrian Labs' },
    { key: 'projectName', header: 'Project Name', type: 'text', placeholder: 'e.g. Diagnostic Assistant' },
    { key: 'contributionType', header: 'Contribution Type', type: 'text', placeholder: 'e.g. LLM fine-tuning' },
    { key: 'hoursWorked', header: 'Hours Worked', type: 'number', placeholder: 'e.g. 120' },
    { key: 'tasksCompleted', header: 'Tasks Completed', type: 'text', placeholder: 'e.g. Completed fine-tuning pipeline' },
    { key: 'amountAllocated', header: 'Allocated (₹)', type: 'number', isCurrency: true, placeholder: 'e.g. 75000' },
    { key: 'bonus', header: 'Bonus (₹)', type: 'number', isCurrency: true, placeholder: 'e.g. 10000' },
    { 
      key: 'totalAmount', 
      header: 'Total Amount (₹)', 
      type: 'formula', 
      isCurrency: true,
      isCalculated: true,
      calculateFormula: (row) => row.amountAllocated + row.bonus 
    },
    { key: 'paymentStatus', header: 'Payment Status', type: 'select', selectOptions: ['Paid', 'Pending', 'Partial'] },
    { key: 'paymentDate', header: 'Payment Date', type: 'date' },
    { key: 'remarks', header: 'Remarks', type: 'text' },
    { key: 'actions', header: 'Actions', type: 'text' }
  ];

  const revenueColumns: ColumnDefinition<ProjectRevenue>[] = [
    { key: 'date', header: 'Date', type: 'date' },
    { key: 'clientName', header: 'Client Name', type: 'text', placeholder: 'e.g. Dr. Anand' },
    { key: 'organization', header: 'Organization', type: 'text', placeholder: 'e.g. IIT Madras' },
    { key: 'projectName', header: 'Project Name', type: 'text', placeholder: 'e.g. Neural Style Transfer' },
    { 
      key: 'projectCategory', 
      header: 'Category', 
      type: 'select', 
      selectOptions: ['Website Development', 'AI Project', 'Academic Project', 'Research Paper', 'Internship Program', 'CRM System', 'Mobile App', 'Other'] 
    },
    { 
      key: 'leadSource', 
      header: 'Lead Source', 
      type: 'select', 
      selectOptions: ['Instagram', 'LinkedIn', 'WhatsApp', 'Referral', 'Website', 'Direct Client', 'Other'] 
    },
    { key: 'revenue', header: 'Revenue (₹)', type: 'number', isCurrency: true, placeholder: 'e.g. 150000' },
    { key: 'amountReceived', header: 'Received (₹)', type: 'number', isCurrency: true, placeholder: 'e.g. 90000' },
    { 
      key: 'pendingAmount', 
      header: 'Pending (₹)', 
      type: 'formula', 
      isCurrency: true,
      isCalculated: true,
      calculateFormula: (row) => row.revenue - row.amountReceived 
    },
    { key: 'paymentStatus', header: 'Payment Status', type: 'select', selectOptions: ['Received', 'Partial', 'Pending'] },
    { key: 'expectedCompletionDate', header: 'Expected Completion', type: 'date' },
    { key: 'remarks', header: 'Remarks', type: 'text' },
    { key: 'actions', header: 'Actions', type: 'text' }
  ];

  const expenseColumns: ColumnDefinition<BusinessExpense>[] = [
    { key: 'date', header: 'Date', type: 'date' },
    { 
      key: 'expenseCategory', 
      header: 'Category', 
      type: 'select', 
      selectOptions: ['Hosting', 'Domain', 'Marketing', 'Software Subscription', 'Salaries', 'Freelancer Payment', 'Internet', 'Office', 'Miscellaneous'] 
    },
    { key: 'description', header: 'Description', type: 'text', placeholder: 'e.g. Vercel hosting bill' },
    { key: 'amount', header: 'Amount (₹)', type: 'number', isCurrency: true, placeholder: 'e.g. 4500' },
    { key: 'paidBy', header: 'Paid By', type: 'text', placeholder: 'e.g. Co-Founder A' },
    { key: 'projectLinked', header: 'Project Linked', type: 'text', placeholder: 'e.g. Medical AI Assistant' },
    { key: 'remarks', header: 'Remarks', type: 'text' },
    { key: 'actions', header: 'Actions', type: 'text' }
  ];

  const internshipColumns: ColumnDefinition<InternshipManagement>[] = [
    { key: 'internName', header: 'Intern Name', type: 'text', placeholder: 'e.g. Rajesh Kumar' },
    { key: 'college', header: 'College', type: 'text', placeholder: 'e.g. VIT Vellore' },
    { key: 'course', header: 'Course', type: 'text', placeholder: 'e.g. B.Tech Computer Science' },
    { key: 'startDate', header: 'Start Date', type: 'date' },
    { key: 'endDate', header: 'End Date', type: 'date' },
    { key: 'batch', header: 'Batch', type: 'text', placeholder: 'e.g. Summer Batch A' },
    { key: 'feePaid', header: 'Fee Paid (₹)', type: 'number', isCurrency: true, placeholder: 'e.g. 15000' },
    { key: 'certificateStatus', header: 'Cert Status', type: 'select', selectOptions: ['Issued', 'Pending'] },
    { key: 'mentor', header: 'Mentor Assigned', type: 'text', placeholder: 'e.g. Dr. Aarav' },
    { key: 'remarks', header: 'Remarks', type: 'text' },
    { key: 'actions', header: 'Actions', type: 'text' }
  ];

  const cofounderColumns: ColumnDefinition<CoFounderRevenueSharing>[] = [
    { key: 'month', header: 'Month', type: 'select', selectOptions: ['June 2026', 'May 2026', 'April 2026', 'March 2026'] },
    { key: 'name', header: 'Name', type: 'text', placeholder: 'e.g. Anshul Sharma' },
    { key: 'ownershipPercentage', header: 'Ownership %', type: 'number', placeholder: 'e.g. 50' },
    { 
      key: 'profitShare', 
      header: 'Profit Share (₹)', 
      type: 'formula', // can also be typed in manually since we made a formula option
      isCurrency: true,
      isCalculated: true,
      calculateFormula: (row) => {
        // Find matching month in dynamically calculated profits
        const matchingPL = dynamicPL.find(m => m.month === row.month);
        if (!matchingPL) return row.profitShare;
        return Math.round(matchingPL.netProfit * (row.ownershipPercentage / 100));
      }
    },
    { key: 'amountPaid', header: 'Amount Paid (₹)', type: 'number', isCurrency: true, placeholder: 'e.g. 100000' },
    { 
      key: 'pendingAmount', 
      header: 'Pending Share (₹)', 
      type: 'formula', 
      isCurrency: true,
      isCalculated: true,
      calculateFormula: (row) => {
        // Resolve dynamic profit share first
        const matchingPL = dynamicPL.find(m => m.month === row.month);
        const resolvedProfitShare = matchingPL 
          ? Math.round(matchingPL.netProfit * (row.ownershipPercentage / 100))
          : row.profitShare;
        return Math.max(0, resolvedProfitShare - row.amountPaid);
      }
    },
    { key: 'status', header: 'Payout Status', type: 'select', selectOptions: ['Paid', 'Partial', 'Pending'] },
    { key: 'actions', header: 'Actions', type: 'text' }
  ];

  const trackerColumns: ColumnDefinition<ProjectTracker>[] = [
    { key: 'id', header: 'Project ID', type: 'text', placeholder: 'e.g. PROJ-101' },
    { key: 'client', header: 'Client Name', type: 'text', placeholder: 'e.g. Vanguard Health' },
    { key: 'projectName', header: 'Project Name', type: 'text', placeholder: 'e.g. Diagnostic Assistant' },
    { 
      key: 'category', 
      header: 'Category', 
      type: 'select', 
      selectOptions: ['Website Development', 'AI Project', 'Academic Project', 'Research Paper', 'Internship Program', 'CRM System', 'Mobile App', 'Other'] 
    },
    { key: 'assignedTo', header: 'Assigned To', type: 'text', placeholder: 'e.g. Dr. Aarav Mehta' },
    { key: 'startDate', header: 'Start Date', type: 'date' },
    { key: 'deadline', header: 'Deadline', type: 'date' },
    { key: 'status', header: 'Tracker Status', type: 'select', selectOptions: ['Planning', 'In Progress', 'Testing', 'Completed', 'Delivered'] },
    { key: 'projectValue', header: 'Project Value (₹)', type: 'number', isCurrency: true, placeholder: 'e.g. 350000' },
    { key: 'paymentStatus', header: 'Payment Status', type: 'select', selectOptions: ['Received', 'Partial', 'Pending'] },
    { key: 'remarks', header: 'Remarks', type: 'text' },
    { key: 'actions', header: 'Actions', type: 'text' }
  ];

  const assignmentColumns: ColumnDefinition<WorkAssignment>[] = [
    { key: 'id', header: 'Task ID', type: 'text', placeholder: 'e.g. TASK-1001' },
    { key: 'taskTitle', header: 'Task Title', type: 'text', placeholder: 'e.g. LLM Integration Proof-of-Concept' },
    { key: 'description', header: 'Description', type: 'text', placeholder: 'e.g. Implement pipeline fine-tuning flow' },
    { key: 'assignedTo', header: 'Assigned To', type: 'text', placeholder: 'e.g. Student intern or dev name' },
    { key: 'assignedBy', header: 'Assigned By', type: 'text', placeholder: 'e.g. Founder Aarav' },
    { 
      key: 'priority', 
      header: 'Priority', 
      type: 'select', 
      selectOptions: ['Low', 'Medium', 'High', 'Critical'] 
    },
    { 
      key: 'status', 
      header: 'Task Status', 
      type: 'select', 
      selectOptions: ['Not Started', 'In Progress', 'Review', 'Completed', 'Blocked'] 
    },
    { key: 'startDate', header: 'Start Date', type: 'date' },
    { key: 'dueDate', header: 'Due Date', type: 'date' },
    { key: 'estimatedHours', header: 'Est. Hours', type: 'number', placeholder: 'e.g. 15' },
    { key: 'remarks', header: 'Remarks', type: 'text' },
    { key: 'actions', header: 'Actions', type: 'text' }
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none antialiased">
      
      {/* 1. APP NAVBAR TOP */}
      <nav className="bg-white border-b border-slate-200/85 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-14">
            
            {/* Branding Hub */}
            <div 
              onClick={openBrandingEditor}
              className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 py-1 px-1.5 rounded-xl transition group/brand"
              title="Click to rename workbook branding"
            >
              <div className="h-9 w-9 bg-[#0f4c81] rounded-xl flex items-center justify-center shadow-sm group-hover/brand:bg-blue-700 transition">
                <FileSpreadsheet className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-slate-800 tracking-tight">
                    {state.companyName || 'Cambrian'}
                  </span>
                  <span className="text-slate-350 text-xs">/</span>
                  <span className="text-xs font-bold text-slate-550 italic font-mono bg-slate-100 px-1 py-0.5 rounded group-hover/brand:bg-slate-200 transition">
                    {state.systemName || 'IndiWebPros'}
                  </span>
                  <Edit3 className="h-3 w-3 text-slate-400 opacity-0 group-hover/brand:opacity-100 transition" />
                </div>
                <p className="text-[10px] text-slate-450">Financial Workbook Manager</p>
              </div>
            </div>

            {/* Quick Actions toolbars */}
            <div className="flex items-center gap-2">
              {/* Cloud Sync Status & User Profile */}
              {isAuthLoading ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-xs font-medium border border-slate-250">
                  <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                  <span className="hidden sm:inline">Loading Auth...</span>
                </div>
              ) : currentUser ? (
                <div className="flex items-center gap-2">
                  {/* Status Indicator */}
                  <div 
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                      syncState === 'synced' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      syncState === 'syncing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      syncState === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                    title={
                      syncState === 'synced' ? 'All changes saved to Google Firebase Cloud' :
                      syncState === 'syncing' ? 'Syncing changes with Google Firebase Cloud...' :
                      syncState === 'error' ? 'Error syncing. Check network or permissions' :
                      'Working offline'
                    }
                  >
                    <RefreshCw className={`h-3 w-3 ${syncState === 'syncing' ? 'animate-spin text-blue-600' : syncState === 'synced' ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span className="hidden md:inline capitalize">{syncState}</span>
                  </div>

                  {/* Profile Dropdown */}
                  <div className="relative group/profile">
                    <button className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-50 transition border border-transparent hover:border-slate-200 cursor-pointer">
                      {currentUser.photoURL ? (
                        <img 
                          src={currentUser.photoURL} 
                          alt={currentUser.displayName || 'Profile'} 
                          className="h-6.5 w-6.5 rounded-full object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-6.5 w-6.5 rounded-full bg-slate-200 text-slate-705 flex items-center justify-center text-xs font-bold font-mono">
                          {currentUser.displayName?.[0] || currentUser.email?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="text-xs font-medium text-slate-700 max-w-[80px] truncate hidden lg:inline">
                        {currentUser.displayName || currentUser.email}
                      </span>
                    </button>
                    {/* User profile action popover */}
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-2 w-52 text-xs text-slate-700 hidden group-hover/profile:block z-50">
                      <div className="px-3 pb-2 mb-2 border-b border-slate-100">
                        <p className="font-bold text-slate-800 truncate">{currentUser.displayName || 'Authorized User'}</p>
                        <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 font-medium transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Sign Out of Cloud
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-700 to-[#0f4c81] hover:from-blue-800 hover:to-[#0c3e6a] text-white rounded-lg text-xs font-bold tracking-wide transition shadow-xs cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Use Firebase Sync</span>
                </button>
              )}

              <button
                onClick={triggerExcelExport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f4c81] hover:bg-[#0c3e6a] text-white rounded-lg text-xs font-bold tracking-wide transition shadow-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 animate-bounce" style={{ animationDuration: '3s' }} />
                <span>Download XLSWorkbook</span>
              </button>

              <button
                onClick={() => setShowHelp(!showHelp)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-550 transition cursor-pointer"
                title="Help Guide"
              >
                <HelpCircle className="h-4.5 w-4.5" />
              </button>

              {/* Utility Dropdown list */}
              <div className="relative group">
                <button
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-550 transition cursor-pointer"
                  title="Spreadsheet Utilities"
                >
                  <Settings className="h-4.5 w-4.5" />
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 w-56 text-xs text-slate-700 hidden group-hover:block z-50">
                  <button
                    onClick={openBrandingEditor}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-semibold cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#0f4c81]" />
                    Change Branding Title
                  </button>
                  <button
                    onClick={handleResetToDefault}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-blue-600 font-medium border-t border-slate-100 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to Blank Template
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-rose-600 font-medium border-t border-slate-100 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear All Sheets (Wipe Data)
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </nav>

      {/* Quick Help Drawout */}
      {showHelp && (
        <div className="bg-blue-50 border-b border-blue-200/80 p-4 text-xs text-[#0f4c81]/90 transition">
          <div className="max-w-7xl mx-auto flex items-start gap-3 relative">
            <Info className="h-5 w-5 text-[#0f4c81] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Excel-Compatible Formulas & Integrity:</p>
              <p className="leading-relaxed">
                All sheets are fully reactive. Updating data in <strong>Project Revenue</strong>, <strong>Contributions</strong>, or <strong>Expenses</strong> immediately updates the <strong>Monthly Profit & Loss</strong> (Sheet 6) and <strong>Co-Founder Profit Shares</strong> (Sheet 5). 
                Downloading the spreadsheet outputs a physical <strong>Excel (.xlsx)</strong> file containing genuine Excel formulas so they re-trigger natively inside popular processors.
              </p>
            </div>
            <button 
              onClick={() => setShowHelp(false)} 
              className="absolute right-0 top-0 text-[#0f4c81]/60 hover:text-[#0f4c81] font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 2. MAIN HUB WORKSPACE LAYOUT */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">

        {/* Sync Onboarding & Status Call-out */}
        {!currentUser && !isAuthLoading && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 flex-shrink-0 mt-0.5">
                <Info className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-amber-900">Working Offline (Makeup/Mock Values Disabled) • Safe to draft</p>
                <p className="text-amber-700 mt-0.5 font-light leading-relaxed">
                  All make-up rows have been permanently removed. To connect to our online cloud service and synchronize your spreadsheet in real-time, please sign in.
                </p>
              </div>
            </div>
            <button
              onClick={handleGoogleSignIn}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold rounded-lg transition text-xs shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer self-start md:self-auto"
            >
              <Users className="h-3.5 w-3.5" />
              Sign In with Google
            </button>
          </div>
        )}

        {/* Quick Summary Strip (Sticky metrics for immediate sanity checks) */}
        <div className="bg-white rounded-xl py-3 px-5 border border-slate-200/80 flex items-center justify-between flex-wrap gap-4 shadow-2xs">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0f4c81]" />
            <span className="text-xs font-bold text-slate-700 font-mono">LIVE AGENCY RUN RATE</span>
          </div>
          <div className="flex items-center gap-6 text-xs flex-wrap font-mono">
            <div>
              <span className="text-slate-400">Total Billings: </span>
              <strong className="text-slate-800">
                ₹{state.projectRevenue.reduce((sum, p) => sum + p.revenue, 0).toLocaleString('en-IN')}
              </strong>
            </div>
            <div>
              <span className="text-slate-400">Total Expenses: </span>
              <strong className="text-slate-800">
                ₹{state.businessExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-IN')}
              </strong>
            </div>
            <div>
              <span className="text-slate-400">Total Dev Payouts: </span>
              <strong className="text-slate-800">
                ₹{state.teamContributions.reduce((sum, t) => sum + (t.amountAllocated + t.bonus), 0).toLocaleString('en-IN')}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 font-bold">Unpaved Profits: </span>
              <strong className="text-emerald-600 font-bold">
                ₹{(
                  state.projectRevenue.reduce((sum, p) => sum + p.revenue, 0) -
                  state.businessExpenses.reduce((sum, e) => sum + e.amount, 0) -
                  state.teamContributions.reduce((sum, t) => sum + (t.amountAllocated + t.bonus), 0)
                ).toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        </div>

        {/* Active Sheet Screen Container with swap effect */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSheet}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {/* Sheet 8: Dashboard */}
            {activeSheet === 8 && <DashboardSheet state={state} />}

            {/* Sheet 1: Team Contributions */}
            {activeSheet === 1 && (
              <ExcelTable
                title="Sheet 1: Team Contributions"
                description="Monitor monthly tasks completed, hours rendered, and trigger payments with calculated bonuses."
                data={state.teamContributions}
                columns={teamColumns}
                onAdd={addTeamrow}
                onUpdate={updateTeamrow}
                onDelete={deleteTeamrow}
                onReset={handleResetToDefault}
                defaultNewRecord={{
                  month: 'June 2026',
                  name: '',
                  role: '',
                  organizationClient: '',
                  projectName: '',
                  contributionType: '',
                  hoursWorked: 0,
                  tasksCompleted: '',
                  amountAllocated: 0,
                  bonus: 0,
                  paymentStatus: 'Pending',
                  paymentDate: '',
                  remarks: ''
                }}
              />
            )}

            {/* Sheet 2: Project Revenues */}
            {activeSheet === 2 && (
              <ExcelTable
                title="Sheet 2: Project Revenue"
                description="List contracted agreements, client sources, and calculate outstanding accounts receivables."
                data={state.projectRevenue}
                columns={revenueColumns}
                onAdd={addProjectRevenue}
                onUpdate={updateProjectRevenue}
                onDelete={deleteProjectRevenue}
                onReset={handleResetToDefault}
                defaultNewRecord={{
                  date: new Date().toISOString().split('T')[0],
                  clientName: '',
                  organization: '',
                  projectName: '',
                  projectCategory: 'Website Development',
                  leadSource: 'LinkedIn',
                  revenue: 0,
                  amountReceived: 0,
                  paymentStatus: 'Pending',
                  expectedCompletionDate: '',
                  remarks: ''
                }}
              />
            )}

            {/* Sheet 3: Business Expenses */}
            {activeSheet === 3 && (
              <ExcelTable
                title="Sheet 3: Business Expenses"
                description="Document operating expenses like AWS / Vercel cloud hosting, Figma memberships, domain logs."
                data={state.businessExpenses}
                columns={expenseColumns}
                onAdd={addExpense}
                onUpdate={updateExpense}
                onDelete={deleteExpense}
                onReset={handleResetToDefault}
                defaultNewRecord={{
                  date: new Date().toISOString().split('T')[0],
                  expenseCategory: 'Hosting',
                  description: '',
                  amount: 0,
                  paidBy: '',
                  projectLinked: '',
                  remarks: ''
                }}
              />
            )}

            {/* Sheet 4: Internship Management */}
            {activeSheet === 4 && (
              <ExcelTable
                title="Sheet 4: Internship Management"
                description="Record upcoming dev cohorts, aggregate collected registration fees, and update verification codes."
                data={state.internships}
                columns={internshipColumns}
                onAdd={addInternship}
                onUpdate={updateInternship}
                onDelete={deleteInternship}
                onReset={handleResetToDefault}
                defaultNewRecord={{
                  internName: '',
                  college: '',
                  course: '',
                  startDate: '',
                  endDate: '',
                  batch: 'Summer Batch A',
                  feePaid: 0,
                  certificateStatus: 'Pending',
                  mentor: '',
                  remarks: ''
                }}
              />
            )}

            {/* Sheet 5: Co-Founder Payouts */}
            {activeSheet === 5 && (
              <ExcelTable
                title="Sheet 5: Co-Founder Revenue Sharing"
                description="Track equity allocations and profit percentages dynamically driven by real-time agency net profit coefficients."
                data={state.coFounderPayouts}
                columns={cofounderColumns}
                onAdd={addCoFounderPayout}
                onUpdate={updateCoFounderPayout}
                onDelete={deleteCoFounderPayout}
                onReset={handleResetToDefault}
                defaultNewRecord={{
                  month: 'June 2026',
                  name: '',
                  ownershipPercentage: 50,
                  profitShare: 0,
                  amountPaid: 0,
                  status: 'Pending'
                }}
              />
            )}

            {/* Sheet 6: Monthly Profit & Loss */}
            {activeSheet === 6 && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Sheet 6: Monthly Profit & Loss Ledger</h2>
                      <p className="text-xs text-slate-500">
                        Dynamic summary row representation mapping full-accrual corporate profits. 
                        Calculated as: <strong>Net Profit = Revenue - Expenses - Team Payments</strong>.
                      </p>
                    </div>
                    <span className="p-1 px-2.5 bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-bold font-mono rounded">
                      AUTO GENERATED FORMULAS
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left border-collapse table-auto text-xs text-slate-700">
                      <thead>
                        <tr className="bg-slate-800 text-white font-semibold">
                          <th className="p-3 border-r border-slate-750">Month Name</th>
                          <th className="p-3 border-r border-slate-750 text-right">Gross Projected Revenue (₹)</th>
                          <th className="p-3 border-r border-slate-750 text-right">Operating Expenses (₹)</th>
                          <th className="p-3 border-r border-slate-750 text-right">Team Payouts (₹)</th>
                          <th className="p-3 text-right">Net Profit Outcome (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {dynamicPL.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400 font-medium italic">
                              Add revenue or expense transactions in respective sheets to render chronological statement.
                            </td>
                          </tr>
                        ) : (
                          dynamicPL.map((row) => (
                            <tr key={row.month} className="hover:bg-slate-50 transition font-medium">
                              <td className="p-3 border-r border-slate-200 font-bold text-slate-800">{row.month}</td>
                              <td className="p-3 border-r border-slate-200 text-right font-mono">₹{row.revenue.toLocaleString('en-IN')}</td>
                              <td className="p-3 border-r border-slate-200 text-right font-mono">₹{row.expenses.toLocaleString('en-IN')}</td>
                              <td className="p-3 border-r border-slate-200 text-right font-mono">₹{row.teamPayments.toLocaleString('en-IN')}</td>
                              <td className={`p-3 text-right font-bold font-mono ${row.netProfit >= 0 ? 'text-emerald-700 bg-emerald-50/15' : 'text-rose-650'}`}>
                                ₹{row.netProfit.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))
                        )}
                        {/* Dynamic Sum columns */}
                        {dynamicPL.length > 0 && (
                          <tr className="bg-slate-100 text-slate-900 border-t-2 border-slate-300 font-bold">
                            <td className="p-3 border-r border-slate-200 text-left uppercase">ANNUAL SUMMARY</td>
                            <td className="p-3 border-r border-slate-200 text-right font-mono">
                              ₹{dynamicPL.reduce((sum, r) => sum + r.revenue, 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-3 border-r border-slate-200 text-right font-mono">
                              ₹{dynamicPL.reduce((sum, r) => sum + r.expenses, 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-3 border-r border-slate-200 text-right font-mono">
                              ₹{dynamicPL.reduce((sum, r) => sum + r.teamPayments, 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-3 text-right text-emerald-800 font-black font-mono">
                              ₹{dynamicPL.reduce((sum, r) => sum + r.netProfit, 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-150 text-xs text-blue-900/95 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-blue-950">
                      <Sparkles className="h-3.5 w-3.5 text-sky-650" />
                      Automatic P&L Derivation Engine:
                    </span>
                    <p className="leading-relaxed font-light">
                      This ledger functions as a standalone financial ledger. 
                      Entries here are continuously aggregated from your transactions in other sheets. 
                      When exporting to Excel via the upper toolbar, this is saved as structural cell formulas (e.g., <code>=B2-C2-D2</code>) to allow continuous standalone evaluations.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sheet 7: Project Tracker */}
            {activeSheet === 7 && (
              <ExcelTable
                title="Sheet 7: Project Tracker"
                description="Prioritize delivery deadlines, monitor team assignments, and manage milestones for active contracts."
                data={state.projectTracker}
                columns={trackerColumns}
                onAdd={addProjectTracker}
                onUpdate={updateProjectTracker}
                onDelete={deleteProjectTracker}
                onReset={handleResetToDefault}
                defaultNewRecord={{
                  id: `PROJ-${Date.now().toString().slice(-3)}`,
                  client: '',
                  projectName: '',
                  category: 'Website Development',
                  assignedTo: '',
                  startDate: '',
                  deadline: '',
                  status: 'Planning',
                  projectValue: 0,
                  paymentStatus: 'Pending',
                  remarks: ''
                }}
              />
            )}

            {/* Sheet 9: Founder Work Assignments */}
            {activeSheet === 9 && (
              <ExcelTable
                title="Sheet 9: Founder Work Assignments"
                description="Assign task sprints, configure prioritization levels, establish timelines, and inspect progress metrics for deliverables."
                data={state.workAssignments || []}
                columns={assignmentColumns}
                onAdd={addWorkAssignment}
                onUpdate={updateWorkAssignment}
                onDelete={deleteWorkAssignment}
                onReset={handleResetToDefault}
                defaultNewRecord={{
                  taskTitle: '',
                  description: '',
                  assignedTo: '',
                  assignedBy: 'Founder',
                  priority: 'Medium',
                  status: 'Not Started',
                  startDate: new Date().toISOString().split('T')[0],
                  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  estimatedHours: 0,
                  remarks: ''
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

      </main>

      {/* 3. EXCEL WORKBOOK TAB BAR (FIXED BOTTOM AT THE FOOTER) */}
      <footer className="bg-slate-800 border-t border-slate-700 p-2 text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 sticky bottom-0 z-40 shadow-lg">
        
        {/* Spreadsheet Tab selection - replicates genuine Excel bottom sheet tracker bar */}
        <div className="flex flex-wrap items-center gap-1.5 scrollbar-none overflow-x-auto pb-1 md:pb-0">
          
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono flex items-center gap-1 mr-2 px-1 select-none">
            <TableProperties className="h-3.5 w-3.5 text-sky-400" />
            Sheets Tabs:
          </span>

          <button
            onClick={() => setActiveSheet(8)}
            className={`px-3 py-1 bg-slate-750 hover:bg-slate-700 text-xs font-semibold rounded-lg border-b-2 flex items-center gap-1.5 transition ${
              activeSheet === 8 
                ? 'bg-blue-600 text-white border-blue-400 scale-102' 
                : 'text-slate-300 border-transparent hover:text-white'
            }`}
          >
            <LineChart className="h-3.5 w-3.5" />
            Sheet 8: Dashboard
          </button>

          <button
            onClick={() => setActiveSheet(1)}
            className={`px-3 py-1 bg-slate-750 hover:bg-slate-700 text-xs font-semibold rounded-lg border-b-2 flex items-center gap-1 transition ${
              activeSheet === 1 
                ? 'bg-[#0f4c81] text-white border-blue-400 scale-102' 
                : 'text-slate-300 border-transparent hover:text-white'
            }`}
          >
            S1: Team Contributions
          </button>

          <button
            onClick={() => setActiveSheet(2)}
            className={`px-3 py-1 bg-slate-750 hover:bg-slate-700 text-xs font-semibold rounded-lg border-b-2 flex items-center gap-1 transition ${
              activeSheet === 2 
                ? 'bg-[#0f4c81] text-white border-blue-400 scale-102' 
                : 'text-slate-300 border-transparent hover:text-white'
            }`}
          >
            S2: Project Revenue
          </button>

          <button
            onClick={() => setActiveSheet(3)}
            className={`px-3 py-1 bg-slate-750 hover:bg-slate-700 text-xs font-semibold rounded-lg border-b-2 flex items-center gap-1 transition ${
              activeSheet === 3 
                ? 'bg-[#0f4c81] text-white border-blue-400 scale-102' 
                : 'text-slate-300 border-transparent hover:text-white'
            }`}
          >
            S3: Business Expenses
          </button>

          <button
            onClick={() => setActiveSheet(4)}
            className={`px-3 py-1 bg-slate-750 hover:bg-slate-700 text-xs font-semibold rounded-lg border-b-2 flex items-center gap-1 transition ${
              activeSheet === 4 
                ? 'bg-[#0f4c81] text-white border-blue-400 scale-102' 
                : 'text-slate-300 border-transparent hover:text-white'
            }`}
          >
            S4: Internships
          </button>

          <button
            onClick={() => setActiveSheet(5)}
            className={`px-3 py-1 bg-slate-750 hover:bg-slate-700 text-xs font-semibold rounded-lg border-b-2 flex items-center gap-1 transition ${
              activeSheet === 5 
                ? 'bg-[#0f4c81] text-white border-blue-400 scale-102' 
                : 'text-slate-300 border-transparent hover:text-white'
            }`}
          >
            S5: Co-Founders
          </button>

          <button
            onClick={() => setActiveSheet(6)}
            className={`px-3 py-1 bg-slate-750 hover:bg-slate-700 text-xs font-semibold rounded-lg border-b-2 flex items-center gap-1 transition ${
              activeSheet === 6 
                ? 'bg-[#0f4c81] text-white border-blue-400 scale-102' 
                : 'text-slate-300 border-transparent hover:text-white'
            }`}
          >
            S6: Monthly P&L
          </button>

          <button
            onClick={() => setActiveSheet(7)}
            className={`px-3 py-1 bg-slate-750 hover:bg-slate-700 text-xs font-semibold rounded-lg border-b-2 flex items-center gap-1 transition ${
              activeSheet === 7 
                ? 'bg-[#0f4c81] text-white border-blue-400 scale-102' 
                : 'text-slate-300 border-transparent hover:text-white'
            }`}
          >
            S7: Project Tracker
          </button>

          <button
            onClick={() => setActiveSheet(9)}
            className={`px-3 py-1 bg-slate-750 hover:bg-slate-700 text-xs font-semibold rounded-lg border-b-2 animate-pulse flex items-center gap-1 transition ${
              activeSheet === 9 
                ? 'bg-[#0f4c81] text-white border-blue-400 scale-102 animate-none' 
                : 'text-slate-300 border-transparent hover:text-white'
            }`}
            style={{ animationDuration: '2.5s' }}
          >
            S9: Work Assignments 🛠️
          </button>

        </div>

        {/* Footer Brand Credit */}
        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono justify-end select-none">
          <span className="text-slate-350">Cambrian • IndiWebPros Agency Suite</span>
          <span className="text-slate-650">|</span>
          <span className="text-emerald-400 font-bold flex items-center gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            Persistent Sync Enabled
          </span>
        </div>

      </footer>

      {/* Dynamic Firebase Auth Troubleshooter Modal */}
      <AnimatePresence>
        {authError && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 md:p-8 w-full max-w-lg relative text-slate-800 my-8"
            >
              <button 
                onClick={() => setAuthError(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 mb-5 text-amber-600">
                <div className="p-2.5 bg-amber-50 rounded-xl">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Cloud Sync Connection Aid</h3>
                  <p className="text-xs text-slate-500">Helping you bypass authentication roadblocks</p>
                </div>
              </div>

              <div className="space-y-5">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Google Firebase Auth popups are often blocked or fail inside iframe previews due to strict security settings or third-party cookie restrictions in your browser.
                </p>

                {/* Option 1: The easiest solution */}
                <div className="bg-blue-50/55 border border-blue-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold font-mono">1</span>
                    <h4 className="text-xs font-bold text-slate-900">Immediate Fix: Open in New Tab</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-light">
                    Running the app directly outside of any iframe lets Google authenticate securely without cross-origin cookie blocks. Your current drafts are safe!
                  </p>
                  <button
                    onClick={() => {
                      setAuthError(null);
                      window.open(window.location.href, '_blank');
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open App in New Tab & Sign In
                  </button>
                </div>

                {/* Option 2: Authorized domain config */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold font-mono">2</span>
                    <h4 className="text-xs font-bold text-slate-900">Developer Fix: Register Custom Domain</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-light">
                    Firebase secures logins by strictly verifying that request origins are registered. If hosting on custom domains, you must manually add <code className="font-mono bg-slate-150 px-1 py-0.5 rounded text-[11px] font-medium">{authError.hostname}</code> to the authorized list.
                  </p>

                  <div className="flex items-center gap-2 bg-white border border-slate-250 p-2 rounded-lg justify-between select-all font-mono text-xs">
                    <span className="text-slate-755 font-medium truncate">{authError.hostname}</span>
                    <button
                      onClick={handleCopyDomain}
                      className="flex-shrink-0 text-slate-500 hover:text-slate-800 p-1.5 rounded hover:bg-slate-100 transition cursor-pointer"
                      title="Copy domain name"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>

                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs border border-slate-250 transition"
                  >
                    <Globe className="h-3.5 w-3.5 text-slate-500" />
                    Open Firebase Console Settings
                  </a>
                  <p className="text-[10px] text-slate-450 italic font-light">
                    *Navigate to the "Authorized domains" section under your Firebase Settings tab.
                  </p>
                </div>

                {/* Technical Info collapse */}
                <div className="border border-slate-150 rounded-lg overflow-hidden text-xs">
                  <details className="group/details">
                    <summary className="flex items-center justify-between p-3 bg-slate-50 cursor-pointer font-medium text-slate-705 list-none select-none">
                      <span>Technical Error Details</span>
                      <span className="text-slate-450 transform group-open/details:rotate-180 transition text-[10px]">▼</span>
                    </summary>
                    <div className="p-3 bg-slate-50/55 border-t border-slate-150 space-y-1.5 font-mono text-[11px] text-slate-600 break-all">
                      {authError.code && (
                        <div>
                          <strong className="text-slate-700">Code:</strong> {authError.code}
                        </div>
                      )}
                      <div>
                        <strong className="text-slate-700">Message:</strong> {authError.message}
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setAuthError(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  Close Help Guide
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* EDIT BRANDING MODAL */}
        {isEditingTitle && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 md:p-8 w-full max-w-sm relative text-slate-800 my-8"
            >
              <button 
                onClick={() => setIsEditingTitle(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 mb-5 text-[#0f4c81]">
                <div className="p-2.5 bg-[#0f4c81]/10 rounded-xl">
                  <Edit3 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Custom Brand Titles</h3>
                  <p className="text-[11px] text-slate-550">Configure your workspace name and labelings</p>
                </div>
              </div>

              <form onSubmit={handleSaveBranding} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-1">
                    Company Name / Parent Folder Name
                  </label>
                  <input
                    type="text"
                    value={tempCompany}
                    onChange={e => setTempCompany(e.target.value)}
                    placeholder="e.g. Cambrian"
                    className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-800 rounded-lg text-xs font-semibold border border-slate-250 focus:border-[#0f4c81] focus:ring-1 focus:ring-[#0f4c81] outline-hidden transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-1">
                    System Name / Subsystem Tag
                  </label>
                  <input
                    type="text"
                    value={tempSystem}
                    onChange={e => setTempSystem(e.target.value)}
                    placeholder="e.g. IndiWebPros"
                    className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-800 rounded-lg text-xs font-semibold border border-slate-250 focus:border-[#0f4c81] focus:ring-1 focus:ring-[#0f4c81] outline-hidden transition"
                    required
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0f4c81] hover:bg-[#0c3e6a] text-white rounded-lg transition cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
