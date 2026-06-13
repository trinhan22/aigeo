import os

def add_favicon_to_html_files(root_dir, favicon_url):
    """
    Duyệt qua một thư mục, tìm tất cả các tệp HTML và thêm một link favicon
    vào ngay sau thẻ <head>.

    Args:
        root_dir (str): Thư mục gốc để bắt đầu tìm kiếm.
        favicon_url (str): URL đầy đủ của tệp favicon.
    """
    # Dòng mã HTML sẽ được thêm vào
    favicon_tag = f'    <link rel="icon" type="image/png" href="{favicon_url}">\n'
    
    # Biến đếm số tệp đã được chỉnh sửa
    files_modified_count = 0
    
    print(f"Bắt đầu quá trình thêm favicon vào các tệp trong thư mục '{root_dir}'...")

    # os.walk sẽ duyệt qua tất cả các thư mục và tệp con
    for subdir, _, files in os.walk(root_dir):
        for file in files:
            # Chỉ xử lý các tệp có đuôi .html
            if file.endswith('.html'):
                filepath = os.path.join(subdir, file)
                try:
                    # Mở tệp để đọc và ghi ('r+')
                    with open(filepath, 'r+', encoding='utf-8') as f:
                        content = f.read()
                        
                        # Tìm vị trí của thẻ <head>
                        head_pos = content.find('<head>')
                        
                        if head_pos != -1:
                            # Tìm vị trí để chèn (ngay sau thẻ <head>)
                            insertion_point = content.find('>', head_pos) + 1
                            
                            # Kiểm tra xem link favicon đã tồn tại chưa để tránh thêm trùng lặp
                            if favicon_url not in content:
                                # Tạo nội dung mới bằng cách chèn thẻ favicon
                                new_content = content[:insertion_point] + '\n' + favicon_tag + content[insertion_point:]
                                
                                # Quay lại đầu tệp, ghi nội dung mới và cắt bỏ phần thừa
                                f.seek(0)
                                f.write(new_content)
                                f.truncate()
                                
                                print(f"-> Đã thêm favicon vào: {filepath}")
                                files_modified_count += 1
                            else:
                                print(f"-> Bỏ qua (favicon đã có): {filepath}")
                        else:
                            print(f"** Cảnh báo: Không tìm thấy thẻ <head> trong tệp {filepath}")

                except Exception as e:
                    print(f"!! Lỗi khi xử lý tệp {filepath}: {e}")

    print(f"\nHoàn tất! Đã thêm favicon vào tổng cộng {files_modified_count} tệp HTML.")

# --- CẤU HÌNH VÀ THỰC THI ---
if __name__ == "__main__":
    # 1. Thay đổi 'aigeo' thành tên thư mục dự án của bạn nếu cần
    project_directory = 'aigeo'
    
    # 2. Dán link favicon của bạn vào đây
    favicon_link = "https://i.ibb.co/JW99dcWX/IMG-7810.png"
    
    # 3. Gọi hàm để thực thi
    add_favicon_to_html_files(project_directory, favicon_link)
