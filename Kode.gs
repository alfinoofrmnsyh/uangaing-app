// ====================================================================
// GOOGLE APPS SCRIPT BACKEND - UANGAING APP (v2.0)
// Database: Google Sheets
// ====================================================================

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// --------------------------------------------------------------------
// 1. SETUP DATABASE (Jalankan fungsi ini sekali dari editor Apps Script)
// --------------------------------------------------------------------
function setupDatabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = {
    'Users': ['userId', 'email', 'name', 'pin', 'createdAt', 'avatar'],
    'Sessions': ['token', 'userId', 'expiresAt'],
    'Wallets': ['walletId', 'ownerId', 'name', 'type', 'initialBalance', 'status', 'createdAt'],
    'WalletMembers': ['walletId', 'userId', 'role', 'joinedAt'],
    'Transactions': ['transactionId', 'walletId', 'userId', 'type', 'amount', 'categoryId', 'description', 'date', 'status'],
    'Categories': ['categoryId', 'name', 'type', 'icon', 'userId'],
    'Invites': ['token', 'walletId', 'createdBy', 'role', 'expiresAt', 'status']
  };

  for (let sheetName in sheets) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(sheets[sheetName]);
      sheet.setFrozenRows(1);
    }
  }

  // Isi default kategori jika masih kosong (sesuai request: Makan, Bensin, Jajan, dll)
  const catSheet = ss.getSheetByName('Categories');
  if (catSheet.getLastRow() <= 1) {
    const defaultCats = [
      // Kategori Pengeluaran
      ['c_makan', 'Makanan', 'expense', '🍔', 'system'],
      ['c_bensin', 'Bensin', 'expense', '⛽', 'system'],
      ['c_jajan', 'Jajan', 'expense', '🧋', 'system'],
      ['c_belanja', 'Belanja', 'expense', '🛍️', 'system'],
      ['c_transport', 'Transport', 'expense', '🚗', 'system'],
      ['c_tagihan', 'Tagihan', 'expense', '💡', 'system'],
      ['c_kesehatan', 'Kesehatan', 'expense', '💊', 'system'],
      ['c_hiburan', 'Hiburan', 'expense', '🎮', 'system'],
      ['c_lainnya_exp', 'Lainnya', 'expense', '📦', 'system'],
      // Kategori Pemasukan
      ['c_gaji', 'Gaji', 'income', '💰', 'system'],
      ['c_freelance', 'Freelance', 'income', '💻', 'system'],
      ['c_investasi', 'Investasi', 'income', '📈', 'system'],
      ['c_hadiah', 'Hadiah', 'income', '🎁', 'system'],
      ['c_penjualan', 'Penjualan', 'income', '🏷️', 'system'],
      ['c_transfer', 'Transfer', 'income', '⇄', 'system'],
      ['c_lainnya_inc', 'Lainnya', 'income', '➕', 'system']
    ];
    defaultCats.forEach(row => catSheet.appendRow(row));
  }

  return "Database setup complete. Tabel & Kategori bawaan berhasil diinisialisasi.";
}

