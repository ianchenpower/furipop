# 自動測試與代理分工

主要測試由開發代理負責，不把找功能問題的責任交給使用者。使用者回饋作為補充，特別是實際語境與閱讀手感。

## 執行

Node.js 18+，無需建置擴充功能。核心測試不需 npm dependencies：

~~~sh
node tests/run.cjs
~~~

完整測試含隔離瀏覽器（需可解析的 playwright-core，或指定 PLAYWRIGHT_CORE_PATH；預設 Edge，可由 EDGE_BINARY 指定）：

~~~sh
node tests/run.cjs --all
node tests/run.cjs --browser
~~~

詳細日誌保存在忽略的 work/test-results.json。瀏覽器測試各自建立 work/ 下獨立 profile，結束或啟動失敗時清理；不使用使用者登入狀態、不修改真實 X 推文。若程序遭強制中止，仍可能留下暫存。

## 案例性質

- language-corpus.cjs：68 個明確產品規則案例、6 項 trim/cache 一致性檢查；34 個中日混合探索輸入只記錄 observations，不能算成辨識正確，也不能因主觀標籤自動算錯。
- tokenizer-properties.cjs：181 組（168 確定性組合、8 Unicode 邊界、5 自訂詞操作）。檢查原文重建、UTF-16 索引、字典最長匹配及快取失效，不把 AI 生成讀音當標準答案。
- offscreen-properties.cjs：固定 seed 0x5eedc0de；240 次生成操作加明確覆蓋序列，共 250 記錄事件、129 請求與46代 Worker。檢查回覆次數、隔代污染、恢復及 timer 清理。這是狀態序列，不是250個真實使用者樣本。
- browser-matrix.cjs：48 組，含四種行內包裝、拆字與三種視窗寬度、十二次SPA文字替換、中文混合文字與補充平面漢字名字。
- popup.cjs：驗證開關成功儲存、寫入失敗時恢復舊值與顯示錯誤。
- youtube-flicker.cjs：驗證逐字字幕保留既有假名、持續輸入期間補充讀音、短暫漢字過渡、來源重建、長時間空字幕清除及語言變更。
- youtube-alignment.cjs：測試模擬雙行字幕在不同字級的原文位置對齊。
- youtube.cjs：驗證標題、資訊欄、留言、連結、字幕背景、拖移、字型、快速換句合併、字幕自動標音、停用回退及中日混合分區。
- japanese-readings.cjs：19 個常見讀音／活用示例及未知字回退；僅為回歸範例，不代表完整詞典正確率。
- 原有 tokenizer/language/offscreen/options/extension-lifecycle/content-interaction/worker-recovery 七組回歸繼續執行。

## 日後修改流程

1. 代理先重現問題並新增會失敗的測試，修正後跑相關測試。
2. 發布前跑 --all；報告失敗案例、未覆蓋行為與已知限制。一次完整檢查通過後，不無故反覆重跑。
3. 可用較輕量模型擴充案例、進行初步分類；主代理複核失敗與語言歧義。重複執行依靠腳本，不逐題呼叫模型。
4. 實際讀音的正確率需獨立且經確認的語料；合成案例通過率與工具自評不能替代它。現有頁面測試為模擬 X DOM，未涵蓋真實 X 的每一種結構、改版或登入情境。
5. 請勿為了讓測試通過而把失敗輸入移到探索區，或改掉原有期望；已知限制從一開始就分開記錄，改善後才提升為回歸契約。
