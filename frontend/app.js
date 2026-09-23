// ==============================================================================
// SpendBTC Frontend Application Logic (Standard Fintech Product Edition)
// ==============================================================================

let currentAccount = null;
let currentCard = null;
let currentQuote = null;
let quoteCountdownInterval = null;
let tourStep = 1;
let currentDisplayCurrency = "NGN";
let activeSnippetLang = "curl";

const FIAT_RATES = {
  USD: 1.0,
  NGN: 1600.0,
  EUR: 0.92,
  GBP: 0.78,
  KES: 130.0
};

const BTC_PRICE_USD = 74400.0;

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  loadAccountData();
  loadCardData();
  loadTransactions();
  loadDeveloperData();
  renderCodeSnippet();
});

// ------------------------------------------------------------------------------
// Toast Notification Engine
// ------------------------------------------------------------------------------
function showToast(title, message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";

  let iconName = "info";
  let iconColor = "text-stacksCoral";

  if (type === "success") {
    iconName = "check-circle-2";
    iconColor = "text-emerald-400";
  } else if (type === "error") {
    iconName = "alert-circle";
    iconColor = "text-rose-400";
  }

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-5 h-5 ${iconColor} shrink-0"></i>
    <div class="space-y-0.5">
      <p class="font-bold text-white text-xs">${title}</p>
      <p class="text-[11px] text-slate-300">${message}</p>
    </div>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.animation = "toast-out 0.3s forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ------------------------------------------------------------------------------
// Navigation & Tab Switching
// ------------------------------------------------------------------------------
function switchTab(tabName) {
  const tabs = ["consumer", "card", "ledger", "developer"];
  const viewTitles = {
    consumer: "Spending & Pay",
    card: "Virtual Card",
    ledger: "Transactions",
    developer: "Developer Portal"
  };

  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const navBtn = document.getElementById(`nav-${t}`);
    if (t === tabName) {
      if (el) el.classList.remove("hidden");
      if (navBtn) {
        navBtn.classList.add("bg-bgCard", "text-white", "border", "border-borderSubtle");
        navBtn.classList.remove("text-slate-400");
      }
    } else {
      if (el) el.classList.add("hidden");
      if (navBtn) {
        navBtn.classList.remove("bg-bgCard", "text-white", "border", "border-borderSubtle");
        navBtn.classList.add("text-slate-400");
      }
    }
  });

  const titleEl = document.getElementById("topbar-current-view");
  if (titleEl) titleEl.textContent = viewTitles[tabName] || "Dashboard";

  if (tabName === "ledger") loadTransactions();
  if (tabName === "developer") loadDeveloperData();
  lucide.createIcons();
}

function toggleMobileSidebar() {
  const aside = document.querySelector("aside");
  if (aside) aside.classList.toggle("hidden");
}

// ------------------------------------------------------------------------------
// Account & Currency Logic
// ------------------------------------------------------------------------------
async function loadAccountData() {
  try {
    const res = await fetch("/api/v1/accounts");
    const acc = await res.json();
    currentAccount = acc;

    updateHeroBalance();

    const btcUsd = acc.btc_balance * BTC_PRICE_USD;
    const sbtcUsd = acc.sbtc_balance * BTC_PRICE_USD;

    document.getElementById("breakdown-btc").textContent = `${acc.btc_balance.toFixed(8)} BTC`;
    document.getElementById("breakdown-btc-usd").textContent = `≈ $${btcUsd.toFixed(2)}`;
    document.getElementById("breakdown-sbtc").textContent = `${acc.sbtc_balance.toFixed(8)} sBTC`;
    document.getElementById("breakdown-sbtc-usd").textContent = `≈ $${sbtcUsd.toFixed(2)}`;
    
    const addr = acc.stacks_address;
    const shortAddr = `${addr.slice(0, 5)}...${addr.slice(-5)}`;
    
    const topbarAddr = document.getElementById("topbar-address-label");
    if (topbarAddr) topbarAddr.textContent = shortAddr;
    
    const sidebarAddr = document.getElementById("sidebar-short-address");
    if (sidebarAddr) sidebarAddr.textContent = shortAddr;

    const sidebarUser = document.getElementById("sidebar-user-name");
    if (sidebarUser) sidebarUser.textContent = acc.user_name || "Vittorio";

    const modalAddr = document.getElementById("modal-connected-address");
    if (modalAddr) modalAddr.textContent = addr;

  } catch (err) {
    console.error("Failed to load account:", err);
  }
}

