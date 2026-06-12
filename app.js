const STORAGE_KEY = "moniFinanceBridgeBaseV1";

const defaultBase = {
  version: "1.0",
  cycle: {
    start: "2026-06-15",
    end: "2026-07-15",
    initialBalance: 0
  },
  transactions: [
    {
      id: crypto.randomUUID(),
      date: "2026-06-09",
      description: "Dentista",
      value: 2380,
      category: "Saúde",
      type: "Necessidade",
      payment: "Parcelado",
      installments: 4,
      currentInstallment: 1,
      refundStatus: "Não se aplica",
      refundCompany: "",
      notes: "Compra em 4x de R$ 595. O painel considera apenas a parcela atual nos gastos do ciclo."
    },
    {
      id: crypto.randomUUID(),
      date: "2026-06-12",
      description: "Táxi Syngenta",
      value: 12.47,
      category: "Transporte",
      type: "Reembolso",
      payment: "À vista",
      installments: 1,
      currentInstallment: 1,
      refundStatus: "Pendente",
      refundCompany: "Syngenta",
      notes: "Corrida por conta de trabalho."
    }
  ]
};

let base = loadBase();
let editingId = null;

function loadBase() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultBase);
  try {
    return JSON.parse(saved);
  } catch {
    return structuredClone(defaultBase);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function parseMoney(value) {
  return Number(value || 0);
}

function formatDateBR(dateText) {
  if (!dateText) return "";
  const [year, month, day] = dateText.split("-");
  return `${day}/${month}/${year}`;
}

function valueInCycle(transaction) {
  if (transaction.payment === "Parcelado" && transaction.installments > 1) {
    return transaction.value / transaction.installments;
  }
  return transaction.value;
}

function calculate() {
  const spent = base.transactions
    .filter(item => item.type !== "Reembolso")
    .reduce((sum, item) => sum + valueInCycle(item), 0);

  const refundsPending = base.transactions
    .filter(item => item.refundStatus === "Pendente" || item.type === "Reembolso")
    .reduce((sum, item) => sum + valueInCycle(item), 0);

  const impulse = base.transactions
    .filter(item => item.type === "Impulso")
    .reduce((sum, item) => sum + valueInCycle(item), 0);

  const projected = Number(base.cycle.initialBalance || 0) - spent + refundsPending;
  const usage = base.cycle.initialBalance > 0 ? Math.min((spent / base.cycle.initialBalance) * 100, 100) : 0;

  return { spent, refundsPending, impulse, projected, usage };
}

function saveCycle() {
  base.cycle.start = document.getElementById("cycleStartInput").value || base.cycle.start;
  base.cycle.end = document.getElementById("cycleEndInput").value || base.cycle.end;
  base.cycle.initialBalance = parseMoney(document.getElementById("initialBalanceInput").value);
  persist();
  render();
}

function toggleInstallments() {
  const isInstallment = document.getElementById("paymentInput").value === "Parcelado";
  document.getElementById("installmentsInput").classList.toggle("hidden", !isInstallment);
  document.getElementById("currentInstallmentInput").classList.toggle("hidden", !isInstallment);
}

function getFormData() {
  const payment = document.getElementById("paymentInput").value;
  return {
    id: editingId || crypto.randomUUID(),
    date: document.getElementById("dateInput").value || new Date().toISOString().slice(0, 10),
    description: document.getElementById("descriptionInput").value.trim(),
    value: parseMoney(document.getElementById("valueInput").value),
    category: document.getElementById("categoryInput").value,
    type: document.getElementById("typeInput").value,
    payment,
    installments: payment === "Parcelado" ? Number(document.getElementById("installmentsInput").value || 1) : 1,
    currentInstallment: payment === "Parcelado" ? Number(document.getElementById("currentInstallmentInput").value || 1) : 1,
    refundStatus: document.getElementById("refundStatusInput").value,
    refundCompany: document.getElementById("refundCompanyInput").value.trim(),
    notes: document.getElementById("notesInput").value.trim()
  };
}

function saveTransaction() {
  const item = getFormData();

  if (!item.description || item.value <= 0) {
    alert("Preencha pelo menos descrição e valor.");
    return;
  }

  if (editingId) {
    base.transactions = base.transactions.map(transaction => transaction.id === editingId ? item : transaction);
  } else {
    base.transactions.unshift(item);
  }

  persist();
  clearForm();
  render();
}

function editTransaction(id) {
  const item = base.transactions.find(transaction => transaction.id === id);
  if (!item) return;

  editingId = id;
  document.getElementById("formTitle").textContent = "Editar lançamento";
  document.getElementById("cancelEditButton").classList.remove("hidden");

  document.getElementById("dateInput").value = item.date || "";
  document.getElementById("descriptionInput").value = item.description || "";
  document.getElementById("valueInput").value = item.value || "";
  document.getElementById("categoryInput").value = item.category || "Outros";
  document.getElementById("typeInput").value = item.type || "Necessidade";
  document.getElementById("paymentInput").value = item.payment || "À vista";
  document.getElementById("installmentsInput").value = item.installments || "";
  document.getElementById("currentInstallmentInput").value = item.currentInstallment || "";
  document.getElementById("refundStatusInput").value = item.refundStatus || "Não se aplica";
  document.getElementById("refundCompanyInput").value = item.refundCompany || "";
  document.getElementById("notesInput").value = item.notes || "";

  toggleInstallments();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteTransaction(id) {
  if (!confirm("Excluir este lançamento?")) return;
  base.transactions = base.transactions.filter(transaction => transaction.id !== id);
  persist();
  render();
}

function clearForm() {
  editingId = null;
  document.getElementById("formTitle").textContent = "Novo lançamento";
  document.getElementById("cancelEditButton").classList.add("hidden");

  document.getElementById("dateInput").value = new Date().toISOString().slice(0, 10);
  document.getElementById("descriptionInput").value = "";
  document.getElementById("valueInput").value = "";
  document.getElementById("categoryInput").value = "Saúde";
  document.getElementById("typeInput").value = "Necessidade";
  document.getElementById("paymentInput").value = "À vista";
  document.getElementById("installmentsInput").value = "";
  document.getElementById("currentInstallmentInput").value = "";
  document.getElementById("refundStatusInput").value = "Não se aplica";
  document.getElementById("refundCompanyInput").value = "";
  document.getElementById("notesInput").value = "";
  toggleInstallments();
}

function exportBase() {
  const blob = new Blob([JSON.stringify(base, null, 2)], { type: "application/json;charset=utf-8" });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `base_financeira_moni_${date}.json`);
}

function downloadCsv() {
  const headers = [
    "id", "data", "descricao", "valor_total", "valor_ciclo", "categoria", "tipo",
    "pagamento", "parcelas", "parcela_atual", "status_reembolso", "empresa_reembolso", "observacoes"
  ];

  const rows = base.transactions.map(item => [
    item.id,
    item.date,
    item.description,
    item.value,
    valueInCycle(item),
    item.category,
    item.type,
    item.payment,
    item.installments,
    item.currentInstallment,
    item.refundStatus,
    item.refundCompany,
    item.notes
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `base_financeira_moni_${date}.csv`);
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function importBase(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.transactions || !imported.cycle) {
        alert("Arquivo inválido. A base precisa ter cycle e transactions.");
        return;
      }

      base = imported;
      base.transactions = base.transactions.map(item => ({ ...item, id: item.id || crypto.randomUUID() }));
      persist();
      render();
      alert("Base importada com sucesso.");
    } catch {
      alert("Não consegui ler o JSON importado.");
    }
  };

  reader.readAsText(file);
  event.target.value = "";
}

