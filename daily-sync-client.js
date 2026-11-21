const onlineSheetUrl = "https://docs.google.com/spreadsheets/d/1Cf7rxfFDhVD4gSqxcojITNKIlPt1qqS7WNMX8lvgSns/edit?gid=1088293251#gid=1088293251";
const labelTranslations = {
  "Outreached (Waiting)": "等待回覆",
  "Shipped / Ordered": "已寄出／訂購",
  "Completed": "已完成",
  "Accepted (Preparing)": "已接受／準備中",
  "Rejected": "已婉拒",
  "PR Box": "PR 產品寄送",
  "Paid Collab": "付費合作",
  "Gift Card": "禮卡",
  "Posted": "已發佈",
  "Received": "已收到",
  "(空白)": "未填",
  "Dietitian": "營養師",
  "Healthy lifestyle": "健康生活",
  "Healthy lifesytle": "健康生活",
  "Hiker": "健行",
  "Vegan": "純素",
  "健康 漂亮vlogger": "健康／美妝創作者",
  "Foodie": "美食創作者",
  "Food blogger / Foodie": "美食創作者",
  "Workout Lifestyle": "運動生活",
  "Nursing student": "護理系學生",
  "Nursing school學生": "護理系學生",
};
const eventNameTranslations = {
  "Between the covers Book Club": "Between the Covers Book Club",
  "Seattle Bouldering Project [UD]": "Seattle Bouldering Project｜UD",
  "Seattle Bouldering Project [Fremont]": "Seattle Bouldering Project｜Fremont",
  "Seattle Bouldering Project [Poplar]": "Seattle Bouldering Project｜Poplar",
  "Bodyrok (Belltown)": "Bodyrok｜Belltown",
  "Barre3 [Bellevue]": "Barre3｜Bellevue",
  "Barre3 [Ballard]": "Barre3｜Ballard",
  "Barre3 [Capitol Hill]": "Barre3｜Capitol Hill",
  "Solicore [SLU / Capitol Hill]": "Solicore｜SLU／Capitol Hill",
  "CorePower Yoga [Fremont/ Ballard/ Greenlake]": "CorePower Yoga｜Fremont／Ballard／Greenlake",
  "24hr fitness": "24 Hour Fitness",
};

let followerHistory = null;

async function loadFollowerHistory() {
  try {
    const response = await fetch("/data/followers-history.json?refresh=" + Date.now(), { cache: "no-store" });
    if (response.ok) followerHistory = await response.json();
  } catch (error) {
    followerHistory = null;
  }
}

function formatFollowerCountWithSource(creator) {
  if (creator.followersSource === "meta" && creator.followersExact != null) return formatExactFollowerCount(creator.followersExact);
  if (creator.followersSource === "public-page" && creator.followersExact != null) return formatExactFollowerCount(creator.followersExact);
  const followersK = Number(creator.followersK);
  if (!Number.isFinite(followersK) || followersK < 0) return "—";
  if (followersK < 10) return Math.round(followersK * 1000).toLocaleString("en-US");
  if (followersK < 1000) {
    return `${followersK.toFixed(followersK >= 100 ? 1 : 2).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1")}K`;
  }
  const millions = followersK / 1000;
  return `${millions.toFixed(millions >= 10 ? 1 : 2).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1")}M`;
}

function formatExactFollowerCount(exact) {
  const value = Number(exact);
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 10000) return value.toLocaleString("en-US");
  if (value < 1000000) {
    const k = value / 1000;
    return `${k.toFixed(k >= 100 ? 1 : 2).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1")}K`;
  }
  const m = value / 1000000;
  return `${m.toFixed(m >= 10 ? 1 : 2).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1")}M`;
}

function formatFollowerTrend(platformName, creatorName, currentExact) {
  if (!followerHistory || !Array.isArray(followerHistory.days) || followerHistory.days.length < 2 || currentExact === null || currentExact === undefined) return "";
  const platformKey = platformName === "Instagram" ? "instagram" : "tiktok";
  const days = followerHistory.days;
  const previous = [...days].reverse().slice(1).find((day) => day[platformKey] && Number.isFinite(day[platformKey][creatorName]));
  if (!previous) return "";
  const previousExact = Number(previous[platformKey][creatorName]);
  const difference = Number(currentExact) - previousExact;
  if (!difference) return `<span class="follower-trend neutral">— 0</span>`;
  if (difference > 0) return `<span class="follower-trend up">▲ +${formatExactFollowerCount(Math.abs(difference))}</span>`;
  return `<span class="follower-trend down">▼ −${formatExactFollowerCount(Math.abs(difference))}</span>`;
}

function escapeSyncHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function translateSyncLabel(value) {
  const label = String(value || "").trim();
  if (labelTranslations[label]) return labelTranslations[label];
  const match = Object.keys(labelTranslations).find((key) => key.toLowerCase() === label.toLowerCase());
  return match ? labelTranslations[match] : label;
}

function canonicalFeatureLabel(value) {
  const raw = String(value || "").trim();
  const text = `${raw} ${translateSyncLabel(raw)}`.toLowerCase();
  if (!raw) return "未標記";
  if (/dietitian|營養師/.test(text)) return "營養師";
  if (/nursing|nurse|doctor|medical|護理|護士|醫生/.test(text)) return "醫療／護理";
  if (/vegan|純素/.test(text)) return "純素飲食";
  if (/healthy lifestyle|healthy lifesytle|健康生活|健康/.test(text)) return "健康生活";
  if (/food|foodie|recipe|coffee|yogurt|食譜|早餐|飲食|咖啡|廚師|美食/.test(text)) return "飲食／食譜";
  if (/workout|fitness|hiker|tennis|健行|健身|運動|滑輪|戶外/.test(text)) return "運動／戶外";
  if (/ugc|filming|拍攝|影像/.test(text)) return "影像／UGC";
  if (/flight attendant|tech|banker|profession|wieiad|職業|大廠|忙碌工作/.test(text)) return "職業生活";
  if (/粉絲多|喜歡產品/.test(text)) return "品牌好感";
  if (/lifestyle|vlogger|travel|family|mom|fashion|beauty|wieiad|city walk|時尚|美妝|家庭|穿搭|旅遊|生活|vlog/.test(text)) return "生活風格";
  return translateSyncLabel(raw) || "其他特色";
}

function formatSourceText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\n+/g, "；")
    .replace(/\bPop[- ]?up\b/gi, "快閃活動")
    .replace(/\bDemo\b/gi, "試飲活動")
    .replace(/\bFollowed up\b/gi, "已追蹤聯絡")
    .replace(/\bFollow-up\b/gi, "後續聯絡")
    .replace(/\breached out\b/gi, "已主動聯絡")
    .replace(/\bno reply\b/gi, "未回覆")
    .trim();
}

const phaseOrder = ["Outreached (Waiting)", "Accepted (Preparing)", "Shipped / Ordered", "Completed", "Rejected", "(空白)"];
const phaseColors = ["#FF8AB4", "#b788c3", "#7b9f82", "#2D1341", "#bd6f87", "#d9d0c8"];

function renderBarList(counts, total, labels = Object.keys(counts || {}), colors = phaseColors) {
  return labels.map((key, index) => {
    const count = Number(counts?.[key] || 0);
    const percent = total ? Math.round((count / total) * 100) : 0;
    return `<div class="online-bar-row"><div class="online-bar-label"><span><i class="online-dot" style="background:${colors[index % colors.length]}"></i>${escapeSyncHtml(translateSyncLabel(key))}</span><b>${count} <small>${percent}%</small></b></div><div class="online-bar-track"><i style="width:${percent}%;background:${colors[index % colors.length]}"></i></div></div>`;
  }).join("");
}

function renderPlatformHeading(platformName, stats) {
  return `<div class="online-platform-heading"><b>${escapeSyncHtml(platformName)}</b><span>${stats.total} 位</span><a href="${onlineSheetUrl}" target="_blank" rel="noreferrer">開啟名單 ↗</a></div>`;
}

function renderFeatureList(platformName, stats) {
  const featureCounts = {};
  (stats.topFeatures || []).filter(([feature]) => feature && feature !== "(空白)").forEach(([feature, count]) => {
    const label = canonicalFeatureLabel(feature);
    featureCounts[label] = (featureCounts[label] || 0) + count;
  });
  return Object.entries(featureCounts).map(([feature, count]) => `<button type="button" class="online-tag online-feature-tag" data-platform="${escapeSyncHtml(platformName)}" data-feature="${escapeSyncHtml(feature)}" aria-label="查看${escapeSyncHtml(platformName)}的${escapeSyncHtml(feature)}創作者">${escapeSyncHtml(feature)} <b>${count}</b></button>`).join("") || "<span class=\"online-muted\">尚無標籤</span>";
}