function changeDisplayCurrency(currency) {
  currentDisplayCurrency = currency;
  updateHeroBalance();
  showToast("Currency Updated", `Switched display denomination to ${currency}`);
}

function updateHeroBalance() {
  if (!currentAccount) return;
  const totalBtc = currentAccount.btc_balance + currentAccount.sbtc_balance;
  const totalUsd = totalBtc * BTC_PRICE_USD;
  const rate = FIAT_RATES[currentDisplayCurrency] || 1.0;
  const converted = totalUsd * rate;

  const symbolMap = { USD: "$", NGN: "₦", EUR: "€", GBP: "£", KES: "KSh " };
  const sym = symbolMap[currentDisplayCurrency] || "$";

  const heroFiat = document.getElementById("hero-fiat-balance");
  if (heroFiat) {
    heroFiat.textContent = `${sym}${Math.round(converted).toLocaleString()}`;
  }

  const heroUsd = document.getElementById("hero-usd-equiv");
  if (heroUsd) {
    heroUsd.textContent = `≈ $${totalUsd.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD`;
  }
}

// ------------------------------------------------------------------------------
// Wallet Modal & Provider Handling
// ------------------------------------------------------------------------------
function openWalletModal() {
  document.getElementById("wallet-modal").classList.remove("hidden");
  lucide.createIcons();
}

function closeWalletModal() {
  document.getElementById("wallet-modal").classList.add("hidden");
}

async function connectWallet(type) {
  if (type === "leather") {
    if (window.LeatherProvider || window.HiroWalletProvider) {
      try {
        const provider = window.LeatherProvider || window.HiroWalletProvider;
        const resp = await provider.request("getAddresses");
        const stxAddr = resp?.result?.addresses?.find(a => a.symbol === "STX")?.address;
        if (stxAddr) {
          await registerOrSwitchAccount(stxAddr, "Leather User");
          closeWalletModal();
          showToast("Wallet Connected", `Connected Leather: ${stxAddr.slice(0, 8)}...`, "success");
          return;
        }
      } catch (e) {
        console.warn("Leather error:", e);
      }
    } else {
      showToast("Extension Not Found", "Leather wallet not detected. Switched to Stacks Testnet Demo mode.", "info");
    }
  } else if (type === "xverse") {
    showToast("Extension Not Found", "Xverse wallet not detected. Switched to Stacks Testnet Demo mode.", "info");
  }

  await registerOrSwitchAccount("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", "Vittorio Affolabi");
  closeWalletModal();
  showToast("Demo Wallet Active", "Connected to Stacks Testnet (0.006 sBTC pre-funded)", "success");
}

async function registerOrSwitchAccount(stacksAddress, userName) {
  try {
    await fetch("/api/v1/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_name: userName,
        stacks_address: stacksAddress,
        btc_balance: 0.018,
        sbtc_balance: 0.006,
        fiat_currency: "USD"
      })
    });
    await loadAccountData();
  } catch (err) {
    console.error("Account registration error:", err);
  }
}

// ------------------------------------------------------------------------------
// Payment Sheet (Apple Pay / Revolut Standard)
// ------------------------------------------------------------------------------
function openPaymentSheet(amount = 50000) {
  const amtInput = document.getElementById("pay-sheet-amount");
  if (amtInput) amtInput.value = amount;
  showStep1();
  document.getElementById("payment-sheet-modal").classList.remove("hidden");
  lucide.createIcons();
}

