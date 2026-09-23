// ==============================================================================
// SpendBTC Frontend Application Logic (Stacks & sBTC)
// ==============================================================================

let currentAccount = null;
let currentCard = null;
let currentQuote = null;
let quoteCountdownInterval = null;
let tourStep = 1;
let connectedWalletType = "demo"; // 'leather', 'xverse', or 'demo'

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  loadAccountData();
  loadCardData();
  loadTransactions();
  loadDeveloperData();
});

// ------------------------------------------------------------------------------
// Navigation & Tab Switching
// ------------------------------------------------------------------------------
function switchTab(tabName) {
  const tabs = ["consumer", "card", "ledger", "developer"];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const navBtn = document.getElementById(`nav-${t}`);
    if (t === tabName) {
      el.classList.remove("hidden");
      if (navBtn) {
        navBtn.classList.add("bg-carbonCard", "text-white", "shadow-sm");
        navBtn.classList.remove("text-slate-400");
      }
    } else {
      el.classList.add("hidden");
      if (navBtn) {
        navBtn.classList.remove("bg-carbonCard", "text-white", "shadow-sm");
        navBtn.classList.add("text-slate-400");
      }
    }
  });

  if (tabName === "ledger") loadTransactions();
  if (tabName === "developer") loadDeveloperData();
  lucide.createIcons();
}

