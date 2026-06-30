import os
import glob
import re

base_dir = r"c:\Users\PC\Pictures\aigeo-main"

# Matches the exact block that hides breadcrumbs and forces flex-end
pattern = re.compile(
    r'\.flex\.items-center\.gap-2\.text-xs\.font-bold\.text-slate-400\.uppercase\.tracking-widest\s*\{.*?(?:#auth-header-wrapper,\s*\.user-pill\s*\{\s*margin-left:\s*auto\s*!important;\s*\})',
    re.DOTALL
)

count = 0
for filepath in glob.glob(os.path.join(base_dir, '**', '*.html'), recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content, num_subs = pattern.subn('', content)
    
    if num_subs > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        count += 1
        print(f"Fixed {filepath}")

print(f"Total files fixed: {count}")