function renderOnlineComparison(stats) {
  const instagram = stats.Instagram || {};
  const tiktok = stats.TikTok || {};
  const liveInstagramCount = Number(instagram.followersSourceCounts?.meta || 0);
  const publicInstagramCount = Number(instagram.followersSourceCounts?.["public-page"] || 0);
  const tiers = (platform) => `<div class="online-simple-stats"><span>PR 產品寄送 <b>${platform.tiers?.["PR Box"] || 0}</b></span><span>付費合作 <b>${platform.tiers?.["Paid Collab"] || 0}</b></span></div>`;
  const followers = (platform) => {
    const data = platform.followersK || {};
    return `<div class="online-simple-stats"><span>&lt;10K <b>${data.under10 || 0}</b></span><span>10K–&lt;50K <b>${data.from10To50 || 0}</b></span><span>≥50K <b>${data.over50 || 0}</b></span><span>中位數 <b>${Number(data.median || 0).toLocaleString("zh-TW", { maximumFractionDigits: 1 })}K</b></span></div>`;
  };
  const posting = (platform) => {
    const data = platform.posting || {};
    const total = Object.values(data).reduce((sum, count) => sum + Number(count || 0), 0);
    return `<div class="online-phase-list">${renderBarList(data, total, Object.keys(data), ["#6d8c70", "#d6a957", "#d9d0c8", "#a97964"])}</div>`;
  };
  const paid = (platform) => {
    const data = platform.paidCollaborations || {};
    return `<div class="online-simple-stats"><span>既有付費合作 <b>${data.count || 0} 筆</b></span><span>表內金額 <b>US$${Number(data.recordedAmount || 0).toLocaleString("en-US")}</b></span><span>平均每筆 <b>US$${Number(data.averageRate || 0).toLocaleString("en-US")}</b></span></div><small class="online-budget-note">既有紀錄；不代表新增 UGC 預算</small>`;
  };
  const row = (label, left, right) => `<tr><th scope="row">${label}</th><td data-platform="Instagram">${left}</td><td data-platform="TikTok">${right}</td></tr>`;
  const followersLabel = liveInstagramCount
    ? `粉絲數（Instagram 已由 Meta 更新 ${liveInstagramCount}/${instagram.total}；TikTok 為工作表記錄）`
    : publicInstagramCount
      ? `粉絲數（Instagram 公開頁更新 ${publicInstagramCount}/${instagram.total}；TikTok 為工作表記錄）`
      : "粉絲數（工作表記錄，非即時）";
  return `<div class="online-table-scroll"><table class="online-comparison"><thead><tr><th scope="col">比較指標</th><th scope="col">${renderPlatformHeading("Instagram", instagram)}</th><th scope="col">${renderPlatformHeading("TikTok", tiktok)}</th></tr></thead><tbody>${row("合作階段", `<div class="online-phase-list">${renderBarList(instagram.phases, instagram.total, phaseOrder)}</div>`, `<div class="online-phase-list">${renderBarList(tiktok.phases, tiktok.total, phaseOrder)}</div>`)}${row("合作類型", tiers(instagram), tiers(tiktok))}${row(followersLabel, followers(instagram), followers(tiktok))}${row("內容進度", posting(instagram), posting(tiktok))}${row("常見創作者特色", `<div class="online-tags">${renderFeatureList("Instagram", instagram)}</div>`, `<div class="online-tags">${renderFeatureList("TikTok", tiktok)}</div>`)}${row("費用紀錄", paid(instagram), paid(tiktok))}</tbody></table></div>`;
}

