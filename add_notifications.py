import os
import re

directories = ['admin', 'student', 'teacher', 'client']
bell_html = '<div id="global-notification-bell" class="mr-2 sm:mr-4 z-50"></div>'
script_html = '<script type="module" src="../notifications.js"></script>'

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    if 'global-notification-bell' not in content:
        # Inject Bell HTML
        # We look for id="user-name"
        # Case 1: <div class="text-right hidden sm:block">\s*<p id="user-name"
        # We want to insert bell_html before this <div
        pattern1 = r'(<div class="text-right hidden sm:block">\s*<p id="user-name")'
        if re.search(pattern1, content):
            content = re.sub(pattern1, bell_html + r'\n                \1', content)
        else:
            # Case 2: <span id="user-name"
            # We want to insert bell_html before this <span
            pattern2 = r'(<span id="user-name")'
            if re.search(pattern2, content):
                content = re.sub(pattern2, bell_html + r'\n                \1', content)
            else:
                # Case 3: <p id="user-name" (without the div wrapper)
                pattern3 = r'(<p id="user-name")'
                if re.search(pattern3, content):
                    content = re.sub(pattern3, bell_html + r'\n                \1', content)

    # Inject Script HTML right before </body>
    if 'notifications.js' not in content:
        # Some files are in client/ which might need different path, but since client/ is 1 level deep, ../ is correct.
        content = content.replace('</body>', script_html + '\n</body>')

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes needed for {filepath}")

for d in directories:
    full_dir = os.path.join(r'c:\Users\PC\Pictures\aigeo-main', d)
    if os.path.exists(full_dir):
        for root, dirs, files in os.walk(full_dir):
            for file in files:
                if file.endswith('.html'):
                    process_file(os.path.join(root, file))
