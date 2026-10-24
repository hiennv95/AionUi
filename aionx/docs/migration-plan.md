# Migration plan — Electron → AionCore host + Svelte web + Flutter mobile

Kế hoạch này hiện thực [ADR-001](adr/ADR-001-client-platform.md). Có hai nguyên tắc xuyên suốt:

- **Lúc nào cũng có một bản chạy được.** Mỗi phase dùng được độc lập, và React WebUI chỉ bị tắt sau khi đã có bản thay thế.
- **Exit criteria phải kiểm chứng được bằng bằng chứng**: test, log, screenshot, số đo. Không chấp nhận kết luận kiểu "build pass là xong".

```
P0 Host service ──► P1 Contract ──┬──► P2 Flutter mobile ──┐
                                  └──► P3 Svelte web ───────┼──► P5 Retire React/Electron
                    P4 Thay tính năng native (song song) ───┘
```

P2 và P3 độc lập với nhau sau P1 nên làm song song được. P4 chạy song song từ sau P0.

---

## P0 — AionCore chạy như host service, không còn Electron

Mục tiêu: dùng AionUi hằng ngày qua trình duyệt mà **không viết lại dòng UI nào**.

| #   | Việc                                                                                                                           | Kiểm chứng                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 0.1 | Đo baseline với Electron hiện tại: cold start, RSS, latency token đầu tiên qua WS                                              | Số đo lưu ở `docs/evidence/p0-baseline.md`                          |
| 0.2 | Chạy `aionui-web` (React WebUI + `aioncore` v0.2.2 đã pin) với Node 22–24. Máy hiện có Node v26, nằm ngoài `engines: >=22 <25` | Log khởi động; đăng nhập bằng tài khoản admin                       |
| 0.3 | Đăng ký service: launchd plist (macOS), systemd unit (Linux); `--data-dir` cố định; restart on failure                         | Reboot máy → service tự lên; `launchctl print` / `systemctl status` |
| 0.4 | Truy cập từ xa qua Tailscale/WireGuard (D2), auth luôn bật, không dùng `--local`                                               | Từ điện thoại ngoài LAN: login được, request không auth trả 401     |
| 0.5 | Smoke flow thật: tạo conversation → agent (Claude Code/Codex) sửa file trong workspace → approval → kết quả                    | Playwright e2e trên WebUI + diff file thật trên host                |
| 0.6 | Đo lại các chỉ số của 0.1 khi không có Electron                                                                                | So sánh trước/sau                                                   |

**Exit P0:** owner làm việc hằng ngày qua browser (desktop + mobile browser) trong 1 tuần mà không mở app Electron. Lịch sử còn nguyên sau khi restart service.

---

## P1 — Contract layer dùng chung

Theo D1: làm cầu nối (b) trước, đồng thời mở PR (a) cho AionCore.

| #   | Việc                                                                                                                                                                                                                   | Kiểm chứng                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1.1 | Tạo repo client (D5): `apps/web`, `apps/mobile`, `contracts/`                                                                                                                                                          | `git init`, CI rỗng chạy xanh                     |
| 1.2 | Viết `contracts/openapi.yaml` cho tập API tối thiểu: auth (login, refresh, qr-login, ws-token), conversation (list/create/get/messages/send/stop), confirmation (list/respond), fs (dir/list), team/task (list/status) | Spec lint pass                                    |
| 1.3 | Viết `contracts/ws-events.md` + JSON Schema cho các event WS mà client dùng (`{name, data}`, tên dạng `domain.actionName`)                                                                                             | Schema validate được event thật bắt từ `aioncore` |
| 1.4 | Contract test: chạy `aioncore` đã pin, gọi mọi endpoint trong spec, validate response                                                                                                                                  | CI fail khi bump `aioncore` làm lệch contract     |
| 1.5 | Sinh client: TS cho Svelte (`openapi-typescript` hoặc tương đương), Dart cho Flutter (`openapi-generator` dart-dio hoặc tương đương)                                                                                   | Code sinh ra compile; không có DTO viết tay       |
| 1.6 | PR AionCore: `utoipa` derive trên `aionui-api-types` + endpoint xuất OpenAPI                                                                                                                                           | Bản spec do AionCore sinh ra khớp spec của 1.2    |

