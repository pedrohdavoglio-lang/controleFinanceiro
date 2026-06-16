import { supabase } from './supabase-client.js';

export const DEFAULT_CATS = ["Alimentação","Saúde","Beleza","Transporte","Educação","Casa","Lazer","Livros","Assinaturas","Outros"];
const CATS_KEY = 'financeiro_cats';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data ?? [];
}
async function q1(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

// ── Mapeadores: estado JS ↔ banco (snake_case) ────────────────────────────────

const cycleToDb   = c => ({ id: c.id, name: c.name, start_date: c.start, end_date: c.end, mode: c.mode, closed: c.closed });
const cycleFromDb = r => ({ id: r.id, name: r.name, start: r.start_date, end: r.end_date, mode: r.mode, closed: r.closed });

const incomeToDb  = i => ({ id: i.id, source: i.source, type: i.type, recurring_value: i.recurringValue ?? 0, plan: i.plan ?? {} });
function incomeFromDb(r, realizedRows) {
  const realized = {};
  realizedRows.filter(x => x.income_id === r.id).forEach(x => { realized[x.cycle_id] = Number(x.value); });
  return { id: r.id, source: r.source, type: r.type, recurringValue: Number(r.recurring_value), plan: r.plan ?? {}, realized };
}

const cashToDb   = i => ({ id: i.id, description: i.description, date: i.date, value: i.value,
  category: i.category, shared: i.shared, shared_entity: i.sharedEntity ?? null,
  shared_value: i.sharedValue ?? 0, notes: i.notes ?? null, receivable_id: i.receivableId ?? null });
const cashFromDb = r => ({ id: r.id, description: r.description, date: r.date, value: Number(r.value),
  category: r.category, shared: r.shared, sharedEntity: r.shared_entity,
  sharedValue: Number(r.shared_value), notes: r.notes, receivableId: r.receivable_id });

const instToDb   = i => ({ id: i.id, description: i.description, date: i.date, total_value: i.totalValue,
  total_installments: i.installments, current_installment: i.currentInstallment, category: i.category, notes: i.notes ?? null });
const instFromDb = r => ({ id: r.id, description: r.description, date: r.date, totalValue: Number(r.total_value),
  installments: r.total_installments, currentInstallment: r.current_installment, category: r.category, notes: r.notes });

const entityToDb   = i => ({ id: i.id, entity: i.entity, description: i.description, value: i.value, due_date: i.dueDate || null, status: i.status });
const entityFromDb = r => ({ id: r.id, entity: r.entity, description: r.description, value: Number(r.value), dueDate: r.due_date, status: r.status });

const fixedToDb   = i => ({ id: i.id, name: i.name, value_type: i.valueType, expected_value: i.expectedValue,
  actual_value: i.actualValue ?? i.expectedValue, frequency: i.frequency, due_day: i.dueDay,
  end_type: i.endType, category: i.category, status: i.status });
const fixedFromDb = r => ({ id: r.id, name: r.name, valueType: r.value_type, expectedValue: Number(r.expected_value),
  actualValue: Number(r.actual_value), frequency: r.frequency, dueDay: r.due_day,
  endType: r.end_type, category: r.category, status: r.status });

const goalToDb   = i => ({ id: i.id, name: i.name, current_value: i.current, target_value: i.target,
  recurring_contribution: i.recurringContribution, cycle_contribution: i.cycleContribution, category: i.category });
const goalFromDb = r => ({ id: r.id, name: r.name, current: Number(r.current_value), target: Number(r.target_value),
  recurringContribution: Number(r.recurring_contribution), cycleContribution: Number(r.cycle_contribution), category: r.category });

const histToDb   = h => ({ id: h.id, name: h.name, start_date: h.start, end_date: h.end,
  income: h.income, spent: h.spent, leftover: h.leftover, closed_at: h.closedAt });
const histFromDb = r => ({ id: r.id, name: r.name, start: r.start_date, end: r.end_date,
  income: Number(r.income), spent: Number(r.spent), leftover: Number(r.leftover), closedAt: r.closed_at });

// ── Carregar tudo ─────────────────────────────────────────────────────────────

export async function loadAll() {
  const [cycles, incomes, realized, cash, insts, recs, pays, fixed, goals, hist, settings] = await Promise.all([
    q(supabase.from('cycles').select('*').order('start_date')),
    q(supabase.from('incomes').select('*')),
    q(supabase.from('income_realized').select('*')),
    q(supabase.from('cash_expenses').select('*').order('date', { ascending: false })),
    q(supabase.from('installments').select('*')),
    q(supabase.from('receivables').select('*')),
    q(supabase.from('payables').select('*')),
    q(supabase.from('fixed_bills').select('*')),
    q(supabase.from('goals').select('*')),
    q(supabase.from('history').select('*').order('closed_at', { ascending: false })),
    q1(supabase.from('user_settings').select('*').maybeSingle()),
  ]);
  
  return {
    activeCycleId: settings?.active_cycle_id || cycles[0]?.id || null,
    cycles:        cycles.map(cycleFromDb),
    incomes:       incomes.map(r => incomeFromDb(r, realized)),
    cashExpenses:  cash.map(cashFromDb),
    installments:  insts.map(instFromDb),
    receivables:   recs.map(entityFromDb),
    payables:      pays.map(entityFromDb),
    fixedBills:    fixed.map(fixedFromDb),
    goals:         goals.map(goalFromDb),
    history:       hist.map(histFromDb),
    categories:    JSON.parse(localStorage.getItem(CATS_KEY) || 'null') || [...DEFAULT_CATS],
  };
}

// ── Upserts ───────────────────────────────────────────────────────────────────

export const upsertCycle       = item  => q(supabase.from('cycles').upsert(cycleToDb(item)));
export const upsertCash        = item  => q(supabase.from('cash_expenses').upsert(cashToDb(item)));
export const upsertInst        = item  => q(supabase.from('installments').upsert(instToDb(item)));
export const upsertReceivable  = item  => q(supabase.from('receivables').upsert(entityToDb(item)));
export const upsertPayable     = item  => q(supabase.from('payables').upsert(entityToDb(item)));
export const upsertFixed       = item  => q(supabase.from('fixed_bills').upsert(fixedToDb(item)));
export const upsertGoal        = item  => q(supabase.from('goals').upsert(goalToDb(item)));
export const upsertHistory     = item  => q(supabase.from('history').upsert(histToDb(item)));

export async function upsertIncome(item) {
  await q(supabase.from('incomes').upsert(incomeToDb(item)));
  const entries = Object.entries(item.realized || {});
  if (!entries.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  await q(supabase.from('income_realized').upsert(
    entries.map(([cycle_id, value]) => ({ income_id: item.id, cycle_id, value: Number(value), user_id: user.id })),
    { onConflict: 'income_id,cycle_id' }
  ));
}

export async function saveCycles(cycles, activeCycleId) {
  const { data: { user } } = await supabase.auth.getUser();
  await q(supabase.from('cycles').upsert(cycles.map(cycleToDb)));
  await q(supabase.from('user_settings').upsert({ user_id: user.id, active_cycle_id: activeCycleId, updated_at: new Date().toISOString() }));
}

export async function saveSettings(activeCycleId) {
  const { data: { user } } = await supabase.auth.getUser();
  await q(supabase.from('user_settings').upsert({ user_id: user.id, active_cycle_id: activeCycleId, updated_at: new Date().toISOString() }));
}

// ── Deletes ───────────────────────────────────────────────────────────────────

export const deleteCash       = id => q(supabase.from('cash_expenses').delete().eq('id', id));
export const deleteReceivable = id => q(supabase.from('receivables').delete().eq('id', id));
export const deletePayable    = id => q(supabase.from('payables').delete().eq('id', id));
export const deleteInst       = id => q(supabase.from('installments').delete().eq('id', id));
export const deleteFixed      = id => q(supabase.from('fixed_bills').delete().eq('id', id));
export const deleteGoal       = id => q(supabase.from('goals').delete().eq('id', id));
export const deleteIncome     = id => q(supabase.from('incomes').delete().eq('id', id));

// ── Encerrar ciclo (operação em lote) ────────────────────────────────────────

export async function closeCycleInDb({ historyEntry, updatedCycle, nextCycleId, survivors, updatedFixed, updatedGoals }) {
  const { data: { user } } = await supabase.auth.getUser();
  await Promise.all([
    q(supabase.from('history').upsert(histToDb(historyEntry))),
    q(supabase.from('cycles').upsert(cycleToDb(updatedCycle))),
    q(supabase.from('user_settings').upsert({ user_id: user.id, active_cycle_id: nextCycleId, updated_at: new Date().toISOString() })),
    q(supabase.from('cash_expenses').delete().not('id', 'is', null)),
    q(supabase.from('receivables').delete().not('id', 'is', null)),
    q(supabase.from('payables').delete().not('id', 'is', null)),
  ]);
  // Substituir parceladas: apaga todas e reinsere as sobreviventes
  await q(supabase.from('installments').delete().not('id', 'is', null));
  if (survivors.length) await q(supabase.from('installments').insert(survivors.map(instToDb)));
  if (updatedFixed.length)  await q(supabase.from('fixed_bills').upsert(updatedFixed.map(fixedToDb)));
  if (updatedGoals.length)  await q(supabase.from('goals').upsert(updatedGoals.map(goalToDb)));
}

// ── Categorias (apenas localStorage — sem tabela no banco) ───────────────────

export const saveCategories = cats => localStorage.setItem(CATS_KEY, JSON.stringify(cats));

// ── Resetar tudo ──────────────────────────────────────────────────────────────

export async function resetAll() {
  const { data: { user } } = await supabase.auth.getUser();
  for (const t of ['income_realized','cash_expenses','receivables','payables','installments','fixed_bills','goals','history','incomes','cycles']) {
    await q(supabase.from(t).delete().not('id', 'is', null));
  }
  await q(supabase.from('user_settings').delete().eq('user_id', user.id));
  localStorage.removeItem(CATS_KEY);
}

// ── Importar JSON inteiro para o banco ────────────────────────────────────────

export async function saveAll(state) {
  const { data: { user } } = await supabase.auth.getUser();
  await resetAll();
  if (state.cycles?.length)       await q(supabase.from('cycles').insert(state.cycles.map(cycleToDb)));
  if (state.incomes?.length)      for (const i of state.incomes) await upsertIncome(i);
  if (state.receivables?.length)  await q(supabase.from('receivables').insert(state.receivables.map(entityToDb)));
  if (state.payables?.length)     await q(supabase.from('payables').insert(state.payables.map(entityToDb)));
  if (state.cashExpenses?.length) await q(supabase.from('cash_expenses').insert(state.cashExpenses.map(cashToDb)));
  if (state.installments?.length) await q(supabase.from('installments').insert(state.installments.map(instToDb)));
  if (state.fixedBills?.length)   await q(supabase.from('fixed_bills').insert(state.fixedBills.map(fixedToDb)));
  if (state.goals?.length)        await q(supabase.from('goals').insert(state.goals.map(goalToDb)));
  if (state.history?.length)      await q(supabase.from('history').insert(state.history.map(histToDb)));
  if (state.activeCycleId)        await q(supabase.from('user_settings').upsert({ user_id: user.id, active_cycle_id: state.activeCycleId, updated_at: new Date().toISOString() }));
  saveCategories(state.categories || [...DEFAULT_CATS]);
}
