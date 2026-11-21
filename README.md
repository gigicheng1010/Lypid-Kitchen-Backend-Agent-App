# Lypid Kitchen Creator Ops

A responsive Next.js dashboard for creator outreach, negotiations, fulfillment, payments, and UGC assets.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Google credentials.
4. Run `npm run dev` and open `http://localhost:3000`.

## Personal static version

The demo dashboard is configured for a static export. Run `npm run build` once, then open `out/index.html` directly, or run `npm run preview` when you want a local URL at `http://localhost:4173`. No Next.js backend is required for the static demo. The Google Sheets/Drive integration is optional and requires a server-side deployment.

## Google Sheets setup

## Read-only sync layer

The Vercel function at `api/sync.js` fetches both shared spreadsheets server-side and exposes `GET /api/sync`. It never writes to Google Sheets. It returns normalized creator records, raw UGC rows, a sync timestamp, and a `readOnly: true` flag. Vercel caches the response for 30 seconds and serves stale data for up to two minutes during a temporary Google failure.

Deploy this project to Vercel with the project root set to this folder. The endpoint will be `https://<your-project>.vercel.app/api/sync`. The original sheet links remain unchanged.

## 每小時唯讀同步

macOS 使用者排程 `com.lypid.marketing-sync` 每小時讀取兩個指定分頁並更新 `data/site-data.json`；登入時也會先同步一次。首頁載入時讀取快照，開啟期間每小時檢查一次。同步範圍僅為線上名單 `gid=1088293251` 與 Fitness/Event `gid=1292223053`，以唯讀方式存取，並排除其他平台及私人聯絡／寄送欄位。

需保持 Mac 開機、使用者登入且可連網。同步紀錄位於 `/tmp/lypid-marketing-sync.log`，錯誤紀錄位於 `/tmp/lypid-marketing-sync-error.log`。這是本機排程，不會產生公開網址；若要在 Mac 關機時仍每小時更新，需將專案部署至雲端排程平台。試算表儲存格中的超連結目標是 Google 的富文字資料，CSV 不提供其變更內容；已確認的場地主頁連結目前保存在網站程式中。

## Instagram 粉絲數授權更新

網站使用 [Meta Business Discovery API](https://developers.facebook.com/docs/instagram-api/guides/business-discovery/) 查詢符合資格的公開 Instagram 商業／創作者帳號粉絲數。私人、一般個人、年齡限制或其他不符合資格的帳號會沿用工作表快照；TikTok 粉絲數仍使用工作表資料。

設定步驟：

1. 到 [Meta for Developers](https://developers.facebook.com/apps/) 建立 App，加入 Instagram Graph API／Facebook Login，並確認公司 Instagram 專業帳號已連結 Facebook 粉絲專頁。
2. 打開 [Graph API Explorer](https://developers.facebook.com/tools/explorer/)，選取剛建立的 App，產生使用者權杖並核准 `instagram_basic`、`instagram_manage_insights`、`pages_read_engagement`。查詢 `/me/accounts` 時也可能需要 `pages_show_list`。如果公司 Page 角色是透過 Business Manager 授予，Business Discovery 文件要求 `ads_read` 或 `ads_management` 其中之一；依 Meta 提示完成 App Review／Advanced Access。
3. 在 Graph API Explorer 用已授權的權杖執行 `me/accounts?fields=name,instagram_business_account{id,username}`，從公司粉專資料中找到 `instagram_business_account.id`，這就是設定工具要的 Instagram 專業帳號 ID。若查不到，先確認登入者有該粉專的管理／洞察權限，以及 IG 與粉專已正確連結。
4. 在本機終端執行 `python3 scripts/configure_instagram_api.py`。輸入 Instagram 專業帳號 ID；選擇將短效權杖交換為長效權杖；再依提示輸入 Meta App ID、App Secret 和短效使用者權杖。App Secret 與權杖只在本機終端輸入，**不要貼到聊天、試算表或網站前端**。
5. 腳本會把長效權杖存到 `~/.config/lypid/instagram-graph.json`，目錄權限為 `700`、檔案為 `600`。下一次每小時排程便會開始查詢；每個帳號最多每 24 小時查一次。Meta 長效使用者權杖通常約 60 天到期；目前到期後需要重新登入授權，再重跑設定腳本。遇到私人、一般個人、年齡限制或 Meta 不允許 Business Discovery 的帳號時，網站會保留工作表數字並標示來源。

1. In Google Cloud Console, create a project and enable **Google Sheets API** and **Google Drive API**.
2. Create a service account under IAM & Admin, then create a JSON key. Put its email and private key into `.env.local`.
3. Create a master spreadsheet with a tab named `Creators`. Share the spreadsheet with the service-account email as Editor.
4. Use these columns in row 1: `Name, Handle, Platform, Followers, Profile URL, Deliverable, Campaign Status, Rate, Payment Status, Zelle, Address, Tracking, Contents, Asset URL, Concept, Date`.
5. Add the spreadsheet ID to `GOOGLE_SHEETS_ID`. The server helper in `src/lib/google.ts` reads and updates this range.
6. Create a Drive folder for raw UGC, share it with the service account as Viewer, and set `GOOGLE_DRIVE_UGC_FOLDER_ID`.
7. Replace the demo local data in `src/lib/data.ts` with a server route that calls `readMasterSheet()` and maps rows to the `Creator` type. Set a 30-second polling interval or add a Sheets webhook through your backend for push updates.

## Storage notes

The UI's asset cards accept a Drive or S3 URL. For private Drive files, create a server route that calls Drive `files.get` with `alt: media`, then streams the response to the browser. Keep service-account credentials server-only.