**Exit P1:** cả hai client import cùng một contract, và contract test chạy trong CI với `aioncore` đã pin.

---

## P2 — Flutter mobile MVP

Phạm vi theo brief: tạo, xem và điều khiển task từ xa. Mobile điều khiển host, **không** chạy coding agent trên máy.

| #   | Màn hình / năng lực                                              | Ghi chú kỹ thuật                                                         |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 2.1 | Kết nối host: nhập URL hoặc quét QR (`/api/auth/qr-login`)       | Token lưu bằng `flutter_secure_storage`; refresh qua `/api/auth/refresh` |
| 2.2 | Danh sách conversation / task + trạng thái realtime              | WS gửi token qua `Sec-WebSocket-Protocol` (backend đã hỗ trợ)            |
| 2.3 | Chat streaming, render markdown/code                             | Reconnect có backoff; resume theo cursor, không mất message              |
| 2.4 | Approval queue: duyệt hoặc từ chối tool call                     | Quyết định thực thi ở server; client chỉ gửi lựa chọn                    |
| 2.5 | Đính kèm ảnh/file, camera                                        | Upload qua API file hiện có                                              |
| 2.6 | i18n `vi` mặc định + `en`, light/dark, a11y (TalkBack/VoiceOver) | Port key từ `AionUi/mobile/src/i18n`                                     |
| 2.7 | Push (sau khi D3 xong)                                           | FCM/APNs                                                                 |

**Kiểm chứng:**

- Widget test và integration test (`integration_test`) chạy với `aioncore` thật.
- Build chạy trên iOS Simulator, Android Emulator **và** ít nhất một thiết bị thật mỗi nền tảng.
- Test mất mạng/đổi mạng giữa lúc stream: không mất message.

**Exit P2:** đạt parity với app Expo (checklist sinh từ `AionUi/mobile/app`). Sau đó app Expo được đánh dấu deprecated.

---

## P3 — Svelte web theo strangler pattern

### Cơ chế chạy song song

Svelte được phục vụ ở `/` và React WebUI ở `/legacy/`, cả hai qua cùng một `web-host` và cùng `aioncore`, nên dùng chung session và cookie. Route nào chưa có trên Svelte thì link sang `/legacy/<route>`.

_Cần làm trước:_ xác minh `web-host` phục vụ được hai static root hoặc base path, và React build chạy được với base `/legacy/`. Nếu không được, phải sửa nhỏ `web-host`. Đây là việc đầu tiên của P3.

### Thứ tự chuyển route

Thứ tự đi từ route nhỏ, ít rủi ro đến route lõi. LOC là của React hiện tại.

| Bước | Route                                                           | LOC React      | Lý do thứ tự                                                                                                                     |
| ---- | --------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | App shell, auth, `/login`                                       | ~0.4k + layout | Nền cho mọi route                                                                                                                |
| 3.2  | `/guid` (home / tạo task)                                       | ~4.1k          | Điểm vào hằng ngày                                                                                                               |
| 3.3  | `/conversation/:id`                                             | ~39k           | Lõi. Tách nhỏ: message list + streaming → tool-call cards → approvals → markdown/mermaid/KaTeX → diff/preview → slash/@ commands |
| 3.4  | `/team/:id`                                                     | ~6.8k          | Multi-agent, task board                                                                                                          |
| 3.5  | `/scheduled`                                                    | ~3.1k          | Cron                                                                                                                             |
| 3.6  | `/settings/*` (agent, model, skills, MCP/tools, webui, system…) | ~13.4k         | Nhiều màn hình nhưng logic đơn giản                                                                                              |
| 3.7  | Folder picker dùng `/api/fs/*` (thay native dialog)             | mới            | Cần cho 3.2                                                                                                                      |

### Route parity checklist

Một route chỉ được tắt bên React khi có đủ:

- Cùng tập hành động người dùng làm được (liệt kê từ component React).
- Playwright e2e cho các flow chính, chạy với `aioncore` thật.
- axe a11y: không còn vi phạm WCAG 2.2 AA mức serious/critical.
- Visual regression ở 3 viewport: 375 / 768 / 1440 px, light và dark.
- i18n đủ cho `vi` và `en`. Các locale khác port từ JSON hiện có.

