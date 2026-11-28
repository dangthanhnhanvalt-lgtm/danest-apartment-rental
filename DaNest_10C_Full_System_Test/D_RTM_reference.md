# DaNest — 10A: Ma trận đối chiếu và nghiệm thu trước deployment
Ngày 27/11/2026. Bản rà soát, chưa phải biên bản nghiệm thu đạt.

## Căn cứ và cách đọc
- BRD `E-COMMERCE PROJECT MANAGEMENT (9).pdf`, mục 6.3–6.5 (FR-01–46, NFR-01–13, BRULE-01–13). Mã ở đây theo bản (9), không theo bản BRD/RTM lịch sử. Các tài liệu thiết kế chưa được đối chiếu toàn bộ ở bước này.
- `DaNest_RTM_09F1.md`, `DaNest_Ghi_chu_7A_09F1.md`, checklist F1, hai CSV E2 `(3)(1)` và `(4)(1)`, cùng source ghép các patch đến F1. Người dùng báo hoàn thành F1; chưa có log từng ca UI. Không tự gán PASS cho các ca chưa có bằng chứng.
- Đã chạy lại 6 script offline: A1 17, B1 11, C2 8, D2 12, E1 16 (8 logic + 8 kiểm tra tĩnh), F1 30; tổng 94. TypeScript tsc -b thành công; 82 khóa dịch AI được đối chiếu. Full Vite build và trình duyệt/HTTP thực tế chưa được xác nhận độc lập.
- Trạng thái: **Có triển khai** = ghi nhận từ patch/RTM, còn cần kiểm chứng tiêu chí; **Một phần** = còn thiếu tiêu chí cụ thể hoặc bằng chứng; **Chưa** = chưa triển khai yêu cầu; **Ngoài MVP** = Won't theo BRD. Không đồng nhất với kết quả PASS. Ưu tiên Must/Should/Could/Won't giữ nguyên BRD.

