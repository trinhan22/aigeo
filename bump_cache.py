import os

base_dir = r"c:\Users\PC\Pictures\aigeo-main"
files_to_update = ['auth.html', 'dieu-khoan.html', 'huong-dan-su-dung.html', '404.html', 'index.html', 'notifications.js']

for fname in files_to_update:
    path = os.path.join(base_dir, fname)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        content = content.replace("dark-mode.css?v=8", "dark-mode.css?v=9")
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Bumped cache in {fname}")