function closePaymentSheet() {
  document.getElementById("payment-sheet-modal").classList.add("hidden");
  if (quoteCountdownInterval) clearInterval(quoteCountdownInterval);
  loadAccountData();
  loadTransactions();
}

function showStep1() {
  document.getElementById("payment-step-1").classList.remove("hidden");
  document.getElementById("payment-step-2").classList.add("hidden");
  document.getElementById("payment-step-3").classList.add("hidden");
}

function addAmountIncrement(delta) {
  const input = document.getElementById("pay-sheet-amount");
  if (input) {
    input.value = Math.max(0, (parseFloat(input.value) || 0) + delta);
  }
}

function setAmountExact(val) {
  const input = document.getElementById("pay-sheet-amount");
  if (input) input.value = val;
}

async function requestPaymentQuote() {
  const amount = parseFloat(document.getElementById("pay-sheet-amount").value);
  const currency = document.getElementById("pay-sheet-currency").value;

  try {
    const res = await fetch("/api/v1/payments/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency, asset: "sBTC" })
    });
    const quote = await res.json();
    currentQuote = quote;
    renderQuoteStep(quote);
  } catch (err) {
    showToast("Quote Error", err.message, "error");
  }
}

function renderQuoteStep(quote) {
  document.getElementById("payment-step-1").classList.add("hidden");
  document.getElementById("payment-step-2").classList.remove("hidden");

  const symbolMap = { USD: "$", NGN: "₦", EUR: "€", GBP: "£", KES: "KSh " };
  const sym = symbolMap[quote.fiat_currency] || "$";

  document.getElementById("quote-fiat-display").textContent = `${sym}${quote.fiat_amount.toLocaleString()}`;
  document.getElementById("quote-sbtc-display").textContent = `≈ ${quote.asset_amount.toFixed(8)} sBTC`;

  document.getElementById("quote-fee-network").textContent = `${quote.network_fee_asset.toFixed(8)} sBTC`;
  document.getElementById("quote-fee-spendbtc").textContent = `${quote.execution_fee_asset.toFixed(8)} sBTC`;
  document.getElementById("quote-fee-total").textContent = `${quote.total_asset_amount.toFixed(8)} sBTC`;

  const routesContainer = document.getElementById("quote-routes-list");
  routesContainer.innerHTML = quote.routes.map(r => `
    <label class="flex items-center justify-between p-3.5 rounded-xl border ${r.recommended ? 'border-stacksCoral bg-stacksCoral/10' : 'border-borderSubtle bg-bgApp'} cursor-pointer hover:border-slate-500 transition-all">
      <div class="flex items-center gap-3">
        <input type="radio" name="payment-route" value="${r.name}" ${r.recommended ? 'checked' : ''} class="accent-stacksCoral">
        <div>
          <p class="text-xs font-bold text-white flex items-center gap-2">
            ${r.name}
            ${r.recommended ? '<span class="status-pill pill-coral text-[9px]">Best Rate</span>' : ''}
          </p>
          <p class="text-[10px] text-slate-400">${r.description} • Est. ${r.estimated_time_sec}s</p>
        </div>
      </div>
      <span class="text-xs font-mono text-slate-300 font-bold">${sym}${r.fee_fiat} fee</span>
    </label>
  `).join("");

  startQuoteCountdown(quote.ttl_seconds);
  lucide.createIcons();
}

function startQuoteCountdown(seconds) {
  if (quoteCountdownInterval) clearInterval(quoteCountdownInterval);
  let remaining = seconds;
  const timerEl = document.getElementById("quote-timer");

  quoteCountdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(quoteCountdownInterval);
      timerEl.textContent = "Expired";
      timerEl.classList.add("text-rose-400");
    } else {
      timerEl.textContent = `${remaining}s`;
    }
  }, 1000);
}