// --------------------------------------------------------------------
// 2. ROUTER & API CONTROLLER
// --------------------------------------------------------------------
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    name: "UangAing API Backend",
    version: "2.0.0",
    status: "running",
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const action = payload.action;
    const data = payload.data || {};
    let responseData = null;

    // Rute Publik (Tanpa Token)
    if (action === 'register') {
      responseData = handleRegister(data);
    } else if (action === 'login') {
      responseData = handleLogin(data);
    } else {
      // Rute Terproteksi (Wajib Token Valid)
      const userId = validateSession(payload.token);
      if (!userId) throw new Error("UNAUTHORIZED");

      switch (action) {
        // Dashboard & Ringkasan
        case 'getDashboard': responseData = getDashboard(userId); break;

        // Manajemen Wallet
        case 'getWallets': responseData = getWallets(userId); break;
        case 'createWallet': responseData = createWallet(userId, data); break;
        case 'updateWallet': responseData = updateWallet(userId, data); break;
        case 'deleteWallet': responseData = deleteWallet(userId, data.walletId); break;

        // Manajemen Transaksi
        case 'getTransactions': responseData = getTransactions(userId, data.walletId); break;
        case 'createTransaction': responseData = createTransaction(userId, data); break;
        case 'deleteTransaction': responseData = deleteTransaction(userId, data.transactionId); break;
        case 'transferWallet': responseData = transferWallet(userId, data); break;

        // Manajemen Kategori (Fitur Baru: Emoticon & Kategori)
        case 'getCategories': responseData = getCategories(userId); break;
        case 'createCategory': responseData = createCategory(userId, data); break;
        case 'deleteCategory': responseData = deleteCategory(userId, data.categoryId); break;

        // Profil & Akun
        case 'getProfile': responseData = getProfile(userId); break;
        case 'updateProfile': responseData = updateProfile(userId, data); break;

        // Kolaborasi & Invite
        case 'createInvite': responseData = createInvite(userId, data); break;
        case 'joinWallet': responseData = joinWallet(userId, data.inviteToken); break;
        case 'logout': responseData = handleLogout(payload.token); break;

        default: throw new Error("INVALID_ACTION: " + action);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      data: responseData 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    let code = error.message === "UNAUTHORIZED" ? "UNAUTHORIZED" : 
               error.message === "FORBIDDEN" ? "FORBIDDEN" : "SERVER_ERROR";
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: { code: code, message: error.message }
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON);
}

// --------------------------------------------------------------------
// 3. AUTHENTICATION & SESSION MANAGEMENT
// --------------------------------------------------------------------
function handleRegister(data) {
  const usersSheet = getSheet('Users');
  const existing = findRow(usersSheet, 1, data.email);
  if (existing) throw new Error("Email sudah terdaftar");

  const userId = generateId('U');
  const name = data.name || data.email.split('@')[0];
  const avatar = data.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80';
  
  usersSheet.appendRow([userId, data.email, name, data.pin, new Date().toISOString(), avatar]);
  
  // Buat 3 wallet bawaan sesuai tema UI: GoPay, BCA, Tunai
  createWallet(userId, { name: 'GoPay', type: 'E-Wallet', initialBalance: 0 });
  createWallet(userId, { name: 'BCA', type: 'Bank', initialBalance: 0 });
  createWallet(userId, { name: 'Tunai', type: 'Tunai', initialBalance: 0 });
  
  // Generate session login otomatis
  const token = generateId('T') + generateId('');
  const sessionsSheet = getSheet('Sessions');
  const expires = new Date();
  expires.setDate(expires.getDate() + 30); // 30 hari

  sessionsSheet.appendRow([token, userId, expires.toISOString()]);
  
  return { 
    token: token, 
    user: { id: userId, name: name, email: data.email, avatar: avatar },
    message: "Registrasi berhasil" 
  };
}

function handleLogin(data) {
  const usersSheet = getSheet('Users');
  const records = getRecords(usersSheet);
  const user = records.find(r => r.email === data.email && String(r.pin) === String(data.pin));
  
  if (!user) throw new Error("Email atau PIN salah");

  const token = generateId('T') + generateId('');
  const sessionsSheet = getSheet('Sessions');
  const expires = new Date();
  expires.setDate(expires.getDate() + 30); // 30 hari

  sessionsSheet.appendRow([token, user.userId, expires.toISOString()]);
  
  return { 
    token: token, 
    user: { 
      id: user.userId, 
      name: user.name, 
      email: user.email,
      avatar: user.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80'
    } 
  };
}

function validateSession(token) {
  if (!token) return null;
  const sessionsSheet = getSheet('Sessions');
  const records = getRecords(sessionsSheet);
  const session = records.find(r => r.token === token && new Date(r.expiresAt) > new Date());
  return session ? session.userId : null;
}

function handleLogout(token) {
  const sheet = getSheet('Sessions');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return { message: "Logged out" };
}

