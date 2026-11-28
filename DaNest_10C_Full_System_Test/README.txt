DaNest – 10C | Một đợt kiểm thử tổng hợp (27/11/2026)

CHỈ dùng database demo CAP. Không chạy trên production thật. Không gửi mật khẩu,
secret/service_role key, JWT, email người dùng hoặc file minh chứng thật vào chat.
Không cần tạo tài khoản mới. Giữ 3 Chrome profiles; đổi login khi cần Renter 2/Landlord 2.

A. SQL – Supabase SQL Editor (một lần)
1. Xác nhận database demo, không có external webhooks/custom external triggers,
   không bật email nghiệp vụ; không có người khác thao tác trong khi test.
2. Mở A_10C_Security_Rollback.sql bằng VS Code, copy toàn bộ (dưới 96 dòng).
   Kiểm tra dòng cuối ROLLBACK; rồi Run. Xuất bảng check_name,result,detail ra A_results.csv.
   SQL dùng CAP đã có, mô phỏng JWT claims + role DB, không có COMMIT. Một số probe
   thử quyền ghi và khóa tài khoản tạm trong subtransaction rồi rollback. Không thử
   HTTP, Auth token thật, download hoặc upload byte Storage. Kiểm tra webhook chỉ là
   guard cho pattern phổ biến, không chứng minh không có side effect bên ngoài.
   Nếu guard chặn hoặc lỗi SQL, dừng, gửi lỗi; không tắt RLS/trigger để chạy.
   A_optional_Data_Baseline.sql là bản 54 check 10B.4.1D, không cần chạy lại trừ khi muốn
   đối chiếu sau test A. Số lượng cứng 40/20/... sẽ thay đổi nếu bạn đã thao tác thêm.

B. VS Code (một lệnh)
1. Giải nén ZIP vào thư mục gốc dự án (cùng cấp package.json và src). Không ghi đè src,
   supabase, tests, package.json. Mở Terminal tại thư mục gốc.
2. Chạy: node .\DaNest_10C_Full_System_Test\B_run_tests.cjs
   Dùng dependencies hiện có, không cài thêm. Script copy các test offline vào thư mục
   tạm cùng cấp src, chạy rồi xóa thư mục tạm; chạy tsc -b và vite build. Build có thể
   tạo/cập nhật dist và cache tsbuildinfo. Không chạy deploy. Nếu source đang mở
   với dev server thì có thể dừng server để tránh HMR do build, không bắt buộc.
3. Kết quả trong DaNest_10C_Full_System_Test/results/ gồm B_results.csv và log từng test.
   Một FAIL ở kiểm tra chuỗi source cũ có thể do UI đổi hợp lệ, cần xem log rồi phân loại.
   Không đồng nhất thời gian build với hiệu năng website; không tự chạy tải 50 user.

C. Website (một đợt UAT)
1. Chạy ứng dụng như bình thường; mở C_UAT.md, thực hiện các ca ưu tiên P0 rồi P1.
2. Dùng CAP TEST, tài liệu giả lập, email của bạn. Không duyệt tài liệu giả làm thật;
   không đổi dữ liệu mẫu công khai thành dữ liệu thực. Ca ghi dữ liệu chỉ làm trên
   fixture riêng/được phép; ghi ID, không reset database. Không bấm gửi email hàng loạt.
3. Ghi PASS/FAIL/SKIP/NOT RUN và bằng chứng, không suy diễn PASS từ bước A/B.
   Các ca cần thiết bị, mailbox, Edge Function hoặc sandbox riêng nếu thiếu thì SKIP.

Gửi một lần: A_results.csv, B_results.csv, log FAIL (đọc và che thông tin nhạy cảm),
C_UAT.md đã điền hoặc danh sách ca FAIL/SKIP/NOT RUN + ảnh màn hình đã che dữ liệu riêng.
D_RTM_reference.md là bản RTM tham khảo trước 10C; không phải kết quả 10C. Sau khi có
kết quả mới cập nhật trạng thái từng FR/NFR/BRULE. Không tuyên bố nghiệm thu toàn bộ
khi còn ca Must thiếu bằng chứng. Không có kết quả giả lập sẵn trong bộ này.