## 1. Functional requirements — 46 FR
| Mã | Ưu tiên | Yêu cầu BRD (tóm tắt) | Đối chiếu triển khai | Kiểm thử/việc còn lại |
|---|---|---|---|---|
| FR-01 | Must | Email/mật khẩu, recovery | Có triển khai 7A/8C/E1 | Đăng ký, sai mật khẩu, link reset thực nhận; SMTP chưa chứng minh |
| FR-02 | Must | Duyệt/khóa/mở khóa tài khoản | Có triển khai 7A/E1/E2 | Pending landlord không đăng; khóa, login mới và token cũ; E2 đã kiểm thử một số RPC khi suspended |
| FR-03 | Must | Giới hạn chức năng và dữ liệu theo vai trò | Một phần kiểm chứng | 29 PASS/12 SKIP E2; HTTP thực, 9 SKIP 8C cần đối chiếu; không tách phiên theo quyết định chủ dự án |
| FR-04 | Could | Cập nhật tên/điện thoại/email | Một phần E1 | Tên/điện thoại có; email chỉ đọc, chưa đổi email |
| FR-05 | Must | Biểu mẫu 13 trường | Có triển khai B1 | Đối chiếu 13 trường, bắt buộc; ảnh, phí, tọa độ, điều kiện thuê |
| FR-06 | Must | Chặn gửi duyệt nếu thiếu | Có triển khai B1/B2 | Thiếu từng trường, RPC trực tiếp; lý do thiếu; gửi đủ chuyển chờ duyệt |
| FR-07 | Must | Sửa giá/ảnh/tình trạng, ghi ngày xác nhận mỗi lần cập nhật | Patch 10A.1.1 có trigger cập nhật khi thay đổi thực tế | Kiểm tra từng kiểu cập nhật và timestamp trên Supabase; xem bổ sung cuối file |
| FR-08 | Must | Năm trạng thái tin, chỉ tin hiển thị được tìm thấy | Một phần đối chiếu | Lifecycle B2 có trạng thái chi tiết hơn BRD; lập mapping 5 trạng thái, test hide/archive/reject |
| FR-09 | Must | Admin duyệt/bổ sung/từ chối và lý do | Có triển khai 6A/B2 | Duyệt thủ công sau tự kiểm tra; lý do đến owner; không lộ public |
| FR-10 | Should | Cảnh báo trùng, liên kết tin nghi trùng | Patch 10A.1.1 có link và đối chiếu | Kiểm thử DB/UI; exact hash/URL, chưa nhận diện ảnh tương tự thị giác |
| FR-11 | Could | Nhập hàng loạt CSV/Excel, báo cáo lỗi | Chưa | Backlog; seed demo không thay thế chức năng import của Admin |
| FR-12 | Must | Tìm kiếm theo bộ lọc | Có triển khai A1 | Kết quả khớp tất cả bộ lọc; bỏ lọc; URL; test trên dữ liệu có owner |
| FR-13 | Must | Chỉ tin hiển thị; sắp xếp giá/ngày cập nhật | Có triển khai A1/8A | E2 guest published-only PASS; kiểm tra sort hai chiều, tin ẩn |
| FR-14 | Must | Chi tiết, ảnh, chi phí, xác minh và ngày xác nhận | Có triển khai A1/B1/B2 | Kiểm tra khoản chưa cung cấp, badge/scope/timestamp |
| FR-15 | Must | Bản đồ và giữ bộ lọc grid/map | Có triển khai A1/B1 | Kiểm tra pin, tọa độ không hợp lệ, cùng kết quả grid/map |
| FR-16 | Could | Lớp tiện ích lân cận | Chưa | Không đánh đồng tag gần biển heuristic với lớp POI bản đồ |
| FR-17 | Must | Hiển thị khoản phí đã biết, unknown không thành 0 | Có triển khai A1/B1 | Đối chiếu đủ loại phí; theo mức sử dụng, unknown, deposit |
| FR-18 | Must | Tổng tháng và chi phí ban đầu theo kỳ thuê | Có triển khai A1/B1 | 5 fixtures chi phí offline PASS; UI/DB đối chiếu; cọc cố định chưa hỗ trợ |
| FR-19 | Must | Lưu thông tin người đăng, minh chứng và ghi chú | Có triển khai 7C/B2 | Upload giả lập, ngày tải, phiên bản, ghi chú |
| FR-20 | Must | Hai mức xác minh và ngày xác minh | Có triển khai 7C/B2 | Admin explicit verify; chỉnh sửa reset badge; không tự xác minh |
| FR-21 | Must | Công khai mức, phạm vi, ngày xác nhận | Có triển khai 7C/8A/B2 | Kiểm tra guest đọc đúng scope, không lộ file |
| FR-22 | Must | Quá 14 ngày, nhắc xác nhận | Có triển khai C1 | C1 rollback báo PASS, Cron succeeded; test thông báo thật, ngày 15 và gỡ quá hạn |
| FR-23 | Must | Chỉ Admin mở hồ sơ, ghi log mỗi lần | Một phần kiểm chứng | Private bucket catalog PASS; 4 metadata SKIP; Edge Function actual download/log + negative |
| FR-24 | Should | Yêu thích và trạng thái không khả dụng | Có triển khai 7E/A1 | Persist login; tin ẩn không lộ tên/ảnh; cross-account SKIP |
| FR-25 | Should | So sánh tối đa 3 căn | Có triển khai A1 | Chặn căn thứ 4, so sánh đủ trường/unknown |
| FR-26 | Must | Toàn luồng renter tiếng Anh | Một phần kiểm chứng F1 | Thử search → detail → inquiry → viewing bằng EN, không còn nhãn VI; nội dung user nguyên văn riêng |
| FR-27 | Must | Yêu cầu thuê đủ trường và trạng thái mới | Có triển khai 7D | Guest bị chặn, validation đủ trường, inquiry new |
| FR-28 | Must | Phản hồi nội bộ, contact sau inquiry | Có triển khai 7D/8A/C2 | Tin nhắn realtime/fallback; kiểm tra hai bên đúng quyền trước/sau inquiry, 2 ca renter chéo liên quan |
| FR-29 | Must | Đặt/đổi lịch và xác nhận theo điều kiện | Có triển khai 7D/C2 | Replied/viewing scheduled; chặn terminal; conflict, propose/confirm |
| FR-30 | Must | 5 trạng thái inquiry và lịch sử | Có triển khai 7D/C2 | New/replied/viewing_scheduled/rented/not_proceeding; actor/time/from/to |
| FR-31 | Must | Thời điểm gửi/phản hồi đầu, median và tỷ lệ 24h | Có triển khai 7F/D2 | Đối chiếu KPI trên fixture có timestamp; mục tiêu kinh doanh không phải kết quả đo hiện tại |
| FR-32 | Should | Nhắc yêu cầu chưa phản hồi 24h | Có triển khai C1 | C1 rollback báo PASS; kiểm tra danh sách và notice thực, không trùng |
| FR-33 | Could | Thông báo nội bộ và email nghiệp vụ | Một phần C1/C2 | In-app có; chưa gửi email nghiệp vụ |
| FR-34 | Must | Đăng ký, kích hoạt tin nổi bật thủ công, hết hạn | Có triển khai 7E/D1/D2 | Kiểm thử start/end và hết hạn tự nhiên, không online payment |
| FR-35 | Must | Nhãn tài trợ, vẫn lọc, không ưu tiên quá hạn | Có triển khai 7E/D1 | Kiểm tra sponsored không bypass filter, mất ưu tiên khi quá hạn |
| FR-36 | Should | Lượt xem/liên hệ theo ngày/từng tin, so sánh cùng kỳ | Một phần D1/D2 | Events có; đối chiếu số liệu từng tin và báo cáo theo ngày, không suy diễn nhân quả; chống bot chưa đầy đủ |
| FR-37 | Must | Admin dashboard đủ KPI | Có triển khai 7F/D2 | Đối chiếu tất cả KPI với dữ liệu nguồn, đặc biệt tỷ lệ tin đủ trường/quá hạn |
| FR-38 | Could | Landlord KPI chỉ tin mình | Có triển khai D1/7F | Kiểm thử owner khác, lượt xem/inquiry/lịch |
| FR-39 | Could | Xuất báo cáo Excel/CSV khớp dashboard | Có triển khai một phần D2 | CSV kỳ báo cáo; đối chiếu chỉ số xuất và dashboard; XLSX trực tiếp không bắt buộc nếu CSV đủ |
| FR-40 | Must | Audit nhạy cảm trước/sau, không sửa/xóa | Có triển khai 7F/D2/E2 | E2 admin mutate denied PASS; kiểm tra coverage tất cả sự kiện và actor SYSTEM |
| FR-41 | Must | Báo cáo tin, Admin xử lý/kết quả, người báo nhận phản hồi | Có triển khai 7E | Kiểm tra report/auth, xử lý, notice kết quả, quyền người báo |
| FR-42 | Must | Terms/privacy và consent timestamp | Có triển khai 8B | Thử signup không consent, API trực tiếp, timestamp; pháp lý chưa review |
| FR-43 | Must | Chặn tự duyệt/tự xác minh | Có triển khai B2 | Negative RPC tự duyệt/xác minh, ghi log phù hợp |
| FR-44 | Won't | AI matching ngôn ngữ tự nhiên | Ngoài MVP | F1 heuristic có hướng dẫn, không phải natural-language AI theo FR-44; ghi mở rộng |
| FR-45 | Won't | AI Listing Assistant soạn tiếng Anh | Ngoài MVP | Không suy diễn AI renter là AI hỗ trợ landlord |
| FR-46 | Must | Sau 3 ngày từ nhắc quá hạn thì ẩn, xác nhận lại thì hiển thị | Có triển khai C1 | Rollback báo PASS; Cron active/succeeded; thử đủ điều kiện restore, manual-hidden không tự mở; chốt grace 3 ngày |