// --------------------------------------------------------------------
// 4. WALLET MANAGEMENT
// --------------------------------------------------------------------
function getWallets(userId) {
  const wallets = getRecords(getSheet('Wallets')).filter(w => w.status !== 'deleted');
  const members = getRecords(getSheet('WalletMembers'));
  
  // Wallet milik sendiri & wallet yang dibagikan
  const myWallets = wallets.filter(w => w.ownerId === userId);
  const sharedWalletIds = members.filter(m => m.userId === userId).map(m => m.walletId);
  const sharedWallets = wallets.filter(w => sharedWalletIds.includes(w.walletId));
  const allWallets = [...myWallets, ...sharedWallets];
  
  // Ambil transaksi untuk hitung saldo dinamis & ringkasan bulan ini
  const transactions = getRecords(getSheet('Transactions')).filter(t => t.status !== 'deleted');
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  allWallets.forEach(w => {
    let balance = parseFloat(w.initialBalance || 0);
    let incomeMonth = 0;
    let expenseMonth = 0;
    let txCount = 0;

    const wTx = transactions.filter(t => t.walletId === w.walletId);
    txCount = wTx.length;

    wTx.forEach(t => {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income') balance += amt;
      if (t.type === 'expense') balance -= amt;

      const d = new Date(t.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        if (t.type === 'income') incomeMonth += amt;
        if (t.type === 'expense') expenseMonth += amt;
      }
    });

    w.currentBalance = balance;
    w.incomeMonth = incomeMonth;
    w.expenseMonth = expenseMonth;
    w.transactionsCount = txCount;
  });

  return allWallets;
}

function createWallet(userId, data) {
  const sheet = getSheet('Wallets');
  const walletId = generateId('W');
  const type = data.type || (data.name.toLowerCase().includes('bank') ? 'Bank' : (data.name.toLowerCase().includes('tunai') ? 'Tunai' : 'E-Wallet'));
  
  sheet.appendRow([
    walletId, 
    userId, 
    data.name, 
    type, 
    parseFloat(data.initialBalance || 0), 
    'active', 
    new Date().toISOString()
  ]);
  return { walletId: walletId, name: data.name, type: type };
}

function updateWallet(userId, data) {
  const sheet = getSheet('Wallets');
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.walletId) {
      if (values[i][1] !== userId) throw new Error("FORBIDDEN");
      if (data.name) sheet.getRange(i + 1, 3).setValue(data.name);
      if (data.type) sheet.getRange(i + 1, 4).setValue(data.type);
      if (data.initialBalance !== undefined) sheet.getRange(i + 1, 5).setValue(parseFloat(data.initialBalance));
      return { message: "Wallet berhasil diperbarui" };
    }
  }
  throw new Error("Wallet tidak ditemukan");
}

function deleteWallet(userId, walletId) {
  const sheet = getSheet('Wallets');
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === walletId) {
      if (values[i][1] !== userId) throw new Error("FORBIDDEN");
      sheet.getRange(i + 1, 6).setValue('deleted');
      return { message: "Wallet berhasil dihapus" };
    }
  }
  throw new Error("Wallet tidak ditemukan");
}

// --------------------------------------------------------------------
// 5. TRANSACTION MANAGEMENT
// --------------------------------------------------------------------
function getTransactions(userId, walletId = null) {
  const allowedWallets = getWallets(userId);
  const allowedWalletIds = allowedWallets.map(w => w.walletId);
  if (walletId && !allowedWalletIds.includes(walletId)) throw new Error("FORBIDDEN");
  
  const txs = getRecords(getSheet('Transactions')).filter(t => t.status !== 'deleted');
  const categories = getCategories(userId);
  
  // Mapping nama wallet & kategori emoticon
  const walletMap = {};
  allowedWallets.forEach(w => walletMap[w.walletId] = w.name);

  const catMap = {};
  categories.forEach(c => catMap[c.categoryId] = { name: c.name, icon: c.icon });

  let result = walletId ? txs.filter(t => t.walletId === walletId) : txs.filter(t => allowedWalletIds.includes(t.walletId));

  result = result.map(t => {
    const cat = catMap[t.categoryId] || { name: 'Lainnya', icon: '💵' };
    return {
      transactionId: t.transactionId,
      walletId: t.walletId,
      walletName: walletMap[t.walletId] || 'Wallet',
      userId: t.userId,
      type: t.type,
      amount: parseFloat(t.amount || 0),
      categoryId: t.categoryId,
      categoryName: cat.name,
      categoryIcon: cat.icon,
      description: t.description,
      date: t.date
    };
  });

  return result.reverse();
}

