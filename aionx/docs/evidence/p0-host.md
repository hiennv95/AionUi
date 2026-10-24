# P0 evidence — AionCore host không cần Electron

Ngày: 2026-10-24 · Máy: macOS (Darwin 24.6.0, arm64)

## Cấu hình đang chạy

| Thành phần | Giá trị                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| App        | worktree `aionui-host`, branch `host/p0-authenticated-webui` (từ `11cd2a9`), commit fix auth/CSRF                                           |
| Backend    | `aioncore` v0.2.2 từ GitHub release chính thức, qua `scripts/prepareAioncore.js` (adhoc-signed). Không phụ thuộc `/Applications/AionUi.app` |
| Runtime    | Node v24.22.1 (nvm), Bun 1.3.14                                                                                                             |
| Service    | launchd `gui/$UID/com.aionx.host` (`aionx/host/macos/install.sh`), `http://127.0.0.1:25818`, data `~/.aionx-host/data`                      |
| Auth       | `identity_mode="webui" auth="enabled"`; cookie `aionui-session` HttpOnly + SameSite=Lax; CSRF double-submit                                 |

## Đã kiểm chứng

| Kiểm tra                                                     | Kết quả                                                                   | Cách                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------ |
| Host chạy không có Electron                                  | ✅                                                                        | launchd `state = running`      |
| Request không auth bị chặn                                   | ✅ `401`                                                                  | `curl /api/conversations`      |
| Login                                                        | ✅ `200`, set 3 cookie                                                    | `POST /login`                  |
| Request ghi qua UI có CSRF                                   | ✅ `/api/fs/dir` 403 → 200 sau fix                                        | Network log trong browser pane |
| Folder picker phía server                                    | ✅ chọn được `~/.aionx-host/smoke-ws`                                     | WebUI                          |
| Tạo conversation Claude Code trong workspace                 | ✅ conversation `da77c459`                                                | WebUI                          |
| Lịch sử còn sau khi restart host (3 lần)                     | ✅                                                                        | Reload WebUI sau `install.sh`  |
| Session login còn sau khi restart                            | ✅                                                                        | Không phải đăng nhập lại       |
| Host spawn agent, gửi prompt, nhận lỗi upstream có phân loại | ✅ Claude Code, Codex, Gemini                                             | WebUI + log host               |
| Agent sửa file thật                                          | ❌ **chưa đạt**: cả 3 agent bị chặn ở tài khoản/cấu hình (xem dưới)       |                                |
| Unit test                                                    | ✅ web-host 78 pass / 3 todo; 65 file liên quan 496 pass; adapter 23 pass | vitest                         |
| Typecheck / lint                                             | ✅ `tsc --noEmit` exit 0; oxlint 0 errors                                 |                                |

## Lỗ hổng phát hiện ở upstream `11cd2a9`

`scripts/webui.ts` / `aionui-web` (`packages/web-host`) spawn `aioncore --local`:

- auth và CSRF bị tắt;
- CORS trả `Access-Control-Allow-Origin: *`, preflight cho phép `POST` và mọi header từ bất kỳ origin nào.

Đã quan sát trực tiếp trên loopback: `/api/conversations` trả 200 khi không có credential; preflight từ `Origin: https://evil.example` được chấp nhận. Hệ quả: bất kỳ trang web nào đang mở trong trình duyệt cũng điều khiển được agent host. Với `--remote`, lỗ hổng mở ra toàn mạng LAN. Phần remote mới kiểm chứng trên source, chưa thử live để tránh mở máy ra mạng.

App desktop đã cài (`/Applications/AionUi.app`, aioncore ở chế độ webui) **không** bị: trả 401 và mirror origin kèm credentials.

**Fix** (commit trên `host/p0-authenticated-webui`):

- Bản vá web-host của AionUi Team được review lại: standalone dùng `local:false`; remote fail-closed nếu `/api/auth/user` không trả 401.
- Bổ sung `withCoreCsrfHeader()`, cho mọi transport ghi đi qua nó: `httpRequest`, `configService`, upload file (XHR), speech-to-text (XHR), logout. Bản vá gốc chỉ phủ `httpRequest`.