## 2. Non-functional requirements — 13 NFR
| Mã | Ưu tiên | Tiêu chí BRD | Trạng thái/việc cần kiểm chứng |
|---|---|---|---|
| NFR-01 | Should | ≤3s cho ≥95% request, 50 concurrent | Chưa đo; test môi trường riêng, không tải áp lực DB đang demo |
| NFR-02 | Should | Map/filter ≤3s với ≥500 tin | Chưa đo; bộ 30 tin không chứng minh |
| NFR-03 | Should | ≥99% uptime/tháng pilot | Chưa có tháng quan sát |
| NFR-04 | Must | Hash mật khẩu, HTTPS, idle 30 phút | Supabase Auth + idle client E1; HTTPS sau deploy và server/token chưa kiểm chứng; không cần tách session |
| NFR-05 | Must | 100% ca quyền đạt, 0 lỗi nghiêm trọng | 29/41 PASS, 12 SKIP; chưa đạt tiêu chí toàn bộ |
| NFR-06 | Must | Privacy, hồ sơ/contact giới hạn quyền và rà soát tuân thủ | RLS 26/26; private bucket; HTTP/evidence, contact, policy và review pháp lý còn mở |
| NFR-07 | Must | Backup tự động hằng ngày, restore ≤4h, thử ít nhất một lần | Chỉ có guide; chưa sao lưu tự động/restore sandbox |
| NFR-08 | Must | Tổng chi phí nhất quán | 5 fixtures và offline A1/B1 PASS; kiểm tra UI nguồn, unknown và tính lặp lại |
| NFR-09 | Should | ≥80% tester tự tìm/gửi request bằng EN | Chưa test người dùng |
| NFR-10 | Must | Chrome/Edge/Safari mới, responsive | F1 có cập nhật; user báo xong; chưa có bằng chứng đủ 3 browser và mobile |
| NFR-11 | Should | Kiểm tra định dạng/dung lượng, nén, số ảnh cấu hình | Một phần; Storage limit có, chưa nén và cấu hình số ảnh |
| NFR-12 | Should | Module, cấu hình danh mục/trường bắt buộc/ngưỡng/phí | Patch 10A.1.1 thêm catalog và 3 trường bổ sung cấu hình; ngưỡng/phí giữ nguyên | Kiểm thử DB/UI và quyền |
| NFR-13 | Could | ≥500 listings/200 accounts, mở rộng VI/AI | VI và heuristic đã có, tải 500/200 chưa chứng minh |

