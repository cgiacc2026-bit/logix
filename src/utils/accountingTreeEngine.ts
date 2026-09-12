/**
 * STRICT FINANCIAL ARCHITECTURE ENGINE
 * Single Source of Truth for Chart of Accounts Tree Aggregation & Balance Rollup
 * 
 * Rules:
 * 1. Leaf Accounts (الحسابات التحليلية / الطرفية) are accounts with NO sub-accounts.
 * 2. Only Leaf Accounts may have journal entry lines booked against them.
 * 3. Parent Accounts (الحسابات التجميعية / الرئيسية) NEVER accept direct journal entries.
 * 4. Parent Balance is strictly the recursive sum of its descendant leaf accounts:
 *      ParentBalance = SUM(Leaf_i.Balance) for all Leaf_i in Leaves(Parent)
 * 5. Overall Category KPIs sum ONLY leaf accounts, preventing double-counting.
 * 6. Centralized KWD formatting: `${Number(val || 0).toFixed(3)} د.ك`
 */

import { Account, AccountCategory, JournalEntry, JournalLine } from '../types.js';
import { formatCurrency } from './formatters.ts';

export interface EnrichedAccount extends Account {
  isLeaf: boolean;
  isSummary: boolean;
  leafCount: number;
  totalDebitMovement: number;
  totalCreditMovement: number;
  movementCount: number;
  directDebitMovement?: number;
  directCreditMovement?: number;
  directMovementCount?: number;
}

export interface ChartOfAccountsSummaryKPIs {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalRevenues: number;
  totalExpenses: number;
  totalSystemDebit: number;
  totalSystemCredit: number;
  isDoubleEntryBalanced: boolean;
  totalAccountsCount: number;
  leafAccountsCount: number;
  parentAccountsCount: number;
  postedJournalsCount: number;
}

export interface TreeAggregationResult {
  accounts: EnrichedAccount[];
  accountMap: Map<string, EnrichedAccount>;
  leafAccounts: EnrichedAccount[];
  parentAccounts: EnrichedAccount[];
  kpis: ChartOfAccountsSummaryKPIs;
  snapshotId: string;
}

/**
 * Standard Centralized Currency Formatter
 * Delegates to dynamic formatCurrency (handles active company currency and decimals)
 */
export const formatKWD = (val: number | string | null | undefined): string => {
  const num = typeof val === 'number' ? val : Number(val || 0);
  const safeNum = isNaN(num) ? 0 : num;
  return formatCurrency(safeNum);
};

// In-memory stable cache to avoid recalculating on non-data state updates (e.g. filter/tab clicks)
let cachedSnapshotKey = '';
let cachedAggregationResult: TreeAggregationResult | null = null;

/**
 * Generates a stable fingerprint for cache invalidation based on accounts and posted journals
 */
function generateSnapshotKey(accounts: Account[], journals: JournalEntry[]): string {
  const accountsHash = (accounts || [])
    .map((a) => `${a.id}:${a.code}:${a.parentId || ''}:${a.balance || 0}`)
    .join('|');
  const postedJournals = (journals || []).filter(
    (j) => j.status === 'POSTED' && !(j as any).isReversed && !(j as any).reversedEntryId
  );
  const journalsHash = `${postedJournals.length}:${postedJournals
    .map((j) => `${j.id}:${j.date}:${j.lines?.length || 0}`)
    .join('|')}`;
  return `${accountsHash}___${journalsHash}`;
}

/**
 * Determines whether an account is a leaf (analytical) or parent (summary) account
 */
export function isAccountLeaf(account: Account, allAccounts: Account[]): boolean {
  if (!account) return false;
  const accId = account.id;
  const accCode = String(account.code || '').trim();

  // If any other account has this account as parentId, it is NOT a leaf
  const hasChildByParentId = allAccounts.some(
    (other) => other.id !== accId && other.parentId === accId
  );
  if (hasChildByParentId) return false;

  // Hierarchical code check (e.g. 1111 is child of 1110, 1110 is child of 1100)
  if (accCode) {
    const hasChildByCode = allAccounts.some((other) => {
      if (other.id === accId) return false;
      const otherCode = String(other.code || '').trim();
      return (
        otherCode.startsWith(accCode) &&
        otherCode !== accCode &&
        otherCode.length > accCode.length &&
        other.level > account.level
      );
    });
    if (hasChildByCode) return false;
  }

  return true;
}

/**
 * Finds all descendant leaf accounts for a given parent account
 */