function ensureCreatorDialog() {
  let dialog = document.getElementById("creatorFeatureDialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "creatorFeatureDialog";
  dialog.className = "creator-dialog";
  dialog.innerHTML = `<div class="creator-dialog-head"><div><p class="creator-dialog-kicker">創作者特點</p><h2 id="creatorDialogTitle"></h2><p id="creatorDialogSummary"></p><p class="creator-followers-note">粉絲數為工作表記錄，非平台即時數據</p></div><button type="button" class="creator-dialog-close" aria-label="關閉創作者清單">×</button></div><label class="creator-dialog-search"><span>搜尋創作者</span><input id="creatorDialogSearch" type="search" placeholder="輸入姓名或社群帳號"></label><div id="creatorDialogResults" class="creator-dialog-results"></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector(".creator-dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.querySelector("#creatorDialogSearch").addEventListener("input", renderCreatorDialogResults);
  return dialog;
}

function renderCreatorDialogResults() {
  const dialog = document.getElementById("creatorFeatureDialog");
  if (!dialog) return;
  const query = dialog.querySelector("#creatorDialogSearch").value.trim().toLowerCase();
  const creators = (dialog._matchingCreators || []).filter((creator) => `${creator.name} ${creator.profileUrl}`.toLowerCase().includes(query));
  const results = dialog.querySelector("#creatorDialogResults");
  results.innerHTML = creators.length ? creators.map((creator) => {
    const followers = creator.followersSource === "meta" && creator.followersExact !== null && creator.followersExact !== undefined
      ? `${formatExactFollowerCount(creator.followersExact)} 粉絲 · Meta ${new Date(creator.followersCheckedAt).toLocaleDateString("zh-TW")}`
      : creator.followersSource === "public-page" && creator.followersExact !== null && creator.followersExact !== undefined
        ? `${formatExactFollowerCount(creator.followersExact)} 粉絲 · 公開頁面 ${new Date(creator.followersCheckedAt).toLocaleDateString("zh-TW")}`
        : `${formatFollowerCountWithSource(creator)} 粉絲 · 工作表記錄（非即時）`;
    const tier = translateSyncLabel(creator.tier || "");
    const phase = translateSyncLabel(creator.phase || "");
    const currentTrendExact = creator.followersExact != null
      ? Number(creator.followersExact)
      : Number.isFinite(Number(creator.followersK))
        ? Math.round(Number(creator.followersK) * 1000)
        : null;
    const trend = formatFollowerTrend(dialog._platformName, creator.name, currentTrendExact);
    return `<article class="creator-result"><div><a class="creator-profile-link" href="${escapeSyncHtml(creator.profileUrl)}" target="_blank" rel="noreferrer">${escapeSyncHtml(creator.name)} ↗</a><p>${escapeSyncHtml(creator.profileUrl)}</p><span class="creator-original-feature">原始特色：${escapeSyncHtml(creator.feature || "未標記")}</span></div><div class="creator-result-meta"><span>${escapeSyncHtml(followers)} ${trend}</span><span>${escapeSyncHtml(tier)}</span><span>${escapeSyncHtml(phase)}</span></div></article>`;
  }).join("") : `<div class="creator-dialog-empty">沒有符合條件的創作者。</div>`;
}

function openCreatorsForFeature(platformName, feature) {
  const creators = window.onlineSnapshot?.[platformName]?.creators || [];
  const matchingCreators = creators.filter((creator) => canonicalFeatureLabel(creator.feature) === feature && creator.profileUrl);
  const dialog = ensureCreatorDialog();
  dialog.querySelector("#creatorDialogTitle").textContent = feature;
  dialog.querySelector("#creatorDialogSummary").textContent = `${platformName}｜${matchingCreators.length} 位創作者`;
  dialog._matchingCreators = matchingCreators;
  dialog._platformName = platformName;
  dialog.querySelector("#creatorDialogSearch").value = "";
  renderCreatorDialogResults();
  dialog.showModal();
}

document.addEventListener("click", (event) => {
  const tag = event.target.closest(".online-feature-tag");
  if (tag) openCreatorsForFeature(tag.dataset.platform, tag.dataset.feature);
});

function inferNewEventStatus(event) {
  const content = `${event.eventDetails || ""} ${event.notes || ""}`.toLowerCase();
  if (!content.trim()) return "未補紀錄";
  if (/未回覆|no reply|follow.?up|reached out|邀請/.test(content)) return "待跟進";
  if (/11月\s*#|planned|upcoming/.test(content)) return "規劃中";
  if (/demo|pop.?up|試飲|快閃/.test(content)) return "已執行";
  return "待跟進";
}

function applyEventSnapshot(events) {
  if (typeof activities === "undefined") return;
  const currentByName = new Map(activities.map((activity) => [activity.name, activity]));
  const refreshed = events.map((source) => {
    const displayName = eventNameTranslations[source.name] || source.name;
    const current = currentByName.get(displayName) || {
      name: displayName,
      date: "日期未記錄",
      status: inferNewEventStatus(source),
      tone: "follow",
      summary: "請查看最新表單活動紀錄。",
      result: "",
    };
    const eventDetails = formatSourceText(source.eventDetails);
    const sourceNotes = formatSourceText(source.notes);
    const sourceLog = [eventDetails, sourceNotes].filter(Boolean).join("；");
    if (sourceLog) current.result = `表單最新紀錄：${sourceLog}`;
    if (source.profileUrl) venueLinks[displayName] = source.profileUrl;
    return current;
  });
  activities.splice(0, activities.length, ...refreshed);
  renderEvents();
  addVenueLinks();
  const eventCount = document.querySelector("#offline .panel-head .pill");
  if (eventCount) eventCount.textContent = `${events.length} 筆活動／場地`;
}

function applyOnlineSnapshot(online) {
  const stats = online && online.platforms;
  if (!stats) return;
  window.onlineSnapshot = stats;
  const totals = document.querySelectorAll(".stats .stat");
  const total = (stats.Instagram?.total || 0) + (stats.TikTok?.total || 0);
  const values = [total, stats.Instagram?.total || 0, stats.TikTok?.total || 0];
  const labels = ["線上名單（Instagram＋TikTok）", "Instagram", "TikTok"];
  values.forEach((value, index) => {
    const card = totals[index];
    if (!card) return;
    card.querySelector("span").textContent = labels[index];
    card.querySelector("b").textContent = value;
  });
  const heroEyebrow = document.querySelector(".hero .eyebrow");
  if (heroEyebrow) heroEyebrow.textContent = "創作者與社群行銷";
  const onlineGrid = document.querySelector("#online .online-grid");
  if (onlineGrid) {
    onlineGrid.style.gridTemplateColumns = "1fr";
    onlineGrid.innerHTML = renderOnlineComparison(stats);
  }
  const onlinePill = document.querySelector("#online .panel-head .pill");
  if (onlinePill) onlinePill.textContent = `${total} 筆 Instagram／TikTok 連結`;
  const onlineFine = document.querySelector("#online .fine");
  if (onlineFine) onlineFine.textContent = `來源：第一分頁，共 ${total} 筆 Instagram／TikTok 社群連結；其他平台不列入本區。`;
}

async function refreshMarketingSnapshot() {
  try {
    const response = await fetch(`/data/site-data.json?refresh=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const snapshot = await response.json();
    applyOnlineSnapshot(snapshot.online);
    applyEventSnapshot(snapshot.events);
    const stamp = new Date(snapshot.generatedAt).toLocaleString("zh-TW", { dateStyle: "medium", timeStyle: "short" });
    const readOnlyLabel = document.querySelector(".ro");
    if (readOnlyLabel) readOnlyLabel.textContent = `唯讀檢視｜每日同步 ${stamp}`;
  } catch (error) {
    console.warn("每日行銷資料快照尚未載入", error);
  }
}