// ------------------------------------------------------------------------------
// Account & Balance Data
// ------------------------------------------------------------------------------
async function loadAccountData() {
  try {
    const res = await fetch("/api/v1/accounts");
    const acc = await res.json();
    currentAccount = acc;

    const btcUsd = acc.btc_balance * 74400;
    const sbtcUsd = acc.sbtc_balance * 74400;
    const totalUsd = btcUsd + sbtcUsd;
    const totalNgn = Math.round(totalUsd * 1600);

    document.getElementById("hero-fiat-balance").textContent = `$${totalUsd.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById("hero-local-equiv").textContent = `≈ ₦${totalNgn.toLocaleString()}`;
    document.getElementById("breakdown-btc").textContent = `${acc.btc_balance.toFixed(8)} BTC`;
    document.getElementById("breakdown-btc-usd").textContent = `≈ $${btcUsd.toFixed(2)}`;
    document.getElementById("breakdown-sbtc").textContent = `${acc.sbtc_balance.toFixed(8)} sBTC`;
    document.getElementById("breakdown-sbtc-usd").textContent = `≈ $${sbtcUsd.toFixed(2)}`;
    
    // Topbar & Modal Address
    const addr = acc.stacks_address;
    const shortAddr = `${addr.slice(0, 5)}...${addr.slice(-5)}`;
    const labelEl = document.getElementById("topbar-address-label");
    if (labelEl) labelEl.textContent = shortAddr;
    const modalAddrEl = document.getElementById("modal-connected-address");
    if (modalAddrEl) modalAddrEl.textContent = addr;

  } catch (err) {
    console.error("Failed to load account:", err);
  }
}

// ------------------------------------------------------------------------------
// Stacks Wallet Integration (Leather / Xverse / Demo)
// ------------------------------------------------------------------------------
function openWalletModal() {
  document.getElementById("wallet-modal").classList.remove("hidden");
  lucide.createIcons();
}

function closeWalletModal() {
  document.getElementById("wallet-modal").classList.add("hidden");
}

async function connectWallet(type) {
  connectedWalletType = type;

  if (type === "leather") {
    if (window.LeatherProvider || window.HiroWalletProvider) {
      try {
        const provider = window.LeatherProvider || window.HiroWalletProvider;
        const resp = await provider.request("getAddresses");
        const stxAddr = resp?.result?.addresses?.find(a => a.symbol === "STX")?.address;
        if (stxAddr) {
          await registerOrSwitchAccount(stxAddr, "Leather User");
          closeWalletModal();
          alert(`Connected Leather Wallet: ${stxAddr}`);
          return;
        }
      } catch (e) {
        console.warn("Leather connection cancelled or failed:", e);
      }
    } else {
      alert("Leather wallet extension was not detected in this browser. Switching to Stacks Testnet Demo mode with pre-funded sBTC.");
    }
  } else if (type === "xverse") {
    if (window.XverseProviders || window.BitcoinProvider) {
      try {
        alert("Xverse detected! Requesting testnet connection...");
      } catch (e) {
        console.warn("Xverse connection error:", e);
      }
    } else {
      alert("Xverse wallet extension was not detected in this browser. Switching to Stacks Testnet Demo mode with pre-funded sBTC.");
    }
  }

  // Demo Testnet fallback
  await registerOrSwitchAccount("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", "Vittorio Affolabi");
  closeWalletModal();
}

async function registerOrSwitchAccount(stacksAddress, userName) {
  try {
    const res = await fetch("/api/v1/accounts", {
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
    console.error("Error setting account:", err);
  }
}

// ------------------------------------------------------------------------------
// Virtual Card Prototype (PRD Section 10)
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
  } catch (e) {
    alert("Error toggling freeze: " + e.message);
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
      alert(`Card Payment Declined: ${result.error}`);
      return;
    }
    alert(`Card Authorized! Charged $${amount} for "${merchant}". Settled via sBTC.`);
    loadAccountData();
    loadTransactions();
  } catch (err) {
    alert("Charge failed: " + err.message);
  }
}

// ------------------------------------------------------------------------------
// Payment Flow Modal (PRD Section 9: Flow A)
// ------------------------------------------------------------------------------
function openPaymentModal(prefillAmount, prefillCurrency) {
  if (prefillAmount) {
    document.getElementById("pay-input-amount").value = prefillAmount;
  }
  if (prefillCurrency) {
    document.getElementById("pay-input-currency").value = prefillCurrency;
  }

  showStep1();
  document.getElementById("payment-modal").classList.remove("hidden");
  lucide.createIcons();
}

function closePaymentModal() {
  document.getElementById("payment-modal").classList.add("hidden");
  if (quoteCountdownInterval) clearInterval(quoteCountdownInterval);
  loadAccountData();
  loadTransactions();
}

function showStep1() {
  document.getElementById("payment-step-1").classList.remove("hidden");
  document.getElementById("payment-step-2").classList.add("hidden");
  document.getElementById("payment-step-3").classList.add("hidden");
}

async function requestPaymentQuote() {
  const amount = parseFloat(document.getElementById("pay-input-amount").value);
  const currency = document.getElementById("pay-input-currency").value;

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
    alert("Quote calculation failed: " + err.message);
  }
}

function renderQuoteStep(quote) {
  document.getElementById("payment-step-1").classList.add("hidden");
  document.getElementById("payment-step-2").classList.remove("hidden");

  const symbol = quote.fiat_currency === "NGN" ? "₦" : (quote.fiat_currency === "EUR" ? "€" : "$");
  document.getElementById("quote-fiat-display").textContent = `${symbol}${quote.fiat_amount.toLocaleString()}`;
  document.getElementById("quote-sbtc-display").textContent = `≈ ${quote.asset_amount.toFixed(8)} sBTC`;

  document.getElementById("quote-fee-network").textContent = `${quote.network_fee_asset.toFixed(8)} sBTC`;
  document.getElementById("quote-fee-spendbtc").textContent = `${quote.execution_fee_asset.toFixed(8)} sBTC`;
  document.getElementById("quote-fee-total").textContent = `${quote.total_asset_amount.toFixed(8)} sBTC`;

  const routesContainer = document.getElementById("quote-routes-list");
  routesContainer.innerHTML = quote.routes.map(r => `
    <label class="flex items-center justify-between p-3 rounded-xl border ${r.recommended ? 'border-stacksCoral bg-stacksCoral/10' : 'border-carbonBorder bg-carbonMain/50'} cursor-pointer hover:border-slate-500 transition-all">
      <div class="flex items-center gap-3">
        <input type="radio" name="payment-route" value="${r.name}" ${r.recommended ? 'checked' : ''} class="accent-stacksCoral">
        <div>
          <p class="text-xs font-bold text-white flex items-center gap-2">
            ${r.name}
            ${r.recommended ? '<span class="stacks-badge stacks-badge-coral">Best Rate</span>' : ''}
          </p>
          <p class="text-[10px] text-slate-400">${r.description} • Est. ${r.estimated_time_sec}s</p>
        </div>
      </div>
      <span class="text-xs font-mono text-slate-300">${symbol}${r.fee_fiat} fee</span>
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
  const recipient = document.getElementById("pay-input-recipient").value || "SpendBTC Test Merchant";
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
      document.getElementById("settlement-title").textContent = "Payment Failed";
      document.getElementById("settlement-desc").textContent = result.error || "An error occurred";
      document.getElementById("settlement-icon").innerHTML = '<i data-lucide="alert-circle" class="w-8 h-8 text-rose-500"></i>';
      document.getElementById("btn-settlement-done").classList.remove("hidden");
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
      document.getElementById("settlement-desc").textContent = "Funds settled via sBTC Settlement Contract on Stacks";
      document.getElementById("settlement-icon").innerHTML = '<i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-400"></i>';

      document.getElementById("settlement-proof").classList.remove("hidden");
      document.getElementById("proof-recipient").textContent = result.recipient;
      const symbol = result.fiat_currency === "NGN" ? "₦" : "$";
      document.getElementById("proof-amount").textContent = `${symbol}${result.fiat_amount.toLocaleString()} (${result.asset_amount.toFixed(8)} sBTC)`;
      document.getElementById("proof-explorer-link").textContent = `${result.tx_hash.slice(0, 10)}...${result.tx_hash.slice(-8)}`;
      document.getElementById("proof-explorer-link").href = result.explorer_url;

      document.getElementById("btn-settlement-done").classList.remove("hidden");
      lucide.createIcons();
    }, 1200);

  } catch (err) {
    alert("Authorization failed: " + err.message);
  }
}