## 3. Quy tắc nghiệp vụ cần giữ
| Mã | Kiểm chứng |
|---|---|
| BRULE-01 | Phạm vi thuê 1–12 tháng và vùng pilot; data demo đa dạng trong phạm vi |
| BRULE-02 | Thiếu trường không gửi duyệt |
| BRULE-03 | Admin duyệt trước công khai, không tự duyệt |
| BRULE-04 | Unknown không thành 0; tổng chỉ theo dữ liệu biết |
| BRULE-05 | Basic verified sau kiểm tra danh tính/quyền sở hữu, scope công khai, không bảo đảm giao dịch |
| BRULE-06 | 14 ngày + 3 ngày grace đề xuất, cần chủ dự án chốt; nhắc và hide/restore |
| BRULE-07 | Sponsored đúng nhãn/lọc/hạn; 600.000 VND/tháng giả định, tin cơ bản miễn phí |
| BRULE-08 | So sánh tối đa 3 căn |
| BRULE-09 | Chỉ replied/viewing scheduled đặt/đổi lịch; terminal bị chặn |
| BRULE-10 | First response, median <24h và ≥80% trong 24h là mục tiêu cần đo |
| BRULE-11 | Contact sau inquiry, không lộ trái quyền |
| BRULE-12 | Trung gian, không sở hữu/môi giới/online payment/contract, cảnh báo kiểm tra trước cọc |
| BRULE-13 | Hướng dẫn lưu trú tham khảo (Could), cần xác nhận pháp lý |