async function authorizePayment() {
  if (!currentQuote) return;
  const recipient = document.getElementById("pay-sheet-recipient").value || "SpendBTC Test Merchant";
  const selectedRouteEl = document.querySelector('input[name="payment-route"]:checked');
  const route = selectedRouteEl ? selectedRouteEl.value : currentQuote.selected_route;

  document.getElementById("payment-step-2").classList.add("hidden");
  document.getElementById("payment-step-3").classList.remove("hidden");
  lucide.createIcons();

  const progressBar = document.getElementById("settlement-progress-bar");
  const stQuoted = document.getElementById("st-quoted");
  const stAuth = document.getElementById("st-auth");
  const stProc = document.getElementById("st-proc");
  const stConf = document.getElementById("st-conf");

  try {
    const res = await fetch("/api/v1/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote_id: currentQuote.id,
        recipient: recipient,
        route: route
      })
    });
    const result = await res.json();

    if (!res.ok) {
      document.getElementById("settlement-title").textContent = "Payment Declined";
      document.getElementById("settlement-desc").textContent = result.error || "An error occurred";
      document.getElementById("settlement-icon").innerHTML = '<i data-lucide="alert-circle" class="w-8 h-8 text-rose-500"></i>';
      document.getElementById("btn-settlement-done").classList.remove("hidden");
      showToast("Payment Failed", result.error, "error");
      lucide.createIcons();
      return;
    }

    setTimeout(() => {
      progressBar.style.width = "100%";
      stProc.classList.remove("animate-pulse", "text-stacksCoral");
      stProc.classList.add("text-emerald-400");
      stConf.classList.replace("text-slate-500", "text-emerald-400");
      stConf.textContent = "4. CONFIRMED ✓";

      document.getElementById("settlement-title").textContent = "Payment Successful! 🎉";
      document.getElementById("settlement-desc").textContent = "Settlement finalized via sBTC Settlement Contract on Stacks";
      document.getElementById("settlement-icon").innerHTML = '<i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-400"></i>';

      document.getElementById("settlement-proof").classList.remove("hidden");
      document.getElementById("proof-recipient").textContent = result.recipient;
      
      const symbolMap = { USD: "$", NGN: "₦", EUR: "€", GBP: "£", KES: "KSh " };
      const sym = symbolMap[result.fiat_currency] || "$";
      
      document.getElementById("proof-amount").textContent = `${sym}${result.fiat_amount.toLocaleString()} (${result.asset_amount.toFixed(8)} sBTC)`;
      document.getElementById("proof-explorer-link").textContent = `${result.tx_hash.slice(0, 10)}...${result.tx_hash.slice(-8)}`;
      document.getElementById("proof-explorer-link").href = result.explorer_url;

      document.getElementById("btn-settlement-done").classList.remove("hidden");
      showToast("Payment Confirmed", `Settled ${sym}${result.fiat_amount.toLocaleString()} to ${result.recipient}`, "success");
      lucide.createIcons();
    }, 1200);

  } catch (err) {
    showToast("Authorization Failed", err.message, "error");
  }
}

// ------------------------------------------------------------------------------
// Virtual Card Prototype (Section 10)
// ------------------------------------------------------------------------------
let cardNumberMasked = true;

async function loadCardData() {
  try {
    const res = await fetch("/api/v1/card");
    const card = await res.json();
    currentCard = card;

    document.getElementById("card-holder-name").textContent = card.cardholder_name;
    document.getElementById("card-expiry").textContent = card.expiry;
    document.getElementById("card-cvv").textContent = card.cvv;
    document.getElementById("card-limit-val").textContent = `$${card.daily_limit_usd.toFixed(2)}`;
    document.getElementById("limit-slider").value = card.daily_limit_usd;

    renderCardNumber();
    updateCardFrozenState(card.is_frozen === 1);
  } catch (err) {
    console.error("Failed to load card:", err);
  }
}

