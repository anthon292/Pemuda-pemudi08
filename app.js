/*
 * Kas Keuangan RT 08
 * Isi SUPABASE_URL dan SUPABASE_ANON_KEY dengan nilai dari:
 * Supabase Dashboard > Project Settings > API.
 * Jangan pernah menaruh service_role key di browser.
 */
const SUPABASE_URL = "https://kaspemuda-pemudi08.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AXOpKtg6JIM2_6wASk7dsQ_0UAbQ_QH";

const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const authMessage = document.getElementById("authMessage");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");
const roleBadge = document.getElementById("roleBadge");
const adminFormWrap = document.getElementById("adminFormWrap");
const transactionForm = document.getElementById("transactionForm");
const transactionMessage = document.getElementById("transactionMessage");
const transactionRows = document.getElementById("transactionRows");
const monthFilter = document.getElementById("monthFilter");
const globalMessage = document.getElementById("globalMessage");

let supabaseClient = null;
let currentUser = null;
let currentRole = "warga";
let allTransactions = [];
let toastTimer = null;

const rupiah = (value) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(Number(value || 0));

const dateID = (value) => {
  if (!value) return "-";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

function showToast(message) {
  globalMessage.textContent = message;
  globalMessage.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => globalMessage.classList.add("hidden"), 4200);
}

function setMessage(element, message, isError = true) {
  element.textContent = message;
  element.style.color = isError ? "#b42318" : "#166534";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function initSupabase() {
  if (SUPABASE_URL.startsWith("GANTI_") || SUPABASE_ANON_KEY.startsWith("GANTI_")) {
    setMessage(authMessage, "Konfigurasi Supabase belum diisi. Buka app.js dan isi URL serta publishable/anon key.");
    loginForm.querySelector('button[type="submit"]').disabled = true;
    return false;
  }
  if (!window.supabase?.createClient) {
    setMessage(authMessage, "Library Supabase gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.");
    return false;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}

async function getProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles").select("nama, role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Profil belum tersedia. Hubungi admin RT untuk mengaktifkan akun.");
  return data;
}

async function handleSession(session) {
  if (!session?.user) {
    currentUser = null;
    currentRole = "warga";
    authView.classList.remove("hidden");
    appView.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    return;
  }

  currentUser = session.user;
  try {
    const profile = await getProfile(currentUser.id);
    currentRole = profile.role;
    userLabel.textContent = `${profile.nama} · ${currentUser.email}`;
    roleBadge.textContent = currentRole === "admin" ? "Admin" : "Warga";
    adminFormWrap.classList.toggle("hidden", currentRole !== "admin");
    document.getElementById("actionHeader").classList.toggle("hidden", currentRole !== "admin");
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    await loadTransactions();
  } catch (error) {
    console.error(error);
    setMessage(authMessage, error.message || "Gagal memuat profil.");
    await supabaseClient.auth.signOut();
    authView.classList.remove("hidden");
    appView.classList.add("hidden");
    logoutBtn.classList.add("hidden");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(authMessage, "Sedang masuk...", false);
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  button.disabled = false;
  if (error) {
    setMessage(authMessage, "Login gagal. Periksa email dan kata sandi, lalu coba lagi.");
    return;
  }
  setMessage(authMessage, "");
  await handleSession(data.session);
});

logoutBtn.addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) showToast("Gagal keluar. Silakan coba lagi.");
  else showToast("Anda sudah keluar.");
});

monthFilter.addEventListener("change", renderTransactions);

async function loadTransactions() {
  transactionRows.innerHTML = '<tr><td colspan="7" class="empty-state">Memuat transaksi...</td></tr>';
  const { data, error } = await supabaseClient
    .from("transaksi_kas")
    .select("id, tanggal, jenis, kategori, keterangan, jumlah, created_at")
    .order("tanggal", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    transactionRows.innerHTML = '<tr><td colspan="7" class="empty-state">Data tidak dapat dimuat. Periksa kebijakan RLS Supabase.</td></tr>';
    showToast("Gagal memuat transaksi.");
    return;
  }
  allTransactions = data || [];
  updateSummary();
  renderTransactions();
}

