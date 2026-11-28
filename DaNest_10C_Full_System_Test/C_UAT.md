# DaNest 10C — Checklist UAT / manual + HTTP evidence
Ngày: ___ | Build/commit: ___ | Browser/thiết bị: ___ | Tester: ___

Điền `PASS / FAIL / SKIP / NOT RUN` và bằng chứng (ảnh đã che thông tin, log HTTP status không kèm token, hoặc ghi chú). Mặc định NOT RUN. P0 = ưu tiên trước deploy; P1 = bổ sung trong cùng đợt nếu có điều kiện. Chỉ dùng tài khoản của dự án và tin TEST trong môi trường demo. Không gửi token/secret/password vào báo cáo. Thử ghi trên fixture riêng có ghi ID; không giả xác minh; không xóa dữ liệu gốc. Cần tạo bản nháp kiểm thử mới cho ca thay đổi trạng thái nếu CAP fixture đang dùng để demo.

| ID | Mức | Vai trò / BRD | Thao tác và kết quả kỳ vọng | Kết quả | Bằng chứng / lỗi |
|---|---|---|---|---|---|
| C01 | P0 | Guest / FR01,02,03,42; NFR04 | Login đúng/sai; public signup không có Admin, thiếu consent bị chặn; Landlord mới nếu thử phải pending và không đăng được. Dùng tài khoản thử riêng có email được phép; không tạo nếu không cần. | NOT RUN | |
| C02 | P0 | Auth / FR01,04; NFR04 | Nhận mail thật xác minh/reset, link hợp lệ và dùng một lần; đổi email có xác nhận theo cấu hình Auth. Chỉ thử với mailbox mình kiểm soát; tránh thay email của tài khoản fixture chính. | NOT RUN | |
| C03 | P0 | Guest/Renter/Landlord/Admin / FR03,43; NFR05 | Mở URL admin/landlord trực tiếp bằng Guest/Renter; truy cập bị chặn; login/logout đúng vai trò, menu không lộ quyền. Kiểm tra HTTP request không trả dữ liệu cấm, không chỉ ẩn UI. | NOT RUN | |
| C04 | P0 | Guest / FR12–15,17,18,21,26; BRULE04,11,12 | Search grid/map cùng lọc/sort, chỉ published, mở chi tiết, ảnh/giá/badge/chi phí, phí unknown không thành 0; contact riêng không lộ; cảnh báo trước đặt cọc; Guest không gửi inquiry. | NOT RUN | |
| C05 | P0 | Renter / FR24,25; BRULE08 | Lưu/ bỏ lưu, refresh/login lại, so sánh 3 tin, căn thứ 4 bị chặn; tài khoản thứ hai không đọc saved của người đầu. | NOT RUN | |
| C06 | P0 | Renter + Landlord / FR27,28,30; BRULE11 | Gửi inquiry trên TEST public, kiểm tra trường bắt buộc, new, contact sau inquiry cho đúng bên; phản hồi, realtime/refresh, thông báo và unread. Người khác không đọc được. | NOT RUN | |
| C07 | P0 | Renter + Landlord / FR29,30; BRULE09 | Propose/confirm/reschedule/withdraw; lịch dưới 60 phút xung đột bị chặn, terminal không đặt lịch; history đúng actor/time. Dùng inquiry thử riêng. | NOT RUN | |
| C08 | P0 | Landlord / FR05–09,12,43; BRULE01–03; NFR11 | Tạo draft TEST riêng, 13 trường, chọn vị trí, ảnh hợp lệ/không hợp lệ, thiếu trường không submit; hoàn chỉnh gửi duyệt, chỉ Admin publish. | NOT RUN | |
| C09 | P0 | Landlord / FR07,08,20,22,46 | Sửa giá/ảnh/availability cập nhật ngày xác nhận; không tự công khai lại tin ẩn thủ công; verified bị reset khi thay đổi trọng yếu (không cấp badge giả để test). | NOT RUN | |
| C10 | P0 | Landlord / FR19,23; NFR05,06,11 | CAP08 evidence: mở khung, chọn PDF, không mất lựa chọn do focus/reload; thử file hợp lệ <=10MB, file quá dung lượng hoặc không đúng định dạng bị chặn. Không cần upload trùng nếu dùng bằng chứng trước; không nộp giấy tờ thật. | NOT RUN | |
| C11 | P0 | Admin + 2 Landlord + Renter / FR19–23; NFR05,06; BRULE05 | Admin xem/tải byte PDF CAP08 qua Edge Function, audit access phát sinh; owner chỉ metadata; Landlord khác và Renter/Guest bị từ chối khi thử cùng API. Không ghi JWT, không mở public URL, không approve giấy tờ TEST. | NOT RUN | |
| C12 | P0 | Admin / FR09,10,20,40,43 | Cặp CAP04–05 hiện cảnh báo/candidate (không auto-reject); trên fixture riêng Admin request corrections/reject/approve đúng lý do, audit trước/sau. Không tự verify. | NOT RUN | |
| C13 | P0 | Admin / FR02,03,40; NFR04,05 | Trên account test riêng có quyền, suspend, kiểm tra session đang login và RPC sau khóa, reactivate; không khóa admin chính; thử idle timeout thực 30 phút, phân biệt UI logout và token server. | NOT RUN | |
| C14 | P0 | Renter + Admin / FR41,33 | Gửi report trên TEST, Admin xử lý, người báo nhận in-app; khách không report, người khác không đọc dữ liệu riêng. | NOT RUN | |
| C15 | P0 | Admin + Landlord / FR34–39; BRULE07,10 | Kiểm tra chiến dịch active/future/pending/hết hạn trên fixture, nhãn sponsored, không bypass filter; KPI owner chỉ tin mình; Admin KPI và CSV khớp bộ lọc/kỳ và dữ liệu nguồn; không coi số liệu demo là kinh doanh thực. | NOT RUN | |
| C16 | P0 | Renter / FR26,17,18; NFR08,10 | AI guided 8 câu, hard constraints, không ưu tiên tài trợ, chi phí khớp chi tiết; kết quả không bị cắt, bubble đóng/mở, chuyển VI/EN, responsive 360px/desktop. FR44 natural language vẫn ngoài MVP. | NOT RUN | |
| C17 | P0 | Tất cả / NFR10 | Chrome/Edge/Safari nếu có, mobile/desktop; luồng chính VI/EN, không horizontal overflow, console lỗi, focus modal, keyboard. Browser không có thì ghi SKIP theo browser. | NOT RUN | |
| C18 | P1 | Landlord/Admin / NFR12, FR10 | Danh mục và field bắt buộc thêm/đổi/disable trên môi trường test riêng; dữ liệu cũ không mất; người thuê không chỉnh được. | NOT RUN | |
| C19 | P1 | Renter / FR16, BRULE13 | POI gần đúng bản đồ, timeout hiển thị lỗi thay vì dữ liệu bịa; stay guide song ngữ, liên kết nguồn còn mở; pháp lý cần review riêng. | NOT RUN | |
| C20 | P1 | Landlord / FR45 (extension ngoài MVP) | Trợ lý tiếng Anh theo template preview/apply, không tự đăng hoặc gọi là AI ngôn ngữ tự nhiên. | NOT RUN | |
| C21 | P1 | Auth + email / FR33 | Chỉ opt-in mailbox thử riêng nếu worker/provider đã cấu hình; một thông báo nghiệp vụ đến inbox, opt-out chặn gửi tiếp; provider accepted khác delivered. Không bật toàn bộ. | NOT RUN | |
| C22 | P0 | Admin / FR22,32,46; BRULE06 | Cron active/lần chạy; trên sandbox tạo mốc quá hạn, nhắc 14 ngày, grace 3 ngày cấu hình, restore đúng điều kiện, không mở tin manual-hidden; yêu cầu chưa phản hồi 24h. Không chỉnh đồng hồ/lịch fixture đang demo. | NOT RUN | |
| C23 | P0 | Ops / NFR07 | Backup tự động và restore vào sandbox độc lập, ghi thời gian <=4h, so sánh dữ liệu và RLS. Không restore đè database demo. | NOT RUN | |
| C24 | P1 | Ops / NFR01,02,03,13 | Chỉ đo load trên sandbox: ≥500 tin/200 account nếu kiểm tra scale, 50 concurrent, p95 ≤3s; uptime 99%/tháng cần thời gian quan sát. Không tạo load lên demo đang dùng. | NOT RUN | |
| C25 | P1 | Renter / NFR09 | Mời tester thật dùng EN search → request, ghi mẫu và tỷ lệ tự làm được; mục tiêu ≥80%. | NOT RUN | |
| C26 | P0 | Ops / NFR04,06,10 | Sau deploy (10D) HTTPS, redirect Auth đúng domain, smoke test, không public secret, privacy/terms cần review. Chưa deploy thì NOT RUN. | NOT RUN | |

FR11 bulk CSV chưa được chọn triển khai; FR44 natural language ngoài MVP; FR45 extension template không thay đổi baseline Won't. NFR11 nén ảnh/số ảnh cấu hình, NFR07 backup/restore, hiệu năng/uptime, review pháp lý không được tự đánh PASS. RTM cần cập nhật bằng chứng từng yêu cầu, không lấy một ca nhóm PASS làm bằng chứng mọi điều kiện. Nếu thao tác thay đổi dữ liệu demo, ghi lại trước/sau và không tự chạy lại seed/cleanup.