function renderMetrics(data) {
  document.getElementById("cycleStartInput").value = base.cycle.start || "";
  document.getElementById("cycleEndInput").value = base.cycle.end || "";
  document.getElementById("initialBalanceInput").value = base.cycle.initialBalance || "";

  document.getElementById("cycleChip").textContent = `💳 Ciclo ${formatDateBR(base.cycle.start)} → ${formatDateBR(base.cycle.end)}`;

  document.getElementById("initialBalanceCard").textContent = formatMoney(base.cycle.initialBalance);
  document.getElementById("spentCard").textContent = formatMoney(data.spent);
  document.getElementById("refundCard").textContent = formatMoney(data.refundsPending);
  document.getElementById("projectedCard").textContent = formatMoney(data.projected);
  document.getElementById("impulseCard").textContent = formatMoney(data.impulse);

  const usageRounded = Math.round(data.usage);
  document.getElementById("usageLabel").textContent = `${usageRounded}% utilizado`;
  document.getElementById("donutValue").textContent = `${usageRounded}%`;
  document.getElementById("donut").style.setProperty("--p", usageRounded);

  const insight = document.getElementById("projectionInsight");

  if (!base.cycle.initialBalance) {
    insight.className = "insight";
    insight.textContent = "Informe seu saldo inicial para ativar a projeção.";
  } else if (data.projected < 0) {
    insight.className = "insight danger";
    insight.textContent = `Atenção: se o ciclo fechasse agora, faltariam ${formatMoney(Math.abs(data.projected))}.`;
  } else if (data.usage >= 75) {
    insight.className = "insight warn";
    insight.textContent = `Você já usou ${usageRounded}% do saldo. A sobra projetada é ${formatMoney(data.projected)}.`;
  } else {
    insight.className = "insight";
    insight.textContent = `Se você não gastar mais nada, sua sobra projetada será de ${formatMoney(data.projected)}.`;
  }
}