const syncStyles = document.createElement("style");
syncStyles.textContent = ".online-grid{display:block!important}.online-table-scroll{overflow-x:auto;border:1px solid #e7dce5;border-radius:12px}.online-comparison{border-collapse:collapse;min-width:880px;width:100%;background:#fffef8}.online-comparison th,.online-comparison td{padding:14px 16px;border-bottom:1px solid #eee5dc;vertical-align:top;text-align:left}.online-comparison thead th{background:#f7ece8;color:#2D1341;font-size:11px}.online-comparison thead th:first-child{width:150px}.online-comparison tbody th{width:150px;background:#fff9f1;color:#2D1341;font-size:12px}.online-platform-cell{min-width:360px}.online-platform-heading{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.online-platform-heading>b{font:700 19px 'Space Grotesk';color:#2D1341}.online-platform-heading>span{padding:4px 8px;border-radius:20px;background:#FF8AB4;color:#2D1341;font-size:10px;font-weight:700}.online-platform-heading>a{margin-left:auto;color:#653375;font-size:10px;font-weight:700;text-decoration:none}.online-platform-summary{display:flex;gap:8px;margin:12px 0}.online-platform-summary span{flex:1;padding:8px 10px;border-radius:8px;background:#f7ece8;color:#2D1341;font-size:10px}.online-platform-summary b{float:right;color:#2D1341;font-size:12px}.online-phase-list{display:grid;gap:7px}.online-bar-row{min-width:150px}.online-bar-label{display:flex;justify-content:space-between;gap:8px;color:#5e4d67;font-size:10px}.online-bar-label b{color:#2D1341;white-space:nowrap}.online-bar-label small{font-weight:500;color:#877991}.online-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px}.online-bar-track{height:4px;margin-top:3px;border-radius:4px;background:#f0e9e1;overflow:hidden}.online-bar-track>i{display:block;height:100%;border-radius:4px}.online-inline-metrics{display:grid;gap:12px;margin-top:13px;padding-top:12px;border-top:1px solid #eee5dc}.online-inline-metrics small{font-size:10px;color:#796b80}.online-inline-metrics p{margin:6px 0 0;color:#5e4d67;font-size:10px;line-height:1.6}.online-inline-metrics p b{color:#2D1341}.online-posting-list{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;margin-top:7px}.online-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.online-tag{padding:4px 7px;border-radius:20px;background:#f7ece8;color:#543064;font-size:10px}.online-tag b{margin-left:3px;color:#2D1341}.online-muted{font-size:10px;color:#796b80}.online-budget{padding:10px;border-radius:8px;background:#f7ece8;color:#5e4d67;font-size:10px;line-height:1.6}.online-budget b{color:#2D1341}.online-budget span{display:block;color:#877991;font-size:9px}@media(max-width:780px){.online-platform-cell{min-width:320px}.online-comparison th,.online-comparison td{padding:11px 12px}}";
document.head.appendChild(syncStyles);
const responsiveOnlineStyles = document.createElement("style");
responsiveOnlineStyles.textContent = ".online-simple-stats{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px}.online-simple-stats span{display:inline-flex;gap:7px;align-items:baseline;color:#786960;font-size:11px}.online-simple-stats b{color:#3e2319}.online-table-scroll{overflow-x:auto}@media(max-width:780px){.online-table-scroll{overflow:visible;border:0}.online-comparison{display:block;min-width:0;width:100%;background:transparent}.online-comparison thead,.online-comparison tbody{display:block}.online-comparison thead tr{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.online-comparison thead th{display:block;min-width:0;width:auto!important;padding:12px;border:1px solid #e8ddd2;border-radius:10px;background:#fffdfa}.online-comparison thead th:first-child{display:none}.online-comparison tbody tr{display:grid;grid-template-columns:1fr 1fr;margin-top:10px;border:1px solid #e8ddd2;border-radius:11px;overflow:hidden;background:#fffdfa}.online-comparison tbody th{display:block;grid-column:1/-1;width:auto!important;padding:9px 11px;background:#faf6f1;font-size:11px}.online-comparison tbody td{display:block;min-width:0;padding:10px;border-bottom:0;border-right:1px solid #eee5dc}.online-comparison tbody td:last-child{border-right:0}.online-comparison tbody td::before{content:attr(data-platform);display:block;margin-bottom:8px;color:#a35437;font-size:10px;font-weight:700}.online-phase-list{gap:6px}.online-bar-row{min-width:0}.online-bar-label{font-size:9px}.online-posting-list{grid-template-columns:1fr}.online-inline-metrics p{font-size:9px;word-break:normal}.online-tags{gap:4px}.online-tag{font-size:9px;padding:4px 6px}}";
document.head.appendChild(responsiveOnlineStyles);
const readableTypeStyles = document.createElement("style");
readableTypeStyles.textContent = "body{font-size:16px}.ro{font-size:13px}.eyebrow{font-size:12px}.hero p{font-size:16px}.stat span{font-size:13px}.stat small{font-size:12px}.tab{font-size:15px}.panel h2{font-size:22px}.panel-head p{font-size:14px}.online-platform-heading>b{font-size:21px}.online-platform-heading>span,.online-platform-heading>a{font-size:12px}.online-comparison thead th{font-size:13px}.online-comparison tbody th{font-size:14px}.online-bar-label{font-size:12px}.online-bar-label small{font-size:11px}.online-inline-metrics small{font-size:12px}.online-inline-metrics p{font-size:12px}.online-tag{font-size:12px}.online-budget{font-size:12px}.online-budget span{font-size:11px}.online-simple-stats span{font-size:12px}.controls input,.controls select{font-size:14px}.event h3{font-size:16px}.event .date{font-size:12px}.event p{font-size:13px}.event .result{font-size:12px}.fine,.footer{font-size:12px}@media(max-width:600px){.hero p{font-size:15px}.online-comparison tbody th{font-size:13px}.online-bar-label{font-size:11px}.online-inline-metrics p{font-size:11px}.online-tag{font-size:11px}.event p{font-size:12px}}";
document.head.appendChild(readableTypeStyles);
const doubleTypeStyles = document.createElement("style");
doubleTypeStyles.textContent = "body{font-size:28px!important}.ro{font-size:15px!important;max-width:34%;text-align:right;line-height:1.45}.eyebrow{font-size:18px!important}.hero h1{font-size:56px!important;line-height:1.16}.hero p{font-size:26px!important;line-height:1.55}.stat span{font-size:20px!important}.stat b{font-size:46px!important}.stat small{font-size:18px!important}.tab{font-size:24px!important}.panel h2{font-size:34px!important}.panel-head p{font-size:22px!important}.online-platform-heading>b{font-size:30px!important}.online-platform-heading>span,.online-platform-heading>a{font-size:18px!important}.online-comparison thead th{font-size:20px!important}.online-comparison tbody th{font-size:22px!important}.online-bar-label{font-size:18px!important}.online-bar-label small{font-size:16px!important}.online-inline-metrics small{font-size:18px!important}.online-inline-metrics p{font-size:18px!important}.online-tag{font-size:18px!important}.online-budget{font-size:18px!important}.online-budget span{font-size:16px!important}.online-simple-stats span{font-size:18px!important}.controls input,.controls select{font-size:20px!important}.event h3{font-size:24px!important}.event .date{font-size:18px!important}.event p{font-size:20px!important}.event .result{font-size:18px!important}.fine,.footer{font-size:18px!important}@media(max-width:600px){.masthead{gap:10px}.brand strong{font-size:14px}.brand small{font-size:11px}.ro{font-size:12px!important}.hero{padding:24px 0 20px}.hero h1{font-size:40px!important;line-height:1.2}.hero p{font-size:19px!important}.eyebrow{font-size:15px!important}.stat span{font-size:17px!important}.stat b{font-size:34px!important}.stat small{font-size:15px!important}.tab{font-size:19px!important}.panel h2{font-size:27px!important}.panel-head p{font-size:17px!important}.online-platform-heading>b{font-size:23px!important}.online-platform-heading>span,.online-platform-heading>a{font-size:14px!important}.online-comparison tbody th{font-size:17px!important}.online-bar-label{font-size:14px!important}.online-inline-metrics p{font-size:14px!important}.online-tag{font-size:14px!important}.online-budget{font-size:14px!important}.event h3{font-size:19px!important}.event p{font-size:16px!important}}";
document.head.appendChild(doubleTypeStyles);
const comfortableTypeStyles = document.createElement("style");
comfortableTypeStyles.textContent = "body{font-size:16px!important}.ro{font-size:13px!important;max-width:none;text-align:right}.eyebrow{font-size:12px!important}.hero h1{font-size:38px!important;line-height:1.2}.hero p{font-size:16px!important;line-height:1.8}.stat span{font-size:13px!important}.stat b{font-size:25px!important}.stat small{font-size:12px!important}.tab{font-size:15px!important}.panel h2{font-size:22px!important}.panel-head p{font-size:14px!important}.online-platform-heading>b{font-size:21px!important}.online-platform-heading>span,.online-platform-heading>a{font-size:12px!important}.online-comparison thead th{font-size:13px!important}.online-comparison tbody th{font-size:14px!important}.online-bar-label{font-size:12px!important}.online-bar-label small{font-size:11px!important}.online-inline-metrics small{font-size:12px!important}.online-inline-metrics p{font-size:12px!important}.online-tag{font-size:12px!important}.online-budget{font-size:12px!important}.online-budget span{font-size:11px!important}.online-simple-stats span{font-size:12px!important}.controls input,.controls select{font-size:14px!important}.event h3{font-size:16px!important}.event .date{font-size:12px!important}.event p{font-size:13px!important}.event .result{font-size:12px!important}.fine,.footer{font-size:12px!important}@media(max-width:600px){.hero h1{font-size:32px!important;line-height:1.25}.hero p{font-size:15px!important}.ro{font-size:12px!important}.online-comparison tbody th{font-size:13px!important}.online-bar-label{font-size:11px!important}.online-inline-metrics p{font-size:11px!important}.online-tag{font-size:11px!important}.event p{font-size:12px!important}}";
document.head.appendChild(comfortableTypeStyles);
const dashboardTitle = document.querySelector(".hero h1");
if (dashboardTitle) dashboardTitle.textContent = "蛋白飲社媒行銷紀錄";
const featureDialogStyles = document.createElement("style");
featureDialogStyles.textContent = ".online-feature-tag{appearance:none;border:0;cursor:pointer;font:inherit;line-height:1.45;transition:background .15s,transform .15s}.online-feature-tag:hover{background:#ff8ab4;color:#2d1341;transform:translateY(-1px)}.online-tags{max-height:180px;overflow:auto;align-content:flex-start;padding:2px}.creator-dialog{width:min(760px,calc(100vw - 32px));max-height:min(82vh,760px);margin:auto;padding:22px;border:1px solid #e7dce5;border-radius:16px;background:#fffef8;color:#2d1341;box-shadow:0 24px 70px #2d134144}.creator-dialog::backdrop{background:#2d134177;backdrop-filter:blur(3px)}.creator-dialog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.creator-dialog-kicker{margin:0 0 5px;color:#653375;font-size:12px;font-weight:700}.creator-dialog-head h2{margin:0;font:700 28px 'Space Grotesk';color:#2d1341}.creator-dialog-head p:last-child{margin:5px 0 0;color:#786b7e;font-size:13px}.creator-followers-note{margin:5px 0 0;color:#937f98;font-size:10px}.creator-dialog-close{width:38px;height:38px;border:0;border-radius:50%;background:#f7ece8;color:#2d1341;font-size:25px;line-height:1;cursor:pointer}.creator-dialog-search{display:block;margin:18px 0 12px;color:#66556d;font-size:12px;font-weight:700}.creator-dialog-search input{display:block;width:100%;height:42px;margin-top:6px;padding:0 12px;border:1px solid #e7dce5;border-radius:9px;background:#fff;font:14px 'DM Sans',sans-serif}.creator-dialog-results{max-height:52vh;overflow:auto;border-top:1px solid #eee5dc}.creator-result{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:12px 3px;border-bottom:1px solid #eee5dc}.creator-profile-link{color:#653375;font-size:15px;font-weight:700;text-decoration:none}.creator-profile-link:hover{text-decoration:underline}.creator-result p{margin:4px 0 0;color:#887b8d;font-size:11px;overflow-wrap:anywhere}.creator-original-feature{display:block;margin-top:5px;color:#786b7e;font-size:10px}.creator-result-meta{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.creator-result-meta span{padding:5px 8px;border-radius:20px;background:#f7ece8;color:#594663;font-size:10px;white-space:nowrap}.creator-dialog-empty{padding:30px;text-align:center;color:#786b7e;font-size:14px}@media(max-width:600px){.creator-dialog{padding:16px}.creator-dialog-head h2{font-size:23px}.creator-result{align-items:flex-start;flex-direction:column;gap:8px}.creator-result-meta{justify-content:flex-start}.creator-dialog-results{max-height:55vh}}";
document.head.appendChild(featureDialogStyles);
const followerTrendStyles = document.createElement("style");
followerTrendStyles.textContent = ".follower-trend{display:inline-block;margin-left:5px;font-weight:700;white-space:nowrap}.follower-trend.up{color:#397044}.follower-trend.down{color:#a64f45}.follower-trend.neutral{color:#8b7d75}";
document.head.appendChild(followerTrendStyles);
loadFollowerHistory();
refreshMarketingSnapshot();
window.setInterval(refreshMarketingSnapshot, 60 * 60 * 1000);
