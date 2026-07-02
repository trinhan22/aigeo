import os
import glob

def check_files():
    files = glob.glob('**/*.html', recursive=True)
    missing = []
    for f in files:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            if 'global-notification-bell' not in content:
                missing.append(f)
    print("Files missing global-notification-bell:")
    for m in missing:
        print(m)

check_files()