function createTransaction(userId, data) {
  const allowedWallets = getWallets(userId).map(w => w.walletId);
  if (!allowedWallets.includes(data.walletId)) throw new Error("FORBIDDEN");
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getSheet('Transactions');
    const txId = generateId('TX');
    sheet.appendRow([
      txId,
      data.walletId,
      userId,
      data.type,
      parseFloat(data.amount) || 0,
      data.categoryId || '',
      data.description || '',
      data.date || new Date().toISOString(),
      'active'
    ]);
    return { transactionId: txId };
  } finally {
    lock.releaseLock();
  }
}

function deleteTransaction(userId, txId) {
  const sheet = getSheet('Transactions');
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === txId) {
      if (values[i][2] !== userId) throw new Error("FORBIDDEN");
      sheet.getRange(i + 1, 9).setValue('deleted'); // soft delete
      return { message: "Transaksi berhasil dihapus" };
    }
  }
  throw new Error("Transaksi tidak ditemukan");
}

function transferWallet(userId, data) {
  const allowedWallets = getWallets(userId).map(w => w.walletId);
  if (!allowedWallets.includes(data.fromWalletId) || !allowedWallets.includes(data.toWalletId)) {
    throw new Error("FORBIDDEN");
  }
  if (data.fromWalletId === data.toWalletId) {
    throw new Error("Wallet asal dan tujuan tidak boleh sama");
  }

  const amount = parseFloat(data.amount);
  if (isNaN(amount) || amount <= 0) throw new Error("Nominal transfer tidak valid");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getSheet('Transactions');
    const now = new Date().toISOString();
    const note = data.description || 'Transfer saldo';

    // 1. Catatan Pengeluaran dari Wallet Asal
    sheet.appendRow([
      generateId('TX'),
      data.fromWalletId,
      userId,
      'expense',
      amount,
      'c_transfer',
      `Transfer keluar: ${note}`,
      now,
      'active'
    ]);

    // 2. Catatan Pemasukan ke Wallet Tujuan
    sheet.appendRow([
      generateId('TX'),
      data.toWalletId,
      userId,
      'income',
      amount,
      'c_transfer',
      `Transfer masuk: ${note}`,
      now,
      'active'
    ]);

    return { message: "Transfer berhasil dicatat" };
  } finally {
    lock.releaseLock();
  }
}

// --------------------------------------------------------------------
// 6. CATEGORY MANAGEMENT (Requirement #5: Emoticon & Kategori)
// --------------------------------------------------------------------
function getCategories(userId) {
  const sheet = getSheet('Categories');
  const records = getRecords(sheet);
  // Ambil kategori sistem (bawaan) dan kategori buatan user sendiri
  return records.filter(c => !c.userId || c.userId === 'system' || c.userId === userId);
}

function createCategory(userId, data) {
  if (!data.name || !data.name.trim()) throw new Error("Nama kategori wajib diisi");
  const sheet = getSheet('Categories');
  const catId = generateId('CAT');
  const type = data.type || 'expense';
  const icon = data.icon || (type === 'income' ? '💰' : '🏷️');

  sheet.appendRow([catId, data.name.trim(), type, icon, userId]);
  return { 
    categoryId: catId, 
    name: data.name.trim(), 
    type: type, 
    icon: icon 
  };
}

function deleteCategory(userId, categoryId) {
  const sheet = getSheet('Categories');
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === categoryId) {
      if (values[i][4] === 'system') throw new Error("Kategori bawaan sistem tidak dapat dihapus");
      if (values[i][4] !== userId) throw new Error("FORBIDDEN");
      sheet.deleteRow(i + 1);
      return { message: "Kategori berhasil dihapus" };
    }
  }
  return { message: "Kategori tidak ditemukan" };
}

