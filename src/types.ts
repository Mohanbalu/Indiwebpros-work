export interface TeamContribution {
  id: string;
  month: string; // e.g. "January 2026"
  name: string;
  role: string;
  organizationClient: string;
  projectName: string;
  contributionType: string;
  hoursWorked: number;
  tasksCompleted: string;
  amountAllocated: number;
  bonus: number;
  totalAmount: number; // calculated
  paymentStatus: 'Paid' | 'Pending' | 'Partial';
  paymentDate: string;
  remarks: string;
}

export type ProjectCategory = 
  | 'Website Development'
  | 'AI Project'
  | 'Academic Project'
  | 'Research Paper'
  | 'Internship Program'
  | 'CRM System'
  | 'Mobile App'
  | 'Other';

export type LeadSource =
  | 'Instagram'
  | 'LinkedIn'
  | 'WhatsApp'
  | 'Referral'
  | 'Website'
  | 'Direct Client'
  | 'Other';

export interface ProjectRevenue {
  id: string;
  date: string;
  clientName: string;
  organization: string;
  projectName: string;
  projectCategory: ProjectCategory;
  leadSource: LeadSource;
  revenue: number;
  amountReceived: number;
  pendingAmount: number; // calculated
  paymentStatus: 'Received' | 'Partial' | 'Pending';
  expectedCompletionDate: string;
  remarks: string;
}

export type ExpenseCategory =
  | 'Hosting'
  | 'Domain'
  | 'Marketing'
  | 'Software Subscription'
  | 'Salaries'
  | 'Freelancer Payment'
  | 'Internet'
  | 'Office'
  | 'Miscellaneous';

export interface BusinessExpense {
  id: string;
  date: string;
  expenseCategory: ExpenseCategory;
  description: string;
  amount: number;
  paidBy: string;
  projectLinked: string;
  remarks: string;
}

export interface InternshipManagement {
  id: string;
  internName: string;
  college: string;
  course: string;
  startDate: string;
  endDate: string;
  batch: string;
  feePaid: number;
  certificateStatus: 'Issued' | 'Pending';
  mentor: string;
  remarks: string;
}

export interface CoFounderRevenueSharing {
  id: string;
  month: string;
  name: string;
  ownershipPercentage: number;
  profitShare: number;
  amountPaid: number;
  pendingAmount: number; // calculated
  status: 'Paid' | 'Partial' | 'Pending';
}

export interface MonthlyProfitLoss {
  id: string;
  month: string;
  totalRevenue: number;
  totalExpenses: number;
  teamPayments: number;
  netProfit: number; // calculated
}

export type ProjectTrackerStatus =
  | 'Planning'
  | 'In Progress'
  | 'Testing'
  | 'Completed'
  | 'Delivered';

export interface ProjectTracker {
  id: string; // Project ID
  client: string;
  projectName: string;
  category: ProjectCategory;
  assignedTo: string;
  startDate: string;
  deadline: string;
  status: ProjectTrackerStatus;
  projectValue: number;
  paymentStatus: 'Received' | 'Partial' | 'Pending';
  remarks: string;
}

export type WorkAssignmentPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type WorkAssignmentStatus = 'Not Started' | 'In Progress' | 'Review' | 'Completed' | 'Blocked';

export interface WorkAssignment {
  id: string;
  taskTitle: string;
  description: string;
  assignedTo: string;
  assignedBy: string;
  priority: WorkAssignmentPriority;
  status: WorkAssignmentStatus;
  startDate: string;
  dueDate: string;
  estimatedHours: number;
  remarks: string;
}

// Full app state containing all data sheets
export interface WorkbookState {
  teamContributions: TeamContribution[];
  projectRevenue: ProjectRevenue[];
  businessExpenses: BusinessExpense[];
  internships: InternshipManagement[];
  coFounderPayouts: CoFounderRevenueSharing[];
  projectTracker: ProjectTracker[];
  workAssignments: WorkAssignment[];
  companyName?: string;
  systemName?: string;
}
