import { Branch } from '../types.js';
import { getCurrentCompanyId } from './supabaseClient.js';
import { localDataStore } from './dataService.js';

const BRANCHES_STORAGE_KEY = 'logix_branches_list';
const ACTIVE_BRANCH_KEY = 'logix_active_branch_id';

const DEFAULT_BRANCHES: Branch[] = [
  {
    id: 'branch-main-01',
    company_id: 'default',
    code: 'BR-01',
    nameAr: 'الفرع الرئيسي - العاصمة',
    nameEn: 'Main Branch - Capital',
    phone: '+965 2200 1100',
    address: 'شارع فهد السالم - برج لوجيكس - الدور الأرضي',
    city: 'مدينة الكويت',
    commercialRegNumber: '450912',
    taxNumber: '',
    isDefault: true,
    isActive: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'branch-industrial-02',
    company_id: 'default',
    code: 'BR-02',
    nameAr: 'فرع منطقة الري الصناعية',
    nameEn: 'Al-Rai Industrial Branch',
    phone: '+965 2484 1888',
    address: 'شارع الغزالي - قسيمة 42',
    city: 'الري الصناعية',
    commercialRegNumber: '450912-2',
    taxNumber: '',
    isDefault: false,
    isActive: true,
    created_at: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'branch-shuwaikh-03',
    company_id: 'default',
    code: 'BR-03',
    nameAr: 'معرض الشويخ التجاري',
    nameEn: 'Shuwaikh Showroom',
    phone: '+965 2481 9900',
    address: 'الشويخ الصناعية - شارع كندا دراي',
    city: 'الشويخ',
    isDefault: false,
    isActive: true,
    created_at: '2026-02-01T00:00:00.000Z',
  },
];

class BranchService {
  private branches: Branch[] = [];
  private activeBranchId: string = 'branch-main-01';

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(BRANCHES_STORAGE_KEY);
        if (raw) {
          this.branches = JSON.parse(raw);
        } else {
          this.branches = [...DEFAULT_BRANCHES];
          this.persist();
        }

        const savedActive = localStorage.getItem(ACTIVE_BRANCH_KEY);
        if (savedActive && this.branches.some((b) => b.id === savedActive)) {
          this.activeBranchId = savedActive;
        } else {
          this.activeBranchId = this.branches[0]?.id || 'branch-main-01';
        }
      } else {
        this.branches = [...DEFAULT_BRANCHES];
      }
    } catch (e) {
      this.branches = [...DEFAULT_BRANCHES];
    }
  }

  private persist() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(BRANCHES_STORAGE_KEY, JSON.stringify(this.branches));
      }
    } catch (e) {
      console.warn('Failed to persist branches:', e);
    }
  }

  public getBranchesForCurrentCompany(companyId?: string): Branch[] {
    const effectiveCompanyId =
      companyId ||
      getCurrentCompanyId() ||
      localDataStore.getEffectiveCompanyId() ||
      'default';

    const companyBranches = this.branches.filter(
      (b) => !b.is_deleted && (b.company_id === effectiveCompanyId || b.company_id === 'default')
    );

    if (companyBranches.length === 0) {
      // Return cloned default branches scoped to this company
      return DEFAULT_BRANCHES.map((b) => ({ ...b, company_id: effectiveCompanyId }));
    }

    return companyBranches;
  }

  public getActiveBranch(companyId?: string): Branch {
    const list = this.getBranchesForCurrentCompany(companyId);
    const found = list.find((b) => b.id === this.activeBranchId);
    return found || list[0] || DEFAULT_BRANCHES[0];
  }

  public setActiveBranch(branchId: string) {
    this.activeBranchId = branchId;
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_BRANCH_KEY, branchId);
      window.dispatchEvent(new CustomEvent('logix-branch-changed', { detail: { branchId } }));
    }
  }

  public addBranch(newBranch: Omit<Branch, 'id' | 'created_at'>): Branch {
    const branch: Branch = {
      ...newBranch,
      id: 'branch-' + Date.now().toString(36),
      created_at: new Date().toISOString(),
      isActive: true,
      is_deleted: false,
    };
    this.branches.push(branch);
    this.persist();
    return branch;
  }
}

export const branchService = new BranchService();
