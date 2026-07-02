import os

base_dir = r"c:\Users\PC\Pictures\aigeo-main"
files_to_update = ['auth.html', 'dieu-khoan.html', 'huong-dan-su-dung.html', '404.html', 'index.html']

head_injection = """
    <!-- Dark Mode Initializer -->
    <link rel="stylesheet" href="dark-mode.css?v=6">
    <script>
        if (localStorage.getItem('theme') === 'dark') {
            document.documentElement.classList.add('dark');
        }
    </script>
</head>"""

for fname in files_to_update:
    path = os.path.join(base_dir, fname)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if "<!-- Dark Mode Initializer -->" not in content:
            content = content.replace("</head>", head_injection)
            
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
        print(f"Updated head in {fname}")

# Now update index.html specifically for the button
index_path = os.path.join(base_dir, 'index.html')
with open(index_path, 'r', encoding='utf-8') as f:
    index_content = f.read()

button_html = """
            <button id="theme-toggle-index" class="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200 transition shadow-sm border border-slate-200" title="Chuyển đổi giao diện">
                <i data-feather="moon" id="icon-moon-index" class="w-4 h-4"></i>
                <i data-feather="sun" id="icon-sun-index" class="w-4 h-4 hidden"></i>
            </button>
            <!-- Container xử lý đăng nhập -->"""

if 'id="theme-toggle-index"' not in index_content:
    index_content = index_content.replace("<!-- Container xử lý đăng nhập -->", button_html, 1)

script_html = """
    <script>
        // Dark mode toggle logic for index
        (function() {
            const toggleBtn = document.getElementById('theme-toggle-index');
            const moonIcon = document.getElementById('icon-moon-index');
            const sunIcon = document.getElementById('icon-sun-index');
            
            function updateIcons() {
                if (!moonIcon || !sunIcon) return;
                if (document.documentElement.classList.contains('dark')) {
                    moonIcon.classList.add('hidden');
                    sunIcon.classList.remove('hidden');
                } else {
                    moonIcon.classList.remove('hidden');
                    sunIcon.classList.add('hidden');
                }
            }

            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    document.documentElement.classList.toggle('dark');
                    const isDark = document.documentElement.classList.contains('dark');
                    localStorage.setItem('theme', isDark ? 'dark' : 'light');
                    updateIcons();
                });
                updateIcons();
            }
        })();
    </script>
</body>"""

if "Dark mode toggle logic for index" not in index_content:
    index_content = index_content.replace("</body>", script_html)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(index_content)
    
print("Updated index.html with button and script")