// ------------------------------------------------------------------------------
// Transaction Ledger (PRD Section 8.6 & 15)
// ------------------------------------------------------------------------------
async function loadTransactions() {
  try {
    const res = await fetch("/api/v1/transactions");
    const txs = await res.json();

    const recentEl = document.getElementById("recent-activity-list");
    if (recentEl) {
      recentEl.innerHTML = txs.slice(0, 3).map(tx => {
        const symbol = tx.fiat_currency === "NGN" ? "₦" : "$";
        const isCompleted = tx.status === "COMPLETED";
        return `
          <div class="py-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl ${isCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-stacksCoral/10 text-stacksCoral'} flex items-center justify-center">
                <i data-lucide="${isCompleted ? 'arrow-up-right' : 'clock'}" class="w-5 h-5"></i>
              </div>
              <div>
                <p class="text-sm font-bold text-white">${tx.recipient}</p>
                <p class="text-xs text-slate-400">${tx.route} • <span class="font-mono text-slate-300">${tx.amount.toFixed(8)} sBTC</span></p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-sm font-bold text-white font-mono">${symbol}${tx.fiat_value.toLocaleString()}</p>
              <span class="stacks-badge ${isCompleted ? 'stacks-badge-green' : 'stacks-badge-coral'}">
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
        const symbol = tx.fiat_currency === "NGN" ? "₦" : "$";
        const isCompleted = tx.status === "COMPLETED";
        const dateStr = new Date(tx.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `
          <tr class="hover:bg-carbonSurface transition-colors">
            <td class="py-3 font-mono text-slate-400">
              <span class="text-white block font-bold">${tx.id}</span>
              <span class="text-[10px]">${dateStr}</span>
            </td>
            <td class="py-3 font-semibold text-white">${tx.recipient}</td>
            <td class="py-3 font-bold text-white font-mono">${symbol}${tx.fiat_value.toLocaleString()}</td>
            <td class="py-3 font-mono text-stacksCoral">${tx.amount.toFixed(8)} sBTC</td>
            <td class="py-3 text-[11px] text-slate-400">${tx.route}</td>
            <td class="py-3">
              <span class="stacks-badge ${isCompleted ? 'stacks-badge-green' : 'stacks-badge-coral'}">
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
// Developer & Partner Portal (PRD Section 16)
// ------------------------------------------------------------------------------
async function loadDeveloperData() {
  try {
    const keysRes = await fetch("/api/v1/developer/keys");
    const keys = await keysRes.json();
    const keysList = document.getElementById("api-keys-list");
    if (keysList) {
      keysList.innerHTML = keys.map(k => `
        <div class="p-3.5 rounded-2xl bg-carbonMain border border-carbonBorder flex items-center justify-between">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-white">${k.partner_name}</span>
              <span class="stacks-badge ${k.key_type === 'live' ? 'stacks-badge-coral' : 'stacks-badge-green'}">${k.key_type}</span>
            </div>
            <p class="font-mono text-xs text-slate-400">${k.secret_key.slice(0, 14)}••••••••</p>
          </div>
          <button onclick="copyToClipboard('${k.secret_key}')" class="btn-stacks-secondary p-2 rounded-xl text-slate-400 hover:text-white">
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
        <div class="p-3 rounded-xl bg-carbonMain/80 border border-carbonBorder flex items-center justify-between text-xs">
          <div class="flex items-center gap-2.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="font-mono font-bold text-stacksIndigo">${l.event}</span>
            <span class="text-[10px] text-slate-400">${new Date(l.created_at).toLocaleTimeString()}</span>
          </div>
          <span class="stacks-badge stacks-badge-green">200 OK</span>
        </div>
      `).join("");
    }

    lucide.createIcons();
  } catch (err) {
    console.error("Failed to load developer data:", err);
  }
}

async function generateNewApiKey() {
  const name = prompt("Enter Partner / Integration Name:", "Fintech Sandbox");
  if (!name) return;
  try {
    await fetch("/api/v1/developer/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner_name: name, key_type: "test" })
    });
    loadDeveloperData();
  } catch (e) {
    alert("Key creation failed: " + e.message);
  }
}

async function sendTestWebhookPing() {
  try {
    await fetch("/api/v1/developer/webhooks/test", { method: "POST" });
    alert("Test webhook ping dispatched! Event: payment.confirmed delivered to endpoint.");
    loadDeveloperData();
  } catch (e) {
    alert("Test webhook failed: " + e.message);
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
  } catch (e) {
    respEl.textContent = JSON.stringify({ error: e.message }, null, 2);
  }
}

function copyCurlSnippet() {
  const snippet = `curl -X POST https://api.spendbtc.io/v1/payments/quote \\
  -H "Authorization: Bearer spbtc_test_8f29d71c90a14e9e" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 50000, "currency": "NGN", "asset": "sBTC"}'`;
  copyToClipboard(snippet);
  alert("cURL snippet copied to clipboard!");
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

async function resetDemoData() {
  if (confirm("Reset demo data to initial PRD state?")) {
    await fetch("/api/v1/reset", { method: "POST" });
    loadAccountData();
    loadCardData();
    loadTransactions();
    loadDeveloperData();
  }
}

// ------------------------------------------------------------------------------
// Guided Architecture Walkthrough (PRD Section 21)
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
      openPaymentModal(50000, 'NGN');
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
      closePaymentModal();
      switchTab('card');
    }
  },
  {
    step: 7,
    title: "The Infrastructure Pitch: Developer Portal",
    badge: "Architecture Spec • Developer Infrastructure",
    narrative: "<strong>'The card is only the interface. The infrastructure is the actual product.'</strong> SpendBTC exposes this entire capability via REST APIs & Webhooks so any wallet or fintech can integrate Bitcoin spending in days.",
    action: () => {
      closePaymentModal();
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