export function getDescendantLeaves(
  parentAccount: Account,
  allAccounts: Account[],
  leafAccounts: EnrichedAccount[]
): EnrichedAccount[] {
  const parentId = parentAccount.id;
  const parentCode = String(parentAccount.code || '').trim();

  // Set of all descendant account IDs
  const descendantIds = new Set<string>();

  // Helper for recursive BFS
  const queue = [parentId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentAcc = allAccounts.find((a) => a.id === currentId);
    const currCode = currentAcc ? String(currentAcc.code || '').trim() : '';

    for (const other of allAccounts) {
      if (other.id === parentId || descendantIds.has(other.id)) continue;

      const isDirectChild = other.parentId === currentId;
      const isHierarchicalChild =
        currCode &&
        String(other.code || '').startsWith(currCode) &&
        String(other.code || '') !== currCode;

      if (isDirectChild || isHierarchicalChild) {
        descendantIds.add(other.id);
        queue.push(other.id);
      }
    }
  }

  // Also include hierarchical descendants by code prefix
  if (parentCode) {
    for (const other of allAccounts) {
      if (other.id === parentId || descendantIds.has(other.id)) continue;
      const oCode = String(other.code || '').trim();
      if (oCode.startsWith(parentCode) && oCode !== parentCode) {
        descendantIds.add(other.id);
      }
    }
  }

  // Filter down to strictly leaf accounts that belong to descendants
  return leafAccounts.filter((leaf) => descendantIds.has(leaf.id));
}

/**
 * Strict Tree Aggregation Function
 * Computes balances strictly on leaf accounts and rolls them up into parent accounts.
 * Parent accounts NEVER accumulate direct movements or self-balances.
 */
