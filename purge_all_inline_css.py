import os
import glob
import re

base_dir = r"c:\Users\PC\Pictures\aigeo-main\teacher"

# Matches "/* =======..." then "@media (max-width: 768px) {" and perfectly balances braces.
pattern = re.compile(
    r'/\*\s*={10,}\s*\n.*?\n\s*={10,}\s*\*/\s*\n\s*@media\s*\(\s*max-width:\s*768px\s*\)\s*\{(?:[^{}]*|\{(?:[^{}]*|\{[^{}]*\})*\})*\}',
    re.MULTILINE | re.DOTALL
)

count = 0
for filepath in glob.glob(os.path.join(base_dir, '*.html')):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content, num_subs = pattern.subn('', content)
    
    if num_subs > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        count += 1
        print(f"Purged remaining legacy CSS from {os.path.basename(filepath)}")

print(f"Total files aggressively purged: {count}")
