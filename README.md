# 💸 UangAing - Modern Finance Tracker (PWA)

Aplikasi pencatatan keuangan dan dompet pribadi modern dengan arsitektur terpisah:
* **Frontend**: HTML5, Tailwind CSS, Vanilla JS, Chart.js, Lucide Icons (Disimpan di **GitHub / GitHub Pages** sebagai Progressive Web App - PWA).
* **Backend**: **Google Apps Script (`Kode.gs`)** dengan database **Google Sheets**.

---

## 📱 Fitur PWA (Progressive Web App)
1. **Dapat Di-install di HP (Android & iOS)**:
   * **Android / Chrome / Edge**: Muncul tombol instalasi otomatis *"Install Aplikasi"* di menu profil atau banner browser.
   * **iPhone / iPad (iOS Safari)**: Ketuk tombol **Share [↑]** > **Add to Home Screen (+)**.
2. **Offline-Ready**: Dilengkapi Service Worker (`sw.js`) untuk menyimpan asset tampilan, ikon, dan stylesheet secara offline.
3. **Realtime Sync**: Panggilan data transaksi ke Google Apps Script selalu di-bypass langsung ke internet agar saldo selalu akurat.
4. **App Shortcuts**: Menekan ikon aplikasi di layar HP menyediakan menu cepat: *Catat Pengeluaran*, *Wallet Saya*, dan *Statistik*.

---

## 📂 Struktur File
```
uangaing-app/
├── index.html            # Antarmuka Frontend (SPA Responsive)
├── manifest.json         # Konfigurasi PWA (Nama, Ikon, Tema, Shortcuts)
├── sw.js                 # Service Worker PWA (Cache & Offline Support)
├── icon-192.png          # Ikon PWA 192x192
├── icon-512.png          # Ikon PWA 512x512
├── apple-touch-icon.png  # Ikon untuk iOS Safari
├── favicon.png           # Favicon browser
├── login-icon.png        # Ilustrasi halaman masuk
├── Kode.gs               # Backend Google Apps Script
└── README.md             # Petunjuk deploy
```

---

## 🚀 Panduan Setup & Deploy

### Langkah 1: Deploy Backend (Google Apps Script)
1. Buka spreadsheet Google Sheets Anda.
2. Klik **Extensions (Ekstensi)** > **Apps Script**.
3. Tempel seluruh isi file `Kode.gs` ke editor Apps Script.
4. Pilih fungsi `setupDatabase` lalu klik **Run (Jalankan)** satu kali untuk inisialisasi tabel dan kategori bawaan.
5. Klik **Deploy** > **New Deployment**:
   * Pilih tipe: **Web app**.
   * Execute as: **Me**.
   * Who has access: **Anyone**.
6. Salin **Web App URL** yang dihasilkan (format: `https://script.google.com/macros/s/.../exec`).

### Langkah 2: Hubungkan Frontend ke Backend
Buka file `index.html` (sekitar baris 1040), ganti `API_URL` dengan Web App URL Anda:
```javascript
const App = {
    config: {
        API_URL: 'https://script.google.com/macros/s/AKfycby.../exec'
    },
    ...
};
```

### Langkah 3: Deploy Frontend ke GitHub Pages
1. Buat repositori baru di GitHub (misal: `uangaing-app`).
2. Di terminal folder proyek ini:
   ```bash
   git init
   git add .
   git commit -m "feat: UangAing PWA Frontend"
   git branch -M main
   git remote add origin https://github.com/<username-anda>/uangaing-app.git
   git push -u origin main
   ```
3. Di halaman repositori GitHub Anda:
   * Buka **Settings** > **Pages**.
   * Pada bagian **Branch**, pilih `main` dan folder `/(root)`.
   * Klik **Save**.
4. Website Anda siap diakses dan di-install sebagai PWA di:
   `https://<username-anda>.github.io/uangaing-app/`