## 4. Bằng chứng hiện có và cổng nghiệm thu
- CSV E2: 29 PASS, 0 FAIL, 12 SKIP (8 renter chéo, 4 evidence metadata). 26 bảng public, không thiếu RLS; 2 hàm trigger nội bộ không cấp execute trực tiếp cho anon/authenticated. Cron active, lần gần nhất succeeded 27/11/2026 12:00 UTC+7. 33 properties, 31 owner NULL (1 non-demo); 1 admin, 2 landlord, 1 renter active; 4/4 email confirmed, không phải bằng chứng delivery.
- 10A: khóa phạm vi, kiểm kê dữ liệu, sao lưu trước khi thay đổi, dùng file SQL đọc riêng để phân biệt tin demo cũ và tin ngoài demo; không gán owner hay xóa tự động.
- 10B: tạo fixture có nhãn demo, dùng account Auth thật và file minh chứng ghi rõ giả lập; thêm renter thứ hai. Ưu tiên tối thiểu fixture, sau đó bộ demo đầy đủ. Không dùng thông tin cá nhân thật, không tạo lịch sử audit/analytics giả làm số liệu thực. Tách dữ liệu test và dữ liệu nghiệp vụ; không dùng `is_demo=true` cho fixture cần maintenance/analytics (chúng bị loại theo thiết kế), dùng marker TEST và tài khoản test có consent, lưu manifest reset riêng.
- 10C: chạy lại E2 rollback + inventory fix, đối chiếu từng SKIP 8C, HTTP thực với guest/tenant A/B/landlord A/B/admin; thử tải file, audit, quyền token sau khóa; kiểm thử email thực, restore sandbox; kiểm thử từng FR Must có evidence; kiểm tra full build trên máy người dùng. Nếu thiếu bằng chứng, ghi pending hoặc chốt deviation, không đánh dấu PASS.
- 10D: deploy HTTPS, Auth redirect production, smoke test, kiểm tra responsive trên 3 browser. Chưa mở dữ liệu thật cho công chúng nếu chưa qua privacy/security/backup gate; demo nội bộ khác vận hành thật.
- 10E: đối chiếu Architecture, DFD, ERD, Data Dictionary, RBAC, RTM và kịch bản demo theo schema 26 bảng & workflow thực. Không thay tài liệu đã có bằng một danh sách không kiểm chứng. FR-44/45 Won't giữ nguyên; F1 là extension heuristic. Giữ bốn vai trò Guest, Renter (tenant), Landlord, Admin; không môi giới/ủy quyền; 3 Chrome profiles; không thêm payment, ký hợp đồng, đặt cọc online.

Các số liệu và trạng thái theo bằng chứng tại thời điểm kiểm tra; không phải chứng nhận hệ thống đạt tất cả Must. Quy trình 10A–10E là đề xuất tổ chức nghiệm thu, không thêm 5 sprint phát triển tính năng.


## Bổ sung 10A.1.1 — cập nhật trên BRD (9), chưa nghiệm thu runtime
| Mã | Ưu tiên | Đã thay đổi trong patch | Còn cần xác nhận |
|---|---|---|---|
| FR-07 | Must | Trigger cập nhật ngày xác nhận với giá/ảnh/tình trạng/ngày dọn vào; reset reminder, audit landlord | Test 3 loại chỉnh sửa, ngày thay đổi, tin ẩn không phục hồi; kiểm tra lịch Cron không đổi |
| FR-10 | Should | Cảnh báo cùng bộ detector, RPC Admin có liên kết ứng viên và đối chiếu ảnh/thông tin | Test hai tin; ảnh cũ chưa hash; chỉ ảnh giống byte/URL, chưa có nhận diện ảnh tương tự về thị giác |
| NFR-12 | Should | Admin quản lý khu vực/tiện ích EN/VI, ngừng sử dụng không xóa; 3 field bổ sung có cấu hình server, giữ trường lõi; giữ ngưỡng/phí | Test catalog mới trên form/filter/AI, inactive, admin audit, chặn renter/guest, kiểm tra submit trực tiếp |
| FR-06 / FR-12 / FR-14 / FR-22 / FR-40 / FR-43 | Theo BRD (9) | Liên quan hồi quy validation/filter/date/reminder/audit/moderation | Không đánh dấu PASS thêm cho đến khi chạy trên DB/UI |

Bản 10A.1.1 có 94 kiểm tra hồi quy + 16 G1 offline (10 tĩnh) PASS, TypeScript PASS. Vite build chưa xác nhận do Rollup Linux. Không thêm bảng, thêm 6 cột và 1 index, 2 trigger. Chưa có bằng chứng migration/rollback/UI live. G1 không thay đổi các vấn đề nghiệm thu tồn tại trước đó; 12 SKIP E2 giữ lại.