function renderCardNumber() {
  const num = currentCard ? currentCard.card_number : "4532 8920 1823 4901";
  const el = document.getElementById("card-display-number");
  const icon = document.getElementById("card-eye-icon");

  if (cardNumberMasked) {
    const parts = num.split(" ");
    el.textContent = `${parts[0]} •••• •••• ${parts[3]}`;
    if (icon) icon.setAttribute("data-lucide", "eye");
  } else {
    el.textContent = num;
    if (icon) icon.setAttribute("data-lucide", "eye-off");
  }
  lucide.createIcons();
}

function toggleCardNumberVisibility() {
  cardNumberMasked = !cardNumberMasked;
  renderCardNumber();
  showToast("Card Security", cardNumberMasked ? "Card details masked" : "Card details revealed");
}

async function toggleCardFreeze() {
  if (!currentCard) return;
  const newFrozen = currentCard.is_frozen === 1 ? false : true;
  try {
    const res = await fetch("/api/v1/card/freeze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_frozen: newFrozen })
    });
    const data = await res.json();
    currentCard.is_frozen = data.is_frozen ? 1 : 0;
    updateCardFrozenState(data.is_frozen);
    showToast(
      data.is_frozen ? "Card Locked" : "Card Unlocked",
      data.is_frozen ? "All debit authorizations blocked" : "Card is active for payments",
      data.is_frozen ? "error" : "success"
    );
  } catch (e) {
    showToast("Freeze Error", e.message, "error");
  }
}

function updateCardFrozenState(isFrozen) {
  const overlay = document.getElementById("card-frozen-overlay");
  const btn = document.getElementById("btn-freeze-toggle");
  if (isFrozen) {
    overlay.classList.remove("hidden");
    btn.textContent = "Unfreeze Card";
    btn.classList.add("border-emerald-500", "text-emerald-400");
  } else {
    overlay.classList.add("hidden");
    btn.textContent = "Freeze Card";
    btn.classList.remove("border-emerald-500", "text-emerald-400");
  }
}

function updateDailyLimit(val) {
  document.getElementById("card-limit-val").textContent = `$${parseFloat(val).toFixed(2)}`;
}

async function simulateCardCharge(amount, merchant) {
  try {
    const res = await fetch("/api/v1/card/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, merchant })
    });
    const result = await res.json();
    if (!res.ok) {
      showToast("Card Declined", result.error, "error");
      return;
    }
    showToast("Card Authorized", `Charged $${amount} at ${merchant} via sBTC`, "success");
    loadAccountData();
    loadTransactions();
  } catch (err) {
    showToast("Charge Failed", err.message, "error");
  }
}

