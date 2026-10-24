# ADR-002 — Hạn chế phụ thuộc Node.js

- **Status:** Accepted (2026-10-24, owner yêu cầu)
- **Liên quan:** [ADR-001](ADR-001-client-platform.md)

## Context

Đã kiểm chứng trên source (AionUi `11cd2a9`, AionCore `503a871`):

- Host P0 cần **bun + Node 22–24** lúc chạy. Lý do: `scripts/webui.ts` và `packages/web-host` (TypeScript) đảm nhận việc spawn `aioncore`, phục vụ SPA tĩnh, reverse-proxy `/api/*` + `/ws`, và probe auth trước khi mở remote.
- `aioncore` (Rust/Axum) **chưa** phục vụ file tĩnh: không có `ServeDir` / `fallback_service`. Nhưng workspace đã khai báo `tower-http` với feature `fs`, nên làm được mà không thêm dependency nào.
- Các agent CLI (Claude Code, Codex, Gemini…) tự chúng là chương trình Node. `aioncore` đã kèm Node runtime được quản lý riêng (`managed-resources/node`) để chạy chúng. Phần này nằm ngoài tầm kiểm soát của mình.
- Contract test P1 đang chạy bằng `bun test`.

## Decision

Node/bun **không được nằm trên đường runtime** của sản phẩm. Chỉ được dùng ở bước build/dev khi không có lựa chọn tốt hơn.

| Thành phần                     | Hiện tại                                         | Đích                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Host runtime                   | launchd → bun `webui.ts` → web-host → `aioncore` | launchd → **`aioncore` trực tiếp**, tự phục vụ SPA qua cờ mới `--static-dir` (PR Rust cho AionCore, dùng `tower-http::services::ServeDir` làm fallback ngoài `/api`, `/ws`, `/login`, `/logout`) |
| Probe auth trước khi mở remote | TS trong web-host                                | Kiểm tra fail-closed ngay trong `aioncore`: từ chối bind khác loopback khi `identity_mode=local`                                                                                                 |
| Web client                     | (React, build bằng Node)                         | Svelte. Node/bun **chỉ dùng lúc build** (Vite), output là file tĩnh                                                                                                                              |
| Mobile client                  | Expo (React Native, Node toolchain)              | Flutter, không có Node                                                                                                                                                                           |
| Contract test                  | `bun test`                                       | Chuyển sang **Dart**, dùng lại client sinh từ OpenAPI cho Flutter, để test contract và client cùng một code. `bun test` giữ lại làm cầu nối tạm                                                  |
| Push sidecar                   | —                                                | Rust (D3)                                                                                                                                                                                        |
| Agent CLI                      | Node (do bên thứ ba)                             | Giữ nguyên. Phụ thuộc này nằm ngoài kiểm soát của mình                                                                                                                                           |

## Consequences

- **Tích cực:**
  - Host chỉ còn một binary Rust cùng thư mục static, nên đơn giản hơn khi đóng gói và cập nhật.
  - Bớt một process (bun) và bớt khoảng 51 MB RSS (đo ở P0).
  - Không còn ràng buộc phiên bản Node cho host.
- **Chi phí:**
  - Phải có PR AionCore (`--static-dir`, fail-closed remote). Trong thời gian PR chưa được merge upstream, fork phải duy trì một bản build `aioncore` riêng.
  - React WebUI tạm thời vẫn chạy được: chỉ cần chuyển `out/renderer` cho `--static-dir`.
- **Cần làm trước:** build AionCore từ source. Máy hiện **chưa có `cargo`**, cần cài Rust toolchain theo `rust-toolchain.toml` của AionCore.