**Exit P3:** mọi route đều có trên Svelte, `/legacy/` không còn được truy cập trong 2 tuần sử dụng thật.

---

## P4 — Thay thế tính năng native của Electron (song song từ sau P0)

| #   | Tính năng                          | Hướng                                                                 | Phụ thuộc                                                 |
| --- | ---------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| 4.1 | Notification                       | Sidecar Rust `aionx-notifier` đọc WS → FCM/APNs/Web Push              | D3 ✅                                                     |
| 4.2 | Agent-browser (CDP)                | Chrome/Playwright headless trên host                                  | D4, audit `docs/prds/agent-browser`, `docs/guides/cdp.md` |
| 4.3 | Mở file / reveal trong Finder      | Bỏ hẳn, hoặc thay bằng preview/download trên web                      | —                                                         |
| 4.4 | Cập nhật host                      | Script cập nhật `aioncore` + static bundle; rollback về version trước | —                                                         |
| 4.5 | PWA: manifest, icon, offline shell | Svelte                                                                | P3.1                                                      |

---

## P5 — Gỡ React WebUI và Electron

| #   | Việc                                                                                     | Kiểm chứng                                     |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 5.1 | Gỡ `/legacy/` khỏi web-host                                                              | Mọi e2e của P3 vẫn xanh                        |
| 5.2 | Gỡ Electron packaging khỏi pipeline của fork (installer, code-sign, auto-update)         | CI chỉ còn: contract, web, mobile, host bundle |
| 5.3 | CI/CD: build static web, build mobile (iOS/Android), đóng gói host (`aioncore` + static) | Artifact có checksum; không tự động publish    |
| 5.4 | Tài liệu cài đặt host + app mobile                                                       | Người khác cài theo được từ đầu trên máy sạch  |
| 5.5 | So sánh hiệu năng với baseline P0.1                                                      | Báo cáo trước/sau                              |

---

## Ngoài phạm vi kế hoạch này

Các hạng mục còn lại của brief sẽ được xây **trên Svelte/Flutter** sau P3 (hoặc song song khi route nền đã sẵn): Control Center, OpenDesign Studio, memory theo scope, audit log, routing theo capability, self-improvement loop, telemetry. Mỗi hạng mục có ADR riêng.

Các gap phía backend đã xác nhận (audit log, memory, capability routing, metrics, push, OpenAPI) được làm bằng Rust trong AionCore.

## Rủi ro chính

| Rủi ro                                    | Mức        | Giảm thiểu                                                       |
| ----------------------------------------- | ---------- | ---------------------------------------------------------------- |
| Màn conversation (~39k LOC) kéo dài P3    | Cao        | Tách thành 6 lát cắt (3.3); React vẫn chạy song song             |
| Contract lệch khi bump `aioncore`         | Trung bình | Pin version + contract test (1.4)                                |
| Mở host ra mạng mà thiếu TLS hoặc auth    | Cao        | D2 + guardrail trong ADR; kiểm tra 401 ở P0.4                    |
| Hai agent cùng ghi vào checkout AionUi    | Cao        | Repo client riêng (D5); dừng hoặc tách AionUi Team trước khi ghi |
| Tách khỏi upstream UI                     | Chấp nhận  | Đã ghi trong ADR; backend vẫn theo upstream                      |
| Node v26 trên máy ngoài phạm vi `engines` | Thấp       | Dùng Node 22–24 qua nvm/fnm cho React WebUI tạm thời             |

## Trạng thái quyết định

Xem [ADR-001 §6](adr/ADR-001-client-platform.md#6-decisions-đánh-giá-bằng-jev).

- D1, D2, D4, D5, D6 chốt theo Jev. Kết quả: contract dùng cầu nối rồi chuyển sang `utoipa`; truy cập từ xa qua Tailscale/WireGuard; agent-browser audit trước rồi mới chọn công nghệ; repo client tách riêng; Flutter dùng Riverpod.
- D3: sidecar Rust chỉ đọc event WS rồi đẩy FCM/APNs/Web Push (owner chốt).

**P0 bắt đầu được ngay.**