function renderTransactions() {
  const list = document.getElementById("transactionsList");
  document.getElementById("transactionCount").textContent = `${base.transactions.length} ${base.transactions.length === 1 ? "item" : "itens"}`;

  if (!base.transactions.length) {
    list.innerHTML = `<p class="small">Nenhum lançamento registrado ainda.</p>`;
    return;
  }

  list.innerHTML = base.transactions.map(item => `
    <div class="transaction">
      <div>
        <strong>${formatDateBR(item.date) || ""} · ${item.description}</strong>
        <div class="tags">
          <span class="tag">${item.category}</span>
          <span class="tag">${item.type}</span>
          <span class="tag">${item.payment}</span>
          ${item.payment === "Parcelado" ? `<span class="tag">${item.currentInstallment}/${item.installments}</span>` : ""}
          ${item.refundStatus && item.refundStatus !== "Não se aplica" ? `<span class="tag">Reembolso: ${item.refundStatus}</span>` : ""}
        </div>
        ${item.notes ? `<p class="small" style="margin:8px 0 0;">${item.notes}</p>` : ""}
        <div class="transaction-actions">
          <button class="secondary" data-action="edit" data-id="${item.id}">Editar</button>
          <button class="danger" data-action="delete" data-id="${item.id}">Excluir</button>
        </div>
      </div>
      <div class="amount">
        ${formatMoney(valueInCycle(item))}
        <div class="small">${item.payment === "Parcelado" ? `total ${formatMoney(item.value)}` : ""}</div>
      </div>
    </div>
  `).join("");
}

function renderCategoryBars() {
  const container = document.getElementById("categoryBars");
  const categories = {};

  base.transactions
    .filter(item => item.type !== "Reembolso")
    .forEach(item => {
      categories[item.category] = (categories[item.category] || 0) + valueInCycle(item);
    });

  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  if (!entries.length) {
    container.innerHTML = `<p class="small">Nenhum gasto lançado ainda.</p>`;
    return;
  }

  container.innerHTML = entries.map(([category, value]) => `
    <div class="bar-item">
      <div class="bar-head">
        <span>${category}</span>
        <span>${formatMoney(value)}</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width:${(value / max) * 100}%"></div>
      </div>
    </div>
  `).join("");
}

function renderRefunds() {
  const refunds = base.transactions.filter(item => item.refundStatus === "Pendente" || item.type === "Reembolso");
  const container = document.getElementById("refundList");

  if (!refunds.length) {
    container.innerHTML = `<p class="small">Nenhum reembolso pendente.</p>`;
    return;
  }

  container.innerHTML = refunds.map(item => `
    <div class="transaction" style="grid-template-columns:1fr auto; margin-bottom:10px;">
      <div>
        <strong>${item.description}</strong>
        <div class="tags">
          <span class="tag">${item.refundStatus || "Pendente"}</span>
          ${item.refundCompany ? `<span class="tag">${item.refundCompany}</span>` : ""}
        </div>
      </div>
      <div class="amount">${formatMoney(valueInCycle(item))}</div>
    </div>
  `).join("");
}

function renderFutureInstallments() {
  const container = document.getElementById("futureInstallments");
  const future = [];

  base.transactions
    .filter(item => item.payment === "Parcelado" && item.installments > 1)
    .forEach(item => {
      const installmentValue = item.value / item.installments;
      for (let i = item.currentInstallment + 1; i <= item.installments; i++) {
        future.push({
          description: item.description,
          installment: `${i}/${item.installments}`,
          value: installmentValue
        });
      }
    });

  if (!future.length) {
    container.innerHTML = `<p class="small">Nenhum parcelamento futuro registrado.</p>`;
    return;
  }

  const max = Math.max(...future.map(item => item.value), 1);
  container.innerHTML = future.slice(0, 8).map(item => `
    <div class="bar-item">
      <div class="bar-head">
        <span>${item.description} · ${item.installment}</span>
        <span>${formatMoney(item.value)}</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width:${(item.value / max) * 100}%"></div>
      </div>
    </div>
  `).join("");
}

function render() {
  const data = calculate();
  renderMetrics(data);
  renderTransactions();
  renderCategoryBars();
  renderRefunds();
  renderFutureInstallments();
  toggleInstallments();
}

document.getElementById("saveCycleButton").addEventListener("click", saveCycle);
document.getElementById("paymentInput").addEventListener("change", toggleInstallments);
document.getElementById("saveTransactionButton").addEventListener("click", saveTransaction);
document.getElementById("clearFormButton").addEventListener("click", clearForm);
document.getElementById("cancelEditButton").addEventListener("click", clearForm);
document.getElementById("exportJsonButton").addEventListener("click", exportBase);
document.getElementById("exportCsvButton").addEventListener("click", downloadCsv);
document.getElementById("importFile").addEventListener("change", importBase);

document.getElementById("transactionsList").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "edit") editTransaction(id);
  if (action === "delete") deleteTransaction(id);
});

clearForm();
render();