export function aggregateChartOfAccountsTree(
  rawAccounts: Account[],
  rawJournals: JournalEntry[],
  bypassCache = false
): TreeAggregationResult {
  const currentKey = generateSnapshotKey(rawAccounts, rawJournals);

  if (!bypassCache && cachedAggregationResult && cachedSnapshotKey === currentKey) {
    return cachedAggregationResult;
  }

  // 1. Deduplicate incoming accounts by code / id
  const dedupedMap = new Map<string, Account>();
  for (const a of rawAccounts || []) {
    if (!a) continue;
    const codeKey = String(a.code || a.id || '').trim();
    if (!codeKey) continue;
    if (!dedupedMap.has(codeKey)) {
      dedupedMap.set(codeKey, { ...a });
    } else {
      const existing = dedupedMap.get(codeKey)!;
      // Preserve canonical ID and prefer existing
      const preferredId = existing.id.startsWith('acc-') ? existing.id : a.id;
      dedupedMap.set(codeKey, { ...existing, id: preferredId });
    }
  }
  const cleanAccountsList = Array.from(dedupedMap.values());

  // 2. Identify leaf vs parent accounts
  const leafMap = new Map<string, boolean>();
  for (const acc of cleanAccountsList) {
    leafMap.set(acc.id, isAccountLeaf(acc, cleanAccountsList));
  }

  // Build lookup index for accounts
  const accountByLookup = new Map<string, Account>();
  cleanAccountsList.forEach((a) => {
    accountByLookup.set(a.id, a);
    if (a.code) accountByLookup.set(a.code, a);
  });

  // 3. Filter strictly POSTED and non-reversed journal entries
  const postedJournals = (rawJournals || []).filter(
    (j) => j.status === 'POSTED' && !(j as any).isReversed && !(j as any).reversedEntryId
  );

  // Maps for tracking direct movements on leaf accounts
  const leafDebitMap = new Map<string, number>();
  const leafCreditMap = new Map<string, number>();
  const leafCountMap = new Map<string, number>();

  // Diagnostic / audit tracking for legacy lines on parent accounts
  const parentDirectDebits = new Map<string, number>();
  const parentDirectCredits = new Map<string, number>();
  const parentDirectCounts = new Map<string, number>();

  // 4. Process journal entry lines
  for (const journal of postedJournals) {
    for (const line of journal.lines || []) {
      const acc = accountByLookup.get(line.accountId) || accountByLookup.get(line.accountCode || '');
      if (!acc) continue;

      const lineDebit = Number(line.debit) || 0;
      const lineCredit = Number(line.credit) || 0;

      const isLeaf = leafMap.get(acc.id) ?? true;

      if (isLeaf) {
        // Legitimate leaf account entry
        leafDebitMap.set(acc.id, (leafDebitMap.get(acc.id) || 0) + lineDebit);
        leafCreditMap.set(acc.id, (leafCreditMap.get(acc.id) || 0) + lineCredit);
        leafCountMap.set(acc.id, (leafCountMap.get(acc.id) || 0) + 1);
      } else {
        // Line mistakenly booked on a parent / summary account:
        // Record as direct movement for auditing, but find its primary leaf child to prevent drift
        parentDirectDebits.set(acc.id, (parentDirectDebits.get(acc.id) || 0) + lineDebit);
        parentDirectCredits.set(acc.id, (parentDirectCredits.get(acc.id) || 0) + lineCredit);
        parentDirectCounts.set(acc.id, (parentDirectCounts.get(acc.id) || 0) + 1);

        // Map to primary descendant leaf so financial balance is conserved in the leaves
        const leavesUnderParent = cleanAccountsList.filter(
          (other) =>
            leafMap.get(other.id) &&
            (other.parentId === acc.id ||
              (other.code && acc.code && other.code.startsWith(acc.code) && other.code !== acc.code))
        );

        if (leavesUnderParent.length > 0) {
          // Sort by code to deterministically pick primary leaf child
          leavesUnderParent.sort((x, y) => x.code.localeCompare(y.code));
          const primaryLeaf = leavesUnderParent[0];
          leafDebitMap.set(primaryLeaf.id, (leafDebitMap.get(primaryLeaf.id) || 0) + lineDebit);
          leafCreditMap.set(primaryLeaf.id, (leafCreditMap.get(primaryLeaf.id) || 0) + lineCredit);
          leafCountMap.set(primaryLeaf.id, (leafCountMap.get(primaryLeaf.id) || 0) + 1);
        }
      }
    }
  }

  // 5. Build preliminary enriched leaf accounts with their own direct balances
  const enrichedMap = new Map<string, EnrichedAccount>();
  const initialLeaves: EnrichedAccount[] = [];

  cleanAccountsList.forEach((acc) => {
    const isLeaf = leafMap.get(acc.id) ?? true;
    const deb = leafDebitMap.get(acc.id) || 0;
    const cred = leafCreditMap.get(acc.id) || 0;
    const count = leafCountMap.get(acc.id) || 0;

    let balance = 0;
    if (isLeaf) {
      if (acc.normalBalance === 'DEBIT') {
        balance = deb - cred;
      } else {
        balance = cred - deb;
      }
    }

    const enriched: EnrichedAccount = {
      ...acc,
      isLeaf,
      isSummary: !isLeaf,
      type: isLeaf ? 'DETAIL' : acc.level === 1 ? 'ROOT' : 'HEADER',
      leafCount: isLeaf ? 1 : 0,
      totalDebitMovement: deb,
      totalCreditMovement: cred,
      movementCount: count,
      balance,
      directDebitMovement: isLeaf ? deb : (parentDirectDebits.get(acc.id) || 0),
      directCreditMovement: isLeaf ? cred : (parentDirectCredits.get(acc.id) || 0),
      directMovementCount: isLeaf ? count : (parentDirectCounts.get(acc.id) || 0),
    };

    enrichedMap.set(acc.id, enriched);
    if (isLeaf) {
      initialLeaves.push(enriched);
    }
  });

  // 6. Strict Rollup: Calculate Parent Account balances strictly from descendant leaves
  cleanAccountsList.forEach((acc) => {
    const isLeaf = leafMap.get(acc.id) ?? true;
    if (isLeaf) return; // Already calculated

    const parentEnriched = enrichedMap.get(acc.id)!;
    const descendantLeaves = getDescendantLeaves(acc, cleanAccountsList, initialLeaves);

    let rolledBalance = 0;
    let rolledDebit = 0;
    let rolledCredit = 0;
    let rolledCount = 0;

    for (const leaf of descendantLeaves) {
      // Normal balance sign alignment: if parent has same normal balance as leaf
      if (parentEnriched.normalBalance === leaf.normalBalance) {
        rolledBalance += leaf.balance || 0;
      } else {
        // Cross normal-balance (e.g. contra account)
        rolledBalance -= leaf.balance || 0;
      }
      rolledDebit += leaf.totalDebitMovement || 0;
      rolledCredit += leaf.totalCreditMovement || 0;
      rolledCount += leaf.movementCount || 0;
    }

    parentEnriched.balance = rolledBalance;
    parentEnriched.totalDebitMovement = rolledDebit;
    parentEnriched.totalCreditMovement = rolledCredit;
    parentEnriched.movementCount = rolledCount;
    parentEnriched.leafCount = descendantLeaves.length;
  });

  const allEnrichedList = Array.from(enrichedMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  const finalLeaves = allEnrichedList.filter((a) => a.isLeaf);
  const finalParents = allEnrichedList.filter((a) => !a.isLeaf);

  // 7. Overall KPIs: Sum ONLY leaf accounts to guarantee zero double-counting
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let totalRevenues = 0;
  let totalExpenses = 0;
  let totalSystemDebit = 0;
  let totalSystemCredit = 0;

  finalLeaves.forEach((leaf) => {
    const bal = Number(leaf.balance) || 0;
    if (leaf.category === 'ASSET') totalAssets += bal;
    if (leaf.category === 'LIABILITY') totalLiabilities += bal;
    if (leaf.category === 'EQUITY') totalEquity += bal;
    if (leaf.category === 'REVENUE') totalRevenues += bal;
    if (leaf.category === 'EXPENSE') totalExpenses += bal;

    totalSystemDebit += leaf.totalDebitMovement || 0;
    totalSystemCredit += leaf.totalCreditMovement || 0;
  });

  const kpis: ChartOfAccountsSummaryKPIs = {
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalRevenues,
    totalExpenses,
    totalSystemDebit,
    totalSystemCredit,
    isDoubleEntryBalanced: Math.abs(totalSystemDebit - totalSystemCredit) < 0.005,
    totalAccountsCount: allEnrichedList.length,
    leafAccountsCount: finalLeaves.length,
    parentAccountsCount: finalParents.length,
    postedJournalsCount: postedJournals.length,
  };

  const result: TreeAggregationResult = {
    accounts: allEnrichedList,
    accountMap: enrichedMap,
    leafAccounts: finalLeaves,
    parentAccounts: finalParents,
    kpis,
    snapshotId: currentKey,
  };

  cachedSnapshotKey = currentKey;
  cachedAggregationResult = result;

  return result;
}
