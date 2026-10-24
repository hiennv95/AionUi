# ADR-001 — Bỏ Electron; AionCore làm host service; Web bằng Svelte, Mobile bằng Flutter

- **Status:** Accepted (2026-10-24)
- **Deciders:** HNV (owner)
- **Supersedes:** không có. Thay thế hướng "giữ Electron" trong `docs/master-aionui-x/architecture.md` (bản nháp chưa commit của AionUi Team trong checkout `AionUi/`) (ADR-001 do AionUi Team viết trên branch `feat/master-aionui-x-vertical-slice`).

## 1. Context

Mọi dữ kiện dưới đây đều được kiểm chứng trực tiếp trên source:

| Repo                 | Commit                                     | Version     |
| -------------------- | ------------------------------------------ | ----------- |
| `iOfficeAI/AionUi`   | `11cd2a9a20d1e033157636efc570b41384c66d85` | 2.2.2       |
| `iOfficeAI/AionCore` | `503a87199eb978790ca77675b39c84b241535bf3` | 0.2.2 (+32) |

### 1.1 Logic nghiệp vụ đã nằm hết trong AionCore (Rust)

- AionCore là một Cargo workspace 27 crates (Axum 0.8, Tokio, SQLite/sqlx). Nó đảm nhận agent lifecycle (ACP, direct CLI), session state machine (`aionui-session/src/state.rs`, `reducer.rs`), permission router (`aionui-ai-agent/src/manager/acp/permission_router.rs`), team và task board, cron, MCP, skills/extensions, file và snapshot, multi-user scope (migration `030_user_scope.sql`). Có 44 SQL migration.
- Auth: JWT + CSRF double-submit cookie + rate limit (`aionui-auth`). Token nhận qua `Authorization: Bearer`, cookie `aionui-session`, hoặc `Sec-WebSocket-Protocol` khi kết nối WS (`aionui-auth/src/extract.rs`). Có `/api/auth/refresh`, `/api/auth/qr-login`, `/api/ws-token`.
- AionUi chỉ là client: `packages/desktop/src/common/adapter/ipcBridge.ts` (2.5k dòng) chuyển các lời gọi IPC cũ thành REST/WS tới `aioncore`. Chỉ các thao tác native Electron còn đi qua IPC: window controls, native dialog, auto-update, devtools, zoom, CDP, deep link.

### 1.2 Đã có đường chạy không cần Electron

- `packages/web-cli` (`aionui-web`) tự spawn `aioncore`, phục vụ SPA tĩnh qua `packages/web-host` (reverse-proxy `/api/*` và `/ws`). Có cờ `--remote` (bind `0.0.0.0`), `--port`, `--static-dir`.
- Có API duyệt file phía server: `/api/fs/dir`, `/api/fs/list`, `/api/fs/metadata`, `/api/fs/read`…, đủ để dựng folder picker trên web.

### 1.3 Kích thước client hiện tại (không tính test)

| Phần                                       | LOC TS/TSX                                 |
| ------------------------------------------ | ------------------------------------------ |
| Renderer React (dùng chung desktop + web)  | ~123k                                      |
| ├ `pages/conversation`                     | ~39k                                       |
| ├ `components`                             | ~32k                                       |
| ├ `pages/settings`                         | ~13k                                       |
| ├ `hooks` / `services` / `utils`           | ~10k / ~6k / ~5k                           |
| ├ `pages/team` / `guid` / `cron` / `login` | ~6.8k / ~4.1k / ~3.1k / ~0.4k              |
| Electron main + preload                    | ~15k                                       |
| Mobile Expo (`mobile/`)                    | ~7.5k, chỉ 1 commit trong 3 tháng gần nhất |

### 1.4 Gap phía backend liên quan quyết định này

Đã grep toàn bộ crates của AionCore:

- **Không có OpenAPI/JSON Schema export.** `schemars` chỉ xuất hiện như một feature của `rmcp`. Hiện chưa có cách sinh client TS hoặc Dart từ contract.
- **Không có TLS server.** `rustls` chỉ dùng cho HTTP client đi ra ngoài. `--remote` bind HTTP thường.
- **Không có push notification** (không thấy FCM, APNs, Web Push, VAPID).

## 2. Decision