// ------------------------------------------------------------------------------
// Transaction Ledger
// ------------------------------------------------------------------------------
async function loadTransactions() {
  try {
    const res = await fetch("/api/v1/transactions");
    const txs = await res.json();

    const recentEl = document.getElementById("recent-activity-list");
    if (recentEl) {
      recentEl.innerHTML = txs.slice(0, 4).map(tx => {
        const symbolMap = { USD: "$", NGN: "₦", EUR: "€", GBP: "£", KES: "KSh " };
        const sym = symbolMap[tx.fiat_currency] || "$";
        const isCompleted = tx.status === "COMPLETED";
        return `
          <div class="py-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl ${isCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-stacksCoral/10 text-stacksCoral'} flex items-center justify-center font-bold">
                <i data-lucide="${isCompleted ? 'arrow-up-right' : 'clock'}" class="w-5 h-5"></i>
              </div>
              <div>
                <p class="text-sm font-bold text-white">${tx.recipient}</p>
                <p class="text-xs text-slate-400">${tx.route} • <span class="font-mono text-slate-300 font-semibold">${tx.amount.toFixed(8)} sBTC</span></p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-sm font-bold text-white font-mono">${sym}${tx.fiat_value.toLocaleString()}</p>
              <span class="status-pill ${isCompleted ? 'pill-green' : 'pill-coral'}">
                ${tx.status}
              </span>
            </div>
          </div>
        `;
      }).join("");
    }

    const tableBody = document.getElementById("ledger-table-body");
    if (tableBody) {
      tableBody.innerHTML = txs.map(tx => {
        const symbolMap = { USD: "$", NGN: "₦", EUR: "€", GBP: "£", KES: "KSh " };
        const sym = symbolMap[tx.fiat_currency] || "$";
        const isCompleted = tx.status === "COMPLETED";
        const dateStr = new Date(tx.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `
          <tr class="hover:bg-bgSurface transition-colors">
            <td class="py-3 font-mono text-slate-400">
              <span class="text-white block font-bold">${tx.id}</span>
              <span class="text-[10px]">${dateStr}</span>
            </td>
            <td class="py-3 font-semibold text-white">${tx.recipient}</td>
            <td class="py-3 font-bold text-white font-mono">${sym}${tx.fiat_value.toLocaleString()}</td>
            <td class="py-3 font-mono text-stacksCoral font-semibold">${tx.amount.toFixed(8)} sBTC</td>
            <td class="py-3 text-[11px] text-slate-400">${tx.route}</td>
            <td class="py-3">
              <span class="status-pill ${isCompleted ? 'pill-green' : 'pill-coral'}">
                ${tx.status}
              </span>
            </td>
            <td class="py-3 text-right font-mono">
              <a href="https://explorer.hiro.so/txid/${tx.tx_hash}?chain=testnet" target="_blank" class="text-stacksIndigo hover:underline text-[11px]">
                ${tx.tx_hash ? tx.tx_hash.slice(0, 8) + '...' : '-'}
              </a>
            </td>
          </tr>
        `;
      }).join("");
    }

    lucide.createIcons();
  } catch (err) {
    console.error("Failed to load transactions:", err);
  }
}

// ------------------------------------------------------------------------------
// Developer Portal & API Workbench
// ------------------------------------------------------------------------------
async function loadDeveloperData() {
  try {
    const keysRes = await fetch("/api/v1/developer/keys");
    const keys = await keysRes.json();
    const keysList = document.getElementById("api-keys-list");
    if (keysList) {
      keysList.innerHTML = keys.map(k => `
        <div class="p-3.5 rounded-xl bg-bgApp border border-borderSubtle flex items-center justify-between">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-white">${k.partner_name}</span>
              <span class="status-pill ${k.key_type === 'live' ? 'pill-coral' : 'pill-green'}">${k.key_type}</span>
            </div>
            <p class="font-mono text-xs text-slate-400">${k.secret_key.slice(0, 14)}••••••••</p>
          </div>
          <button onclick="copyToClipboard('${k.secret_key}', 'API Key Copied')" class="btn-secondary-action p-2 text-slate-400 hover:text-white">
            <i data-lucide="copy" class="w-4 h-4"></i>
          </button>
        </div>
      `).join("");
    }

    const logsRes = await fetch("/api/v1/developer/logs");
    const logs = await logsRes.json();
    const logsList = document.getElementById("webhook-logs-list");
    if (logsList) {
      logsList.innerHTML = logs.map(l => `
        <div class="p-3 rounded-xl bg-bgApp border border-borderSubtle flex items-center justify-between text-xs">
          <div class="flex items-center gap-2.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="font-mono font-bold text-stacksIndigo">${l.event}</span>
            <span class="text-[10px] text-slate-400 font-mono">${new Date(l.created_at).toLocaleTimeString()}</span>
          </div>
          <span class="status-pill pill-green text-[10px]">200 OK</span>
        </div>
      `).join("");
    }

    lucide.createIcons();
  } catch (err) {
    console.error("Failed to load developer data:", err);
  }
}

async function generateNewApiKey() {
  const name = prompt("Enter Partner or App Name:", "Acme Fintech");
  if (!name) return;
  try {
    await fetch("/api/v1/developer/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner_name: name, key_type: "test" })
    });
    showToast("Key Created", `Generated new test key for ${name}`, "success");
    loadDeveloperData();
  } catch (e) {
    showToast("Error", e.message, "error");
  }
}

