import os
import glob

base_dir = r"c:\Users\PC\Pictures\aigeo-main\student"

count = 0
for filepath in glob.glob(os.path.join(base_dir, '*.html')):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content.replace('bg-slate-50/50 p-8', 'bg-slate-50/50 p-4 md:p-8')
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        count += 1
        print(f"Updated padding in {filepath}")

print(f"Total files updated: {count}")