Rủi ro còn lại: CORS ở chế độ webui mirror mọi origin kèm credentials. Cookie SameSite=Lax chặn được cross-site, nhưng **không** chặn same-site: mọi trang trên `127.0.0.1:<port khác>` là same-site. Nên giới hạn allowlist origin ở AionCore.

## Blocker: agent treo trên launchd — đã gỡ

1. Lần đầu chạy host từ shell của agent session: `claude` báo `Not logged in`. Host thừa hưởng env của session (`ANTHROPIC_*`, `CLAUDECODE`, sandbox chặn keychain). → **Không bao giờ khởi động host từ trong một agent session**; luôn dùng launchd.
2. Dưới launchd, `claude` đăng nhập được, nhưng mỗi turn treo: `claude` chạy `git` với cwd = `$HOME`, mà `$HOME` là một git repo rỗng (`~/.git`: 0 commit, không index, tạo 2026-09-30). `GIT_CEILING_DIRECTORIES` không giải quyết được vì repo nằm đúng ở cwd.
3. **Đã gỡ (owner đồng ý):** `mv ~/.git ~/.git.disabled-2026-10-24`. Hoàn tác: `mv ~/.git.disabled-2026-10-24 ~/.git`. Sau đó `claude` trả output đầu tiên sau ~1 s.

## Smoke P0.5 — chưa đạt vì tài khoản agent (không phải host)

| Agent               | Kết quả (2026-10-24 ~13:00 giờ VN)                          | Nguyên nhân                                                                                                                                              |
| ------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code 2.1.308 | `API Error: 400 unknown provider for model claude-opus-5-5` | `~/.claude/settings.json` đặt `ANTHROPIC_BASE_URL` trỏ tới proxy bên thứ ba và `ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-5-5`; proxy không nhận model đó |
| Codex CLI           | `You've hit your usage limit … try again at 1:54 PM`        | Hết hạn mức tài khoản. Lưu ý quyền mặc định của Codex là **Read Only**                                                                                   |
| Gemini CLI          | `USER_AGENT_AUTH_REQUIRED`                                  | Chưa đăng nhập Gemini CLI                                                                                                                                |

Phần host vẫn chạy đúng ở cả ba lần: spawn agent trong workspace, gửi prompt, nhận lỗi, phân loại lỗi (retryable / needs configuration) và hiện lên UI. Riêng bước "agent ghi file thật" và luồng approval thì **chưa** được kiểm chứng.

Ghi nhận thêm:

- Cancel một turn treo: AionCore kill subtree sau 15 s grace, nhưng log báo `descendants outside the group survived the sweep strays=9`. Đây là các MCP server do `claude` spawn theo cấu hình cá nhân của owner. Có rò process khi cancel.
- Toàn bộ prompt và code gửi qua Claude Code hiện đi qua proxy bên thứ ba ở trên. Đây là lựa chọn của owner, nhưng cần lưu ý về privacy.

## Số đo baseline (chỉ mang tính tham khảo)

| Chỉ số                                                     | Electron (`AionUi.app`, chạy 1 ngày 19 giờ, có session thật) | Host (vừa khởi động)                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| RSS                                                        | 462 MB / 14 process (đã gồm aioncore ~31 MB)                 | bun web-host 51 MB + aioncore 45 MB, **chưa tính tab trình duyệt**            |
| Cold start host (launchd restart → `/api/auth/status` 200) | —                                                            | 9.69 s / 8.47 s / 8.46 s (3 lần)                                              |
| Bundle renderer                                            | —                                                            | 14.1 MB tổng; `vendor` 4.75 MB (gzip 1.41 MB); `index` 3.71 MB (gzip 1.10 MB) |

Hai bên chưa so sánh tương đương được: thời gian chạy khác nhau, và tab browser chưa được đo. Latency token đầu tiên và băng thông mobile **chưa đo**; cold start Electron chưa đo (không restart app desktop của owner), cần làm sau khi gỡ blocker.

## Chưa làm trong P0

- 0.4 Truy cập từ xa qua Tailscale: máy chưa cài Tailscale, cần owner cài và đăng nhập tailnet.
- 0.5 Smoke ghi file + approval flow: chờ ít nhất một agent dùng được (xem bảng trên).
- 0.6 So sánh số đo trước/sau.
- Exit P0 (dùng hằng ngày 1 tuần qua browser).