// --------------------------------------------------------------------
// 7. DASHBOARD & STATS SUMMARY
// --------------------------------------------------------------------
function getDashboard(userId) {
  const wallets = getWallets(userId);
  const txs = getTransactions(userId);
  
  let totalBalance = wallets.reduce((sum, w) => sum + w.currentBalance, 0);
  let incomeThisMonth = 0;
  let expenseThisMonth = 0;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayStr = now.toDateString();

  let todayExpenseTotal = 0;
  let todayIncomeTotal = 0;
  let todayExpenseCount = 0;
  let todayIncomeCount = 0;

  txs.forEach(t => {
    const d = new Date(t.date);
    const amt = parseFloat(t.amount || 0);

    // Bulan ini
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      if (t.type === 'income') incomeThisMonth += amt;
      if (t.type === 'expense') expenseThisMonth += amt;
    }

    // Hari ini
    if (d.toDateString() === todayStr) {
      if (t.type === 'expense') {
        todayExpenseTotal += amt;
        todayExpenseCount++;
      } else if (t.type === 'income') {
        todayIncomeTotal += amt;
        todayIncomeCount++;
      }
    }
  });

  return {
    totalBalance,
    incomeThisMonth,
    expenseThisMonth,
    walletsCount: wallets.length,
    wallets: wallets,
    todayExpenseTotal,
    todayIncomeTotal,
    todayExpenseCount,
    todayIncomeCount,
    recentTransactions: txs.slice(0, 15)
  };
}

// --------------------------------------------------------------------
// 8. PROFILE MANAGEMENT
// --------------------------------------------------------------------
function getProfile(userId) {
  const sheet = getSheet('Users');
  const records = getRecords(sheet);
  const user = records.find(r => r.userId === userId);
  if (!user) throw new Error("User tidak ditemukan");
  
  const wallets = getWallets(userId);
  const txs = getTransactions(userId);
  const cats = getCategories(userId);

  return {
    id: user.userId,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    createdAt: user.createdAt,
    walletsCount: wallets.length,
    transactionsCount: txs.length,
    categoriesCount: cats.length
  };
}

function updateProfile(userId, data) {
  const sheet = getSheet('Users');
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === userId) {
      if (data.name) sheet.getRange(i + 1, 3).setValue(data.name);
      if (data.avatar) sheet.getRange(i + 1, 6).setValue(data.avatar);
      if (data.pin && String(data.pin).length === 6) sheet.getRange(i + 1, 4).setValue(data.pin);
      return { message: "Profil berhasil diperbarui" };
    }
  }
  throw new Error("User tidak ditemukan");
}

// --------------------------------------------------------------------
// 9. SHARING & INVITE WALLET
// --------------------------------------------------------------------
function createInvite(userId, data) {
  const wallet = getRecords(getSheet('Wallets')).find(w => w.walletId === data.walletId);
  if (!wallet || wallet.ownerId !== userId) throw new Error("FORBIDDEN: Hanya pemilik yang bisa mengundang");

  const sheet = getSheet('Invites');
  const token = generateId('INV') + Math.random().toString(36).substring(2, 10);
  const expires = new Date();
  expires.setHours(expires.getHours() + 24); // Berlaku 24 jam

  sheet.appendRow([token, data.walletId, userId, data.role || 'viewer', expires.toISOString(), 'active']);
  return { token: token };
}

function joinWallet(userId, token) {
  const inviteSheet = getSheet('Invites');
  const invites = getRecords(inviteSheet);
  const invite = invites.find(i => i.token === token && i.status === 'active');
  
  if (!invite) throw new Error("Link invite tidak valid atau sudah ditarik");
  if (new Date(invite.expiresAt) < new Date()) throw new Error("Link invite sudah kedaluwarsa");

  const memberSheet = getSheet('WalletMembers');
  const existing = getRecords(memberSheet).find(m => m.walletId === invite.walletId && m.userId === userId);
  if (existing) throw new Error("Anda sudah menjadi anggota di wallet ini");

  memberSheet.appendRow([invite.walletId, userId, invite.role, new Date().toISOString()]);
  
  // Nonaktifkan token setelah dipakai
  const dataRange = inviteSheet.getDataRange().getValues();
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0] === token) {
      inviteSheet.getRange(i + 1, 6).setValue('used');
      break;
    }
  }

  return { message: "Berhasil bergabung ke wallet" };
}

// --------------------------------------------------------------------
// 10. DATABASE & RECORD HELPER FUNCTIONS
// --------------------------------------------------------------------
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Sheet '" + name + "' tidak ditemukan. Jalankan setupDatabase() dahulu.");
  return sheet;
}

function getRecords(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function findRow(sheet, colIndex, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] === value) return i + 1;
  }
  return null;
}

function generateId(prefix) {
  return prefix + new Date().getTime().toString() + Math.floor(Math.random() * 1000);
}