async function sendTestWebhookPing() {
  try {
    await fetch("/api/v1/developer/webhooks/test", { method: "POST" });
    showToast("Webhook Delivered", "payment.confirmed event dispatched (HTTP 200 OK)", "success");
    loadDeveloperData();
  } catch (e) {
    showToast("Webhook Error", e.message, "error");
  }
}

function switchSnippetLang(lang) {
  activeSnippetLang = lang;
  ["curl", "node", "python"].forEach(l => {
    const btn = document.getElementById(`btn-lang-${l}`);
    if (btn) {
      if (l === lang) {
        btn.className = "px-2 py-0.5 rounded bg-bgSurface text-white font-bold";
      } else {
        btn.className = "px-2 py-0.5 rounded text-slate-400 hover:text-white";
      }
    }
  });
  renderCodeSnippet();
}

function renderCodeSnippet() {
  const el = document.getElementById("playground-code-snippet");
  if (!el) return;

  const amt = document.getElementById("play-amount") ? document.getElementById("play-amount").value : "50000";
  const curr = document.getElementById("play-currency") ? document.getElementById("play-currency").value : "NGN";

  if (activeSnippetLang === "curl") {
    el.textContent = `curl -X POST https://api.spendbtc.io/v1/payments/quote \\
  -H "Authorization: Bearer spbtc_test_8f29d71c90a14e9e" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": ${amt}, "currency": "${curr}", "asset": "sBTC"}'`;
  } else if (activeSnippetLang === "node") {
    el.textContent = `import { SpendBTC } from '@spendbtc/sdk';

const spendbtc = new SpendBTC('spbtc_test_8f29d71c90a14e9e');
const quote = await spendbtc.payments.quote({
  amount: ${amt},
  currency: '${curr}',
  asset: 'sBTC'
});
console.log(quote);`;
  } else if (activeSnippetLang === "python") {
    el.textContent = `import requests

resp = requests.post(
  "https://api.spendbtc.io/v1/payments/quote",
  headers={"Authorization": "Bearer spbtc_test_8f29d71c90a14e9e"},
  json={"amount": ${amt}, "currency": "${curr}", "asset": "sBTC"}
)
print(resp.json())`;
  }
}

async function executePlaygroundQuote() {
  const amount = parseFloat(document.getElementById("play-amount").value);
  const currency = document.getElementById("play-currency").value;
  const respEl = document.getElementById("playground-response");

  try {
    const res = await fetch("/api/v1/payments/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency, asset: "sBTC" })
    });
    const data = await res.json();
    respEl.textContent = JSON.stringify(data, null, 2);
    showToast("API Executed", `Quote generated: ${data.asset_amount} sBTC`, "success");
  } catch (e) {
    respEl.textContent = JSON.stringify({ error: e.message }, null, 2);
    showToast("API Error", e.message, "error");
  }
}

function copyCurrentSnippet() {
  const el = document.getElementById("playground-code-snippet");
  if (el) copyToClipboard(el.textContent, "Snippet Copied");
}

function copyToClipboard(text, toastTitle = "Copied to clipboard") {
  navigator.clipboard.writeText(text);
  showToast(toastTitle, text.length > 30 ? text.slice(0, 30) + "..." : text, "success");
}

async function resetDemoData() {
  if (confirm("Reset demo data to initial state?")) {
    await fetch("/api/v1/reset", { method: "POST" });
    showToast("Reset Complete", "Demo accounts and transactions restored", "info");
    loadAccountData();
    loadCardData();
    loadTransactions();
    loadDeveloperData();
  }
}

