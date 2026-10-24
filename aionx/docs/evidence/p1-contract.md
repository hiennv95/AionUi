# P1 evidence — contract test lát đầu (auth + conversation list)

Ngày: 2026-10-24 · Đối tượng: `aioncore` v0.2.2, chạy qua host launchd `127.0.0.1:25818`

- Spec: [`aionx/contracts/openapi.yaml`](../../contracts/openapi.yaml), viết tay theo D1 (cầu nối), lấy kiểu từ `aionui-api-types`.
- Test: [`aionx/contracts/contract.test.ts`](../../contracts/contract.test.ts), chạy `cd aionx/contracts && bun test`.
- Kết quả: **11 pass · 1 todo · 0 fail**.

## Phát hiện

| #   | Phát hiện                                                                                                                          | Bằng chứng                                                                                              | Ảnh hưởng tới client                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | JSON trên wire là **snake_case** (`has_more`, `created_at`, `needs_setup`), trái với `ARCHITECTURE.md` (ghi camelCase / `hasMore`) | `PaginatedResult` không có `rename_all`; test pass với schema snake_case                                | Model Dart/TS phải dùng snake_case, hoặc map rõ ràng                                                                                                                                                                                                                                  |
| C2  | CSRF double-submit áp dụng cho **mọi** request ghi, **kể cả khi dùng Bearer**                                                      | `csrf.rs` không miễn Bearer; refresh không có cặp cookie/header → `403 CSRF_INVALID`                    | Flutter phải tự tạo giá trị ngẫu nhiên và gửi cả `Cookie: aionui-csrf-token=v` lẫn `x-csrf-token: v`. App Expo hiện tại gửi refresh không có cặp này nên có khả năng đã hỏng ở chế độ webui (chưa chạy thử). Đề xuất PR AionCore: miễn CSRF cho request Bearer không kèm cookie phiên |
| C3  | ⚠️ `/api/auth/refresh` qua body **chấp nhận cả access token**                                                                      | `routes.rs` `refresh_tokens`: nhánh body dùng `verify` lenient cho client cũ. Test `KNOWN RISK` trả 200 | Lộ access token là đủ để đổi lấy cặp token mới vô thời hạn. Đề xuất PR AionCore: body path dùng `verify_refresh`, sau khi app Expo cũ bị thay thế                                                                                                                                     |
| C4  | Login chỉ trả access `token` trong body; refresh token chỉ có trong cookie `aionui-refresh`                                        | `LoginResponse`                                                                                         | Flutter phải đọc `Set-Cookie: aionui-refresh` khi login, hoặc gọi refresh ngay để nhận `refresh_token` trong body                                                                                                                                                                     |

## Ngoài phạm vi lát này

Messages, gửi prompt, confirmations/approvals, `/api/fs/*`, schema event WS. Các phần này làm ở lát P1 tiếp theo.