1. **Bỏ ứng dụng desktop Electron.** Sản phẩm chỉ còn hai client: Web và Mobile, theo mô hình server + client kiểu Paperclip.
2. **AionCore giữ nguyên Rust và chạy như host service** (daemon) trên máy chủ agent: launchd trên macOS, systemd trên Linux, service trên Windows. Mọi thay đổi backend được viết bằng Rust trong AionCore, ưu tiên làm thành PR có thể gửi upstream. **Không** tạo backend thứ hai bằng TS.
3. **Web viết bằng Svelte** (Svelte 5, SvelteKit build ở chế độ SPA/static), để `web-host` phục vụ như bundle hiện tại.
4. **Mobile viết bằng Flutter** (iOS + Android), thay thế app Expo.
5. **React WebUI hiện có tiếp tục chạy tạm** trong suốt quá trình chuyển (strangler pattern). Mỗi route chỉ bị gỡ khỏi React sau khi bản Svelte đạt parity checklist.
6. **Contract là nguồn sự thật chung:** cả Svelte lẫn Flutter dùng client được sinh từ một contract duy nhất (xem quyết định mở D1). Không viết tay DTO ở hai nơi.

## 3. Options considered

| Option                                                            | Kết luận                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A. Giữ Electron + React cho desktop/web, Flutter cho mobile       | Rẻ nhất, nhưng owner không cần desktop app.                                                   |
| B. Flutter cho desktop + mobile, Svelte cho web                   | Loại: desktop và web là cùng form factor, nên UI phải viết hai lần.                           |
| C. Flutter cho cả ba (kể cả web)                                  | Loại: Flutter web yếu ở text selection, a11y, bundle size, render markdown/code/HTML preview. |
| **D. Không desktop; Svelte web + Flutter mobile + AionCore host** | **Chọn:** mỗi form factor có đúng một UI, backend giữ nguyên.                                 |

## 4. Consequences

### Tích cực

- Chỉ còn hai UI, chia theo form factor: Svelte cho màn hình lớn, Flutter cho touch.
- Bỏ được ~15k LOC Electron main, cùng toàn bộ việc packaging installer, code-signing, auto-update desktop.
- Một host phục vụ mọi thiết bị, nên Web và Mobile thấy cùng task state (tiêu chí A) một cách tự nhiên.
- Đúng sở trường của owner (Flutter, Svelte).

### Tiêu cực / chi phí

- **Phải viết lại ~123k LOC renderer sang Svelte.** Đây là hạng mục lớn nhất. Riêng màn conversation (~39k) gồm streaming, tool-call rendering, markdown, mermaid, KaTeX, code, diff, preview.
- **Tách khỏi upstream UI:** sau khi chuyển xong không nhận được thay đổi UI từ AionUi nữa. Backend vẫn theo upstream qua binary `aioncore` được pin version.
- **Mất các tính năng native của Electron**, phải thay thế:

  | Electron đang lo                   | Thay bằng                                                |
  | ---------------------------------- | -------------------------------------------------------- |
  | Tự khởi động backend               | OS service (launchd/systemd) hoặc `aionui-web`           |
  | Native dialog chọn thư mục         | Folder picker dùng `/api/fs/*`                           |
  | Notification, tray                 | Web Push (PWA) + FCM/APNs (cần làm mới, xem D3)          |
  | Agent-browser qua CDP của Electron | Chrome/Playwright headless trên host (cần audit, xem D4) |
  | Auto-update                        | Cập nhật binary host; web cập nhật theo bản deploy       |
  | Chỉ nghe trên localhost            | **Bắt buộc auth + TLS** khi mở ra ngoài (xem D2)         |

- **Code mới làm trên React/Electron sẽ phải viết lại.** Các phần AionUi Team đang làm trên branch `feat/master-aionui-x-vertical-slice` gồm trang `MasterControlCenter`, adapter OpenDesign MCP, và `common/chat/scopedHandoff` (handoff qua `sessionStorage` + React hooks). Logic không phụ thuộc UI (validate, excerpt, redaction, provenance) nên chuyển vào AionCore hoặc một package TS không phụ thuộc framework để Svelte và Flutter cùng dùng.

## 5. Guardrails

