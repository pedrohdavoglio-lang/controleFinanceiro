import * as db from './db.js';
import { DEFAULT_CATS } from './db.js';

const MONTHS = [
  ["jan", "Jan"], ["feb", "Fev"], ["mar", "Mar"], ["apr", "Abr"],
  ["may", "Mai"], ["jun", "Jun"], ["jul", "Jul"], ["aug", "Ago"],
  ["sep", "Set"], ["oct", "Out"], ["nov", "Nov"], ["dec", "Dez"]
];

const EMPTY = {
  activeCycleId: null,
  cycles: [],
  incomes: [],
  cashExpenses: [],
  installments: [],
  receivables: [],
  payables: [],
  fixedBills: [],
  goals: [],
  history: [],
  categories: [...DEFAULT_CATS]
};

let state = structuredClone(EMPTY);

function dbErr(err) {
  console.error(err);
  alert('Erro ao salvar no banco: ' + (err.message || err));
}

function uid(p) {
  return `${p}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
}

function money(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function sum(a, f = x => x.value) {
  return a.reduce((t, i) => t + Number(f(i) || 0), 0);
}

function dbr(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function cycle() {
  return state.cycles.find(c => c.id === state.activeCycleId) || state.cycles[0] || null;
}

function monthKey() {
  const c = cycle();
  const d = c ? new Date(c.start + "T00:00:00") : new Date();
  return MONTHS[d.getMonth()][0];
}

function plannedIncome(i) {
  return Number(i.plan?.[monthKey()] ?? i.recurringValue ?? 0);
}

function realizedIncome(i) {
  const c = cycle();
  return Number(c ? (i.realized?.[c.id] ?? plannedIncome(i)) : plannedIncome(i));
}

function instVal(i) {
  return Number(i.totalValue || 0) / Math.max(1, Number(i.installments || 1));
}

function pending(a) {
  return a.filter(i => i.status === "Pendente");
}

function done(a, s) {
  return a.filter(i => i.status === s);
}

function upsert(list, obj) {
  const idx = list.findIndex(i => i.id === obj.id);
  idx >= 0 ? list[idx] = obj : list.unshift(obj);
}

function remove(list, id) {
  const idx = list.findIndex(i => i.id === id);
  if (idx >= 0) list.splice(idx, 1);
}

function options(arr) {
  return arr.map(x => `<option>${x}</option>`).join("");
}

function tags(arr) {
  return `<div class="tags">${arr.filter(Boolean).map(x => `<span class="tag">${escape(x)}</span>`).join("")}</div>`;
}

function empty(msg) {
  return `<p class="empty">${msg}</p>`;
}

function escape(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function currentCycleHtml() {
  const c = cycle();
  return `<div class="cycle-warning">${c
    ? `Ciclo ativo: ${escape(c.name)} · ${dbr(c.start)} até ${dbr(c.end)}`
    : "Nenhum ciclo ativo. Gere um ciclo no Perfil antes de lançar valores."
  }</div>`;
}

function dateInCycle(date) {
  const c = cycle();
  if (!c) return false;
  return date >= c.start && date <= c.end;
}

function validateDate(date, label = "Data") {
  const c = cycle();
  if (!c) {
    alert("Gere e ative um ciclo antes de cadastrar lançamentos.");
    return false;
  }
  if (!dateInCycle(date)) {
    alert(`${label} fora do ciclo ativo.\n\nCiclo ativo: ${c.name} (${dbr(c.start)} a ${dbr(c.end)})\nData informada: ${dbr(date)}`);
    return false;
  }
  return true;
}

function groupByEntity(list) {
  const g = {};
  pending(list).forEach(i => g[i.entity] = (g[i.entity] || 0) + Number(i.value || 0));
  return Object.entries(g).sort((a, b) => b[1] - a[1]);
}

function calc() {
  const incomePlanned = sum(state.incomes, plannedIncome),
    income = sum(state.incomes, realizedIncome),
    cash = sum(state.cashExpenses),
    shared = sum(state.cashExpenses.filter(i => i.shared), i => i.sharedValue),
    inst = sum(state.installments, instVal),
    instFuture = sum(state.installments, i => Math.max(0, Number(i.totalValue || 0) - instVal(i))),
    recP = sum(pending(state.receivables)),
    recD = sum(done(state.receivables, "Recebido")),
    payP = sum(pending(state.payables)),
    payD = sum(done(state.payables, "Pago")),
    fixP = sum(state.fixedBills.filter(i => i.status === "Pendente"), i => i.actualValue ?? i.expectedValue),
    fixD = sum(state.fixedBills.filter(i => i.status === "Pago"), i => i.actualValue ?? i.expectedValue),
    goalCycle = sum(state.goals, i => i.cycleContribution),
    goalCur = sum(state.goals, i => i.current),
    goalTarget = sum(state.goals, i => i.target),
    projected = income + recP - cash - inst - payP - fixP - goalCycle;
  return { incomePlanned, income, cash, shared, inst, instFuture, recP, recD, payP, payD, fixP, fixD, goalCycle, goalCur, goalTarget, projected };
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  renderHeader();
  renderSummary();
  renderCash();
  renderInstallments();
  renderEntity("receivables", "receber", "Recebido");
  renderEntity("payables", "pagar", "Pago");
  renderFixed();
  renderGoals();
  renderHistory();
  renderSetup();
}
window.render = render;

function renderHeader() {
  const c = cycle();
  cycleTitle.textContent = c ? c.name : "Nenhum ciclo";
  cycleDates.textContent = c ? `${dbr(c.start)} a ${dbr(c.end)}` : "Gere ciclos no Perfil";
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function renderSummary() {
  const c = calc();
  summary.innerHTML = `
    <div class="cards">
      <div class="card">
        <small>Renda realizada</small>
        <strong>${money(c.income)}</strong>
        <span>Previsto: ${money(c.incomePlanned)}</span>
      </div>
      <div class="card">
        <small>A receber</small>
        <strong class="green">${money(c.recP)}</strong>
        <span>${pending(state.receivables).length} pendências</span>
      </div>
      <div class="card">
        <small>A pagar</small>
        <strong class="red">${money(c.payP)}</strong>
        <span>${pending(state.payables).length} pendências</span>
      </div>
      <div class="card">
        <small>Reservas do ciclo</small>
        <strong>${money(c.goalCycle)}</strong>
        <span>Impacta a sobra</span>
      </div>
      <div class="card">
        <small>Sobra projetada</small>
        <strong>${money(c.projected)}</strong>
        <span>Como termino o ciclo</span>
      </div>
    </div>
    <div class="grid two">
      <div class="panel">
        <h2>Resumo rápido</h2>
        <table><tbody>
          <tr><td>Compras à vista</td><td>${money(c.cash)}</td></tr>
          <tr><td>Parcelas cartão</td><td>${money(c.inst)}</td></tr>
          <tr><td>Contas fixas pendentes</td><td>${money(c.fixP)}</td></tr>
          <tr><td>A pagar</td><td>${money(c.payP)}</td></tr>
          <tr><td>Reservas do ciclo</td><td>${money(c.goalCycle)}</td></tr>
          <tr><td>A receber</td><td>${money(c.recP)}</td></tr>
        </tbody></table>
      </div>
      <div class="panel">
        <h2>Atenção</h2>
        ${attentionHtml()}
      </div>
    </div>`;
}

function attentionHtml() {
  const items = [
    ...pending(state.payables).slice(0, 2).map(i => [`Pagar ${i.entity}`, i.description, i.value, "red"]),
    ...pending(state.receivables).slice(0, 2).map(i => [`Receber de ${i.entity}`, i.description, i.value, "green"]),
    ...state.fixedBills.filter(i => i.status === "Pendente").slice(0, 2).map(i => [`Pagar ${i.name}`, `Dia ${i.dueDay}`, i.actualValue ?? i.expectedValue, "red"])
  ];
  return items.length
    ? items.map(i => `<div class="item"><div><strong>${escape(i[0])}</strong>${tags([i[1]])}</div><div class="money ${i[3]}">${money(i[2])}</div></div>`).join("")
    : empty("Nenhuma pendência cadastrada.");
}

// ─── Cash ─────────────────────────────────────────────────────────────────────

function renderCash() {
  const c = calc();
  cash.innerHTML = `
    <div class="cards">
      <div class="card"><small>À vista</small><strong>${money(c.cash)}</strong><span>${state.cashExpenses.length} itens</span></div>
      <div class="card"><small>Compartilhados</small><strong>${money(c.shared)}</strong><span>Gera A Receber</span></div>
      <div class="card"><small>Categorias</small><strong>${new Set(state.cashExpenses.map(i => i.category)).size}</strong><span>No ciclo</span></div>
    </div>
    <div class="grid two">
      <div class="panel">
        <h2 id="cashTitle">Nova compra à vista</h2>
        <form id="cashForm">
          ${currentCycleHtml()}
          <input type="hidden" id="cashId">
          <input id="cashDesc" placeholder="Descrição" required>
          <input id="cashDate" type="date" required>
          <input id="cashValue" type="number" min="0" step="0.01" placeholder="Valor" required>
          <select id="cashCat">${options(state.categories)}</select>
          <select id="cashShared">
            <option>Não compartilhado</option>
            <option>Compartilhado / reembolso</option>
          </select>
          <input id="cashEntity" class="hidden" placeholder="Quem deve?">
          <input id="cashSharedValue" class="hidden" type="number" min="0" step="0.01" placeholder="Valor devido">
          <textarea id="cashNotes" placeholder="Observações"></textarea>
          <div class="actions full">
            <button class="primary">Salvar</button>
            <button type="button" class="secondary" onclick="render()">Limpar</button>
          </div>
        </form>
      </div>
      <div class="panel">
        <h2>Compras à vista</h2>
        ${cashList()}
      </div>
    </div>`;
  cashDate.value = new Date().toISOString().slice(0, 10);
  cashShared.onchange = () => {
    const show = cashShared.value.includes("Compartilhado");
    cashEntity.classList.toggle("hidden", !show);
    cashSharedValue.classList.toggle("hidden", !show);
  };
  cashForm.onsubmit = e => {
    e.preventDefault();
    const id = cashId.value || uid("cash"),
      old = state.cashExpenses.find(i => i.id === id),
      date = cashDate.value;
    if (!validateDate(date, "Data do gasto")) return;
    const item = {
      id,
      description: cashDesc.value.trim(),
      date,
      value: Number(cashValue.value || 0),
      category: cashCat.value,
      shared: cashShared.value.includes("Compartilhado"),
      sharedEntity: cashEntity.value.trim(),
      sharedValue: Number(cashSharedValue.value || 0),
      notes: cashNotes.value.trim(),
      receivableId: old?.receivableId || null
    };
    if (!item.description || item.value <= 0) return alert("Preencha descrição e valor.");
    if (item.shared && item.sharedValue > 0) {
      const rid = item.receivableId || uid("rec");
      item.receivableId = rid;
      const rec = {
        id: rid,
        entity: item.sharedEntity || "Sem entidade",
        description: item.description,
        value: item.sharedValue,
        dueDate: item.date,
        status: state.receivables.find(r => r.id === rid)?.status || "Pendente"
      };
      upsert(state.receivables, rec);
      db.upsertReceivable(rec).catch(dbErr);
    } else if (item.receivableId) {
      db.deleteReceivable(item.receivableId).catch(dbErr);
      remove(state.receivables, item.receivableId);
      item.receivableId = null;
    }
    upsert(state.cashExpenses, item);
    render();
    db.upsertCash(item).catch(dbErr);
  };
  bindCash();
}

function cashList() {
  return state.cashExpenses.length
    ? state.cashExpenses.map(i => `
        <div class="item">
          <div>
            <strong>${escape(i.description)}</strong>
            ${tags([dbr(i.date), i.category, i.shared ? `Compartilhado: ${i.sharedEntity}` : null])}
            <div class="item-actions">
              <button class="secondary" data-edit-cash="${i.id}">Editar</button>
              <button class="danger" data-del-cash="${i.id}">Excluir</button>
            </div>
          </div>
          <div class="money">${money(i.value)}</div>
        </div>`).join("")
    : empty("Nenhum gasto à vista.");
}

function bindCash() {
  document.querySelectorAll("[data-edit-cash]").forEach(b => b.onclick = () => {
    const i = state.cashExpenses.find(x => x.id === b.dataset.editCash);
    cashTitle.textContent = "Editar compra à vista";
    cashId.value = i.id;
    cashDesc.value = i.description;
    cashDate.value = i.date;
    cashValue.value = i.value;
    cashCat.value = i.category;
    cashShared.value = i.shared ? "Compartilhado / reembolso" : "Não compartilhado";
    cashEntity.value = i.sharedEntity || "";
    cashSharedValue.value = i.sharedValue || "";
    cashEntity.classList.toggle("hidden", !i.shared);
    cashSharedValue.classList.toggle("hidden", !i.shared);
    cashNotes.value = i.notes || "";
  });
  document.querySelectorAll("[data-del-cash]").forEach(b => b.onclick = () => {
    if (!confirm("Excluir gasto?")) return;
    const i = state.cashExpenses.find(x => x.id === b.dataset.delCash);
    if (i?.receivableId) {
      remove(state.receivables, i.receivableId);
      db.deleteReceivable(i.receivableId).catch(dbErr);
    }
    remove(state.cashExpenses, b.dataset.delCash);
    render();
    db.deleteCash(b.dataset.delCash).catch(dbErr);
  });
}

// ─── Installments ─────────────────────────────────────────────────────────────

function renderInstallments() {
  const c = calc();
  installments.innerHTML = `
    <div class="cards">
      <div class="card"><small>Fatura atual</small><strong>${money(c.inst)}</strong><span>Valor deste ciclo</span></div>
      <div class="card"><small>Ativas</small><strong>${state.installments.length}</strong><span>Compras parceladas</span></div>
      <div class="card"><small>Futuro</small><strong>${money(c.instFuture)}</strong><span>Próximos ciclos</span></div>
    </div>
    <div class="grid two">
      <div class="panel">
        <h2 id="instTitle">Nova compra parcelada</h2>
        <form id="instForm">
          ${currentCycleHtml()}
          <input type="hidden" id="instId">
          <input id="instDesc" placeholder="Descrição" required>
          <input id="instDate" type="date" required>
          <input id="instTotal" type="number" min="0" step="0.01" placeholder="Valor total" required>
          <input id="instN" type="number" min="1" step="1" placeholder="Parcelas" required>
          <input id="instCurrent" type="number" min="1" step="1" placeholder="Parcela atual" required>
          <select id="instCat">${options(state.categories)}</select>
          <textarea id="instNotes" placeholder="Observações"></textarea>
          <div class="actions full">
            <button class="primary">Salvar</button>
            <button type="button" class="secondary" onclick="render()">Limpar</button>
          </div>
        </form>
      </div>
      <div class="panel">
        <h2>Compras parceladas</h2>
        ${instList()}
      </div>
    </div>`;
  instDate.value = new Date().toISOString().slice(0, 10);
  instForm.onsubmit = e => {
    e.preventDefault();
    if (!validateDate(instDate.value, "Data da compra parcelada")) return;
    const item = {
      id: instId.value || uid("inst"),
      description: instDesc.value.trim(),
      date: instDate.value,
      totalValue: Number(instTotal.value || 0),
      installments: Number(instN.value || 1),
      currentInstallment: Number(instCurrent.value || 1),
      category: instCat.value,
      notes: instNotes.value.trim()
    };
    if (!item.description || item.totalValue <= 0) return alert("Preencha descrição e valor.");
    upsert(state.installments, item);
    render();
    db.upsertInst(item).catch(dbErr);
  };
  bindInst();
}

function instList() {
  return state.installments.length
    ? state.installments.map(i => {
        const val = instVal(i), rest = Math.max(0, Number(i.installments) - Number(i.currentInstallment));
        return `
          <div class="item">
            <div>
              <strong>${escape(i.description)}</strong>
              ${tags([dbr(i.date), i.category, `${i.currentInstallment}/${i.installments}`, `${money(val)} neste ciclo`, `${rest} restantes`])}
              <div class="item-actions">
                <button class="secondary" data-edit-inst="${i.id}">Editar</button>
                <button class="danger" data-del-inst="${i.id}">Excluir</button>
              </div>
            </div>
            <div class="money">${money(val)}</div>
          </div>`;
      }).join("")
    : empty("Nenhuma parcelada.");
}

function bindInst() {
  document.querySelectorAll("[data-edit-inst]").forEach(b => b.onclick = () => {
    const i = state.installments.find(x => x.id === b.dataset.editInst);
    instTitle.textContent = "Editar parcelada";
    instId.value = i.id;
    instDesc.value = i.description;
    instDate.value = i.date;
    instTotal.value = i.totalValue;
    instN.value = i.installments;
    instCurrent.value = i.currentInstallment;
    instCat.value = i.category;
    instNotes.value = i.notes || "";
  });
  document.querySelectorAll("[data-del-inst]").forEach(b => b.onclick = () => {
    if (!confirm("Excluir parcelada?")) return;
    const id = b.dataset.delInst;
    remove(state.installments, id);
    render();
    db.deleteInst(id).catch(dbErr);
  });
}

// ─── Receivables / Payables ───────────────────────────────────────────────────

function renderEntity(key, label, doneStatus) {
  const list = state[key],
    view = document.getElementById(key),
    isRec = key === "receivables",
    pendingTotal = sum(pending(list)),
    doneTotal = sum(done(list, doneStatus));
  view.innerHTML = `
    <div class="cards">
      <div class="card">
        <small>Total a ${label}</small>
        <strong class="${isRec ? "green" : "red"}">${money(pendingTotal)}</strong>
        <span>${pending(list).length} pendências</span>
      </div>
      <div class="card">
        <small>${doneStatus}</small>
        <strong>${money(doneTotal)}</strong>
        <span>No ciclo</span>
      </div>
    </div>
    <div class="grid two">
      <div class="panel">
        <h2 id="${key}Title">Novo valor a ${label}</h2>
        <form id="${key}Form">
          ${currentCycleHtml()}
          <input type="hidden" id="${key}Id">
          <input id="${key}Entity" placeholder="Pessoa/entidade" required>
          <input id="${key}Desc" placeholder="Descrição" required>
          <input id="${key}Value" type="number" min="0" step="0.01" placeholder="Valor" required>
          <input id="${key}Date" type="date">
          <div class="actions full">
            <button class="primary">Salvar</button>
            <button type="button" class="secondary" onclick="render()">Limpar</button>
          </div>
        </form>
      </div>
      <div class="panel">
        <h2>Agrupado</h2>
        ${groupsHtml(list)}
        <h2 class="gap">Lançamentos</h2>
        ${entityListHtml(key, list, doneStatus)}
      </div>
    </div>`;
  document.getElementById(`${key}Form`).onsubmit = e => {
    e.preventDefault();
    const date = document.getElementById(`${key}Date`).value;
    if (date && !validateDate(date, "Data do lançamento")) return;
    const id = document.getElementById(`${key}Id`).value || uid(key.slice(0, 3)),
      old = list.find(i => i.id === id),
      item = {
        id,
        entity: document.getElementById(`${key}Entity`).value.trim(),
        description: document.getElementById(`${key}Desc`).value.trim(),
        value: Number(document.getElementById(`${key}Value`).value || 0),
        dueDate: date,
        status: old?.status || "Pendente"
      };
    if (!item.entity || !item.description || item.value <= 0) return alert("Preencha entidade, descrição e valor.");
    upsert(list, item);
    render();
    (isRec ? db.upsertReceivable(item) : db.upsertPayable(item)).catch(dbErr);
  };
  bindEntity(key, doneStatus);
}

function groupsHtml(list) {
  const g = groupByEntity(list);
  return g.length
    ? g.map(([k, v]) => `<div class="group"><strong>${escape(k)}</strong><span class="money">${money(v)}</span></div>`).join("")
    : empty("Nenhuma pendência agrupada.");
}

function entityListHtml(key, list, doneStatus) {
  return list.length
    ? list.map(i => `
        <div class="item">
          <div>
            <strong>${escape(i.entity)}</strong>
            ${tags([i.description, i.status, i.dueDate ? dbr(i.dueDate) : null])}
            <div class="item-actions">
              <button class="success" data-status-${key}="${i.id}">${i.status === "Pendente" ? doneStatus : "Pendente"}</button>
              <button class="secondary" data-edit-${key}="${i.id}">Editar</button>
              <button class="danger" data-del-${key}="${i.id}">Excluir</button>
            </div>
          </div>
          <div class="money">${money(i.value)}</div>
        </div>`).join("")
    : empty("Nenhum lançamento.");
}

function bindEntity(key, doneStatus) {
  const isRec = key === "receivables";
  document.querySelectorAll(`[data-status-${key}]`).forEach(b => b.onclick = () => {
    const i = state[key].find(x => x.id === b.dataset[`status${cap(key)}`]);
    if (!i) return;
    i.status = i.status === "Pendente" ? doneStatus : "Pendente";
    render();
    (isRec ? db.upsertReceivable(i) : db.upsertPayable(i)).catch(dbErr);
  });
  document.querySelectorAll(`[data-edit-${key}]`).forEach(b => b.onclick = () => {
    const i = state[key].find(x => x.id === b.dataset[`edit${cap(key)}`]);
    document.getElementById(`${key}Title`).textContent = "Editar lançamento";
    document.getElementById(`${key}Id`).value = i.id;
    document.getElementById(`${key}Entity`).value = i.entity;
    document.getElementById(`${key}Desc`).value = i.description;
    document.getElementById(`${key}Value`).value = i.value;
    document.getElementById(`${key}Date`).value = i.dueDate || "";
  });
  document.querySelectorAll(`[data-del-${key}]`).forEach(b => b.onclick = () => {
    if (!confirm("Excluir lançamento?")) return;
    const id = b.dataset[`del${cap(key)}`];
    remove(state[key], id);
    render();
    (isRec ? db.deleteReceivable(id) : db.deletePayable(id)).catch(dbErr);
  });
}

function cap(x) {
  return x.charAt(0).toUpperCase() + x.slice(1);
}

// ─── Fixed Bills ──────────────────────────────────────────────────────────────

function renderFixed() {
  fixed.innerHTML = `
    <div class="grid two">
      <div class="panel">
        <h2 id="fixedTitle">Nova conta fixa</h2>
        <form id="fixedForm">
          ${currentCycleHtml()}
          <input type="hidden" id="fixedId">
          <input id="fixedName" placeholder="Nome" required>
          <select id="fixedType">
            <option>Valor fixo</option>
            <option>Valor variável</option>
          </select>
          <input id="fixedValue" type="number" min="0" step="0.01" placeholder="Valor previsto" required>
          <select id="fixedFreq">
            <option>Mensal</option>
            <option>Semanal</option>
            <option>Anual</option>
          </select>
          <input id="fixedDay" type="number" min="1" max="31" placeholder="Dia de vencimento" required>
          <select id="fixedEnd">
            <option>Sem fim definido</option>
            <option>Até uma data</option>
            <option>Por ocorrências</option>
          </select>
          <select id="fixedCat">${options(state.categories)}</select>
          <div class="actions full">
            <button class="primary">Salvar</button>
            <button type="button" class="secondary" onclick="render()">Limpar</button>
          </div>
        </form>
      </div>
      <div class="panel">
        <h2>Contas do ciclo</h2>
        ${fixedList()}
      </div>
    </div>`;
  fixedForm.onsubmit = e => {
    e.preventDefault();
    const old = state.fixedBills.find(i => i.id === fixedId.value),
      ex = Number(fixedValue.value || 0),
      item = {
        id: fixedId.value || uid("fix"),
        name: fixedName.value.trim(),
        valueType: fixedType.value,
        expectedValue: ex,
        actualValue: old?.actualValue ?? ex,
        frequency: fixedFreq.value,
        dueDay: Number(fixedDay.value || 1),
        endType: fixedEnd.value,
        category: fixedCat.value,
        status: old?.status || "Pendente"
      };
    if (!item.name || item.expectedValue <= 0) return alert("Preencha nome e valor.");
    upsert(state.fixedBills, item);
    render();
    db.upsertFixed(item).catch(dbErr);
  };
  bindFixed();
}

function fixedList() {
  return state.fixedBills.length
    ? state.fixedBills.map(i => `
        <div class="item">
          <div>
            <strong>${escape(i.name)}</strong>
            ${tags([i.category, i.frequency, `dia ${i.dueDay}`, i.valueType, i.status])}
            <div class="item-actions">
              <button class="success" data-status-fixed="${i.id}">${i.status === "Pendente" ? "Pago" : "Pendente"}</button>
              <button class="secondary" data-edit-fixed="${i.id}">Editar</button>
              <button class="danger" data-del-fixed="${i.id}">Excluir</button>
            </div>
          </div>
          <div class="money">${money(i.actualValue ?? i.expectedValue)}</div>
        </div>`).join("")
    : empty("Nenhuma conta fixa.");
}

function bindFixed() {
  document.querySelectorAll("[data-status-fixed]").forEach(b => b.onclick = () => {
    const i = state.fixedBills.find(x => x.id === b.dataset.statusFixed);
    if (!i) return;
    i.status = i.status === "Pendente" ? "Pago" : "Pendente";
    render();
    db.upsertFixed(i).catch(dbErr);
  });
  document.querySelectorAll("[data-edit-fixed]").forEach(b => b.onclick = () => {
    const i = state.fixedBills.find(x => x.id === b.dataset.editFixed);
    fixedTitle.textContent = "Editar conta fixa";
    fixedId.value = i.id;
    fixedName.value = i.name;
    fixedType.value = i.valueType;
    fixedValue.value = i.expectedValue;
    fixedFreq.value = i.frequency;
    fixedDay.value = i.dueDay;
    fixedEnd.value = i.endType;
    fixedCat.value = i.category;
  });
  document.querySelectorAll("[data-del-fixed]").forEach(b => b.onclick = () => {
    if (!confirm("Excluir conta fixa?")) return;
    const id = b.dataset.delFixed;
    remove(state.fixedBills, id);
    render();
    db.deleteFixed(id).catch(dbErr);
  });
}

// ─── Goals ────────────────────────────────────────────────────────────────────

function renderGoals() {
  const c = calc(), progress = c.goalTarget ? Math.round(c.goalCur / c.goalTarget * 100) : 0;
  goals.innerHTML = `
    <div class="cards">
      <div class="card"><small>Meta total</small><strong>${money(c.goalTarget)}</strong><span>Objetivos</span></div>
      <div class="card"><small>Atual</small><strong>${money(c.goalCur)}</strong><span>${progress}%</span></div>
      <div class="card"><small>Aporte ciclo</small><strong>${money(c.goalCycle)}</strong><span>Despesa recorrente</span></div>
    </div>
    <div class="grid two">
      <div class="panel">
        <h2 id="goalTitle">Novo objetivo</h2>
        <form id="goalForm">
          ${currentCycleHtml()}
          <input type="hidden" id="goalId">
          <input id="goalName" placeholder="Nome" required>
          <input id="goalCurrent" type="number" min="0" step="0.01" placeholder="Valor atual" required>
          <input id="goalTarget" type="number" min="0" step="0.01" placeholder="Meta total" required>
          <input id="goalRecurring" type="number" min="0" step="0.01" placeholder="Aporte recorrente por ciclo">
          <input id="goalCycle" type="number" min="0" step="0.01" placeholder="Aporte deste ciclo">
          <select id="goalCat">
            <option>Reserva</option>
            <option>Casa</option>
            <option>Viagem</option>
            <option>Saúde</option>
            <option>Outros</option>
          </select>
          <div class="actions full">
            <button class="primary">Salvar</button>
            <button type="button" class="secondary" onclick="render()">Limpar</button>
          </div>
        </form>
      </div>
      <div class="panel">
        <h2>Reservas e objetivos</h2>
        ${goalList()}
      </div>
    </div>`;
  goalForm.onsubmit = e => {
    e.preventDefault();
    const rec = Number(goalRecurring.value || 0),
      item = {
        id: goalId.value || uid("goal"),
        name: goalName.value.trim(),
        current: Number(goalCurrent.value || 0),
        target: Number(goalTarget.value || 0),
        recurringContribution: rec,
        cycleContribution: Number(goalCycle.value || rec),
        category: goalCat.value
      };
    if (!item.name || item.target <= 0) return alert("Preencha nome e meta.");
    upsert(state.goals, item);
    render();
    db.upsertGoal(item).catch(dbErr);
  };
  bindGoals();
}

function goalList() {
  return state.goals.length
    ? state.goals.map(i => {
        const p = i.target ? Math.min(100, Math.round(i.current / i.target * 100)) : 0;
        return `
          <div class="item">
            <div>
              <strong>${escape(i.name)}</strong>
              ${tags([`Atual ${money(i.current)}`, `Meta ${money(i.target)}`, `Recorrente ${money(i.recurringContribution)}`, `Ciclo ${money(i.cycleContribution)}`])}
              <div class="progress"><div class="bar" style="width:${p}%"></div></div>
              <div class="item-actions">
                <button class="secondary" data-edit-goal="${i.id}">Editar</button>
                <button class="danger" data-del-goal="${i.id}">Excluir</button>
              </div>
            </div>
            <div class="money">${p}%</div>
          </div>`;
      }).join("")
    : empty("Nenhum objetivo.");
}

function bindGoals() {
  document.querySelectorAll("[data-edit-goal]").forEach(b => b.onclick = () => {
    const i = state.goals.find(x => x.id === b.dataset.editGoal);
    goalTitle.textContent = "Editar objetivo";
    goalId.value = i.id;
    goalName.value = i.name;
    goalCurrent.value = i.current;
    goalTarget.value = i.target;
    goalRecurring.value = i.recurringContribution;
    goalCycle.value = i.cycleContribution;
    goalCat.value = i.category;
  });
  document.querySelectorAll("[data-del-goal]").forEach(b => b.onclick = () => {
    if (!confirm("Excluir objetivo?")) return;
    const id = b.dataset.delGoal;
    remove(state.goals, id);
    render();
    db.deleteGoal(id).catch(dbErr);
  });
}

// ─── History ──────────────────────────────────────────────────────────────────

function renderHistory() {
  const income = sum(state.history, i => i.income),
    spent = sum(state.history, i => i.spent),
    left = sum(state.history, i => i.leftover);
  cycleHistory.innerHTML = `
    <div class="cards">
      <div class="card"><small>Ciclos encerrados</small><strong>${state.history.length}</strong></div>
      <div class="card"><small>Recebido</small><strong>${money(income)}</strong></div>
      <div class="card"><small>Gasto</small><strong>${money(spent)}</strong></div>
      <div class="card"><small>Sobra</small><strong>${money(left)}</strong></div>
    </div>
    <div class="panel">
      <h2>Snapshots</h2>
      ${state.history.length
        ? state.history.map(h => `
            <div class="item">
              <div>
                <strong>${escape(h.name)}</strong>
                ${tags([`${dbr(h.start)} a ${dbr(h.end)}`, "encerrado"])}
              </div>
              <div class="money">${money(h.leftover)}</div>
            </div>`).join("")
        : empty("Nenhum ciclo encerrado.")
      }
    </div>`;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

function categoryListHtml() {
  return `<div class="cat-tags">
    ${state.categories.map((c, idx) => `
      <span class="cat-tag">
        ${escape(c)}
        <button class="cat-remove" data-cat-idx="${idx}" title="Remover">×</button>
      </span>`).join('')}
  </div>`;
}

function renderSetup() {
  setup.innerHTML = `
    <div class="grid two">
      <div class="panel">
        <h2>Cadastro anual de ciclos</h2>
        <form id="cycleForm">
          <input id="cycleYear" type="number" min="2020" max="2100" placeholder="Ano" required>
          <select id="cycleMode">
            <option>Mês corrente</option>
            <option>Ciclo do cartão</option>
          </select>
          <input id="closeDay" type="number" min="1" max="31" placeholder="Dia fechamento cartão">
          <button class="primary full">Gerar ciclos Jan-Dez</button>
        </form>
        <h2 class="gap">Ciclos</h2>
        ${cycleList()}
        <div class="actions">
          <button class="danger" id="closeCycleBtn">Encerrar ciclo atual</button>
        </div>
        <h2 class="gap">Backup</h2>
        <div class="actions">
          <button class="secondary" id="exportBtn">Exportar JSON</button>
          <label class="file-label">Importar JSON<input id="importFile" type="file" accept=".json,application/json"></label>
          <button class="danger" id="resetBtn">Zerar</button>
        </div>
        <h2 class="gap">Categorias</h2>
        <div class="cat-input-row">
          <input id="catInput" placeholder="Nova categoria">
          <button type="button" class="secondary" id="addCatBtn">Adicionar</button>
        </div>
        ${categoryListHtml()}
      </div>
      <div class="panel">
        <h2 id="incomeTitle">Fonte de renda anual</h2>
        <form id="incomeForm">
          <input type="hidden" id="incomeId">
          <input id="incomeSource" placeholder="Fonte" required>
          <select id="incomeType">
            <option>Fixa</option>
            <option>Variável</option>
            <option>Avulsa</option>
          </select>
          <input id="incomeRecurring" type="number" min="0" step="0.01" placeholder="Valor recorrente mensal">
          ${MONTHS.map(([k, l]) => `<input id="income-${k}" type="number" min="0" step="0.01" placeholder="${l} previsto">`).join("")}
          <input id="incomeRealized" type="number" min="0" step="0.01" placeholder="Realizado no ciclo atual">
          <div class="actions full">
            <button class="primary">Salvar renda</button>
            <button type="button" class="secondary" onclick="render()">Limpar</button>
          </div>
        </form>
        <h2 class="gap">Rendas cadastradas</h2>
        ${incomeList()}
      </div>
    </div>`;
  cycleYear.value = new Date().getFullYear();
  cycleForm.onsubmit = e => {
    e.preventDefault();
    generateCycles(Number(cycleYear.value), cycleMode.value, Number(closeDay.value || 15));
    render();
    db.saveCycles(state.cycles, state.activeCycleId).catch(dbErr);
  };
  incomeForm.onsubmit = e => {
    e.preventDefault();
    const c = cycle(),
      id = incomeId.value || uid("income"),
      old = state.incomes.find(i => i.id === id),
      rec = Number(incomeRecurring.value || 0),
      plan = {};
    MONTHS.forEach(([k]) => plan[k] = Number(document.getElementById(`income-${k}`).value || rec || 0));
    const realized = old?.realized || {};
    if (c) realized[c.id] = Number(incomeRealized.value || plan[monthKey()] || rec || 0);
    const item = {
      id,
      source: incomeSource.value.trim(),
      type: incomeType.value,
      recurringValue: rec,
      plan,
      realized
    };
    if (!item.source) return alert("Informe a fonte.");
    upsert(state.incomes, item);
    render();
    db.upsertIncome(item).catch(dbErr);
  };
  bindSetup();
}

function cycleList() {
  return state.cycles.length
    ? state.cycles.map(c => `
        <div class="item">
          <div>
            <strong>${escape(c.name)}</strong>
            ${tags([`${dbr(c.start)} a ${dbr(c.end)}`, c.mode, c.id === state.activeCycleId ? "ativo" : null])}
            <div class="item-actions">
              <button class="secondary" data-active="${c.id}">Ativar</button>
            </div>
          </div>
        </div>`).join("")
    : empty("Nenhum ciclo gerado.");
}

function incomeList() {
  return state.incomes.length
    ? state.incomes.map(i => `
        <div class="item">
          <div>
            <strong>${escape(i.source)}</strong>
            ${tags([i.type, `Previsto ${money(plannedIncome(i))}`, `Realizado ${money(realizedIncome(i))}`])}
            <div class="item-actions">
              <button class="secondary" data-edit-income="${i.id}">Editar</button>
              <button class="danger" data-del-income="${i.id}">Excluir</button>
            </div>
          </div>
          <div class="money">${money(realizedIncome(i))}</div>
        </div>`).join("")
    : empty("Nenhuma renda cadastrada.");
}

function bindSetup() {
  document.querySelectorAll("[data-active]").forEach(b => b.onclick = () => {
    state.activeCycleId = b.dataset.active;
    render();
    db.saveSettings(state.activeCycleId).catch(dbErr);
  });
  document.querySelectorAll("[data-edit-income]").forEach(b => b.onclick = () => {
    const i = state.incomes.find(x => x.id === b.dataset.editIncome);
    incomeTitle.textContent = "Editar renda";
    incomeId.value = i.id;
    incomeSource.value = i.source;
    incomeType.value = i.type;
    incomeRecurring.value = i.recurringValue || "";
    MONTHS.forEach(([k]) => document.getElementById(`income-${k}`).value = i.plan?.[k] || "");
    incomeRealized.value = realizedIncome(i);
  });
  document.querySelectorAll("[data-del-income]").forEach(b => b.onclick = () => {
    if (!confirm("Excluir renda?")) return;
    const id = b.dataset.delIncome;
    remove(state.incomes, id);
    render();
    db.deleteIncome(id).catch(dbErr);
  });
  closeCycleBtn.onclick = closeCycle;
  exportBtn.onclick = exportData;
  importFile.onchange = importData;
  resetBtn.onclick = () => {
    if (confirm("Zerar tudo?")) {
      state = structuredClone(EMPTY);
      render();
      db.resetAll().catch(dbErr);
    }
  };
  addCatBtn.onclick = () => {
    const name = catInput.value.trim();
    if (!name || state.categories.includes(name)) { catInput.value = ''; return; }
    state.categories.push(name);
    catInput.value = '';
    render();
    db.saveCategories(state.categories);
  };
  catInput.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); addCatBtn.click(); }
  };
  document.querySelectorAll('[data-cat-idx]').forEach(b => b.onclick = () => {
    if (state.categories.length <= 1) return;
    state.categories.splice(Number(b.dataset.catIdx), 1);
    render();
    db.saveCategories(state.categories);
  });
}

function generateCycles(year, mode, closeDay) {
  state.cycles = Array.from({ length: 12 }, (_, i) => {
    let start, end;
    if (mode === "Mês corrente") {
      start = new Date(year, i, 1);
      end = new Date(year, i + 1, 0);
    } else {
      const prev = new Date(year, i - 1, closeDay);
      prev.setDate(prev.getDate() + 1);
      start = prev;
      end = new Date(year, i, closeDay);
    }
    return {
      id: `cycle-${year}-${i + 1}`,
      name: `${MONTHS[i][1]}/${year}`,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      mode,
      closed: false
    };
  });
  state.activeCycleId = state.cycles[0]?.id || null;
}

async function closeCycle() {
  const cy = cycle();
  if (!cy) return alert("Gere ciclos primeiro.");
  if (!confirm("Encerrar ciclo atual?")) return;
  const c = calc();
  const historyEntry = {
    id: uid("hist"),
    name: cy.name,
    start: cy.start,
    end: cy.end,
    income: c.income,
    spent: c.cash + c.inst + c.payP + c.payD + c.fixP + c.fixD + c.goalCycle,
    leftover: c.projected,
    closedAt: new Date().toISOString()
  };
  state.history.unshift(historyEntry);
  cy.closed = true;
  const idx = state.cycles.findIndex(x => x.id === cy.id);
  const nextCycleId = state.cycles[idx + 1]?.id || cy.id;
  state.activeCycleId = nextCycleId;
  state.cashExpenses = [];
  state.receivables = [];
  state.payables = [];
  const survivors = state.installments
    .filter(i => Number(i.currentInstallment) < Number(i.installments))
    .map(i => ({ ...i, currentInstallment: Number(i.currentInstallment) + 1 }));
  state.installments = survivors;
  state.fixedBills = state.fixedBills.map(i => ({ ...i, status: "Pendente" }));
  state.goals = state.goals.map(i => ({
    ...i,
    current: Number(i.current || 0) + Number(i.cycleContribution || 0),
    cycleContribution: Number(i.recurringContribution || 0)
  }));
  render();
  switchView("summary");
  db.closeCycleInDb({
    historyEntry,
    updatedCycle: cy,
    nextCycleId,
    survivors,
    updatedFixed: state.fixedBills,
    updatedGoals: state.goals
  }).catch(dbErr);
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "meu-financeiro.json";
  a.click();
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      state = JSON.parse(r.result);
      render();
      db.saveAll(state).catch(dbErr);
      alert("Importado.");
    } catch {
      alert("Arquivo inválido.");
    }
  };
  r.readAsText(file);
  e.target.value = "";
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function switchView(id) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.view === id));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
  scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".tab").forEach(b => b.onclick = () => switchView(b.dataset.view));
profileBtn.onclick = () => switchView("setup");

// ─── Init / Auth hooks (chamados pelo auth.js) ────────────────────────────────

export async function initApp() {
  try {
    state = await db.loadAll();
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    state = structuredClone(EMPTY);
  }
  render();
}

export function clearApp() {
  state = structuredClone(EMPTY);
}