function updateSummary() {
  const income = allTransactions.filter(t => t.jenis === "pemasukan")
    .reduce((sum, t) => sum + Number(t.jumlah), 0);
  const expense = allTransactions.filter(t => t.jenis === "pengeluaran")
    .reduce((sum, t) => sum + Number(t.jumlah), 0);
  document.getElementById("incomeValue").textContent = rupiah(income);
  document.getElementById("expenseValue").textContent = rupiah(expense);
  document.getElementById("balanceValue").textContent = rupiah(income - expense);
}

function renderTransactions() {
  const month = monthFilter.value;
  const filtered = allTransactions.filter(t => !month || String(t.tanggal).slice(0, 7) === month);
  let running = 0;
  const rows = filtered.map(t => {
    const amount = Number(t.jumlah);
    running += t.jenis === "pemasukan" ? amount : -amount;
    const isIncome = t.jenis === "pemasukan";
    const actionCell = currentRole === "admin"
      ? `<td><div class="action-buttons">
          <button class="mini-button" data-action="edit" data-id="${escapeHTML(t.id)}">Edit</button>
          <button class="mini-button delete" data-action="delete" data-id="${escapeHTML(t.id)}">Hapus</button>
        </div></td>` : "";
    return `<tr>
      <td>${dateID(t.tanggal)}</td>
      <td><span class="type-pill ${isIncome ? "type-income" : "type-expense"}">${isIncome ? "Pemasukan" : "Pengeluaran"}</span></td>
      <td><strong>${escapeHTML(t.kategori)}</strong><span class="description">${escapeHTML(t.keterangan)}</span></td>
      <td class="number money-income">${isIncome ? rupiah(amount) : "—"}</td>
      <td class="number money-expense">${!isIncome ? rupiah(amount) : "—"}</td>
      <td class="number">${rupiah(running)}</td>
      ${actionCell}
    </tr>`;
  });
  if (!rows.length) {
    transactionRows.innerHTML = `<tr><td colspan="${currentRole === "admin" ? 7 : 6}" class="empty-state">Belum ada transaksi untuk periode ini.</td></tr>`;
    return;
  }
  transactionRows.innerHTML = rows.join("");
}