- Auth luôn bật khi bind khác `127.0.0.1`. Cấm dùng `--local` (tắt auth) cho deployment có truy cập từ xa.
- Không mở API filesystem/terminal cho client chưa xác thực. Mọi thao tác Level 3 phải đi qua approval phía server; client không tự quyết.
- Không tắt route React nào khi chưa có bằng chứng parity cho route đó (xem migration plan, mục "Route parity checklist").
- Không công bố "hỗ trợ iOS/Android" khi chưa có build chạy trên simulator/emulator **và** thiết bị thật.

## 6. Decisions (đánh giá bằng Jev)

Ngày 2026-10-24, theo yêu cầu của owner, D1–D6 được gửi cho **Jev** (TypeSafe System One). Model trả lời: `jev-1.14.0`; usage 1544 input / 289 output tokens.

Cách hỏi: một request, mỗi quyết định là một câu hỏi `choice`. Tất cả dùng chung một `state` gồm mô tả dự án, hồ sơ owner và các dữ kiện đã kiểm chứng ở §1. Request và response gốc được lưu cùng thư mục này: [`ADR-001-jev-request.json`](ADR-001-jev-request.json), [`ADR-001-jev-response.json`](ADR-001-jev-response.json).

**Quy tắc áp dụng:**

- Confidence ≥ 0.8 và đáp án hợp với guardrail ở §5 → chấp nhận làm quyết định.
- Confidence thấp hơn → owner quyết.

Jev đưa ra phán đoán có hiệu chỉnh xác suất, không phải lời giải thích. Kết quả của nó phụ thuộc vào cách viết `state`, nên nó là tín hiệu để quyết, không thay thế bằng chứng.

| ID  | Câu hỏi                  | Jev chọn                                                                                                                                                                           | Confidence | Phân phối xác suất                                     | Trạng thái                  |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------ | --------------------------- |
| D1  | Nguồn contract API       | **bridge_then_utoipa**: `openapi.yaml` viết tay + contract test với `aioncore` đã pin ngay; song song mở PR `utoipa` cho AionCore, chuyển sang spec sinh tự động khi PR được merge | 0.98       | bridge 0.99 · handwritten-only 0.01 · utoipa-only 0.00 | ✅ Accepted                 |
| D2  | Truy cập từ xa           | **private_mesh_vpn**: Tailscale/WireGuard, không mở port ra internet                                                                                                               | 0.92       | mesh 0.95 · reverse proxy 0.05 · TLS native 0.00       | ✅ Accepted                 |
| D3  | Push notification        | **sidecar_service** (không dứt khoát)                                                                                                                                              | **0.33**   | sidecar 0.55 · defer 0.43 · trong AionCore 0.02        | ✅ Owner chốt: sidecar Rust |
| D4  | Agent-browser            | **audit_first**: audit `docs/prds/agent-browser`, `docs/guides/cdp.md` và cách dùng thực tế trước khi chọn công nghệ                                                               | 0.95       | audit 0.97 · Playwright 0.02 · CDP 0.01                | ✅ Accepted                 |
| D5  | Vị trí repo client       | **new_client_repo**: repo mới gồm `apps/web`, `apps/mobile`, `contracts/`                                                                                                          | 0.82       | new repo 0.91 · trong AionUi 0.09                      | ✅ Accepted                 |
| D6  | Flutter state management | **riverpod** (StreamProvider / AsyncNotifier)                                                                                                                                      | 0.98       | riverpod 0.99 · bloc 0.01 · provider 0.00              | ✅ Accepted                 |

### D3 — owner chốt (2026-10-24)

Jev không dứt khoát: sidecar 0.55, chưa làm 0.43. Owner chọn **sidecar viết bằng Rust**:

- Process riêng (`aionx-notifier`), **chỉ đọc** event từ WebSocket `/ws` của AionCore, rồi gửi qua FCM (Android), APNs (iOS) và Web Push (VAPID, cho PWA).
- Không gọi API ghi nào của AionCore, không chứa logic nghiệp vụ. Như vậy vẫn đúng nguyên tắc §2.2 là không có backend nghiệp vụ thứ hai.
- Xác thực với AionCore bằng một tài khoản/token riêng, quyền tối thiểu. Credential FCM/APNs/VAPID lưu ngoài repo, chỉ sidecar đọc.
- Payload push không chứa nội dung nhạy cảm như prompt, code hay secret. Chỉ gửi loại event và id, client tự kéo chi tiết sau khi đã xác thực.
- Làm ở P2.7 / P4.1, không chặn P0–P1.