// ------------------------------------------------------------------------------
// Architecture Tour
// ------------------------------------------------------------------------------
const TOUR_SCENES = [
  {
    step: 1,
    title: "Scene 1: Available to Spend",
    badge: "Architecture Spec • Scene 1",
    narrative: "User opens SpendBTC. Instead of seeing complex UTXOs or Stacks gas units, they see familiar available spending power: <strong>$1,284.62</strong> (backed transparently by 0.018 BTC and 0.006 sBTC).",
    action: () => switchTab('consumer')
  },
  {
    step: 2,
    title: "Scene 2: Select Pay ₦50,000",
    badge: "Architecture Spec • Scene 2",
    narrative: "User selects 'Pay' and enters <strong>₦50,000</strong>. No need to calculate satoshis or check coin price tickers.",
    action: () => {
      switchTab('consumer');
      openPaymentSheet(50000);
    }
  },
  {
    step: 3,
    title: "Scene 3: Real-Time Quote Engine",
    badge: "Architecture Spec • Scene 3",
    narrative: "SpendBTC Quote Engine calculates <strong>0.00042 sBTC</strong>, evaluates multi-route liquidity (Stacks Direct vs Bitflow vs Lightning), locks the rate for 30s, and shows exact fees.",
    action: () => requestPaymentQuote()
  },
  {
    step: 4,
    title: "Scene 4 & 5: Confirm & Wallet Authorization",
    badge: "Architecture Spec • Scene 4 & 5",
    narrative: "User confirms the payment. Wallet authorization (Leather / Xverse) signs the non-custodial transaction on the Stacks blockchain.",
    action: () => authorizePayment()
  },
  {
    step: 5,
    title: "Scene 6 & 7: Settlement Confirmed & Receipt",
    badge: "Architecture Spec • Scene 6 & 7",
    narrative: "SpendBTC state machine progresses from <strong>PROCESSING</strong> to <strong>CONFIRMED</strong>. The ₦50,000 receipt is generated with a simulated Stacks testnet TxID.",
    action: () => {}
  },
  {
    step: 6,
    title: "The Virtual Card Prototype",
    badge: "Architecture Spec • Virtual Card Concept",
    narrative: "The card is the future interface. Users can lock/freeze their card, adjust spending limits, or tap to pay at ordinary Visa/Mastercard terminals using sBTC balances.",
    action: () => {
      closePaymentSheet();
      switchTab('card');
    }
  },
  {
    step: 7,
    title: "The Infrastructure Pitch: Developer Portal",
    badge: "Architecture Spec • Developer Infrastructure",
    narrative: "<strong>'The card is only the interface. The infrastructure is the actual product.'</strong> SpendBTC exposes this entire capability via REST APIs & Webhooks so any wallet or fintech can integrate Bitcoin spending in days.",
    action: () => {
      closePaymentSheet();
      switchTab('developer');
    }
  }
];

function startDemoStory() {
  tourStep = 1;
  renderTourScene();
  document.getElementById("demo-tour-modal").classList.remove("hidden");
  lucide.createIcons();
}

function closeDemoStory() {
  document.getElementById("demo-tour-modal").classList.add("hidden");
}

function renderTourScene() {
  const scene = TOUR_SCENES[tourStep - 1];
  document.getElementById("tour-scene-title").textContent = scene.title;
  document.getElementById("tour-scene-badge").textContent = scene.badge;
  document.getElementById("tour-scene-narrative").innerHTML = scene.narrative;
  document.getElementById("tour-step-counter").textContent = `Scene ${scene.step} of ${TOUR_SCENES.length}`;

  document.getElementById("tour-btn-prev").disabled = tourStep === 1;
  document.getElementById("tour-btn-next").textContent = tourStep === TOUR_SCENES.length ? "Finish Tour" : "Next Scene →";

  if (scene.action) scene.action();
}

function nextTourStep() {
  if (tourStep < TOUR_SCENES.length) {
    tourStep++;
    renderTourScene();
  } else {
    closeDemoStory();
  }
}

function prevTourStep() {
  if (tourStep > 1) {
    tourStep--;
    renderTourScene();
  }
}