transactionRows.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || currentRole !== "admin") return;
  const transaction = allTransactions.find(t => t.id === button.dataset.id);
  if (!transaction) return;
  if (button.dataset.action === "edit") {
    document.getElementById("transactionId").value = transaction.id;
    document.getElementById("transactionDate").value = transaction.tanggal;
    document.getElementById("transactionType").value = transaction.jenis;
    document.getElementById("transactionCategory").value = transaction.kategori;
    document.getElementById("transactionAmount").value = transaction.jumlah;
    document.getElementById("transactionDescription").value = transaction.keterangan;
    document.getElementById("formTitle").textContent = "Edit transaksi";
    document.getElementById("saveTransactionBtn").textContent = "Simpan perubahan";
    document.getElementById("cancelEditBtn").classList.remove("hidden");
    adminFormWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (button.dataset.action === "delete") {
    const confirmed = window.confirm(`Hapus transaksi "${transaction.kategori}" sebesar ${rupiah(transaction.jumlah)}? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;
    const { error } = await supabaseClient.from("transaksi_kas").delete().eq("id", transaction.id);
    if (error) {
      console.error(error);
      showToast("Transaksi gagal dihapus. Periksa hak akses admin.");
    } else {
      showToast("Transaksi berhasil dihapus.");
      await loadTransactions();
    }
  }
});

function resetTransactionForm() {
  transactionForm.reset();
  document.getElementById("transactionId").value = "";
  document.getElementById("transactionDate").value = new Date().toLocaleDateString("en-CA");
  document.getElementById("formTitle").textContent = "Tambah transaksi";
  document.getElementById("saveTransactionBtn").textContent = "Simpan transaksi";
  document.getElementById("cancelEditBtn").classList.add("hidden");
  setMessage(transactionMessage, "");
}
document.getElementById("cancelEditBtn").addEventListener("click", resetTransactionForm);

transactionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (currentRole !== "admin") {
    setMessage(transactionMessage, "Hanya admin yang boleh mengubah transaksi.");
    return;
  }
  const id = document.getElementById("transactionId").value;
  const payload = {
    tanggal: document.getElementById("transactionDate").value,
    jenis: document.getElementById("transactionType").value,
    kategori: document.getElementById("transactionCategory").value.trim(),
    jumlah: Number(document.getElementById("transactionAmount").value),
    keterangan: document.getElementById("transactionDescription").value.trim()
  };
  if (!payload.tanggal || !payload.kategori || !payload.keterangan || !Number.isFinite(payload.jumlah) || payload.jumlah <= 0) {
    setMessage(transactionMessage, "Lengkapi semua kolom dengan nilai yang benar.");
    return;
  }
  const button = document.getElementById("saveTransactionBtn");
  button.disabled = true;
  setMessage(transactionMessage, "Menyimpan...", false);
  let result;
  if (id) {
    result = await supabaseClient.from("transaksi_kas").update(payload).eq("id", id);
  } else {
    result = await supabaseClient.from("transaksi_kas").insert({
      ...payload, dibuat_oleh: currentUser.id
    });
  }
  button.disabled = false;
  if (result.error) {
    console.error(result.error);
    setMessage(transactionMessage, "Gagal menyimpan. Pastikan akun admin dan kebijakan RLS sudah benar.");
    return;
  }
  resetTransactionForm();
  showToast(id ? "Perubahan transaksi tersimpan." : "Transaksi berhasil ditambahkan.");
  await loadTransactions();
});

document.getElementById("pdfBtn").addEventListener("click", () => {
  if (!window.jspdf?.jsPDF) {
    showToast("Library PDF gagal dimuat. Periksa koneksi internet.");
    return;
  }
  const month = monthFilter.value;
  const filtered = allTransactions.filter(t => !month || String(t.tanggal).slice(0, 7) === month);
  const income = filtered.filter(t => t.jenis === "pemasukan").reduce((s, t) => s + Number(t.jumlah), 0);
  const expense = filtered.filter(t => t.jenis === "pengeluaran").reduce((s, t) => s + Number(t.jumlah), 0);
  const doc = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const periodLabel = month ? new Date(`${month}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "Semua Periode";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("LAPORAN KEUANGAN KAS RT 08", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Periode: ${periodLabel}`, 14, 23);
  doc.text(`Total pemasukan: ${rupiah(income)}    Total pengeluaran: ${rupiah(expense)}    Saldo bersih periode: ${rupiah(income - expense)}`, 14, 30);
  let running = 0;
  const body = filtered.map(t => {
    const amount = Number(t.jumlah);
    running += t.jenis === "pemasukan" ? amount : -amount;
    return [
      dateID(t.tanggal),
      t.jenis === "pemasukan" ? "Pemasukan" : "Pengeluaran",
      t.kategori,
      t.keterangan,
      t.jenis === "pemasukan" ? rupiah(amount) : "-",
      t.jenis === "pengeluaran" ? rupiah(amount) : "-",
      rupiah(running)
    ];
  });
  doc.autoTable({
    startY: 36,
    head: [["Tanggal", "Jenis", "Kategori", "Keterangan", "Pemasukan", "Pengeluaran", "Saldo berjalan*"]],
    body,
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: [22, 101, 52] },
    columnStyles: { 3: { cellWidth: 55 } },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.text("Dokumen laporan kas RT 08. Saldo berjalan dihitung dari transaksi pada periode yang ditampilkan.", 14, pageHeight - 7);
    }
  });
  let y = doc.lastAutoTable.finalY + 14;
  if (y > 175) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.text("Bendahara RT 08", 45, y);
  doc.text("Ketua RT 08", 220, y);
  doc.text("(________________________)", 35, y + 23);
  doc.text("(________________________)", 210, y + 23);
  doc.save(`laporan-kas-rt08-${month || "semua-periode"}.pdf`);
});

if (initSupabase()) {
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) setMessage(authMessage, "Tidak dapat memeriksa sesi login.");
    handleSession(data?.session);
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    // Hindari operasi berat di callback sinkron auth.
    setTimeout(() => handleSession(session), 0);
  });
}