Phạm vi tiếp theo đã được chủ dự án chọn: 10A.1.2 FR-16, BRULE-13, FR-45; 10A.1.3 FR-36, FR-39; 10A.1.4 FR-04, FR-33; 10A.1.5 chỉnh UI/UX. Không triển khai FR-11, FR-44, NFR-11 trong đợt này; BRULE-12 vẫn cần nghiệm thu. Không tách phiên Admin/Public. Không môi giới/ủy quyền.


## 10A.1.2 – Nearby places, Stay Guide, Listing Assistant (27/11/2026)
- 10A.1.1: CSV của chủ dự án xác nhận 6 PASS, 0 FAIL, 1 SKIP (duplicate candidate and admin link, cần hai tin TEST chưa xác minh có thể sửa và admin active). Cộng E2: 13 SKIP còn theo dõi. FR-07 đã test sửa availability; giá/ảnh cần test riêng.
- FR-16: trang chi tiết có nút tải điểm OSM Overpass, 4 lớp beach/supermarket/hospital/city-town reference, bán kính 5 km, 5 điểm/nhóm, hiển thị marker và danh sách khoảng cách đường thẳng Haversine. Điểm của way/relation là tâm đại diện; không phải khoảng cách đường đi, bờ biển gần nhất hay trung tâm hành chính chính thức. Dữ liệu có thể thiếu. Không xin vị trí người dùng; gửi tọa độ tin công khai, không gửi token/email/địa chỉ; endpoint có thể ghi IP theo hạ tầng của họ. Cache bộ nhớ 30 phút, tối đa 20 vị trí, gộp request trùng, timeout 22 giây, lỗi thử lại sau 15 giây; không tự tải hàng loạt. Không thay base map Esri. Cần xác nhận CORS/OSM live, độ chính xác, fallback, mobile. Public Overpass là dịch vụ chia sẻ, không SLA.
- BRULE-13: /stay-guide song ngữ, link Footer và chi tiết, nguồn chính thức Luật 23/2023/QH15 Điều 2 khoản 5, Thông tư 87/2026/TT-BCA hiệu lực 24/7/2026; phân biệt điện tử ngay khi đến và phiếu 12h/24h vùng sâu xa; vai trò bên quản lý chỗ ở và khách, không thu hộ chiếu hay khai báo thay. Nguồn trong code, rà soát 27/11/2026; cần chuyên gia/owner duyệt nội dung trước pilot, không phải tư vấn pháp lý.
- FR-45 (Won't gốc, extension do chủ dự án chọn): trợ lý mẫu thông minh 2 cách diễn đạt, dữ liệu form/catalog EN, preview + checkbox xác nhận thay title/summary/description, stale guard, bỏ bản nháp, không lưu tự động, không gửi dữ liệu/API AI. Không bịa tiện ích/verification, không đảm bảo ngôn ngữ tự do. Không quảng cáo là generative AI. Kiểm thử form, dữ liệu thiếu, sửa preview, gửi duyệt, quyền sở hữu.
- Frontend only: 10 source files + 1 test; không SQL, không bảng/cột, không đổi RLS/Auth/Cron. TypeScript PASS; 110 hồi quy trước + 38 G2 assertions (mocked network và tĩnh) = 148 PASS. Vite build thất bại do quyền executable và thiếu @rollup/rollup-linux-x64-gnu. Không test live UI/Overpass/Supabase.
- Tiếp 10A.1.3 FR-36/39, 10A.1.4 FR-04/33, 10A.1.5 UI/UX. Giữ backlog nghiệm thu: BRULE-12, 13 SKIP, email delivery, storage, backup/restore, hiệu năng, session 30 phút server.


## 10A.1.3 – FR-36 / FR-39 (BRD bản 9)
| Mã | Ưu tiên | Patch | Còn cần nghiệm thu |
|---|---|---|---|
| FR-36 | Should | Report từng tin 7/30/90 ngày, daily view và inquiry theo hiệu lực tài trợ tại thời điểm event, tổng chiến dịch trong kỳ; CSV ngày/chiến dịch. Admin/Landlord scope server | SQL nguồn, phân quyền, kiểm tra có dữ liệu thật và chiến dịch kết thúc; không đếm trùng, dữ liệu trước D1 null; chưa đo causal lift |
| FR-39 | Could | CSV snapshot KPI hiện trạng từ object đang hiển thị (FR-37, status counts/share, timestamps, account breakdown), giữ xuất D2 theo kỳ | So từng giá trị/đơn vị với dashboard và Excel; không query lại khi export. Không có XLSX trực tiếp, account breakdown từ request riêng |
| FR-37 / FR-38 / NFR-05 | Hồi quy theo BRD | Giữ công thức KPI, bổ sung scope read-only; không thay nguồn ghi | Kiểm tra dữ liệu thật, tài khoản khác và ca SKIP E2 |

Không thêm bảng/cột, thêm 1 index và 2 RPC. TypeScript PASS, 170 offline assertions PASS (gồm 22 mới), chưa test SQL/UI thật, build Linux thiếu Rollup. 13 SKIP từ E2/G1 chưa nghiệm thu; G2 user yêu cầu tiếp nhưng chưa cung cấp log UI/Overpass. Giữ các tồn tại đã nêu trong RTM. Tiếp 10A.1.4 email, 10A.1.5 UI/UX.

## 10A.1.4 – Account & Email (BRD bản 9)
| Mã | Ưu tiên | Patch | Còn cần nghiệm thu |
|---|---|---|---|
| FR-04 | Could | Renter/Landlord active tự yêu cầu đổi login email qua Supabase Auth; giữ contact email riêng; validate, kiểm tra actor, UI hiển thị email xác nhận | Secure email change + SMTP + redirect, hai mailbox thật, ID/role/ownership, duplicate/invalid, login mới; Admin provision riêng |
| FR-33 | Could | Opt-in email mới từ notice hiện có; outbox/worker/lease/retry/idempotency, template song ngữ, admin aggregate | Cấu hình sender/Resend/Vault/pg_net/Cron, kiểm tra recipient thật, anti-duplicate, lock/opt-out, inbox; accepted != delivered; no webhook, không backfill, giới hạn best-effort |
| FR-01 / FR-02 / NFR-04 / NFR-05 | Hồi quy | Giữ Auth và phiên chung, backend role active, RPC client bị giới hạn | SMTP/reset/confirm; token cũ, server idle, HTTP/RLS, 13 SKIP |

DB dự kiến 27 bảng, 1 cột profile, 2 index, 1 trigger, 5 functions. 201 offline PASS và TypeScript; SQL, Deno worker, live UI, Vite build chưa đạt/xác minh. 10A.1.3 chưa có log CSV. Chưa bật gửi thư thật, không khẳng định FR-33 nghiệm thu. Tiếp 10A.1.5 UI/UX.


## UI-01 — ghi nhận trình bày (không đổi phạm vi nghiệp vụ)
| Phạm vi | Bằng chứng source / kiểm thử | Trạng thái |
|---|---|---|
| Homepage, Header/Footer, How It Works | hero/trust/featured/how-it-works/footer; URL tìm kiếm, Stay Guide và anchor giữ nguyên | Đã sửa code, chờ UI QA |
| Explore và thẻ căn hộ | search.tsx, listing-card.tsx; native dialog, URL và chips | TypeScript + static PASS, chờ browser |
| Chi tiết, ảnh và phí | apartment-detail, gallery, cost-breakdown; giữ hàm nghiệp vụ và POI/contact/analytics | TypeScript + static PASS, chờ browser |
| Saved/Compare | saved và comparison-table; sticky headers, nhãn highlight, không đổi quy tắc | TypeScript + static PASS, chờ browser |
| Khả dụng giao diện, song ngữ và responsive (tiêu chí NFR cần nghiệm thu) | 6 cặp màu kiểm tra tương phản, nhãn EN/VI và native dialog; chưa đo usability | Chưa nghiệm thu |
| Bảo mật, email, RLS, database | Không đổi SQL, API hay Auth | Giữ trạng thái trước đó |

201 kiểm tra hồi quy + 28 kiểm tra mới offline đạt. Full Vite Build chưa đạt trong container do thiếu Rollup Linux; chưa render browser. Giữ 13 SKIP và mọi giới hạn trước UI-01. Không đánh dấu toàn bộ yêu cầu hoàn thành từ các kiểm tra này.


## UI-02 — User & Landlord Experience (giao diện, không đổi yêu cầu gốc)
| Phạm vi | Thay đổi source | Cần nghiệm thu |
|---|---|---|
| FR-05/06/07, NFR-12 | Form tạo/sửa 7 bước, state chung, validation cũ + điều hướng bước lỗi, lưu nháp và submit cũ, danh mục động | Thử tạo/sửa, chuyển bước, ảnh/tọa độ, phụ phí, trường bắt buộc, lỗi upload và phục hồi nháp |
| FR-45 mở rộng | Trợ lý theo mẫu tại Review; giữ xác nhận và stale guard | Tạo lại, áp dụng, sửa, không tự lưu |
| AI matching mở rộng | Khung chat mở rộng, lịch sử thu gọn, tiến độ; giữ thuật toán và RPC công khai | 8 câu, kết quả, điều hướng, desktop/mobile |
| Luồng yêu cầu, tin nhắn, lịch xem và thông báo | Cards, history, inbox 2 cột, filter unread, icon; giữ RPC và explicit mark-read | Realtime, contact privacy, conflict, xác nhận, mark-read và deep link |
| Landlord KPI và kiểm duyệt | Action center, bar chart từ KPI thật, filter trạng thái, review summary theo dữ liệu thực; xác minh riêng | Đối chiếu số nguồn, trạng thái/ảnh, quyền sở hữu, null/empty/loading |
| Responsive, usability, song ngữ | Điều hướng bước, aria-current/progress, nhãn EN/VI, màu nhấn tiết chế | Browser, 320/390/768/1280px, keyboard, dịch, tương phản toàn trang |

13 file frontend và 1 script; không SQL hay thay đổi DB/API. TypeScript PASS, 229 cũ + 40 mới (logic/tĩnh) = 269 offline PASS; Vite build lỗi thiếu Rollup Linux. Chưa có QA browser và kiểm thử Supabase trực tiếp. Không đóng các ca SKIP hoặc yêu cầu tồn tại từ trước. Tiếp UI-03.


## UI-03 — Admin & Final Polish

| Nhóm | Thay đổi frontend | Nghiệm thu còn lại |
|---|---|---|
| FR-37/36/39 KPI, hiệu quả và CSV | Distribution từ kpis.counts; DailyTrend navy/sage, null khác 0; giữ export snapshot/period/listing/campaign | Đối chiếu báo cáo/CSV với nguồn; chưa có CSV G3 |
| FR-03 / RBAC | Giữ role active guard và tất cả RPC cũ; nhóm menu Admin, dialog mobile | E2 12 SKIP, token cũ, test đường dẫn, focus mobile |
| FR-10 / NFR-12 / cấu hình | Điều hướng nhanh Settings, giữ panel danh mục, preview, đối chiếu trùng, lý do/Audit Log | 1 SKIP 10A11 và kiểm tra UI |
| FR-33 | Card trạng thái hàng đợi, phân biệt provider accepted với delivered | Worker/SMTP/Resend và nhận email thực tế chưa xác minh |
| NFR-08/09/10 / FR-26 | Manrope admin, semantic tone, wrap, reduced motion, skeleton, empty states, label vùng cuộn; EN/VI phần mới | Chrome/Edge/Safari, mobile, keyboard, chuỗi dịch và tương phản toàn trang |

TypeScript PASS, 269 cũ + 41 mới = 310 offline PASS; Vite build thiếu Rollup Linux. 15 file frontend, 1 script. Không SQL/API/DB thay đổi. Chưa có QA browser. Không đóng các yêu cầu tồn tại hoặc ca SKIP. Tiếp 10B sau khi kiểm tra UI-03.
